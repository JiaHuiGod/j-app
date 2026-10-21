import type { Session } from 'electron';
import type { SiteConnection } from '@shared/connections';
import { is115Connection } from '../drive/detection';
import { request115 } from '../drive/115-http';

const LOGIN_CHECK_URL = 'https://webapi.115.com/offine/downpath';
const REQUIRED_115_COOKIES = ['PHPSESSID', 'UID', 'CID', 'SEID', 'KID'];

async function getMissingAuthCookies(
  siteSession: Session,
): Promise<readonly string[]> {
  const cookies = await siteSession.cookies.get({});
  const names = new Set(cookies.map((cookie) => cookie.name));

  return REQUIRED_115_COOKIES.filter((name) => !names.has(name));
}

/**
 * 115 login pages set anti-bot and guest cookies before the user actually
 * authenticates. A non-zero cookie count is therefore not proof of a valid
 * session. Validate the account through the same endpoint used by the drive
 * page before persisting a "successful" login.
 */
export async function validateSiteLogin(
  connection: SiteConnection,
  siteSession: Session,
): Promise<void> {
  if (!is115Connection(connection)) {
    return;
  }

  const response = await request115(siteSession, LOGIN_CHECK_URL);

  if (!response.ok) {
    throw new Error(response.error.message);
  }

  const { status, body: text } = response.data;

  if (status === 401 || status === 403) {
    throw new Error('115 登录已失效，请重新登录。');
  }

  if (status < 200 || status >= 300) {
    throw new Error(`115 登录验证失败（HTTP ${status}）。`);
  }

  let body: unknown;

  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new Error('无法解析 115 登录验证响应，请稍后重试。');
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    (body as { state?: unknown }).state !== true
  ) {
    const missing = await getMissingAuthCookies(siteSession);

    if (missing.length > 0) {
      throw new Error(
        `115 登录尚未完成（缺少登录 Cookie：${missing.join('、')}），请在登录窗口中完成登录并等待进入网盘后再关闭。`,
      );
    }

    throw new Error(
      '115 已写入登录 Cookie，但账号态校验仍未通过；请重新登录或检查 115 服务状态。',
    );
  }
}
