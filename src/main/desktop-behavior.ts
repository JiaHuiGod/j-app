import { app, Notification } from 'electron';
import type {
  DesktopBehaviorState,
  DesktopBehaviorUpdate,
  DesktopSettings,
} from '@shared/settings';
import { getAppIconPath } from './app-icon';
import {
  getDesktopSettings,
  markTrayTipShown,
  saveDesktopBehavior,
} from './settings/store';
import { parseDesktopBehaviorUpdate } from './settings/schema';

let trayTipInFlight = false;

function readWindowsLoginItem(startHidden: boolean) {
  return app.getLoginItemSettings({
    path: app.getPath('exe'),
    args: startHidden ? ['--hidden'] : [],
  });
}

function isWindowsAutoStartEnabled(startHidden: boolean): boolean {
  return readWindowsLoginItem(startHidden).openAtLogin;
}

function applyWindowsAutoStart(update: DesktopBehaviorUpdate): void {
  app.setLoginItemSettings({
    openAtLogin: update.startAtLogin,
    path: app.getPath('exe'),
    args: update.startHidden ? ['--hidden'] : [],
  });
}

export function canAutoStart(): boolean {
  return (
    app.isPackaged &&
    (process.platform === 'win32' || process.platform === 'darwin')
  );
}

function applyLoginItemSettings(update: DesktopBehaviorUpdate): void {
  if (!canAutoStart()) {
    return;
  }

  if (process.platform === 'win32') {
    applyWindowsAutoStart(update);
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: update.startAtLogin,
  });
}

export async function getDesktopBehaviorState(): Promise<DesktopBehaviorState> {
  const settings = await getDesktopSettings();
  const supported = canAutoStart();
  const startAtLogin = supported
    ? process.platform === 'win32'
      ? isWindowsAutoStartEnabled(settings.startHidden)
      : app.getLoginItemSettings().openAtLogin
    : false;

  return {
    closeToTray: settings.closeToTray,
    startAtLogin,
    startHidden: settings.startHidden,
    canAutoStart: supported,
  };
}

export async function saveDesktopBehaviorState(
  input: unknown,
): Promise<DesktopBehaviorState> {
  const update = parseDesktopBehaviorUpdate(input);

  if (update.startAtLogin && !canAutoStart()) {
    throw new Error('开机自动启动仅支持已安装的 Windows/macOS 版本。');
  }

  applyLoginItemSettings(update);

  if (
    process.platform === 'win32' &&
    update.startAtLogin &&
    !isWindowsAutoStartEnabled(update.startHidden)
  ) {
    throw new Error('Windows 未允许写入开机启动项，请检查系统启动应用设置。');
  }

  await saveDesktopBehavior(update);

  return getDesktopBehaviorState();
}

export function shouldStartHidden(settings: DesktopSettings): boolean {
  if (
    process.argv.includes('--hidden') ||
    app.commandLine.hasSwitch('hidden')
  ) {
    return true;
  }

  if (process.platform !== 'darwin') {
    return false;
  }

  return settings.startHidden && app.getLoginItemSettings().wasOpenedAtLogin;
}

export function showTrayTipOnce(onClick: () => void): void {
  if (trayTipInFlight) {
    return;
  }

  trayTipInFlight = true;

  void getDesktopSettings()
    .then((settings) => {
      if (settings.trayTipShown || !Notification.isSupported()) {
        return;
      }

      const notification = new Notification({
        title: 'J App 仍在后台运行',
        body: '点击任务栏托盘图标可以重新打开。',
        icon: getAppIconPath(),
      });

      notification.on('click', onClick);
      notification.show();
      void markTrayTipShown();
    })
    .catch((error: unknown) => {
      console.error('Failed to show tray tip:', error);
    })
    .finally(() => {
      trayTipInFlight = false;
    });
}
