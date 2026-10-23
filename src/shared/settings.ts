import type { ThemePreference } from './appearance';
import type { SiteConnection } from './connections';

export const PROXY_PROTOCOLS = ['http', 'https', 'socks5'] as const;

export type ProxyProtocol = (typeof PROXY_PROTOCOLS)[number];

export interface ProxySettings {
  readonly enabled: boolean;
  readonly protocol: ProxyProtocol;
  readonly host: string;
  readonly port: number;
}

export const DEFAULT_WINDOW_WIDTH = 1180;
export const DEFAULT_WINDOW_HEIGHT = 760;

export interface WindowStateSettings {
  readonly x: number | null;
  readonly y: number | null;
  readonly width: number;
  readonly height: number;
  readonly maximized: boolean;
}

export const DEFAULT_WINDOW_STATE: WindowStateSettings = {
  x: null,
  y: null,
  width: DEFAULT_WINDOW_WIDTH,
  height: DEFAULT_WINDOW_HEIGHT,
  maximized: false,
};

export interface AppSettings {
  readonly schemaVersion: 3;
  readonly network: {
    readonly proxy: ProxySettings;
  };
  readonly connections: {
    readonly sites: readonly SiteConnection[];
  };
  readonly appearance: {
    readonly theme: ThemePreference;
  };
  readonly downloads: {
    readonly directory: string | null;
  };
  readonly subtitles: {
    readonly directory: string | null;
  };
  readonly localVideo: {
    readonly directories: readonly string[];
  };
  readonly windowState: WindowStateSettings;
}

export type ProxyTestTargetId = 'google' | 'github';

export interface ProxyTestTargetResult {
  readonly id: ProxyTestTargetId;
  readonly label: string;
  readonly url: string;
  readonly ok: boolean;
  readonly status: number | null;
  readonly latencyMs: number | null;
  readonly message: string;
}

export interface ProxyTestResult {
  readonly ok: boolean;
  readonly testedAt: string;
  readonly results: readonly ProxyTestTargetResult[];
}
