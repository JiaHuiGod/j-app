import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { IpcChannel, type AppInfo } from '@shared/ipc';
import { getAppearanceState, setAppearanceTheme } from './appearance/theme';
import {
  clearAllSiteConnectionData,
  createSiteConnection,
  createSitePreset,
  listSiteConnections,
  loginSiteConnection,
  removeSiteConnectionData,
} from './connections/session-manager';
import { registerDriveIpcHandlers } from './drive/ipc';
import { testProxySettings } from './network/proxy';
import {
  getDownloadDirectory,
  getProxySettings,
  getSubtitleDirectory,
  saveDownloadDirectory,
  saveProxySettings,
  saveSubtitleDirectory,
} from './settings/store';

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
  ipcMain.handle(IpcChannel.GetProxySettings, () => getProxySettings());
  ipcMain.handle(
    IpcChannel.SaveProxySettings,
    async (_event, settings: unknown) => {
      await saveProxySettings(settings);
    },
  );
  ipcMain.handle(IpcChannel.TestProxySettings, (_event, settings: unknown) =>
    testProxySettings(settings),
  );
  ipcMain.handle(IpcChannel.GetDownloadDirectory, () => getDownloadDirectory());
  ipcMain.handle(IpcChannel.ChooseDownloadDirectory, async (event) => {
    const parent = getSenderWindow(event.sender);
    const options: Electron.OpenDialogOptions = {
      title: '选择默认下载目录',
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return saveDownloadDirectory(result.filePaths[0]);
  });
  ipcMain.handle(IpcChannel.ClearDownloadDirectory, async () => {
    await saveDownloadDirectory(null);
  });
  ipcMain.handle(IpcChannel.GetSubtitleDirectory, () => getSubtitleDirectory());
  ipcMain.handle(IpcChannel.ChooseSubtitleDirectory, async (event) => {
    const parent = getSenderWindow(event.sender);
    const options: Electron.OpenDialogOptions = {
      title: '选择字幕目录',
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return saveSubtitleDirectory(result.filePaths[0]);
  });
  ipcMain.handle(IpcChannel.ClearSubtitleDirectory, async () => {
    await saveSubtitleDirectory(null);
  });
  ipcMain.handle(IpcChannel.GetAppearance, () => getAppearanceState());
  ipcMain.handle(IpcChannel.SetAppearanceTheme, (_event, theme: unknown) =>
    setAppearanceTheme(theme),
  );
  ipcMain.handle(IpcChannel.ListSiteConnections, () => listSiteConnections());
  ipcMain.handle(IpcChannel.CreateSiteConnection, (_event, input: unknown) =>
    createSiteConnection(input),
  );
  ipcMain.handle(IpcChannel.CreateSitePreset, (_event, input: unknown) =>
    createSitePreset(input),
  );
  ipcMain.handle(
    IpcChannel.LoginSiteConnection,
    (_event, connectionId: unknown) => loginSiteConnection(connectionId),
  );
  ipcMain.handle(
    IpcChannel.RemoveSiteConnection,
    async (_event, connectionId: unknown) => {
      await removeSiteConnectionData(connectionId);
    },
  );
  ipcMain.handle(IpcChannel.ClearSiteConnections, () =>
    clearAllSiteConnectionData(),
  );
  registerDriveIpcHandlers();

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

  ipcMain.on(IpcChannel.RestartApp, () => {
    app.relaunch();
    app.exit(0);
  });
}
