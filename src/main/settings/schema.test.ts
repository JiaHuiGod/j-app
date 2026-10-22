import { describe, expect, it } from 'vitest';
import {
  parseAppSettings,
  parseCreateSiteConnectionInput,
  parseProxySettings,
  parseThemePreference,
} from './schema';

const disabledProxy = {
  enabled: false,
  protocol: 'http' as const,
  host: '',
  port: 0,
};

describe('proxy settings validation', () => {
  it('allows a disabled proxy without a host or port', () => {
    expect(parseProxySettings(disabledProxy)).toEqual(disabledProxy);
  });

  it('normalizes a valid enabled proxy', () => {
    expect(
      parseProxySettings({
        enabled: true,
        protocol: 'socks5',
        host: ' 127.0.0.1 ',
        port: 7890,
      }),
    ).toEqual({
      enabled: true,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 7890,
    });
  });

  it('rejects an enabled proxy without a host', () => {
    expect(() =>
      parseProxySettings({
        enabled: true,
        protocol: 'http',
        host: '',
        port: 7890,
      }),
    ).toThrow('请输入代理主机地址。');
  });
});

describe('application settings migration', () => {
  it('migrates version 1 settings and adds defaults', () => {
    const migrated = parseAppSettings({
      schemaVersion: 1,
      network: {
        proxy: disabledProxy,
      },
    });

    expect(migrated).toEqual({
      schemaVersion: 3,
      network: {
        proxy: disabledProxy,
      },
      connections: {
        sites: [],
      },
      appearance: {
        theme: 'system',
      },
      downloads: {
        directory: null,
      },
      subtitles: {
        directory: null,
      },
      localVideo: {
        directories: [],
      },
    });
  });

  it('migrates version 2 settings and preserves site connections', () => {
    const settings = parseAppSettings({
      schemaVersion: 2,
      network: {
        proxy: disabledProxy,
      },
      connections: {
        sites: [
          {
            id: '0f2a63a7-0a9f-4b0a-9d0b-6b8e1c1a2f5d',
            name: 'GitHub',
            loginUrl: 'https://github.com/login',
            createdAt: '2026-10-21T02:00:00.000Z',
            lastLoginAt: null,
          },
        ],
      },
    });

    expect(settings.schemaVersion).toBe(3);
    expect(settings.connections.sites).toHaveLength(1);
    expect(settings.appearance.theme).toBe('system');
  });

  it('accepts version 3 theme preferences', () => {
    const settings = parseAppSettings({
      schemaVersion: 3,
      network: {
        proxy: disabledProxy,
      },
      connections: {
        sites: [],
      },
      appearance: {
        theme: 'dark',
      },
    });

    expect(settings.appearance.theme).toBe('dark');
  });

  it('migrates a legacy single local video directory', () => {
    const settings = parseAppSettings({
      schemaVersion: 3,
      network: {
        proxy: disabledProxy,
      },
      connections: {
        sites: [],
      },
      appearance: {
        theme: 'light',
      },
      localVideo: {
        directory: 'D:\\Videos',
      },
    });

    expect(settings.localVideo.directories).toEqual(['D:\\Videos']);
  });

  it('rejects unsupported settings versions', () => {
    expect(() =>
      parseAppSettings({
        schemaVersion: 4,
        network: {
          proxy: disabledProxy,
        },
        connections: {
          sites: [],
        },
        appearance: {
          theme: 'system',
        },
      }),
    ).toThrow(/schemaVersion|Invalid input|expected/i);
  });
});

describe('theme preference validation', () => {
  it('accepts all supported theme preferences', () => {
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('rejects an unknown theme preference', () => {
    expect(() => parseThemePreference('sepia')).toThrow(/主题/);
  });
});

describe('site connection input validation', () => {
  it('normalizes an HTTPS login address', () => {
    expect(
      parseCreateSiteConnectionInput({
        name: ' GitHub ',
        loginUrl: ' https://github.com/login ',
      }),
    ).toEqual({
      name: 'GitHub',
      loginUrl: 'https://github.com/login',
    });
  });

  it('allows a local development login address over HTTP', () => {
    expect(
      parseCreateSiteConnectionInput({
        name: 'Local',
        loginUrl: 'http://localhost:3000/login',
      }),
    ).toEqual({
      name: 'Local',
      loginUrl: 'http://localhost:3000/login',
    });
  });

  it('rejects a non-local HTTP login address', () => {
    expect(() =>
      parseCreateSiteConnectionInput({
        name: 'Example',
        loginUrl: 'http://example.com/login',
      }),
    ).toThrow(/https/i);
  });
});
