import { net, type Session } from 'electron';
import type { DriveErrorCode, DriveResult } from '@shared/drive';

const REQUEST_TIMEOUT_MS = 20_000;

export interface DriveHttpResponse {
  readonly status: number;
  readonly body: string;
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
      method: 'GET',
      url,
      session: siteSession,
    });

    request.setHeader('Accept', 'application/json, text/plain, */*');
    request.setHeader('Content-Type', 'application/x-www-form-urlencoded');
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
    }, REQUEST_TIMEOUT_MS);

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

    request.end();
  });
}
