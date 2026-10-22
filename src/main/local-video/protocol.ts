import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { protocol } from 'electron';
import { LOCAL_VIDEO_PROTOCOL } from '@shared/local-video';
import { getLocalVideoRecord } from './registry';

const MIME_TYPES: Readonly<Record<string, string>> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  ts: 'video/mp2t',
  m2ts: 'video/mp2t',
  flv: 'video/x-flv',
  wmv: 'video/x-ms-wmv',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: LOCAL_VIDEO_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

interface ByteRange {
  readonly start: number;
  readonly end: number;
}

function parseRange(value: string, size: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;

  if (!rawStart && !rawEnd) {
    return null;
  }

  let start: number;
  let end: number;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1),
  };
}

function isInsideRoot(rootPath: string, filePath: string): boolean {
  const relative = path.relative(rootPath, filePath);

  return (
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  );
}

function createBody(filePath: string, range: ByteRange | null): BodyInit {
  const stream = createReadStream(
    filePath,
    range ? { start: range.start, end: range.end } : undefined,
  );

  return Readable.toWeb(stream) as unknown as BodyInit;
}

async function handleLocalVideoRequest(request: Request): Promise<Response> {
  let url: URL;

  try {
    url = new URL(request.url);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  const kind = url.hostname;
  const [libraryId, mediaId] = url.pathname.split('/').filter(Boolean);

  if ((kind !== 'video' && kind !== 'poster') || !libraryId || !mediaId) {
    return new Response('Not found', { status: 404 });
  }

  const record = getLocalVideoRecord(libraryId);

  if (!record) {
    return new Response('Not found', { status: 404 });
  }

  const filePath =
    kind === 'video' ? record.videos.get(mediaId) : record.posters.get(mediaId);

  if (!filePath || !isInsideRoot(record.rootPath, filePath)) {
    return new Response('Not found', { status: 404 });
  }

  const info = await stat(filePath).catch(() => null);

  if (!info?.isFile()) {
    return new Response('Not found', { status: 404 });
  }

  const extension = path.extname(filePath).slice(1).toLowerCase();
  const contentType = MIME_TYPES[extension] ?? 'application/octet-stream';
  const baseHeaders: Record<string, string> = {
    'Accept-Ranges': 'bytes',
    'Cache-Control':
      kind === 'poster'
        ? 'public, max-age=3600'
        : 'private, max-age=0, must-revalidate',
    'Content-Type': contentType,
  };

  if (kind === 'poster') {
    return new Response(
      request.method === 'HEAD' ? null : createBody(filePath, null),
      {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Length': String(info.size),
        },
      },
    );
  }

  const rawRange = request.headers.get('range');
  const range = rawRange ? parseRange(rawRange, info.size) : null;

  if (rawRange && !range) {
    return new Response(null, {
      status: 416,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes */${info.size}`,
      },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? info.size - 1;
  const length = end - start + 1;
  const headers: Record<string, string> = {
    ...baseHeaders,
    'Content-Length': String(length),
  };

  if (range) {
    headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  }

  return new Response(
    request.method === 'HEAD' ? null : createBody(filePath, range),
    {
      status: range ? 206 : 200,
      headers,
    },
  );
}

export function registerLocalVideoProtocol(): void {
  if (protocol.isProtocolHandled(LOCAL_VIDEO_PROTOCOL)) {
    return;
  }

  protocol.handle(LOCAL_VIDEO_PROTOCOL, handleLocalVideoRequest);
}
