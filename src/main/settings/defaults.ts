import type { AppSettings, ProxySettings } from '@shared/settings';
import { DEFAULT_WINDOW_STATE } from '@shared/settings';

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: false,
  protocol: 'http',
  host: '',
  port: 0,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  schemaVersion: 3,
  network: {
    proxy: DEFAULT_PROXY_SETTINGS,
  },
  connections: {
    sites: [],
  },
  appearance: {
    theme: 'light',
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
  windowState: DEFAULT_WINDOW_STATE,
};

export function createDefaultAppSettings(): AppSettings {
  return structuredClone(DEFAULT_APP_SETTINGS);
}
