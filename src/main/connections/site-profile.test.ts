import { describe, expect, it } from 'vitest';
import { buildDesktopChromeUserAgent } from './site-profile';

describe('site session browser profile', () => {
  it('uses a standard Chrome user agent without an Electron token', () => {
    const userAgent = buildDesktopChromeUserAgent('win32', '152.0.7977.167');

    expect(userAgent).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.167 Safari/537.36',
    );
    expect(userAgent).not.toContain('Electron');
  });

  it('uses the matching platform token on macOS and Linux', () => {
    expect(buildDesktopChromeUserAgent('darwin', '152.0.0.0')).toContain(
      'Macintosh; Intel Mac OS X 10_15_7',
    );
    expect(buildDesktopChromeUserAgent('linux', '152.0.0.0')).toContain(
      'X11; Linux x86_64',
    );
  });
});
