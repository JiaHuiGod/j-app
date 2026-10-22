import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { DriveEntry } from '@shared/drive';
import { VideoPlayerDialog } from '../components/video-player';
import { PauseIcon, PlayIcon } from '../components/video-player/PlayerIcons';
import { useDrivePlayback } from '../hooks/useDrivePlayback';
import { compactDriveFileName } from '../lib/drive-playlist';
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

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
      viewBox="0 0 16 16"
    >
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
    </svg>
  );
}

export function DrivePlaybackProvider({
  children,
}: DrivePlaybackProviderProps) {
  const [playlistContext, setPlaylistContext] = useState<PlaylistContext>({
    connectionId: null,
    entries: [],
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const restoreButtonRef = useRef<HTMLButtonElement>(null);
  const playbackToggleRef = useRef<(() => void) | null>(null);
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
      setIsMinimized(false);
      playPlayback(entry);
    },
    [playPlayback],
  );

  const close = useCallback(() => {
    setIsMinimized(false);
    closePlayback();
  }, [closePlayback]);

  const minimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restore = useCallback(() => {
    setIsMinimized(false);
  }, []);

  useEffect(() => {
    if (!playback.player) {
      setIsMinimized(false);
      setIsPlaying(false);
    }
  }, [playback.player]);

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleRegisterPlaybackToggle = useCallback(
    (toggle: (() => void) | null) => {
      playbackToggleRef.current = toggle;
    },
    [],
  );

  const handleTogglePlayback = useCallback(() => {
    playbackToggleRef.current?.();
  }, []);

  useEffect(() => {
    if (isMinimized) {
      restoreButtonRef.current?.focus();
    }
  }, [isMinimized]);

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

      {playback.player && (
        <VideoPlayerDialog
          activeId={playback.player.activeId}
          isMinimized={isMinimized}
          isLoading={playback.player.isSwitching}
          kicker="115 / PLAYBACK"
          playlist={playback.player.playlist}
          resumePosition={playback.player.resumePosition}
          source={playback.player.source}
          subtitleTracks={playback.player.subtitleTracks}
          title={playback.player.title}
          onClose={close}
          onEnded={playback.handleEnded}
          onMinimize={minimize}
          onPlayingChange={handlePlayingChange}
          onProgress={playback.reportProgress}
          onRegisterPlaybackToggle={handleRegisterPlaybackToggle}
          onRetry={playback.retry}
          onSelectPlaylist={playback.selectPlaylist}
        />
      )}

      {playback.player && isMinimized && (
        <div className={styles.minimizedDock}>
          <button
            aria-label={isPlaying ? '暂停视频' : '播放视频'}
            className={styles.minimizedPlay}
            title={isPlaying ? '暂停' : '播放'}
            type="button"
            onClick={handleTogglePlayback}
          >
            {isPlaying ? (
              <PauseIcon className={styles.minimizedPlayIcon} />
            ) : (
              <PlayIcon className={styles.minimizedPlayIcon} />
            )}
          </button>
          <button
            aria-label={`恢复播放 ${playback.player.title}`}
            className={styles.minimizedButton}
            ref={restoreButtonRef}
            title={playback.player.title}
            type="button"
            onClick={restore}
          >
            <span className={styles.minimizedCopy}>
              <strong>{compactDriveFileName(playback.player.title)}</strong>
              <small>点击恢复播放</small>
            </span>
          </button>
          <button
            aria-label={`关闭播放 ${playback.player.title}`}
            className={styles.minimizedClose}
            title="关闭播放器"
            type="button"
            onClick={close}
          >
            <CloseIcon />
          </button>
        </div>
      )}

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
