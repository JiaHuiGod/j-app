import { useEffect, useRef, useState } from 'react';
import { toErrorMessage } from '../lib/errors';
import ui from '../styles/ui.module.css';
import styles from './DownloadSettings.module.css';

function FolderIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.folderIcon}
      focusable="false"
      viewBox="0 0 20 20"
    >
      <path d="M2.7 5.3h5.1l1.5 1.8h8v8.1H2.7V5.3Z" />
      <path d="M2.7 8.1h14.6" />
    </svg>
  );
}

export function DownloadSettings() {
  const [directory, setDirectory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    void window.desktop.settings
      .getDownloadDirectory()
      .then((path) => {
        if (isMountedRef.current) {
          setDirectory(path);
        }
      })
      .catch((loadFailure: unknown) => {
        if (isMountedRef.current) {
          setError(toErrorMessage(loadFailure, '无法读取下载目录设置。'));
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleChoose = async () => {
    if (isLoading || isSaving) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const next = await window.desktop.settings.chooseDownloadDirectory();

      if (isMountedRef.current && next) {
        setDirectory(next);
      }
    } catch (saveFailure: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(saveFailure, '选择下载目录失败。'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  const handleClear = async () => {
    if (isLoading || isSaving || !directory) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await window.desktop.settings.clearDownloadDirectory();

      if (isMountedRef.current) {
        setDirectory(null);
      }
    } catch (saveFailure: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(saveFailure, '清除下载目录失败。'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  return (
    <section aria-labelledby="downloads-title" className={styles.card}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Downloads</p>
          <h2 id="downloads-title">下载目录</h2>
          <p>
            视频默认保存到这里。每次下载时仍可在系统保存对话框中临时选择其他位置。
          </p>
        </div>
        <span aria-live="polite" className={styles.status}>
          {isLoading ? '读取中…' : isSaving ? '保存中…' : '本机设置'}
        </span>
      </header>

      <div className={styles.directoryRow}>
        <span className={styles.icon} aria-hidden="true">
          <FolderIcon />
        </span>
        <div className={styles.directoryCopy}>
          <span className={styles.label}>默认下载目录</span>
          <code className={styles.path} title={directory ?? undefined}>
            {isLoading ? '读取中…' : (directory ?? '系统默认位置')}
          </code>
        </div>
        <div className={styles.actions}>
          <button
            className={`${ui.button} ${ui.buttonPrimary}`}
            disabled={isLoading || isSaving}
            type="button"
            onClick={() => {
              void handleChoose();
            }}
          >
            选择目录
          </button>
          {directory && (
            <button
              className={`${ui.button} ${ui.buttonSecondary}`}
              disabled={isSaving}
              type="button"
              onClick={() => {
                void handleClear();
              }}
            >
              清除
            </button>
          )}
        </div>
      </div>

      <p className={styles.hint}>
        未设置时使用系统保存对话框的默认位置。此设置只影响视频下载。
      </p>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
