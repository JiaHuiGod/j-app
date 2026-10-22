import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppearanceState } from '@shared/appearance';
import type { SiteConnectionSummary } from '@shared/connections';
import type {
  DriveAccount,
  DriveListing,
  DriveDownloadProgress,
} from '@shared/drive';
import type {
  AppearanceApi,
  AppInfo,
  ConnectionsApi,
  DesktopApi,
  DriveApi,
  SettingsApi,
} from '@shared/ipc';
import type { LocalVideoApi } from '@shared/local-video';
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
      pickcode: null,
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
      pickcode: null,
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
      pickcode: null,
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
let getDownloadDirectory: ReturnType<
  typeof vi.fn<SettingsApi['getDownloadDirectory']>
>;
let chooseDownloadDirectory: ReturnType<
  typeof vi.fn<SettingsApi['chooseDownloadDirectory']>
>;
let clearDownloadDirectory: ReturnType<
  typeof vi.fn<SettingsApi['clearDownloadDirectory']>
>;
let getSubtitleDirectory: ReturnType<
  typeof vi.fn<SettingsApi['getSubtitleDirectory']>
>;
let chooseSubtitleDirectory: ReturnType<
  typeof vi.fn<SettingsApi['chooseSubtitleDirectory']>
>;
let clearSubtitleDirectory: ReturnType<
  typeof vi.fn<SettingsApi['clearSubtitleDirectory']>
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
let createDriveFolder: ReturnType<typeof vi.fn<DriveApi['createFolder']>>;
let renameDriveEntry: ReturnType<typeof vi.fn<DriveApi['renameEntry']>>;
let deleteDriveEntry: ReturnType<typeof vi.fn<DriveApi['deleteEntry']>>;
let moveDriveEntry: ReturnType<typeof vi.fn<DriveApi['moveEntry']>>;
let uploadDriveFiles: ReturnType<typeof vi.fn<DriveApi['uploadFiles']>>;
let uploadDroppedDriveFiles: ReturnType<
  typeof vi.fn<DriveApi['uploadDroppedFiles']>
>;
let listOfflineTasks: ReturnType<typeof vi.fn<DriveApi['listOfflineTasks']>>;
let addOfflineTasks: ReturnType<typeof vi.fn<DriveApi['addOfflineTasks']>>;
let downloadDriveFile: ReturnType<typeof vi.fn<DriveApi['downloadFile']>>;
let cancelDriveDownload: ReturnType<typeof vi.fn<DriveApi['cancelDownload']>>;
let openDriveDownloadFolder: ReturnType<
  typeof vi.fn<DriveApi['openDownloadFolder']>
>;
let startDrivePlayback: ReturnType<typeof vi.fn<DriveApi['startPlayback']>>;
let stopDrivePlayback: ReturnType<typeof vi.fn<DriveApi['stopPlayback']>>;
let getDriveSubtitles: ReturnType<typeof vi.fn<DriveApi['getSubtitles']>>;
let onDriveDownloadProgress: ReturnType<
  typeof vi.fn<DriveApi['onDownloadProgress']>
>;
let onDriveUploadProgress: ReturnType<
  typeof vi.fn<DriveApi['onUploadProgress']>
>;
let getAppearance: ReturnType<typeof vi.fn<AppearanceApi['get']>>;
let setAppearanceTheme: ReturnType<typeof vi.fn<AppearanceApi['setTheme']>>;

beforeEach(() => {
  window.localStorage.clear();
  getAppInfo = vi.fn<() => Promise<AppInfo>>().mockResolvedValue(appInfo);
  getProxy = vi
    .fn<() => Promise<ProxySettings>>()
    .mockResolvedValue(proxySettings);
  saveProxy = vi
    .fn<(settings: ProxySettings) => Promise<void>>()
    .mockResolvedValue(undefined);
  getDownloadDirectory = vi
    .fn<SettingsApi['getDownloadDirectory']>()
    .mockResolvedValue(null);
  chooseDownloadDirectory = vi
    .fn<SettingsApi['chooseDownloadDirectory']>()
    .mockResolvedValue('C:\\Downloads');
  clearDownloadDirectory = vi
    .fn<SettingsApi['clearDownloadDirectory']>()
    .mockResolvedValue(undefined);
  getSubtitleDirectory = vi
    .fn<SettingsApi['getSubtitleDirectory']>()
    .mockResolvedValue(null);
  chooseSubtitleDirectory = vi
    .fn<SettingsApi['chooseSubtitleDirectory']>()
    .mockResolvedValue('D:\\Subtitles');
  clearSubtitleDirectory = vi
    .fn<SettingsApi['clearSubtitleDirectory']>()
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
  createDriveFolder = vi
    .fn<DriveApi['createFolder']>()
    .mockResolvedValue({ ok: true, data: null });
  renameDriveEntry = vi
    .fn<DriveApi['renameEntry']>()
    .mockResolvedValue({ ok: true, data: null });
  deleteDriveEntry = vi
    .fn<DriveApi['deleteEntry']>()
    .mockResolvedValue({ ok: true, data: null });
  moveDriveEntry = vi
    .fn<DriveApi['moveEntry']>()
    .mockResolvedValue({ ok: true, data: null });
  uploadDriveFiles = vi.fn<DriveApi['uploadFiles']>().mockResolvedValue({
    ok: true,
    data: {
      canceled: true,
      uploaded: 0,
      failed: 0,
      files: [],
    },
  });
  uploadDroppedDriveFiles = vi
    .fn<DriveApi['uploadDroppedFiles']>()
    .mockResolvedValue({
      ok: true,
      data: {
        canceled: true,
        uploaded: 0,
        failed: 0,
        files: [],
      },
    });
  listOfflineTasks = vi.fn<DriveApi['listOfflineTasks']>().mockResolvedValue({
    ok: true,
    data: {
      tasks: [],
      page: 1,
      pageCount: 1,
      total: 0,
    },
  });
  addOfflineTasks = vi.fn<DriveApi['addOfflineTasks']>().mockResolvedValue({
    ok: true,
    data: {
      successCount: 1,
      failedCount: 0,
      errors: [],
    },
  });
  downloadDriveFile = vi.fn<DriveApi['downloadFile']>().mockResolvedValue({
    ok: true,
    data: {
      canceled: true,
      fileName: 'movie.mp4',
      filePath: null,
      bytes: 0,
    },
  });
  cancelDriveDownload = vi
    .fn<DriveApi['cancelDownload']>()
    .mockResolvedValue({ ok: true, data: null });
  onDriveDownloadProgress = vi
    .fn<DriveApi['onDownloadProgress']>()
    .mockReturnValue(() => {});
  openDriveDownloadFolder = vi
    .fn<DriveApi['openDownloadFolder']>()
    .mockResolvedValue({ ok: true, data: null });
  startDrivePlayback = vi.fn<DriveApi['startPlayback']>().mockResolvedValue({
    ok: true,
    data: {
      sessionId: 'playback-session',
      playbackUrl: 'http://127.0.0.1:9999/p/playback-session/master.m3u8',
      width: 1920,
      height: 1080,
    },
  });
  stopDrivePlayback = vi
    .fn<DriveApi['stopPlayback']>()
    .mockResolvedValue({ ok: true, data: null });
  getDriveSubtitles = vi
    .fn<DriveApi['getSubtitles']>()
    .mockResolvedValue({ ok: true, data: [] });
  onDriveUploadProgress = vi
    .fn<DriveApi['onUploadProgress']>()
    .mockReturnValue(() => {});
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
    getDownloadDirectory,
    chooseDownloadDirectory,
    clearDownloadDirectory,
    getSubtitleDirectory,
    chooseSubtitleDirectory,
    clearSubtitleDirectory,
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
    createFolder: createDriveFolder,
    renameEntry: renameDriveEntry,
    deleteEntry: deleteDriveEntry,
    moveEntry: moveDriveEntry,
    uploadFiles: uploadDriveFiles,
    uploadDroppedFiles: uploadDroppedDriveFiles,
    listOfflineTasks,
    addOfflineTasks,
    downloadFile: downloadDriveFile,
    cancelDownload: cancelDriveDownload,
    openDownloadFolder: openDriveDownloadFolder,
    startPlayback: startDrivePlayback,
    stopPlayback: stopDrivePlayback,
    getSubtitles: getDriveSubtitles,
    onUploadProgress: onDriveUploadProgress,
    onDownloadProgress: onDriveDownloadProgress,
  };
  const appearance: AppearanceApi = {
    get: getAppearance,
    setTheme: setAppearanceTheme,
  };
  const localVideo: LocalVideoApi = {
    chooseFolders: vi
      .fn<LocalVideoApi['chooseFolders']>()
      .mockResolvedValue({ ok: true, data: null }),
    loadLibraries: vi.fn<LocalVideoApi['loadLibraries']>().mockResolvedValue({
      ok: true,
      data: { libraries: [], errors: [] },
    }),
    rescan: vi.fn<LocalVideoApi['rescan']>().mockResolvedValue({
      ok: true,
      data: { libraries: [], errors: [] },
    }),
    removeFolder: vi.fn<LocalVideoApi['removeFolder']>().mockResolvedValue({
      ok: true,
      data: { libraries: [], errors: [] },
    }),
    getSubtitles: vi
      .fn<LocalVideoApi['getSubtitles']>()
      .mockResolvedValue({ ok: true, data: [] }),
    cancelScan: vi
      .fn<LocalVideoApi['cancelScan']>()
      .mockResolvedValue(undefined),
    onScanProgress: vi
      .fn<LocalVideoApi['onScanProgress']>()
      .mockReturnValue(() => {}),
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
    localVideo,
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

  it('keeps the table header visible while a 115 folder is loading', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });

    let resolveFolder!: (
      value: Awaited<ReturnType<DriveApi['listFolder']>>,
    ) => void;
    listDriveFolder.mockReturnValue(
      new Promise((resolve) => {
        resolveFolder = resolve;
      }),
    );

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));

    expect(await screen.findByText('名称')).toBeDefined();
    expect(screen.getByText('大小')).toBeDefined();
    expect(screen.getByText('修改时间')).toBeDefined();

    await act(async () => {
      resolveFolder({ ok: true, data: driveRootListing });
    });

    expect(await screen.findByText('电影')).toBeDefined();
    expect(screen.getByText('名称')).toBeDefined();
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

  it('creates a folder in the current 115 directory', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');

    fireEvent.click(screen.getByRole('button', { name: '新建文件夹' }));
    fireEvent.change(await screen.findByLabelText('文件夹名称'), {
      target: { value: '新目录' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建文件夹' }));

    await waitFor(() => {
      expect(createDriveFolder).toHaveBeenCalledWith({
        connectionId: driveAccount.connectionId,
        parentId: '0',
        name: '新目录',
      });
    });
  });

  it('renames a selected 115 file', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    fireEvent.click(await screen.findByText('readme.txt'));
    fireEvent.click(screen.getByRole('button', { name: '重命名' }));

    fireEvent.change(await screen.findByLabelText('新名称'), {
      target: { value: 'notes.txt' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }));

    await waitFor(() => {
      expect(renameDriveEntry).toHaveBeenCalledWith({
        connectionId: driveAccount.connectionId,
        entryId: '20',
        kind: 'file',
        name: 'notes.txt',
      });
    });
  });

  it('deletes a selected 115 file after confirmation', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    fireEvent.click(await screen.findByText('readme.txt'));
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(deleteDriveEntry).toHaveBeenCalledWith({
        connectionId: driveAccount.connectionId,
        entries: [{ parentId: '0', entryId: '20' }],
      });
    });
  });

  it('moves a selected 115 file to the target folder', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    fireEvent.click(await screen.findByText('readme.txt'));
    fireEvent.click(screen.getByRole('button', { name: '移动' }));

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('电影');
    fireEvent.click(within(dialog).getByRole('button', { name: '移动到这里' }));

    await waitFor(() => {
      expect(moveDriveEntry).toHaveBeenCalledWith({
        connectionId: driveAccount.connectionId,
        entryIds: ['20'],
        targetFolderId: '0',
      });
    });
  });

  it('multi-selects with Ctrl and deletes the selected entries', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');

    fireEvent.click(screen.getByText('readme.txt'));
    fireEvent.click(screen.getByText('电影'), { ctrlKey: true });

    expect(screen.getByText('已选 2 项')).toBeDefined();
    expect(
      (screen.getByRole('button', { name: '重命名' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(deleteDriveEntry).toHaveBeenCalledWith({
        connectionId: driveAccount.connectionId,
        entries: [
          { parentId: '0', entryId: '10' },
          { parentId: '0', entryId: '20' },
        ],
      });
    });
  });

  it('starts an upload into the current 115 directory', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');
    fireEvent.click(screen.getByRole('button', { name: '上传' }));

    await waitFor(() => {
      expect(uploadDriveFiles).toHaveBeenCalledWith({
        connectionId: driveAccount.connectionId,
        targetFolderId: '0',
      });
    });
  });

  it('dismisses a fully successful upload report automatically', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    uploadDriveFiles.mockResolvedValue({
      ok: true,
      data: {
        canceled: false,
        uploaded: 1,
        failed: 0,
        files: [{ name: 'ok.txt', status: 'success' }],
      },
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');
    fireEvent.click(screen.getByRole('button', { name: '上传' }));

    expect(await screen.findByLabelText('上传进度')).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await waitFor(() => {
      expect(screen.queryByLabelText('上传进度')).toBeNull();
    });
  });

  it('keeps a successful upload report while the drive page is hidden', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    let resolveUpload!: (
      value: Awaited<ReturnType<DriveApi['uploadFiles']>>,
    ) => void;
    const uploadPromise = new Promise<
      Awaited<ReturnType<DriveApi['uploadFiles']>>
    >((resolve) => {
      resolveUpload = resolve;
    });
    uploadDriveFiles.mockReturnValue(uploadPromise);

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');
    fireEvent.click(screen.getByRole('button', { name: '上传' }));
    await screen.findByLabelText('上传进度');

    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    await screen.findByRole('heading', { level: 1, name: /设置/ });

    resolveUpload({
      ok: true,
      data: {
        canceled: false,
        uploaded: 1,
        failed: 0,
        files: [{ name: 'ok.txt', status: 'success' }],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    expect(await screen.findByLabelText('上传进度')).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 3000));
    await waitFor(() => {
      expect(screen.queryByLabelText('上传进度')).toBeNull();
    });
  }, 12_000);

  it('uploads files dropped onto the drive workspace', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const file = new File(['hello'], 'drop.txt', { type: 'text/plain' });
    const dataTransfer = {
      types: ['Files'],
      files: [file],
      items: [],
    } as unknown as DataTransfer;

    fireEvent.dragEnter(window, { dataTransfer });
    expect(await screen.findByText('松开以上传到当前目录')).toBeDefined();

    fireEvent.drop(window, { dataTransfer });

    await waitFor(() => {
      expect(uploadDroppedDriveFiles).toHaveBeenCalledWith(
        {
          connectionId: driveAccount.connectionId,
          targetFolderId: '0',
        },
        [file],
      );
    });
  });

  it('lists offline tasks and submits to a changed folder', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockImplementation(async (input) => ({
      ok: true,
      data: input.folderId === '10' ? driveChildListing : driveRootListing,
    }));
    listOfflineTasks.mockResolvedValue({
      ok: true,
      data: {
        tasks: [
          {
            id: 'history-1',
            name: 'History task',
            size: 4096,
            progress: 100,
            rate: 0,
            status: 'finished',
            statusText: '已完成',
            targetFolderId: '0',
            addedAt: null,
            sourceUrl: 'magnet:?xt=urn:btih:history',
          },
          {
            id: 'offline-1',
            name: 'Ubuntu image',
            size: 2048,
            progress: 43,
            rate: 1024,
            status: 'downloading',
            statusText: '下载中',
            targetFolderId: '0',
            addedAt: null,
            sourceUrl: 'magnet:?xt=urn:btih:test',
          },
        ],
        page: 1,
        pageCount: 1,
        total: 1,
      },
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');
    fireEvent.click(screen.getByRole('button', { name: '离线任务' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText('本次还没有提交离线任务。'),
    ).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: '更改目录' }));
    const picker = (await screen.findAllByRole('dialog')).at(-1);

    if (!picker) {
      throw new Error('folder picker did not open');
    }

    fireEvent.click(await within(picker).findByText('电影'));
    await waitFor(() => {
      expect(listDriveFolder).toHaveBeenLastCalledWith({
        connectionId: driveAccount.connectionId,
        folderId: '10',
        offset: 0,
        limit: 100,
      });
    });
    fireEvent.click(
      within(picker).getByRole('button', { name: '选择此文件夹' }),
    );

    fireEvent.change(within(dialog).getByLabelText('离线链接'), {
      target: { value: 'magnet:?xt=urn:btih:test' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: '提交离线任务' }),
    );

    await waitFor(() => {
      expect(addOfflineTasks).toHaveBeenCalledWith({
        connectionId: driveAccount.connectionId,
        folderId: '10',
        urls: ['magnet:?xt=urn:btih:test'],
      });
    });
    expect(await within(dialog).findByText('Ubuntu image')).toBeDefined();
    expect(within(dialog).queryByText('History task')).toBeNull();

    const folderCallsBeforeClose = listDriveFolder.mock.calls.length;
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));

    await waitFor(() => {
      expect(listDriveFolder.mock.calls.length).toBeGreaterThan(
        folderCallsBeforeClose,
      );
    });
  });

  it('shows a separate offline error for each submitted link', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    addOfflineTasks.mockResolvedValue({
      ok: true,
      data: {
        successCount: 0,
        failedCount: 2,
        errors: [
          {
            url: 'magnet:?xt=urn:btih:aaaa',
            message: '任务已存在',
          },
          {
            url: 'magnet:?xt=urn:btih:bbbb',
            message: '错误的链接',
          },
        ],
      },
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByText('电影');
    fireEvent.click(screen.getByRole('button', { name: '离线任务' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('离线链接'), {
      target: {
        value: 'magnet:?xt=urn:btih:aaaa\nmagnet:?xt=urn:btih:bbbb',
      },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: '提交离线任务' }),
    );

    expect(await within(dialog).findByText('任务已存在')).toBeDefined();
    expect(within(dialog).getByText('错误的链接')).toBeDefined();
    expect(within(dialog).getByText('magnet:?xt=urn:btih:aaaa')).toBeDefined();
    expect(within(dialog).getByText('magnet:?xt=urn:btih:bbbb')).toBeDefined();
  });

  it('downloads a selected video by its pickcode', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockResolvedValue({
      ok: true,
      data: {
        accountId: driveAccount.connectionId,
        folderId: '0',
        breadcrumbs: [{ id: '0', name: '根目录' }],
        entries: [
          {
            id: '77',
            parentId: '0',
            name: 'movie.mp4',
            kind: 'file',
            size: 2048,
            modifiedAt: '2026-10-21T09:00:00.000Z',
            extension: 'mp4',
            durationSeconds: 120,
            pickcode: 'video-pickcode',
          },
        ],
        offset: 0,
        limit: 100,
        total: 1,
        hasMore: false,
      },
    });
    downloadDriveFile.mockResolvedValue({
      ok: true,
      data: {
        canceled: false,
        fileName: 'movie.mp4',
        filePath: 'C:\\Downloads\\movie.mp4',
        bytes: 2048,
      },
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    fireEvent.click(await screen.findByText('movie.mp4'));
    fireEvent.click(screen.getByRole('button', { name: '下载' }));

    await waitFor(() => {
      expect(downloadDriveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: driveAccount.connectionId,
          pickcode: 'video-pickcode',
          fileName: 'movie.mp4',
          kind: 'video',
        }),
      );
    });

    expect(await screen.findByText('下载完成')).toBeDefined();
    expect(screen.getByText('C:\\Downloads\\movie.mp4')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '打开下载目录' }));

    await waitFor(() => {
      expect(openDriveDownloadFolder).toHaveBeenCalledWith(expect.any(String));
    });
  });

  it('downloads a non-video file with its download key', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockResolvedValue({
      ok: true,
      data: {
        accountId: driveAccount.connectionId,
        folderId: '0',
        breadcrumbs: [{ id: '0', name: '根目录' }],
        entries: [
          {
            id: '88',
            parentId: '0',
            name: 'notes.txt',
            kind: 'file',
            size: 1024,
            modifiedAt: '2026-10-21T09:00:00.000Z',
            extension: 'txt',
            durationSeconds: null,
            pickcode: 'file-pickcode',
            downloadKey: 'file-download-key',
          },
        ],
        offset: 0,
        limit: 100,
        total: 1,
        hasMore: false,
      },
    });
    downloadDriveFile.mockResolvedValue({
      ok: true,
      data: {
        canceled: false,
        fileName: 'notes.txt',
        filePath: 'C:\\Downloads\\notes.txt',
        bytes: 1024,
      },
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    fireEvent.click(await screen.findByText('notes.txt'));
    fireEvent.click(screen.getByRole('button', { name: '下载' }));

    await waitFor(() => {
      expect(downloadDriveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: driveAccount.connectionId,
          pickcode: 'file-pickcode',
          fileName: 'notes.txt',
          kind: 'file',
          downloadKey: 'file-download-key',
        }),
      );
    });

    expect(await screen.findByText('下载完成')).toBeDefined();
  });

  it('cancels an active video download', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockResolvedValue({
      ok: true,
      data: {
        accountId: driveAccount.connectionId,
        folderId: '0',
        breadcrumbs: [{ id: '0', name: '根目录' }],
        entries: [
          {
            id: '77',
            parentId: '0',
            name: 'movie.mp4',
            kind: 'file',
            size: 100,
            modifiedAt: '2026-10-21T09:00:00.000Z',
            extension: 'mp4',
            durationSeconds: 120,
            pickcode: 'video-pickcode',
          },
        ],
        offset: 0,
        limit: 100,
        total: 1,
        hasMore: false,
      },
    });
    downloadDriveFile.mockReturnValue(new Promise(() => {}));

    let emitProgress: ((progress: DriveDownloadProgress) => void) | null = null;

    onDriveDownloadProgress.mockImplementation((listener) => {
      emitProgress = listener;
      return () => {};
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    fireEvent.click(await screen.findByText('movie.mp4'));
    fireEvent.click(screen.getByRole('button', { name: '下载' }));

    await waitFor(() => {
      expect(downloadDriveFile).toHaveBeenCalledOnce();
    });

    const downloadId = downloadDriveFile.mock.calls[0]?.[0].downloadId;

    if (!downloadId || !emitProgress) {
      throw new Error('download did not start');
    }

    act(() => {
      emitProgress?.({
        downloadId,
        fileName: 'movie.mp4',
        receivedBytes: 50,
        totalBytes: 100,
        bytesPerSecond: 10,
        status: 'downloading',
      });
    });

    fireEvent.click(await screen.findByRole('button', { name: '取消下载' }));

    await waitFor(() => {
      expect(cancelDriveDownload).toHaveBeenCalledWith(downloadId);
    });
  });

  it('opens and closes the video player', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockResolvedValue({
      ok: true,
      data: {
        accountId: driveAccount.connectionId,
        folderId: '0',
        breadcrumbs: [{ id: '0', name: '根目录' }],
        entries: [
          {
            id: '77',
            parentId: '0',
            name: 'movie.mp4',
            kind: 'file',
            size: 2048,
            modifiedAt: '2026-10-21T09:00:00.000Z',
            extension: 'mp4',
            durationSeconds: 120,
            pickcode: 'video-pickcode',
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
    fireEvent.click(await screen.findByText('movie.mp4'));
    fireEvent.click(screen.getByRole('button', { name: '播放' }));

    await waitFor(() => {
      expect(startDrivePlayback).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: driveAccount.connectionId,
          pickcode: 'video-pickcode',
          fileName: 'movie.mp4',
        }),
      );
    });

    const dialog = await screen.findByRole('dialog', {
      name: /播放 movie\.mp4/,
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭播放器' }));

    await waitFor(() => {
      expect(stopDrivePlayback).toHaveBeenCalledWith('playback-session');
    });
  });

  it('minimizes the player and restores it from another page', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockResolvedValue({
      ok: true,
      data: {
        accountId: driveAccount.connectionId,
        folderId: '0',
        breadcrumbs: [{ id: '0', name: '根目录' }],
        entries: [
          {
            id: '77',
            parentId: '0',
            name: 'movie.mp4',
            kind: 'file',
            size: 2048,
            modifiedAt: '2026-10-21T09:00:00.000Z',
            extension: 'mp4',
            durationSeconds: 120,
            pickcode: 'video-pickcode',
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
    fireEvent.click(await screen.findByText('movie.mp4'));
    fireEvent.click(screen.getByRole('button', { name: '播放' }));

    const dialog = await screen.findByRole('dialog', {
      name: /播放 movie\.mp4/,
    });
    const video = dialog.querySelector('video');

    if (!video) {
      throw new Error('player video was not rendered');
    }

    fireEvent.click(
      within(dialog).getByRole('button', { name: '最小化播放器' }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /播放 movie\.mp4/ }),
      ).toBeNull();
    });
    expect(stopDrivePlayback).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: '恢复播放 movie.mp4' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: '播放视频' })).toBeDefined();

    fireEvent.play(video);

    expect(
      await screen.findByRole('button', { name: '暂停视频' }),
    ).toBeDefined();

    const pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {});

    Object.defineProperty(video, 'paused', {
      configurable: true,
      value: false,
    });
    fireEvent.click(screen.getByRole('button', { name: '暂停视频' }));

    expect(pauseSpy).toHaveBeenCalled();
    fireEvent.pause(video);
    expect(
      await screen.findByRole('button', { name: '播放视频' }),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    await screen.findByRole('heading', { level: 1, name: /设置/ });

    const restoreButton = screen.getByRole('button', {
      name: '恢复播放 movie.mp4',
    });

    fireEvent.click(restoreButton);

    const restoredDialog = await screen.findByRole('dialog', {
      name: /播放 movie\.mp4/,
    });

    expect(restoredDialog.querySelector('video')).toBe(video);
    expect(startDrivePlayback).toHaveBeenCalledOnce();
    expect(stopDrivePlayback).not.toHaveBeenCalled();

    fireEvent.click(
      within(restoredDialog).getByRole('button', {
        name: '最小化播放器',
      }),
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: '关闭播放 movie.mp4',
      }),
    );

    await waitFor(() => {
      expect(stopDrivePlayback).toHaveBeenCalledWith('playback-session');
    });
    expect(
      screen.queryByRole('button', { name: '恢复播放 movie.mp4' }),
    ).toBeNull();
  });

  it('resumes a video and supports subtitles and playlist navigation', async () => {
    const connectionId = driveAccount.connectionId;

    window.localStorage.setItem(
      `japp.playback-progress.v1:${connectionId}:71`,
      JSON.stringify({
        position: 125,
        duration: 3600,
        updatedAt: Date.now(),
      }),
    );
    getDriveSubtitles.mockResolvedValue({
      ok: true,
      data: [
        {
          name: 'first.zh-CN.srt',
          content: `1
00:00:01,000 --> 00:00:03,000
测试字幕
`,
          format: 'srt',
        },
      ],
    });
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder.mockResolvedValue({
      ok: true,
      data: {
        accountId: connectionId,
        folderId: '0',
        breadcrumbs: [{ id: '0', name: '根目录' }],
        entries: [
          {
            id: '71',
            parentId: '0',
            name: 'first.mp4',
            kind: 'file',
            size: 2048,
            modifiedAt: '2026-10-21T09:00:00.000Z',
            extension: 'mp4',
            durationSeconds: 3600,
            pickcode: 'first-pickcode',
          },
          {
            id: '72',
            parentId: '0',
            name: 'second.mp4',
            kind: 'file',
            size: 2048,
            modifiedAt: '2026-10-21T09:00:00.000Z',
            extension: 'mp4',
            durationSeconds: 3600,
            pickcode: 'second-pickcode',
          },
        ],
        offset: 0,
        limit: 100,
        total: 2,
        hasMore: false,
      },
    });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    fireEvent.click(await screen.findByText('first.mp4'));

    expect(screen.getByText(/继续观看 2:05/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '播放' }));

    const dialog = await screen.findByRole('dialog', {
      name: /播放 first\.mp4/,
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '字幕设置' }));
    await waitFor(() => {
      expect(getDriveSubtitles).toHaveBeenCalledWith('first.mp4');
      expect(
        within(dialog).getByRole('option', { name: 'first.zh-CN.srt' }),
      ).toBeTruthy();
    });

    expect(
      within(dialog).getByRole('button', { name: '关闭字幕' }),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole('button', { name: '展开播放列表' }),
    );
    expect(within(dialog).getByTitle('second.mp4')).toBeTruthy();
    fireEvent.click(within(dialog).getByTitle('second.mp4'));

    await waitFor(() => {
      expect(startDrivePlayback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pickcode: 'second-pickcode',
          fileName: 'second.mp4',
        }),
      );
    });

    await waitFor(() => {
      expect(dialog.isConnected).toBe(true);
      expect(dialog.getAttribute('aria-label')).toContain('second.mp4');
    });
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
            pickcode: null,
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

  it('rechecks the 115 session after logging in from settings', async () => {
    listDriveAccounts.mockResolvedValue({
      ok: true,
      data: [driveAccount],
    });
    listDriveFolder
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: 'auth_required',
          message: '115 登录已失效，请重新登录。',
        },
      })
      .mockResolvedValue({
        ok: true,
        data: driveRootListing,
      });

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '网盘' }));
    await screen.findByRole('heading', { name: '115 登录已失效' });

    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    await screen.findByRole('heading', { name: '设置。' });
    fireEvent.click(screen.getByRole('button', { name: '网盘' }));

    expect(await screen.findByText('readme.txt')).toBeDefined();
    expect(
      screen.queryByRole('heading', { name: '115 登录已失效' }),
    ).toBeNull();
    expect(listDriveAccounts).toHaveBeenCalledTimes(2);
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

  it('switches the appearance theme from the title bar menu', async () => {
    render(<App />);

    const themeButton = await screen.findByRole('button', {
      name: '主题，当前跟随系统',
    });

    await waitFor(() => {
      expect((themeButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(themeButton);

    expect(screen.getByRole('menu', { name: '选择主题' })).toBeDefined();
    expect(
      screen
        .getByRole('menuitemradio', { name: '跟随系统' })
        .getAttribute('aria-checked'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('menuitemradio', { name: '深色' }));

    expect(setAppearanceTheme).toHaveBeenCalledWith('dark');
    expect(
      await screen.findByRole('button', { name: '主题，当前深色' }),
    ).toBeDefined();
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '设置' }));

    expect(
      await screen.findByRole('radio', { name: /深色/, checked: true }),
    ).toBeDefined();
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

  it('sets the default download directory from the settings page', async () => {
    chooseDownloadDirectory.mockResolvedValueOnce('D:\\Downloads');

    render(<App />);
    await screen.findByRole('button', {
      name: '网络代理，当前已开启',
    });

    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '选择下载目录' }),
    );

    await waitFor(() => {
      expect(chooseDownloadDirectory).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText('D:\\Downloads')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '选择字幕目录' }));

    await waitFor(() => {
      expect(chooseSubtitleDirectory).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText('D:\\Subtitles')).toBeDefined();
  });
});
