import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import type { LocalVideoItem, LocalVideoPoster } from '@shared/local-video';
import { PlayIcon } from '../../components/video-player/PlayerIcons';
import ui from '../../styles/ui.module.css';
import { useLocalVideo } from './LocalVideoProvider';
import {
  readGroupByFolder,
  readViewMode,
  saveGroupByFolder,
  saveViewMode,
  type LocalVideoViewMode,
} from './local-video-preferences';
import styles from './LocalVideoPage.module.css';

type SortMode = 'name' | 'modified' | 'size';

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size >= 10 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMATTER.format(date);
}

function FolderIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M3 5.5h5l1.5 1.8H17v7.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5V5.5Z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
      <rect height="5" rx="1" width="5" x="2" y="2" />
      <rect height="5" rx="1" width="5" x="9" y="2" />
      <rect height="5" rx="1" width="5" x="2" y="9" />
      <rect height="5" rx="1" width="5" x="9" y="9" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
      viewBox="0 0 20 20"
    >
      <path d="M10 3.1 17 15.7H3L10 3.1Z" />
      <path d="M10 7.7v4.1M10 14.1v.1" />
    </svg>
  );
}

interface PendingFolderRemoval {
  readonly libraryId: string;
  readonly folderName: string;
  readonly videoCount: number | null;
}

function RemoveFolderDialog({
  request,
  onCancel,
  onConfirm,
}: {
  readonly request: PendingFolderRemoval;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

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

    cancelButtonRef.current?.focus();

    return () => {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    };
  }, []);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onCancel();
  };

  return (
    <dialog
      aria-describedby="local-remove-folder-description"
      aria-labelledby="local-remove-folder-title"
      className={styles.confirmDialog}
      ref={dialogRef}
      onCancel={handleCancel}
    >
      <div className={styles.confirmContent}>
        <div className={styles.confirmHeading}>
          <span className={styles.confirmIcon} aria-hidden="true">
            <WarningIcon />
          </span>
          <div>
            <p className={styles.confirmKicker}>REMOVE FOLDER</p>
            <h2 id="local-remove-folder-title">移除本地视频文件夹？</h2>
          </div>
        </div>

        <p className={styles.confirmText} id="local-remove-folder-description">
          将从本地视频库中移除 <strong>{request.folderName}</strong>
          {request.videoCount !== null
            ? `（${request.videoCount} 个视频）`
            : ''}
          。不会删除磁盘上的文件。
        </p>

        <p className={styles.confirmHint}>
          {request.videoCount === null
            ? '该文件夹当前无法访问，移除后不会再尝试扫描它。'
            : '之后仍可通过“添加文件夹”重新导入。'}
        </p>

        <div className={styles.confirmActions}>
          <button
            className={`${ui.button} ${ui.buttonSecondary}`}
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className={`${ui.button} ${ui.buttonDanger}`}
            type="button"
            onClick={onConfirm}
          >
            确认移除
          </button>
        </div>
      </div>
    </dialog>
  );
}

function preferredPosters(
  video: LocalVideoItem,
  view: LocalVideoViewMode,
): LocalVideoPoster[] {
  const firstKind = view === 'grid' ? 'poster' : 'thumb';
  const secondKind = view === 'grid' ? 'thumb' : 'poster';
  const first = video.posters.filter((poster) => poster.kind === firstKind);
  const second = video.posters.filter((poster) => poster.kind === secondKind);

  return [...first, ...second];
}

function VideoCover({
  video,
  view,
  onPlay,
}: {
  readonly video: LocalVideoItem;
  readonly view: LocalVideoViewMode;
  readonly onPlay: (videoId: string) => void;
}) {
  const posters = preferredPosters(video, view);
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const cover = posters.find((poster) => !failedIds.has(poster.id));

  return (
    <div className={view === 'grid' ? styles.gridCover : styles.listCover}>
      {cover ? (
        <img
          alt=""
          className={styles.coverImage}
          decoding="async"
          loading="lazy"
          src={cover.url}
          onError={() => {
            setFailedIds((current) => {
              const next = new Set(current);
              next.add(cover.id);
              return next;
            });
          }}
        />
      ) : (
        <div className={styles.coverFallback} />
      )}

      <button
        aria-label={`播放 ${video.title}`}
        className={styles.playButton}
        type="button"
        onClick={() => onPlay(video.id)}
      >
        <PlayIcon />
      </button>
    </div>
  );
}

function LocalVideoCard({
  video,
  view,
  onPlay,
}: {
  readonly video: LocalVideoItem;
  readonly view: LocalVideoViewMode;
  readonly onPlay: (videoId: string) => void;
}) {
  return (
    <article
      className={`${styles.gridCard}${view === 'list' ? ` ${styles.listCard}` : ''}`}
    >
      <VideoCover onPlay={onPlay} video={video} view={view} />
      <button
        className={styles.gridBody}
        type="button"
        onClick={() => onPlay(video.id)}
      >
        <strong title={video.title}>{video.title}</strong>
        <span
          className={styles.path}
          title={`${video.libraryName} / ${video.relativePath}`}
        >
          {video.libraryName} / {video.relativePath}
        </span>
        <span className={styles.meta}>
          {formatBytes(video.size)} · {formatDate(video.modifiedAt)}
        </span>
      </button>
    </article>
  );
}

function ViewButton({
  active,
  children,
  label,
  onClick,
}: {
  readonly active: boolean;
  readonly children: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`${styles.viewButton}${active ? ` ${styles.viewButtonActive}` : ''}`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function LocalVideoPage() {
  const {
    cancelScan,
    chooseFolders,
    clearError,
    error,
    folderErrors,
    isScanning,
    libraries,
    playVideo,
    progress,
    removeFolder,
    rescan,
    videos,
  } = useLocalVideo();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('name');
  const [view, setView] = useState<LocalVideoViewMode>(readViewMode);
  const [groupByFolder, setGroupByFolder] = useState(readGroupByFolder);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<
    readonly string[]
  >([]);
  const [pendingRemoval, setPendingRemoval] =
    useState<PendingFolderRemoval | null>(null);

  const latestScan = libraries.reduce(
    (latest, library) =>
      library.scannedAt > latest ? library.scannedAt : latest,
    '',
  );
  const truncated = libraries.some((library) => library.truncated);
  const selectedLibrarySet = useMemo(
    () => new Set(selectedLibraryIds),
    [selectedLibraryIds],
  );
  const hasFolderFilter = selectedLibraryIds.length > 0;
  const hasSearch = query.trim().length > 0;

  useEffect(() => {
    setSelectedLibraryIds((current) => {
      const next = current.filter((id) =>
        libraries.some((library) => library.id === id),
      );

      if (next.length === 0) {
        return current.length === 0 ? current : [];
      }

      if (next.length >= libraries.length) {
        return [];
      }

      return next.length === current.length ? current : next;
    });
  }, [libraries]);

  const sortedVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const folderFiltered = hasFolderFilter
      ? videos.filter((video) => selectedLibrarySet.has(video.libraryId))
      : videos;
    const filtered = normalizedQuery
      ? folderFiltered.filter(
          (video) =>
            video.title.toLocaleLowerCase().includes(normalizedQuery) ||
            video.relativePath.toLocaleLowerCase().includes(normalizedQuery) ||
            video.libraryName.toLocaleLowerCase().includes(normalizedQuery),
        )
      : folderFiltered;

    return [...filtered].sort((left, right) => {
      if (sort === 'size') {
        return right.size - left.size;
      }

      if (sort === 'modified') {
        return right.modifiedAt.localeCompare(left.modifiedAt);
      }

      return left.title.localeCompare(right.title, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [hasFolderFilter, query, selectedLibrarySet, sort, videos]);

  const visibleGroups = useMemo(() => {
    if (!groupByFolder) {
      return [];
    }

    return libraries
      .filter(
        (library) => !hasFolderFilter || selectedLibrarySet.has(library.id),
      )
      .map((library) => ({
        library,
        videos: sortedVideos.filter((video) => video.libraryId === library.id),
      }))
      .filter((group) => group.videos.length > 0);
  }, [
    groupByFolder,
    hasFolderFilter,
    libraries,
    selectedLibrarySet,
    sortedVideos,
  ]);

  const visibleVideos = groupByFolder
    ? visibleGroups.flatMap((group) => group.videos)
    : sortedVideos;

  const countLabel =
    hasFolderFilter || hasSearch
      ? `${visibleVideos.length} / ${videos.length} 个视频`
      : `${videos.length} 个视频`;

  const setViewMode = (mode: LocalVideoViewMode) => {
    setView(mode);
    saveViewMode(mode);
  };

  const toggleFolderFilter = (libraryId: string) => {
    setSelectedLibraryIds((current) => {
      const next = current.includes(libraryId)
        ? current.filter((id) => id !== libraryId)
        : [...current, libraryId];

      return next.length >= libraries.length ? [] : next;
    });
  };

  const clearFolderFilter = () => {
    setSelectedLibraryIds([]);
  };

  const toggleGroupByFolder = () => {
    setGroupByFolder((current) => {
      const next = !current;
      saveGroupByFolder(next);
      return next;
    });
  };

  const playVisibleVideo = (videoId: string) => {
    playVideo(videoId, visibleVideos);
  };

  const renderVideoCards = (items: readonly LocalVideoItem[]) =>
    items.map((video) => (
      <LocalVideoCard
        key={video.id}
        onPlay={playVisibleVideo}
        video={video}
        view={view}
      />
    ));

  const requestFolderRemoval = (
    libraryId: string,
    folderName: string,
    videoCount: number | null,
  ) => {
    setPendingRemoval({ folderName, libraryId, videoCount });
  };

  const confirmFolderRemoval = () => {
    if (!pendingRemoval) {
      return;
    }

    const { libraryId } = pendingRemoval;
    setPendingRemoval(null);
    removeFolder(libraryId);
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.identity}>
          <p className={styles.eyebrow}>LOCAL / LIBRARY</p>
          <div className={styles.titleRow}>
            <h1>本地视频</h1>
            <span className={styles.countPill}>{countLabel}</span>
          </div>
          <p className={styles.subtitle}>
            添加一个或多个文件夹，网格显示海报、列表显示缩略图，点击即可播放。
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            className={`${ui.button} ${ui.buttonPrimary}`}
            disabled={isScanning}
            type="button"
            onClick={chooseFolders}
          >
            <FolderIcon />
            添加文件夹
          </button>
          <button
            className={`${ui.button} ${ui.buttonSecondary}`}
            disabled={libraries.length === 0 || isScanning}
            type="button"
            onClick={rescan}
          >
            重新扫描
          </button>
        </div>
      </header>

      {(error || folderErrors.length > 0) && (
        <div className={ui.alert} role="alert">
          <button
            aria-label="关闭本地视频错误提示"
            className={styles.dismiss}
            type="button"
            onClick={clearError}
          >
            ×
          </button>
          {error && <div>{error}</div>}
          {folderErrors.map((folderError) => (
            <div
              className={styles.folderErrorRow}
              key={`${folderError.libraryId}-${folderError.message}`}
            >
              <span>
                {folderError.folderName}：{folderError.message}
              </span>
              <button
                disabled={isScanning}
                type="button"
                onClick={() => {
                  requestFolderRemoval(
                    folderError.libraryId,
                    folderError.folderName,
                    null,
                  );
                }}
              >
                移除
              </button>
            </div>
          ))}
        </div>
      )}

      {libraries.length > 0 && (
        <section className={styles.folderBar} aria-label="本地视频文件夹">
          <span className={styles.folderBarLabel}>文件夹</span>
          <div className={styles.folderChips}>
            {libraries.length > 1 && (
              <button
                aria-pressed={!hasFolderFilter}
                className={`${styles.allFoldersChip}${
                  !hasFolderFilter ? ` ${styles.allFoldersChipActive}` : ''
                }`}
                type="button"
                onClick={clearFolderFilter}
              >
                全部
              </button>
            )}
            {libraries.map((library) => {
              const active = selectedLibrarySet.has(library.id);

              return (
                <span
                  className={`${styles.folderChip}${
                    active ? ` ${styles.folderChipActive}` : ''
                  }`}
                  key={library.id}
                >
                  <button
                    aria-label={`筛选文件夹 ${library.name}`}
                    aria-pressed={active}
                    className={styles.folderFilter}
                    title={active ? '取消筛选此文件夹' : '只显示此文件夹'}
                    type="button"
                    onClick={() => {
                      toggleFolderFilter(library.id);
                    }}
                  >
                    <FolderIcon />
                    <span className={styles.folderName} title={library.name}>
                      {library.name}
                    </span>
                    <small>{library.videos.length}</small>
                  </button>
                  <button
                    aria-label={`移除文件夹 ${library.name}`}
                    className={styles.folderRemove}
                    disabled={isScanning}
                    title="移除文件夹"
                    type="button"
                    onClick={() => {
                      requestFolderRemoval(
                        library.id,
                        library.name,
                        library.videos.length,
                      );
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {!libraries.length && isScanning && (
        <section className={styles.empty} aria-live="polite">
          <span className={ui.spinner} />
          <strong>正在读取本地视频…</strong>
          <span>
            {progress
              ? `${progress.folderName}（${progress.folderIndex}/${progress.folderCount}） · 已扫描 ${progress.scannedEntries} 项，发现 ${progress.videoCount} 个视频`
              : '准备扫描文件夹'}
          </span>
          <button className={ui.button} type="button" onClick={cancelScan}>
            取消扫描
          </button>
        </section>
      )}

      {!libraries.length && !isScanning && (
        <section className={styles.empty}>
          <span className={styles.emptyMark}>PLAY</span>
          <strong>还没有本地视频库</strong>
          <span>
            选择一个或多个包含视频的文件夹，应用会递归扫描并匹配 poster、thumb
            图片。
          </span>
          <button
            className={`${ui.button} ${ui.buttonPrimary}`}
            type="button"
            onClick={chooseFolders}
          >
            添加文件夹
          </button>
        </section>
      )}

      {libraries.length > 0 && (
        <>
          <section className={styles.libraryBar} aria-label="本地视频库信息">
            <div className={styles.librarySummary}>
              <span className={styles.kicker}>LIBRARY</span>
              <div className={styles.summaryTitleRow}>
                <strong>
                  {hasFolderFilter
                    ? `已选 ${selectedLibraryIds.length} / ${libraries.length} 个文件夹`
                    : `${libraries.length} 个文件夹`}
                </strong>
                {hasFolderFilter && (
                  <button
                    className={styles.clearFilter}
                    type="button"
                    onClick={clearFolderFilter}
                  >
                    清除筛选
                  </button>
                )}
              </div>
              <span>
                {hasFolderFilter ? `${visibleVideos.length} 个视频 · ` : ''}
                {latestScan ? `扫描于 ${formatDate(latestScan)}` : '等待扫描'}
                {truncated ? ' · 已达到扫描上限' : ''}
              </span>
            </div>

            <div className={styles.filters}>
              <input
                aria-label="搜索本地视频"
                className={styles.search}
                placeholder="搜索视频、文件夹或路径"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
              />
              <select
                aria-label="本地视频排序"
                className={styles.sort}
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortMode);
                }}
              >
                <option value="name">按名称</option>
                <option value="modified">按修改时间</option>
                <option value="size">按文件大小</option>
              </select>
              <button
                aria-label="按文件夹分组"
                aria-pressed={groupByFolder}
                className={`${styles.groupToggle}${
                  groupByFolder ? ` ${styles.groupToggleActive}` : ''
                }`}
                title={groupByFolder ? '取消按文件夹分组' : '按文件夹分组显示'}
                type="button"
                onClick={toggleGroupByFolder}
              >
                <FolderIcon />
                <span>分组</span>
              </button>
              <div aria-label="显示方式" className={styles.viewToggle}>
                <ViewButton
                  active={view === 'grid'}
                  label="网格视图"
                  onClick={() => {
                    setViewMode('grid');
                  }}
                >
                  <GridIcon />
                </ViewButton>
                <ViewButton
                  active={view === 'list'}
                  label="列表视图"
                  onClick={() => {
                    setViewMode('list');
                  }}
                >
                  <ListIcon />
                </ViewButton>
              </div>
            </div>
          </section>

          {isScanning && (
            <div className={styles.scanBar} aria-live="polite">
              <span className={ui.spinner} />
              <span>
                {progress
                  ? `正在扫描 ${progress.folderName}（${progress.folderIndex}/${progress.folderCount}） · ${progress.currentDirectory} · ${progress.videoCount} 个视频`
                  : '正在扫描文件夹…'}
              </span>
              <button
                className={styles.cancelLink}
                type="button"
                onClick={cancelScan}
              >
                取消
              </button>
            </div>
          )}

          {visibleVideos.length === 0 ? (
            <section className={styles.empty}>
              <strong>
                {hasFolderFilter
                  ? '当前文件夹没有匹配的视频'
                  : '没有匹配的视频'}
              </strong>
              <span>
                {hasFolderFilter && hasSearch
                  ? '当前文件夹筛选和搜索条件下没有结果。'
                  : hasFolderFilter
                    ? '该文件夹中没有视频。'
                    : '换一个关键词，或清除搜索条件。'}
              </span>
              {(hasFolderFilter || hasSearch) && (
                <div className={styles.emptyActions}>
                  {hasFolderFilter && (
                    <button
                      className={`${ui.button} ${ui.buttonSecondary}`}
                      type="button"
                      onClick={clearFolderFilter}
                    >
                      显示全部文件夹
                    </button>
                  )}
                  {hasSearch && (
                    <button
                      className={`${ui.button} ${ui.buttonSecondary}`}
                      type="button"
                      onClick={() => {
                        setQuery('');
                      }}
                    >
                      清除搜索
                    </button>
                  )}
                </div>
              )}
            </section>
          ) : groupByFolder && visibleGroups.length > 1 ? (
            <div
              aria-label="按文件夹分组的本地视频"
              className={styles.folderGroups}
            >
              {visibleGroups.map((group) => {
                const headingId = `local-folder-group-${group.library.id}`;

                return (
                  <section
                    aria-labelledby={headingId}
                    className={styles.folderGroup}
                    key={group.library.id}
                  >
                    <header className={styles.folderGroupHeader}>
                      <FolderIcon />
                      <h2 id={headingId}>{group.library.name}</h2>
                      <span>{group.videos.length} 个视频</span>
                      <span
                        aria-hidden="true"
                        className={styles.folderGroupLine}
                      />
                    </header>
                    <div
                      className={
                        view === 'grid' ? styles.grid : styles.listGrid
                      }
                    >
                      {renderVideoCards(group.videos)}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <section
              className={view === 'grid' ? styles.grid : styles.listGrid}
              aria-label="本地视频列表"
            >
              {renderVideoCards(visibleVideos)}
            </section>
          )}
        </>
      )}

      {pendingRemoval && (
        <RemoveFolderDialog
          request={pendingRemoval}
          onCancel={() => {
            setPendingRemoval(null);
          }}
          onConfirm={confirmFolderRemoval}
        />
      )}
    </main>
  );
}
