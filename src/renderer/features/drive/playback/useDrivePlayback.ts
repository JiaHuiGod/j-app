import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DriveEntry,
  DriveError,
  DrivePlaybackResult,
} from '@shared/drive';
import type {
  VideoPlaylistItem,
  VideoPlayerSource,
  VideoSubtitleTrack,
} from '../../../components/video-player/types';
import { compactDriveFileName, listVideoEntries } from '../lib/drive-playlist';
import { toErrorMessage } from '../../../lib/errors';
import {
  getPlaybackProgress,
  savePlaybackProgress,
} from '../../../lib/playback-progress';

interface UseDrivePlaybackOptions {
  readonly connectionId: string | null;
  readonly entries: readonly DriveEntry[];
}

interface ActiveDrivePlayback {
  readonly entry: DriveEntry;
  readonly playback: DrivePlaybackResult;
  readonly resumePosition: number | null;
}

export interface DrivePlaybackPlayer {
  readonly activeId: string;
  readonly title: string;
  readonly source: VideoPlayerSource;
  readonly playlist: readonly VideoPlaylistItem[];
  readonly subtitleTracks: readonly VideoSubtitleTrack[];
  readonly resumePosition: number | null;
  readonly isSwitching: boolean;
}

export interface UseDrivePlaybackResult {
  readonly player: DrivePlaybackPlayer | null;
  readonly isStarting: boolean;
  readonly error: string | null;
  readonly play: (entry: DriveEntry) => void;
  readonly selectPlaylist: (entryId: string) => void;
  readonly retry: () => void;
  readonly close: () => void;
  readonly dismissError: () => void;
  readonly reportProgress: (position: number, duration: number) => void;
  readonly handleEnded: () => void;
}

function mapPlaybackError(error: DriveError): string {
  switch (error.code) {
    case 'auth_required':
      return '115 登录已失效，请重新登录后继续播放。';
    case 'no_account':
      return '尚未连接 115 账号，请先登录。';
    case 'network':
      return '无法连接 115 服务，请检查网络后重试。';
    case 'invalid_input':
      return error.message || '视频播放参数不正确。';
    default:
      return error.message || '无法获取视频播放地址，请稍后重试。';
  }
}

export function useDrivePlayback({
  connectionId,
  entries,
}: UseDrivePlaybackOptions): UseDrivePlaybackResult {
  const videos = useMemo(() => listVideoEntries(entries), [entries]);
  const [active, setActive] = useState<ActiveDrivePlayback | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subtitleTracks, setSubtitleTracks] = useState<
    readonly VideoSubtitleTrack[]
  >([]);
  const activeRef = useRef<ActiveDrivePlayback | null>(null);
  const requestIdRef = useRef(0);
  const videosRef = useRef(videos);
  const connectionIdRef = useRef(connectionId);
  const previousConnectionIdRef = useRef(connectionId);

  useEffect(() => {
    videosRef.current = videos;
    connectionIdRef.current = connectionId;
  }, [connectionId, videos]);

  const stopSession = useCallback((sessionId: string) => {
    void window.desktop.drive.stopPlayback(sessionId).catch(() => undefined);
  }, []);

  const releaseActivePlayback = useCallback(() => {
    const current = activeRef.current;

    activeRef.current = null;
    setActive(null);
    setSubtitleTracks([]);
    setIsStarting(false);

    if (current) {
      stopSession(current.playback.sessionId);
    }
  }, [stopSession]);

  const startPlayback = useCallback(
    async (entry: DriveEntry): Promise<void> => {
      const targetConnectionId = connectionId;

      if (!targetConnectionId || !entry.pickcode) {
        return;
      }

      const requestId = ++requestIdRef.current;
      const previous = activeRef.current;
      const savedProgress = getPlaybackProgress(targetConnectionId, entry.id);
      const resumePosition = savedProgress?.position ?? null;

      setIsStarting(true);
      setError(null);

      try {
        const result = await window.desktop.drive.startPlayback({
          connectionId: targetConnectionId,
          pickcode: entry.pickcode,
          fileName: entry.name,
        });

        if (requestId !== requestIdRef.current) {
          // A newer request (or close) won the race. Reap this session
          // immediately instead of letting it leak.
          if (result.ok) {
            stopSession(result.data.sessionId);
          }

          return;
        }

        if (!result.ok) {
          setError(mapPlaybackError(result.error));
          return;
        }

        const next: ActiveDrivePlayback = {
          entry,
          playback: result.data,
          resumePosition,
        };

        activeRef.current = next;
        setActive(next);

        // The new session is already the active one; only now tear down the
        // previous session so a failed switch keeps the current player alive.
        if (previous && previous.playback.sessionId !== result.data.sessionId) {
          stopSession(previous.playback.sessionId);
        }
      } catch (playFailure: unknown) {
        if (requestId === requestIdRef.current) {
          setError(
            toErrorMessage(playFailure, '无法开始播放视频，请稍后重试。'),
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsStarting(false);
        }
      }
    },
    [connectionId, stopSession],
  );

  const close = useCallback(() => {
    // Invalidate every request still in flight. If one resolves later, the
    // stale-result branch stops its session and no UI state is written.
    requestIdRef.current += 1;
    setError(null);
    releaseActivePlayback();
  }, [releaseActivePlayback]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;

      const current = activeRef.current;

      activeRef.current = null;

      if (current) {
        stopSession(current.playback.sessionId);
      }
    };
  }, [stopSession]);

  useEffect(() => {
    if (previousConnectionIdRef.current === connectionId) {
      return;
    }

    previousConnectionIdRef.current = connectionId;
    close();
  }, [close, connectionId]);

  const play = useCallback(
    (entry: DriveEntry) => {
      void startPlayback(entry);
    },
    [startPlayback],
  );

  const selectPlaylist = useCallback(
    (entryId: string) => {
      if (entryId === activeRef.current?.entry.id) {
        return;
      }

      const target = videosRef.current.find((entry) => entry.id === entryId);

      if (target) {
        void startPlayback(target);
      }
    },
    [startPlayback],
  );

  const retry = useCallback(() => {
    const current = activeRef.current;

    if (current) {
      void startPlayback(current.entry);
    }
  }, [startPlayback]);

  const handleEnded = useCallback(() => {
    const current = activeRef.current;

    if (!current) {
      return;
    }

    const list = videosRef.current;
    const index = list.findIndex((entry) => entry.id === current.entry.id);
    const next = index >= 0 ? list[index + 1] : undefined;

    if (next) {
      void startPlayback(next);
    }
  }, [startPlayback]);

  const reportProgress = useCallback((position: number, duration: number) => {
    const current = activeRef.current;
    const currentConnectionId = connectionIdRef.current;

    if (!current || !currentConnectionId) {
      return;
    }

    savePlaybackProgress(
      currentConnectionId,
      current.entry.id,
      position,
      duration,
    );
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const activeEntryId = active?.entry.id ?? null;
  const activeEntryName = active?.entry.name ?? null;

  useEffect(() => {
    if (!activeEntryId || !activeEntryName) {
      setSubtitleTracks([]);
      return;
    }

    let isCurrent = true;

    setSubtitleTracks([]);
    void window.desktop.drive
      .getSubtitles(activeEntryName)
      .then((result) => {
        if (!isCurrent || !result.ok) {
          return;
        }

        setSubtitleTracks(
          result.data.map((subtitle) => ({
            id: subtitle.name,
            label: subtitle.name,
            content: subtitle.content,
            format: subtitle.format,
          })),
        );
      })
      .catch(() => {
        // Subtitles are optional.
      });

    return () => {
      isCurrent = false;
    };
  }, [activeEntryId, activeEntryName]);

  const playlist = useMemo<readonly VideoPlaylistItem[]>(
    () =>
      videos.map((entry) => ({
        id: entry.id,
        title: entry.name,
        displayTitle: compactDriveFileName(entry.name),
      })),
    [videos],
  );

  const player = useMemo<DrivePlaybackPlayer | null>(() => {
    if (!active) {
      return null;
    }

    return {
      activeId: active.entry.id,
      title: active.entry.name,
      source: {
        url: active.playback.playbackUrl,
        width: active.playback.width,
        height: active.playback.height,
      },
      playlist,
      subtitleTracks,
      resumePosition: active.resumePosition,
      isSwitching: isStarting,
    };
  }, [active, isStarting, playlist, subtitleTracks]);

  return {
    player,
    isStarting,
    error,
    play,
    selectPlaylist,
    retry,
    close,
    dismissError,
    reportProgress,
    handleEnded,
  };
}
