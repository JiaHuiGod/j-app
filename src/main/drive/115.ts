import type { Session } from 'electron';
import type {
  DriveError,
  DriveErrorCode,
  DriveListing,
  DriveResult,
  DriveSearchResult,
} from '@shared/drive';
import { getSiteSession } from '../connections/session-manager';
import { findSiteConnection } from '../settings/store';
import { parseSiteConnectionId } from '../settings/schema';
import { is115Connection } from './detection';
import { request115 } from './115-http';
import { normalize115Listing, normalize115SearchResult } from './mapper';

const API_ORIGIN = 'https://webapi.115.com';
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;
const MAX_FOLDER_ID_LENGTH = 32;
const MAX_SEARCH_LENGTH = 200;

interface ParsedPage {
  readonly offset: number;
  readonly limit: number;
}

interface ParsedFolderRequest extends ParsedPage {
  readonly connectionId: string;
  readonly folderId: string;
}

interface ParsedSearchRequest extends ParsedFolderRequest {
  readonly query: string;
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

function parseInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number | null {
  if (value === undefined) {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function parseFolderId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return '0';
  }

  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    String(value).length > MAX_FOLDER_ID_LENGTH ||
    !/^\d+$/.test(String(value))
  ) {
    return null;
  }

  return String(value);
}

function parseFolderRequest(value: unknown): ParsedFolderRequest | DriveError {
  if (typeof value !== 'object' || value === null) {
    return {
      code: 'invalid_input',
      message: '网盘请求参数不正确。',
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

  const folderId = parseFolderId(input.folderId);
  const offset = parseInteger(input.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = parseInteger(input.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

  if (folderId === null || offset === null || limit === null) {
    return {
      code: 'invalid_input',
      message: '目录或分页参数不正确。',
    };
  }

  return { connectionId, folderId, offset, limit };
}

function isDriveError(value: unknown): value is DriveError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

function parseSearchRequest(value: unknown): ParsedSearchRequest | DriveError {
  const folderRequest = parseFolderRequest(value);

  if (isDriveError(folderRequest)) {
    return folderRequest;
  }

  const input = value as Record<string, unknown>;
  const query = typeof input.query === 'string' ? input.query.trim() : '';

  if (!query || query.length > MAX_SEARCH_LENGTH) {
    return {
      code: 'invalid_input',
      message: '请输入有效的搜索关键词。',
    };
  }

  return {
    ...folderRequest,
    query,
  };
}

async function getAccountSession(
  connectionId: string,
): Promise<Session | DriveError> {
  const connection = await findSiteConnection(connectionId);

  if (!connection || !is115Connection(connection)) {
    return {
      code: 'no_account',
      message: '未检测到可用的 115 站点连接。',
    };
  }

  try {
    const siteSession = await getSiteSession(connectionId);

    return (
      siteSession ?? {
        code: 'no_account',
        message: '未检测到可用的 115 站点连接。',
      }
    );
  } catch {
    return {
      code: 'network',
      message: '无法初始化 115 站点会话。',
    };
  }
}

async function fetch115Json(
  siteSession: Session,
  url: string,
): Promise<DriveResult<Record<string, unknown>>> {
  const response = await request115(siteSession, url);

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
  const errorMessage =
    typeof record.error === 'string' ? record.error.trim() : '';

  if (record.state === false) {
    if (errorMessage.includes('登录')) {
      return failure('auth_required', '115 登录已失效，请重新登录。');
    }

    return failure('api', errorMessage || '115 接口返回失败，请稍后重试。');
  }

  return { ok: true, data: record };
}

function buildListUrl(request: ParsedFolderRequest): string {
  const params = new URLSearchParams({
    aid: '1',
    cid: request.folderId,
    o: 'user_ptime',
    asc: '0',
    offset: String(request.offset),
    show_dir: '1',
    limit: String(request.limit),
    code: '',
    scid: '',
    snap: '0',
    natsort: '1',
    record_open_time: '1',
    count_folders: '1',
    type: '',
    source: '',
    format: 'json',
  });

  return `${API_ORIGIN}/files?${params.toString()}`;
}

function buildSearchUrl(request: ParsedSearchRequest): string {
  const params = new URLSearchParams({
    search_value: request.query,
    aid: '1',
    cid: request.folderId,
    offset: String(request.offset),
    limit: String(request.limit),
    type: '0',
    count_folders: '1',
    order: 'user_ptime',
    asc: '0',
    resp_ver: '0',
    format: 'json',
  });

  return `${API_ORIGIN}/files/search?${params.toString()}`;
}

async function check115Login(siteSession: Session): Promise<DriveResult<true>> {
  const response = await fetch115Json(
    siteSession,
    `${API_ORIGIN}/offine/downpath`,
  );

  return response.ok ? { ok: true, data: true } : response;
}

export async function list115Folder(
  value: unknown,
): Promise<DriveResult<DriveListing>> {
  const request = parseFolderRequest(value);

  if (isDriveError(request)) {
    return { ok: false, error: request };
  }

  const siteSession = await getAccountSession(request.connectionId);

  if (isDriveError(siteSession)) {
    return { ok: false, error: siteSession };
  }

  const login = await check115Login(siteSession);

  if (!login.ok) {
    return login;
  }

  const response = await fetch115Json(siteSession, buildListUrl(request));

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    data: normalize115Listing(response.data, {
      accountId: request.connectionId,
      folderId: request.folderId,
      offset: request.offset,
      limit: request.limit,
    }),
  };
}

export async function search115Folder(
  value: unknown,
): Promise<DriveResult<DriveSearchResult>> {
  const request = parseSearchRequest(value);

  if (isDriveError(request)) {
    return { ok: false, error: request };
  }

  const siteSession = await getAccountSession(request.connectionId);

  if (isDriveError(siteSession)) {
    return { ok: false, error: siteSession };
  }

  const login = await check115Login(siteSession);

  if (!login.ok) {
    return login;
  }

  const response = await fetch115Json(siteSession, buildSearchUrl(request));

  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    data: normalize115SearchResult(response.data, {
      query: request.query,
      offset: request.offset,
      limit: request.limit,
    }),
  };
}
