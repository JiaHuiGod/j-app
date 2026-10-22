import { useLayoutEffect, useRef } from 'react';
import type { VideoPlaylistItem } from './types';
import styles from './VideoPlayerDialog.module.css';

interface VideoPlayerDrawerProps {
  readonly open: boolean;
  readonly playlist: readonly VideoPlaylistItem[];
  readonly activeId: string | null;
  readonly onSelectPlaylist: (id: string) => void;
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
  onSelectPlaylist,
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
      aria-label="播放列表"
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
    </aside>
  );
}
