import type { AppearanceState, ThemePreference } from './appearance';
import type {
  ClearAllSiteConnectionsResult,
  CreateSiteConnectionInput,
  RemoveSiteConnectionResult,
  SetSiteConnectionPinnedInput,
  SiteConnectionSummary,
} from './connections';
import type {
  DriveAccount,
  DriveCreateFolderInput,
  DriveDeleteInput,
  DriveListInput,
  DriveListing,
  DriveMoveInput,
  DriveOfflineAddInput,
  DriveOfflineAddResult,
  DriveOfflineListInput,
  DriveOfflineTaskList,
  DriveRenameInput,
  DriveResult,
  DriveSearchInput,
  DriveSearchResult,
  DriveUploadInput,
  DriveUploadProgress,
  DriveUploadResult,
  DriveDownloadInput,
  DriveDownloadProgress,
  DriveDownloadResult,
  DrivePlaybackInput,
  DrivePlaybackResult,
  DriveSubtitle,
} from './drive';
import type { ProxySettings, ProxyTestResult } from './settings';
import type { DesktopBehaviorState, DesktopBehaviorUpdate } from './settings';
import type { LocalVideoApi } from './local-video';

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
  AppNavigate: 'app:navigate',
  GetDesktopBehavior: 'desktop:get-behavior',
  SaveDesktopBehavior: 'desktop:save-behavior',
  GetProxySettings: 'settings:get-proxy',
  SaveProxySettings: 'settings:save-proxy',
  TestProxySettings: 'settings:test-proxy',
  GetDownloadDirectory: 'settings:get-download-directory',
  ChooseDownloadDirectory: 'settings:choose-download-directory',
  ClearDownloadDirectory: 'settings:clear-download-directory',
  GetSubtitleDirectory: 'settings:get-subtitle-directory',
  ChooseSubtitleDirectory: 'settings:choose-subtitle-directory',
  ClearSubtitleDirectory: 'settings:clear-subtitle-directory',
  GetAppearance: 'appearance:get',
  SetAppearanceTheme: 'appearance:set-theme',
  RestartApp: 'app:restart',
  ListSiteConnections: 'connections:list',
  CreateSiteConnection: 'connections:create',
  CreateSitePreset: 'connections:create-preset',
  LoginSiteConnection: 'connections:login',
  SetSiteConnectionPinned: 'connections:set-pinned',
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
  ListDriveOfflineTasks: 'drive:offline-list',
  AddDriveOfflineTasks: 'drive:offline-add',
  DownloadDriveFile: 'drive:file-download',
  CancelDriveDownload: 'drive:file-cancel',
  OpenDriveDownloadFolder: 'drive:file-open-folder',
  StartDrivePlayback: 'drive:playback-start',
  StopDrivePlayback: 'drive:playback-stop',
  GetDriveSubtitles: 'drive:subtitles',
  DriveUploadProgress: 'drive:upload-progress',
  DriveDownloadProgress: 'drive:file-download-progress',
  ChooseLocalVideoFolders: 'local-video:choose-folders',
  LoadLocalVideoLibraries: 'local-video:load-libraries',
  RescanLocalVideoFolders: 'local-video:rescan',
  RemoveLocalVideoFolder: 'local-video:remove-folder',
  GetLocalVideoSubtitles: 'local-video:subtitles',
  CancelLocalVideoScan: 'local-video:cancel-scan',
  LocalVideoScanProgress: 'local-video:scan-progress',
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

export type AppNavigationTarget = 'local' | 'settings';

export interface DesktopBehaviorApi {
  get: () => Promise<DesktopBehaviorState>;
  save: (input: DesktopBehaviorUpdate) => Promise<DesktopBehaviorState>;
}

export interface SettingsApi {
  getProxy: () => Promise<ProxySettings>;
  saveProxy: (settings: ProxySettings) => Promise<void>;
  testProxy: (settings: ProxySettings) => Promise<ProxyTestResult>;
  getDownloadDirectory: () => Promise<string | null>;
  chooseDownloadDirectory: () => Promise<string | null>;
  clearDownloadDirectory: () => Promise<void>;
  getSubtitleDirectory: () => Promise<string | null>;
  chooseSubtitleDirectory: () => Promise<string | null>;
  clearSubtitleDirectory: () => Promise<void>;
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
  setPinned: (
    input: SetSiteConnectionPinnedInput,
  ) => Promise<SiteConnectionSummary>;
  remove: (connectionId: string) => Promise<RemoveSiteConnectionResult>;
  clearAll: () => Promise<ClearAllSiteConnectionsResult>;
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
  listOfflineTasks: (
    input: DriveOfflineListInput,
  ) => Promise<DriveResult<DriveOfflineTaskList>>;
  addOfflineTasks: (
    input: DriveOfflineAddInput,
  ) => Promise<DriveResult<DriveOfflineAddResult>>;
  downloadFile: (
    input: DriveDownloadInput,
  ) => Promise<DriveResult<DriveDownloadResult>>;
  cancelDownload: (downloadId: string) => Promise<DriveResult<null>>;
  openDownloadFolder: (downloadId: string) => Promise<DriveResult<null>>;
  startPlayback: (
    input: DrivePlaybackInput,
  ) => Promise<DriveResult<DrivePlaybackResult>>;
  stopPlayback: (sessionId: string) => Promise<DriveResult<null>>;
  getSubtitles: (
    fileName: string,
  ) => Promise<DriveResult<readonly DriveSubtitle[]>>;
  onUploadProgress: (
    listener: (progress: DriveUploadProgress) => void,
  ) => () => void;
  onDownloadProgress: (
    listener: (progress: DriveDownloadProgress) => void,
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
  readonly desktop: DesktopBehaviorApi;
  readonly settings: SettingsApi;
  readonly appearance: AppearanceApi;
  readonly connections: ConnectionsApi;
  readonly drive: DriveApi;
  readonly localVideo: LocalVideoApi;
  readonly onNavigate: (
    listener: (page: AppNavigationTarget) => void,
  ) => () => void;
  readonly restartApp: () => void;
}
