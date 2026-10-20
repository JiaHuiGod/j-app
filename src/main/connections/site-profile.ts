import type { Session } from 'electron';

const SITE_ACCEPT_LANGUAGES = 'zh-CN,zh,en';

function getPlatformToken(platform: NodeJS.Platform): string {
  switch (platform) {
    case 'win32':
      return 'Windows NT 10.0; Win64; x64';
    case 'darwin':
      return 'Macintosh; Intel Mac OS X 10_15_7';
    default:
      return 'X11; Linux x86_64';
  }
}

export function buildDesktopChromeUserAgent(
  platform: NodeJS.Platform,
  chromeVersion: string,
): string {
  return `Mozilla/5.0 (${getPlatformToken(platform)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
}

export function getSiteUserAgent(): string {
  return buildDesktopChromeUserAgent(
    process.platform,
    process.versions.chrome ?? '152.0.0.0',
  );
}

/**
 * Some sites reject Electron's default UA even though the embedded Chromium
 * engine is a normal browser. Use a standard desktop Chrome UA for site
 * sessions so login pages and ordinary web content get the same treatment as
 * Chrome. This is a compatibility setting, not a Cloudflare/anti-bot bypass.
 */
export function applySiteSessionProfile(siteSession: Session): void {
  siteSession.setUserAgent(getSiteUserAgent(), SITE_ACCEPT_LANGUAGES);
}
