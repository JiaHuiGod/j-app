import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import type {
  DriveOfflineAddResult,
  DriveOfflineTask,
  DriveOfflineTaskList,
} from '@shared/drive';
import { toErrorMessage } from '../lib/errors';
import ui from '../styles/ui.module.css';
import dialogs from './DriveDialogs.module.css';
import { DriveFolderPickerDialog } from './DriveFolderPickerDialog';
import styles from './DriveOfflineDialog.module.css';

interface DriveOfflineDialogProps {
  readonly connectionId: string;
  readonly folderId: string;
  readonly folderName: string;
  readonly onClose: () => void;
  readonly onSubmitted: () => void;
}

function normalizeOfflineUrl(value: string): string {
  return value.trim().toLowerCase();
}

function shortenOfflineUrl(value: string): string {
  const url = value.trim();

  if (url.length <= 64) {
    return url;
  }

  return `${url.slice(0, 32)}…${url.slice(-22)}`;
}

function formatBytes(value: number | null): string {
  if (value === null || value <= 0) {
    return '—';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatRate(value: number): string {
  return value > 0 ? `${formatBytes(value)}/s` : '—';
}

function getStatusClass(task: DriveOfflineTask): string {
  switch (task.status) {
    case 'finished':
      return styles.statusFinished ?? '';
    case 'failed':
      return styles.statusFailed ?? '';
    case 'downloading':
      return styles.statusDownloading ?? '';
    case 'paused':
      return styles.statusPaused ?? '';
    default:
      return '';
  }
}

export function DriveOfflineDialog({
  connectionId,
  folderId,
  folderName,
  onClose,
  onSubmitted,
}: DriveOfflineDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFetchingRef = useRef(false);
  const [links, setLinks] = useState('');
  const [submittedUrls, setSubmittedUrls] = useState<readonly string[]>([]);
  const [targetFolderId, setTargetFolderId] = useState(folderId);
  const [targetFolderName, setTargetFolderName] = useState(folderName);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [tasks, setTasks] = useState<DriveOfflineTaskList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitResult, setSubmitResult] =
    useState<DriveOfflineAddResult | null>(null);

  const loadTasks = useCallback(
    async (quiet = false) => {
      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;

      if (!quiet) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setLoadError('');

      try {
        const result = await window.desktop.drive.listOfflineTasks({
          connectionId,
          page: 1,
        });

        if (!result.ok) {
          setLoadError(result.error.message);
          return;
        }

        setTasks(result.data);
      } catch (error) {
        setLoadError(
          toErrorMessage(error, '无法读取 115 离线任务，请稍后重试。'),
        );
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [connectionId],
  );

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
      textareaRef.current?.focus();
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
    if (submittedUrls.length === 0) {
      return;
    }

    void loadTasks(true);

    const timer = window.setInterval(() => {
      void loadTasks(true);
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadTasks, submittedUrls]);

  const requestClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const submittedUrlSet = new Set(submittedUrls);
  const visibleTasks =
    tasks?.tasks.filter(
      (task) =>
        Boolean(task.sourceUrl) &&
        submittedUrlSet.has(normalizeOfflineUrl(task.sourceUrl)),
    ) ?? [];

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    requestClose();
  };

  const handleSubmit = async () => {
    const urls = links
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setSubmitError('请至少输入一个离线链接。');
      return;
    }

    if (urls.length > 20) {
      setSubmitError('一次最多提交 20 个离线链接。');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitResult(null);

    try {
      const result = await window.desktop.drive.addOfflineTasks({
        connectionId,
        folderId: targetFolderId,
        urls,
      });

      if (!result.ok) {
        setSubmitError(result.error.message);
        return;
      }

      setSubmitResult(result.data);
      setLinks('');

      if (result.data.successCount > 0) {
        const failedUrls = new Set(
          result.data.errors.map((error) => normalizeOfflineUrl(error.url)),
        );
        const acceptedUrls = urls
          .map(normalizeOfflineUrl)
          .filter((url) => !failedUrls.has(url));

        setSubmittedUrls((current) => [
          ...new Set([...current, ...acceptedUrls]),
        ]);
        onSubmitted();
      }
    } catch (error) {
      setSubmitError(toErrorMessage(error, '提交离线任务失败，请稍后重试。'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={`${dialogs.dialog} ${dialogs.dialogWide} ${styles.offlineDialog}`}
      onCancel={handleCancel}
    >
      <div className={dialogs.shell}>
        <header className={dialogs.header}>
          <div className={dialogs.heading}>
            <p className={dialogs.kicker}>115 / Cloud Drive</p>
            <h2>离线任务</h2>
            <p className={dialogs.description}>
              把磁力、ED2K、HTTP 或 FTP 链接提交到
              115，后台下载完成后会出现在网盘里。
            </p>
          </div>
          <button
            aria-label="关闭离线任务"
            className={dialogs.close}
            disabled={isSubmitting}
            type="button"
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        <div className={`${dialogs.body} ${styles.body}`}>
          <section className={styles.addPanel}>
            <label className={styles.label} htmlFor="drive-offline-links">
              离线链接
            </label>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              disabled={isSubmitting}
              id="drive-offline-links"
              placeholder={
                'magnet:?xt=urn:btih:...\nhttps://example.com/file.zip'
              }
              rows={3}
              value={links}
              onChange={(event) => {
                setLinks(event.target.value);
                setSubmitError('');
                setSubmitResult(null);
              }}
            />
            <div className={styles.addFooter}>
              <span className={styles.targetInfo}>
                保存到：<strong>{targetFolderName}</strong>
                <button
                  className={styles.changeTarget}
                  disabled={isSubmitting}
                  type="button"
                  onClick={() => {
                    setIsFolderPickerOpen(true);
                  }}
                >
                  更改目录
                </button>
              </span>
              <button
                className={`${ui.button} ${ui.buttonPrimary}`}
                disabled={isSubmitting}
                type="button"
                onClick={() => {
                  void handleSubmit();
                }}
              >
                {isSubmitting ? '提交中…' : '提交离线任务'}
              </button>
            </div>
            <p className={styles.hint}>
              支持多个链接，每行一个，最多 20 个。任务列表只显示本次提交的链接。
            </p>
            {submitError && (
              <div className={styles.alert} role="alert">
                {submitError}
              </div>
            )}
            {submitResult && (
              <output
                className={`${styles.submitResult} ${
                  submitResult.failedCount === 0
                    ? styles.submitSuccess
                    : submitResult.successCount === 0
                      ? styles.submitDanger
                      : styles.submitWarning
                }`}
              >
                <span className={styles.submitSummary}>
                  已提交 {submitResult.successCount} 个任务
                  {submitResult.failedCount > 0
                    ? `，${submitResult.failedCount} 个失败`
                    : ''}
                </span>
                {submitResult.errors.length > 0 && (
                  <span className={styles.submitErrorList}>
                    {submitResult.errors.map((error, index) => (
                      <span
                        className={styles.submitErrorItem}
                        key={`${error.url}-${index}`}
                      >
                        <span
                          className={styles.submitErrorUrl}
                          title={error.url}
                        >
                          {shortenOfflineUrl(error.url) || '未识别链接'}
                        </span>
                        <span className={styles.submitErrorMessage}>
                          {error.message}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </output>
            )}
          </section>

          <section className={styles.taskSection}>
            <header className={styles.taskHeader}>
              <div>
                <h3>本次任务</h3>
                <p>
                  {submittedUrls.length === 0
                    ? '提交后会显示在这里'
                    : tasks
                      ? `本次 ${visibleTasks.length} 条`
                      : '正在读取任务…'}
                </p>
              </div>
              <button
                className={styles.refreshButton}
                disabled={
                  isRefreshing || isLoading || submittedUrls.length === 0
                }
                type="button"
                onClick={() => {
                  void loadTasks(true);
                }}
              >
                {isRefreshing ? '刷新中…' : '刷新'}
              </button>
            </header>

            {loadError && (
              <div className={styles.alert} role="alert">
                {loadError}
              </div>
            )}

            {isLoading ? (
              <div className={styles.state}>正在读取离线任务…</div>
            ) : visibleTasks.length === 0 ? (
              <div className={styles.state}>
                {submittedUrls.length === 0
                  ? '本次还没有提交离线任务。'
                  : '正在等待 115 接收任务…'}
              </div>
            ) : (
              <ul className={styles.taskList}>
                {visibleTasks.map((task, index) => (
                  <li className={styles.task} key={`${task.id}-${index}`}>
                    <div className={styles.taskTop}>
                      <span className={styles.taskName} title={task.name}>
                        {task.name}
                      </span>
                      <span
                        className={`${styles.taskStatus} ${getStatusClass(task)}`}
                      >
                        {task.statusText}
                      </span>
                    </div>
                    <div className={styles.progressTrack}>
                      <span
                        className={`${styles.progressBar} ${getStatusClass(task)}`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <div className={styles.taskMeta}>
                      <span>{task.progress}%</span>
                      <span>{formatBytes(task.size)}</span>
                      {task.status === 'downloading' && (
                        <span>{formatRate(task.rate)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className={dialogs.footer}>
          <button
            className={`${ui.button} ${ui.buttonSecondary}`}
            disabled={isSubmitting}
            type="button"
            onClick={requestClose}
          >
            关闭
          </button>
        </footer>
      </div>

      {isFolderPickerOpen && (
        <DriveFolderPickerDialog
          connectionId={connectionId}
          initialFolderId={targetFolderId}
          onClose={() => {
            setIsFolderPickerOpen(false);
          }}
          onSelect={(folder) => {
            setTargetFolderId(folder.id);
            setTargetFolderName(folder.name);
            setIsFolderPickerOpen(false);
          }}
        />
      )}
    </dialog>
  );
}
