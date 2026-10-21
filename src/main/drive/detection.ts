import type { SiteConnection } from '@shared/connections';

/**
 * The 115 web API uses cookies scoped to 115.com. A connection is eligible for
 * the drive module only when it was created from a 115 login URL.
 */
export function is115Connection(
  connection: Pick<SiteConnection, 'loginUrl'>,
): boolean {
  try {
    const hostname = new URL(connection.loginUrl).hostname.toLowerCase();

    return hostname === '115.com' || hostname.endsWith('.115.com');
  } catch {
    return false;
  }
}
