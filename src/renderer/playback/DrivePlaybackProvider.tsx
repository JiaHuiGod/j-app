import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DriveEntry } from '@shared/drive';
import { useDrivePlayback } from '../hooks/useDrivePlayback';
import { compactDriveFileName } from '../lib/drive-playlist';
import { useGlobalVideoPlayer } from './GlobalVideoPlayerProvider';
import styles from './DrivePlaybackProvider.module.css';

interface PlaylistContext {
  readonly connectionId: string | null;
  readonly entries: readonly DriveEntry[];
}

interface DrivePlaybackController {
  readonly isStarting: boolean;
  readonly play: (entry: DriveEntry) => void;
  readonly setPlaylist: (
    connectionId: string | null,
    entries: readonly DriveEntry[],
  ) => void;
}

interface DrivePlaybackProviderProps {
  readonly children: ReactNode;
}

const DrivePlaybackContext = createContext<DrivePlaybackController | null>(
  null,
);

export function useDrivePlaybackController(): DrivePlaybackController {
  const controller = useContext(DrivePlaybackContext);

  if (!controller) {
    throw new Error(
      'useDrivePlaybackController must be used inside DrivePlaybackProvider.',
    );
  }

  return controller;
}

export function DrivePlaybackProvider({
  children,
}: DrivePlaybackProviderProps) {
  const [playlistContext, setPlaylistContext] = useState<PlaylistContext>({
    connectionId: null,
    entries: [],
  });
  const { hidePlayer, restorePlayer, showPlayer } = useGlobalVideoPlayer();
  const playback = useDrivePlayback({
    connectionId: playlistContext.connectionId,
    entries: playlistContext.entries,
  });
  const playPlayback = playback.play;
  const closePlayback = playback.close;

  const setPlaylist = useCallback(
    (connectionId: string | null, entries: readonly DriveEntry[]) => {
      setPlaylistContext((current) =>
        current.connectionId === connectionId && current.entries === entries
          ? current
          : { connectionId, entries },
      );
    },
    [],
  );

  const play = useCallback(
    (entry: DriveEntry) => {
      restorePlayer();
      playPlayback(entry);
    },
    [playPlayback, restorePlayer],
  );

  const close = useCallback(() => {
    closePlayback();
  }, [closePlayback]);

  useEffect(() => {
    if (!playback.player) {
      hidePlayer();
      return;
    }

    const player = playback.player;

    showPlayer({
      activeId: player.activeId,
      isLoading: player.isSwitching,
      kicker: '115 / PLAYBACK',
      playlist: player.playlist,
      resumePosition: player.resumePosition,
      shortTitle: compactDriveFileName(player.title),
      source: player.source,
      subtitleTracks: player.subtitleTracks,
      title: player.title,
      onClose: close,
      onEnded: playback.handleEnded,
      onProgress: playback.reportProgress,
      onRetry: playback.retry,
      onSelectPlaylist: playback.selectPlaylist,
    });
  }, [
    close,
    hidePlayer,
    playback.handleEnded,
    playback.player,
    playback.reportProgress,
    playback.retry,
    playback.selectPlaylist,
    showPlayer,
  ]);

  useEffect(() => {
    return () => {
      hidePlayer();
    };
  }, [hidePlayer]);

  const controller = useMemo<DrivePlaybackController>(
    () => ({
      isStarting: playback.isStarting,
      play,
      setPlaylist,
    }),
    [playback.isStarting, play, setPlaylist],
  );

  return (
    <DrivePlaybackContext.Provider value={controller}>
      {children}

      {playback.error && (
        <div className={styles.errorToast} role="alert">
          <span>{playback.error}</span>
          <button
            aria-label="关闭播放错误提示"
            type="button"
            onClick={playback.dismissError}
          >
            ×
          </button>
        </div>
      )}
    </DrivePlaybackContext.Provider>
  );
}
