import { describe, expect, it } from 'vitest';
import { parseAppSettings, parseProxySettings } from './schema';

describe('proxy settings validation', () => {
  it('allows a disabled proxy without a host or port', () => {
    expect(
      parseProxySettings({
        enabled: false,
        protocol: 'http',
        host: '',
        port: 0,
      }),
    ).toEqual({
      enabled: false,
      protocol: 'http',
      host: '',
      port: 0,
    });
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

  it('rejects unsupported settings versions', () => {
    expect(() =>
      parseAppSettings({
        schemaVersion: 2,
        network: {
          proxy: {
            enabled: false,
            protocol: 'http',
            host: '',
            port: 0,
          },
        },
      }),
    ).toThrow(/schemaVersion|Invalid input|expected/i);
  });
});
