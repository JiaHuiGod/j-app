import type { Session } from 'electron';
import type { DriveError, DriveResult } from '@shared/drive';
import { parseSiteConnectionId } from '../settings/schema';
import { fetch115Json } from './115-http';
import { getAccountSession } from './115';

const API_ORIGIN = 'https://webapi.115.com';
const MAX_NAME_LENGTH = 255;
const MAX_ID_LENGTH = 32;
const MAX_BATCH_SIZE = 100;

interface ParsedConnection {
  readonly connectionId: string;
}

interface ParsedCreateFolder extends ParsedConnection {
  readonly parentId: string;
  readonly name: string;
}

interface ParsedRename extends ParsedConnection {
  readonly entryId: string;
  readonly kind: 'file' | 'folder';
  readonly name: string;
}

interface DeleteTarget {
  readonly parentId: string;
  readonly entryId: string;
}

interface ParsedDelete extends ParsedConnection {
  readonly targets: readonly DeleteTarget[];
}

interface ParsedMove extends ParsedConnection {
  readonly entryIds: readonly string[];
  readonly targetFolderId: string;
}

function isDriveError(value: unknown): value is DriveError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function parseConnection(value: unknown): ParsedConnection | DriveError {
  const input = asRecord(value);

  if (!input) {
    return {
      code: 'invalid_input',
      message: '网盘请求参数不正确。',
    };
  }

  try {
    return { connectionId: parseSiteConnectionId(input.connectionId) };
  } catch {
    return {
      code: 'invalid_input',
      message: '站点连接 ID 格式不正确。',
    };
  }
}

function parseFolderId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return '0';
  }

  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    String(value).length > MAX_ID_LENGTH ||
    !/^\d+$/.test(String(value))
  ) {
    return null;
  }

  return String(value);
}

function parseEntryId(value: unknown): string | null {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    String(value).length > MAX_ID_LENGTH ||
    !/^\d+$/.test(String(value)) ||
    String(value) === '0'
  ) {
    return null;
  }

  return String(value);
}

function parseName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.trim();
  const hasControlCharacter = [...name].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });

  if (
    !name ||
    name.length > MAX_NAME_LENGTH ||
    name === '.' ||
    name === '..' ||
    /[/\\]/.test(name) ||
    hasControlCharacter
  ) {
    return null;
  }

  return name;
}

function parseCreateFolder(value: unknown): ParsedCreateFolder | DriveError {
  const connection = parseConnection(value);

  if (isDriveError(connection)) {
    return connection;
  }

  const input = value as Record<string, unknown>;
  const parentId = parseFolderId(input.parentId);
  const name = parseName(input.name);

  if (parentId === null || name === null) {
    return {
      code: 'invalid_input',
      message: '请输入有效的文件夹名称。',
    };
  }

  return { ...connection, parentId, name };
}

function parseRename(value: unknown): ParsedRename | DriveError {
  const connection = parseConnection(value);

  if (isDriveError(connection)) {
    return connection;
  }

  const input = value as Record<string, unknown>;
  const entryId = parseEntryId(input.entryId);
  const name = parseName(input.name);
  const kind =
    input.kind === 'file' || input.kind === 'folder' ? input.kind : null;

  if (entryId === null || name === null || kind === null) {
    return {
      code: 'invalid_input',
      message: '请输入有效的文件或文件夹名称。',
    };
  }

  return { ...connection, entryId, kind, name };
}

function parseDelete(value: unknown): ParsedDelete | DriveError {
  const connection = parseConnection(value);

  if (isDriveError(connection)) {
    return connection;
  }

  const input = value as Record<string, unknown>;
  const rawEntries = Array.isArray(input.entries) ? input.entries : [];

  if (rawEntries.length === 0 || rawEntries.length > MAX_BATCH_SIZE) {
    return {
      code: 'invalid_input',
      message: '请选择要删除的文件或文件夹。',
    };
  }

  const targets: DeleteTarget[] = [];
  const seen = new Set<string>();

  for (const rawEntry of rawEntries) {
    const entry = asRecord(rawEntry);

    if (!entry) {
      return {
        code: 'invalid_input',
        message: '要删除的文件或文件夹参数不正确。',
      };
    }

    const parentId = parseFolderId(entry.parentId);
    const entryId = parseEntryId(entry.entryId);

    if (parentId === null || entryId === null || seen.has(entryId)) {
      return {
        code: 'invalid_input',
        message: '要删除的文件或文件夹参数不正确。',
      };
    }

    seen.add(entryId);
    targets.push({ parentId, entryId });
  }

  return { ...connection, targets };
}

function parseMove(value: unknown): ParsedMove | DriveError {
  const connection = parseConnection(value);

  if (isDriveError(connection)) {
    return connection;
  }

  const input = value as Record<string, unknown>;
  const rawEntryIds = Array.isArray(input.entryIds) ? input.entryIds : [];
  const targetFolderId = parseFolderId(input.targetFolderId);

  if (
    rawEntryIds.length === 0 ||
    rawEntryIds.length > MAX_BATCH_SIZE ||
    targetFolderId === null
  ) {
    return {
      code: 'invalid_input',
      message: '移动目标参数不正确。',
    };
  }

  const entryIds: string[] = [];
  const seen = new Set<string>();

  for (const rawEntryId of rawEntryIds) {
    const entryId = parseEntryId(rawEntryId);

    if (entryId === null || seen.has(entryId) || entryId === targetFolderId) {
      return {
        code: 'invalid_input',
        message: '不能把文件夹移动到自身。',
      };
    }

    seen.add(entryId);
    entryIds.push(entryId);
  }

  return { ...connection, entryIds, targetFolderId };
}

async function resolveSession(
  connectionId: string,
): Promise<DriveResult<Session>> {
  const session = await getAccountSession(connectionId);

  return isDriveError(session)
    ? { ok: false, error: session }
    : { ok: true, data: session };
}

async function postForm(
  siteSession: Session,
  path: string,
  pairs: readonly (readonly [string, string])[],
): Promise<DriveResult<Record<string, unknown>>> {
  const body = new URLSearchParams();

  for (const [key, value] of pairs) {
    body.set(key, value);
  }

  return fetch115Json(siteSession, `${API_ORIGIN}${path}`, {
    method: 'POST',
    body: body.toString(),
  });
}

export async function create115Folder(
  value: unknown,
): Promise<DriveResult<null>> {
  const request = parseCreateFolder(value);

  if (isDriveError(request)) {
    return { ok: false, error: request };
  }

  const sessionResult = await resolveSession(request.connectionId);

  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error };
  }

  const siteSession = sessionResult.data;

  const response = await postForm(siteSession, '/files/add', [
    ['pid', request.parentId],
    ['cname', request.name],
  ]);

  return response.ok ? { ok: true, data: null } : response;
}

export async function rename115Entry(
  value: unknown,
): Promise<DriveResult<null>> {
  const request = parseRename(value);

  if (isDriveError(request)) {
    return { ok: false, error: request };
  }

  const sessionResult = await resolveSession(request.connectionId);

  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error };
  }

  const siteSession = sessionResult.data;

  const pairs: Array<[string, string]> = [];

  if (request.kind === 'folder') {
    pairs.push(['fid', request.entryId]);
    pairs.push(['file_name', request.name]);
  }

  pairs.push([`files_new_name[${request.entryId}]`, request.name]);

  const response = await postForm(siteSession, '/files/batch_rename', pairs);

  return response.ok ? { ok: true, data: null } : response;
}

export async function delete115Entry(
  value: unknown,
): Promise<DriveResult<null>> {
  const request = parseDelete(value);

  if (isDriveError(request)) {
    return { ok: false, error: request };
  }

  const sessionResult = await resolveSession(request.connectionId);

  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error };
  }

  const siteSession = sessionResult.data;
  const groups = new Map<string, string[]>();

  for (const target of request.targets) {
    const group = groups.get(target.parentId) ?? [];
    group.push(target.entryId);
    groups.set(target.parentId, group);
  }

  for (const [parentId, entryIds] of groups) {
    const pairs: Array<[string, string]> = [
      ['pid', parentId],
      ['ignore_warn', '1'],
    ];

    for (const [index, entryId] of entryIds.entries()) {
      pairs.push([`fid[${index}]`, entryId]);
    }

    const response = await postForm(siteSession, '/rb/delete', pairs);

    if (!response.ok) {
      return response;
    }
  }

  return { ok: true, data: null };
}

export async function move115Entry(value: unknown): Promise<DriveResult<null>> {
  const request = parseMove(value);

  if (isDriveError(request)) {
    return { ok: false, error: request };
  }

  const sessionResult = await resolveSession(request.connectionId);

  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error };
  }

  const siteSession = sessionResult.data;
  const pairs: Array<[string, string]> = [
    ['pid', request.targetFolderId],
    ['move_proid', `${Date.now()}_${Math.floor(Math.random() * 10000)}`],
  ];

  for (const [index, entryId] of request.entryIds.entries()) {
    pairs.push([`fid[${index}]`, entryId]);
  }

  const response = await postForm(siteSession, '/files/move', pairs);

  return response.ok ? { ok: true, data: null } : response;
}
