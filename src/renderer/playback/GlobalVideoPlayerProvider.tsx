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
import { VideoPlayerDialog } from '../components/video-player';
import { PauseIcon, PlayIcon } from '../components/video-player/PlayerIcons';
import type { VideoPlayerDialogProps } from '../components/video-player/types';
import styles from './GlobalVideoPlayerProvider.module.css';

export interface GlobalVideoPlayerRequest extends Omit<
  VideoPlayerDialogProps,
  'isMinimized' | 'onMinimize' | 'onPlayingChange' | 'onRegisterPlaybackToggle'
> {
  /** Short label shown in the minimized dock instead of the full title. */
  readonly shortTitle?: string;
}

export interface GlobalVideoPlayerController {
  readonly player: GlobalVideoPlayerRequest | null;
  readonly showPlayer: (request: GlobalVideoPlayerRequest) => void;
  readonly hidePlayer: () => void;
  readonly restorePlayer: () => void;
}

interface GlobalVideoPlayerProviderProps {
  readonly children: ReactNode;
}

const GlobalVideoPlayerContext =
  createContext<GlobalVideoPlayerController | null>(null);

export function useGlobalVideoPlayer(): GlobalVideoPlayerController {
  const controller = useContext(GlobalVideoPlayerContext);

  if (!controller) {
    throw new Error(
      'useGlobalVideoPlayer must be used inside GlobalVideoPlayerProvider.',
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

export function GlobalVideoPlayerProvider({
  children,
}: GlobalVideoPlayerProviderProps) {
  const [player, setPlayer] = useState<GlobalVideoPlayerRequest | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const restoreButtonRef = useRef<HTMLButtonElement>(null);
  const playbackToggleRef = useRef<(() => void) | null>(null);

  const showPlayer = useCallback((request: GlobalVideoPlayerRequest) => {
    setPlayer(request);
  }, []);

  const hidePlayer = useCallback(() => {
    setPlayer(null);
    setIsMinimized(false);
    setIsPlaying(false);
  }, []);

  const restorePlayer = useCallback(() => {
    setIsMinimized(false);
  }, []);

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

  const controller = useMemo<GlobalVideoPlayerController>(
    () => ({
      hidePlayer,
      player,
      restorePlayer,
      showPlayer,
    }),
    [hidePlayer, player, restorePlayer, showPlayer],
  );

  const closePlayer = () => {
    if (!player) {
      return;
    }

    const close = player.onClose;

    hidePlayer();
    close();
  };

  return (
    <GlobalVideoPlayerContext.Provider value={controller}>
      {children}

      {player && (
        <VideoPlayerDialog
          {...player}
          isMinimized={isMinimized}
          onClose={closePlayer}
          onMinimize={() => {
            setIsMinimized(true);
          }}
          onPlayingChange={handlePlayingChange}
          onRegisterPlaybackToggle={handleRegisterPlaybackToggle}
        />
      )}

      {player && isMinimized && (
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
            aria-label={`恢复播放 ${player.title}`}
            className={styles.minimizedButton}
            ref={restoreButtonRef}
            title={player.title}
            type="button"
            onClick={restorePlayer}
          >
            <span className={styles.minimizedCopy}>
              <strong>{player.shortTitle ?? player.title}</strong>
              <small>点击恢复播放</small>
            </span>
          </button>
          <button
            aria-label={`关闭播放 ${player.title}`}
            className={styles.minimizedClose}
            title="关闭播放器"
            type="button"
            onClick={closePlayer}
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </GlobalVideoPlayerContext.Provider>
  );
}
