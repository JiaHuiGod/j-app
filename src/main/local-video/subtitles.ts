import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  LocalVideoSubtitle,
  LocalVideoSubtitleFormat,
} from '@shared/local-video';
import { getSubtitleDirectory } from '../settings/store';
import { isSubtitleFile, matchSubtitleNames } from '../drive/subtitle-matcher';

const SUBTITLE_FORMATS: Readonly<Record<string, LocalVideoSubtitleFormat>> = {
  ass: 'ass',
  ssa: 'ssa',
  srt: 'srt',
  vtt: 'vtt',
};
const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;
const MAX_SUBTITLE_TRACKS = 10;

function directoryIdentity(directory: string): string {
  const resolved = path.resolve(directory);

  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function formatOf(name: string): LocalVideoSubtitleFormat | null {
  return SUBTITLE_FORMATS[path.extname(name).slice(1).toLowerCase()] ?? null;
}

function decodeSubtitle(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb) {
    return new TextDecoder('utf-8').decode(buffer.subarray(3));
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer.subarray(2));
  }

  const utf8 = new TextDecoder('utf-8').decode(buffer);

  if (!utf8.includes('\uFFFD')) {
    return utf8;
  }

  try {
    return new TextDecoder('gb18030').decode(buffer);
  } catch {
    return utf8;
  }
}

async function readTracksFromDirectory(
  directory: string,
  videoName: string,
  seenNames: Set<string>,
  limit: number,
): Promise<LocalVideoSubtitle[]> {
  let entries: string[];

  try {
    entries = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const matched = matchSubtitleNames(videoName, entries);
  const tracks: LocalVideoSubtitle[] = [];

  for (const name of matched) {
    if (tracks.length >= limit) {
      break;
    }

    if (seenNames.has(name) || !isSubtitleFile(name)) {
      continue;
    }

    const format = formatOf(name);

    if (!format) {
      continue;
    }

    const filePath = path.join(directory, name);
    const info = await stat(filePath).catch(() => null);

    if (!info?.isFile() || info.size > MAX_SUBTITLE_BYTES) {
      continue;
    }

    try {
      const content = decodeSubtitle(await readFile(filePath));

      if (!content.trim()) {
        continue;
      }

      seenNames.add(name);
      tracks.push({
        id: createHash('sha1').update(filePath).digest('hex').slice(0, 16),
        label: name,
        content,
        format,
      });
    } catch {
      // A broken subtitle should not block video playback.
    }
  }

  return tracks;
}

export async function readLocalVideoSubtitles(
  videoPath: string,
): Promise<readonly LocalVideoSubtitle[]> {
  const videoName = path.basename(videoPath);
  const configuredDirectory = await getSubtitleDirectory().catch(() => null);
  const directories: string[] = [];

  if (configuredDirectory) {
    directories.push(configuredDirectory);
  }

  directories.push(path.dirname(videoPath));

  const seenDirectories = new Set<string>();
  const seenNames = new Set<string>();
  const tracks: LocalVideoSubtitle[] = [];

  for (const directory of directories) {
    if (tracks.length >= MAX_SUBTITLE_TRACKS) {
      break;
    }

    const identity = directoryIdentity(directory);

    if (seenDirectories.has(identity)) {
      continue;
    }

    seenDirectories.add(identity);
    tracks.push(
      ...(await readTracksFromDirectory(
        directory,
        videoName,
        seenNames,
        MAX_SUBTITLE_TRACKS - tracks.length,
      )),
    );
  }

  return tracks;
}
