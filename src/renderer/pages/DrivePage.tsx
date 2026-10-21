import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
  type UIEvent,
} from 'react';
import type {
  DriveAccount,
  DriveBreadcrumb,
  DriveEntry,
  DriveError,
  DriveResult,
  DriveUploadProgress,
  DriveUploadResult,
  DriveVideoDownloadProgress,
} from '@shared/drive';
import { toErrorMessage } from '../lib/errors';
import { DriveActionDialog } from '../components/DriveActionDialog';
import { DriveDownloadPanel } from '../components/DriveDownloadPanel';
import { DriveMoveDialog } from '../components/DriveMoveDialog';
import { DriveOfflineDialog } from '../components/DriveOfflineDialog';
import { DriveUploadPanel } from '../components/DriveUploadPanel';
import ui from '../styles/ui.module.css';
import styles from './DrivePage.module.css';

interface DrivePageProps {
  isActive: boolean;
  onOpenSettings: () => void;
}

interface CachedFolder {
  readonly breadcrumbs: readonly DriveBreadcrumb[];
  readonly entries: readonly DriveEntry[];
  readonly hasMore: boolean;
  readonly total: number;
  readonly cachedAt: number;
}

type DriveDialogState =
  | { readonly mode: 'create-folder' }
  | { readonly mode: 'delete'; readonly entries: readonly DriveEntry[] }
  | { readonly mode: 'move'; readonly entries: readonly DriveEntry[] }
  | { readonly mode: 'rename'; readonly entry: DriveEntry };

interface UploadBatchState {
  readonly active: boolean;
  readonly items: Readonly<Record<string, DriveUploadProgress>>;
  readonly result: DriveUploadResult | null;
  readonly error: string | null;
}

const PAGE_SIZE = 100;
const FOLDER_CACHE_TTL_MS = 60_000;
const ROOT_BREADCRUMB: DriveBreadcrumb = { id: '0', name: '根目录' };

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : DATE_FORMATTER.format(date).replaceAll('/', '-');
}

function formatSize(value: number | null): string {
  if (value === null) {
    return '—';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
}

function getEntryDescription(entry: DriveEntry): string {
  if (entry.kind === 'folder') {
    return '文件夹';
  }

  const extensionLabel = entry.extension
    ? `${entry.extension.toUpperCase()} 文件`
    : '文件';

  if (getFileKind(entry.extension) !== 'video') {
    return extensionLabel;
  }

  const duration = formatDuration(entry.durationSeconds);
  const videoLabel = entry.extension
    ? `${entry.extension.toUpperCase()} 视频`
    : '视频';

  return duration ? `${videoLabel} · ${duration}` : videoLabel;
}

function formatDuration(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
}

function dragContainsFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files');
}

function dragContainsDirectory(items: DataTransferItemList): boolean {
  return Array.from(items).some((item) => {
    if (item.kind !== 'file') {
      return false;
    }

    const entry = (
      item as DataTransferItem & {
        webkitGetAsEntry?: () => { isDirectory: boolean } | null;
      }
    ).webkitGetAsEntry?.();

    return Boolean(entry?.isDirectory);
  });
}

function FolderIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M2.7 5.3h5.1l1.5 1.8h8v8.1H2.7V5.3Z" />
      <path d="M2.7 8.1h14.6" />
    </svg>
  );
}

type FileKind =
  | 'archive'
  | 'audio'
  | 'code'
  | 'image'
  | 'package'
  | 'pdf'
  | 'sheet'
  | 'slides'
  | 'text'
  | 'unknown'
  | 'video';

const FILE_KIND_BY_EXTENSION: Readonly<Record<string, FileKind>> = {
  '7z': 'archive',
  aac: 'audio',
  apk: 'package',
  appimage: 'package',
  ass: 'text',
  avi: 'video',
  avif: 'image',
  bmp: 'image',
  bz2: 'archive',
  c: 'code',
  cpp: 'code',
  css: 'code',
  csv: 'sheet',
  deb: 'package',
  dmg: 'package',
  doc: 'text',
  docx: 'text',
  epub: 'text',
  exe: 'package',
  flac: 'audio',
  flv: 'video',
  gif: 'image',
  go: 'code',
  gz: 'archive',
  h: 'code',
  heic: 'image',
  html: 'code',
  iso: 'package',
  java: 'code',
  jpeg: 'image',
  jpg: 'image',
  js: 'code',
  json: 'code',
  jsx: 'code',
  key: 'slides',
  m4a: 'audio',
  m4v: 'video',
  md: 'text',
  mkv: 'video',
  mov: 'video',
  mp3: 'audio',
  mp4: 'video',
  msi: 'package',
  ogg: 'audio',
  odp: 'slides',
  ods: 'sheet',
  opus: 'audio',
  pdf: 'pdf',
  pkg: 'package',
  png: 'image',
  ppt: 'slides',
  pptx: 'slides',
  py: 'code',
  rar: 'archive',
  rs: 'code',
  rtf: 'text',
  sh: 'code',
  srt: 'text',
  svg: 'image',
  tar: 'archive',
  ts: 'code',
  tsx: 'code',
  txt: 'text',
  wav: 'audio',
  webm: 'video',
  webp: 'image',
  wmv: 'video',
  xls: 'sheet',
  xlsx: 'sheet',
  xz: 'archive',
  yaml: 'code',
  yml: 'code',
  zip: 'archive',
};

function getFileKind(extension: string | null): FileKind {
  if (!extension) {
    return 'unknown';
  }

  return FILE_KIND_BY_EXTENSION[extension.toLowerCase()] ?? 'unknown';
}

function getFileKindClass(kind: FileKind): string {
  switch (kind) {
    case 'archive':
      return styles.fileArchive ?? '';
    case 'audio':
      return styles.fileAudio ?? '';
    case 'code':
      return styles.fileCode ?? '';
    case 'image':
      return styles.fileImage ?? '';
    case 'package':
      return styles.filePackage ?? '';
    case 'pdf':
      return styles.filePdf ?? '';
    case 'sheet':
      return styles.fileSheet ?? '';
    case 'slides':
      return styles.fileSlides ?? '';
    case 'text':
      return styles.fileText ?? '';
    case 'video':
      return styles.fileVideo ?? '';
    default:
      return '';
  }
}

function ArchiveIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M4 3.5h12v13H4z" />
      <path d="M8.5 3.5v2h3v2h-3v2h3v2h-3" />
      <path d="M8.5 14h3" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M7.8 14V6.2l6-1.2v7.3" />
      <circle cx="5.9" cy="14.1" r="2.1" />
      <circle cx="11.9" cy="12.7" r="2.1" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="m7 6-3.5 4L7 14M13 6l3.5 4L13 14" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <rect height="13" rx="2" width="15" x="2.5" y="3.5" />
      <circle cx="7" cy="8" r="1.4" />
      <path d="m4.6 14.3 4.1-4 2.8 2.6 2.4-2.2 2.5 3.6" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="m3.4 6.4 6.6-3.2 6.6 3.2v7.2L10 16.8l-6.6-3.2V6.4Z" />
      <path d="m3.4 6.4 6.6 3.2 6.6-3.2M10 9.6v7.2" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M5 2.8h6.2L15 6.7v10.5H5V2.8Z" />
      <path d="M11.2 2.8v4h3.8" />
      <path d="M7 11h1.2a1 1 0 1 1 0 2H7v-2Zm0 2v1.5" />
      <path d="M10 11v3.5h.8a1.75 1.75 0 0 0 0-3.5H10Zm3.3 0h1.5M13.3 11v3.5M13.3 12.7h1.2" />
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <rect height="13" rx="1.5" width="14" x="3" y="3.5" />
      <path d="M3 8h14M3 12h14M7.7 3.5v13M12.3 3.5v13" />
    </svg>
  );
}

function SlidesIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <rect height="11" rx="1.5" width="14" x="3" y="3.5" />
      <path d="M5.7 7h6.2M5.7 9.7h4.3M5.7 12.4h7.8" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M5 2.8h6.2L15 6.7v10.5H5V2.8Z" />
      <path d="M11.2 2.8v4h3.8M7.4 10.6h5.2M7.4 13.3h5.2M7.4 16h3.2" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <rect height="12" rx="2.5" width="15" x="2.5" y="4" />
      <path d="m8.5 7.4 4.2 2.6-4.2 2.6V7.4Z" />
    </svg>
  );
}

function FileTypeIcon({ kind }: { kind: FileKind }) {
  switch (kind) {
    case 'archive':
      return <ArchiveIcon />;
    case 'audio':
      return <AudioIcon />;
    case 'code':
      return <CodeIcon />;
    case 'image':
      return <ImageIcon />;
    case 'package':
      return <PackageIcon />;
    case 'pdf':
      return <PdfIcon />;
    case 'sheet':
      return <SheetIcon />;
    case 'slides':
      return <SlidesIcon />;
    case 'text':
      return <TextIcon />;
    case 'video':
      return <VideoIcon />;
    default:
      return (
        <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
          <path d="M5 2.8h6.2L15 6.7v10.5H5V2.8Z" />
          <path d="M11.2 2.8v4h3.8M7.4 11h5.2M7.4 14h4" />
        </svg>
      );
  }
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <circle cx="8.8" cy="8.8" r="5.5" />
      <path d="m13 13 3.2 3.2" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
      <path d="M13 8a5 5 0 1 1-1.5-3.6M13 3v3.2h-3.2" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="m3.2 9.3 6.8-5.5 6.8 5.5M5.2 8.6v7.6h9.6V8.6" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M2.7 5.3h5.1l1.5 1.8h8v8.1H2.7V5.3Z" />
      <path d="M2.7 8.1h14.6M10 10.2v4.2M7.9 12.3h4.2" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M10 13V4.7M6.8 7.8 10 4.6l3.2 3.2" />
      <path d="M3.5 12.7v2.7h13v-2.7" />
    </svg>
  );
}

function OfflineIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M5.5 14.6h9a3.2 3.2 0 0 0 .4-6.4A4.5 4.5 0 0 0 5 7.9a3.5 3.5 0 0 0 .5 6.7Z" />
      <path d="M10 9.1v5M7.9 12l2.1 2.1 2.1-2.1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M10 3.6v8.8M6.8 9.2l3.2 3.2 3.2-3.2" />
      <path d="M3.5 15.2h13" />
    </svg>
  );
}

function createDownloadId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="m4 13.9-.7 3.1 3.1-.7L15 7.7 11.6 4.3 4 13.9Z" />
      <path d="m10.7 5.2 3.4 3.4" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M3.3 6.2h5l1.5 1.7h6.9v7.6H3.3V6.2Z" />
      <path d="M10 9.3v4.2M8.2 11.7 10 13.5l1.8-1.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M4.5 6.2h11M8 6.2V4.5h4v1.7M5.8 6.2l.7 9.3h7l.7-9.3M8.5 8.5v4.5M11.5 8.5v4.5" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M7.7 18.5h8.8a4.1 4.1 0 0 0 .5-8.16A5.7 5.7 0 0 0 6.1 9.1a4.75 4.75 0 0 0 1.6 9.4Z" />
      <path d="M12 9.8v5.7M9.7 13.2 12 15.5l2.3-2.3" />
    </svg>
  );
}

function SkeletonRows() {
  return (
    <div className={styles.skeletonList} aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className={styles.skeletonRow} key={index}>
          <span className={styles.skeletonIcon} />
          <span className={styles.skeletonName} />
          <span className={styles.skeletonMeta} />
        </div>
      ))}
    </div>
  );
}

interface StatePanelProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

function StatePanel({ title, description, action }: StatePanelProps) {
  return (
    <div className={styles.statePanel}>
      <span className={styles.stateIcon} aria-hidden="true">
        <CloudIcon />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <button
          className={`${ui.button} ${ui.buttonPrimary}`}
          disabled={action.disabled}
          type="button"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface DriveWorkspaceContentProps {
  readonly accountError: string;
  readonly activeQuery: string | null;
  readonly entries: readonly DriveEntry[];
  readonly error: DriveError | null;
  readonly fileListRef: RefObject<HTMLUListElement | null>;
  readonly hasAccount: boolean;
  readonly isAuthError: boolean;
  readonly isLoading: boolean;
  readonly isLoadingAccounts: boolean;
  readonly isLoggingIn: boolean;
  readonly isSearchActive: boolean;
  readonly needsLogin: boolean;
  readonly selectedIds: readonly string[];
  readonly onFileListScroll: (event: UIEvent<HTMLUListElement>) => void;
  readonly onLogin: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenEntry: (entry: DriveEntry) => void;
  readonly onRetryAccounts: () => void;
  readonly onRetryLoad: () => void;
  readonly onRetrySearch: () => void;
  readonly onSelectEntry: (entry: DriveEntry, additive: boolean) => void;
}

function DriveWorkspaceContent({
  accountError,
  activeQuery,
  entries,
  error,
  fileListRef,
  hasAccount,
  isAuthError,
  isLoading,
  isLoadingAccounts,
  isLoggingIn,
  isSearchActive,
  needsLogin,
  selectedIds,
  onFileListScroll,
  onLogin,
  onOpenSettings,
  onOpenEntry,
  onRetryAccounts,
  onRetryLoad,
  onRetrySearch,
  onSelectEntry,
}: DriveWorkspaceContentProps) {
  if (isLoadingAccounts) {
    return <SkeletonRows />;
  }

  if (!hasAccount) {
    if (accountError) {
      return (
        <StatePanel
          description={accountError}
          title="无法读取 115 账号"
          action={{ label: '重试', onClick: onRetryAccounts }}
        />
      );
    }

    return (
      <StatePanel
        description="请先在设置中添加并登录 115 网盘。登录地址需要使用 https://115.com/。"
        title="未检测到 115 账号"
        action={{ label: '前往设置', onClick: onOpenSettings }}
      />
    );
  }

  if (needsLogin) {
    return (
      <StatePanel
        description={
          accountError ||
          (isAuthError
            ? 'Cookie 可能已过期，请重新登录后继续浏览。'
            : '此站点连接还没有保存 Cookie，请先完成登录。')
        }
        title={isAuthError ? '115 登录已失效' : '115 尚未登录'}
        action={{
          label: isLoggingIn ? '等待登录窗口…' : '登录 115',
          onClick: onLogin,
          disabled: isLoggingIn,
        }}
      />
    );
  }

  if (accountError) {
    return (
      <StatePanel
        description={accountError}
        title="115 账号不可用"
        action={{ label: '重试', onClick: onRetryAccounts }}
      />
    );
  }

  if (isLoading) {
    return <SkeletonRows />;
  }

  if (error) {
    if (isAuthError) {
      return (
        <StatePanel
          description={error.message}
          title="115 登录已失效"
          action={{
            label: isLoggingIn ? '等待登录窗口…' : '重新登录',
            onClick: onLogin,
            disabled: isLoggingIn,
          }}
        />
      );
    }

    return (
      <StatePanel
        description={error.message}
        title="无法读取 115 目录"
        action={{
          label: '重试',
          onClick: isSearchActive ? onRetrySearch : onRetryLoad,
        }}
      />
    );
  }

  if (entries.length === 0) {
    return (
      <StatePanel
        description={
          isSearchActive
            ? `“${activeQuery}”在当前目录中没有匹配的文件或文件夹。`
            : '此目录下还没有文件或文件夹。'
        }
        title={isSearchActive ? '没有找到匹配项' : '这个文件夹是空的'}
      />
    );
  }

  return (
    <div className={styles.listView}>
      <div className={styles.tableHead}>
        <span>名称</span>
        <span>大小</span>
        <span>修改时间</span>
        <span />
      </div>

      <ul
        className={styles.fileList}
        ref={fileListRef}
        onScroll={onFileListScroll}
      >
        {entries.map((entry) => {
          const isSelected = selectedIds.includes(entry.id);
          const isFolder = entry.kind === 'folder';
          const fileKind = isFolder ? null : getFileKind(entry.extension);
          const fileKindClass = fileKind ? getFileKindClass(fileKind) : '';

          return (
            <li className={styles.fileItem} key={`${entry.kind}-${entry.id}`}>
              <button
                aria-label={`${entry.name}，${getEntryDescription(entry)}`}
                aria-pressed={isSelected}
                className={`${styles.fileRow}${isSelected ? ` ${styles.selected}` : ''}`}
                type="button"
                onClick={(event) => {
                  onSelectEntry(entry, event.ctrlKey || event.metaKey);
                }}
                onDoubleClick={() => {
                  onOpenEntry(entry);
                }}
                onKeyDown={(event) => {
                  if (isFolder && event.key === 'Enter') {
                    event.preventDefault();
                    onOpenEntry(entry);
                  }
                }}
              >
                <span className={styles.fileNameCell}>
                  <span
                    className={`${styles.fileIcon} ${
                      isFolder
                        ? styles.folderIcon
                        : `${styles.documentIcon}${
                            fileKindClass ? ` ${fileKindClass}` : ''
                          }`
                    }`}
                    aria-hidden="true"
                  >
                    {isFolder ? (
                      <FolderIcon />
                    ) : (
                      <FileTypeIcon kind={fileKind ?? 'unknown'} />
                    )}
                  </span>
                  <span className={styles.fileCopy}>
                    <span className={styles.fileName} title={entry.name}>
                      {entry.name}
                    </span>
                    <span className={styles.fileDescription}>
                      {getEntryDescription(entry)}
                    </span>
                  </span>
                </span>
                <span className={styles.fileSize}>
                  {isFolder ? '—' : formatSize(entry.size)}
                </span>
                <span className={styles.fileDate}>
                  {formatDate(entry.modifiedAt)}
                </span>
                <span className={styles.fileChevron} aria-hidden="true">
                  {isFolder && <ChevronIcon />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DrivePage({ isActive, onOpenSettings }: DrivePageProps) {
  const [account, setAccount] = useState<DriveAccount | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [accountError, setAccountError] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<readonly DriveBreadcrumb[]>([
    ROOT_BREADCRUMB,
  ]);
  const [entries, setEntries] = useState<readonly DriveEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<DriveError | null>(null);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [dialog, setDialog] = useState<DriveDialogState | null>(null);
  const [isOfflineOpen, setIsOfflineOpen] = useState(false);
  const [uploadBatch, setUploadBatch] = useState<UploadBatchState | null>(null);
  const [downloadProgress, setDownloadProgress] =
    useState<DriveVideoDownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const requestIdRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileListRef = useRef<HTMLUListElement>(null);
  const fileListScrollTopRef = useRef(0);
  const folderCacheRef = useRef(new Map<string, CachedFolder>());
  const dragDepthRef = useRef(0);
  const uploadInFlightRef = useRef(false);
  const offlineSubmittedRef = useRef(false);
  const activeDownloadIdRef = useRef<string | null>(null);
  const dropUploadRef = useRef<(files: readonly File[]) => void>(() => {});
  const showUploadErrorRef = useRef<(message: string) => void>(() => {});

  const currentBreadcrumb =
    breadcrumbs[breadcrumbs.length - 1] ?? ROOT_BREADCRUMB;
  const currentFolderId = currentBreadcrumb.id;
  const currentFolderName = currentBreadcrumb.name;
  const isSearchActive = activeQuery !== null;
  const isAuthError = error?.code === 'auth_required';
  const needsLogin =
    Boolean(account) &&
    (account?.status === 'empty' || isAuthError) &&
    !isLoading;
  const selectedEntries = entries.filter((entry) =>
    selectedIds.includes(entry.id),
  );
  const selectedEntry =
    selectedEntries.length === 1 ? selectedEntries[0] : null;
  const selectedVideo =
    selectedEntry?.kind === 'file' &&
    getFileKind(selectedEntry.extension) === 'video'
      ? selectedEntry
      : null;
  const canMutate =
    Boolean(account) &&
    !isLoadingAccounts &&
    !needsLogin &&
    !isAuthError &&
    !accountError &&
    !isLoading;
  const isUploading = uploadBatch?.active ?? false;
  const canDropFiles = canMutate && !isUploading && !isDownloading;
  const uploadItems = uploadBatch
    ? Object.values(uploadBatch.items).sort(
        (left, right) => left.fileIndex - right.fileIndex,
      )
    : [];

  const loadFolder = useCallback(
    async (
      connectionId: string,
      folderId: string,
      offset = 0,
      append = false,
      force = false,
    ) => {
      const requestId = ++requestIdRef.current;
      const cacheKey = `${connectionId}:${folderId}`;
      const cached =
        !append && !force ? folderCacheRef.current.get(cacheKey) : undefined;

      if (!append) {
        fileListScrollTopRef.current = 0;

        if (fileListRef.current) {
          fileListRef.current.scrollTop = 0;
        }
      }

      if (append) {
        setIsLoadingMore(true);
      } else if (cached) {
        setEntries(cached.entries);
        setTotal(cached.total);
        setHasMore(cached.hasMore);
        setBreadcrumbs(cached.breadcrumbs);
        setSelectedIds([]);
        setActiveQuery(null);
        setError(null);
        setIsLoading(false);

        if (Date.now() - cached.cachedAt < FOLDER_CACHE_TTL_MS) {
          setIsLoadingMore(false);
          return;
        }
      } else {
        setIsLoading(true);
        setIsLoadingMore(false);
        setEntries([]);
        setSelectedIds([]);
      }

      setError(null);

      try {
        const result = await window.desktop.drive.listFolder({
          connectionId,
          folderId,
          offset,
          limit: PAGE_SIZE,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!result.ok) {
          if (!cached || result.error.code === 'auth_required') {
            setError(result.error);
          }

          if (!cached) {
            setHasMore(false);
          }

          return;
        }

        setEntries((current) =>
          append ? [...current, ...result.data.entries] : result.data.entries,
        );
        setTotal(result.data.total);
        setHasMore(result.data.hasMore);

        if (append) {
          const existing = folderCacheRef.current.get(cacheKey);

          if (existing) {
            folderCacheRef.current.set(cacheKey, {
              ...existing,
              entries: [...existing.entries, ...result.data.entries],
              total: result.data.total,
              hasMore: result.data.hasMore,
              cachedAt: Date.now(),
            });
          }
        } else {
          setBreadcrumbs(result.data.breadcrumbs);
          setActiveQuery(null);
          folderCacheRef.current.set(cacheKey, {
            entries: result.data.entries,
            total: result.data.total,
            hasMore: result.data.hasMore,
            breadcrumbs: result.data.breadcrumbs,
            cachedAt: Date.now(),
          });
        }
      } catch (loadFailure: unknown) {
        if (requestId === requestIdRef.current && !cached) {
          setError({
            code: 'api',
            message: toErrorMessage(
              loadFailure,
              '读取 115 目录失败，请稍后重试。',
            ),
          });
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [],
  );

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    setAccountError('');
    setError(null);

    try {
      const result = await window.desktop.drive.listAccounts();

      if (!result.ok) {
        setAccountError(result.error.message);
        setAccount(null);
        return;
      }

      const firstAccount = result.data[0] ?? null;
      setAccount(firstAccount);

      if (!firstAccount) {
        return;
      }

      if (firstAccount.status === 'connected') {
        await loadFolder(firstAccount.connectionId, '0');
      } else {
        setBreadcrumbs([ROOT_BREADCRUMB]);
        setEntries([]);
        setTotal(0);
        setHasMore(false);
      }
    } catch (loadFailure: unknown) {
      setAccountError(
        toErrorMessage(loadFailure, '读取 115 账号失败，请稍后重试。'),
      );
      setAccount(null);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [loadFolder]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (fileListRef.current) {
        fileListRef.current.scrollTop = fileListScrollTopRef.current;
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isActive]);

  useEffect(() => {
    return window.desktop.drive.onUploadProgress((progress) => {
      setUploadBatch((current) => {
        if (!current?.active) {
          return current;
        }

        return {
          ...current,
          items: {
            ...current.items,
            [String(progress.fileIndex)]: progress,
          },
        };
      });
    });
  }, []);

  useEffect(() => {
    return window.desktop.drive.onVideoDownloadProgress((progress) => {
      if (progress.downloadId !== activeDownloadIdRef.current) {
        return;
      }

      if (progress.status === 'canceled') {
        return;
      }

      setDownloadProgress(progress);

      if (progress.status === 'failed') {
        setDownloadError(progress.error ?? '视频下载失败，请稍后重试。');
      } else if (progress.status === 'success') {
        setDownloadError(null);
      }
    });
  }, []);

  useEffect(() => {
    if (
      !isActive ||
      !uploadBatch ||
      uploadBatch.active ||
      !uploadBatch.result ||
      uploadBatch.result.failed > 0 ||
      uploadBatch.result.uploaded === 0
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setUploadBatch(null);
    }, 2600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isActive, uploadBatch]);

  const handleSearch = async (searchQuery: string) => {
    if (!account || !searchQuery.trim()) {
      return;
    }

    const normalizedQuery = searchQuery.trim();
    const requestId = ++requestIdRef.current;

    setQuery(normalizedQuery);
    setActiveQuery(normalizedQuery);
    setIsLoading(true);
    setIsLoadingMore(false);
    setError(null);
    setEntries([]);
    setSelectedIds([]);
    fileListScrollTopRef.current = 0;

    if (fileListRef.current) {
      fileListRef.current.scrollTop = 0;
    }

    try {
      const result = await window.desktop.drive.searchFolder({
        connectionId: account.connectionId,
        folderId: currentFolderId,
        query: normalizedQuery,
        offset: 0,
        limit: PAGE_SIZE,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setHasMore(false);
        return;
      }

      setEntries(result.data.entries);
      setTotal(result.data.total);
      setHasMore(result.data.hasMore);
    } catch (searchFailure: unknown) {
      if (requestId === requestIdRef.current) {
        setError({
          code: 'api',
          message: toErrorMessage(
            searchFailure,
            '搜索 115 目录失败，请稍后重试。',
          ),
        });
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const refreshAfterMutation = async (clearSearch = false) => {
    folderCacheRef.current.clear();
    setSelectedIds([]);

    if (!account) {
      return;
    }

    if (clearSearch) {
      setQuery('');
      setActiveQuery(null);
      await loadFolder(account.connectionId, currentFolderId, 0, false, true);
      return;
    }

    if (activeQuery) {
      await handleSearch(activeQuery);
      return;
    }

    await loadFolder(account.connectionId, currentFolderId, 0, false, true);
  };

  const showUploadError = (message: string) => {
    setUploadBatch({
      active: false,
      items: {},
      result: null,
      error: message,
    });
  };

  const runUpload = async (
    upload: () => Promise<DriveResult<DriveUploadResult>>,
  ) => {
    if (!account || uploadInFlightRef.current) {
      return;
    }

    uploadInFlightRef.current = true;
    setUploadBatch({
      active: true,
      items: {},
      result: null,
      error: null,
    });

    try {
      const result = await upload();

      if (!result.ok) {
        setUploadBatch((current) =>
          current
            ? {
                ...current,
                active: false,
                error: result.error.message,
              }
            : current,
        );
        return;
      }

      if (result.data.canceled) {
        setUploadBatch(null);
        return;
      }

      setUploadBatch((current) =>
        current
          ? {
              ...current,
              active: false,
              result: result.data,
            }
          : current,
      );

      if (result.data.uploaded > 0) {
        await refreshAfterMutation(true);
      }
    } catch (uploadFailure: unknown) {
      setUploadBatch((current) =>
        current
          ? {
              ...current,
              active: false,
              error: toErrorMessage(uploadFailure, '上传失败，请稍后重试。'),
            }
          : current,
      );
    } finally {
      uploadInFlightRef.current = false;
    }
  };

  const handleUpload = async () => {
    if (!account) {
      return;
    }

    await runUpload(() =>
      window.desktop.drive.uploadFiles({
        connectionId: account.connectionId,
        targetFolderId: currentFolderId,
      }),
    );
  };

  const handleDroppedUpload = async (files: readonly File[]) => {
    if (!account) {
      return;
    }

    await runUpload(() =>
      window.desktop.drive.uploadDroppedFiles(
        {
          connectionId: account.connectionId,
          targetFolderId: currentFolderId,
        },
        files,
      ),
    );
  };

  const handleDownloadVideo = async (entry: DriveEntry) => {
    if (!account || isDownloading || !entry.pickcode) {
      return;
    }

    const downloadId = createDownloadId();

    activeDownloadIdRef.current = downloadId;
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress({
      downloadId,
      fileName: entry.name,
      receivedBytes: 0,
      totalBytes: entry.size ?? 0,
      status: 'preparing',
    });

    try {
      const result = await window.desktop.drive.downloadVideo({
        downloadId,
        connectionId: account.connectionId,
        pickcode: entry.pickcode,
        fileName: entry.name,
      });

      if (!result.ok) {
        setDownloadProgress((current) =>
          current
            ? {
                ...current,
                status: 'failed',
                error: result.error.message,
              }
            : null,
        );
        setDownloadError(result.error.message);
        return;
      }

      if (result.data.canceled) {
        activeDownloadIdRef.current = null;
        setDownloadProgress(null);
        return;
      }

      setDownloadProgress((current) =>
        current
          ? {
              ...current,
              status: 'success',
              receivedBytes: result.data.bytes,
              totalBytes: result.data.bytes,
              filePath: result.data.filePath ?? undefined,
            }
          : null,
      );
    } catch (downloadFailure: unknown) {
      const message = toErrorMessage(
        downloadFailure,
        '视频下载失败，请稍后重试。',
      );

      setDownloadProgress((current) =>
        current
          ? {
              ...current,
              status: 'failed',
              error: message,
            }
          : null,
      );
      setDownloadError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    showUploadErrorRef.current = showUploadError;
    dropUploadRef.current = (files) => {
      void handleDroppedUpload(files);
    };
  });

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const onDragEnter = (event: globalThis.DragEvent) => {
      const dataTransfer = event.dataTransfer;

      if (!dataTransfer || !dragContainsFiles(dataTransfer)) {
        return;
      }

      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDraggingFiles(true);
    };

    const onDragOver = (event: globalThis.DragEvent) => {
      const dataTransfer = event.dataTransfer;

      if (!dataTransfer || !dragContainsFiles(dataTransfer)) {
        return;
      }

      event.preventDefault();
      dataTransfer.dropEffect = canDropFiles ? 'copy' : 'none';
    };

    const onDragLeave = (event: globalThis.DragEvent) => {
      if (dragDepthRef.current === 0) {
        return;
      }

      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

      if (dragDepthRef.current === 0) {
        setIsDraggingFiles(false);
      }
    };

    const onDrop = (event: globalThis.DragEvent) => {
      const dataTransfer = event.dataTransfer;

      if (!dataTransfer) {
        return;
      }

      if (!dragContainsFiles(dataTransfer) && dataTransfer.files.length === 0) {
        return;
      }

      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);

      if (!canMutate) {
        showUploadErrorRef.current('请先登录 115 后再上传文件。');
        return;
      }

      if (isUploading || uploadInFlightRef.current) {
        return;
      }

      const files = Array.from(dataTransfer.files);

      if (files.length === 0) {
        return;
      }

      if (dragContainsDirectory(dataTransfer.items)) {
        showUploadErrorRef.current('暂不支持拖拽文件夹，请拖入文件。');
        return;
      }

      dropUploadRef.current(files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
    };
  }, [canDropFiles, canMutate, isActive, isUploading]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!query.trim()) {
      if (activeQuery) {
        setQuery('');
        setActiveQuery(null);
        if (account) {
          void loadFolder(account.connectionId, currentFolderId);
        }
      }
      return;
    }

    void handleSearch(query);
  };

  const clearSearch = () => {
    setQuery('');
    setActiveQuery(null);
    setError(null);

    if (account) {
      void loadFolder(account.connectionId, currentFolderId);
    }
  };

  const navigateToFolder = (folderId: string) => {
    if (!account) {
      return;
    }

    setQuery('');
    setActiveQuery(null);
    void loadFolder(account.connectionId, folderId);
  };

  const handleBreadcrumb = (breadcrumb: DriveBreadcrumb) => {
    if (breadcrumb.id === currentFolderId) {
      return;
    }

    navigateToFolder(breadcrumb.id);
  };

  const handleRefresh = () => {
    if (!account) {
      return;
    }

    if (activeQuery) {
      void handleSearch(activeQuery);
    } else {
      void loadFolder(account.connectionId, currentFolderId, 0, false, true);
    }
  };

  const handleLoadMore = () => {
    if (!account || isLoading || isLoadingMore || !hasMore) {
      return;
    }

    if (activeQuery) {
      const requestId = ++requestIdRef.current;
      setIsLoadingMore(true);
      setError(null);

      void window.desktop.drive
        .searchFolder({
          connectionId: account.connectionId,
          folderId: currentFolderId,
          query: activeQuery,
          offset: entries.length,
          limit: PAGE_SIZE,
        })
        .then((result) => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          if (!result.ok) {
            setError(result.error);
            return;
          }

          setEntries((current) => [...current, ...result.data.entries]);
          setTotal(result.data.total);
          setHasMore(result.data.hasMore);
        })
        .catch((loadFailure: unknown) => {
          if (requestId === requestIdRef.current) {
            setError({
              code: 'api',
              message: toErrorMessage(
                loadFailure,
                '加载更多文件失败，请稍后重试。',
              ),
            });
          }
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setIsLoadingMore(false);
          }
        });

      return;
    }

    void loadFolder(
      account.connectionId,
      currentFolderId,
      entries.length,
      true,
    );
  };

  const handleLogin = async () => {
    if (!account || isLoggingIn) {
      return;
    }

    setIsLoggingIn(true);
    setAccountError('');

    try {
      const updated = await window.desktop.connections.login(
        account.connectionId,
      );

      setAccount({
        ...account,
        name: updated.name,
        loginUrl: updated.loginUrl,
        status: updated.status,
        cookieCount: updated.cookieCount,
      });
      setBreadcrumbs([ROOT_BREADCRUMB]);
      setActiveQuery(null);
      setQuery('');
      folderCacheRef.current.clear();
      await loadFolder(account.connectionId, '0', 0, false, true);
    } catch (loginFailure: unknown) {
      setAccountError(
        toErrorMessage(loginFailure, '115 登录失败，请稍后重试。'),
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEntryClick = (entry: DriveEntry, additive: boolean) => {
    setSelectedIds((current) => {
      if (!additive) {
        return [entry.id];
      }

      return current.includes(entry.id)
        ? current.filter((id) => id !== entry.id)
        : [...current, entry.id];
    });
  };

  const handleEntryDoubleClick = (entry: DriveEntry) => {
    if (entry.kind === 'folder') {
      navigateToFolder(entry.id);
    }
  };

  const handleCreateFolder = async (
    name: string,
  ): Promise<DriveResult<null>> => {
    if (!account) {
      return {
        ok: false,
        error: { code: 'no_account', message: '尚未连接 115 账号。' },
      };
    }

    return window.desktop.drive.createFolder({
      connectionId: account.connectionId,
      parentId: currentFolderId,
      name,
    });
  };

  const handleRenameEntry = async (
    entry: DriveEntry,
    name: string,
  ): Promise<DriveResult<null>> => {
    if (!account) {
      return {
        ok: false,
        error: { code: 'no_account', message: '尚未连接 115 账号。' },
      };
    }

    return window.desktop.drive.renameEntry({
      connectionId: account.connectionId,
      entryId: entry.id,
      kind: entry.kind,
      name,
    });
  };

  const handleDeleteEntry = async (
    targets: readonly DriveEntry[],
  ): Promise<DriveResult<null>> => {
    if (!account) {
      return {
        ok: false,
        error: { code: 'no_account', message: '尚未连接 115 账号。' },
      };
    }

    return window.desktop.drive.deleteEntry({
      connectionId: account.connectionId,
      entries: targets.map((entry) => ({
        entryId: entry.id,
        parentId: entry.parentId || currentFolderId,
      })),
    });
  };

  const statusLabel = isLoadingAccounts
    ? '读取中…'
    : !account
      ? '未连接'
      : account.status === 'empty'
        ? '待登录'
        : isAuthError
          ? '登录已失效'
          : '已连接';

  return (
    <main className={styles.drivePage}>
      <header className={styles.pageHeader}>
        <div className={styles.identity}>
          <p className={styles.eyebrow}>115 / Cloud Drive</p>
          <div className={styles.titleRow}>
            <span className={styles.providerBadge} aria-hidden="true">
              115
            </span>
            <h1>115 网盘</h1>
            <span
              className={`${styles.statusPill}${isAuthError ? ` ${styles.statusError}` : ''}${account?.status === 'empty' ? ` ${styles.statusEmpty}` : ''}`}
            >
              <span className={styles.statusDot} aria-hidden="true" />
              {statusLabel}
            </span>
            <div className={styles.quickActions}>
              <button
                aria-label="新建文件夹"
                className={styles.quickButton}
                disabled={!canMutate || isUploading}
                title="新建文件夹"
                type="button"
                onClick={() => {
                  setDialog({ mode: 'create-folder' });
                }}
              >
                <FolderPlusIcon />
                <span className={styles.quickLabel}>新建文件夹</span>
              </button>
              <button
                aria-label={isUploading ? '正在上传' : '上传'}
                className={`${styles.quickButton} ${styles.quickButtonUpload}`}
                disabled={!canMutate || isUploading || isDownloading}
                title="上传文件到当前目录，不会上传到已选文件夹"
                type="button"
                onClick={() => {
                  void handleUpload();
                }}
              >
                <UploadIcon />
                <span className={styles.quickLabel}>
                  {isUploading ? '上传中…' : '上传'}
                </span>
              </button>
              <button
                aria-label="离线任务"
                className={styles.quickButton}
                disabled={!canMutate}
                title="查看和提交离线任务"
                type="button"
                onClick={() => {
                  setIsOfflineOpen(true);
                }}
              >
                <OfflineIcon />
                <span className={styles.quickLabel}>离线任务</span>
              </button>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <form
            aria-label="115 网盘搜索"
            className={styles.searchForm}
            onSubmit={handleSearchSubmit}
          >
            <button
              aria-label="搜索"
              className={styles.searchSubmit}
              disabled={
                !account || isLoadingAccounts || needsLogin || isAuthError
              }
              title="搜索当前目录"
              type="submit"
            >
              <SearchIcon />
            </button>
            <input
              aria-keyshortcuts="Control+K"
              aria-label="搜索当前目录"
              disabled={
                !account || isLoadingAccounts || needsLogin || isAuthError
              }
              placeholder="搜索当前目录"
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
            {query || isSearchActive ? (
              <button
                aria-label="清除搜索"
                className={styles.clearSearch}
                type="button"
                onClick={clearSearch}
              >
                ×
              </button>
            ) : null}
            <kbd>Ctrl K</kbd>
          </form>
          <button
            className={`${ui.button} ${ui.buttonSecondary} ${styles.refreshButton}`}
            disabled={!account || isLoading || needsLogin || isAuthError}
            type="button"
            onClick={handleRefresh}
          >
            <RefreshIcon />
            刷新
          </button>
        </div>
      </header>

      <section className={styles.workspace} aria-label="115 网盘文件">
        <header className={styles.toolbar}>
          <nav aria-label="目录路径" className={styles.breadcrumbs}>
            {breadcrumbs.map((breadcrumb, index) => {
              const isCurrent = breadcrumb.id === currentFolderId;

              return (
                <span className={styles.breadcrumbItem} key={breadcrumb.id}>
                  {index > 0 && (
                    <span
                      className={styles.breadcrumbSeparator}
                      aria-hidden="true"
                    >
                      /
                    </span>
                  )}
                  <button
                    className={`${styles.breadcrumb}${
                      isCurrent ? ` ${styles.breadcrumbCurrent}` : ''
                    }`}
                    disabled={isCurrent}
                    type="button"
                    onClick={() => {
                      handleBreadcrumb(breadcrumb);
                    }}
                  >
                    {index === 0 && (
                      <span className={styles.homeIcon} aria-hidden="true">
                        <HomeIcon />
                      </span>
                    )}
                    {breadcrumb.name}
                  </button>
                </span>
              );
            })}
            <span className={styles.itemCount}>
              {isSearchActive ? `${total} 个结果` : `${total} 项`}
            </span>
          </nav>

          <div className={styles.toolbarSide}>
            <span className={styles.toolbarMeta}>
              {isSearchActive
                ? `在“${currentFolderName}”中搜索“${activeQuery}”`
                : selectedEntries.length > 1
                  ? `已选 ${selectedEntries.length} 项`
                  : selectedEntry
                    ? `已选：${selectedEntry.name}`
                    : '双击文件夹进入下一层'}
            </span>

            {selectedEntries.length > 0 && (
              <div className={styles.toolbarActions}>
                {selectedVideo && (
                  <button
                    className={styles.toolButton}
                    disabled={
                      !canMutate ||
                      isUploading ||
                      isDownloading ||
                      !selectedVideo.pickcode
                    }
                    title={
                      selectedVideo.pickcode
                        ? '下载视频到本地'
                        : '该视频缺少下载标识'
                    }
                    type="button"
                    onClick={() => {
                      void handleDownloadVideo(selectedVideo);
                    }}
                  >
                    <DownloadIcon />
                    {isDownloading ? '下载中…' : '下载'}
                  </button>
                )}
                <button
                  className={styles.toolButton}
                  disabled={
                    !canMutate || isUploading || selectedEntries.length !== 1
                  }
                  type="button"
                  onClick={() => {
                    if (selectedEntry) {
                      setDialog({ mode: 'rename', entry: selectedEntry });
                    }
                  }}
                >
                  <PencilIcon />
                  重命名
                </button>
                <button
                  className={styles.toolButton}
                  disabled={!canMutate || isUploading}
                  type="button"
                  onClick={() => {
                    setDialog({
                      mode: 'move',
                      entries: selectedEntries,
                    });
                  }}
                >
                  <MoveIcon />
                  移动
                </button>
                <button
                  className={`${styles.toolButton} ${styles.toolButtonDanger}`}
                  disabled={!canMutate || isUploading}
                  type="button"
                  onClick={() => {
                    setDialog({
                      mode: 'delete',
                      entries: selectedEntries,
                    });
                  }}
                >
                  <TrashIcon />
                  删除
                </button>
              </div>
            )}
          </div>
        </header>

        <DriveWorkspaceContent
          accountError={accountError}
          activeQuery={activeQuery}
          entries={entries}
          error={error}
          fileListRef={fileListRef}
          hasAccount={Boolean(account)}
          isAuthError={isAuthError}
          isLoading={isLoading}
          isLoadingAccounts={isLoadingAccounts}
          isLoggingIn={isLoggingIn}
          isSearchActive={isSearchActive}
          needsLogin={needsLogin}
          selectedIds={selectedIds}
          onFileListScroll={(event) => {
            fileListScrollTopRef.current = event.currentTarget.scrollTop;
          }}
          onLogin={() => {
            void handleLogin();
          }}
          onOpenEntry={handleEntryDoubleClick}
          onOpenSettings={onOpenSettings}
          onRetryAccounts={() => {
            void loadAccounts();
          }}
          onRetryLoad={() => {
            if (account) {
              void loadFolder(
                account.connectionId,
                currentFolderId,
                0,
                false,
                true,
              );
            }
          }}
          onRetrySearch={() => {
            void handleSearch(activeQuery ?? '');
          }}
          onSelectEntry={handleEntryClick}
        />

        {account &&
          !isAuthError &&
          !needsLogin &&
          !accountError &&
          !isLoading &&
          !error && (
            <footer className={styles.workspaceFooter}>
              <span>
                <strong>{isSearchActive ? '搜索结果' : '共'}</strong>{' '}
                {isSearchActive ? `${total} 项 · ` : `${total} 项 · `}
                双击打开文件夹
              </span>
              {hasMore && (
                <button
                  className={`${ui.button} ${ui.buttonSecondary} ${styles.loadMore}`}
                  disabled={isLoadingMore}
                  type="button"
                  onClick={handleLoadMore}
                >
                  {isLoadingMore ? '加载中…' : '加载更多'}
                </button>
              )}
            </footer>
          )}
      </section>

      {isDraggingFiles && (
        <output
          className={`${styles.dropOverlay}${
            canDropFiles ? '' : ` ${styles.dropOverlayBlocked}`
          }`}
        >
          <div className={styles.dropPanel}>
            <span className={styles.dropIcon} aria-hidden="true">
              <UploadIcon />
            </span>
            <strong>
              {canDropFiles
                ? '松开以上传到当前目录'
                : needsLogin
                  ? '请先登录 115'
                  : isUploading
                    ? '正在上传，请稍候'
                    : '当前无法上传'}
            </strong>
            <p>文件会保存到「{currentFolderName}」</p>
            <span className={styles.dropHint}>
              仅支持文件，暂不支持拖拽文件夹
            </span>
          </div>
        </output>
      )}

      {dialog?.mode === 'create-folder' && (
        <DriveActionDialog
          mode="create-folder"
          onClose={() => {
            setDialog(null);
          }}
          onCompleted={() => {
            void refreshAfterMutation(true);
          }}
          onSubmit={handleCreateFolder}
        />
      )}

      {dialog?.mode === 'rename' && (
        <DriveActionDialog
          entryName={dialog.entry.name}
          initialName={dialog.entry.name}
          mode="rename"
          onClose={() => {
            setDialog(null);
          }}
          onCompleted={() => {
            void refreshAfterMutation(false);
          }}
          onSubmit={(name) => handleRenameEntry(dialog.entry, name)}
        />
      )}

      {dialog?.mode === 'delete' && (
        <DriveActionDialog
          entryName={
            dialog.entries.length === 1
              ? (dialog.entries[0]?.name ?? '')
              : `已选中的 ${dialog.entries.length} 个项目`
          }
          itemCount={dialog.entries.length}
          mode="delete"
          onClose={() => {
            setDialog(null);
          }}
          onCompleted={() => {
            void refreshAfterMutation(false);
          }}
          onSubmit={() => handleDeleteEntry(dialog.entries)}
        />
      )}

      {dialog?.mode === 'move' && account && (
        <DriveMoveDialog
          connectionId={account.connectionId}
          entries={dialog.entries}
          onClose={() => {
            setDialog(null);
          }}
          onCompleted={() => {
            void refreshAfterMutation(false);
          }}
        />
      )}

      {isOfflineOpen && account && (
        <DriveOfflineDialog
          connectionId={account.connectionId}
          folderId={currentFolderId}
          folderName={currentFolderName}
          onClose={() => {
            setIsOfflineOpen(false);

            if (offlineSubmittedRef.current) {
              offlineSubmittedRef.current = false;
              folderCacheRef.current.clear();
              void loadFolder(
                account.connectionId,
                currentFolderId,
                0,
                false,
                true,
              );
            }
          }}
          onSubmitted={() => {
            offlineSubmittedRef.current = true;
          }}
        />
      )}

      {uploadBatch && (
        <DriveUploadPanel
          active={uploadBatch.active}
          error={uploadBatch.error}
          items={uploadItems}
          result={uploadBatch.result}
          onClose={() => {
            setUploadBatch(null);
          }}
        />
      )}

      {downloadProgress && (
        <DriveDownloadPanel
          error={downloadError}
          progress={downloadProgress}
          onClose={() => {
            activeDownloadIdRef.current = null;
            setDownloadProgress(null);
            setDownloadError(null);
          }}
          onOpenFolder={() => {
            void window.desktop.drive
              .openDownloadFolder(downloadProgress.downloadId)
              .then((result) => {
                if (!result.ok) {
                  setDownloadError(result.error.message);
                }
              })
              .catch(() => {
                setDownloadError('无法打开下载目录。');
              });
          }}
        />
      )}
    </main>
  );
}
