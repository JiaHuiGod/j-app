import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type SyntheticEvent,
} from 'react';
import {
  PROXY_PROTOCOLS,
  type ProxyProtocol,
  type ProxySettings,
  type ProxyTestResult,
} from '@shared/settings';
import { toErrorMessage } from '../lib/errors';
import { GlobeIcon } from './GlobeIcon';

const PROTOCOL_LABELS: Record<ProxyProtocol, string> = {
  http: 'HTTP',
  https: 'HTTPS',
  socks5: 'SOCKS5',
};

const EMPTY_DRAFT: ProxyDraft = {
  enabled: false,
  protocol: 'http',
  host: '',
  port: '',
};

interface ProxyDraft {
  enabled: boolean;
  protocol: ProxyProtocol;
  host: string;
  port: string;
}

interface ProxyDialogProps {
  onClose: () => void;
  onSaved: (proxy: ProxySettings) => void;
}

export function ProxyDialog({ onClose, onSaved }: ProxyDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savedHeadingRef = useRef<HTMLHeadingElement>(null);
  const [draft, setDraft] = useState<ProxyDraft>(EMPTY_DRAFT);
  const [stage, setStage] = useState<'form' | 'saved'>('form');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [testResult, setTestResult] = useState<ProxyTestResult | null>(null);

  const isBusy = isTesting || isSaving || isRestarting;
  const isFormDisabled = isBusy || !draft.enabled;

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

    void window.desktop.settings
      .getProxy()
      .then((proxy) => {
        if (!isCurrent) {
          return;
        }

        setDraft({
          enabled: proxy.enabled,
          protocol: proxy.protocol,
          host: proxy.host,
          port: proxy.port > 0 ? String(proxy.port) : '',
        });
        setIsLoading(false);
      })
      .catch((loadFailure: unknown) => {
        if (!isCurrent) {
          return;
        }

        setLoadError(toErrorMessage(loadFailure, '无法读取当前代理配置。'));
        setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (stage === 'saved') {
      savedHeadingRef.current?.focus();
    }
  }, [stage]);

  const updateDraft = (patch: Partial<ProxyDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setTestResult(null);
    setError('');
  };

  const createProxySettings = (): ProxySettings | null => {
    const host = draft.host.trim();
    const port = Number(draft.port);

    if (draft.enabled) {
      if (!host) {
        setError('请输入代理主机地址。');
        return null;
      }

      if (/[\s/?#@]/.test(host)) {
        setError('代理主机地址格式不正确。');
        return null;
      }

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        setError('请输入 1 到 65535 之间的端口。');
        return null;
      }
    }

    return {
      enabled: draft.enabled,
      protocol: draft.protocol,
      host,
      port: Number.isInteger(port) && port >= 0 && port <= 65535 ? port : 0,
    };
  };

  const requestClose = () => {
    if (!isBusy) {
      onClose();
    }
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();

    if (!isBusy) {
      onClose();
    }
  };

  const handleTest = async () => {
    if (!draft.enabled) {
      setError('请先启用自定义代理。');
      return;
    }

    const proxy = createProxySettings();

    if (!proxy) {
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setError('');

    try {
      setTestResult(await window.desktop.settings.testProxy(proxy));
    } catch (testFailure: unknown) {
      setError(
        toErrorMessage(testFailure, '网络测试失败，请检查代理地址后重试。'),
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    const proxy = createProxySettings();

    if (!proxy) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await window.desktop.settings.saveProxy(proxy);
      onSaved(proxy);
      setStage('saved');
    } catch (saveFailure: unknown) {
      setError(toErrorMessage(saveFailure, '保存代理配置失败，请稍后重试。'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestart = () => {
    if (isRestarting) {
      return;
    }

    setIsRestarting(true);
    window.desktop.restartApp();
  };

  return (
    <dialog
      aria-describedby="proxy-dialog-description"
      aria-labelledby="proxy-dialog-title"
      className="proxy-dialog"
      ref={dialogRef}
      onCancel={handleCancel}
    >
      <div className="proxy-dialog-shell">
        <header className="proxy-dialog-header">
          <span className="proxy-dialog-icon" aria-hidden="true">
            <GlobeIcon />
          </span>

          <div className="proxy-dialog-heading">
            <p className="proxy-dialog-kicker">Network</p>
            <h2 id="proxy-dialog-title">网络代理</h2>
            <p id="proxy-dialog-description">
              为此应用配置独立的网络出口，重启后生效。
            </p>
          </div>

          <button
            aria-label="关闭网络代理设置"
            className="proxy-dialog-close"
            disabled={isBusy}
            title="关闭"
            type="button"
            onClick={requestClose}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </header>

        {isLoading && (
          <output className="proxy-dialog-state">
            <span className="proxy-spinner" aria-hidden="true" />
            <p>正在读取代理配置…</p>
          </output>
        )}

        {!isLoading && loadError && (
          <div className="proxy-dialog-state proxy-dialog-state--error">
            <strong>读取代理配置失败</strong>
            <p>{loadError}</p>
            <button
              className="proxy-button proxy-button--secondary"
              type="button"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        )}

        {!isLoading && !loadError && stage === 'saved' && (
          <>
            <div className="proxy-dialog-body proxy-dialog-body--saved">
              <div className="proxy-saved-hero">
                <span
                  className={`proxy-success-icon${draft.enabled ? '' : ' is-off'}`}
                  aria-hidden="true"
                >
                  ✓
                </span>

                <div className="proxy-saved-heading">
                  <div className="proxy-saved-kicker-row">
                    <p className="proxy-dialog-kicker">Saved</p>
                    <span
                      className={`proxy-state-pill${draft.enabled ? ' is-on' : ''}`}
                    >
                      <span className="proxy-state-dot" aria-hidden="true" />
                      {draft.enabled ? '已开启' : '未开启'}
                    </span>
                  </div>
                  <h3 ref={savedHeadingRef} tabIndex={-1}>
                    {draft.enabled ? '自定义代理已开启' : '自定义代理已关闭'}
                  </h3>
                  <p className="proxy-success-copy">
                    {draft.enabled
                      ? '重启应用后，网络请求将通过此代理发送。你可以现在重启，也可以稍后手动重启。'
                      : '重启应用后将恢复使用系统代理设置。你可以现在重启，也可以稍后手动重启。'}
                  </p>
                </div>
              </div>

              <dl className="proxy-summary">
                <div>
                  <dt>下次启动</dt>
                  <dd>{draft.enabled ? '使用自定义代理' : '跟随系统代理'}</dd>
                </div>
                <div>
                  <dt>代理地址</dt>
                  <dd>
                    {draft.enabled
                      ? `${PROTOCOL_LABELS[draft.protocol]} · ${draft.host}:${draft.port}`
                      : '使用系统代理设置'}
                  </dd>
                </div>
              </dl>
            </div>

            <footer className="proxy-dialog-footer">
              <span className="proxy-footer-hint">
                选择稍后时，请手动退出并重新启动应用。
              </span>
              <div className="proxy-footer-actions">
                <button
                  className="proxy-button proxy-button--secondary"
                  disabled={isRestarting}
                  type="button"
                  onClick={requestClose}
                >
                  稍后手动重启
                </button>
                <button
                  className="proxy-button proxy-button--primary"
                  disabled={isRestarting}
                  type="button"
                  onClick={handleRestart}
                >
                  {isRestarting ? '正在重启…' : '立即重启'}
                </button>
              </div>
            </footer>
          </>
        )}

        {!isLoading && !loadError && stage === 'form' && (
          <form
            autoComplete="off"
            className="proxy-form"
            noValidate
            onSubmit={handleSave}
          >
            <div className="proxy-dialog-body">
              {error && (
                <div className="proxy-alert" role="alert">
                  {error}
                </div>
              )}

              <label className="proxy-toggle">
                <span className="proxy-toggle-copy">
                  <strong>使用自定义代理</strong>
                  <span>关闭时沿用系统代理设置</span>
                </span>
                <span className="proxy-switch">
                  <input
                    aria-label="使用自定义代理"
                    checked={draft.enabled}
                    className="sr-only"
                    disabled={isBusy}
                    type="checkbox"
                    onChange={(event) => {
                      updateDraft({ enabled: event.target.checked });
                    }}
                  />
                  <span className="proxy-switch-track" aria-hidden="true" />
                </span>
              </label>

              <div className="proxy-fields">
                <label className="proxy-field">
                  <span className="proxy-field-label">代理协议</span>
                  <select
                    disabled={isFormDisabled}
                    value={draft.protocol}
                    onChange={(event) => {
                      updateDraft({
                        protocol: event.target.value as ProxyProtocol,
                      });
                    }}
                  >
                    {PROXY_PROTOCOLS.map((protocol) => (
                      <option key={protocol} value={protocol}>
                        {PROTOCOL_LABELS[protocol]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="proxy-field proxy-field--host">
                  <span className="proxy-field-label">主机</span>
                  <input
                    disabled={isFormDisabled}
                    placeholder="127.0.0.1"
                    spellCheck={false}
                    type="text"
                    value={draft.host}
                    onChange={(event) => {
                      updateDraft({ host: event.target.value });
                    }}
                  />
                </label>

                <label className="proxy-field proxy-field--port">
                  <span className="proxy-field-label">端口</span>
                  <input
                    disabled={isFormDisabled}
                    inputMode="numeric"
                    max={65535}
                    min={1}
                    placeholder="7890"
                    type="number"
                    value={draft.port}
                    onChange={(event) => {
                      updateDraft({ port: event.target.value });
                    }}
                  />
                </label>
              </div>

              <p className="proxy-fields-hint">
                仅支持无需认证的代理；localhost、127.0.0.1 和 ::1 会自动直连。
              </p>

              <section
                aria-labelledby="proxy-test-title"
                className="proxy-test"
              >
                <div className="proxy-test-header">
                  <div>
                    <h3 id="proxy-test-title">连接测试</h3>
                    <p>通过此代理访问 Google 与 GitHub。</p>
                  </div>
                  <button
                    className="proxy-test-button"
                    disabled={!draft.enabled || isBusy}
                    type="button"
                    onClick={handleTest}
                  >
                    {isTesting ? (
                      <>
                        <span
                          className="proxy-spinner proxy-spinner--small"
                          aria-hidden="true"
                        />
                        测试中…
                      </>
                    ) : (
                      '开始测试'
                    )}
                  </button>
                </div>

                {testResult ? (
                  <div className="proxy-test-results" aria-live="polite">
                    {testResult.results.map((result) => (
                      <div
                        className={`proxy-test-result${result.ok ? ' is-success' : ' is-failure'}`}
                        key={result.id}
                      >
                        <span className="proxy-test-status" aria-hidden="true">
                          {result.ok ? '✓' : '×'}
                        </span>
                        <span className="proxy-test-name">{result.label}</span>
                        <span className="proxy-test-message">
                          {result.message}
                        </span>
                        <span className="proxy-test-latency">
                          {result.ok && result.latencyMs !== null
                            ? `${result.latencyMs} ms`
                            : '—'}
                        </span>
                      </div>
                    ))}
                    <p className="proxy-test-summary">
                      {testResult.ok
                        ? '两个目标均可访问，代理链路正常。'
                        : '至少一个目标不可达，建议检查代理配置。'}
                    </p>
                  </div>
                ) : (
                  <p className="proxy-test-hint">
                    {draft.enabled
                      ? '保存前可以先确认代理链路是否可用。'
                      : '启用自定义代理后即可测试。'}
                  </p>
                )}
              </section>
            </div>

            <footer className="proxy-dialog-footer">
              <span className="proxy-footer-hint">
                保存后需要重启应用才能生效。
              </span>
              <div className="proxy-footer-actions">
                <button
                  className="proxy-button proxy-button--secondary"
                  disabled={isBusy}
                  type="button"
                  onClick={requestClose}
                >
                  取消
                </button>
                <button
                  className="proxy-button proxy-button--primary"
                  disabled={isBusy}
                  type="submit"
                >
                  {isSaving ? '保存中…' : '保存设置'}
                </button>
              </div>
            </footer>
          </form>
        )}
      </div>
    </dialog>
  );
}
