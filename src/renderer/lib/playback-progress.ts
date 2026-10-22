const STORAGE_PREFIX = 'japp.playback-progress.v1';
const MIN_RESUME_SECONDS = 5;
const NEAR_END_SECONDS = 10;

export interface PlaybackProgress {
  readonly position: number;
  readonly duration: number;
  readonly updatedAt: number;
}

function storageKey(connectionId: string, fileId: string): string {
  return `${STORAGE_PREFIX}:${connectionId}:${fileId}`;
}

export function getPlaybackProgress(
  connectionId: string,
  fileId: string,
): PlaybackProgress | null {
  try {
    const raw = window.localStorage.getItem(storageKey(connectionId, fileId));

    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as Partial<PlaybackProgress>;

    if (
      typeof value.position !== 'number' ||
      typeof value.duration !== 'number' ||
      !Number.isFinite(value.position) ||
      !Number.isFinite(value.duration) ||
      value.duration <= 0
    ) {
      return null;
    }

    return {
      position: Math.max(0, Math.min(value.position, value.duration)),
      duration: value.duration,
      updatedAt:
        typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function savePlaybackProgress(
  connectionId: string,
  fileId: string,
  position: number,
  duration: number,
): void {
  if (
    !Number.isFinite(position) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    position < MIN_RESUME_SECONDS ||
    position >= duration - NEAR_END_SECONDS
  ) {
    clearPlaybackProgress(connectionId, fileId);
    return;
  }

  try {
    window.localStorage.setItem(
      storageKey(connectionId, fileId),
      JSON.stringify({
        position,
        duration,
        updatedAt: Date.now(),
      } satisfies PlaybackProgress),
    );
  } catch {
    // Progress persistence is best-effort.
  }
}

export function clearPlaybackProgress(
  connectionId: string,
  fileId: string,
): void {
  try {
    window.localStorage.removeItem(storageKey(connectionId, fileId));
  } catch {
    // Ignore storage failures.
  }
}

export function formatPlaybackPosition(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
