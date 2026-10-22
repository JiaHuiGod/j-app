import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { formatPlaybackPosition } from '../../lib/playback-progress';
import type { VideoSubtitleTrack } from './types';
import {
  CheckIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  MutedIcon,
  PauseIcon,
  PlayIcon,
  SubtitlesIcon,
  VolumeIcon,
} from './PlayerIcons';
import styles from './VideoPlayerToolbar.module.css';

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type PlayerMenu = 'rate' | 'subtitle';

interface VideoPlayerToolbarProps {
  readonly visible: boolean;
  readonly isPlaying: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly bufferedEnd: number;
  readonly volume: number;
  readonly isMuted: boolean;
  readonly playbackRate: number;
  readonly isFullscreen: boolean;
  readonly subtitlesEnabled: boolean;
  readonly subtitleTracks: readonly VideoSubtitleTrack[];
  readonly subtitleIndex: number;
  readonly subtitleDelay: number;
  readonly activeMenu: PlayerMenu | null;
  readonly onTogglePlay: () => void;
  readonly onSeek: (time: number) => void;
  readonly onVolumeChange: (volume: number) => void;
  readonly onToggleMute: () => void;
  readonly onPlaybackRateChange: (rate: number) => void;
  readonly onToggleFullscreen: () => void;
  readonly onToggleSubtitles: () => void;
  readonly onSubtitleIndexChange: (index: number) => void;
  readonly onSubtitleDelayChange: (delta: number) => void;
  readonly onResetSubtitleDelay: () => void;
  readonly onActiveMenuChange: (menu: PlayerMenu | null) => void;
  readonly onScrubbingChange: (scrubbing: boolean) => void;
  readonly onHoverChange: (hovered: boolean) => void;
}

function formatRate(rate: number): string {
  return `${Number.isInteger(rate) ? rate : rate.toFixed(2).replace(/0$/, '')}x`;
}

function formatDelay(delay: number): string {
  const prefix = delay > 0 ? '+' : '';
  return `${prefix}${delay.toFixed(1)}s`;
}

export function VideoPlayerToolbar({
  visible,
  isPlaying,
  currentTime,
  duration,
  bufferedEnd,
  volume,
  isMuted,
  playbackRate,
  isFullscreen,
  subtitlesEnabled,
  subtitleTracks,
  subtitleIndex,
  subtitleDelay,
  activeMenu,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onToggleFullscreen,
  onToggleSubtitles,
  onSubtitleIndexChange,
  onSubtitleDelayChange,
  onResetSubtitleDelay,
  onActiveMenuChange,
  onScrubbingChange,
  onHoverChange,
}: VideoPlayerToolbarProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const rateButtonRef = useRef<HTMLButtonElement>(null);
  const seekPreviewRef = useRef<number | null>(null);
  const isScrubbingRef = useRef(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const finishSeek = useCallback(() => {
    const preview = seekPreviewRef.current;

    if (preview !== null) {
      onSeek(preview);
    }

    isScrubbingRef.current = false;
    seekPreviewRef.current = null;
    setIsScrubbing(false);
    setSeekPreview(null);
    onScrubbingChange(false);
  }, [onScrubbingChange, onSeek]);

  useEffect(() => {
    if (!isScrubbing) {
      return;
    }

    const handlePointerUp = () => {
      finishSeek();
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [finishSeek, isScrubbing]);

  useEffect(() => {
    if (!activeMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      if (target.closest('[data-player-menu-trigger]')) {
        return;
      }

      onActiveMenuChange(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [activeMenu, onActiveMenuChange]);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const displayTime = seekPreview ?? currentTime;
  const clampedTime = Math.max(0, Math.min(displayTime, safeDuration || 0));
  const progress =
    safeDuration > 0 ? Math.min(100, (clampedTime / safeDuration) * 100) : 0;
  const buffered =
    safeDuration > 0
      ? Math.min(100, Math.max(progress, (bufferedEnd / safeDuration) * 100))
      : 0;
  const seekStyle = {
    '--seek-buffer': `${buffered}%`,
    '--seek-progress': `${progress}%`,
  } as CSSProperties;
  const isSilent = isMuted || volume === 0;
  const hasSubtitles = subtitleTracks.length > 0;

  const handleSeekChange = (value: number) => {
    seekPreviewRef.current = value;
    setSeekPreview(value);

    if (!isScrubbingRef.current) {
      onSeek(value);
    }
  };

  const handleSeekStart = () => {
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    onScrubbingChange(true);
  };

  return (
    <div
      aria-label="播放器控制"
      className={`${styles.toolbar} ${
        visible ? styles.toolbarVisible : styles.toolbarHidden
      }`}
      data-player-controls="toolbar"
      data-visible={visible}
      role="toolbar"
      tabIndex={-1}
      onPointerEnter={() => {
        onHoverChange(true);
      }}
      onPointerLeave={() => {
        onHoverChange(false);
      }}
    >
      <div className={styles.seekRow}>
        <input
          aria-label="播放进度"
          aria-valuetext={`${formatPlaybackPosition(clampedTime)} / ${formatPlaybackPosition(safeDuration)}`}
          className={styles.seek}
          disabled={safeDuration <= 0}
          max={safeDuration || 1}
          min={0}
          step={0.1}
          style={seekStyle}
          type="range"
          value={clampedTime}
          onChange={(event) => {
            handleSeekChange(Number(event.target.value));
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={handleSeekStart}
        />
      </div>

      <div className={styles.controlsRow}>
        <button
          aria-label={isPlaying ? '暂停' : '播放'}
          className={styles.control}
          type="button"
          onClick={onTogglePlay}
        >
          {isPlaying ? (
            <PauseIcon className={styles.controlIcon} />
          ) : (
            <PlayIcon className={styles.controlIcon} />
          )}
        </button>

        <span className={styles.time}>
          {formatPlaybackPosition(clampedTime)}
          <span className={styles.timeDivider}>/</span>
          <span className={styles.timeMuted}>
            {formatPlaybackPosition(safeDuration)}
          </span>
        </span>

        <span className={styles.spacer} />

        <div className={styles.volumeGroup}>
          <button
            aria-label={isMuted ? '取消静音' : '静音'}
            aria-pressed={isMuted}
            className={styles.control}
            type="button"
            onClick={onToggleMute}
          >
            {isSilent ? (
              <MutedIcon className={styles.controlIcon} />
            ) : (
              <VolumeIcon className={styles.controlIcon} />
            )}
          </button>
          <input
            aria-label="音量"
            aria-valuetext={`${Math.round((isMuted ? 0 : volume) * 100)}%`}
            className={styles.volume}
            max={1}
            min={0}
            step={0.01}
            type="range"
            value={isMuted ? 0 : volume}
            onChange={(event) => {
              onVolumeChange(Number(event.target.value));
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
            }}
          />
        </div>

        <div className={styles.menuAnchor}>
          <button
            aria-expanded={activeMenu === 'rate'}
            aria-haspopup="menu"
            aria-label={`播放速度 ${formatRate(playbackRate)}`}
            className={`${styles.control} ${styles.rateButton}`}
            data-player-menu-trigger="rate"
            ref={rateButtonRef}
            type="button"
            onClick={() => {
              onActiveMenuChange(activeMenu === 'rate' ? null : 'rate');
            }}
          >
            {formatRate(playbackRate)}
          </button>

          {activeMenu === 'rate' && (
            <div
              aria-label="播放速度"
              className={styles.menu}
              ref={menuRef}
              role="menu"
            >
              {PLAYBACK_RATES.map((rate) => {
                const isSelected = rate === playbackRate;

                return (
                  <button
                    aria-checked={isSelected}
                    className={`${styles.menuOption}${
                      isSelected ? ` ${styles.menuOptionSelected}` : ''
                    }`}
                    key={rate}
                    role="menuitemradio"
                    type="button"
                    onClick={() => {
                      onPlaybackRateChange(rate);
                      onActiveMenuChange(null);
                      rateButtonRef.current?.focus();
                    }}
                  >
                    <span>{formatRate(rate)}</span>
                    {isSelected && <CheckIcon className={styles.menuCheck} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.menuAnchor}>
          <button
            aria-expanded={activeMenu === 'subtitle'}
            aria-label="字幕设置"
            className={`${styles.control}${
              subtitlesEnabled && hasSubtitles ? ` ${styles.controlActive}` : ''
            }`}
            data-player-menu-trigger="subtitle"
            type="button"
            onClick={() => {
              onActiveMenuChange(activeMenu === 'subtitle' ? null : 'subtitle');
            }}
          >
            <SubtitlesIcon className={styles.controlIcon} />
            {hasSubtitles && (
              <span
                aria-hidden="true"
                className={`${styles.subtitleDot}${
                  subtitlesEnabled ? ` ${styles.subtitleDotActive}` : ''
                }`}
              />
            )}
          </button>

          {activeMenu === 'subtitle' && (
            <section
              aria-label="字幕设置"
              className={`${styles.menu} ${styles.subtitleMenu}`}
              ref={menuRef}
            >
              <div className={styles.subtitleHeader}>
                <strong>字幕</strong>
                {hasSubtitles ? (
                  <button
                    aria-label={subtitlesEnabled ? '关闭字幕' : '开启字幕'}
                    aria-pressed={subtitlesEnabled}
                    className={`${styles.subtitleToggle}${
                      subtitlesEnabled ? ` ${styles.subtitleToggleOn}` : ''
                    }`}
                    type="button"
                    onClick={onToggleSubtitles}
                  >
                    {subtitlesEnabled ? '已开启' : '已关闭'}
                  </button>
                ) : (
                  <span className={styles.subtitleStatus}>无轨道</span>
                )}
              </div>

              {hasSubtitles ? (
                <>
                  <select
                    aria-label="选择字幕"
                    className={styles.subtitleSelect}
                    value={subtitleIndex}
                    onChange={(event) => {
                      onSubtitleIndexChange(Number(event.target.value));
                    }}
                  >
                    {subtitleTracks.map((track, index) => (
                      <option key={track.id} value={index}>
                        {track.label}
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
                        onSubtitleDelayChange(-0.5);
                      }}
                    >
                      −0.5s
                    </button>
                    <span className={styles.delayValue}>
                      {formatDelay(subtitleDelay)}
                    </span>
                    <button
                      aria-label="字幕延迟增加 0.5 秒"
                      className={styles.delayButton}
                      type="button"
                      onClick={() => {
                        onSubtitleDelayChange(0.5);
                      }}
                    >
                      +0.5s
                    </button>
                    <button
                      aria-label="重置字幕延迟"
                      className={styles.delayReset}
                      disabled={subtitleDelay === 0}
                      type="button"
                      onClick={onResetSubtitleDelay}
                    >
                      重置
                    </button>
                  </div>
                </>
              ) : (
                <p className={styles.subtitleEmpty}>未匹配到本地字幕</p>
              )}
            </section>
          )}
        </div>

        <button
          aria-label={isFullscreen ? '退出全屏' : '全屏'}
          className={styles.control}
          type="button"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? (
            <ExitFullscreenIcon className={styles.controlIcon} />
          ) : (
            <FullscreenIcon className={styles.controlIcon} />
          )}
        </button>
      </div>
    </div>
  );
}
