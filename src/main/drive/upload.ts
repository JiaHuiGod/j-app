import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { net, type Session } from 'electron';
import type {
  DriveError,
  DriveResult,
  DriveUploadFileResult,
  DriveUploadProgress,
  DriveUploadResult,
} from '@shared/drive';
import { fetch115Json } from './115-http';

const API_ORIGIN = 'https://webapi.115.com';
const UPLOAD_INIT_URL = 'https://uplb.115.com/3.0/sampleinitupload.php';
const UPLOAD_TIMEOUT_MS = 30 * 60_000;
const MAX_NAME_LENGTH = 255;

interface UploadFile {
  readonly path: string;
  readonly name: string;
}

interface UploadCredentials {
  readonly accessId: string;
  readonly callback: string;
  readonly host: string;
  readonly object: string;
  readonly policy: string;
  readonly signature: string;
}

function failure<T>(code: DriveError['code'], message: string): DriveResult<T> {
  return {
    ok: false,
    error: { code, message },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}

function escapeMultipartName(value: string): string {
  return value.replaceAll('"', '_').replaceAll('\r', '_').replaceAll('\n', '_');
}

function buildMultipartHead(
  boundary: string,
  fileName: string,
  credentials: UploadCredentials,
  target: string,
): Buffer {
  const fields: Array<[string, string]> = [
    ['name', fileName],
    ['policy', credentials.policy],
    ['OSSAccessKeyId', credentials.accessId],
    ['success_action_status', '200'],
    ['callback', credentials.callback],
    ['signature', credentials.signature],
    ['key', credentials.object],
    ['target', target],
  ];
  const chunks = fields.map(
    ([name, value]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
  chunks.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${escapeMultipartName(
      fileName,
    )}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );

  return Buffer.from(chunks.join(''), 'utf8');
}

async function getUserId(siteSession: Session): Promise<DriveResult<string>> {
  const response = await fetch115Json(
    siteSession,
    `${API_ORIGIN}/offine/downpath`,
  );

  if (!response.ok) {
    return response;
  }

  const data = Array.isArray(response.data.data) ? response.data.data : [];
  const userId = asText(asRecord(data[0])?.user_id);

  return userId
    ? { ok: true, data: userId }
    : failure('auth_required', '无法读取 115 用户信息，请重新登录。');
}

async function initUpload(
  siteSession: Session,
  userId: string,
  fileName: string,
  fileSize: number,
  target: string,
): Promise<DriveResult<UploadCredentials>> {
  const body = new URLSearchParams({
    userid: userId,
    filename: fileName,
    filesize: String(fileSize),
    target,
  });
  const response = await fetch115Json(siteSession, UPLOAD_INIT_URL, {
    method: 'POST',
    body: body.toString(),
  });

  if (!response.ok) {
    return response;
  }

  const credentials: UploadCredentials = {
    accessId: asText(response.data.accessid),
    callback: asText(response.data.callback),
    host: asText(response.data.host),
    object: asText(response.data.object),
    policy: asText(response.data.policy),
    signature: asText(response.data.signature),
  };

  if (
    !credentials.host ||
    !credentials.object ||
    !credentials.accessId ||
    !credentials.policy ||
    !credentials.signature ||
    !credentials.callback
  ) {
    return failure('api', '115 上传初始化失败，请稍后重试。');
  }

  try {
    const host = new URL(credentials.host);

    if (host.protocol !== 'https:' && host.protocol !== 'http:') {
      return failure('api', '115 返回了无效的上传地址。');
    }
  } catch {
    return failure('api', '115 返回了无效的上传地址。');
  }

  return { ok: true, data: credentials };
}

function writeChunk(
  request: Electron.ClientRequest,
  chunk: Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = () => {
      reject(new Error('上传连接中断。'));
    };

    request.once('error', onError);
    request.write(chunk, undefined, () => {
      request.removeListener('error', onError);
      resolve();
    });
  });
}

async function uploadToOss(
  siteSession: Session,
  filePath: string,
  fileName: string,
  credentials: UploadCredentials,
  target: string,
  onProgress: (uploadedBytes: number) => void,
): Promise<DriveResult<null>> {
  const boundary = `----JAppBoundary${randomUUID().replaceAll('-', '')}`;
  const head = buildMultipartHead(boundary, fileName, credentials, target);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

  let request: Electron.ClientRequest;

  try {
    request = net.request({
      method: 'POST',
      url: credentials.host,
      session: siteSession,
    });
  } catch {
    return failure('network', '无法连接 115 上传服务。');
  }

  request.setHeader('Accept', 'application/json, text/plain, */*');
  request.setHeader(
    'Content-Type',
    `multipart/form-data; boundary=${boundary}`,
  );
  // Electron reserves Content-Length for its own upload pipeline. Omitting it
  // lets Chromium stream the multipart body with chunked transfer encoding,
  // which the 115 OSS callback endpoint accepts.
  request.setHeader('Referer', 'https://115.com/');
  request.setHeader('User-Agent', siteSession.getUserAgent());

  const responsePromise = new Promise<DriveResult<null>>((resolve) => {
    request.on('response', (response) => {
      const chunks: Buffer[] = [];

      response.on('data', (chunk: Buffer) => {
        chunks.push(Buffer.from(chunk));
      });

      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');

        if (response.statusCode < 200 || response.statusCode >= 300) {
          resolve(
            failure('api', `115 上传失败（HTTP ${response.statusCode}）。`),
          );
          return;
        }

        try {
          const body = JSON.parse(text) as unknown;
          const record = asRecord(body);

          if (!record || record.state === false) {
            resolve(
              failure(
                'api',
                asText(record?.error) || '115 上传回调失败，请稍后重试。',
              ),
            );
            return;
          }

          resolve({ ok: true, data: null });
        } catch {
          resolve(failure('api', '115 上传返回了无法解析的响应。'));
        }
      });

      response.on('error', () => {
        resolve(failure('network', '读取 115 上传响应失败。'));
      });
    });

    request.on('error', (requestError: Error) => {
      console.error('115 OSS upload request failed:', requestError);
      resolve(failure('network', '115 上传连接失败，请检查网络或代理。'));
    });
  });

  const timeout = setTimeout(() => {
    request.abort();
  }, UPLOAD_TIMEOUT_MS);

  try {
    await writeChunk(request, head);
    let uploadedBytes = 0;
    const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 });

    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      await writeChunk(request, buffer);
      uploadedBytes += buffer.length;
      onProgress(uploadedBytes);
    }

    await writeChunk(request, tail);
    request.end();

    return await responsePromise;
  } catch {
    request.abort();
    return failure('network', '文件上传中断，请检查网络或代理。');
  } finally {
    clearTimeout(timeout);
  }
}

export async function upload115Files(
  siteSession: Session,
  targetFolderId: string,
  files: readonly UploadFile[],
  onProgress: (progress: DriveUploadProgress) => void,
): Promise<DriveResult<DriveUploadResult>> {
  const userId = await getUserId(siteSession);

  if (!userId.ok) {
    return userId;
  }

  const uploadId = randomUUID();
  const target = `U_1_${targetFolderId}`;
  const results: DriveUploadFileResult[] = [];
  let uploaded = 0;
  let failed = 0;

  for (const [index, file] of files.entries()) {
    const baseProgress = {
      uploadId,
      fileName: file.name,
      fileIndex: index,
      fileCount: files.length,
    } as const;

    onProgress({
      ...baseProgress,
      uploadedBytes: 0,
      totalBytes: 0,
      status: 'uploading',
    });

    try {
      const fileInfo = await stat(file.path);

      if (!fileInfo.isFile()) {
        throw new Error('目标不是文件。');
      }

      if (file.name.length > MAX_NAME_LENGTH) {
        throw new Error('文件名过长。');
      }

      const credentials = await initUpload(
        siteSession,
        userId.data,
        file.name,
        fileInfo.size,
        target,
      );

      if (!credentials.ok) {
        throw new Error(credentials.error.message);
      }

      onProgress({
        ...baseProgress,
        uploadedBytes: 0,
        totalBytes: fileInfo.size,
        status: 'uploading',
      });

      const result = await uploadToOss(
        siteSession,
        file.path,
        file.name,
        credentials.data,
        target,
        (uploadedBytes) => {
          onProgress({
            ...baseProgress,
            uploadedBytes,
            totalBytes: fileInfo.size,
            status: 'uploading',
          });
        },
      );

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      results.push({ name: file.name, status: 'success' });
      uploaded += 1;
      onProgress({
        ...baseProgress,
        uploadedBytes: fileInfo.size,
        totalBytes: fileInfo.size,
        status: 'success',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '上传失败，请稍后重试。';

      results.push({ name: file.name, status: 'failed', message });
      failed += 1;
      onProgress({
        ...baseProgress,
        uploadedBytes: 0,
        totalBytes: 0,
        status: 'failed',
        error: message,
      });
    }
  }

  return {
    ok: true,
    data: {
      canceled: false,
      uploaded,
      failed,
      files: results,
    },
  };
}

export function getUploadFileName(filePath: string): string {
  return path.basename(filePath);
}
