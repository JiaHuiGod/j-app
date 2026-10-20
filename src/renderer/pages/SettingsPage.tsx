import { useCallback, useEffect, useRef, useState } from 'react';
import type { SiteConnectionSummary } from '@shared/connections';
import { AddSiteDialog } from '../components/AddSiteDialog';
import { ClearAllSitesDialog } from '../components/ClearAllSitesDialog';
import { GlobeIcon } from '../components/GlobeIcon';
import { ThemeSettings } from '../components/ThemeSettings';
import { toErrorMessage } from '../lib/errors';

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
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
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

export function SettingsPage() {
  const [connections, setConnections] = useState<
    readonly SiteConnectionSummary[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [loggingInId, setLoggingInId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const isMountedRef = useRef(true);

  const isBusy = loggingInId !== null || removingId !== null;

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

  const handleRemove = async (connection: SiteConnectionSummary) => {
    if (isBusy) {
      return;
    }

    setRemovingId(connection.id);
    setError('');

    try {
      await window.desktop.connections.remove(connection.id);

      if (isMountedRef.current) {
        setConnections((current) =>
          current.filter((item) => item.id !== connection.id),
        );
        setConfirmingId(null);
      }
    } catch (removeFailure: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(removeFailure, '移除站点失败，请稍后重试。'));
      }
    } finally {
      if (isMountedRef.current) {
        setRemovingId(null);
      }
    }
  };

  const handleAllCleared = () => {
    setConnections([]);
    setConfirmingId(null);
    setLoggingInId(null);
    setError('');
  };

  return (
    <main className="settings-page" aria-labelledby="settings-page-title">
      <header className="settings-page-header">
        <div className="settings-page-heading">
          <p className="eyebrow">Preferences / Appearance & Connections</p>
          <h1 id="settings-page-title">设置。</h1>
          <p className="lede">
            调整应用外观，并管理需要登录的站点。每个站点使用独立的持久会话保存
            Cookie，登录信息不会进入页面或配置文件。
          </p>
        </div>

        <aside className="settings-security">
          <span className="settings-security-icon" aria-hidden="true">
            <LockIcon />
          </span>
          <div>
            <strong>本地加密会话</strong>
            <p>Cookie 由 Electron 持久会话管理，不向渲染层暴露。</p>
          </div>
        </aside>
      </header>

      <ThemeSettings />

      <section aria-labelledby="connections-title" className="connections-card">
        <header className="connections-card-header">
          <div>
            <p className="settings-kicker">Site sessions</p>
            <h2 id="connections-title">站点账号</h2>
            <p>登录站点后关闭登录窗口，应用会检测并保存 Cookie。</p>
          </div>
          <button
            className="settings-add-button"
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

        <aside
          aria-label="站点资源占用提示"
          className="connections-resource-warning"
        >
          <span
            className="connections-resource-warning-icon"
            aria-hidden="true"
          >
            !
          </span>
          <div>
            <strong>站点越多，资源占用越高</strong>
            <p>
              每个站点都会增加独立的 Cookie、缓存和持久会话开销，而 Electron
              本身有较高的内存占用。请只添加确实需要的站点，并在不再使用时及时移除。
            </p>
          </div>
        </aside>

        {error && (
          <div className="connections-error" role="alert">
            <span>{error}</span>
            {isLoading === false && connections.length === 0 && (
              <button
                className="connections-retry"
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
          <output className="connections-loading">
            <span className="proxy-spinner" aria-hidden="true" />
            正在读取站点连接…
          </output>
        ) : connections.length === 0 ? (
          !error && (
            <div className="connections-empty">
              <span className="connections-empty-icon" aria-hidden="true">
                <GlobeIcon />
              </span>
              <div>
                <h3>还没有保存的站点</h3>
                <p>
                  添加一个需要登录的网站，完成登录后关闭登录窗口， Cookie
                  会保存在独立的持久会话中。
                </p>
              </div>
            </div>
          )
        ) : (
          <ul className="connection-list">
            {connections.map((connection) => {
              const isConnected = connection.status === 'connected';
              const isConfirming = confirmingId === connection.id;
              const isLoggingIn = loggingInId === connection.id;
              const isRemoving = removingId === connection.id;

              return (
                <li className="connection-row" key={connection.id}>
                  <span className="connection-avatar" aria-hidden="true">
                    {connection.name.trim().charAt(0).toUpperCase()}
                  </span>

                  <div className="connection-info">
                    <div className="connection-title">
                      <strong>{connection.name}</strong>
                      <span
                        className={`connection-state${isConnected ? ' is-connected' : ''}`}
                      >
                        <span aria-hidden="true" />
                        {isConnected ? '已保存' : '未连接'}
                      </span>
                    </div>
                    <span
                      className="connection-url"
                      title={connection.loginUrl}
                    >
                      {connection.loginUrl}
                    </span>
                    <span className="connection-meta">
                      {isConnected
                        ? `${connection.cookieCount} 个 Cookie`
                        : '未检测到 Cookie'}
                      <span aria-hidden="true">·</span>
                      上次登录 {formatLoginTime(connection.lastLoginAt)}
                    </span>
                  </div>

                  <div className="connection-actions">
                    {isConfirming ? (
                      <>
                        <button
                          className="connection-action"
                          disabled={isBusy}
                          type="button"
                          onClick={() => {
                            setConfirmingId(null);
                          }}
                        >
                          取消
                        </button>
                        <button
                          className="connection-action connection-action--danger"
                          disabled={isBusy}
                          type="button"
                          onClick={() => {
                            void handleRemove(connection);
                          }}
                        >
                          {isRemoving ? '移除中…' : '确认移除'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="connection-action"
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
                          className="connection-action connection-action--quiet"
                          disabled={isBusy}
                          type="button"
                          onClick={() => {
                            setConfirmingId(connection.id);
                          }}
                        >
                          移除
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
          <output className="connections-login-hint">
            <span
              className="proxy-spinner proxy-spinner--small"
              aria-hidden="true"
            />
            请在登录窗口中完成登录，然后关闭窗口以保存 Cookie。
          </output>
        )}

        {!isLoading && connections.length > 0 && (
          <div className="connections-danger-zone">
            <div>
              <strong>清理全部站点数据</strong>
              <p>
                删除所有站点连接、Cookie
                和本地缓存。网络代理与界面设置不受影响。
              </p>
            </div>
            <button
              className="connections-clear-all-button"
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

      <p className="settings-page-note">通用与存储设置将在后续版本加入。</p>

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
          onCleared={handleAllCleared}
          onClose={() => {
            setIsClearAllOpen(false);
          }}
        />
      )}
    </main>
  );
}
