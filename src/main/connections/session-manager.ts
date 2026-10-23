import { randomUUID } from 'node:crypto';
import { BrowserWindow, session, type Session } from 'electron';
import type {
  ClearAllSiteConnectionsResult,
  CreateSiteConnectionInput,
  RemoveSiteConnectionResult,
  SiteConnection,
  SiteConnectionSummary,
} from '@shared/connections';
import { applyProxyToSession } from '../network/proxy';
import { getWindowBackgroundColor } from '../appearance/theme';
import {
  addSiteConnection,
  findSiteConnection,
  getProxySettings,
  getSiteConnections,
  removeSiteConnection,
  removeUnpinnedSiteConnections,
  setSiteConnectionPinned,
  updateSiteConnectionLoginAt,
} from '../settings/store';
import {
  isAllowedLoginUrl,
  parseCreateSiteConnectionInput,
  parseSiteConnectionId,
} from '../settings/schema';
import { getMainWindow } from '../window';
import { getSitePartitionName } from './partition';
import { applySiteSessionProfile } from './site-profile';
import { is115Connection } from '../drive/detection';
import { validateSiteLogin } from './login-validation';
import { persist115SessionCookies } from './persist-cookies';

const LOGIN_WINDOW_WIDTH = 1020;
const LOGIN_WINDOW_HEIGHT = 760;

let loginWindow: BrowserWindow | null = null;

function getCookieCount(siteSession: Session, url: string): Promise<number> {
  return siteSession.cookies.get({ url }).then((cookies) => cookies.length);
}

function summarizeConnection(
  connection: SiteConnection,
  cookieCount: number,
): SiteConnectionSummary {
  return {
    ...connection,
    cookieCount,
    status: cookieCount > 0 ? 'connected' : 'empty',
  };
}

async function clearConnectionStorage(connectionId: string): Promise<void> {
  const siteSession = session.fromPartition(getSitePartitionName(connectionId));

  await siteSession.closeAllConnections();
  await siteSession.clearStorageData({
    storages: [
      'cookies',
      'localstorage',
      'indexdb',
      'cachestorage',
      'serviceworkers',
    ],
  });
  await siteSession.cookies.flushStore();
  await siteSession.clearCache();
}

function prepareLoginWindow(
  connection: SiteConnection,
  partition: string,
): BrowserWindow {
  const parent = getMainWindow();
  const newLoginWindow = new BrowserWindow({
    width: LOGIN_WINDOW_WIDTH,
    height: LOGIN_WINDOW_HEIGHT,
    minWidth: 720,
    minHeight: 560,
    parent: parent ?? undefined,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: getWindowBackgroundColor(),
    title: `登录 ${connection.name} — 完成后关闭窗口`,
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  newLoginWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  newLoginWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedLoginUrl(url)) {
      return { action: 'deny' };
    }

    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 960,
        height: 720,
        autoHideMenuBar: true,
        webPreferences: {
          partition,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webviewTag: false,
        },
      },
    };
  });

  newLoginWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedLoginUrl(url)) {
      event.preventDefault();
    }
  });

  newLoginWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  newLoginWindow.once('ready-to-show', () => {
    newLoginWindow.show();
    newLoginWindow.focus();
  });

  void newLoginWindow.loadURL(connection.loginUrl).catch((error: unknown) => {
    console.error('Failed to load site login page:', error);
  });

  return newLoginWindow;
}

async function waitForLogin(
  connection: SiteConnection,
  partition: string,
): Promise<Session> {
  if (loginWindow) {
    throw new Error('已有一个站点登录窗口，请先完成或关闭它。');
  }

  const siteSession = session.fromPartition(partition);
  const proxy = await getProxySettings();

  applySiteSessionProfile(siteSession);
  await applyProxyToSession(siteSession, proxy);

  // 115's account landing page can show a signed-in user before the drive
  // session cookies are written. Open the storage URL directly so completing
  // login lands on the drive and the authenticated cookie set is created.
  const loginConnection = is115Connection(connection)
    ? {
        ...connection,
        loginUrl: 'https://115.com/storage/allfiles?cid=0&mode=wangpan',
      }
    : connection;
  const currentWindow = prepareLoginWindow(loginConnection, partition);
  loginWindow = currentWindow;

  try {
    await new Promise<void>((resolve) => {
      currentWindow.once('closed', () => {
        resolve();
      });
    });
  } finally {
    if (loginWindow === currentWindow) {
      loginWindow = null;
    }
  }

  return siteSession;
}

function buildDraftConnection(
  input: CreateSiteConnectionInput,
): SiteConnection {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    name: input.name,
    loginUrl: input.loginUrl,
    createdAt: now,
    lastLoginAt: null,
    pinned: false,
  };
}

async function loginAndSummarize(
  connection: SiteConnection,
  isNew: boolean,
): Promise<SiteConnectionSummary> {
  const partition = getSitePartitionName(connection.id);
  const siteSession = await waitForLogin(connection, partition);
  const cookieCount = await getCookieCount(siteSession, connection.loginUrl);

  if (cookieCount === 0) {
    throw new Error('未检测到 Cookie，站点连接未保存。');
  }

  await validateSiteLogin(connection, siteSession);

  // Some 115 auth cookies are session-only. Promote them before flushing so a
  // valid login survives the next app restart.
  await persist115SessionCookies(connection, siteSession);

  // Chromium batches cookie writes. Flush before reporting success so the
  // session survives an immediate app exit or restart.
  await siteSession.cookies.flushStore();

  const loggedInConnection = {
    ...connection,
    lastLoginAt: new Date().toISOString(),
  };

  if (isNew) {
    await addSiteConnection(loggedInConnection);
  } else {
    await updateSiteConnectionLoginAt(
      connection.id,
      loggedInConnection.lastLoginAt,
    );
  }

  return summarizeConnection(loggedInConnection, cookieCount);
}

export async function listSiteConnections(): Promise<
  readonly SiteConnectionSummary[]
> {
  const connections = await getSiteConnections();

  return Promise.all(
    connections.map(async (connection) => {
      const siteSession = session.fromPartition(
        getSitePartitionName(connection.id),
      );
      const cookieCount = await getCookieCount(
        siteSession,
        connection.loginUrl,
      );

      return summarizeConnection(connection, cookieCount);
    }),
  );
}

export async function createSiteConnection(
  input: unknown,
): Promise<SiteConnectionSummary> {
  const parsedInput = parseCreateSiteConnectionInput(input);
  const connection = buildDraftConnection(parsedInput);

  try {
    return await loginAndSummarize(connection, true);
  } catch (error) {
    await clearConnectionStorage(connection.id).catch(
      (cleanupError: unknown) => {
        console.error(
          'Failed to clean up an unsaved site session:',
          cleanupError,
        );
      },
    );
    throw error;
  }
}

/**
 * Saves only the site metadata. No login window is opened; the user can start
 * the login flow later from the settings list.
 */
export async function createSitePreset(
  input: unknown,
): Promise<SiteConnectionSummary> {
  const parsedInput = parseCreateSiteConnectionInput(input);
  const connection = buildDraftConnection(parsedInput);

  await addSiteConnection(connection);

  return summarizeConnection(connection, 0);
}

export async function loginSiteConnection(
  input: unknown,
): Promise<SiteConnectionSummary> {
  const connectionId = parseSiteConnectionId(input);
  const connection = await findSiteConnection(connectionId);

  if (!connection) {
    throw new Error('站点连接不存在。');
  }

  return loginAndSummarize(connection, false);
}

export async function removeSiteConnectionData(
  input: unknown,
): Promise<RemoveSiteConnectionResult> {
  const connectionId = parseSiteConnectionId(input);
  const connection = await findSiteConnection(connectionId);

  if (!connection) {
    throw new Error('站点连接不存在。');
  }

  await clearConnectionStorage(connection.id);

  if (connection.pinned) {
    return {
      removed: false,
      connection: summarizeConnection(connection, 0),
    };
  }

  await removeSiteConnection(connection.id);

  return {
    removed: true,
    connection: null,
  };
}

export async function clearAllSiteConnectionData(): Promise<ClearAllSiteConnectionsResult> {
  if (loginWindow) {
    throw new Error('请先完成或关闭当前登录窗口，再清理全部站点数据。');
  }

  const connections = await getSiteConnections();

  if (connections.length === 0) {
    return { clearedCount: 0, remaining: [] };
  }

  // Clear every partition before changing metadata. If one storage operation
  // fails, all metadata remains so the user can retry the cleanup.
  for (const connection of connections) {
    await clearConnectionStorage(connection.id);
  }

  await removeUnpinnedSiteConnections();

  return {
    clearedCount: connections.length,
    remaining: connections
      .filter((connection) => connection.pinned)
      .map((connection) => summarizeConnection(connection, 0)),
  };
}

export async function setSiteConnectionPinnedData(
  input: unknown,
): Promise<SiteConnectionSummary> {
  if (typeof input !== 'object' || input === null) {
    throw new Error('站点固定参数不正确。');
  }

  const record = input as Record<string, unknown>;
  const connectionId = parseSiteConnectionId(record.connectionId);

  if (typeof record.pinned !== 'boolean') {
    throw new Error('站点固定状态不正确。');
  }

  const connection = await setSiteConnectionPinned(connectionId, record.pinned);
  const siteSession = session.fromPartition(
    getSitePartitionName(connection.id),
  );
  const cookieCount = await getCookieCount(siteSession, connection.loginUrl);

  return summarizeConnection(connection, cookieCount);
}

/**
 * Use this from main-process network or scraping services that need the
 * persisted cookies. The renderer never receives cookie values.
 */
export async function getSiteSession(
  connectionId: string,
): Promise<Session | null> {
  const connection = await findSiteConnection(connectionId);

  if (!connection) {
    return null;
  }

  const siteSession = session.fromPartition(
    getSitePartitionName(connection.id),
  );
  const proxy = await getProxySettings();

  applySiteSessionProfile(siteSession);
  await applyProxyToSession(siteSession, proxy);

  return siteSession;
}
