import path from 'node:path';
import { app, BrowserWindow, screen, shell } from 'electron';
import { IpcChannel } from '@shared/ipc';
import type { WindowStateSettings } from '@shared/settings';
import { DEFAULT_WINDOW_STATE } from '@shared/settings';
import { getWindowBackgroundColor } from './appearance/theme';
import { getWindowState, saveWindowState } from './settings/store';
import {
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  resolveWindowBounds,
  type WindowBounds,
  type WindowDisplay,
} from './window-state';

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
const WINDOW_STATE_DEBOUNCE_MS = 350;
const FALLBACK_WINDOW_STATE: WindowStateSettings = DEFAULT_WINDOW_STATE;

let mainWindow: BrowserWindow | null = null;
let pendingMainWindow: Promise<BrowserWindow> | null = null;

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

/**
 * Chromium's Windows frame/shadow compensation can make a newly constructed
 * window slightly larger than the requested bounds, and applying setBounds can
 * still leave a small residual. Correct against the actual bounds so a saved
 * size is stable across restarts instead of growing each launch.
 */
function setExactWindowBounds(
  browserWindow: BrowserWindow,
  target: WindowBounds,
): void {
  browserWindow.setBounds(target);
  let actual = browserWindow.getBounds();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const widthDelta = actual.width - target.width;
    const heightDelta = actual.height - target.height;

    if (widthDelta === 0 && heightDelta === 0) {
      return;
    }

    browserWindow.setBounds({
      x: target.x,
      y: target.y,
      width: target.width - widthDelta,
      height: target.height - heightDelta,
    });
    actual = browserWindow.getBounds();
  }
}

function bindWindowPersistence(browserWindow: BrowserWindow): void {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let isClosing = false;

  const clearSaveTimer = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  };

  const persist = async (): Promise<void> => {
    if (
      browserWindow.isDestroyed() ||
      browserWindow.isMinimized() ||
      browserWindow.isFullScreen()
    ) {
      return;
    }

    const bounds = browserWindow.getNormalBounds();

    try {
      await saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        maximized: browserWindow.isMaximized(),
      });
    } catch (error) {
      console.error('Failed to save window state:', error);
    }
  };

  const scheduleSave = () => {
    clearSaveTimer();
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void persist();
    }, WINDOW_STATE_DEBOUNCE_MS);
  };

  browserWindow.on('move', scheduleSave);
  browserWindow.on('resize', scheduleSave);
  browserWindow.on('maximize', scheduleSave);
  browserWindow.on('unmaximize', scheduleSave);
  browserWindow.on('close', (event) => {
    if (isClosing) {
      return;
    }

    event.preventDefault();
    isClosing = true;
    clearSaveTimer();

    // Persist before shutting down so a resize immediately followed by close
    // is not lost while the async settings write is still pending.
    void persist().finally(() => {
      if (!browserWindow.isDestroyed()) {
        browserWindow.close();
      }
    });
  });
  browserWindow.on('closed', clearSaveTimer);
}

function getDisplaySnapshot(): {
  displays: readonly WindowDisplay[];
  primary: WindowDisplay;
} {
  return {
    displays: screen.getAllDisplays().map((display) => ({
      workArea: display.workArea,
    })),
    primary: {
      workArea: screen.getPrimaryDisplay().workArea,
    },
  };
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

async function buildMainWindow(): Promise<BrowserWindow> {
  const storedState = await getWindowState().catch(() => null);
  const state = storedState ?? FALLBACK_WINDOW_STATE;
  const { displays, primary } = getDisplaySnapshot();
  const bounds = resolveWindowBounds(state, displays, primary);
  const browserWindow = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
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
  bindWindowPersistence(browserWindow);
  setExactWindowBounds(browserWindow, bounds);

  if (state.maximized) {
    browserWindow.maximize();
  }

  browserWindow.once('ready-to-show', () => {
    browserWindow.show();

    // Hidden windows can report a different frame compensation than visible
    // ones. Re-apply the target after showing so the first persisted state is
    // already the final size instead of one pixel off.
    if (!state.maximized) {
      setExactWindowBounds(browserWindow, bounds);

      // The first show can trigger one more native frame adjustment after the
      // current task. Re-check shortly after showing so the initial settings
      // readout and the first persisted state match the requested size.
      setTimeout(() => {
        if (
          !browserWindow.isDestroyed() &&
          !browserWindow.isMaximized() &&
          !browserWindow.isFullScreen()
        ) {
          setExactWindowBounds(browserWindow, bounds);
        }
      }, 50);
    }

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

export function createMainWindow(): Promise<BrowserWindow> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    focusMainWindow();
    return Promise.resolve(mainWindow);
  }

  if (!pendingMainWindow) {
    pendingMainWindow = buildMainWindow().finally(() => {
      pendingMainWindow = null;
    });
  }

  return pendingMainWindow;
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
