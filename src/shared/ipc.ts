import type { AppearanceState, ThemePreference } from './appearance';
import type {
  CreateSiteConnectionInput,
  SiteConnectionSummary,
} from './connections';
import type {
  DriveAccount,
  DriveCreateFolderInput,
  DriveDeleteInput,
  DriveListInput,
  DriveListing,
  DriveMoveInput,
  DriveRenameInput,
  DriveResult,
  DriveSearchInput,
  DriveSearchResult,
  DriveUploadInput,
  DriveUploadProgress,
  DriveUploadResult,
} from './drive';
import type { ProxySettings, ProxyTestResult } from './settings';

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
  GetProxySettings: 'settings:get-proxy',
  SaveProxySettings: 'settings:save-proxy',
  TestProxySettings: 'settings:test-proxy',
  GetAppearance: 'appearance:get',
  SetAppearanceTheme: 'appearance:set-theme',
  RestartApp: 'app:restart',
  ListSiteConnections: 'connections:list',
  CreateSiteConnection: 'connections:create',
  CreateSitePreset: 'connections:create-preset',
  LoginSiteConnection: 'connections:login',
  RemoveSiteConnection: 'connections:remove',
  ClearSiteConnections: 'connections:clear-all',
  ListDriveAccounts: 'drive:list-accounts',
  ListDriveFolder: 'drive:list-folder',
  SearchDriveFolder: 'drive:search-folder',
  CreateDriveFolder: 'drive:create-folder',
  RenameDriveEntry: 'drive:rename-entry',
  DeleteDriveEntry: 'drive:delete-entry',
  MoveDriveEntry: 'drive:move-entry',
  UploadDriveFiles: 'drive:upload-files',
  UploadDroppedDriveFiles: 'drive:upload-dropped-files',
  DriveUploadProgress: 'drive:upload-progress',
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

export interface SettingsApi {
  getProxy: () => Promise<ProxySettings>;
  saveProxy: (settings: ProxySettings) => Promise<void>;
  testProxy: (settings: ProxySettings) => Promise<ProxyTestResult>;
}

export interface AppearanceApi {
  get: () => Promise<AppearanceState>;
  setTheme: (theme: ThemePreference) => Promise<AppearanceState>;
}

export interface ConnectionsApi {
  list: () => Promise<readonly SiteConnectionSummary[]>;
  /** Starts the login flow and saves the site after cookies are captured. */
  create: (input: CreateSiteConnectionInput) => Promise<SiteConnectionSummary>;
  /** Saves only the site metadata so it can be logged into later. */
  createPreset: (
    input: CreateSiteConnectionInput,
  ) => Promise<SiteConnectionSummary>;
  login: (connectionId: string) => Promise<SiteConnectionSummary>;
  remove: (connectionId: string) => Promise<void>;
  clearAll: () => Promise<number>;
}

export interface DriveApi {
  listAccounts: () => Promise<DriveResult<readonly DriveAccount[]>>;
  listFolder: (input: DriveListInput) => Promise<DriveResult<DriveListing>>;
  searchFolder: (
    input: DriveSearchInput,
  ) => Promise<DriveResult<DriveSearchResult>>;
  createFolder: (input: DriveCreateFolderInput) => Promise<DriveResult<null>>;
  renameEntry: (input: DriveRenameInput) => Promise<DriveResult<null>>;
  deleteEntry: (input: DriveDeleteInput) => Promise<DriveResult<null>>;
  moveEntry: (input: DriveMoveInput) => Promise<DriveResult<null>>;
  uploadFiles: (
    input: DriveUploadInput,
  ) => Promise<DriveResult<DriveUploadResult>>;
  uploadDroppedFiles: (
    input: DriveUploadInput,
    files: readonly File[],
  ) => Promise<DriveResult<DriveUploadResult>>;
  onUploadProgress: (
    listener: (progress: DriveUploadProgress) => void,
  ) => () => void;
}

/**
 * The only API exposed to the renderer through `window.desktop`.
 * Add methods here first, then implement them in the preload and main process.
 */
export interface DesktopApi {
  readonly platform: string;
  readonly getAppInfo: () => Promise<AppInfo>;
  readonly windowControls: WindowControls;
  readonly settings: SettingsApi;
  readonly appearance: AppearanceApi;
  readonly connections: ConnectionsApi;
  readonly drive: DriveApi;
  readonly restartApp: () => void;
}
