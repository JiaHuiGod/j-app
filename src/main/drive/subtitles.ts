import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  DriveResult,
  DriveSubtitle,
  DriveSubtitleFormat,
} from '@shared/drive';
import { getSubtitleDirectory } from '../settings/store';
import { isSubtitleFile, matchSubtitleNames } from './subtitle-matcher';

const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;
const MAX_SUBTITLE_COUNT = 10;

function failure<T>(message: string): DriveResult<T> {
  return {
    ok: false,
    error: {
      code: 'invalid_input',
      message,
    },
  };
}

function formatOf(name: string): DriveSubtitleFormat | null {
  const extension = name.split('.').pop()?.toLowerCase();

  return extension === 'ass' ||
    extension === 'srt' ||
    extension === 'ssa' ||
    extension === 'vtt'
    ? extension
    : null;
}

function decodeSubtitle(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');

  if (!utf8.includes('\uFFFD')) {
    return utf8;
  }

  try {
    return new TextDecoder('gbk').decode(buffer);
  } catch {
    return utf8;
  }
}

export async function getLocalSubtitles(
  videoName: unknown,
): Promise<DriveResult<readonly DriveSubtitle[]>> {
  if (typeof videoName !== 'string' || !videoName.trim()) {
    return failure('视频文件名不正确。');
  }

  const directory = await getSubtitleDirectory().catch(() => null);

  if (!directory) {
    return { ok: true, data: [] };
  }

  let entries: string[];

  try {
    entries = await readdir(directory);
  } catch {
    return { ok: true, data: [] };
  }

  const videoBaseName = path.basename(videoName.trim());
  const matched = matchSubtitleNames(videoBaseName, entries).slice(
    0,
    MAX_SUBTITLE_COUNT,
  );
  const subtitles: DriveSubtitle[] = [];

  for (const name of matched) {
    if (!isSubtitleFile(name)) {
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

      if (content.trim()) {
        subtitles.push({ name, content, format });
      }
    } catch {
      // Ignore unreadable or deleted subtitle files.
    }
  }

  return { ok: true, data: subtitles };
}
