import { useLayoutEffect, useRef } from 'react';
import type { VideoPlaylistItem, VideoSubtitleTrack } from './types';
import styles from './VideoPlayerDialog.module.css';

interface VideoPlayerDrawerProps {
  readonly open: boolean;
  readonly playlist: readonly VideoPlaylistItem[];
  readonly activeId: string | null;
  readonly subtitleTracks: readonly VideoSubtitleTrack[];
  readonly subtitleIndex: number;
  readonly subtitlesEnabled: boolean;
  readonly subtitleDelay: number;
  readonly onSelectPlaylist: (id: string) => void;
  readonly onSubtitleIndexChange: (index: number) => void;
  readonly onToggleSubtitles: () => void;
  readonly onSubtitleDelayChange: (delta: number) => void;
}

function playlistLabel(item: VideoPlaylistItem): string {
  return item.displayTitle ?? item.title;
}

/**
 * Scroll only the playlist viewport. `scrollIntoView` also walks scrollable
 * ancestors, and while the drawer is still translated off-screen that can
 * scroll the dialog horizontally, producing a left jump during the open
 * animation.
 */
function scrollPlaylistItemIntoView(
  container: HTMLDivElement,
  item: HTMLButtonElement,
): void {
  const containerRect = container.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();

  if (itemRect.top < containerRect.top) {
    container.scrollTop -= containerRect.top - itemRect.top;
    return;
  }

  if (itemRect.bottom > containerRect.bottom) {
    container.scrollTop += itemRect.bottom - containerRect.bottom;
  }
}

export function VideoPlayerDrawer({
  open,
  playlist,
  activeId,
  subtitleTracks,
  subtitleIndex,
  subtitlesEnabled,
  subtitleDelay,
  onSelectPlaylist,
  onSubtitleIndexChange,
  onToggleSubtitles,
  onSubtitleDelayChange,
}: VideoPlayerDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !activeId) {
      return;
    }

    const container = scrollRef.current;
    const activeItem = container?.querySelector<HTMLButtonElement>(
      'button[aria-current="true"]',
    );

    if (container && activeItem) {
      scrollPlaylistItemIntoView(container, activeItem);
    }
  }, [activeId, open]);

  return (
    <aside
      aria-hidden={!open}
      aria-label="播放列表与字幕"
      className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}
    >
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarHeading}>
          <span className={styles.sidebarKicker}>Playlist</span>
          <span className={styles.sidebarTitle}>播放列表</span>
        </div>
      </div>

      <div className={styles.playlistScroll} ref={scrollRef}>
        {playlist.length === 0 ? (
          <p className={styles.playlistEmpty}>当前目录没有视频</p>
        ) : (
          playlist.map((item, index) => {
            const isActive = item.id === activeId;

            return (
              <button
                key={item.id}
                aria-current={isActive ? 'true' : undefined}
                className={`${styles.playlistItem} ${
                  isActive ? styles.playlistItemActive : ''
                }`}
                title={item.title}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    onSelectPlaylist(item.id);
                  }
                }}
              >
                <span className={styles.playlistIndex}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={styles.playlistName}>
                  {playlistLabel(item)}
                </span>
              </button>
            );
          })
        )}
      </div>

      <section className={styles.subtitlePanel}>
        <div className={styles.subtitleHeader}>
          <span className={styles.subtitleLabel}>字幕</span>
          {subtitleTracks.length > 0 && (
            <button
              aria-label={subtitlesEnabled ? '关闭字幕' : '开启字幕'}
              className={styles.subtitleToggle}
              type="button"
              onClick={onToggleSubtitles}
            >
              {subtitlesEnabled ? '开启' : '关闭'}
            </button>
          )}
        </div>

        {subtitleTracks.length > 0 ? (
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
                {subtitleDelay.toFixed(1)}s
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
            </div>
          </>
        ) : (
          <p className={styles.subtitleEmpty}>未匹配到本地字幕</p>
        )}
      </section>
    </aside>
  );
}
