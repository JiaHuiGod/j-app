import type { AppSettings, ProxySettings } from '@shared/settings';

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: false,
  protocol: 'http',
  host: '',
  port: 0,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  schemaVersion: 2,
  network: {
    proxy: DEFAULT_PROXY_SETTINGS,
  },
  connections: {
    sites: [],
  },
};

export function createDefaultAppSettings(): AppSettings {
  return structuredClone(DEFAULT_APP_SETTINGS);
}
