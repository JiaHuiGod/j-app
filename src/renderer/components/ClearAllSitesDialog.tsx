import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { toErrorMessage } from '../lib/errors';

interface ClearAllSitesDialogProps {
  connectionCount: number;
  onCleared: (count: number) => void;
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
      const clearedCount = await window.desktop.connections.clearAll();

      onCleared(clearedCount);
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
      className="site-dialog"
      ref={dialogRef}
      onCancel={handleCancel}
    >
      <div className="site-dialog-form">
        <header className="site-dialog-header">
          <span
            className="site-dialog-icon site-dialog-icon--danger"
            aria-hidden="true"
          >
            <WarningIcon />
          </span>
          <div className="site-dialog-heading">
            <p className="site-dialog-kicker site-dialog-kicker--danger">
              Danger zone
            </p>
            <h2 id="clear-all-title">清理全部站点数据</h2>
            <p id="clear-all-description">
              将删除全部站点连接和本地登录状态，且无法撤销。
            </p>
          </div>
          <button
            aria-label="关闭清理全部站点数据窗口"
            className="site-dialog-close"
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

        <div className="site-dialog-body">
          {error && (
            <div className="proxy-alert" role="alert">
              {error}
            </div>
          )}

          <div className="clear-all-summary">
            <strong>{connectionCount} 个站点</strong>
            <span>Cookie、缓存与登录状态</span>
          </div>

          <ul className="clear-all-list">
            <li>删除所有站点连接和保存的 Cookie；</li>
            <li>清除对应持久会话中的缓存与站点存储；</li>
            <li>保留网络代理和界面设置，不会影响其他应用数据。</li>
          </ul>

          <div className="clear-all-warning">
            <span aria-hidden="true">
              <WarningIcon />
            </span>
            <p>
              此操作不可撤销。清理后需要重新登录所有站点。站点越多，
              重新登录和恢复工作上下文的成本越高。
            </p>
          </div>
        </div>

        <footer className="site-dialog-footer">
          <button
            className="proxy-button proxy-button--secondary"
            disabled={isClearing}
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="proxy-button proxy-button--danger"
            disabled={isClearing}
            type="button"
            onClick={() => {
              void handleClearAll();
            }}
          >
            {isClearing ? (
              <>
                <span
                  className="proxy-spinner proxy-spinner--small"
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
