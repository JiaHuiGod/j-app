import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type SyntheticEvent,
} from 'react';
import type { SiteConnectionSummary } from '@shared/connections';
import { toErrorMessage } from '../lib/errors';
import { GlobeIcon } from './GlobeIcon';

interface AddSiteDialogProps {
  onClose: () => void;
  onAdded: (connection: SiteConnectionSummary) => void;
}

function isValidLoginUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());

    if (url.protocol === 'https:') {
      return true;
    }

    return (
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function AddSiteDialog({ onClose, onAdded }: AddSiteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [loginUrl, setLoginUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

    nameInputRef.current?.focus();

    return () => {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    };
  }, []);

  const requestClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();

    if (!isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedUrl = loginUrl.trim();

    if (!trimmedName) {
      setError('请输入站点名称。');
      return;
    }

    if (!isValidLoginUrl(trimmedUrl)) {
      setError(
        '请输入有效的 HTTPS 登录地址；本地开发可以使用 http://localhost。',
      );
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const connection = await window.desktop.connections.create({
        name: trimmedName,
        loginUrl: trimmedUrl,
      });

      onAdded(connection);
      onClose();
    } catch (submitFailure: unknown) {
      setError(
        toErrorMessage(submitFailure, '保存站点 Cookie 失败，请稍后重试。'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      aria-describedby="site-dialog-description"
      aria-labelledby="site-dialog-title"
      className="site-dialog"
      ref={dialogRef}
      onCancel={handleCancel}
    >
      <form
        autoComplete="off"
        className="site-dialog-form"
        noValidate
        onSubmit={handleSubmit}
      >
        <header className="site-dialog-header">
          <span className="site-dialog-icon" aria-hidden="true">
            <GlobeIcon />
          </span>
          <div className="site-dialog-heading">
            <p className="site-dialog-kicker">Connection</p>
            <h2 id="site-dialog-title">添加站点</h2>
            <p id="site-dialog-description">
              登录状态会保存在独立、持久化的站点会话中。
            </p>
          </div>
          <button
            aria-label="关闭添加站点窗口"
            className="site-dialog-close"
            disabled={isSubmitting}
            title="关闭"
            type="button"
            onClick={requestClose}
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

          <label className="site-dialog-field">
            <span>站点名称</span>
            <input
              disabled={isSubmitting}
              maxLength={80}
              placeholder="例如：GitHub"
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError('');
              }}
            />
          </label>

          <label className="site-dialog-field">
            <span>登录地址</span>
            <input
              disabled={isSubmitting}
              placeholder="https://example.com/login"
              spellCheck={false}
              type="url"
              value={loginUrl}
              onChange={(event) => {
                setLoginUrl(event.target.value);
                setError('');
              }}
            />
          </label>

          <div className="site-dialog-note">
            <span aria-hidden="true">i</span>
            <p>
              点击下方按钮后会打开独立登录窗口。完成登录后关闭该窗口，应用会检测并保存该站点的
              Cookie。
            </p>
          </div>
        </div>

        <footer className="site-dialog-footer">
          <button
            className="proxy-button proxy-button--secondary"
            disabled={isSubmitting}
            type="button"
            onClick={requestClose}
          >
            取消
          </button>
          <button
            className="proxy-button proxy-button--primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <>
                <span
                  className="proxy-spinner proxy-spinner--small"
                  aria-hidden="true"
                />
                等待登录窗口…
              </>
            ) : (
              '打开登录窗口'
            )}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
