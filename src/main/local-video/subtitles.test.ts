import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSubtitleDirectory } from '../settings/store';
import { readLocalVideoSubtitles } from './subtitles';

vi.mock('../settings/store', () => ({
  getSubtitleDirectory: vi.fn<() => Promise<string | null>>(),
}));

let root = '';
let configuredDirectory: string | null = null;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'japp-local-subtitles-'));
  vi.mocked(getSubtitleDirectory).mockResolvedValue(null);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });

  if (configuredDirectory) {
    await rm(configuredDirectory, { recursive: true, force: true });
    configuredDirectory = null;
  }
});

describe('local video subtitles', () => {
  it('uses the shared fuzzy matcher for sibling subtitles', async () => {
    const videoPath = path.join(root, 'STARS-250-C.mp4');

    await writeFile(videoPath, 'video');
    await writeFile(
      path.join(root, 'STARS-250-C.srt'),
      '1\n00:00:01,000 --> 00:00:02,000\nHello\n',
    );
    await writeFile(
      path.join(root, 'STARS-250-C.zh-CN.srt'),
      '1\n00:00:01,000 --> 00:00:02,000\n你好\n',
    );
    await writeFile(
      path.join(root, 'STARS-250-C-thumb.vtt'),
      'WEBVTT\n\n00:01.000 --> 00:02.000\nThumb\n',
    );
    await writeFile(
      path.join(root, 'STARS-250-C.ass'),
      '[Script Info]\nTitle: Test\n',
    );
    await writeFile(path.join(root, 'OTHER.mp4'), 'video');
    await writeFile(
      path.join(root, 'OTHER.srt'),
      '1\n00:00:01,000 --> 00:00:02,000\nOther\n',
    );

    const tracks = await readLocalVideoSubtitles(videoPath);

    expect(tracks.map((track) => track.label)).toEqual([
      'STARS-250-C.ass',
      'STARS-250-C.srt',
      'STARS-250-C.zh-CN.srt',
      'STARS-250-C-thumb.vtt',
    ]);
    expect(tracks.map((track) => track.format)).toEqual([
      'ass',
      'srt',
      'srt',
      'vtt',
    ]);
    expect(tracks[0]?.content).toContain('[Script Info]');
    expect(tracks[1]?.content).toContain('Hello');
    expect(tracks[2]?.content).toContain('你好');
    expect(tracks[3]?.content).toContain('WEBVTT');
  });

  it('matches a shortened subtitle name such as ADN-503.srt', async () => {
    const videoPath = path.join(root, 'ADN-503-C.mp4');

    await writeFile(videoPath, 'video');
    await writeFile(
      path.join(root, 'ADN-503.srt'),
      '1\n00:00:01,000 --> 00:00:02,000\n匹配成功\n',
    );

    const tracks = await readLocalVideoSubtitles(videoPath);

    expect(tracks.map((track) => track.label)).toEqual(['ADN-503.srt']);
    expect(tracks[0]?.content).toContain('匹配成功');
  });

  it('matches the configured subtitle directory used by 115 playback', async () => {
    configuredDirectory = await mkdtemp(
      path.join(tmpdir(), 'japp-local-subtitles-configured-'),
    );
    const videoPath = path.join(root, 'ADN-503-C.mp4');

    await writeFile(videoPath, 'video');
    await writeFile(
      path.join(configuredDirectory, 'ADN-503.zh-CN.srt'),
      '1\n00:00:01,000 --> 00:00:02,000\n设置目录字幕\n',
    );
    vi.mocked(getSubtitleDirectory).mockResolvedValue(configuredDirectory);

    const tracks = await readLocalVideoSubtitles(videoPath);

    expect(tracks.map((track) => track.label)).toEqual(['ADN-503.zh-CN.srt']);
    expect(tracks[0]?.content).toContain('设置目录字幕');
  });

  it('decodes UTF-16LE SRT content', async () => {
    const videoPath = path.join(root, 'movie.mp4');
    const content = '1\n00:00:01,000 --> 00:00:02,000\n字幕\n';
    const buffer = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(content, 'utf16le'),
    ]);

    await writeFile(videoPath, 'video');
    await writeFile(path.join(root, 'movie.srt'), buffer);

    const tracks = await readLocalVideoSubtitles(videoPath);

    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.content).toContain('字幕');
  });

  it('falls back to GB18030 for legacy Chinese subtitles', async () => {
    const videoPath = path.join(root, 'movie.mp4');
    const buffer = Buffer.concat([
      Buffer.from('1\n00:00:01,000 --> 00:00:02,000\n'),
      Buffer.from([0xc4, 0xe3, 0xba, 0xc3]),
      Buffer.from('\n'),
    ]);

    await writeFile(videoPath, 'video');
    await writeFile(path.join(root, 'movie.srt'), buffer);

    const tracks = await readLocalVideoSubtitles(videoPath);

    expect(tracks[0]?.content).toContain('你好');
  });
});
