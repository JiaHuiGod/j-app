import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import Hls from 'hls.js';
import type { DrivePlaybackResult, DriveSubtitle } from '@shared/drive';
import { formatPlaybackPosition } from '../lib/playback-progress';
import { findActiveSubtitle, parseSubtitle } from '../lib/subtitles';
import styles from './DrivePlayerDialog.module.css';

interface DrivePlayerDialogProps {
  readonly fileName: string;
  readonly playback: DrivePlaybackResult;
  readonly resumePosition: number | null;
  readonly playlist: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly playlistPosition: number;
  readonly isSwitching: boolean;
  readonly onSelectPlaylist: (entryId: string) => void;
  readonly onClose: () => void;
  readonly onRetry: () => void;
  readonly onProgress: (position: number, duration: number) => void;
  readonly onEnded: () => void;
}

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

function compactVideoName(name: string): string {
  return name.replace(/^www\.[^@]+@/i, '').replace(/\.[^.]+$/, '');
}

export function DrivePlayerDialog({
  fileName,
  playback,
  resumePosition,
  playlist,
  playlistPosition,
  isSwitching,
  onSelectPlaylist,
  onClose,
  onRetry,
  onProgress,
  onEnded,
}: DrivePlayerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastProgressAtRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const wasPlayingBeforeSwitchRef = useRef(false);
  const activePlaylistItemRef = useRef<HTMLButtonElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 900);
  const [error, setError] = useState('');
  const [subtitles, setSubtitles] = useState<readonly DriveSubtitle[]>([]);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [activeCue, setActiveCue] = useState('');
  const [resumeNotice, setResumeNotice] = useState(false);

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

  useEffect(() => {
    if (playlistPosition <= 0) {
      return;
    }

    const activeItem = activePlaylistItemRef.current;

    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [playlistPosition]);

  useEffect(() => {
    let isCurrent = true;

    setSubtitles([]);
    setSubtitleIndex(-1);
    setSubtitlesEnabled(true);
    setSubtitleDelay(0);
    setActiveCue('');

    void window.desktop.drive
      .getSubtitles(fileName)
      .then((result) => {
        if (!isCurrent || !result.ok || result.data.length === 0) {
          return;
        }

        setSubtitles(result.data);
        setSubtitleIndex(0);
        setSubtitlesEnabled(true);
      })
      .catch(() => {
        // Subtitles are optional.
      });

    return () => {
      isCurrent = false;
    };
  }, [fileName]);

  const subtitleCues = useMemo(() => {
    const subtitle = subtitles[subtitleIndex];

    return subtitle ? parseSubtitle(subtitle.content, subtitle.format) : [];
  }, [subtitleIndex, subtitles]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    let hls: Hls | null = null;
    let resumeTimer: number | null = null;

    resumeAppliedRef.current = false;
    setResumeNotice(false);
    setError('');

    const applyResume = () => {
      if (resumeAppliedRef.current || !resumePosition) {
        return;
      }

      resumeAppliedRef.current = true;

      if (
        Number.isFinite(video.duration) &&
        resumePosition >= 5 &&
        resumePosition < video.duration - 5
      ) {
        video.currentTime = resumePosition;
        setResumeNotice(true);
        resumeTimer = window.setTimeout(() => {
          setResumeNotice(false);
        }, 8000);
      }
    };

    video.addEventListener('loadedmetadata', applyResume);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(playback.playbackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError(
            data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? '视频加载失败，请重新获取播放地址。'
              : '当前视频无法播放。',
          );
        }
      });
      void video.play().catch(() => undefined);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playback.playbackUrl;
      void video.play().catch(() => undefined);
    } else {
      setError('当前环境不支持 HLS 播放。');
    }

    return () => {
      if (resumeTimer !== null) {
        window.clearTimeout(resumeTimer);
      }

      video.removeEventListener('loadedmetadata', applyResume);
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [playback.playbackUrl, resumePosition]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (isSwitching) {
      wasPlayingBeforeSwitchRef.current = !video.paused;
      video.pause();
      return;
    }

    if (wasPlayingBeforeSwitchRef.current) {
      wasPlayingBeforeSwitchRef.current = false;
      void video.play().catch(() => undefined);
    }
  }, [isSwitching]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const reportProgress = (force = false) => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }

      const now = Date.now();

      if (!force && now - lastProgressAtRef.current < 4000) {
        return;
      }

      lastProgressAtRef.current = now;
      onProgress(video.currentTime, video.duration);
    };

    const handlePause = () => {
      reportProgress(true);
    };
    const handleEnded = () => {
      reportProgress(true);
      onEnded();
    };
    const handleTimeUpdate = () => {
      reportProgress();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    const interval = window.setInterval(() => {
      reportProgress();
    }, 5000);

    return () => {
      window.clearInterval(interval);
      reportProgress(true);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onEnded, onProgress]);

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

  const reportBeforeNavigation = () => {
    const video = videoRef.current;

    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      onProgress(video.currentTime, video.duration);
    }
  };

  const requestClose = () => {
    reportBeforeNavigation();
    onClose();
  };

  const aspectRatio =
    playback.width && playback.height
      ? `${playback.width} / ${playback.height}`
      : '16 / 9';

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    requestClose();
  };

  const handleSubtitleDelay = (delta: number) => {
    setSubtitleDelay((current) =>
      Math.max(-10, Math.min(10, Number((current + delta).toFixed(1)))),
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={`播放 ${fileName}`}
      className={styles.dialog}
      onCancel={handleCancel}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <p className={styles.kicker}>115 / PLAYBACK</p>
            <h2 title={fileName}>{fileName}</h2>
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
                width={playback.width ?? undefined}
                height={playback.height ?? undefined}
                onError={() => {
                  setError('视频加载失败，请重新获取播放地址。');
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
              {isSwitching && (
                <output className={styles.loadingOverlay}>
                  <span className={styles.loadingSpinner} />
                  <p>正在切换视频…</p>
                </output>
              )}
              {error && (
                <div className={styles.errorOverlay}>
                  <p>{error}</p>
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

          <aside
            aria-label="播放列表与字幕"
            aria-hidden={!sidebarOpen}
            className={`${styles.sidebar} ${
              sidebarOpen ? styles.sidebarOpen : ''
            }`}
          >
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarHeading}>
                <span className={styles.sidebarKicker}>Playlist</span>
                <span className={styles.sidebarTitle}>播放列表</span>
              </div>
            </div>

            <div className={styles.playlistScroll}>
              {playlist.length === 0 ? (
                <p className={styles.playlistEmpty}>当前目录没有视频</p>
              ) : (
                playlist.map((item, index) => {
                  const isActive = index + 1 === playlistPosition;

                  return (
                    <button
                      key={item.id}
                      ref={isActive ? activePlaylistItemRef : undefined}
                      aria-current={isActive ? 'true' : undefined}
                      className={`${styles.playlistItem} ${
                        isActive ? styles.playlistItemActive : ''
                      }`}
                      title={item.name}
                      type="button"
                      onClick={() => {
                        if (!isActive) {
                          reportBeforeNavigation();
                          onSelectPlaylist(item.id);
                        }
                      }}
                    >
                      <span className={styles.playlistIndex}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className={styles.playlistName}>
                        {compactVideoName(item.name)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <section className={styles.subtitlePanel}>
              <div className={styles.subtitleHeader}>
                <span className={styles.subtitleLabel}>字幕</span>
                {subtitles.length > 0 && (
                  <button
                    aria-label={subtitlesEnabled ? '关闭字幕' : '开启字幕'}
                    className={styles.subtitleToggle}
                    type="button"
                    onClick={() => {
                      setSubtitlesEnabled((current) => !current);
                    }}
                  >
                    {subtitlesEnabled ? '开启' : '关闭'}
                  </button>
                )}
              </div>

              {subtitles.length > 0 ? (
                <>
                  <select
                    aria-label="选择字幕"
                    className={styles.subtitleSelect}
                    value={subtitleIndex}
                    onChange={(event) => {
                      setSubtitleIndex(Number(event.target.value));
                    }}
                  >
                    {subtitles.map((subtitle, index) => (
                      <option key={subtitle.name} value={index}>
                        {subtitle.name}
                      </option>
                    ))}
                  </select>
                  <div className={styles.delayRow}>
                    <span className={styles.delayLabel}>延迟</span>
                    <button
                      aria-label="字幕延迟减少 0.5 秒"
                      className={styles.delayButton}
                      type="button"
                      onClick={() => {
                        handleSubtitleDelay(-0.5);
                      }}
                    >
                      −0.5s
                    </button>
                    <span className={styles.delayValue}>
                      {subtitleDelay.toFixed(1)}s
                    </span>
                    <button
                      aria-label="字幕延迟增加 0.5 秒"
                      className={styles.delayButton}
                      type="button"
                      onClick={() => {
                        handleSubtitleDelay(0.5);
                      }}
                    >
                      +0.5s
                    </button>
                  </div>
                </>
              ) : (
                <p className={styles.subtitleEmpty}>未匹配到本地字幕</p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </dialog>
  );
}
