import { app, autoUpdater, BrowserWindow } from 'electron';
import { IpcChannel } from '@shared/ipc';
import type { UpdateState } from '@shared/updates';
import { markAppQuitting } from '../window';
import {
  buildUpdateFeedUrl,
  isAutoUpdateSupported,
  UPDATE_REPOSITORY,
} from './feed';

const AUTO_CHECK_DELAY_MS = 20_000;
const AUTO_CHECK_INTERVAL_MS = 4 * 60 * 60_000;

let initialized = false;
let checkTimer: NodeJS.Timeout | null = null;
let checkInterval: NodeJS.Timeout | null = null;
const stateListeners = new Set<(state: UpdateState) => void>();

let state: UpdateState = {
  status: 'unsupported',
  supported: false,
  currentVersion: app.getVersion(),
  availableVersion: null,
  releaseNotes: null,
  releaseDate: null,
  lastCheckedAt: null,
  error: null,
};

function setState(next: Partial<UpdateState>): void {
  state = { ...state, ...next };

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IpcChannel.UpdateStateChanged, state);
    }
  }

  for (const listener of stateListeners) {
    listener(state);
  }
}

function releaseInfo(
  releaseNotes: string | undefined,
  releaseName: string | undefined,
  releaseDate: Date | undefined,
): Pick<UpdateState, 'releaseNotes' | 'releaseDate' | 'availableVersion'> {
  return {
    releaseNotes: releaseNotes?.trim() || null,
    releaseDate:
      releaseDate instanceof Date && !Number.isNaN(releaseDate.getTime())
        ? releaseDate.toISOString()
        : null,
    availableVersion: releaseName?.trim() || null,
  };
}

function handleUpdaterError(error: Error): void {
  console.error('Auto update error:', error);
  setState({
    status: 'error',
    error: error.message || '检查更新失败，请稍后重试。',
    lastCheckedAt: new Date().toISOString(),
  });
}

export function getUpdateState(): UpdateState {
  return state;
}

export function onUpdateStateChange(
  listener: (nextState: UpdateState) => void,
): () => void {
  stateListeners.add(listener);

  return () => {
    stateListeners.delete(listener);
  };
}

export async function checkForAppUpdates(): Promise<UpdateState> {
  if (!state.supported) {
    return state;
  }

  if (state.status === 'downloaded' || state.status === 'checking') {
    return state;
  }

  setState({
    status: 'checking',
    error: null,
    lastCheckedAt: new Date().toISOString(),
  });

  try {
    autoUpdater.checkForUpdates();
  } catch (error) {
    handleUpdaterError(
      error instanceof Error ? error : new Error('检查更新失败。'),
    );
  }

  return state;
}

export async function installUpdate(): Promise<void> {
  if (state.status !== 'downloaded') {
    throw new Error('更新尚未下载完成。');
  }

  markAppQuitting();
  autoUpdater.quitAndInstall();
}

export function initializeUpdates(): void {
  if (initialized) {
    return;
  }

  initialized = true;

  const supported = isAutoUpdateSupported(app.isPackaged);

  state = {
    ...state,
    supported,
    status: supported ? 'idle' : 'unsupported',
    currentVersion: app.getVersion(),
  };

  if (!supported) {
    setState({});
    return;
  }

  autoUpdater.setFeedURL({
    url: buildUpdateFeedUrl(UPDATE_REPOSITORY, app.getVersion()),
  });

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', error: null });
  });

  autoUpdater.on('update-available', () => {
    setState({
      status: 'downloading',
      error: null,
      lastCheckedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on('update-not-available', () => {
    setState({
      status: 'up-to-date',
      error: null,
      lastCheckedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on(
    'update-downloaded',
    (_event, releaseNotes, releaseName, releaseDate) => {
      setState({
        status: 'downloaded',
        error: null,
        ...releaseInfo(releaseNotes, releaseName, releaseDate),
        lastCheckedAt: new Date().toISOString(),
      });
    },
  );

  autoUpdater.on('error', handleUpdaterError);

  checkTimer = setTimeout(() => {
    checkTimer = null;
    void checkForAppUpdates();
  }, AUTO_CHECK_DELAY_MS);

  checkInterval = setInterval(() => {
    void checkForAppUpdates();
  }, AUTO_CHECK_INTERVAL_MS);
}

export function stopUpdateChecks(): void {
  if (checkTimer) {
    clearTimeout(checkTimer);
    checkTimer = null;
  }

  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
