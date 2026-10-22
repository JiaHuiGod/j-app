const VOLUME_STORAGE_KEY = 'japp.player.volume';
const MUTED_STORAGE_KEY = 'japp.player.muted';
const DEFAULT_VOLUME = 1;
const DEFAULT_RATE = 1;

let sessionPlaybackRate = DEFAULT_RATE;

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Player preferences are best-effort.
  }
}

export function readPlayerVolume(): number {
  const raw = readStorage(VOLUME_STORAGE_KEY);
  const parsed = raw === null ? Number.NaN : Number(raw);

  return Number.isFinite(parsed) ? clampVolume(parsed) : DEFAULT_VOLUME;
}

export function savePlayerVolume(volume: number): void {
  writeStorage(VOLUME_STORAGE_KEY, String(clampVolume(volume)));
}

export function readPlayerMuted(): boolean {
  return readStorage(MUTED_STORAGE_KEY) === 'true';
}

export function savePlayerMuted(muted: boolean): void {
  writeStorage(MUTED_STORAGE_KEY, muted ? 'true' : 'false');
}

export function getSessionPlaybackRate(): number {
  return sessionPlaybackRate;
}

export function setSessionPlaybackRate(rate: number): void {
  sessionPlaybackRate = Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_RATE;
}
