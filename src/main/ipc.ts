import { app, BrowserWindow, ipcMain } from 'electron';
import { IpcChannel, type AppInfo } from '@shared/ipc';

function getAppInfo(): AppInfo {
  return {
    appName: app.getName(),
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
  };
}

function getSenderWindow(sender: Electron.WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(sender);
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.GetAppInfo, getAppInfo);
  ipcMain.handle(IpcChannel.WindowIsMaximized, (event) => {
    return getSenderWindow(event.sender)?.isMaximized() ?? false;
  });

  ipcMain.on(IpcChannel.WindowMinimize, (event) => {
    getSenderWindow(event.sender)?.minimize();
  });

  ipcMain.on(IpcChannel.WindowToggleMaximize, (event) => {
    const browserWindow = getSenderWindow(event.sender);

    if (!browserWindow) {
      return;
    }

    if (browserWindow.isMaximized()) {
      browserWindow.unmaximize();
    } else {
      browserWindow.maximize();
    }
  });

  ipcMain.on(IpcChannel.WindowClose, (event) => {
    getSenderWindow(event.sender)?.close();
  });
}
