import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppearanceState } from '@shared/appearance';
import type { SiteConnectionSummary } from '@shared/connections';
import type { DriveAccount, DriveListing } from '@shared/drive';
import type {
  AppearanceApi,
  AppInfo,
  ConnectionsApi,
  DesktopApi,
  DriveApi,
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

const appearanceState: AppearanceState = {
  preference: 'system',
  resolved: 'light',
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

const presetConnection: SiteConnectionSummary = {
  id: '2c9c0f1e-3f4a-4f0e-9f6a-1b2c3d4e5f60',
  name: 'GitLab',
  loginUrl: 'https://gitlab.com/users/sign_in',
  createdAt: '2026-10-21T03:00:00.000Z',
  lastLoginAt: null,
  cookieCount: 0,
  status: 'empty',
};

const driveAccount: DriveAccount = {
  connectionId: '0f2a63a7-0a9f-4b0a-9d0b-6b8e1c1a2f5d',
  name: '115 网盘',
  loginUrl: 'https://115.com/storage/allfiles?cid=0&mode=wangpan',
  provider: '115',
  status: 'connected',
  cookieCount: 3,
};

const driveRootListing: DriveListing = {
  accountId: driveAccount.connectionId,
  folderId: '0',
  breadcrumbs: [{ id: '0', name: '根目录' }],
  entries: [
    {
      id: '10',
      parentId: '0',
      name: '电影',
      kind: 'folder',
      size: null,
      modifiedAt: '2026-10-21T10:00:00.000Z',
      extension: null,
      durationSeconds: null,
    },
    {
      id: '20',
      parentId: '0',
      name: 'readme.txt',
      kind: 'file',
      size: 1024,
      modifiedAt: '2026-10-21T09:00:00.000Z',
      extension: 'txt',
      durationSeconds: null,
    },
  ],
  offset: 0,
  limit: 100,
  total: 2,
  hasMore: false,
};

const driveChildListing: DriveListing = {
  accountId: driveAccount.connectionId,
  folderId: '10',
  breadcrumbs: [
    { id: '0', name: '根目录' },
    { id: '10', name: '电影' },
  ],
  entries: [
    {
      id: '11',
      parentId: '10',
      name: '电影里的文件.txt',
      kind: 'file',
      size: 2048,
      modifiedAt: '2026-10-21T11:00:00.000Z',
      extension: 'txt',
      durationSeconds: null,
    },
  ],
  offset: 0,
  limit: 100,
  total: 1,
  hasMore: false,
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
let createPresetConnection: ReturnType<
  typeof vi.fn<ConnectionsApi['createPreset']>
>;
let loginConnection: ReturnType<typeof vi.fn<ConnectionsApi['login']>>;
let removeConnection: ReturnType<typeof vi.fn<ConnectionsApi['remove']>>;
let clearAllConnections: ReturnType<typeof vi.fn<ConnectionsApi['clearAll']>>;
let listDriveAccounts: ReturnType<typeof vi.fn<DriveApi['listAccounts']>>;
let listDriveFolder: ReturnType<typeof vi.fn<DriveApi['listFolder']>>;
let searchDriveFolder: ReturnType<typeof vi.fn<DriveApi['searchFolder']>>;
let getAppearance: ReturnType<typeof vi.fn<AppearanceApi['get']>>;
let setAppearanceTheme: ReturnType<typeof vi.fn<AppearanceApi['setTheme']>>;

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
  createPresetConnection = vi
    .fn<ConnectionsApi['createPreset']>()
    .mockResolvedValue(presetConnection);
  loginConnection = vi
    .fn<ConnectionsApi['login']>()
    .mockResolvedValue(siteConnection);
  removeConnection = vi
    .fn<ConnectionsApi['remove']>()
    .mockResolvedValue(undefined);
  clearAllConnections = vi
    .fn<ConnectionsApi['clearAll']>()
    .mockResolvedValue(1);
  listDriveAccounts = vi
    .fn<DriveApi['listAccounts']>()
    .mockResolvedValue({ ok: true, data: [] });
  listDriveFolder = vi
    .fn<DriveApi['listFolder']>()
    .mockResolvedValue({ ok: true, data: driveRootListing });
  searchDriveFolder = vi.fn<DriveApi['searchFolder']>().mockResolvedValue({
    ok: true,
    data: {
      query: '',
      entries: [],
      offset: 0,
      limit: 100,
      total: 0,
      hasMore: false,
    },
  });
  getAppearance = vi
    .fn<AppearanceApi['get']>()
    .mockResolvedValue(appearanceState);
  setAppearanceTheme = vi
    .fn<AppearanceApi['setTheme']>()
    .mockImplementation(async (theme) => ({
      preference: theme,
      resolved: theme === 'dark' ? 'dark' : 'light',
    }));

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
    createPreset: createPresetConnection,
    login: loginConnection,
    remove: removeConnection,
    clearAll: clearAllConnections,
  };
  const drive: DriveApi = {
    listAccounts: listDriveAccounts,
    listFolder: listDriveFolder,
    searchFolder: searchDriveFolder,
  };
  const appearance: AppearanceApi = {
    get: getAppearance,
    setTheme: setAppearanceTheme,
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
    appearance,
    connections,
    drive,
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
      await screen.findByRole('heading', { level: 1, name: '115 网盘' }),
    ).toBeDefined();
    expect(await screen.findByText('未检测到 115 账号')).toBeDefined();
    expect(driveButton.getAttribute('aria-current')).toBe('page');

    fireEvent.click(screen.getByRole('button', { name: '前往设置' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /设置/,
      }),
    ).toBeDefined();
    expect(await screen.findByText('还没有保存的站点')).toBeDefined();
    expect(listConnections).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: '概览' }));

    expect(
      screen.getByRole('heading', { level: 1, name: /构建可靠的桌面应用/ }),
    ).toBeDefined();
  });

  it('lists 115 files and opens a folder on double click', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockImplementation(async (input) => ({
      ok: true,
      data: input.folderId === '10' ? driveChildListing : driveRootListing,
    }));

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    expect(await screen.findByText('电影')).toBeDefined();
    expect(listDriveFolder).toHaveBeenNthCalledWith(1, {
      connectionId: driveAccount.connectionId,
      folderId: '0',
      offset: 0,
      limit: 100,
    });

    fireEvent.doubleClick(screen.getByText('电影'));

    expect(await screen.findByText('电影里的文件.txt')).toBeDefined();
    expect(listDriveFolder).toHaveBeenNthCalledWith(2, {
      connectionId: driveAccount.connectionId,
      folderId: '10',
      offset: 0,
      limit: 100,
    });
  });

  it('keeps the current folder when leaving and returning to drive', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockImplementation(async (input) => ({
      ok: true,
      data: input.folderId === '10' ? driveChildListing : driveRootListing,
    }));

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');
    fireEvent.doubleClick(screen.getByText('电影'));
    await screen.findByText('电影里的文件.txt');

    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    await screen.findByRole('heading', { level: 1, name: /设置/ });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '115 网盘' }),
    ).toBeDefined();
    expect(screen.getByText('电影里的文件.txt')).toBeDefined();
    expect(listDriveFolder).toHaveBeenCalledTimes(2);
  });

  it('reuses a recently visited folder from memory', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockImplementation(async (input) => ({
      ok: true,
      data: input.folderId === '10' ? driveChildListing : driveRootListing,
    }));

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');
    fireEvent.doubleClick(screen.getByText('电影'));
    await screen.findByText('电影里的文件.txt');

    fireEvent.click(screen.getByRole('button', { name: '根目录' }));

    expect(await screen.findByText('电影')).toBeDefined();
    expect(listDriveFolder).toHaveBeenCalledTimes(2);
  });

  it('searches only inside the current 115 folder', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    searchDriveFolder.mockResolvedValue({
      ok: true,
      data: {
        query: '季度',
        entries: [
          {
            id: '30',
            parentId: '0',
            name: '季度总结.md',
            kind: 'file',
            size: 4096,
            modifiedAt: '2026-10-21T12:00:00.000Z',
            extension: 'md',
            durationSeconds: null,
          },
        ],
        offset: 0,
        limit: 100,
        total: 1,
        hasMore: false,
      },
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');

    fireEvent.change(screen.getByLabelText('搜索当前目录'), {
      target: { value: '季度' },
    });
    fireEvent.submit(screen.getByRole('form', { name: '115 网盘搜索' }));

    expect(await screen.findByText('季度总结.md')).toBeDefined();
    expect(searchDriveFolder).toHaveBeenCalledWith({
      connectionId: driveAccount.connectionId,
      folderId: '0',
      query: '季度',
      offset: 0,
      limit: 100,
    });
    expect(await screen.findByText(/在“根目录”中搜索“季度”/)).toBeDefined();
  });

  it('shows a relogin action when the 115 session has expired', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockResolvedValue({
      ok: false,
      error: {
        code: 'auth_required',
        message: '115 登录已失效，请重新登录。',
      },
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));

    expect(
      await screen.findByRole('heading', { name: '115 登录已失效' }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '登录 115' }));

    expect(loginConnection).toHaveBeenCalledWith(driveAccount.connectionId);
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
    fireEvent.click(screen.getByRole('button', { name: '保存并登录' }));

    expect(await screen.findByText('GitHub')).toBeDefined();
    expect(createConnection).toHaveBeenCalledWith({
      name: 'GitHub',
      loginUrl: 'https://github.com/login',
    });
    expect(createPresetConnection).not.toHaveBeenCalled();
    expect(screen.getByText('已保存')).toBeDefined();
    expect(screen.getByText(/2 个 Cookie/)).toBeDefined();
  });

  it('saves a site preset without starting the login flow', async () => {
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
      target: { value: 'GitLab' },
    });
    fireEvent.change(screen.getByLabelText('登录地址'), {
      target: { value: 'https://gitlab.com/users/sign_in' },
    });
    fireEvent.click(screen.getByRole('button', { name: '仅保存站点' }));

    expect(await screen.findByText('GitLab')).toBeDefined();
    expect(createPresetConnection).toHaveBeenCalledWith({
      name: 'GitLab',
      loginUrl: 'https://gitlab.com/users/sign_in',
    });
    expect(createConnection).not.toHaveBeenCalled();
    expect(screen.getByText('待登录')).toBeDefined();
    expect(screen.getByRole('button', { name: '登录' })).toBeDefined();
    expect(screen.queryByText('已保存')).toBeNull();
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

  it('changes the appearance theme from the settings page', async () => {
    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '设置' }));

    const darkOption = await screen.findByRole('radio', {
      name: /深色/,
    });
    fireEvent.click(darkOption);

    expect(setAppearanceTheme).toHaveBeenCalledWith('dark');
    expect(
      await screen.findByRole('radio', { name: /深色/, checked: true }),
    ).toBeDefined();
  });
});
