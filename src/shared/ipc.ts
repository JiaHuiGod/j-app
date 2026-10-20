/**
 * Contract shared by the main, preload, and renderer processes.
 * Keep channel names and payload types here so IPC stays typed end to end.
 */
export const IpcChannel = {
  GetAppInfo: 'app:get-info',
  WindowMinimize: 'window:minimize',
  WindowToggleMaximize: 'window:toggle-maximize',
  WindowClose: 'window:close',
  WindowIsMaximized: 'window:is-maximized',
  WindowMaximizedChanged: 'window:maximized-changed',
} as const;

export interface AppInfo {
  readonly appName: string;
  readonly appVersion: string;
  readonly electronVersion: string;
  readonly chromeVersion: string;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly isPackaged: boolean;
}

export interface WindowControls {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (listener: (isMaximized: boolean) => void) => () => void;
}

/**
 * The only API exposed to the renderer through `window.desktop`.
 * Add methods here first, then implement them in the preload and main process.
 */
export interface DesktopApi {
  readonly platform: string;
  readonly getAppInfo: () => Promise<AppInfo>;
  readonly windowControls: WindowControls;
}
