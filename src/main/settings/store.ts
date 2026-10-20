import { constants } from 'node:fs';
import { access, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { AppSettings, ProxySettings } from '@shared/settings';
import { createDefaultAppSettings } from './defaults';
import { parseAppSettings, parseProxySettings } from './schema';

const SETTINGS_FILE_NAME = 'settings.json';

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

async function readSettingsFromDisk(): Promise<AppSettings | null> {
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
    return parseAppSettings(parsed);
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
    const storedSettings = await readSettingsFromDisk();

    if (storedSettings) {
      cachedSettings = storedSettings;
      return storedSettings;
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

export async function getProxySettings(): Promise<ProxySettings> {
  return (await loadSettings()).network.proxy;
}

export async function saveProxySettings(
  input: unknown,
): Promise<ProxySettings> {
  const proxy = parseProxySettings(input);

  const operation = saveQueue.then(async () => {
    const current = await loadSettings();
    const next: AppSettings = {
      ...current,
      network: {
        ...current.network,
        proxy,
      },
    };

    await writeSettingsFile(next);
    cachedSettings = next;
  });

  saveQueue = operation.catch(() => undefined);
  await operation;

  return proxy;
}
