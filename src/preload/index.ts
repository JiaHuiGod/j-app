import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IpcChannel, type DesktopApi, type WindowControls } from '@shared/ipc';

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

const desktopApi = Object.freeze<DesktopApi>({
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke(IpcChannel.GetAppInfo),
  windowControls,
});

// Expose a narrow, typed API instead of the raw ipcRenderer object.
contextBridge.exposeInMainWorld('desktop', desktopApi);
