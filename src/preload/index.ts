import {
  contextBridge,
  ipcRenderer,
  webUtils,
  type IpcRendererEvent,
} from 'electron';
import type { ThemePreference } from '@shared/appearance';
import type { CreateSiteConnectionInput } from '@shared/connections';
import type {
  DriveCreateFolderInput,
  DriveDeleteInput,
  DriveListInput,
  DriveMoveInput,
  DriveRenameInput,
  DriveSearchInput,
  DriveUploadInput,
  DriveUploadProgress,
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
});

const desktopApi = Object.freeze<DesktopApi>({
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke(IpcChannel.GetAppInfo),
  windowControls,
  settings,
  appearance,
  connections,
  drive,
  restartApp: () => {
    ipcRenderer.send(IpcChannel.RestartApp);
  },
});

// Expose a narrow, typed API instead of the raw ipcRenderer object.
contextBridge.exposeInMainWorld('desktop', desktopApi);
