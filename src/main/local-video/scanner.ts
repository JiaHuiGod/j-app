import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  LOCAL_VIDEO_PROTOCOL,
  type LocalVideoItem,
  type LocalVideoLibrary,
  type LocalVideoPoster,
  type LocalVideoPosterKind,
  type LocalVideoScanProgress,
} from '@shared/local-video';

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'm4v',
  'webm',
  'mov',
  'mkv',
  'avi',
  'ts',
  'm2ts',
  'flv',
  'wmv',
  'mpg',
  'mpeg',
]);
const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'bmp',
  'svg',
]);
const SKIPPED_DIRECTORIES = new Set([
  '$RECYCLE.BIN',
  'System Volume Information',
  '@eaDir',
  '.git',
  'node_modules',
]);
const MAX_ENTRIES = 20_000;
const MAX_DEPTH = 20;
const PROGRESS_INTERVAL_MS = 180;

interface ScannedFile {
  readonly path: string;
  readonly name: string;
}

interface DirectoryContents {
  readonly videos: ScannedFile[];
  readonly images: ScannedFile[];
}

export interface LocalVideoScanResult {
  readonly library: LocalVideoLibrary;
  readonly videos: ReadonlyMap<string, string>;
  readonly posters: ReadonlyMap<string, string>;
}

export class LocalVideoScanCanceledError extends Error {
  constructor() {
    super('本地视频扫描已取消。');
    this.name = 'LocalVideoScanCanceledError';
  }
}

function stableId(kind: string, value: string): string {
  return createHash('sha1')
    .update(`${kind}:${value}`)
    .digest('hex')
    .slice(0, 16);
}

export function localVideoLibraryId(rootPath: string): string {
  return stableId('library', path.resolve(rootPath));
}

function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted ?? false;
}

function imageKind(
  imageBase: string,
  videoStem: string,
): LocalVideoPosterKind | null {
  for (const kind of ['poster', 'thumb'] as const) {
    if (
      imageBase === `${videoStem}-${kind}` ||
      imageBase === `${videoStem}.${kind}` ||
      imageBase === `${videoStem}_${kind}` ||
      imageBase.startsWith(`${videoStem}-${kind}-`) ||
      imageBase.startsWith(`${videoStem}.${kind}-`) ||
      imageBase.startsWith(`${videoStem}_${kind}-`) ||
      imageBase.startsWith(`${videoStem}-${kind}_`) ||
      imageBase.startsWith(`${videoStem}.${kind}_`) ||
      imageBase.startsWith(`${videoStem}_${kind}_`)
    ) {
      return kind;
    }
  }

  return null;
}

function findPosterFiles(
  videoName: string,
  images: readonly ScannedFile[],
): Array<{ file: ScannedFile; kind: LocalVideoPosterKind }> {
  const videoStem = path.parse(videoName).name.toLowerCase();

  return images
    .map((image) => ({
      file: image,
      kind: imageKind(path.parse(image.name).name.toLowerCase(), videoStem),
    }))
    .filter(
      (
        item,
      ): item is {
        file: ScannedFile;
        kind: LocalVideoPosterKind;
      } => item.kind !== null,
    )
    .sort(
      (left, right) =>
        (left.kind === right.kind ? 0 : left.kind === 'poster' ? -1 : 1) ||
        left.file.name.localeCompare(right.file.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
    );
}

function createPoster(
  libraryId: string,
  image: ScannedFile,
  kind: LocalVideoPosterKind,
  posters: Map<string, string>,
): LocalVideoPoster {
  const posterId = stableId('poster', image.path);
  posters.set(posterId, image.path);

  return {
    id: posterId,
    name: image.name,
    kind,
    url: `${LOCAL_VIDEO_PROTOCOL}://poster/${libraryId}/${posterId}`,
  };
}

export interface LocalVideoScanContext {
  readonly folderName: string;
  readonly folderIndex: number;
  readonly folderCount: number;
}

export async function scanLocalVideoFolder(
  rootPath: string,
  onProgress: (progress: LocalVideoScanProgress) => void,
  signal?: AbortSignal,
  context?: LocalVideoScanContext,
): Promise<LocalVideoScanResult> {
  const resolvedRoot = path.resolve(rootPath);
  const rootInfo = await stat(resolvedRoot).catch(() => null);

  if (!rootInfo?.isDirectory()) {
    throw new Error('所选文件夹不存在或无法读取。');
  }

  const libraryName = path.basename(resolvedRoot) || '本地视频';

  const libraryId = localVideoLibraryId(resolvedRoot);
  const directories = new Map<string, DirectoryContents>();
  const videos = new Map<string, string>();
  const posters = new Map<string, string>();
  let scannedEntries = 0;
  let foundVideos = 0;
  let truncated = false;
  let lastProgressAt = 0;
  let stopped = false;

  const bucketFor = (directory: string): DirectoryContents => {
    const existing = directories.get(directory);

    if (existing) {
      return existing;
    }

    const created: DirectoryContents = {
      videos: [],
      images: [],
    };
    directories.set(directory, created);
    return created;
  };

  const report = (directory: string, force = false): void => {
    const now = Date.now();

    if (!force && now - lastProgressAt < PROGRESS_INTERVAL_MS) {
      return;
    }

    lastProgressAt = now;
    const relative = path.relative(resolvedRoot, directory);

    onProgress({
      scannedEntries,
      videoCount: foundVideos,
      currentDirectory: relative || '.',
      folderName: context?.folderName ?? libraryName,
      folderIndex: context?.folderIndex ?? 1,
      folderCount: context?.folderCount ?? 1,
    });
  };

  const walk = async (directory: string, depth: number): Promise<void> => {
    if (isAborted(signal)) {
      throw new LocalVideoScanCanceledError();
    }

    if (stopped || depth > MAX_DEPTH) {
      return;
    }

    let entries;

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (stopped) {
        break;
      }

      if (isAborted(signal)) {
        throw new LocalVideoScanCanceledError();
      }

      if (entry.name.startsWith('.')) {
        continue;
      }

      if (scannedEntries >= MAX_ENTRIES) {
        truncated = true;
        stopped = true;
        break;
      }

      scannedEntries += 1;

      const fullPath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name) || depth >= MAX_DEPTH) {
          truncated = true;
          continue;
        }

        await walk(fullPath, depth + 1);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).slice(1).toLowerCase();

      if (VIDEO_EXTENSIONS.has(extension)) {
        bucketFor(directory).videos.push({
          path: fullPath,
          name: entry.name,
        });
        foundVideos += 1;
      } else if (IMAGE_EXTENSIONS.has(extension)) {
        bucketFor(directory).images.push({
          path: fullPath,
          name: entry.name,
        });
      }

      report(directory);
    }

    report(directory, true);
  };

  await walk(resolvedRoot, 0);
  report(resolvedRoot, true);

  const items: LocalVideoItem[] = [];

  for (const [directory, contents] of directories) {
    if (contents.videos.length === 0) {
      continue;
    }

    for (const video of contents.videos) {
      if (isAborted(signal)) {
        throw new LocalVideoScanCanceledError();
      }

      const info = await stat(video.path).catch(() => null);

      if (!info?.isFile()) {
        continue;
      }

      const videoId = stableId('video', video.path);
      const posterItems = findPosterFiles(video.name, contents.images).map(
        (poster) => createPoster(libraryId, poster.file, poster.kind, posters),
      );
      const relativePath = path
        .relative(resolvedRoot, video.path)
        .split(path.sep)
        .join('/');

      videos.set(videoId, video.path);
      items.push({
        id: videoId,
        title: path.parse(video.name).name || video.name,
        fileName: video.name,
        libraryId,
        libraryName,
        relativePath,
        extension: path.extname(video.name).slice(1).toLowerCase(),
        size: info.size,
        modifiedAt: new Date(info.mtimeMs).toISOString(),
        videoUrl: `${LOCAL_VIDEO_PROTOCOL}://video/${libraryId}/${videoId}`,
        posters: posterItems,
      });

      report(directory);
    }
  }

  items.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  );

  return {
    library: {
      id: libraryId,
      name: libraryName,
      videos: items,
      scannedAt: new Date().toISOString(),
      truncated,
    },
    videos,
    posters,
  };
}
