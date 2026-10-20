import path from 'node:path';
import { app, BrowserWindow, shell } from 'electron';
import { IpcChannel } from '@shared/ipc';
import { getWindowBackgroundColor } from './appearance/theme';

const WINDOW_ICON = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(__dirname, '../../resources/icon.png');
const WINDOW_CHROME =
  process.platform === 'darwin'
    ? {
        titleBarStyle: 'hiddenInset' as const,
        trafficLightPosition: { x: 16, y: 18 },
      }
    : { frame: false };

let mainWindow: BrowserWindow | null = null;

function openExternalLink(rawUrl: string): void {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') {
      return;
    }

    void shell.openExternal(url.toString()).catch((error: unknown) => {
      console.error('Failed to open external link:', error);
    });
  } catch {
    // Malformed URLs are ignored instead of being passed to the OS.
  }
}

function isInternalNavigation(currentUrl: string, targetUrl: string): boolean {
  try {
    const current = new URL(currentUrl);
    const target = new URL(targetUrl);

    if (current.protocol === 'file:') {
      return (
        target.protocol === 'file:' && target.pathname === current.pathname
      );
    }

    return target.origin === current.origin;
  } catch {
    return false;
  }
}

function secureWebContents(browserWindow: BrowserWindow): void {
  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalLink(url);
    return { action: 'deny' };
  });

  browserWindow.webContents.on('will-navigate', (event, url) => {
    if (isInternalNavigation(browserWindow.webContents.getURL(), url)) {
      return;
    }

    event.preventDefault();
    openExternalLink(url);
  });

  if (!app.isPackaged) {
    browserWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') {
        return;
      }

      const isDevToolsShortcut =
        input.key === 'F12' ||
        ((input.control || input.meta) &&
          (input.shift || input.alt) &&
          input.key.toLowerCase() === 'i');

      if (isDevToolsShortcut) {
        event.preventDefault();
        browserWindow.webContents.toggleDevTools();
      }
    });
  }
}

function bindWindowState(browserWindow: BrowserWindow): void {
  const publishMaximizedState = () => {
    if (browserWindow.isDestroyed()) {
      return;
    }

    browserWindow.webContents.send(
      IpcChannel.WindowMaximizedChanged,
      browserWindow.isMaximized(),
    );
  };

  browserWindow.on('maximize', publishMaximizedState);
  browserWindow.on('unmaximize', publishMaximizedState);
}

async function loadRenderer(browserWindow: BrowserWindow): Promise<void> {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await browserWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    return;
  }

  await browserWindow.loadFile(
    path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
  );
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    focusMainWindow();
    return mainWindow;
  }

  const browserWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: getWindowBackgroundColor(),
    title: 'J App',
    icon: WINDOW_ICON,
    ...WINDOW_CHROME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  mainWindow = browserWindow;
  secureWebContents(browserWindow);
  bindWindowState(browserWindow);

  browserWindow.once('ready-to-show', () => {
    browserWindow.show();

    if (!app.isPackaged) {
      // Detached DevTools keeps the custom window chrome at its real size.
      browserWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  browserWindow.on('closed', () => {
    if (mainWindow === browserWindow) {
      mainWindow = null;
    }
  });

  void loadRenderer(browserWindow).catch((error: unknown) => {
    console.error('Failed to load the renderer:', error);
  });

  return browserWindow;
}

export function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

export function getMainWindow(): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  return mainWindow;
}
