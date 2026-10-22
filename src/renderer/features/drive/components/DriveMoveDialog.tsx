import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import type { DriveBreadcrumb, DriveEntry } from '@shared/drive';
import ui from '../../../styles/ui.module.css';
import styles from './DriveDialogs.module.css';

interface DriveMoveDialogProps {
  readonly connectionId: string;
  readonly entries: readonly DriveEntry[];
  readonly onClose: () => void;
  readonly onCompleted: () => void;
}

const ROOT_BREADCRUMB: DriveBreadcrumb = { id: '0', name: '根目录' };

function FolderIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path d="M2.7 5.3h5.1l1.5 1.8h8v8.1H2.7V5.3Z" />
      <path d="M2.7 8.1h14.6" />
    </svg>
  );
}

export function DriveMoveDialog({
  connectionId,
  entries,
  onClose,
  onCompleted,
}: DriveMoveDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [folderId, setFolderId] = useState('0');
  const [breadcrumbs, setBreadcrumbs] = useState<readonly DriveBreadcrumb[]>([
    ROOT_BREADCRUMB,
  ]);
  const [folders, setFolders] = useState<readonly DriveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMoving, setIsMoving] = useState(false);

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

    window.requestAnimationFrame(() => {
      cancelRef.current?.focus();
    });

    return () => {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError('');

    void window.desktop.drive
      .listFolder({
        connectionId,
        folderId,
        offset: 0,
        limit: 100,
      })
      .then((result) => {
        if (!isCurrent) {
          return;
        }

        if (!result.ok) {
          setError(result.error.message);
          setFolders([]);
          return;
        }

        setBreadcrumbs(result.data.breadcrumbs);
        setFolders(
          result.data.entries.filter((item) => item.kind === 'folder'),
        );
      })
      .catch(() => {
        if (isCurrent) {
          setError('无法读取目标目录，请稍后重试。');
          setFolders([]);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [connectionId, folderId]);

  const currentBreadcrumb =
    breadcrumbs[breadcrumbs.length - 1] ?? ROOT_BREADCRUMB;
  const isSelf = entries.some(
    (entry) => entry.kind === 'folder' && entry.id === currentBreadcrumb.id,
  );
  const isBusy = isMoving || isLoading;
  const isBatch = entries.length > 1;
  const singleEntry = entries.length === 1 ? entries[0] : null;

  const requestClose = () => {
    if (!isMoving) {
      onClose();
    }
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    requestClose();
  };

  const handleMove = async () => {
    if (isBusy || isSelf) {
      return;
    }

    setIsMoving(true);
    setError('');

    try {
      const result = await window.desktop.drive.moveEntry({
        connectionId,
        entryIds: entries.map((entry) => entry.id),
        targetFolderId: currentBreadcrumb.id,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      onCompleted();
      onClose();
    } catch {
      setError('移动失败，请稍后重试。');
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${styles.dialogWide}`}
      onCancel={handleCancel}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <p className={styles.kicker}>115 / Cloud Drive</p>
            <h2>
              {isBatch
                ? `移动 ${entries.length} 个项目`
                : `移动「${singleEntry?.name ?? ''}」`}
            </h2>
            <p className={styles.description}>
              {isBatch
                ? '选择一个目标文件夹，再把选中的项目一起移动过去。'
                : '选择一个目标文件夹，再把项目移动过去。'}
            </p>
          </div>
          <button
            aria-label="关闭"
            className={styles.close}
            disabled={isMoving}
            type="button"
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          <nav aria-label="目标目录路径" className={styles.breadcrumbs}>
            {breadcrumbs.map((breadcrumb, index) => {
              const isCurrent = breadcrumb.id === currentBreadcrumb.id;

              return (
                <span key={`${breadcrumb.id}-${index}`}>
                  {index > 0 && (
                    <span className={styles.crumbSeparator} aria-hidden="true">
                      /
                    </span>
                  )}
                  <button
                    className={styles.crumb}
                    disabled={isCurrent || isMoving}
                    type="button"
                    onClick={() => {
                      setFolderId(breadcrumb.id);
                    }}
                  >
                    {breadcrumb.name}
                  </button>
                </span>
              );
            })}
          </nav>

          {isLoading ? (
            <div className={styles.state}>正在读取文件夹…</div>
          ) : folders.length === 0 ? (
            <div className={styles.state}>当前目录下没有子文件夹。</div>
          ) : (
            <ul className={styles.folderList}>
              {folders.map((folder) => (
                <li key={folder.id}>
                  <button
                    className={styles.folderRow}
                    disabled={isMoving}
                    type="button"
                    onClick={() => {
                      setFolderId(folder.id);
                    }}
                  >
                    <span className={styles.folderIcon}>
                      <FolderIcon />
                    </span>
                    <span className={styles.folderName}>{folder.name}</span>
                    <span className={styles.folderChevron} aria-hidden="true">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className={styles.destination}>
            当前目标：<strong>{currentBreadcrumb.name}</strong>
          </p>
          {isSelf && (
            <div className={styles.dangerNote} style={{ marginTop: 10 }}>
              不能把文件夹移动到自身。
            </div>
          )}
          {error && (
            <div className={styles.alert} role="alert">
              {error}
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            ref={cancelRef}
            className={`${ui.button} ${ui.buttonSecondary}`}
            disabled={isMoving}
            type="button"
            onClick={requestClose}
          >
            取消
          </button>
          <button
            className={`${ui.button} ${ui.buttonPrimary}`}
            disabled={isBusy || isSelf}
            type="button"
            onClick={() => {
              void handleMove();
            }}
          >
            {isMoving ? '移动中…' : '移动到这里'}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
