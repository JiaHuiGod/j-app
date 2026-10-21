import type { DriveUploadProgress, DriveUploadResult } from '@shared/drive';
import styles from './DriveUploadPanel.module.css';

interface DriveUploadPanelProps {
  readonly active: boolean;
  readonly error: string | null;
  readonly items: readonly DriveUploadProgress[];
  readonly result: DriveUploadResult | null;
  readonly onClose: () => void;
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

function getPercent(item: DriveUploadProgress): number {
  if (item.status === 'success') {
    return 100;
  }

  if (item.totalBytes <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, Math.round((item.uploadedBytes / item.totalBytes) * 100)),
  );
}

export function DriveUploadPanel({
  active,
  error,
  items,
  result,
  onClose,
}: DriveUploadPanelProps) {
  const completed = items.filter(
    (item) => item.status === 'success' || item.status === 'failed',
  ).length;
  const activeItem = items.find((item) => item.status === 'uploading');
  const title = active
    ? items.length > 0
      ? `正在上传 ${completed}/${items.length}`
      : '准备上传…'
    : result
      ? `上传完成 · ${result.uploaded} 成功${result.failed > 0 ? ` / ${result.failed} 失败` : ''}`
      : error
        ? '上传失败'
        : '上传';

  return (
    <aside className={styles.panel} aria-live="polite" aria-label="上传进度">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Upload</p>
          <h2>{title}</h2>
        </div>
        {!active && (
          <button
            aria-label="关闭上传进度"
            className={styles.closeButton}
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {activeItem && (
        <div className={styles.activeProgress}>
          <div className={styles.activeCopy}>
            <span title={activeItem.fileName}>{activeItem.fileName}</span>
            <span>{getPercent(activeItem)}%</span>
          </div>
          <div className={styles.progressTrack}>
            <span
              className={styles.progressBar}
              style={{ width: `${getPercent(activeItem)}%` }}
            />
          </div>
          <span className={styles.bytes}>
            {formatBytes(activeItem.uploadedBytes)} /{' '}
            {formatBytes(activeItem.totalBytes)}
          </span>
        </div>
      )}

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item) => (
            <li
              className={styles.item}
              key={`${item.fileIndex}-${item.fileName}`}
            >
              <span className={styles.fileName} title={item.fileName}>
                {item.fileName}
              </span>
              <span
                className={`${styles.itemStatus}${
                  item.status === 'success'
                    ? ` ${styles.success}`
                    : item.status === 'failed'
                      ? ` ${styles.failed}`
                      : ''
                }`}
                title={item.error}
              >
                {item.status === 'success'
                  ? '完成'
                  : item.status === 'failed'
                    ? '失败'
                    : `${getPercent(item)}%`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
