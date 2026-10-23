import { Menu, nativeImage, Tray } from 'electron';
import type { AppNavigationTarget } from '@shared/ipc';
import { getAppIconPath } from './app-icon';
import {
  getMainWindow,
  hideMainWindow,
  navigateMainWindow,
  showMainWindow,
} from './window';

interface TrayHandlers {
  readonly onQuit: () => void;
}

let tray: Tray | null = null;
let handlers: TrayHandlers | null = null;

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
  refreshTrayMenu();

  return true;
}

export function destroyAppTray(): void {
  tray?.destroy();
  tray = null;
  handlers = null;
}
