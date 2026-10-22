import path from 'node:path';
import { createWriteStream, promises as fs } from 'node:fs';
import { dialog, net, shell, type Session, type WebContents } from 'electron';
import type {
  DriveDownloadProgress,
  DriveDownloadResult,
  DriveError,
  DriveErrorCode,
  DriveResult,
} from '@shared/drive';
import { IpcChannel } from '@shared/ipc';
import { parseSiteConnectionId } from '../settings/schema';
import { getMainWindow } from '../window';
import { getAccountSession } from './115';
import { fetch115JsonDetailed } from './115-http';
import { getDownloadDirectory } from '../settings/store';

const VIDEO_ENDPOINT = 'https://webapi.115.com/files/video?pickcode=';
const FILE_DOWNLOAD_ENDPOINT = 'https://webapi.115.com/files/download?';
const FILE_REDIRECT_ENDPOINT = 'https://dl.115cdn.net/files/dl302?';
const MAX_PICKCODE_LENGTH = 128;
const MAX_DOWNLOAD_KEY_LENGTH = 256;
const MAX_DOWNLOAD_ID_LENGTH = 128;
const MAX_FILE_NAME_LENGTH = 200;
const PROGRESS_INTERVAL_MS = 250;
const VIDEO_EXTENSIONS = [
  'mp4',
  'mkv',
  'avi',
  'mov',
  'wmv',
  'flv',
  'webm',
  'm4v',
  'ts',
  'm2ts',
];
const PERSISTENT_COOKIE_NAMES = new Set([
  'GST',
  'USERSESSIONID',
  'UID',
  'CID',
  'SEID',
  'KID',
  'PHPSESSID',
  '115_lang',
]);
const completedDownloads = new Map<string, string>();
const activeDownloads = new Map<string, AbortController>();

class DownloadCanceledError extends Error {
  constructor() {
    super('下载已取消。');
    this.name = 'DownloadCanceledError';
  }
}

interface ParsedDownloadRequest {
  readonly downloadId: string;
  readonly connectionId: string;
  readonly pickcode: string;
  readonly fileName: string;
  readonly kind: 'file' | 'video';
  readonly downloadKey: string;
}

interface DownloadSource {
  readonly downloadUrl: string;
  readonly setCookie: readonly string[];
}

function failure<T>(code: DriveErrorCode, message: string): DriveResult<T> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function isDriveError(value: unknown): value is DriveError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : '文件下载失败，请稍后重试。';
}

function parseHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  try {
    const url = new URL(value.replaceAll('&amp;', '&'));

    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function sanitizeFileName(value: unknown): string {
  const rawName = [...path.basename(asText(value))]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
  const baseName = rawName
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, MAX_FILE_NAME_LENGTH);

  return baseName || 'download';
}

function parseDownloadRequest(
  value: unknown,
): ParsedDownloadRequest | DriveError {
  if (typeof value !== 'object' || value === null) {
    return {
      code: 'invalid_input',
      message: '下载参数不正确。',
    };
  }

  const input = value as Record<string, unknown>;
  let connectionId: string;

  try {
    connectionId = parseSiteConnectionId(input.connectionId);
  } catch {
    return {
      code: 'invalid_input',
      message: '站点连接 ID 格式不正确。',
    };
  }

  const downloadId = asText(input.downloadId);
  const pickcode = asText(input.pickcode);
  const kind =
    input.kind === 'file' || input.kind === 'video' ? input.kind : null;
  const downloadKey = asText(input.downloadKey);

  if (
    !downloadId ||
    downloadId.length > MAX_DOWNLOAD_ID_LENGTH ||
    !pickcode ||
    pickcode.length > MAX_PICKCODE_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(pickcode) ||
    !kind ||
    (kind === 'file' &&
      (!downloadKey ||
        downloadKey.length > MAX_DOWNLOAD_KEY_LENGTH ||
        !/^[A-Za-z0-9_-]+$/.test(downloadKey)))
  ) {
    return {
      code: 'invalid_input',
      message: '下载参数不正确。',
    };
  }

  return {
    downloadId,
    connectionId,
    pickcode,
    fileName: sanitizeFileName(input.fileName),
    kind,
    downloadKey,
  };
}

function sendProgress(
  sender: WebContents,
  progress: DriveDownloadProgress,
): void {
  if (!sender.isDestroyed()) {
    sender.send(IpcChannel.DriveDownloadProgress, progress);
  }
}

async function getVideoSource(
  siteSession: Session,
  pickcode: string,
): Promise<DriveResult<DownloadSource>> {
  const response = await fetch115JsonDetailed(
    siteSession,
    `${VIDEO_ENDPOINT}${encodeURIComponent(pickcode)}`,
  );

  if (!response.ok) {
    return response;
  }

  const downloadUrl = parseHttpUrl(response.data.data.origin_file_url);

  if (!downloadUrl) {
    return failure('api', '115 没有返回可用的视频下载地址。');
  }

  await discardSetCookies(siteSession, downloadUrl, response.data.setCookie);

  return {
    ok: true,
    data: {
      downloadUrl,
      setCookie: response.data.setCookie,
    },
  };
}

async function getFileSource(
  siteSession: Session,
  pickcode: string,
  downloadKey: string,
): Promise<DriveResult<DownloadSource>> {
  const first = await fetch115JsonDetailed(
    siteSession,
    `${FILE_DOWNLOAD_ENDPOINT}dl=${encodeURIComponent(downloadKey)}&pickcode=${encodeURIComponent(pickcode)}&_=${Date.now()}`,
  );

  if (!first.ok) {
    return first;
  }

  const directUrl = parseHttpUrl(first.data.data.file_url);

  if (directUrl) {
    await discardSetCookies(siteSession, directUrl, first.data.setCookie);

    return {
      ok: true,
      data: {
        downloadUrl: directUrl,
        setCookie: first.data.setCookie,
      },
    };
  }

  const redirectUrl = parseHttpUrl(first.data.data.file_url_302);

  if (!redirectUrl) {
    return failure('api', '115 没有返回可用的文件下载地址。');
  }

  let downloadToken: string | null = null;

  try {
    downloadToken = new URL(redirectUrl).searchParams.get('t');
  } catch {
    downloadToken = null;
  }

  if (!downloadToken) {
    return failure('api', '解析文件下载参数失败。');
  }

  const second = await fetch115JsonDetailed(
    siteSession,
    `${FILE_REDIRECT_ENDPOINT}t=${encodeURIComponent(downloadToken)}&_=${Date.now()}`,
  );

  if (!second.ok) {
    return second;
  }

  const downloadUrl = parseHttpUrl(second.data.data.file_url);

  if (!downloadUrl) {
    return failure('api', '115 没有返回可用的文件下载地址。');
  }

  const setCookie = [...first.data.setCookie, ...second.data.setCookie];

  await discardSetCookies(siteSession, downloadUrl, setCookie);

  return {
    ok: true,
    data: {
      downloadUrl,
      setCookie,
    },
  };
}

function is115Host(url: string): boolean {
  try {
    const host = new URL(url).hostname;

    return (
      host === '115.com' ||
      host.endsWith('.115.com') ||
      host === '115cdn.net' ||
      host.endsWith('.115cdn.net')
    );
  } catch {
    return false;
  }
}

async function getDownloadCookieHeader(
  siteSession: Session,
  sourceUrl: string,
  setCookieHeaders: readonly string[],
): Promise<string> {
  if (!is115Host(sourceUrl)) {
    return '';
  }

  const cookies = new Map<string, string>();

  for (const cookieUrl of [
    sourceUrl,
    'https://115.com/',
    'https://webapi.115.com/',
  ]) {
    const entries = await siteSession.cookies.get({ url: cookieUrl });

    for (const cookie of entries) {
      if (!cookies.has(cookie.name)) {
        cookies.set(cookie.name, cookie.value);
      }
    }
  }

  for (const header of setCookieHeaders) {
    const pair = header.split(';', 1)[0]?.trim() ?? '';
    const separator = pair.indexOf('=');

    if (separator > 0) {
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();

      if (name && value) {
        cookies.set(name, value);
      }
    }
  }

  return [...cookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function discardSetCookies(
  siteSession: Session,
  url: string,
  setCookieHeaders: readonly string[],
): Promise<void> {
  await Promise.all(
    setCookieHeaders.map(async (header) => {
      const pair = header.split(';', 1)[0]?.trim() ?? '';
      const separator = pair.indexOf('=');

      if (separator <= 0) {
        return;
      }

      const name = pair.slice(0, separator).trim();

      if (!name || PERSISTENT_COOKIE_NAMES.has(name)) {
        return;
      }

      await siteSession.cookies.remove(url, name).catch(() => undefined);
    }),
  );
}

async function downloadToFile(
  sender: WebContents,
  siteSession: Session,
  sourceUrl: string,
  sourceSetCookie: readonly string[],
  destination: string,
  requestInfo: ParsedDownloadRequest,
  signal: AbortSignal,
): Promise<number> {
  if (signal.aborted) {
    throw new DownloadCanceledError();
  }

  const cookieHeader = await getDownloadCookieHeader(
    siteSession,
    sourceUrl,
    sourceSetCookie,
  );
  const tempPath = `${destination}.japp-part`;

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rm(tempPath, { force: true });

  const stream = createWriteStream(tempPath, { flags: 'w' });
  let receivedBytes = 0;
  let totalBytes = 0;
  let lastProgressAt = 0;
  let lastSampleBytes = 0;
  let lastSampleAt = Date.now();
  let bytesPerSecond = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let cleanupAbort = () => {};

      const request = net.request({
        method: 'GET',
        url: sourceUrl,
        session: siteSession,
      });

      const fail = (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanupAbort();
        request.abort();
        stream.destroy();
        reject(error);
      };

      const onAbort = () => {
        fail(new DownloadCanceledError());
      };

      cleanupAbort = () => {
        signal.removeEventListener('abort', onAbort);
      };
      signal.addEventListener('abort', onAbort, { once: true });

      request.setHeader('Accept', '*/*');

      if (requestInfo.kind === 'video') {
        request.setHeader('Referer', 'https://115.com/');
      }

      const userAgent = siteSession.getUserAgent();

      if (userAgent) {
        request.setHeader('User-Agent', userAgent);
      }

      if (cookieHeader) {
        request.setHeader('Cookie', cookieHeader);
      }

      request.on('error', () => {
        fail(new Error('无法连接文件下载地址。'));
      });

      request.on('response', (response) => {
        const readable = response as unknown as NodeJS.ReadableStream;

        if (response.statusCode < 200 || response.statusCode >= 300) {
          let body = '';

          response.on('data', (chunk: Buffer) => {
            if (body.length < 500) {
              body += Buffer.from(chunk).toString('utf8');
            }
          });
          response.on('end', () => {
            fail(
              new Error(
                `文件下载地址返回失败（HTTP ${response.statusCode}）：${body.slice(0, 200)}`,
              ),
            );
          });
          readable.resume();
          return;
        }

        const contentLength = Number(response.headers['content-length']);
        totalBytes =
          Number.isFinite(contentLength) && contentLength > 0
            ? contentLength
            : 0;

        sendProgress(sender, {
          downloadId: requestInfo.downloadId,
          fileName: requestInfo.fileName,
          receivedBytes: 0,
          totalBytes,
          status: 'downloading',
        });

        readable.on('data', (chunk: Buffer) => {
          receivedBytes += Buffer.from(chunk).length;
          const now = Date.now();

          if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
            const elapsedSeconds = (now - lastSampleAt) / 1000;
            const instantSpeed =
              elapsedSeconds > 0
                ? (receivedBytes - lastSampleBytes) / elapsedSeconds
                : 0;

            bytesPerSecond =
              bytesPerSecond > 0
                ? bytesPerSecond * 0.6 + instantSpeed * 0.4
                : instantSpeed;
            lastSampleAt = now;
            lastSampleBytes = receivedBytes;
            lastProgressAt = now;

            sendProgress(sender, {
              downloadId: requestInfo.downloadId,
              fileName: requestInfo.fileName,
              receivedBytes,
              totalBytes,
              bytesPerSecond: Math.max(0, Math.round(bytesPerSecond)),
              status: 'downloading',
            });
          }
        });

        readable.pipe(stream);

        stream.on('finish', () => {
          if (!settled) {
            settled = true;
            cleanupAbort();
            resolve();
          }
        });
      });

      stream.on('error', (error) => {
        fail(error);
      });

      request.end();
    });

    if (signal.aborted) {
      throw new DownloadCanceledError();
    }

    await fs.rm(destination, { force: true });
    await fs.rename(tempPath, destination);
    await fs.rm(tempPath, { force: true });

    sendProgress(sender, {
      downloadId: requestInfo.downloadId,
      fileName: requestInfo.fileName,
      receivedBytes,
      totalBytes,
      status: 'success',
      filePath: destination,
    });

    return receivedBytes;
  } catch (error) {
    if (!stream.closed) {
      await new Promise<void>((resolve) => {
        stream.once('close', resolve);
        stream.destroy();
      });
    }

    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

export async function download115File(
  sender: WebContents,
  value: unknown,
): Promise<DriveResult<DriveDownloadResult>> {
  const request = parseDownloadRequest(value);

  if (isDriveError(request)) {
    return { ok: false, error: request };
  }

  const siteSession = await getAccountSession(request.connectionId);

  if (isDriveError(siteSession)) {
    return { ok: false, error: siteSession };
  }

  sendProgress(sender, {
    downloadId: request.downloadId,
    fileName: request.fileName,
    receivedBytes: 0,
    totalBytes: 0,
    status: 'preparing',
  });

  const source =
    request.kind === 'video'
      ? await getVideoSource(siteSession, request.pickcode)
      : await getFileSource(siteSession, request.pickcode, request.downloadKey);

  if (!source.ok) {
    sendProgress(sender, {
      downloadId: request.downloadId,
      fileName: request.fileName,
      receivedBytes: 0,
      totalBytes: 0,
      status: 'failed',
      error: source.error.message,
    });

    return source;
  }

  const parent = getMainWindow();
  const defaultDirectory = await getDownloadDirectory().catch(() => null);
  const isVideo = request.kind === 'video';
  const options = {
    title: isVideo ? '保存视频' : '保存文件',
    defaultPath: defaultDirectory
      ? path.join(defaultDirectory, request.fileName)
      : request.fileName,
    filters: isVideo
      ? [
          { name: '视频文件', extensions: VIDEO_EXTENSIONS },
          { name: '所有文件', extensions: ['*'] },
        ]
      : [{ name: '所有文件', extensions: ['*'] }],
  };
  const selection = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options);

  if (selection.canceled || !selection.filePath) {
    sendProgress(sender, {
      downloadId: request.downloadId,
      fileName: request.fileName,
      receivedBytes: 0,
      totalBytes: 0,
      status: 'canceled',
    });

    return {
      ok: true,
      data: {
        canceled: true,
        fileName: request.fileName,
        filePath: null,
        bytes: 0,
      },
    };
  }

  const controller = new AbortController();
  activeDownloads.set(request.downloadId, controller);

  try {
    const bytes = await downloadToFile(
      sender,
      siteSession,
      source.data.downloadUrl,
      source.data.setCookie,
      selection.filePath,
      request,
      controller.signal,
    );

    completedDownloads.set(request.downloadId, selection.filePath);

    return {
      ok: true,
      data: {
        canceled: false,
        fileName: request.fileName,
        filePath: selection.filePath,
        bytes,
      },
    };
  } catch (error) {
    if (controller.signal.aborted) {
      sendProgress(sender, {
        downloadId: request.downloadId,
        fileName: request.fileName,
        receivedBytes: 0,
        totalBytes: 0,
        status: 'canceled',
      });

      return {
        ok: true,
        data: {
          canceled: true,
          fileName: request.fileName,
          filePath: null,
          bytes: 0,
        },
      };
    }

    const message = errorMessage(error);

    sendProgress(sender, {
      downloadId: request.downloadId,
      fileName: request.fileName,
      receivedBytes: 0,
      totalBytes: 0,
      status: 'failed',
      error: message,
    });

    return {
      ok: false,
      error: {
        code: 'network',
        message,
      },
    };
  } finally {
    activeDownloads.delete(request.downloadId);
  }
}

export function cancel115Download(value: unknown): DriveResult<null> {
  const downloadId = typeof value === 'string' ? value.trim() : '';

  if (!downloadId || downloadId.length > MAX_DOWNLOAD_ID_LENGTH) {
    return {
      ok: false,
      error: {
        code: 'invalid_input',
        message: '下载任务参数不正确。',
      },
    };
  }

  const controller = activeDownloads.get(downloadId);

  if (!controller) {
    return {
      ok: false,
      error: {
        code: 'invalid_input',
        message: '当前没有可取消的下载。',
      },
    };
  }

  controller.abort();

  return { ok: true, data: null };
}

export function open115DownloadFolder(value: unknown): DriveResult<null> {
  const downloadId = typeof value === 'string' ? value.trim() : '';

  if (!downloadId || downloadId.length > MAX_DOWNLOAD_ID_LENGTH) {
    return {
      ok: false,
      error: {
        code: 'invalid_input',
        message: '下载记录参数不正确。',
      },
    };
  }

  const filePath = completedDownloads.get(downloadId);

  if (!filePath) {
    return {
      ok: false,
      error: {
        code: 'invalid_input',
        message: '没有找到已完成的下载记录。',
      },
    };
  }

  shell.showItemInFolder(filePath);

  return { ok: true, data: null };
}
