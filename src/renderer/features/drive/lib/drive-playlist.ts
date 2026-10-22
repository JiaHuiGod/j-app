import type { DriveEntry } from '@shared/drive';
import { getFileKind } from '../../../lib/file-kind';

const DOWNLOAD_PREFIX = /^www\.[^@]+@/i;
const FILE_EXTENSION = /\.[^.]+$/;

export function isVideoEntry(entry: DriveEntry): boolean {
  return entry.kind === 'file' && getFileKind(entry.extension) === 'video';
}

/**
 * Current-directory videos in natural filename order. Ordering lives here so
 * every playback consumer sees the same playlist.
 */
export function listVideoEntries(
  entries: readonly DriveEntry[],
): readonly DriveEntry[] {
  return entries.filter(isVideoEntry).sort((left, right) =>
    left.name.localeCompare(right.name, 'zh-CN', {
      numeric: true,
      sensitivity: 'base',
    }),
  );
}

/**
 * 115 sometimes returns `www.<host>@<name>` download names. The playlist keeps
 * the full title for tooltips but shows the compact name.
 */
export function compactDriveFileName(name: string): string {
  return name.replace(DOWNLOAD_PREFIX, '').replace(FILE_EXTENSION, '');
}
