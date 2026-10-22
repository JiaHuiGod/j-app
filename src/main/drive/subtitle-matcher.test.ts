import { describe, expect, it } from 'vitest';
import { matchSubtitleNames } from './subtitle-matcher';

describe('subtitle matching', () => {
  it('matches a language-suffixed subtitle', () => {
    expect(
      matchSubtitleNames('ABF-122-U.mp4', [
        'ABF-123-U.zh-CN.srt',
        'ABF-122-U.zh-CN.ass',
      ]),
    ).toEqual(['ABF-122-U.zh-CN.ass']);
  });

  it('matches a catalog-number subtitle even when the video has extra prefixes', () => {
    expect(
      matchSubtitleNames('www.example.la@ABC-013.mp4', ['ABC-013.srt']),
    ).toEqual(['ABC-013.srt']);
  });

  it('rejects different episodes and catalog numbers', () => {
    expect(
      matchSubtitleNames('Show.S01E02.mkv', [
        'Show.S01E01.zh.srt',
        'Show.S01E02.zh.srt',
      ]),
    ).toEqual(['Show.S01E02.zh.srt']);

    expect(matchSubtitleNames('ABF-122-U.mp4', ['ABF-123-U.chs.srt'])).toEqual(
      [],
    );
  });

  it('keeps only subtitle file extensions', () => {
    expect(
      matchSubtitleNames('movie.mp4', [
        'movie.srt',
        'movie.txt',
        'movie.ass',
        'other.srt',
      ]),
    ).toEqual(['movie.ass', 'movie.srt']);
  });
});
