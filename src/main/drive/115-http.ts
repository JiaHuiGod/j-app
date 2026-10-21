import { net, type Session } from 'electron';
import type { DriveErrorCode, DriveResult } from '@shared/drive';

const REQUEST_TIMEOUT_MS = 20_000;

export interface DriveHttpResponse {
  readonly status: number;
  readonly body: string;
}

export interface DriveHttpRequestOptions {
  readonly method?: 'GET' | 'POST';
  readonly body?: string;
  readonly contentType?: string;
  readonly timeoutMs?: number;
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

/**
 * Request 115 with an explicit Cookie header built from the partition's cookie
 * store. This still keeps values in the main process, but avoids relying on
 * fetch's automatic cookie attachment for 115's SameSite/session cookies.
 */
export async function request115(
  siteSession: Session,
  url: string,
  options: DriveHttpRequestOptions = {},
): Promise<DriveResult<DriveHttpResponse>> {
  const cookies = await siteSession.cookies.get({ url });
  const cookieHeader = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: DriveResult<DriveHttpResponse>) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const request = net.request({
      method: options.method ?? 'GET',
      url,
      session: siteSession,
    });

    request.setHeader('Accept', 'application/json, text/plain, */*');
    request.setHeader(
      'Content-Type',
      options.contentType ?? 'application/x-www-form-urlencoded',
    );
    request.setHeader('Origin', 'https://115.com');
    request.setHeader('Referer', 'https://115.com/');

    const userAgent = siteSession.getUserAgent();

    if (userAgent) {
      request.setHeader('User-Agent', userAgent);
    }

    if (cookieHeader) {
      request.setHeader('Cookie', cookieHeader);
    }

    const timeout = setTimeout(() => {
      request.abort();
      finish(failure('network', '115 请求超时，请检查网络或代理。'));
    }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);

    request.on('response', (response) => {
      const chunks: Buffer[] = [];

      response.on('data', (chunk: Buffer) => {
        chunks.push(Buffer.from(chunk));
      });

      response.on('end', () => {
        finish({
          ok: true,
          data: {
            status: response.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          },
        });
      });

      response.on('error', () => {
        finish(failure('network', '读取 115 响应失败，请稍后重试。'));
      });
    });

    request.on('error', () => {
      finish(failure('network', '无法连接 115，请检查网络或代理。'));
    });

    if (options.body === undefined) {
      request.end();
    } else {
      request.end(options.body);
    }
  });
}

export async function fetch115Json(
  siteSession: Session,
  url: string,
  options?: DriveHttpRequestOptions,
): Promise<DriveResult<Record<string, unknown>>> {
  const response = await request115(siteSession, url, options);

  if (!response.ok) {
    return response;
  }

  const { status, body: text } = response.data;

  if (status === 401 || status === 403) {
    return failure('auth_required', '115 登录已失效，请重新登录。');
  }

  if (status < 200 || status >= 300) {
    return failure('api', `115 请求失败（HTTP ${status}）。`);
  }

  let body: unknown;

  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return failure('api', '115 返回了无法解析的响应。');
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return failure('api', '115 返回了异常响应。');
  }

  const record = body as Record<string, unknown>;
  const errorMessage = [
    record.error,
    record.error_msg,
    record.errmsg,
    record.message,
    record.msg,
  ].find(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  );
  const errorCode = [record.errcode, record.errno].find(
    (value) =>
      (typeof value === 'string' || typeof value === 'number') &&
      String(value) !== '' &&
      String(value) !== '0',
  );

  if (record.state === false) {
    if (errorMessage?.includes('登录')) {
      return failure('auth_required', '115 登录已失效，请重新登录。');
    }

    return failure(
      'api',
      errorMessage?.trim() ||
        (errorCode
          ? `115 接口返回失败（错误码 ${String(errorCode)}）。`
          : '115 接口返回失败，请稍后重试。'),
    );
  }

  return { ok: true, data: record };
}
