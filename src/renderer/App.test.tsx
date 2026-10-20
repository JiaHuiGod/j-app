import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppInfo, DesktopApi, SettingsApi } from '@shared/ipc';
import type { ProxySettings } from '@shared/settings';
import App from './App';

const appInfo: AppInfo = {
  appName: 'J App',
  appVersion: '0.1.0',
  electronVersion: '44.9.1',
  chromeVersion: '144.0.0.0',
  nodeVersion: '24.0.0',
  platform: 'win32',
  arch: 'x64',
  isPackaged: false,
};

const proxySettings: ProxySettings = {
  enabled: true,
  protocol: 'http',
  host: '127.0.0.1',
  port: 7890,
};

let getAppInfo: ReturnType<typeof vi.fn<() => Promise<AppInfo>>>;
let getProxy: ReturnType<typeof vi.fn<() => Promise<ProxySettings>>>;
let saveProxy: ReturnType<
  typeof vi.fn<(settings: ProxySettings) => Promise<void>>
>;
let toggleMaximize: ReturnType<typeof vi.fn<() => void>>;
let restartApp: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  getAppInfo = vi.fn<() => Promise<AppInfo>>().mockResolvedValue(appInfo);
  getProxy = vi
    .fn<() => Promise<ProxySettings>>()
    .mockResolvedValue(proxySettings);
  saveProxy = vi
    .fn<(settings: ProxySettings) => Promise<void>>()
    .mockResolvedValue(undefined);
  toggleMaximize = vi.fn<() => void>();
  restartApp = vi.fn<() => void>();

  const settings: SettingsApi = {
    getProxy,
    saveProxy,
    testProxy: vi.fn<SettingsApi['testProxy']>().mockResolvedValue({
      ok: true,
      testedAt: new Date().toISOString(),
      results: [],
    }),
  };
  const windowControls: DesktopApi['windowControls'] = {
    minimize: vi.fn<() => void>(),
    toggleMaximize,
    close: vi.fn<() => void>(),
    isMaximized: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
    onMaximizedChange: vi
      .fn<(listener: (isMaximized: boolean) => void) => () => void>()
      .mockReturnValue(() => {}),
  };
  const desktopApi: DesktopApi = {
    platform: 'win32',
    getAppInfo,
    windowControls,
    settings,
    restartApp,
  };

  Object.defineProperty(window, 'desktop', {
    configurable: true,
    value: desktopApi,
  });
});

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('renders the window chrome and reads app info through the preload API', async () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: /构建可靠的桌面应用/ }),
    ).toBeDefined();
    expect(screen.getByText('概览')).toBeDefined();
    expect(await screen.findByText(appInfo.electronVersion)).toBeDefined();
    expect(screen.getByText('Preload bridge 已连接')).toBeDefined();
    expect(
      await screen.findByRole('button', {
        name: '网络代理，当前已开启',
      }),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '最大化' }));

    expect(toggleMaximize).toHaveBeenCalledOnce();
    expect(getAppInfo).toHaveBeenCalledOnce();
    expect(getProxy).toHaveBeenCalledOnce();
  });

  it('loads and saves proxy settings from the title bar dialog', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /网络代理/ }));

    expect(
      await screen.findByRole('dialog', { name: '网络代理' }),
    ).toBeDefined();
    expect(await screen.findByDisplayValue('127.0.0.1')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '保存设置' }));

    expect(await screen.findByText('自定义代理已开启')).toBeDefined();
    expect(saveProxy).toHaveBeenCalledWith(proxySettings);
    expect(getProxy).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: '立即重启' }));

    expect(restartApp).toHaveBeenCalledOnce();
  });
});
