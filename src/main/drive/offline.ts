import type {
  DriveError,
  DriveOfflineAddError,
  DriveOfflineAddResult,
  DriveOfflineTaskList,
  DriveResult,
} from '@shared/drive';
import type { Session } from 'electron';
import { parseSiteConnectionId } from '../settings/schema';
import { fetch115Json } from './115-http';
import { getAccountSession } from './115';
import { normalize115OfflineTaskList } from './offline-mapper';

const WEB_ORIGIN = 'https://115.com';
const MAX_URLS = 20;
const MAX_URL_LENGTH = 4096;
const MAX_PAGE = 100;
const ALLOWED_PROTOCOLS = new Set([
  'magnet:',
  'ed2k:',
  'http:',
  'https:',
  'ftp:',
]);

interface ParsedListRequest {
  readonly connectionId: string;
  readonly page: number;
}

interface ParsedAddRequest {
  readonly connectionId: string;
  readonly folderId: string;
  readonly urls: readonly string[];
}

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function parseConnection(value: unknown): string | DriveError {
  if (typeof value !== 'object' || value === null) {
    return {
      code: 'invalid_input',
      message: '离线任务参数不正确。',
    };
  }

  const input = value as Record<string, unknown>;

  try {
    return parseSiteConnectionId(input.connectionId);
  } catch {
    return {
      code: 'invalid_input',
      message: '站点连接 ID 格式不正确。',
    };
  }
}

function parseListRequest(value: unknown): ParsedListRequest | DriveError {
  const connectionId = parseConnection(value);

  if (isDriveError(connectionId)) {
    return connectionId;
  }

  const input = value as Record<string, unknown>;
  const page = Number(input.page ?? 1);

  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    return {
      code: 'invalid_input',
      message: '离线任务页码不正确。',
    };
  }

  return { connectionId, page };
}

function parseUrl(value: string): string | null {
  const normalized = value.trim();

  if (!normalized || normalized.length > MAX_URL_LENGTH) {
    return null;
  }

  try {
    const parsed = new URL(normalized);

    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? normalized : null;
  } catch {
    return null;
  }
}

function parseAddRequest(value: unknown): ParsedAddRequest | DriveError {
  const connectionId = parseConnection(value);

  if (isDriveError(connectionId)) {
    return connectionId;
  }

  const input = value as Record<string, unknown>;
  const folderId = asText(input.folderId) || '0';

  if (folderId.length > 32 || !/^\d+$/.test(folderId)) {
    return {
      code: 'invalid_input',
      message: '离线任务保存目录不正确。',
    };
  }

  const rawUrls = Array.isArray(input.urls) ? input.urls : [];
  const urls = rawUrls.flatMap((url) => {
    if (typeof url !== 'string') {
      return [];
    }

    const parsed = parseUrl(url);

    return parsed ? [parsed] : [];
  });

  if (
    rawUrls.length === 0 ||
    rawUrls.length > MAX_URLS ||
    urls.length !== rawUrls.length
  ) {
    return {
      code: 'invalid_input',
      message: '请输入有效的 magnet、ED2K、HTTP 或 FTP 链接。',
    };
  }

  return { connectionId, folderId, urls: [...new Set(urls)] };
}

async function getOfflineCredentials(
  siteSession: Session,
): Promise<DriveResult<{ sign: string; time: string; userId: string }>> {
  const [space, user] = await Promise.all([
    fetch115Json(
      siteSession,
      `${WEB_ORIGIN}/?ct=offline&ac=space&_=${Date.now()}`,
    ),
    fetch115Json(siteSession, 'https://webapi.115.com/offine/downpath'),
  ]);

  if (!space.ok) {
    return space;
  }

  if (!user.ok) {
    return user;
  }

  const sign = asText(space.data.sign);
  const time = asText(space.data.time);
  const userData = Array.isArray(user.data.data) ? user.data.data : [];
  const userId = asText(asRecord(userData[0])?.user_id);

  return sign && time && userId
    ? { ok: true, data: { sign, time, userId } }
    : failure('auth_required', '无法读取 115 离线任务凭证，请重新登录。');
}

export async function list115OfflineTasks(
  value: unknown,
): Promise<DriveResult<DriveOfflineTaskList>> {
  const request = parseListRequest(value);

  if (isDriveError(request)) {
    return { ok: false, error: request };
  }

  const siteSession = await getAccountSession(request.connectionId);

  if (isDriveError(siteSession)) {
    return { ok: false, error: siteSession };
  }

  const response = await fetch115Json(
    siteSession,
    `${WEB_ORIGIN}/web/lixian/?ct=lixian&ac=task_lists&page=${request.page}`,
  );

  return response.ok
    ? {
        ok: true,
        data: normalize115OfflineTaskList(response.data, request.page),
      }
    : response;
}

export async function add115OfflineTasks(
  value: unknown,
): Promise<DriveResult<DriveOfflineAddResult>> {
  const request = parseAddRequest(value);

  if (isDriveError(request)) {
    return { ok: false, error: request };
  }

  const siteSession = await getAccountSession(request.connectionId);

  if (isDriveError(siteSession)) {
    return { ok: false, error: siteSession };
  }

  const credentials = await getOfflineCredentials(siteSession);

  if (!credentials.ok) {
    return credentials;
  }

  const params = new URLSearchParams({
    savepath: '',
    wp_path_id: request.folderId,
    uid: credentials.data.userId,
    sign: credentials.data.sign,
    time: credentials.data.time,
  });

  if (request.urls.length === 1) {
    params.set('url', request.urls[0] ?? '');
  } else {
    for (const [index, url] of request.urls.entries()) {
      params.set(`url[${index}]`, url);
    }
  }

  const endpoint =
    request.urls.length === 1
      ? `${WEB_ORIGIN}/web/lixian/?ct=lixian&ac=add_task_url`
      : `${WEB_ORIGIN}/web/lixian/?ct=lixian&ac=add_task_urls`;
  const response = await fetch115Json(siteSession, endpoint, {
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    body: params.toString(),
  });

  if (!response.ok) {
    return response;
  }

  if (request.urls.length === 1) {
    return {
      ok: true,
      data: {
        successCount: 1,
        failedCount: 0,
        errors: [],
      },
    };
  }

  const result = asRecord(response.data.result);
  const errors: DriveOfflineAddError[] = [];
  let successCount = 0;

  if (result) {
    for (const resultEntry of Object.values(result)) {
      const item = asRecord(resultEntry);

      if (item?.state === true) {
        successCount += 1;
      } else {
        errors.push({
          url: asText(item?.url),
          message: asText(item?.error_msg) || '离线任务提交失败。',
        });
      }
    }
  } else {
    successCount = request.urls.length;
  }

  return {
    ok: true,
    data: {
      successCount,
      failedCount: errors.length,
      errors,
    },
  };
}
