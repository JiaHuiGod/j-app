import type {
  DriveBreadcrumb,
  DriveEntry,
  DriveListing,
  DriveSearchResult,
} from '@shared/drive';

interface Raw115PathItem {
  readonly cid?: unknown;
  readonly name?: unknown;
}

interface Raw115Item {
  readonly cid?: unknown;
  readonly fid?: unknown;
  readonly pid?: unknown;
  readonly n?: unknown;
  readonly ns?: unknown;
  readonly fc?: unknown;
  readonly s?: unknown;
  readonly te?: unknown;
  readonly t?: unknown;
  readonly ico?: unknown;
  readonly play_long?: unknown;
  readonly pc?: unknown;
  readonly d?: unknown;
}

interface Raw115ListResponse {
  readonly data?: unknown;
  readonly count?: unknown;
  readonly offset?: unknown;
  readonly limit?: unknown;
  readonly path?: unknown;
}

interface Raw115SearchResponse {
  readonly data?: unknown;
  readonly count?: unknown;
  readonly offset?: unknown;
  readonly limit?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

export function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, '')).trim();
}

function normalizeUnixTime(value: unknown): string | null {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  const milliseconds =
    timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(milliseconds);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeExtension(value: unknown, name: string): string | null {
  const explicit = asString(value).toLowerCase().replace(/^\./, '');

  if (explicit) {
    return explicit;
  }

  const dotIndex = name.lastIndexOf('.');

  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return null;
  }

  const extension = name.slice(dotIndex + 1).toLowerCase();

  return extension.length <= 12 ? extension : null;
}

function normalizeDuration(value: unknown): number | null {
  const seconds = Number(value);

  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null;
}

/**
 * Converts the 115-specific item shape into the renderer contract. Returning
 * null makes malformed entries harmless instead of breaking the whole listing.
 */
export function normalize115Entry(value: unknown): DriveEntry | null {
  const item = asRecord(value) as Raw115Item | null;

  if (!item) {
    return null;
  }

  const kindFlag = Number(item.fc);
  const name = stripHtmlTags(asString(item.ns) || asString(item.n));

  if (!name || (kindFlag !== 0 && kindFlag !== 1)) {
    return null;
  }

  if (kindFlag === 0) {
    const id = asString(item.cid);

    if (!id) {
      return null;
    }

    return {
      id,
      parentId: asString(item.pid) || '0',
      name,
      kind: 'folder',
      size: null,
      modifiedAt: normalizeUnixTime(item.te ?? item.t),
      extension: null,
      durationSeconds: null,
      pickcode: null,
    };
  }

  const id = asString(item.fid);

  if (!id) {
    return null;
  }

  const size = Number(item.s);

  return {
    id,
    parentId: asString(item.cid) || '0',
    name,
    kind: 'file',
    size: Number.isFinite(size) && size >= 0 ? size : null,
    modifiedAt: normalizeUnixTime(item.te ?? item.t),
    extension: normalizeExtension(item.ico, name),
    durationSeconds: normalizeDuration(item.play_long),
    pickcode: asString(item.pc) || null,
    downloadKey: asString(item.d) || null,
  };
}

function normalizeEntries(value: unknown): DriveEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries = value
    .map((item) => normalize115Entry(item))
    .filter((entry): entry is DriveEntry => entry !== null);

  return entries.sort((left, right) => {
    if (left.kind === right.kind) {
      return 0;
    }

    return left.kind === 'folder' ? -1 : 1;
  });
}

export function normalize115Breadcrumbs(
  pathValue: unknown,
  folderId: string,
): DriveBreadcrumb[] {
  const breadcrumbs: DriveBreadcrumb[] = [{ id: '0', name: '根目录' }];

  if (!Array.isArray(pathValue)) {
    return breadcrumbs;
  }

  for (const value of pathValue) {
    const item = asRecord(value) as Raw115PathItem | null;

    if (!item) {
      continue;
    }

    const id = asString(item.cid);
    const name = stripHtmlTags(asString(item.name) || '未命名文件夹');

    if (!id || id === '0' || breadcrumbs.some((crumb) => crumb.id === id)) {
      continue;
    }

    breadcrumbs.push({ id, name });
  }

  if (folderId !== '0' && !breadcrumbs.some((crumb) => crumb.id === folderId)) {
    breadcrumbs.push({ id: folderId, name: '当前目录' });
  }

  return breadcrumbs;
}

function normalizeTotal(value: unknown, fallback: number): number {
  const total = Number(value);

  return Number.isFinite(total) && total >= 0 ? total : fallback;
}

export function normalize115Listing(
  value: unknown,
  input: {
    readonly accountId: string;
    readonly folderId: string;
    readonly offset: number;
    readonly limit: number;
  },
): DriveListing {
  const response = (asRecord(value) ?? {}) as Raw115ListResponse;
  const entries = normalizeEntries(response.data);
  const total = normalizeTotal(response.count, entries.length);

  return {
    accountId: input.accountId,
    folderId: input.folderId,
    breadcrumbs: normalize115Breadcrumbs(response.path, input.folderId),
    entries,
    offset: input.offset,
    limit: input.limit,
    total,
    hasMore: input.offset + entries.length < total,
  };
}

export function normalize115SearchResult(
  value: unknown,
  input: {
    readonly query: string;
    readonly offset: number;
    readonly limit: number;
  },
): DriveSearchResult {
  const response = (asRecord(value) ?? {}) as Raw115SearchResponse;
  const entries = normalizeEntries(response.data);
  const total = normalizeTotal(response.count, entries.length);

  return {
    query: input.query,
    entries,
    offset: input.offset,
    limit: input.limit,
    total,
    hasMore: input.offset + entries.length < total,
  };
}
