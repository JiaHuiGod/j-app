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

interface DirectoryRowProps {
  readonly directory: string | null;
  readonly emptyLabel: string;
  readonly label: string;
  readonly onChoose: () => void;
  readonly onClear: () => void;
  readonly disabled: boolean;
  readonly chooseLabel: string;
  readonly clearLabel: string;
}

function DirectoryRow({
  directory,
  emptyLabel,
  label,
  onChoose,
  onClear,
  disabled,
  chooseLabel,
  clearLabel,
}: DirectoryRowProps) {
  return (
    <div className={styles.directoryRow}>
      <span className={styles.icon} aria-hidden="true">
        <FolderIcon />
      </span>
      <div className={styles.directoryCopy}>
        <span className={styles.label}>{label}</span>
        <code className={styles.path} title={directory ?? undefined}>
          {directory ?? emptyLabel}
        </code>
      </div>
      <div className={styles.actions}>
        <button
          className={`${ui.button} ${ui.buttonPrimary}`}
          disabled={disabled}
          type="button"
          onClick={onChoose}
        >
          {chooseLabel}
        </button>
        {directory && (
          <button
            className={`${ui.button} ${ui.buttonSecondary}`}
            disabled={disabled}
            type="button"
            onClick={onClear}
          >
            {clearLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function DownloadSettings() {
  const [downloadDirectory, setDownloadDirectory] = useState<string | null>(
    null,
  );
  const [subtitleDirectory, setSubtitleDirectory] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    void Promise.all([
      window.desktop.settings.getDownloadDirectory(),
      window.desktop.settings.getSubtitleDirectory(),
    ])
      .then(([downloadPath, subtitlePath]) => {
        if (isMountedRef.current) {
          setDownloadDirectory(downloadPath);
          setSubtitleDirectory(subtitlePath);
        }
      })
      .catch((loadFailure: unknown) => {
        if (isMountedRef.current) {
          setError(toErrorMessage(loadFailure, '无法读取目录设置。'));
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

  const chooseDownload = async () => {
    if (isLoading || isSaving) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const next = await window.desktop.settings.chooseDownloadDirectory();

      if (isMountedRef.current && next) {
        setDownloadDirectory(next);
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

  const clearDownload = async () => {
    if (isLoading || isSaving || !downloadDirectory) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await window.desktop.settings.clearDownloadDirectory();

      if (isMountedRef.current) {
        setDownloadDirectory(null);
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

  const chooseSubtitle = async () => {
    if (isLoading || isSaving) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const next = await window.desktop.settings.chooseSubtitleDirectory();

      if (isMountedRef.current && next) {
        setSubtitleDirectory(next);
      }
    } catch (saveFailure: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(saveFailure, '选择字幕目录失败。'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  const clearSubtitle = async () => {
    if (isLoading || isSaving || !subtitleDirectory) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await window.desktop.settings.clearSubtitleDirectory();

      if (isMountedRef.current) {
        setSubtitleDirectory(null);
      }
    } catch (saveFailure: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(saveFailure, '清除字幕目录失败。'));
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
          <p className={styles.kicker}>Downloads &amp; Subtitles</p>
          <h2 id="downloads-title">下载与字幕</h2>
          <p>
            配置视频默认下载位置和本地字幕目录。字幕会按视频文件名自动匹配。
          </p>
        </div>
        <span aria-live="polite" className={styles.status}>
          {isLoading ? '读取中…' : isSaving ? '保存中…' : '本机设置'}
        </span>
      </header>

      <DirectoryRow
        chooseLabel="选择下载目录"
        clearLabel="清除下载目录"
        directory={isLoading ? null : downloadDirectory}
        disabled={isLoading || isSaving}
        emptyLabel={isLoading ? '读取中…' : '系统默认位置'}
        label="默认下载目录"
        onChoose={() => {
          void chooseDownload();
        }}
        onClear={() => {
          void clearDownload();
        }}
      />

      <DirectoryRow
        chooseLabel="选择字幕目录"
        clearLabel="清除字幕目录"
        directory={isLoading ? null : subtitleDirectory}
        disabled={isLoading || isSaving}
        emptyLabel={isLoading ? '读取中…' : '未设置，不加载本地字幕'}
        label="本地字幕目录"
        onChoose={() => {
          void chooseSubtitle();
        }}
        onClear={() => {
          void clearSubtitle();
        }}
      />

      <p className={styles.hint}>
        下载时仍可在保存对话框中临时更改位置。字幕支持 SRT、VTT、ASS 和
        SSA，只读取自动匹配的视频字幕。
      </p>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
