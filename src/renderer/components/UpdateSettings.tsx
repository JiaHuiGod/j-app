import { useEffect, useRef, useState } from 'react';
import type { UpdateState } from '@shared/updates';
import { toErrorMessage } from '../lib/errors';
import ui from '../styles/ui.module.css';
import styles from './UpdateSettings.module.css';

function getStatusText(state: UpdateState): string {
  switch (state.status) {
    case 'unsupported':
      return '自动更新仅支持安装后的 Windows x64 版本。';
    case 'idle':
      return '尚未检查更新。';
    case 'checking':
      return '正在检查更新…';
    case 'available':
    case 'downloading':
      return state.availableVersion
        ? `发现 ${state.availableVersion}，正在后台下载…`
        : '发现新版本，正在后台下载…';
    case 'downloaded':
      return state.availableVersion
        ? `${state.availableVersion} 已下载，重启应用后安装。`
        : '更新已下载，重启应用后安装。';
    case 'up-to-date':
      return '当前已是最新版本。';
    case 'error':
      return state.error ?? '检查更新失败，请稍后重试。';
    default:
      return '';
  }
}

export function UpdateSettings() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    void window.desktop.updates
      .getState()
      .then((next) => {
        if (isMountedRef.current) {
          setState(next);
        }
      })
      .catch((loadFailure: unknown) => {
        if (isMountedRef.current) {
          setError(toErrorMessage(loadFailure, '读取更新状态失败。'));
        }
      });

    const unsubscribe = window.desktop.updates.onStateChange((next) => {
      if (isMountedRef.current) {
        setState(next);
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, []);

  const handleCheck = async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      const next = await window.desktop.updates.check();

      if (isMountedRef.current) {
        setState(next);
      }
    } catch (checkFailure: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(checkFailure, '检查更新失败，请稍后重试。'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsBusy(false);
      }
    }
  };

  const handleInstall = async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setError('');

    try {
      await window.desktop.updates.install();
    } catch (installFailure: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(installFailure, '安装更新失败，请稍后重试。'));
        setIsBusy(false);
      }
    }
  };

  const canCheck =
    state?.supported === true &&
    state.status !== 'checking' &&
    state.status !== 'downloading' &&
    state.status !== 'downloaded';
  const canInstall = state?.status === 'downloaded';
  const statusText = state ? getStatusText(state) : '正在读取更新状态…';

  return (
    <section aria-labelledby="updates-title" className={styles.card}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Updates</p>
          <h2 className={styles.title} id="updates-title">
            关于与更新
          </h2>
          <p className={styles.description}>
            应用会通过 GitHub Releases
            检查更新，下载完成后由你决定何时重启安装。
          </p>
        </div>
        <div className={styles.version}>
          <span>当前版本</span>
          <strong>{state?.currentVersion ?? '—'}</strong>
        </div>
      </header>

      <p
        aria-live="polite"
        className={`${styles.status}${
          state?.status === 'error' ? ` ${styles.statusError}` : ''
        }`}
      >
        {statusText}
      </p>

      {state?.status === 'downloaded' && state.releaseNotes && (
        <p className={styles.notes}>{state.releaseNotes}</p>
      )}

      <div className={styles.actions}>
        <button
          className={`${ui.button} ${ui.buttonSecondary}`}
          disabled={!canCheck || isBusy}
          type="button"
          onClick={() => {
            void handleCheck();
          }}
        >
          {state?.status === 'checking' ? '检查中…' : '检查更新'}
        </button>

        {canInstall && (
          <button
            className={`${ui.button} ${ui.buttonPrimary}`}
            disabled={isBusy}
            type="button"
            onClick={() => {
              void handleInstall();
            }}
          >
            重启并安装
          </button>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
