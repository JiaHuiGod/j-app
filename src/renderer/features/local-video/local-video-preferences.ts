const VIEW_KEY = 'japp.local-view.v1';
const GROUP_KEY = 'japp.local-group.v1';
const PROGRESS_PREFIX = 'japp.local-progress.v1:';

export type LocalVideoViewMode = 'grid' | 'list';

export function readViewMode(): LocalVideoViewMode {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function saveViewMode(view: LocalVideoViewMode): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Ignore storage failures; view preference is non-critical.
  }
}

export function readGroupByFolder(): boolean {
  try {
    return window.localStorage.getItem(GROUP_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveGroupByFolder(grouped: boolean): void {
  try {
    window.localStorage.setItem(GROUP_KEY, grouped ? '1' : '0');
  } catch {
    // Ignore storage failures; grouping is non-critical.
  }
}

export function readLocalProgress(videoId: string): number | null {
  try {
    const raw = window.localStorage.getItem(`${PROGRESS_PREFIX}${videoId}`);

    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as unknown;

    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const record = value as Record<string, unknown>;
    const position = Number(record.position);
    const duration = Number(record.duration);

    if (
      !Number.isFinite(position) ||
      !Number.isFinite(duration) ||
      position < 5 ||
      duration <= 0 ||
      position >= duration - 10
    ) {
      return null;
    }

    return position;
  } catch {
    return null;
  }
}

export function saveLocalProgress(
  videoId: string,
  position: number,
  duration: number,
): void {
  if (
    !Number.isFinite(position) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    position < 0
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      `${PROGRESS_PREFIX}${videoId}`,
      JSON.stringify({
        position,
        duration,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // Ignore storage failures; progress is best-effort.
  }
}
