import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import Hls from 'hls.js';
import { formatPlaybackPosition } from '../../lib/playback-progress';
import { findActiveSubtitle, parseSubtitle } from '../../lib/subtitles';
import { VideoPlayerDrawer } from './VideoPlayerDrawer';
import type { VideoPlayerDialogProps } from './types';
import styles from './VideoPlayerDialog.module.css';

const MIN_RESUME_SECONDS = 5;
const RESUME_TAIL_SECONDS = 5;
const RESUME_NOTICE_MS = 8000;
const PROGRESS_INTERVAL_MS = 5000;
const PROGRESS_THROTTLE_MS = 4000;
const SUBTITLE_DELAY_LIMIT_SECONDS = 10;
const DEFAULT_KICKER = 'PLAYBACK';

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

export function VideoPlayerDialog({
  title,
  source,
  playlist,
  activeId,
  subtitleTracks,
  resumePosition,
  isLoading = false,
  error = null,
  kicker = DEFAULT_KICKER,
  onProgress,
  onEnded,
  onSelectPlaylist,
  onRetry,
  onClose,
}: VideoPlayerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  const lastProgressAtRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const progressReadyRef = useRef(false);
  const wasPlayingBeforeLoadingRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [runtimeError, setRuntimeError] = useState('');
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [activeCue, setActiveCue] = useState('');
  const [resumeNotice, setResumeNotice] = useState(false);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onEndedRef.current = onEnded;
  }, [onEnded, onProgress]);

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

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    return () => {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
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
    requestClose();
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

  const aspectRatio =
    source.width && source.height
      ? `${source.width} / ${source.height}`
      : '16 / 9';
  const displayedError = error ?? runtimeError;

  return (
    <dialog
      ref={dialogRef}
      aria-label={`播放 ${title}`}
      className={styles.dialog}
      onCancel={handleCancel}
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
            <div className={styles.stage}>
              <video
                ref={videoRef}
                className={styles.video}
                controls
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
              {activeCue && (
                <div className={styles.subtitleOverlay}>{activeCue}</div>
              )}
              {resumeNotice && (
                <div className={styles.resumeNotice}>
                  <span>
                    继续观看 · {formatPlaybackPosition(resumePosition ?? 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                      }
                      setResumeNotice(false);
                    }}
                  >
                    从头播放
                  </button>
                </div>
              )}
              {isLoading && (
                <output className={styles.loadingOverlay}>
                  <span className={styles.loadingSpinner} />
                  <p>正在切换视频…</p>
                </output>
              )}
              {displayedError && (
                <div className={styles.errorOverlay}>
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
            </div>
          </div>

          <VideoPlayerDrawer
            activeId={activeId}
            open={sidebarOpen}
            playlist={playlist}
            subtitleDelay={subtitleDelay}
            subtitleIndex={subtitleIndex}
            subtitleTracks={subtitleTracks}
            subtitlesEnabled={subtitlesEnabled}
            onSelectPlaylist={handleSelectPlaylist}
            onSubtitleDelayChange={handleSubtitleDelay}
            onSubtitleIndexChange={setSubtitleIndex}
            onToggleSubtitles={() => {
              setSubtitlesEnabled((current) => !current);
            }}
          />
        </div>
      </div>
    </dialog>
  );
}
