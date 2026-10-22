import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSubtitleDirectory } from '../settings/store';
import { getLocalSubtitles } from './subtitles';

vi.mock('../settings/store', () => ({
  getSubtitleDirectory: vi.fn<() => Promise<string | null>>(),
}));

describe('local subtitle loading', () => {
  let directory: string | null = null;

  afterEach(async () => {
    if (directory) {
      await rm(directory, { recursive: true, force: true });
      directory = null;
    }
  });

  it('loads only matching subtitle files from the configured directory', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'japp-subtitles-'));
    await writeFile(
      path.join(directory, 'movie.zh-CN.srt'),
      '1\n00:00:01,000 --> 00:00:02,000\n你好\n',
      'utf8',
    );
    await writeFile(
      path.join(directory, 'other.srt'),
      '1\n00:00:01,000 --> 00:00:02,000\n其他\n',
      'utf8',
    );
    vi.mocked(getSubtitleDirectory).mockResolvedValue(directory);

    const result = await getLocalSubtitles('movie.mp4');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      name: 'movie.zh-CN.srt',
      format: 'srt',
    });
    expect(result.data[0]?.content).toContain('你好');
  });
});
