import { randomUUID } from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { net, type Session } from 'electron';
import type { DriveError, DriveResult } from '@shared/drive';
import { parseSiteConnectionId } from '../settings/schema';
import { getAccountSession } from './115';
import { fetch115JsonDetailed } from './115-http';

const VIDEO_ENDPOINT = 'https://webapi.115.com/files/video?pickcode=';
const MAX_PICKCODE_LENGTH = 128;
const MAX_FILE_NAME_LENGTH = 255;
const MAX_PLAYLIST_BYTES = 5 * 1024 * 1024;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

interface PlaybackSession {
  readonly id: string;
  readonly siteSession: Session;
  readonly upstreamPlaylistUrl: string;
  readonly cookies: Map<string, string>;
  readonly resources: Map<string, string>;
  readonly requests: Set<Electron.ClientRequest>;
  readonly createdAt: number;
}

interface ParsedPlaybackRequest {
  readonly connectionId: string;
  readonly pickcode: string;
  readonly fileName: string;
}

let playbackServer: http.Server | null = null;
let playbackPort = 0;
const playbackSessions = new Map<string, PlaybackSession>();

function failure<T>(code: DriveError['code'], message: string): DriveResult<T> {
  return {
    ok: false,
    error: { code, message },
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

function parseHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) {
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

function is115Host(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === '115.com' || host.endsWith('.115.com');
  } catch {
    return false;
  }
}

function parsePlaybackRequest(
  value: unknown,
): ParsedPlaybackRequest | DriveError {
  if (typeof value !== 'object' || value === null) {
    return {
      code: 'invalid_input',
      message: '视频播放参数不正确。',
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

  const pickcode = asText(input.pickcode);
  const fileName = asText(input.fileName).slice(0, MAX_FILE_NAME_LENGTH);

  if (
    !pickcode ||
    pickcode.length > MAX_PICKCODE_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(pickcode) ||
    !fileName
  ) {
    return {
      code: 'invalid_input',
      message: '视频播放参数不正确。',
    };
  }

  return { connectionId, pickcode, fileName };
}

function parseSetCookie(header: string): [string, string] | null {
  const pair = header.split(';', 1)[0]?.trim() ?? '';
  const separator = pair.indexOf('=');

  if (separator <= 0) {
    return null;
  }

  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1).trim();

  return name && value ? [name, value] : null;
}

function rememberSetCookies(
  session: PlaybackSession,
  headers: Record<string, string[] | string | undefined>,
): void {
  const raw = headers['set-cookie'];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];

  for (const header of values) {
    const cookie = parseSetCookie(String(header));

    if (cookie) {
      session.cookies.set(cookie[0], cookie[1]);
    }
  }
}

function buildCookieHeader(
  session: PlaybackSession,
  requestUrl: string,
): string {
  if (!is115Host(requestUrl)) {
    return '';
  }

  return [...session.cookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function collectSessionCookies(
  siteSession: Session,
  url: string,
): Promise<Map<string, string>> {
  const cookies = new Map<string, string>();

  if (!is115Host(url)) {
    return cookies;
  }

  for (const cookieUrl of [
    url,
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

  return cookies;
}

function localBaseUrl(sessionId: string): string {
  return `http://127.0.0.1:${playbackPort}/p/${sessionId}`;
}

function localResourceUrl(
  session: PlaybackSession,
  upstreamUrl: string,
): string {
  const resourceId = randomUUID();
  session.resources.set(resourceId, upstreamUrl);

  return `${localBaseUrl(session.id)}/r/${resourceId}`;
}

function rewritePlaylist(
  session: PlaybackSession,
  upstreamUrl: string,
  playlist: string,
): string {
  return playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return line;
      }

      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          try {
            const resolved = new URL(uri, upstreamUrl).toString();
            return `URI="${localResourceUrl(session, resolved)}"`;
          } catch {
            return _match;
          }
        });
      }

      try {
        const resolved = new URL(trimmed, upstreamUrl).toString();
        return localResourceUrl(session, resolved);
      } catch {
        return line;
      }
    })
    .join('\n');
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Range');
  response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  response.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Accept-Ranges',
  );
}

function respondError(
  response: ServerResponse,
  status: number,
  message: string,
): void {
  setCorsHeaders(response);
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(message);
}

function createUpstreamRequest(
  session: PlaybackSession,
  url: string,
  range?: string,
): Electron.ClientRequest {
  const request = net.request({
    method: 'GET',
    url,
    session: session.siteSession,
  });

  request.setHeader('Accept', '*/*');
  request.setHeader('Referer', 'https://115.com/');

  const userAgent = session.siteSession.getUserAgent();

  if (userAgent) {
    request.setHeader('User-Agent', userAgent);
  }

  if (range) {
    request.setHeader('Range', range);
  }

  const cookieHeader = buildCookieHeader(session, url);

  if (cookieHeader) {
    request.setHeader('Cookie', cookieHeader);
  }

  session.requests.add(request);
  request.on('close', () => {
    session.requests.delete(request);
  });

  return request;
}

async function fetchPlaylist(
  session: PlaybackSession,
  url: string,
): Promise<{ body: string; status: number; contentType: string } | null> {
  return new Promise((resolve) => {
    const request = createUpstreamRequest(session, url);
    let settled = false;

    const finish = (
      value: { body: string; status: number; contentType: string } | null,
    ) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    request.on('error', () => {
      finish(null);
    });

    request.on('response', (response) => {
      rememberSetCookies(session, response.headers);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        (response as unknown as NodeJS.ReadableStream).resume();
        finish(null);
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;

      response.on('data', (chunk: Buffer) => {
        if (size >= MAX_PLAYLIST_BYTES) {
          request.abort();
          finish(null);
          return;
        }

        const buffer = Buffer.from(chunk);
        size += buffer.length;
        chunks.push(buffer);
      });

      response.on('end', () => {
        finish({
          body: Buffer.concat(chunks).toString('utf8'),
          status: response.statusCode,
          contentType: String(response.headers['content-type'] ?? ''),
        });
      });

      response.on('error', () => {
        finish(null);
      });
    });

    request.end();
  });
}

function isPlaylistResponse(url: string, contentType: string): boolean {
  try {
    if (new URL(url).pathname.toLowerCase().endsWith('.m3u8')) {
      return true;
    }
  } catch {
    // Fall through to content type.
  }

  return contentType.toLowerCase().includes('mpegurl');
}

async function servePlaylist(
  session: PlaybackSession,
  url: string,
  response: ServerResponse,
): Promise<void> {
  const playlist = await fetchPlaylist(session, url);

  if (!playlist) {
    respondError(response, 502, '无法读取视频播放列表。');
    return;
  }

  setCorsHeaders(response);
  response.writeHead(200, {
    'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(rewritePlaylist(session, url, playlist.body));
}

function streamResource(
  session: PlaybackSession,
  url: string,
  request: IncomingMessage,
  response: ServerResponse,
): void {
  const range = request.headers.range;
  const upstream = createUpstreamRequest(session, url, range);
  let settled = false;

  upstream.on('error', () => {
    if (settled) {
      return;
    }

    settled = true;
    respondError(response, 502, '无法读取视频资源。');
  });

  upstream.on('response', (upstreamResponse) => {
    rememberSetCookies(session, upstreamResponse.headers);

    if (
      upstreamResponse.statusCode < 200 ||
      upstreamResponse.statusCode >= 300
    ) {
      (upstreamResponse as unknown as NodeJS.ReadableStream).resume();
      settled = true;
      respondError(
        response,
        upstreamResponse.statusCode === 403 ? 403 : 502,
        '视频资源请求失败。',
      );
      return;
    }

    const contentType = String(upstreamResponse.headers['content-type'] ?? '');

    if (isPlaylistResponse(url, contentType)) {
      const chunks: Buffer[] = [];
      let size = 0;

      upstreamResponse.on('data', (chunk: Buffer) => {
        if (size >= MAX_PLAYLIST_BYTES) {
          upstream.abort();
          if (!settled) {
            settled = true;
            respondError(response, 502, '视频播放列表过大。');
          }
          return;
        }

        const buffer = Buffer.from(chunk);
        size += buffer.length;
        chunks.push(buffer);
      });

      upstreamResponse.on('end', () => {
        if (settled) {
          return;
        }

        settled = true;
        setCorsHeaders(response);
        response.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(
          rewritePlaylist(session, url, Buffer.concat(chunks).toString('utf8')),
        );
      });
      return;
    }

    setCorsHeaders(response);
    const headers: Record<string, string> = {
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': 'no-store',
    };

    for (const headerName of [
      'content-length',
      'content-range',
      'accept-ranges',
    ]) {
      const value = upstreamResponse.headers[headerName];

      if (typeof value === 'string') {
        headers[
          headerName === 'content-length'
            ? 'Content-Length'
            : headerName === 'content-range'
              ? 'Content-Range'
              : 'Accept-Ranges'
        ] = value;
      }
    }

    response.writeHead(upstreamResponse.statusCode, headers);
    const readable = upstreamResponse as unknown as NodeJS.ReadableStream;
    readable.pipe(response);
    readable.on('error', () => {
      if (!settled) {
        settled = true;
        response.destroy();
      }
    });
  });

  response.on('close', () => {
    if (!response.writableEnded) {
      upstream.abort();
    }
  });

  upstream.end();
}

async function handlePlaybackRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== 'GET') {
    respondError(response, 405, '不支持的请求方法。');
    return;
  }

  const requestUrl = new URL(
    request.url ?? '/',
    `http://127.0.0.1:${playbackPort}`,
  );
  const parts = requestUrl.pathname.split('/').filter(Boolean);

  if (parts[0] !== 'p' || !parts[1]) {
    respondError(response, 404, '播放会话不存在。');
    return;
  }

  const session = playbackSessions.get(parts[1]);

  if (!session) {
    respondError(response, 404, '播放会话不存在或已结束。');
    return;
  }

  if (parts[2] === 'master.m3u8') {
    await servePlaylist(session, session.upstreamPlaylistUrl, response);
    return;
  }

  if (parts[2] === 'r' && parts[3]) {
    const upstreamUrl = session.resources.get(parts[3]);

    if (!upstreamUrl) {
      respondError(response, 404, '播放资源不存在。');
      return;
    }

    streamResource(session, upstreamUrl, request, response);
    return;
  }

  respondError(response, 404, '播放资源不存在。');
}

async function ensurePlaybackServer(): Promise<number> {
  if (playbackServer && playbackPort > 0) {
    return playbackPort;
  }

  const server = http.createServer((request, response) => {
    void handlePlaybackRequest(request, response).catch(() => {
      if (!response.headersSent) {
        respondError(response, 502, '视频播放代理出错。');
      } else {
        response.destroy();
      }
    });
  });
  server.on('clientError', (_error, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('无法启动视频播放代理。');
  }

  playbackServer = server;
  playbackPort = address.port;

  return playbackPort;
}

function cleanupExpiredSessions(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;

  for (const [id, session] of playbackSessions) {
    if (session.createdAt < cutoff) {
      for (const request of session.requests) {
        request.abort();
      }

      playbackSessions.delete(id);
    }
  }
}

function asPositiveNumber(value: unknown): number | null {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

export async function start115Playback(value: unknown): Promise<
  DriveResult<{
    sessionId: string;
    playbackUrl: string;
    width: number | null;
    height: number | null;
  }>
> {
  const request = parsePlaybackRequest(value);

  if (isDriveError(request)) {
    return { ok: false, error: request };
  }

  const siteSession = await getAccountSession(request.connectionId);

  if (isDriveError(siteSession)) {
    return { ok: false, error: siteSession };
  }

  const response = await fetch115JsonDetailed(
    siteSession,
    `${VIDEO_ENDPOINT}${encodeURIComponent(request.pickcode)}`,
  );

  if (!response.ok) {
    return response;
  }

  const playbackUrl = parseHttpUrl(response.data.data.video_url);
  const width = asPositiveNumber(response.data.data.width);
  const height = asPositiveNumber(response.data.data.height);

  if (!playbackUrl) {
    return failure('api', '115 没有返回可用的视频播放地址。');
  }

  cleanupExpiredSessions();
  const port = await ensurePlaybackServer();
  const id = randomUUID();
  const cookies = await collectSessionCookies(siteSession, playbackUrl);

  for (const header of response.data.setCookie) {
    const cookie = parseSetCookie(header);

    if (cookie) {
      cookies.set(cookie[0], cookie[1]);
    }
  }

  playbackSessions.set(id, {
    id,
    siteSession,
    upstreamPlaylistUrl: playbackUrl,
    cookies,
    resources: new Map(),
    requests: new Set(),
    createdAt: Date.now(),
  });

  const localUrl = `http://127.0.0.1:${port}/p/${id}/master.m3u8`;

  return {
    ok: true,
    data: {
      sessionId: id,
      playbackUrl: localUrl,
      width,
      height,
    },
  };
}

export function stop115Playback(value: unknown): DriveResult<null> {
  const sessionId = typeof value === 'string' ? value.trim() : '';

  if (!sessionId || !playbackSessions.has(sessionId)) {
    return {
      ok: true,
      data: null,
    };
  }

  const session = playbackSessions.get(sessionId);

  if (session) {
    for (const request of session.requests) {
      request.abort();
    }
  }

  playbackSessions.delete(sessionId);

  return { ok: true, data: null };
}
