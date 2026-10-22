import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalVideoScanCanceledError, scanLocalVideoFolder } from './scanner';

let root = '';

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'japp-local-video-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function touch(relativePath: string, content = 'x'): Promise<void> {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

describe('local video scanner', () => {
  it('finds nested videos and matches poster and thumb variants only', async () => {
    await touch('movie.mp4');
    await touch('movie-poster.jpg');
    await touch('movie-thumb.webp');
    await touch('movie.jpg');
    await touch('poster.jpg');
    await touch('readme.txt');
    await touch('Season 2/episode.mkv');
    await touch('Season 2/episode-poster.png');
    await touch('Season 2/episode-thumb.jpg');
    await touch('Season 2/episode.srt');

    const result = await scanLocalVideoFolder(root, () => {});
    const library = result.library;

    expect(library.videos).toHaveLength(2);
    expect(library.truncated).toBe(false);
    expect(library.name).toMatch(/^japp-local-video-/);
    expect(library.videos.map((video) => video.relativePath)).toEqual(
      expect.arrayContaining(['Season 2/episode.mkv', 'movie.mp4']),
    );

    const movie = library.videos.find(
      (video) => video.fileName === 'movie.mp4',
    );
    const episode = library.videos.find(
      (video) => video.fileName === 'episode.mkv',
    );

    expect(movie?.posters.map((poster) => poster.name)).toEqual([
      'movie-poster.jpg',
      'movie-thumb.webp',
    ]);
    expect(movie?.posters.map((poster) => poster.kind)).toEqual([
      'poster',
      'thumb',
    ]);
    expect(episode?.posters.map((poster) => poster.name)).toEqual([
      'episode-poster.png',
      'episode-thumb.jpg',
    ]);
    expect(movie?.libraryName).toBe(library.name);
    expect(movie?.videoUrl).toMatch(/^japp-local:\/\/video\//);
    expect(movie?.posters[0]?.url).toMatch(/^japp-local:\/\/poster\//);
  });

  it('keeps stable video ids between rescans and ignores hidden directories', async () => {
    await touch('movie.mp4');
    await touch('.secret/hidden.mp4');

    const first = await scanLocalVideoFolder(root, () => {});
    const second = await scanLocalVideoFolder(root, () => {});

    expect(first.library.videos).toHaveLength(1);
    expect(second.library.videos[0]?.id).toBe(first.library.videos[0]?.id);
    expect(second.library.id).toBe(first.library.id);
  });

  it('rejects an already aborted scan', async () => {
    await touch('movie.mp4');
    const controller = new AbortController();
    controller.abort();

    await expect(
      scanLocalVideoFolder(root, () => {}, controller.signal),
    ).rejects.toBeInstanceOf(LocalVideoScanCanceledError);
  });
});
