import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteConnectionSummary } from '@shared/connections';
import type {
  AppInfo,
  ConnectionsApi,
  DesktopApi,
  SettingsApi,
} from '@shared/ipc';
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

const siteConnection: SiteConnectionSummary = {
  id: '0f2a63a7-0a9f-4b0a-9d0b-6b8e1c1a2f5d',
  name: 'GitHub',
  loginUrl: 'https://github.com/login',
  createdAt: '2026-10-21T02:00:00.000Z',
  lastLoginAt: '2026-10-21T02:10:00.000Z',
  cookieCount: 2,
  status: 'connected',
};

let getAppInfo: ReturnType<typeof vi.fn<() => Promise<AppInfo>>>;
let getProxy: ReturnType<typeof vi.fn<() => Promise<ProxySettings>>>;
let saveProxy: ReturnType<
  typeof vi.fn<(settings: ProxySettings) => Promise<void>>
>;
let toggleMaximize: ReturnType<typeof vi.fn<() => void>>;
let restartApp: ReturnType<typeof vi.fn<() => void>>;
let listConnections: ReturnType<typeof vi.fn<ConnectionsApi['list']>>;
let createConnection: ReturnType<typeof vi.fn<ConnectionsApi['create']>>;
let loginConnection: ReturnType<typeof vi.fn<ConnectionsApi['login']>>;
let removeConnection: ReturnType<typeof vi.fn<ConnectionsApi['remove']>>;
let clearAllConnections: ReturnType<typeof vi.fn<ConnectionsApi['clearAll']>>;

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
  listConnections = vi.fn<ConnectionsApi['list']>().mockResolvedValue([]);
  createConnection = vi
    .fn<ConnectionsApi['create']>()
    .mockResolvedValue(siteConnection);
  loginConnection = vi
    .fn<ConnectionsApi['login']>()
    .mockResolvedValue(siteConnection);
  removeConnection = vi
    .fn<ConnectionsApi['remove']>()
    .mockResolvedValue(undefined);
  clearAllConnections = vi
    .fn<ConnectionsApi['clearAll']>()
    .mockResolvedValue(1);

  const settings: SettingsApi = {
    getProxy,
    saveProxy,
    testProxy: vi.fn<SettingsApi['testProxy']>().mockResolvedValue({
      ok: true,
      testedAt: new Date().toISOString(),
      results: [],
    }),
  };
  const connections: ConnectionsApi = {
    list: listConnections,
    create: createConnection,
    login: loginConnection,
    remove: removeConnection,
    clearAll: clearAllConnections,
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
    connections,
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

  it('navigates between overview, drive, and settings pages', async () => {
    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    const driveButton = screen.getByRole('button', { name: '网盘' });
    fireEvent.click(driveButton);

    expect(
      screen.getByRole('heading', { level: 1, name: /把文件/ }),
    ).toBeDefined();
    expect(screen.getByText('网盘工作区正在搭建')).toBeDefined();
    expect(driveButton.getAttribute('aria-current')).toBe('page');

    fireEvent.click(screen.getByRole('button', { name: '设置' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /账号与连接/,
      }),
    ).toBeDefined();
    expect(await screen.findByText('还没有保存的站点')).toBeDefined();
    expect(listConnections).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: '概览' }));

    expect(
      screen.getByRole('heading', { level: 1, name: /构建可靠的桌面应用/ }),
    ).toBeDefined();
  });

  it('adds a site connection from the settings page', async () => {
    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    await screen.findByText('还没有保存的站点');

    fireEvent.click(screen.getByRole('button', { name: '添加站点' }));

    expect(
      await screen.findByRole('dialog', { name: '添加站点' }),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText('站点名称'), {
      target: { value: 'GitHub' },
    });
    fireEvent.change(screen.getByLabelText('登录地址'), {
      target: { value: 'https://github.com/login' },
    });
    fireEvent.click(screen.getByRole('button', { name: '打开登录窗口' }));

    expect(await screen.findByText('GitHub')).toBeDefined();
    expect(createConnection).toHaveBeenCalledWith({
      name: 'GitHub',
      loginUrl: 'https://github.com/login',
    });
    expect(screen.getByText('已保存')).toBeDefined();
    expect(screen.getByText(/2 个 Cookie/)).toBeDefined();
  });

  it('reopens and removes an existing site connection', async () => {
    listConnections.mockResolvedValue([siteConnection]);
    loginConnection.mockResolvedValue({
      ...siteConnection,
      cookieCount: 3,
      lastLoginAt: '2026-10-21T02:20:00.000Z',
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    expect(await screen.findByText('GitHub')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '重新登录' }));

    expect(loginConnection).toHaveBeenCalledWith(siteConnection.id);
    expect(await screen.findByText(/3 个 Cookie/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '移除' }));
    fireEvent.click(screen.getByRole('button', { name: '确认移除' }));

    expect(await screen.findByText('还没有保存的站点')).toBeDefined();
    expect(removeConnection).toHaveBeenCalledWith(siteConnection.id);
  });

  it('clears all site data after an explicit confirmation', async () => {
    listConnections.mockResolvedValue([siteConnection]);

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    expect(await screen.findByText('GitHub')).toBeDefined();
    expect(screen.getByText('站点越多，资源占用越高')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '清理全部' }));

    expect(
      await screen.findByRole('dialog', {
        name: '清理全部站点数据',
      }),
    ).toBeDefined();
    expect(screen.getByText('1 个站点')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '清除全部站点' }));

    expect(await screen.findByText('还没有保存的站点')).toBeDefined();
    expect(clearAllConnections).toHaveBeenCalledOnce();
    expect(screen.queryByText('GitHub')).toBeNull();
  });
});
