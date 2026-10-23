import { Menu, nativeImage, Tray } from 'electron';
import type { AppNavigationTarget } from '@shared/ipc';
import { getAppIconPath } from './app-icon';
import {
  getMainWindow,
  hideMainWindow,
  navigateMainWindow,
  showMainWindow,
} from './window';
import {
  checkForAppUpdates,
  getUpdateState,
  installUpdate,
  onUpdateStateChange,
} from './updates/manager';

interface TrayHandlers {
  readonly onQuit: () => void;
}

let tray: Tray | null = null;
let handlers: TrayHandlers | null = null;
let unsubscribeUpdates: (() => void) | null = null;

function isWindowVisible(): boolean {
  const window = getMainWindow();
  return window?.isVisible() ?? false;
}

function showWindow(): void {
  void showMainWindow();
}

function openPage(page: AppNavigationTarget): void {
  void showMainWindow().then(() => {
    navigateMainWindow(page);
  });
}

export function refreshTrayMenu(): void {
  if (!tray || !handlers) {
    return;
  }

  const visible = isWindowVisible();
  const updateState = getUpdateState();
  const updateItem =
    updateState.status === 'downloaded'
      ? {
          label: updateState.availableVersion
            ? `重启并安装 ${updateState.availableVersion}`
            : '重启并安装更新',
          click: () => {
            void installUpdate().catch((error: unknown) => {
              console.error('Failed to install update:', error);
            });
          },
        }
      : {
          label:
            updateState.status === 'checking'
              ? '正在检查更新…'
              : updateState.status === 'downloading'
                ? '正在下载更新…'
                : updateState.supported
                  ? '检查更新'
                  : '检查更新（仅安装版支持）',
          enabled:
            updateState.supported &&
            updateState.status !== 'checking' &&
            updateState.status !== 'downloading',
          click: () => {
            void checkForAppUpdates();
          },
        };

  const menu = Menu.buildFromTemplate([
    {
      label: visible ? '隐藏到托盘' : '显示 J App',
      click: () => {
        if (visible) {
          hideMainWindow();
          refreshTrayMenu();
        } else {
          showWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: '打开本地视频',
      click: () => {
        openPage('local');
      },
    },
    {
      label: '打开设置',
      click: () => {
        openPage('settings');
      },
    },
    { type: 'separator' },
    updateItem,
    { type: 'separator' },
    {
      label: '退出 J App',
      click: () => {
        handlers?.onQuit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

export function createAppTray(trayHandlers: TrayHandlers): boolean {
  if (tray) {
    return true;
  }

  handlers = trayHandlers;
  const image = nativeImage.createFromPath(getAppIconPath());

  if (image.isEmpty()) {
    console.error('Failed to load tray icon:', getAppIconPath());
    return false;
  }

  tray = new Tray(
    image.resize({
      width: process.platform === 'darwin' ? 18 : 16,
      height: process.platform === 'darwin' ? 18 : 16,
    }),
  );
  tray.setToolTip('J App');
  tray.on('click', showWindow);
  unsubscribeUpdates = onUpdateStateChange(refreshTrayMenu);
  refreshTrayMenu();

  return true;
}

export function destroyAppTray(): void {
  unsubscribeUpdates?.();
  unsubscribeUpdates = null;
  tray?.destroy();
  tray = null;
  handlers = null;
}
