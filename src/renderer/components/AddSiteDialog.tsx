import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type SyntheticEvent,
} from 'react';
import type {
  CreateSiteConnectionInput,
  SiteConnectionSummary,
} from '@shared/connections';
import { toErrorMessage } from '../lib/errors';
import ui from '../styles/ui.module.css';
import { GlobeIcon } from './GlobeIcon';
import styles from './SiteDialogs.module.css';

interface AddSiteDialogProps {
  onClose: () => void;
  onAdded: (connection: SiteConnectionSummary) => void;
}

type SubmitAction = 'login' | 'preset';

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
  const [pendingAction, setPendingAction] = useState<SubmitAction | null>(null);
  const [error, setError] = useState('');
  const isSubmitting = pendingAction !== null;

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

  const validateInput = (): CreateSiteConnectionInput | null => {
    const trimmedName = name.trim();
    const trimmedUrl = loginUrl.trim();

    if (!trimmedName) {
      setError('请输入站点名称。');
      return null;
    }

    if (!isValidLoginUrl(trimmedUrl)) {
      setError(
        '请输入有效的 HTTPS 登录地址；本地开发可以使用 http://localhost。',
      );
      return null;
    }

    return {
      name: trimmedName,
      loginUrl: trimmedUrl,
    };
  };

  const handleSave = async (action: SubmitAction) => {
    if (isSubmitting) {
      return;
    }

    const input = validateInput();

    if (!input) {
      return;
    }

    setPendingAction(action);
    setError('');

    try {
      const connection =
        action === 'login'
          ? await window.desktop.connections.create(input)
          : await window.desktop.connections.createPreset(input);

      onAdded(connection);
      onClose();
    } catch (submitFailure: unknown) {
      setError(
        toErrorMessage(
          submitFailure,
          action === 'login'
            ? '保存站点 Cookie 失败，请稍后重试。'
            : '保存站点失败，请稍后重试。',
        ),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSave('login');
  };

  return (
    <dialog
      aria-describedby="site-dialog-description"
      aria-labelledby="site-dialog-title"
      className={styles.dialog}
      ref={dialogRef}
      onCancel={handleCancel}
    >
      <form
        autoComplete="off"
        className={styles.form}
        noValidate
        onSubmit={handleSubmit}
      >
        <header className={styles.header}>
          <span className={styles.icon} aria-hidden="true">
            <GlobeIcon />
          </span>
          <div className={styles.heading}>
            <p className={styles.kicker}>Connection</p>
            <h2 id="site-dialog-title">添加站点</h2>
            <p id="site-dialog-description">
              登录状态会保存在独立、持久化的站点会话中。
            </p>
          </div>
          <button
            aria-label="关闭添加站点窗口"
            className={styles.close}
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

        <div className={styles.body}>
          {error && (
            <div className={ui.alert} role="alert">
              {error}
            </div>
          )}

          <label className={styles.field}>
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

          <label className={styles.field}>
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

          <div className={styles.note}>
            <span aria-hidden="true">i</span>
            <p>
              “保存并登录”会打开独立登录窗口；完成登录后关闭窗口即可保存
              Cookie。“仅保存站点”只记录名称和地址，之后可在列表中随时登录。
            </p>
          </div>
        </div>

        <footer className={styles.footer}>
          <button
            className={`${ui.button} ${ui.buttonSecondary}`}
            disabled={isSubmitting}
            type="button"
            onClick={requestClose}
          >
            取消
          </button>
          <button
            className={`${ui.button} ${ui.buttonSecondary}`}
            disabled={isSubmitting}
            type="button"
            onClick={() => {
              void handleSave('preset');
            }}
          >
            {pendingAction === 'preset' ? '保存中…' : '仅保存站点'}
          </button>
          <button
            className={`${ui.button} ${ui.buttonPrimary}`}
            disabled={isSubmitting}
            type="submit"
          >
            {pendingAction === 'login' ? (
              <>
                <span
                  className={`${ui.spinner} ${ui.spinnerSmall}`}
                  aria-hidden="true"
                />
                等待登录窗口…
              </>
            ) : (
              '保存并登录'
            )}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
