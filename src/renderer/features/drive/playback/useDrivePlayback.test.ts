import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DriveEntry,
  DrivePlaybackResult,
  DriveResult,
  DriveSubtitle,
} from '@shared/drive';
import type { DesktopApi, DriveApi } from '@shared/ipc';
import {
  getPlaybackProgress,
  savePlaybackProgress,
} from '../../../lib/playback-progress';
import { useDrivePlayback } from './useDrivePlayback';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createEntry(id: string, name: string, pickcode: string): DriveEntry {
  return {
    id,
    parentId: '0',
    name,
    kind: 'file',
    size: 1024,
    modifiedAt: '2026-10-22T12:00:00.000Z',
    extension: 'mp4',
    durationSeconds: 3600,
    pickcode,
  };
}

const entryA = createEntry('a', 'Alpha.mp4', 'pickcode-a');
const entryB = createEntry('b', 'Bravo.mp4', 'pickcode-b');
const entryC = createEntry('c', 'Charlie.mp4', 'pickcode-c');
const entries = [entryB, entryC, entryA];

function session(sessionId: string): DriveResult<DrivePlaybackResult> {
  return {
    ok: true,
    data: {
      sessionId,
      playbackUrl: `http://127.0.0.1:9999/p/${sessionId}/master.m3u8`,
      width: 1920,
      height: 1080,
    },
  };
}

function subtitle(name: string): DriveSubtitle {
  return {
    name,
    content: `1
00:00:01,000 --> 00:00:02,000
${name}
`,
    format: 'srt',
  };
}

let startPlayback: ReturnType<typeof vi.fn<DriveApi['startPlayback']>>;
let stopPlayback: ReturnType<typeof vi.fn<DriveApi['stopPlayback']>>;
let getSubtitles: ReturnType<typeof vi.fn<DriveApi['getSubtitles']>>;

beforeEach(() => {
  window.localStorage.clear();
  startPlayback = vi
    .fn<DriveApi['startPlayback']>()
    .mockResolvedValue(session('session-a'));
  stopPlayback = vi
    .fn<DriveApi['stopPlayback']>()
    .mockResolvedValue({ ok: true, data: null });
  getSubtitles = vi
    .fn<DriveApi['getSubtitles']>()
    .mockResolvedValue({ ok: true, data: [] });

  Object.defineProperty(window, 'desktop', {
    configurable: true,
    value: {
      drive: {
        startPlayback,
        stopPlayback,
        getSubtitles,
      },
    } as unknown as DesktopApi,
  });
});

afterEach(() => {
  cleanup();
});

function renderDrivePlayback(connectionId: string | null = 'connection-1') {
  return renderHook(() =>
    useDrivePlayback({
      connectionId,
      entries,
    }),
  );
}

describe('useDrivePlayback', () => {
  it('builds a generic player model with a sorted playlist and subtitles', async () => {
    getSubtitles.mockResolvedValue({
      ok: true,
      data: [subtitle('Alpha.zh-CN.srt')],
    });

    const { result } = renderDrivePlayback();

    act(() => {
      result.current.play(entryA);
    });

    await waitFor(() => {
      expect(result.current.player?.title).toBe('Alpha.mp4');
    });

    expect(startPlayback).toHaveBeenCalledWith({
      connectionId: 'connection-1',
      pickcode: 'pickcode-a',
      fileName: 'Alpha.mp4',
    });
    expect(result.current.player?.activeId).toBe('a');
    expect(result.current.player?.source).toEqual({
      url: 'http://127.0.0.1:9999/p/session-a/master.m3u8',
      width: 1920,
      height: 1080,
    });
    expect(result.current.player?.playlist.map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(stopPlayback).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.player?.subtitleTracks).toHaveLength(1);
    });
    expect(result.current.player?.subtitleTracks[0]?.label).toBe(
      'Alpha.zh-CN.srt',
    );
  });

  it('stops the previous session only after the new video is ready', async () => {
    const nextSession = createDeferred<DriveResult<DrivePlaybackResult>>();

    startPlayback
      .mockResolvedValueOnce(session('session-a'))
      .mockReturnValueOnce(nextSession.promise);

    const { result } = renderDrivePlayback();

    act(() => {
      result.current.play(entryA);
    });
    await waitFor(() => expect(result.current.player?.activeId).toBe('a'));

    act(() => {
      result.current.selectPlaylist('b');
    });

    expect(result.current.player?.activeId).toBe('a');
    expect(result.current.player?.isSwitching).toBe(true);
    expect(stopPlayback).not.toHaveBeenCalled();

    await act(async () => {
      nextSession.resolve(session('session-b'));
    });

    await waitFor(() => expect(result.current.player?.activeId).toBe('b'));
    expect(result.current.player?.isSwitching).toBe(false);
    expect(stopPlayback).toHaveBeenCalledWith('session-a');
  });

  it('ignores stale switch results instead of overwriting the newest video', async () => {
    const slowSession = createDeferred<DriveResult<DrivePlaybackResult>>();
    const fastSession = createDeferred<DriveResult<DrivePlaybackResult>>();

    startPlayback.mockImplementation((input) => {
      if (input.pickcode === 'pickcode-a') {
        return Promise.resolve(session('session-a'));
      }

      return input.pickcode === 'pickcode-b'
        ? slowSession.promise
        : fastSession.promise;
    });

    const { result } = renderDrivePlayback();

    act(() => {
      result.current.play(entryA);
    });
    await waitFor(() => expect(result.current.player?.activeId).toBe('a'));

    act(() => {
      result.current.selectPlaylist('b');
    });
    act(() => {
      result.current.selectPlaylist('c');
    });

    await act(async () => {
      fastSession.resolve(session('session-c'));
    });
    await waitFor(() => expect(result.current.player?.activeId).toBe('c'));
    expect(stopPlayback).toHaveBeenCalledWith('session-a');

    await act(async () => {
      slowSession.resolve(session('session-b'));
    });

    expect(result.current.player?.activeId).toBe('c');
    expect(stopPlayback).toHaveBeenCalledWith('session-b');
    expect(result.current.player?.title).toBe('Charlie.mp4');
  });

  it('stops the active and in-flight sessions when closed', async () => {
    const pendingSession = createDeferred<DriveResult<DrivePlaybackResult>>();

    startPlayback
      .mockResolvedValueOnce(session('session-a'))
      .mockReturnValueOnce(pendingSession.promise);

    const { result } = renderDrivePlayback();

    act(() => {
      result.current.play(entryA);
    });
    await waitFor(() => expect(result.current.player?.activeId).toBe('a'));

    act(() => {
      result.current.selectPlaylist('b');
    });
    act(() => {
      result.current.close();
    });

    expect(result.current.player).toBeNull();
    expect(stopPlayback).toHaveBeenCalledWith('session-a');

    await act(async () => {
      pendingSession.resolve(session('session-b'));
    });

    expect(result.current.player).toBeNull();
    expect(stopPlayback).toHaveBeenCalledWith('session-b');
  });

  it('reaps a session that resolves after closing during the initial start', async () => {
    const pendingSession = createDeferred<DriveResult<DrivePlaybackResult>>();

    startPlayback.mockReturnValueOnce(pendingSession.promise);

    const { result } = renderDrivePlayback();

    act(() => {
      result.current.play(entryA);
    });
    act(() => {
      result.current.close();
    });

    expect(result.current.player).toBeNull();

    await act(async () => {
      pendingSession.resolve(session('session-a'));
    });

    expect(result.current.player).toBeNull();
    expect(stopPlayback).toHaveBeenCalledWith('session-a');
  });

  it('keeps the current player when a switch fails and maps auth errors', async () => {
    startPlayback
      .mockResolvedValueOnce(session('session-a'))
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: 'auth_required',
          message: 'Cookie expired',
        },
      });

    const { result } = renderDrivePlayback();

    act(() => {
      result.current.play(entryA);
    });
    await waitFor(() => expect(result.current.player?.activeId).toBe('a'));

    act(() => {
      result.current.selectPlaylist('b');
    });

    await waitFor(() => {
      expect(result.current.error).toBe(
        '115 登录已失效，请重新登录后继续播放。',
      );
    });
    expect(result.current.player?.activeId).toBe('a');
    expect(result.current.player?.title).toBe('Alpha.mp4');
    expect(result.current.player?.isSwitching).toBe(false);
    expect(stopPlayback).not.toHaveBeenCalled();
  });

  it('reports an initial failure and can recover on retry', async () => {
    startPlayback
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'network', message: 'offline' },
      })
      .mockResolvedValueOnce(session('session-a'));

    const { result } = renderDrivePlayback();

    act(() => {
      result.current.play(entryA);
    });

    await waitFor(() => {
      expect(result.current.error).toBe(
        '无法连接 115 服务，请检查网络后重试。',
      );
    });
    expect(result.current.player).toBeNull();

    act(() => {
      result.current.play(entryA);
    });

    await waitFor(() => expect(result.current.player?.activeId).toBe('a'));
    expect(result.current.error).toBeNull();
  });

  it('reads and writes resume progress for the active file', async () => {
    savePlaybackProgress('connection-1', 'a', 125, 3600);

    const { result } = renderDrivePlayback();

    act(() => {
      result.current.play(entryA);
    });

    await waitFor(() => expect(result.current.player?.activeId).toBe('a'));
    expect(result.current.player?.resumePosition).toBe(125);

    act(() => {
      result.current.reportProgress(130, 3600);
    });

    expect(getPlaybackProgress('connection-1', 'a')?.position).toBe(130);
  });

  it('auto-plays the next video and swaps sessions after it is ready', async () => {
    startPlayback
      .mockResolvedValueOnce(session('session-a'))
      .mockResolvedValueOnce(session('session-b'));

    const { result } = renderDrivePlayback();

    act(() => {
      result.current.play(entryA);
    });
    await waitFor(() => expect(result.current.player?.activeId).toBe('a'));

    act(() => {
      result.current.handleEnded();
    });

    await waitFor(() => expect(result.current.player?.activeId).toBe('b'));
    expect(startPlayback).toHaveBeenLastCalledWith({
      connectionId: 'connection-1',
      pickcode: 'pickcode-b',
      fileName: 'Bravo.mp4',
    });
    expect(stopPlayback).toHaveBeenCalledWith('session-a');
  });

  it('does not apply subtitles from a stale switch request', async () => {
    const alphaSubtitles =
      createDeferred<DriveResult<readonly DriveSubtitle[]>>();
    const bravoSubtitles =
      createDeferred<DriveResult<readonly DriveSubtitle[]>>();

    startPlayback
      .mockResolvedValueOnce(session('session-a'))
      .mockResolvedValueOnce(session('session-b'));
    getSubtitles.mockImplementation((fileName) =>
      fileName === 'Alpha.mp4'
        ? alphaSubtitles.promise
        : bravoSubtitles.promise,
    );

    const { result } = renderDrivePlayback();

    act(() => {
      result.current.play(entryA);
    });
    await waitFor(() => expect(result.current.player?.activeId).toBe('a'));

    act(() => {
      result.current.selectPlaylist('b');
    });
    await waitFor(() => expect(result.current.player?.activeId).toBe('b'));

    await act(async () => {
      bravoSubtitles.resolve({
        ok: true,
        data: [subtitle('Bravo.zh-CN.srt')],
      });
    });
    await waitFor(() => {
      expect(result.current.player?.subtitleTracks[0]?.label).toBe(
        'Bravo.zh-CN.srt',
      );
    });

    await act(async () => {
      alphaSubtitles.resolve({
        ok: true,
        data: [subtitle('Alpha.zh-CN.srt')],
      });
    });

    expect(result.current.player?.subtitleTracks[0]?.label).toBe(
      'Bravo.zh-CN.srt',
    );
  });
});
