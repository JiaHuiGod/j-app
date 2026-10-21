import type { Session } from 'electron';
import type { SiteConnection } from '@shared/connections';
import { is115Connection } from '../drive/detection';

const PERSISTED_115_COOKIES = new Set([
  'PHPSESSID',
  'UID',
  'CID',
  'SEID',
  'KID',
]);
const PERSIST_DAYS = 30;

function is115CookieHost(domain: string): boolean {
  const host = domain.replace(/^\./, '').toLowerCase();

  return host === '115.com' || host.endsWith('.115.com');
}

/**
 * 115 keeps several authenticated cookies as session cookies. Chromium keeps
 * those in memory only, so they disappear after an app restart even though the
 * persistent partition was flushed. Promote only the known 115 auth cookies to
 * a 30-day persistent lifetime; values stay encrypted inside the Chromium
 * cookie store and never enter renderer code or settings.json.
 */
export async function persist115SessionCookies(
  connection: SiteConnection,
  siteSession: Session,
): Promise<void> {
  if (!is115Connection(connection)) {
    return;
  }

  const cookies = await siteSession.cookies.get({});
  const expirationDate = Math.floor(Date.now() / 1000) + PERSIST_DAYS * 86400;
  let promoted = 0;

  for (const cookie of cookies) {
    const domain = cookie.domain;

    if (
      !domain ||
      !cookie.session ||
      !PERSISTED_115_COOKIES.has(cookie.name) ||
      !is115CookieHost(domain)
    ) {
      continue;
    }

    const host = domain.replace(/^\./, '');

    try {
      await siteSession.cookies.set({
        url: `https://${host}${cookie.path || '/'}`,
        name: cookie.name,
        value: cookie.value,
        domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate,
      });
      promoted += 1;
    } catch (error) {
      console.warn(`Failed to persist 115 cookie ${cookie.name}:`, error);
    }
  }

  if (promoted > 0) {
    await siteSession.cookies.flushStore();
  }
}
