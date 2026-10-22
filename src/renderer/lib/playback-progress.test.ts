import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatPlaybackPosition,
  getPlaybackProgress,
  savePlaybackProgress,
} from './playback-progress';

describe('playback progress', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and reads a resumable position', () => {
    savePlaybackProgress('connection', 'file', 125, 3600);

    expect(getPlaybackProgress('connection', 'file')).toMatchObject({
      position: 125,
      duration: 3600,
    });
  });

  it('does not persist an opening or near-end position', () => {
    savePlaybackProgress('connection', 'file', 2, 3600);
    expect(getPlaybackProgress('connection', 'file')).toBeNull();

    savePlaybackProgress('connection', 'file', 3595, 3600);
    expect(getPlaybackProgress('connection', 'file')).toBeNull();
  });

  it('formats playback positions', () => {
    expect(formatPlaybackPosition(65)).toBe('1:05');
    expect(formatPlaybackPosition(3665)).toBe('1:01:05');
  });
});
