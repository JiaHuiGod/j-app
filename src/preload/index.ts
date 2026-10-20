import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ThemePreference } from '@shared/appearance';
import type { CreateSiteConnectionInput } from '@shared/connections';
import {
  IpcChannel,
  type AppearanceApi,
  type ConnectionsApi,
  type DesktopApi,
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

const desktopApi = Object.freeze<DesktopApi>({
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke(IpcChannel.GetAppInfo),
  windowControls,
  settings,
  appearance,
  connections,
  restartApp: () => {
    ipcRenderer.send(IpcChannel.RestartApp);
  },
});

// Expose a narrow, typed API instead of the raw ipcRenderer object.
contextBridge.exposeInMainWorld('desktop', desktopApi);
