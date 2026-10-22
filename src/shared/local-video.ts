export const LOCAL_VIDEO_PROTOCOL = 'japp-local';

export type LocalVideoPosterKind = 'poster' | 'thumb';

export interface LocalVideoPoster {
  readonly id: string;
  readonly name: string;
  readonly kind: LocalVideoPosterKind;
  readonly url: string;
}

export interface LocalVideoItem {
  readonly id: string;
  readonly title: string;
  readonly fileName: string;
  readonly libraryId: string;
  readonly libraryName: string;
  readonly relativePath: string;
  readonly extension: string;
  readonly size: number;
  readonly modifiedAt: string;
  readonly videoUrl: string;
  readonly posters: readonly LocalVideoPoster[];
}

export interface LocalVideoLibrary {
  readonly id: string;
  readonly name: string;
  readonly videos: readonly LocalVideoItem[];
  readonly scannedAt: string;
  readonly truncated: boolean;
}

export interface LocalVideoScanProgress {
  readonly scannedEntries: number;
  readonly videoCount: number;
  readonly currentDirectory: string;
  readonly folderName: string;
  readonly folderIndex: number;
  readonly folderCount: number;
}

export interface LocalVideoFolderError {
  readonly libraryId: string;
  readonly folderName: string;
  readonly message: string;
}

export interface LocalVideoFolderSnapshot {
  readonly libraries: readonly LocalVideoLibrary[];
  readonly errors: readonly LocalVideoFolderError[];
}

export type LocalVideoSubtitleFormat = 'ass' | 'srt' | 'ssa' | 'vtt';

export interface LocalVideoSubtitle {
  readonly id: string;
  readonly label: string;
  readonly content: string;
  readonly format: LocalVideoSubtitleFormat;
}

export interface LocalVideoSubtitleInput {
  readonly libraryId: string;
  readonly videoId: string;
}

export type LocalVideoResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

export interface LocalVideoApi {
  chooseFolders: () => Promise<
    LocalVideoResult<LocalVideoFolderSnapshot | null>
  >;
  loadLibraries: () => Promise<LocalVideoResult<LocalVideoFolderSnapshot>>;
  rescan: () => Promise<LocalVideoResult<LocalVideoFolderSnapshot>>;
  removeFolder: (
    libraryId: string,
  ) => Promise<LocalVideoResult<LocalVideoFolderSnapshot>>;
  getSubtitles: (
    input: LocalVideoSubtitleInput,
  ) => Promise<LocalVideoResult<readonly LocalVideoSubtitle[]>>;
  cancelScan: () => Promise<void>;
  onScanProgress: (
    listener: (progress: LocalVideoScanProgress) => void,
  ) => () => void;
}
