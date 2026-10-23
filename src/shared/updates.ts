export type UpdateStatus =
  | 'unsupported'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error';

export interface UpdateState {
  readonly status: UpdateStatus;
  readonly supported: boolean;
  readonly currentVersion: string;
  readonly availableVersion: string | null;
  readonly releaseNotes: string | null;
  readonly releaseDate: string | null;
  readonly lastCheckedAt: string | null;
  readonly error: string | null;
}

export interface UpdatesApi {
  getState: () => Promise<UpdateState>;
  check: () => Promise<UpdateState>;
  install: () => Promise<void>;
  onStateChange: (listener: (state: UpdateState) => void) => () => void;
}
