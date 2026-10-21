import type { DriveVideoDownloadProgress } from '@shared/drive';
import styles from './DriveDownloadPanel.module.css';

interface DriveDownloadPanelProps {
  readonly error: string | null;
  readonly isCancelling: boolean;
  readonly progress: DriveVideoDownloadProgress;
  readonly onCancel: () => void;
  readonly onClose: () => void;
  readonly onOpenFolder: () => void;
}

function formatBytes(value: number): string {
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

function isActive(progress: DriveVideoDownloadProgress): boolean {
  return progress.status === 'preparing' || progress.status === 'downloading';
}

export function DriveDownloadPanel({
  error,
  isCancelling,
  progress,
  onCancel,
  onClose,
  onOpenFolder,
}: DriveDownloadPanelProps) {
  const active = isActive(progress);
  const title =
    progress.status === 'preparing'
      ? '准备下载…'
      : progress.status === 'downloading'
        ? '正在下载'
        : progress.status === 'success'
          ? '下载完成'
          : progress.status === 'failed'
            ? '下载失败'
            : '已取消';
  const percent =
    progress.status === 'success'
      ? 100
      : progress.totalBytes > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round((progress.receivedBytes / progress.totalBytes) * 100),
            ),
          )
        : 0;

  return (
    <aside className={styles.panel} aria-live="polite" aria-label="下载进度">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Download</p>
          <h2>{title}</h2>
        </div>
        {!active && (
          <button
            aria-label="关闭下载进度"
            className={styles.closeButton}
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </header>

      <p className={styles.fileName} title={progress.fileName}>
        {progress.fileName}
      </p>

      {active && (
        <>
          <div className={styles.progressTrack}>
            <span
              className={styles.progressBar}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className={styles.progressMeta}>
            <span>
              {progress.status === 'preparing'
                ? '正在连接…'
                : progress.totalBytes > 0
                  ? `${percent}%`
                  : '下载中'}
            </span>
            <span>
              {formatBytes(progress.receivedBytes)}
              {progress.totalBytes > 0
                ? ` / ${formatBytes(progress.totalBytes)}`
                : ''}
            </span>
            {progress.status === 'downloading' &&
              (progress.bytesPerSecond ?? 0) > 0 && (
                <span className={styles.speed}>
                  {formatBytes(progress.bytesPerSecond ?? 0)}/s
                </span>
              )}
          </div>
          {progress.status === 'downloading' && (
            <div className={styles.actions}>
              <button
                className={styles.cancelButton}
                disabled={isCancelling}
                type="button"
                onClick={onCancel}
              >
                {isCancelling ? '取消中…' : '取消下载'}
              </button>
            </div>
          )}
        </>
      )}

      {progress.status === 'success' && progress.filePath && (
        <>
          <p className={styles.path} title={progress.filePath}>
            {progress.filePath}
          </p>
          <div className={styles.actions}>
            <button
              className={styles.openButton}
              type="button"
              onClick={onOpenFolder}
            >
              打开下载目录
            </button>
          </div>
        </>
      )}

      {progress.status === 'failed' && (
        <p className={styles.error} role="alert">
          {error || progress.error || '视频下载失败，请稍后重试。'}
        </p>
      )}

      {error && progress.status !== 'failed' && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}
