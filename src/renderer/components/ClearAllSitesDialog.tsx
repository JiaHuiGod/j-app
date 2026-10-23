import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import type { ClearAllSiteConnectionsResult } from '@shared/connections';
import { toErrorMessage } from '../lib/errors';
import ui from '../styles/ui.module.css';
import styles from './SiteDialogs.module.css';

interface ClearAllSitesDialogProps {
  connectionCount: number;
  pinnedCount: number;
  onCleared: (result: ClearAllSiteConnectionsResult) => void;
  onClose: () => void;
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

export function ClearAllSitesDialog({
  connectionCount,
  pinnedCount,
  onCleared,
  onClose,
}: ClearAllSitesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');

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

    // Destructive dialogs should start on the safe action.
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

    if (!isClearing) {
      onClose();
    }
  };

  const handleClearAll = async () => {
    if (isClearing) {
      return;
    }

    setIsClearing(true);
    setError('');

    try {
      const result = await window.desktop.connections.clearAll();

      onCleared(result);
      onClose();
    } catch (clearFailure: unknown) {
      setError(
        toErrorMessage(clearFailure, '清理全部站点数据失败，请稍后重试。'),
      );
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <dialog
      aria-describedby="clear-all-description"
      aria-labelledby="clear-all-title"
      className={styles.dialog}
      ref={dialogRef}
      onCancel={handleCancel}
    >
      <div className={styles.form}>
        <header className={styles.header}>
          <span
            className={`${styles.icon} ${styles.dangerIcon}`}
            aria-hidden="true"
          >
            <WarningIcon />
          </span>
          <div className={styles.heading}>
            <p className={`${styles.kicker} ${styles.kickerDanger}`}>
              Danger zone
            </p>
            <h2 id="clear-all-title">清理全部站点数据</h2>
            <p id="clear-all-description">
              未固定站点会被移除；固定站点只清除 Cookie 和缓存，保留列表。
            </p>
          </div>
          <button
            aria-label="关闭清理全部站点数据窗口"
            className={styles.close}
            disabled={isClearing}
            title="关闭"
            type="button"
            onClick={onClose}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {error && (
            <div className={ui.alert} role="alert">
              {error}
            </div>
          )}

          <div className={styles.summary}>
            <strong>{connectionCount} 个站点</strong>
            <span>
              {pinnedCount > 0
                ? `${pinnedCount} 个固定站点保留，仅清除登录状态`
                : 'Cookie、缓存与登录状态'}
            </span>
          </div>

          <ul className={styles.list}>
            <li>删除未固定站点的连接和保存的 Cookie；</li>
            <li>固定站点保留列表，只清除 Cookie、缓存和站点存储；</li>
            <li>保留网络代理和界面设置，不会影响其他应用数据。</li>
          </ul>

          <div className={styles.warning}>
            <span aria-hidden="true">
              <WarningIcon />
            </span>
            <p>
              未固定站点删除后不可撤销；固定站点会保留，可重新登录恢复。
              清理后所有站点都需要重新登录。
            </p>
          </div>
        </div>

        <footer className={styles.footer}>
          <button
            className={`${ui.button} ${ui.buttonSecondary}`}
            disabled={isClearing}
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className={`${ui.button} ${ui.buttonDanger}`}
            disabled={isClearing}
            type="button"
            onClick={() => {
              void handleClearAll();
            }}
          >
            {isClearing ? (
              <>
                <span
                  className={`${ui.spinner} ${ui.spinnerSmall}`}
                  aria-hidden="true"
                />
                正在清理…
              </>
            ) : (
              '清除全部站点'
            )}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
