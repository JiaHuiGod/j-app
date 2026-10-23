import { constants } from 'node:fs';
import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { ThemePreference } from '@shared/appearance';
import type { SiteConnection } from '@shared/connections';
import type {
  AppSettings,
  ProxySettings,
  WindowStateSettings,
} from '@shared/settings';
import { createDefaultAppSettings } from './defaults';
import {
  parseAppSettings,
  parseProxySettings,
  parseWindowState,
} from './schema';

const SETTINGS_FILE_NAME = 'settings.json';

interface StoredSettings {
  readonly settings: AppSettings;
  readonly migrated: boolean;
}

let cachedSettings: AppSettings | null = null;
let saveQueue: Promise<void> = Promise.resolve();

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE_NAME);
}

async function writeSettingsFile(settings: AppSettings): Promise<void> {
  const settingsPath = getSettingsPath();
  const directory = path.dirname(settingsPath);
  const temporaryPath = `${settingsPath}.${process.pid}.${Date.now()}.tmp`;
  const serialized = `${JSON.stringify(settings, null, 2)}\n`;

  await mkdir(directory, { recursive: true });

  try {
    const file = await open(temporaryPath, 'w', 0o600);

    try {
      await file.writeFile(serialized, 'utf8');
      await file.sync();
    } finally {
      await file.close();
    }

    await rename(temporaryPath, settingsPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function moveInvalidSettingsAside(): Promise<void> {
  const settingsPath = getSettingsPath();
  const backupPath = path.join(
    path.dirname(settingsPath),
    `settings.invalid-${Date.now()}.json`,
  );

  await rename(settingsPath, backupPath);
  console.warn(`Invalid settings moved to ${backupPath}`);
}

async function readSettingsFromDisk(): Promise<StoredSettings | null> {
  const settingsPath = getSettingsPath();

  try {
    await access(settingsPath, constants.F_OK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }

  const raw = await readFile(settingsPath, 'utf8');

  try {
    const parsed = JSON.parse(raw) as unknown;
    const settings = parseAppSettings(parsed);
    const storedVersion =
      typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed
        ? parsed.schemaVersion
        : null;

    return {
      settings,
      migrated: storedVersion !== settings.schemaVersion,
    };
  } catch (error) {
    console.error('Failed to parse settings:', error);
    await moveInvalidSettingsAside().catch((backupError: unknown) => {
      console.error('Failed to back up invalid settings:', backupError);
    });
    return null;
  }
}

export async function loadSettings(): Promise<AppSettings> {
  if (cachedSettings) {
    return cachedSettings;
  }

  try {
    const stored = await readSettingsFromDisk();

    if (stored) {
      cachedSettings = stored.settings;

      if (stored.migrated) {
        await writeSettingsFile(stored.settings).catch((error: unknown) => {
          console.error('Failed to persist migrated settings:', error);
        });
      }

      return stored.settings;
    }

    cachedSettings = createDefaultAppSettings();
    await writeSettingsFile(cachedSettings).catch((error: unknown) => {
      console.error('Failed to write default settings:', error);
    });
    return cachedSettings;
  } catch (error) {
    console.error('Failed to load settings:', error);
    cachedSettings = createDefaultAppSettings();
    return cachedSettings;
  }
}

async function updateSettings(
  updater: (current: AppSettings) => AppSettings,
): Promise<AppSettings> {
  const operation = saveQueue.then(async () => {
    const current = await loadSettings();
    const next = parseAppSettings(updater(current));

    await writeSettingsFile(next);
    cachedSettings = next;

    return next;
  });

  saveQueue = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

export async function getProxySettings(): Promise<ProxySettings> {
  return (await loadSettings()).network.proxy;
}

export async function getWindowState(): Promise<WindowStateSettings> {
  return (await loadSettings()).windowState;
}

export async function saveWindowState(
  input: unknown,
): Promise<WindowStateSettings> {
  const windowState = parseWindowState(input);

  await updateSettings((current) => ({
    ...current,
    windowState,
  }));

  return windowState;
}

export async function saveProxySettings(
  input: unknown,
): Promise<ProxySettings> {
  const proxy = parseProxySettings(input);

  await updateSettings((current) => ({
    ...current,
    network: {
      ...current.network,
      proxy,
    },
  }));

  return proxy;
}

export async function saveThemePreference(
  theme: ThemePreference,
): Promise<ThemePreference> {
  await updateSettings((current) => ({
    ...current,
    appearance: {
      ...current.appearance,
      theme,
    },
  }));

  return theme;
}

async function normalizeDirectory(
  input: unknown,
  label: string,
): Promise<string | null> {
  if (input === null) {
    return null;
  }

  if (typeof input !== 'string' || input.length > 4096) {
    throw new Error(`${label}格式不正确。`);
  }

  const directory = input.trim();

  if (!directory || !path.isAbsolute(directory)) {
    throw new Error(`${label}必须是绝对路径。`);
  }

  const info = await stat(directory).catch(() => null);

  if (!info?.isDirectory()) {
    throw new Error(`${label}不存在或不是文件夹。`);
  }

  return directory;
}

export async function getDownloadDirectory(): Promise<string | null> {
  return (await loadSettings()).downloads.directory;
}

export async function saveDownloadDirectory(
  input: unknown,
): Promise<string | null> {
  const directory = await normalizeDirectory(input, '下载目录');

  await updateSettings((current) => ({
    ...current,
    downloads: {
      ...current.downloads,
      directory,
    },
  }));

  return directory;
}

export async function getSubtitleDirectory(): Promise<string | null> {
  return (await loadSettings()).subtitles.directory;
}

export async function saveSubtitleDirectory(
  input: unknown,
): Promise<string | null> {
  const directory = await normalizeDirectory(input, '字幕目录');

  await updateSettings((current) => ({
    ...current,
    subtitles: {
      ...current.subtitles,
      directory,
    },
  }));

  return directory;
}

function pathIdentity(value: string): string {
  const resolved = path.resolve(value);

  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

async function normalizeDirectories(input: unknown): Promise<string[]> {
  if (!Array.isArray(input) || input.length > 50) {
    throw new Error('本地视频目录列表格式不正确。');
  }

  const directories: string[] = [];
  const seen = new Set<string>();

  for (const value of input) {
    let directory: string | null = null;

    try {
      directory = await normalizeDirectory(value, '本地视频目录');
    } catch {
      // Keep stale configured folders from blocking new selections.
      continue;
    }

    if (!directory) {
      continue;
    }

    const identity = pathIdentity(directory);

    if (!seen.has(identity)) {
      seen.add(identity);
      directories.push(directory);
    }
  }

  return directories;
}

export async function getLocalVideoDirectories(): Promise<readonly string[]> {
  return (await loadSettings()).localVideo.directories;
}

export async function saveLocalVideoDirectories(
  input: unknown,
): Promise<string[]> {
  const directories = await normalizeDirectories(input);

  await updateSettings((current) => ({
    ...current,
    localVideo: {
      ...current.localVideo,
      directories,
    },
  }));

  return directories;
}

export async function addLocalVideoDirectories(
  input: readonly string[],
): Promise<string[]> {
  const current = await getLocalVideoDirectories();

  return saveLocalVideoDirectories([...current, ...input]);
}

export async function removeLocalVideoDirectory(
  directory: string,
): Promise<string[]> {
  const current = await getLocalVideoDirectories();
  const identity = pathIdentity(directory);

  return saveLocalVideoDirectories(
    current.filter((item) => pathIdentity(item) !== identity),
  );
}

export async function getSiteConnections(): Promise<readonly SiteConnection[]> {
  return (await loadSettings()).connections.sites;
}

export async function findSiteConnection(
  id: string,
): Promise<SiteConnection | null> {
  const settings = await loadSettings();
  return (
    settings.connections.sites.find((connection) => connection.id === id) ??
    null
  );
}

export async function addSiteConnection(
  connection: SiteConnection,
): Promise<SiteConnection> {
  await updateSettings((current) => {
    if (current.connections.sites.some((site) => site.id === connection.id)) {
      throw new Error('站点连接已经存在。');
    }

    return {
      ...current,
      connections: {
        sites: [...current.connections.sites, connection],
      },
    };
  });

  return connection;
}

export async function updateSiteConnectionLoginAt(
  id: string,
  lastLoginAt: string,
): Promise<SiteConnection> {
  let updatedConnection: SiteConnection | null = null;

  await updateSettings((current) => ({
    ...current,
    connections: {
      sites: current.connections.sites.map((connection) => {
        if (connection.id !== id) {
          return connection;
        }

        updatedConnection = {
          ...connection,
          lastLoginAt,
        };

        return updatedConnection;
      }),
    },
  }));

  if (!updatedConnection) {
    throw new Error('站点连接不存在。');
  }

  return updatedConnection;
}

export async function setSiteConnectionPinned(
  id: string,
  pinned: boolean,
): Promise<SiteConnection> {
  let updatedConnection: SiteConnection | null = null;

  await updateSettings((current) => ({
    ...current,
    connections: {
      sites: current.connections.sites.map((connection) => {
        if (connection.id !== id) {
          return connection;
        }

        updatedConnection = {
          ...connection,
          pinned,
        };

        return updatedConnection;
      }),
    },
  }));

  if (!updatedConnection) {
    throw new Error('站点连接不存在。');
  }

  return updatedConnection;
}

export async function removeSiteConnection(
  id: string,
): Promise<SiteConnection> {
  let removedConnection: SiteConnection | null = null;

  await updateSettings((current) => ({
    ...current,
    connections: {
      sites: current.connections.sites.filter((connection) => {
        if (connection.id !== id) {
          return true;
        }

        removedConnection = connection;
        return false;
      }),
    },
  }));

  if (!removedConnection) {
    throw new Error('站点连接不存在。');
  }

  return removedConnection;
}

export async function removeUnpinnedSiteConnections(): Promise<
  readonly SiteConnection[]
> {
  let removedConnections: SiteConnection[] = [];

  await updateSettings((current) => {
    const retained = current.connections.sites.filter((connection) => {
      if (connection.pinned) {
        return true;
      }

      removedConnections = [...removedConnections, connection];
      return false;
    });

    return {
      ...current,
      connections: {
        sites: retained,
      },
    };
  });

  return removedConnections;
}
