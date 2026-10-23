import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClearAllSiteConnectionsResult,
  SiteConnectionSummary,
} from '@shared/connections';
import { AddSiteDialog } from '../components/AddSiteDialog';
import { ClearAllSitesDialog } from '../components/ClearAllSitesDialog';
import { DownloadSettings } from '../components/DownloadSettings';
import { GlobeIcon } from '../components/GlobeIcon';
import { ThemeSettings } from '../components/ThemeSettings';
import type { AppearanceController } from '../hooks/useAppearance';
import { toErrorMessage } from '../lib/errors';
import page from '../styles/page.module.css';
import ui from '../styles/ui.module.css';
import styles from './SettingsPage.module.css';

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatLoginTime(value: string | null): string {
  if (!value) {
    return '尚未登录';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '尚未登录'
    : DATE_FORMATTER.format(date);
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.addIcon}
      focusable="false"
      viewBox="0 0 16 16"
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
      viewBox="0 0 20 20"
    >
      <rect height="8.5" rx="2" width="11.5" x="4.25" y="8.5" />
      <path d="M6.8 8.5V6.6a3.2 3.2 0 0 1 6.4 0v1.9" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
      viewBox="0 0 16 16"
    >
      <path d="M6 2.5h4l-.6 3.5 2.1 2v1.2H8.6v4L8 14l-.6-.8v-4H4.5V8l2.1-2L6 2.5Z" />
    </svg>
  );
}

interface SettingsPageProps {
  readonly appearance: AppearanceController;
}

export function SettingsPage({ appearance }: SettingsPageProps) {
  const [connections, setConnections] = useState<
    readonly SiteConnectionSummary[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [loggingInId, setLoggingInId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const isMountedRef = useRef(true);

  const isBusy =
    loggingInId !== null || removingId !== null || pinningId !== null;

  const loadConnections = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const items = await window.desktop.connections.list();

      if (isMountedRef.current) {
        setConnections(items);
      }
    } catch (loadFailure: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(loadFailure, '无法读取站点连接，请稍后重试。'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadConnections();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadConnections]);

  const handleAdded = (connection: SiteConnectionSummary) => {
    setConnections((current) => [connection, ...current]);
    setIsAddOpen(false);
    setError('');
  };

  const handleLogin = async (connection: SiteConnectionSummary) => {
    if (isBusy) {
      return;
    }

    setLoggingInId(connection.id);
    setError('');

    try {
      const updated = await window.desktop.connections.login(connection.id);

      if (isMountedRef.current) {
        setConnections((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
    } catch (loginFailure: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(loginFailure, '登录失败，请稍后重试。'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoggingInId(null);
      }
    }
  };

  const handleTogglePinned = async (connection: SiteConnectionSummary) => {
    if (isBusy) {
      return;
    }

    setPinningId(connection.id);
    setError('');

    try {
      const updated = await window.desktop.connections.setPinned({
        connectionId: connection.id,
        pinned: !connection.pinned,
      });

      if (isMountedRef.current) {
        setConnections((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
    } catch (pinFailure: unknown) {
      if (isMountedRef.current) {
        setError(
          toErrorMessage(pinFailure, '更新站点固定状态失败，请稍后重试。'),
        );
      }
    } finally {
      if (isMountedRef.current) {
        setPinningId(null);
      }
    }
  };

  const handleRemove = async (connection: SiteConnectionSummary) => {
    if (isBusy) {
      return;
    }

    setRemovingId(connection.id);
    setError('');

    try {
      const result = await window.desktop.connections.remove(connection.id);

      if (isMountedRef.current) {
        if (result.removed) {
          setConnections((current) =>
            current.filter((item) => item.id !== connection.id),
          );
        } else if (result.connection) {
          const updated = result.connection;
          setConnections((current) =>
            current.map((item) => (item.id === updated.id ? updated : item)),
          );
        }

        setConfirmingId(null);
      }
    } catch (removeFailure: unknown) {
      if (isMountedRef.current) {
        setError(
          toErrorMessage(
            removeFailure,
            connection.pinned
              ? '清除站点 Cookie 失败，请稍后重试。'
              : '移除站点失败，请稍后重试。',
          ),
        );
      }
    } finally {
      if (isMountedRef.current) {
        setRemovingId(null);
      }
    }
  };

  const handleAllCleared = (result: ClearAllSiteConnectionsResult) => {
    setConnections(result.remaining);
    setConfirmingId(null);
    setLoggingInId(null);
    setPinningId(null);
    setError('');
  };

  const pinnedCount = connections.filter(
    (connection) => connection.pinned,
  ).length;

  return (
    <main className={styles.page} aria-labelledby="settings-page-title">
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={page.eyebrow}>
            Preferences / Appearance, Downloads, Subtitles &amp; Connections
          </p>
          <h1 id="settings-page-title">设置。</h1>
          <p className={styles.headingLede}>
            调整应用外观、默认下载目录和本地字幕目录，并管理需要登录的站点。每个站点使用独立的持久会话保存
            Cookie，登录信息不会进入页面或配置文件。
          </p>
        </div>

        <aside className={styles.security}>
          <span className={styles.securityIcon} aria-hidden="true">
            <LockIcon />
          </span>
          <div>
            <strong>本地加密会话</strong>
            <p>Cookie 由 Electron 持久会话管理，不向渲染层暴露。</p>
          </div>
        </aside>
      </header>

      <ThemeSettings
        error={appearance.error}
        isLoading={appearance.isLoading}
        isSaving={appearance.isSaving}
        preference={appearance.preference}
        onSelectTheme={(theme) => {
          void appearance.setPreference(theme);
        }}
      />
      <DownloadSettings />

      <section aria-labelledby="connections-title" className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <p className={styles.kicker}>Site sessions</p>
            <h2 id="connections-title">站点账号</h2>
            <p>登录站点后关闭登录窗口，应用会检测并保存 Cookie。</p>
          </div>
          <button
            className={`${ui.button} ${ui.buttonPrimary} ${styles.addButton}`}
            disabled={isLoading || isBusy || isAddOpen}
            type="button"
            onClick={() => {
              setError('');
              setIsAddOpen(true);
            }}
          >
            <PlusIcon />
            添加站点
          </button>
        </header>

        <aside aria-label="站点资源占用提示" className={styles.warning}>
          <span className={styles.warningIcon} aria-hidden="true">
            !
          </span>
          <div>
            <strong>站点越多，资源占用越高</strong>
            <p>
              每个站点都会增加独立的 Cookie、缓存和持久会话开销，而 Electron
              本身有较高的内存占用。请只添加确实需要的站点，并在不再使用时及时移除。
              固定的站点在移除或清理全部时只清除 Cookie，保留在列表中。
            </p>
          </div>
        </aside>

        {error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            {isLoading === false && connections.length === 0 && (
              <button
                className={styles.retry}
                type="button"
                onClick={() => {
                  void loadConnections();
                }}
              >
                重试
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <output className={styles.loading}>
            <span className={ui.spinner} aria-hidden="true" />
            正在读取站点连接…
          </output>
        ) : connections.length === 0 ? (
          !error && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <GlobeIcon />
              </span>
              <div>
                <h3>还没有保存的站点</h3>
                <p>
                  添加需要登录的网站，也可以先仅保存站点信息。
                  完成登录后关闭登录窗口，Cookie 会保存在独立的持久会话中。
                </p>
              </div>
            </div>
          )
        ) : (
          <ul className={styles.list}>
            {connections.map((connection) => {
              const isConnected = connection.status === 'connected';
              const isConfirming = confirmingId === connection.id;
              const isLoggingIn = loggingInId === connection.id;
              const isRemoving = removingId === connection.id;
              const isPinning = pinningId === connection.id;

              return (
                <li className={styles.row} key={connection.id}>
                  <span className={styles.avatar} aria-hidden="true">
                    {connection.name.trim().charAt(0).toUpperCase()}
                  </span>

                  <div className={styles.info}>
                    <div className={styles.title}>
                      <strong>{connection.name}</strong>
                      <span
                        className={`${styles.state}${isConnected ? ` ${styles.connected}` : ''}`}
                      >
                        <span aria-hidden="true" />
                        {isConnected ? '已保存' : '待登录'}
                      </span>
                      {connection.pinned && (
                        <span className={styles.pinnedBadge}>已固定</span>
                      )}
                    </div>
                    <span className={styles.url} title={connection.loginUrl}>
                      {connection.loginUrl}
                    </span>
                    <span className={styles.meta}>
                      {isConnected
                        ? `${connection.cookieCount} 个 Cookie`
                        : '未检测到 Cookie'}
                      <span aria-hidden="true">·</span>
                      上次登录 {formatLoginTime(connection.lastLoginAt)}
                    </span>
                  </div>

                  <div className={styles.actions}>
                    {isConfirming ? (
                      <>
                        <button
                          className={styles.action}
                          disabled={isBusy}
                          type="button"
                          onClick={() => {
                            setConfirmingId(null);
                          }}
                        >
                          取消
                        </button>
                        <button
                          className={`${styles.action} ${styles.actionDanger}`}
                          disabled={isBusy}
                          type="button"
                          onClick={() => {
                            void handleRemove(connection);
                          }}
                        >
                          {isRemoving
                            ? connection.pinned
                              ? '清除中…'
                              : '移除中…'
                            : connection.pinned
                              ? '确认清除'
                              : '确认移除'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          aria-label={
                            connection.pinned
                              ? `取消固定 ${connection.name}`
                              : `固定 ${connection.name}`
                          }
                          aria-pressed={connection.pinned}
                          className={`${styles.action} ${styles.pinAction}${
                            connection.pinned
                              ? ` ${styles.pinActionActive}`
                              : ''
                          }`}
                          disabled={isBusy}
                          title={connection.pinned ? '取消固定' : '固定站点'}
                          type="button"
                          onClick={() => {
                            void handleTogglePinned(connection);
                          }}
                        >
                          <PinIcon />
                          <span>
                            {isPinning
                              ? '更新中…'
                              : connection.pinned
                                ? '取消固定'
                                : '固定'}
                          </span>
                        </button>
                        <button
                          className={styles.action}
                          disabled={isBusy}
                          type="button"
                          onClick={() => {
                            void handleLogin(connection);
                          }}
                        >
                          {isLoggingIn
                            ? '登录中…'
                            : isConnected
                              ? '重新登录'
                              : '登录'}
                        </button>
                        <button
                          className={`${styles.action} ${styles.actionQuiet}`}
                          disabled={isBusy}
                          type="button"
                          onClick={() => {
                            setConfirmingId(connection.id);
                          }}
                        >
                          {connection.pinned ? '清除 Cookie' : '移除'}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {loggingInId && (
          <output className={styles.loginHint}>
            <span
              className={`${ui.spinner} ${ui.spinnerSmall}`}
              aria-hidden="true"
            />
            请在登录窗口中完成登录，然后关闭窗口以保存 Cookie。
          </output>
        )}

        {!isLoading && connections.length > 0 && (
          <div className={styles.dangerZone}>
            <div>
              <strong>清理全部站点数据</strong>
              <p>
                删除未固定站点连接和全部 Cookie；固定站点只清除 Cookie、缓存，
                保留在列表中。网络代理与界面设置不受影响。
              </p>
            </div>
            <button
              className={styles.clearAllButton}
              disabled={isBusy}
              type="button"
              onClick={() => {
                setError('');
                setIsClearAllOpen(true);
              }}
            >
              清理全部
            </button>
          </div>
        )}
      </section>

      <p className={styles.note}>通用与存储设置将在后续版本加入。</p>

      {isAddOpen && (
        <AddSiteDialog
          onAdded={handleAdded}
          onClose={() => {
            setIsAddOpen(false);
          }}
        />
      )}

      {isClearAllOpen && (
        <ClearAllSitesDialog
          connectionCount={connections.length}
          pinnedCount={pinnedCount}
          onCleared={handleAllCleared}
          onClose={() => {
            setIsClearAllOpen(false);
          }}
        />
      )}
    </main>
  );
}
