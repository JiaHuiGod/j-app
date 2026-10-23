import {
  contextBridge,
  ipcRenderer,
  webUtils,
  type IpcRendererEvent,
} from 'electron';
import type { ThemePreference } from '@shared/appearance';
import type {
  CreateSiteConnectionInput,
  SetSiteConnectionPinnedInput,
} from '@shared/connections';
import type {
  DriveCreateFolderInput,
  DriveDeleteInput,
  DriveListInput,
  DriveMoveInput,
  DriveOfflineAddInput,
  DriveOfflineListInput,
  DrivePlaybackInput,
  DriveRenameInput,
  DriveSearchInput,
  DriveUploadInput,
  DriveUploadProgress,
  DriveDownloadInput,
  DriveDownloadProgress,
} from '@shared/drive';
import {
  IpcChannel,
  type AppearanceApi,
  type ConnectionsApi,
  type DesktopApi,
  type DriveApi,
  type SettingsApi,
  type WindowControls,
} from '@shared/ipc';
import type { ProxySettings } from '@shared/settings';
import type {
  LocalVideoApi,
  LocalVideoScanProgress,
  LocalVideoSubtitleInput,
} from '@shared/local-video';

const windowControls = Object.freeze<WindowControls>({
  minimize: () => {
    ipcRenderer.send(IpcChannel.WindowMinimize);
  },
  toggleMaximize: () => {
    ipcRenderer.send(IpcChannel.WindowToggleMaximize);
  },
  close: () => {
    ipcRenderer.send(IpcChannel.WindowClose);
  },
  isMaximized: () => ipcRenderer.invoke(IpcChannel.WindowIsMaximized),
  onMaximizedChange: (listener) => {
    const handler = (_event: IpcRendererEvent, isMaximized: boolean) => {
      listener(isMaximized);
    };

    ipcRenderer.on(IpcChannel.WindowMaximizedChanged, handler);

    return () => {
      ipcRenderer.removeListener(IpcChannel.WindowMaximizedChanged, handler);
    };
  },
});

const settings = Object.freeze<SettingsApi>({
  getProxy: () => ipcRenderer.invoke(IpcChannel.GetProxySettings),
  saveProxy: (proxy: ProxySettings) => {
    return ipcRenderer.invoke(IpcChannel.SaveProxySettings, proxy);
  },
  testProxy: (proxy: ProxySettings) => {
    return ipcRenderer.invoke(IpcChannel.TestProxySettings, proxy);
  },
  getDownloadDirectory: () => {
    return ipcRenderer.invoke(IpcChannel.GetDownloadDirectory);
  },
  chooseDownloadDirectory: () => {
    return ipcRenderer.invoke(IpcChannel.ChooseDownloadDirectory);
  },
  clearDownloadDirectory: () => {
    return ipcRenderer.invoke(IpcChannel.ClearDownloadDirectory);
  },
  getSubtitleDirectory: () => {
    return ipcRenderer.invoke(IpcChannel.GetSubtitleDirectory);
  },
  chooseSubtitleDirectory: () => {
    return ipcRenderer.invoke(IpcChannel.ChooseSubtitleDirectory);
  },
  clearSubtitleDirectory: () => {
    return ipcRenderer.invoke(IpcChannel.ClearSubtitleDirectory);
  },
});

const connections = Object.freeze<ConnectionsApi>({
  list: () => ipcRenderer.invoke(IpcChannel.ListSiteConnections),
  create: (input: CreateSiteConnectionInput) => {
    return ipcRenderer.invoke(IpcChannel.CreateSiteConnection, input);
  },
  createPreset: (input: CreateSiteConnectionInput) => {
    return ipcRenderer.invoke(IpcChannel.CreateSitePreset, input);
  },
  login: (connectionId: string) => {
    return ipcRenderer.invoke(IpcChannel.LoginSiteConnection, connectionId);
  },
  setPinned: (input: SetSiteConnectionPinnedInput) => {
    return ipcRenderer.invoke(IpcChannel.SetSiteConnectionPinned, input);
  },
  remove: (connectionId: string) => {
    return ipcRenderer.invoke(IpcChannel.RemoveSiteConnection, connectionId);
  },
  clearAll: () => {
    return ipcRenderer.invoke(IpcChannel.ClearSiteConnections);
  },
});

const appearance = Object.freeze<AppearanceApi>({
  get: () => ipcRenderer.invoke(IpcChannel.GetAppearance),
  setTheme: (theme: ThemePreference) => {
    return ipcRenderer.invoke(IpcChannel.SetAppearanceTheme, theme);
  },
});

const drive = Object.freeze<DriveApi>({
  listAccounts: () => ipcRenderer.invoke(IpcChannel.ListDriveAccounts),
  listFolder: (input: DriveListInput) => {
    return ipcRenderer.invoke(IpcChannel.ListDriveFolder, input);
  },
  searchFolder: (input: DriveSearchInput) => {
    return ipcRenderer.invoke(IpcChannel.SearchDriveFolder, input);
  },
  createFolder: (input: DriveCreateFolderInput) => {
    return ipcRenderer.invoke(IpcChannel.CreateDriveFolder, input);
  },
  renameEntry: (input: DriveRenameInput) => {
    return ipcRenderer.invoke(IpcChannel.RenameDriveEntry, input);
  },
  deleteEntry: (input: DriveDeleteInput) => {
    return ipcRenderer.invoke(IpcChannel.DeleteDriveEntry, input);
  },
  moveEntry: (input: DriveMoveInput) => {
    return ipcRenderer.invoke(IpcChannel.MoveDriveEntry, input);
  },
  uploadFiles: (input: DriveUploadInput) => {
    return ipcRenderer.invoke(IpcChannel.UploadDriveFiles, input);
  },
  uploadDroppedFiles: (input: DriveUploadInput, files: readonly File[]) => {
    const filePaths = files.flatMap((file) => {
      try {
        const filePath = webUtils.getPathForFile(file);
        return filePath ? [filePath] : [];
      } catch {
        return [];
      }
    });

    return ipcRenderer.invoke(IpcChannel.UploadDroppedDriveFiles, {
      ...input,
      filePaths,
    });
  },
  listOfflineTasks: (input: DriveOfflineListInput) => {
    return ipcRenderer.invoke(IpcChannel.ListDriveOfflineTasks, input);
  },
  addOfflineTasks: (input: DriveOfflineAddInput) => {
    return ipcRenderer.invoke(IpcChannel.AddDriveOfflineTasks, input);
  },
  downloadFile: (input: DriveDownloadInput) => {
    return ipcRenderer.invoke(IpcChannel.DownloadDriveFile, input);
  },
  cancelDownload: (downloadId: string) => {
    return ipcRenderer.invoke(IpcChannel.CancelDriveDownload, downloadId);
  },
  openDownloadFolder: (downloadId: string) => {
    return ipcRenderer.invoke(IpcChannel.OpenDriveDownloadFolder, downloadId);
  },
  startPlayback: (input: DrivePlaybackInput) => {
    return ipcRenderer.invoke(IpcChannel.StartDrivePlayback, input);
  },
  stopPlayback: (sessionId: string) => {
    return ipcRenderer.invoke(IpcChannel.StopDrivePlayback, sessionId);
  },
  getSubtitles: (fileName: string) => {
    return ipcRenderer.invoke(IpcChannel.GetDriveSubtitles, fileName);
  },
  onUploadProgress: (listener: (progress: DriveUploadProgress) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      progress: DriveUploadProgress,
    ) => {
      listener(progress);
    };

    ipcRenderer.on(IpcChannel.DriveUploadProgress, handler);

    return () => {
      ipcRenderer.removeListener(IpcChannel.DriveUploadProgress, handler);
    };
  },
  onDownloadProgress: (listener: (progress: DriveDownloadProgress) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      progress: DriveDownloadProgress,
    ) => {
      listener(progress);
    };

    ipcRenderer.on(IpcChannel.DriveDownloadProgress, handler);

    return () => {
      ipcRenderer.removeListener(IpcChannel.DriveDownloadProgress, handler);
    };
  },
});

const localVideo: LocalVideoApi = {
  chooseFolders: () => {
    return ipcRenderer.invoke(IpcChannel.ChooseLocalVideoFolders);
  },
  loadLibraries: () => {
    return ipcRenderer.invoke(IpcChannel.LoadLocalVideoLibraries);
  },
  rescan: () => {
    return ipcRenderer.invoke(IpcChannel.RescanLocalVideoFolders);
  },
  removeFolder: (libraryId: string) => {
    return ipcRenderer.invoke(IpcChannel.RemoveLocalVideoFolder, libraryId);
  },
  getSubtitles: (input: LocalVideoSubtitleInput) => {
    return ipcRenderer.invoke(IpcChannel.GetLocalVideoSubtitles, input);
  },
  cancelScan: () => {
    return ipcRenderer.invoke(IpcChannel.CancelLocalVideoScan);
  },
  onScanProgress: (listener: (progress: LocalVideoScanProgress) => void) => {
    const handler = (
      _event: IpcRendererEvent,
      progress: LocalVideoScanProgress,
    ) => {
      listener(progress);
    };

    ipcRenderer.on(IpcChannel.LocalVideoScanProgress, handler);

    return () => {
      ipcRenderer.removeListener(IpcChannel.LocalVideoScanProgress, handler);
    };
  },
};

const desktopApi = Object.freeze<DesktopApi>({
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke(IpcChannel.GetAppInfo),
  windowControls,
  settings,
  appearance,
  connections,
  drive,
  localVideo,
  restartApp: () => {
    ipcRenderer.send(IpcChannel.RestartApp);
  },
});

// Expose a narrow, typed API instead of the raw ipcRenderer object.
contextBridge.exposeInMainWorld('desktop', desktopApi);
