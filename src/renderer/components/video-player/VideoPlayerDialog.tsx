import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from 'react';
import Hls from 'hls.js';
import { formatPlaybackPosition } from '../../lib/playback-progress';
import { findActiveSubtitle, parseSubtitle } from '../../lib/subtitles';
import { MinimizePlayerIcon } from './PlayerIcons';
import { VideoPlayerDrawer } from './VideoPlayerDrawer';
import { VideoPlayerToolbar, type PlayerMenu } from './VideoPlayerToolbar';
import { useVideoMediaState } from './useVideoMediaState';
import type { VideoPlayerDialogProps } from './types';
import styles from './VideoPlayerDialog.module.css';

const MIN_RESUME_SECONDS = 5;
const RESUME_TAIL_SECONDS = 5;
const RESUME_NOTICE_MS = 8000;
const PROGRESS_INTERVAL_MS = 5000;
const PROGRESS_THROTTLE_MS = 4000;
const SUBTITLE_DELAY_LIMIT_SECONDS = 10;
const DEFAULT_KICKER = 'PLAYBACK';
const TOOLBAR_HIDE_MS = 2500;
const STAGE_CLICK_DELAY_MS = 220;
const PLAYER_OPEN_ANIMATION_MS = 320;
const PLAYER_MINIMIZE_ANIMATION_MS = 280;
const PLAYER_ANIMATION_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

function CloseIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M7 5.5h9M7 10h9M7 14.5h9M4 5.5h.01M4 10h.01M4 14.5h.01" />
    </svg>
  );
}

function preferReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function VideoPlayerDialog({
  title,
  source,
  playlist,
  activeId,
  subtitleTracks,
  resumePosition,
  isMinimized,
  isLoading = false,
  error = null,
  kicker = DEFAULT_KICKER,
  onProgress,
  onEnded,
  onSelectPlaylist,
  onRetry,
  onClose,
  onMinimize,
  onPlayingChange,
  onRegisterPlaybackToggle,
}: VideoPlayerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  const lastProgressAtRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const progressReadyRef = useRef(false);
  const wasPlayingBeforeLoadingRef = useRef(false);
  const toolbarHideTimerRef = useRef<number | null>(null);
  const stageClickTimerRef = useRef<number | null>(null);
  const openAnimationRef = useRef<Animation | null>(null);
  const minimizeAnimationRef = useRef<Animation | null>(null);
  const minimizeTimerRef = useRef<number | null>(null);
  const keepToolbarVisibleRef = useRef(true);
  const focusFromPointerRef = useRef(false);
  const previousActiveIdRef = useRef(activeId);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [runtimeError, setRuntimeError] = useState('');
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [activeCue, setActiveCue] = useState('');
  const [resumeNotice, setResumeNotice] = useState(false);
  const [activeMenu, setActiveMenu] = useState<PlayerMenu | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [isToolbarFocused, setIsToolbarFocused] = useState(false);
  const [isToolbarHovered, setIsToolbarHovered] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const media = useVideoMediaState(videoRef, stageRef, source.url);
  const mediaRef = useRef(media);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  useEffect(() => {
    onPlayingChange?.(media.isPlaying);
  }, [media.isPlaying, onPlayingChange]);

  useEffect(() => {
    if (!onRegisterPlaybackToggle) {
      return;
    }

    onRegisterPlaybackToggle(media.togglePlay);

    return () => {
      onRegisterPlaybackToggle(null);
    };
  }, [media.togglePlay, onRegisterPlaybackToggle]);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onEndedRef.current = onEnded;
  }, [onEnded, onProgress]);

  const displayedError = error ?? runtimeError;
  const keepToolbarVisible =
    !media.isPlaying ||
    activeMenu !== null ||
    isScrubbing ||
    isToolbarFocused ||
    isToolbarHovered ||
    isLoading ||
    Boolean(displayedError);

  const revealToolbar = useCallback(() => {
    setToolbarVisible(true);

    if (toolbarHideTimerRef.current !== null) {
      window.clearTimeout(toolbarHideTimerRef.current);
      toolbarHideTimerRef.current = null;
    }

    if (keepToolbarVisibleRef.current) {
      return;
    }

    toolbarHideTimerRef.current = window.setTimeout(() => {
      toolbarHideTimerRef.current = null;

      if (!keepToolbarVisibleRef.current) {
        setToolbarVisible(false);
      }
    }, TOOLBAR_HIDE_MS);
  }, []);

  useEffect(() => {
    keepToolbarVisibleRef.current = keepToolbarVisible;
    revealToolbar();
  }, [keepToolbarVisible, revealToolbar]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const handleActivity = () => {
      revealToolbar();
    };

    stage.addEventListener('pointermove', handleActivity);
    stage.addEventListener('pointerdown', handleActivity);

    return () => {
      stage.removeEventListener('pointermove', handleActivity);
      stage.removeEventListener('pointerdown', handleActivity);
    };
  }, [revealToolbar]);

  useEffect(() => {
    if (!isMinimized) {
      revealToolbar();
    }
  }, [isMinimized, revealToolbar]);

  useEffect(() => {
    if (isMinimized) {
      setActiveMenu(null);
      setIsToolbarFocused(false);
      setIsToolbarHovered(false);
      setIsScrubbing(false);
    }
  }, [isMinimized]);

  useEffect(() => {
    if (previousActiveIdRef.current === activeId) {
      return;
    }

    previousActiveIdRef.current = activeId;
    setActiveMenu(null);
  }, [activeId]);

  useEffect(() => {
    return () => {
      if (toolbarHideTimerRef.current !== null) {
        window.clearTimeout(toolbarHideTimerRef.current);
      }

      if (stageClickTimerRef.current !== null) {
        window.clearTimeout(stageClickTimerRef.current);
      }
    };
  }, []);

  const reportProgress = useCallback((force = false) => {
    const video = videoRef.current;

    if (
      !progressReadyRef.current ||
      !video ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      return;
    }

    const now = Date.now();

    if (!force && now - lastProgressAtRef.current < PROGRESS_THROTTLE_MS) {
      return;
    }

    lastProgressAtRef.current = now;
    onProgressRef.current(video.currentTime, video.duration);
  }, []);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isMinimized) {
      openAnimationRef.current?.cancel();
      openAnimationRef.current = null;

      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }

      return;
    }

    setIsMinimizing(false);
    minimizeAnimationRef.current?.cancel();
    minimizeAnimationRef.current = null;

    if (minimizeTimerRef.current !== null) {
      window.clearTimeout(minimizeTimerRef.current);
      minimizeTimerRef.current = null;
    }

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    focusFromPointerRef.current = true;
    dialog.focus();

    if (!preferReducedMotion() && typeof dialog.animate === 'function') {
      openAnimationRef.current?.cancel();
      openAnimationRef.current = dialog.animate(
        [
          {
            filter: 'blur(3px)',
            opacity: 0,
            transform: 'scale(0.12, 0.06)',
          },
          {
            filter: 'blur(0px)',
            opacity: 1,
            transform: 'scale(1, 1)',
          },
        ],
        {
          duration: PLAYER_OPEN_ANIMATION_MS,
          easing: PLAYER_ANIMATION_EASING,
        },
      );
    }

    return () => {
      openAnimationRef.current?.cancel();
      openAnimationRef.current = null;

      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    };
  }, [isMinimized]);

  useEffect(() => {
    return () => {
      openAnimationRef.current?.cancel();
      minimizeAnimationRef.current?.cancel();

      if (minimizeTimerRef.current !== null) {
        window.clearTimeout(minimizeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia('(max-width: 900px)');
    const handleChange = () => {
      if (query.matches) {
        setSidebarOpen(false);
      }
    };

    query.addEventListener('change', handleChange);

    return () => {
      query.removeEventListener('change', handleChange);
    };
  }, []);

  const subtitleSignature = useMemo(
    () => subtitleTracks.map((track) => track.id).join('\u0000'),
    [subtitleTracks],
  );
  const subtitleTrackCount = subtitleTracks.length;

  useEffect(() => {
    const isActiveVideo = activeId !== null;
    const hasSubtitleSignature = subtitleSignature.length > 0;

    setSubtitleIndex(
      (isActiveVideo || hasSubtitleSignature) && subtitleTrackCount > 0
        ? 0
        : -1,
    );
    setSubtitlesEnabled(true);
    setSubtitleDelay(0);
    setActiveCue('');
  }, [activeId, subtitleSignature, subtitleTrackCount]);

  const subtitleCues = useMemo(() => {
    const track = subtitleTracks[subtitleIndex];

    return track ? parseSubtitle(track.content, track.format) : [];
  }, [subtitleIndex, subtitleTracks]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const updateCue = () => {
      setActiveCue(
        subtitlesEnabled && subtitleCues.length > 0
          ? findActiveSubtitle(subtitleCues, video.currentTime - subtitleDelay)
          : '',
      );
    };

    updateCue();
    video.addEventListener('timeupdate', updateCue);
    video.addEventListener('seeked', updateCue);

    return () => {
      video.removeEventListener('timeupdate', updateCue);
      video.removeEventListener('seeked', updateCue);
    };
  }, [subtitleCues, subtitlesEnabled, subtitleDelay]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    let hls: Hls | null = null;
    let resumeTimer: number | null = null;

    resumeAppliedRef.current = false;
    lastProgressAtRef.current = 0;
    progressReadyRef.current = false;
    setResumeNotice(false);
    setRuntimeError('');
    setActiveCue('');

    const handleLoadedMetadata = () => {
      progressReadyRef.current = true;

      if (resumeAppliedRef.current || !resumePosition) {
        return;
      }

      resumeAppliedRef.current = true;

      if (
        Number.isFinite(video.duration) &&
        resumePosition >= MIN_RESUME_SECONDS &&
        resumePosition < video.duration - RESUME_TAIL_SECONDS
      ) {
        video.currentTime = resumePosition;
        setResumeNotice(true);
        resumeTimer = window.setTimeout(() => {
          setResumeNotice(false);
        }, RESUME_NOTICE_MS);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(source.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setRuntimeError(
            data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? '视频加载失败，请重新获取播放地址。'
              : '当前视频无法播放。',
          );
        }
      });
      void video.play().catch(() => undefined);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source.url;
      void video.play().catch(() => undefined);
    } else {
      setRuntimeError('当前环境不支持 HLS 播放。');
    }

    return () => {
      if (resumeTimer !== null) {
        window.clearTimeout(resumeTimer);
      }

      progressReadyRef.current = false;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      hls?.destroy();
      // Removing the source and reloading stops playback without firing an
      // extra `pause` event that could be reported under the next video.
      video.removeAttribute('src');
      video.load();
    };
  }, [resumePosition, source.url]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (isLoading) {
      wasPlayingBeforeLoadingRef.current = !video.paused;
      video.pause();
      return;
    }

    if (wasPlayingBeforeLoadingRef.current) {
      wasPlayingBeforeLoadingRef.current = false;
      void video.play().catch(() => undefined);
    }
  }, [isLoading]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handlePause = () => {
      reportProgress(true);
    };
    const handleEnded = () => {
      reportProgress(true);
      onEndedRef.current();
    };
    const handleTimeUpdate = () => {
      reportProgress();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    const interval = window.setInterval(() => {
      reportProgress();
    }, PROGRESS_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      reportProgress(true);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [reportProgress]);

  const requestClose = () => {
    reportProgress(true);
    onClose();
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();

    if (isMinimizing) {
      return;
    }

    if (activeMenu) {
      setActiveMenu(null);
      return;
    }

    requestClose();
  };

  const handleMinimize = () => {
    if (isMinimizing) {
      return;
    }

    setActiveMenu(null);

    const dialog = dialogRef.current;

    if (
      !dialog ||
      preferReducedMotion() ||
      typeof dialog.animate !== 'function'
    ) {
      onMinimize();
      return;
    }

    setIsMinimizing(true);
    reportProgress(true);
    minimizeAnimationRef.current?.cancel();
    const animation = dialog.animate(
      [
        {
          filter: 'blur(0px)',
          opacity: 1,
          transform: 'scale(1, 1)',
        },
        {
          filter: 'blur(3px)',
          opacity: 0,
          transform: 'scale(0.12, 0.06)',
        },
      ],
      {
        duration: PLAYER_MINIMIZE_ANIMATION_MS,
        easing: PLAYER_ANIMATION_EASING,
        fill: 'forwards',
      },
    );

    minimizeAnimationRef.current = animation;

    let hasFinished = false;
    const finishMinimize = () => {
      if (hasFinished) {
        return;
      }

      hasFinished = true;

      if (minimizeTimerRef.current !== null) {
        window.clearTimeout(minimizeTimerRef.current);
        minimizeTimerRef.current = null;
      }

      onMinimize();
    };

    animation.onfinish = finishMinimize;
    minimizeTimerRef.current = window.setTimeout(
      finishMinimize,
      PLAYER_MINIMIZE_ANIMATION_MS + 80,
    );
  };

  const handleSelectPlaylist = (id: string) => {
    if (id === activeId) {
      return;
    }

    reportProgress(true);
    onSelectPlaylist(id);
  };

  const handleSubtitleDelay = (delta: number) => {
    setSubtitleDelay((current) =>
      Math.max(
        -SUBTITLE_DELAY_LIMIT_SECONDS,
        Math.min(
          SUBTITLE_DELAY_LIMIT_SECONDS,
          Number((current + delta).toFixed(1)),
        ),
      ),
    );
  };

  const handleStageActivation = (target: EventTarget | null) => {
    if (
      target instanceof Element &&
      target.closest('[data-player-controls], [data-player-overlay]')
    ) {
      return;
    }

    if (activeMenu) {
      setActiveMenu(null);
      return;
    }

    revealToolbar();

    if (stageClickTimerRef.current !== null) {
      window.clearTimeout(stageClickTimerRef.current);
      stageClickTimerRef.current = null;
      return;
    }

    stageClickTimerRef.current = window.setTimeout(() => {
      stageClickTimerRef.current = null;
      media.togglePlay();
    }, STAGE_CLICK_DELAY_MS);
  };

  const handleStageClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    handleStageActivation(event.target);
  };

  const handleStageDoubleClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    const target = event.target;

    if (
      target instanceof Element &&
      target.closest('[data-player-controls], [data-player-overlay]')
    ) {
      return;
    }

    if (stageClickTimerRef.current !== null) {
      window.clearTimeout(stageClickTimerRef.current);
      stageClickTimerRef.current = null;
    }

    media.toggleFullscreen();
  };

  useEffect(() => {
    if (isMinimized) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (target instanceof Element) {
        if (
          target.closest(
            '[data-player-controls], input, select, textarea, a, [contenteditable="true"]',
          )
        ) {
          return;
        }

        if (
          target.closest('button') &&
          !target.closest('[data-player-surface]')
        ) {
          return;
        }
      }

      const video = videoRef.current;
      const currentMedia = mediaRef.current;
      const key = event.key.toLowerCase();

      switch (key) {
        case ' ':
        case 'k':
          event.preventDefault();
          currentMedia.togglePlay();
          return;
        case 'arrowleft':
          event.preventDefault();
          currentMedia.seekTo(
            (video?.currentTime ?? currentMedia.currentTime) - 5,
          );
          return;
        case 'arrowright':
          event.preventDefault();
          currentMedia.seekTo(
            (video?.currentTime ?? currentMedia.currentTime) + 5,
          );
          return;
        case 'arrowup':
          event.preventDefault();
          currentMedia.setVolume((video?.volume ?? 1) + 0.05);
          return;
        case 'arrowdown':
          event.preventDefault();
          currentMedia.setVolume((video?.volume ?? 1) - 0.05);
          return;
        case 'm':
          event.preventDefault();
          currentMedia.toggleMute();
          return;
        case 'f':
          event.preventDefault();
          currentMedia.toggleFullscreen();
          return;
        case 'c':
          if (subtitleTracks.length > 0) {
            event.preventDefault();
            setSubtitlesEnabled((current) => !current);
          }
          return;
        default:
          return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMinimized, subtitleTracks.length]);

  const aspectRatio =
    source.width && source.height
      ? `${source.width} / ${source.height}`
      : '16 / 9';

  return (
    <dialog
      ref={dialogRef}
      aria-label={`播放 ${title}`}
      className={styles.dialog}
      data-minimizing={isMinimizing ? 'true' : undefined}
      tabIndex={-1}
      onCancel={handleCancel}
      onKeyDownCapture={() => {
        focusFromPointerRef.current = false;
      }}
      onPointerDownCapture={() => {
        focusFromPointerRef.current = true;
        setIsToolbarFocused(false);
      }}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <p className={styles.kicker}>{kicker}</p>
            <h2 title={title}>{title}</h2>
          </div>
          <div className={styles.headerActions}>
            <button
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? '收起播放列表' : '展开播放列表'}
              className={styles.sidebarToggle}
              title={sidebarOpen ? '收起播放列表' : '展开播放列表'}
              type="button"
              onClick={() => {
                setSidebarOpen((current) => !current);
              }}
            >
              <ListIcon />
            </button>
            <button
              aria-label="最小化播放器"
              className={styles.minimize}
              title="最小化播放器"
              type="button"
              onClick={handleMinimize}
            >
              <MinimizePlayerIcon />
            </button>
            <button
              aria-label="关闭播放器"
              className={styles.close}
              type="button"
              onClick={requestClose}
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.main}>
            <div
              className={`${styles.stage}${
                media.isPlaying && !toolbarVisible && !activeMenu
                  ? ` ${styles.stageIdle}`
                  : ''
              }`}
              ref={stageRef}
              onFocusCapture={() => {
                if (focusFromPointerRef.current) {
                  setIsToolbarFocused(false);
                  return;
                }

                setIsToolbarFocused(true);
                revealToolbar();
              }}
              onBlurCapture={(event) => {
                const nextTarget = event.relatedTarget;

                if (
                  !(nextTarget instanceof Element) ||
                  !event.currentTarget.contains(nextTarget) ||
                  nextTarget.closest('[data-player-surface]')
                ) {
                  setIsToolbarFocused(false);
                }
              }}
            >
              <video
                ref={videoRef}
                className={styles.video}
                playsInline
                style={{ aspectRatio }}
                width={source.width ?? undefined}
                height={source.height ?? undefined}
                onError={() => {
                  setRuntimeError('视频加载失败，请重新获取播放地址。');
                }}
              >
                <track kind="captions" label="无字幕" />
              </video>
              <button
                aria-label={media.isPlaying ? '暂停视频' : '播放视频'}
                className={styles.videoHitArea}
                data-player-surface="video"
                type="button"
                onClick={handleStageClick}
                onDoubleClick={handleStageDoubleClick}
              />
              {activeCue && (
                <div className={styles.subtitleOverlay}>{activeCue}</div>
              )}
              {resumeNotice && (
                <div
                  className={styles.resumeNotice}
                  data-player-overlay="resume"
                >
                  <span>
                    继续观看 · {formatPlaybackPosition(resumePosition ?? 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      media.seekTo(0);
                      setResumeNotice(false);
                    }}
                  >
                    从头播放
                  </button>
                </div>
              )}
              {isLoading && (
                <output
                  className={styles.loadingOverlay}
                  data-player-overlay="loading"
                >
                  <span className={styles.loadingSpinner} />
                  <p>正在切换视频…</p>
                </output>
              )}
              {displayedError && (
                <div
                  className={styles.errorOverlay}
                  data-player-overlay="error"
                >
                  <p>{displayedError}</p>
                  <button
                    className={styles.retry}
                    type="button"
                    onClick={onRetry}
                  >
                    重新获取播放地址
                  </button>
                </div>
              )}

              <VideoPlayerToolbar
                activeMenu={activeMenu}
                bufferedEnd={media.bufferedEnd}
                currentTime={media.currentTime}
                duration={media.duration}
                isFullscreen={media.isFullscreen}
                isMuted={media.isMuted}
                isPlaying={media.isPlaying}
                playbackRate={media.playbackRate}
                subtitleDelay={subtitleDelay}
                subtitleIndex={subtitleIndex}
                subtitleTracks={subtitleTracks}
                subtitlesEnabled={subtitlesEnabled}
                visible={toolbarVisible}
                volume={media.volume}
                onActiveMenuChange={setActiveMenu}
                onHoverChange={setIsToolbarHovered}
                onPlaybackRateChange={media.setPlaybackRate}
                onResetSubtitleDelay={() => {
                  setSubtitleDelay(0);
                }}
                onScrubbingChange={setIsScrubbing}
                onSeek={media.seekTo}
                onSubtitleDelayChange={handleSubtitleDelay}
                onSubtitleIndexChange={setSubtitleIndex}
                onToggleFullscreen={media.toggleFullscreen}
                onToggleMute={media.toggleMute}
                onTogglePlay={media.togglePlay}
                onToggleSubtitles={() => {
                  setSubtitlesEnabled((current) => !current);
                }}
                onVolumeChange={media.setVolume}
              />
            </div>
          </div>

          <VideoPlayerDrawer
            activeId={activeId}
            open={sidebarOpen}
            playlist={playlist}
            onSelectPlaylist={handleSelectPlaylist}
          />
        </div>
      </div>
    </dialog>
  );
}
