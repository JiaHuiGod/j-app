import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type SyntheticEvent,
} from 'react';
import type { DriveResult } from '@shared/drive';
import ui from '../styles/ui.module.css';
import styles from './DriveDialogs.module.css';

type DriveActionDialogMode = 'create-folder' | 'delete' | 'rename';

interface DriveActionDialogProps {
  readonly entryName?: string;
  readonly initialName?: string;
  readonly itemCount?: number;
  readonly mode: DriveActionDialogMode;
  readonly onClose: () => void;
  readonly onCompleted: () => void;
  readonly onSubmit: (name: string) => Promise<DriveResult<null>>;
}

const COPY: Record<
  DriveActionDialogMode,
  { description: string; submit: string; title: string }
> = {
  'create-folder': {
    description: '在当前目录下创建一个新文件夹。',
    submit: '创建文件夹',
    title: '新建文件夹',
  },
  delete: {
    description: '删除后的文件或文件夹会进入 115 回收站。',
    submit: '确认删除',
    title: '删除项目',
  },
  rename: {
    description: '修改后会保留原文件内容和位置。',
    submit: '保存名称',
    title: '重命名',
  },
};

export function DriveActionDialog({
  entryName = '',
  initialName = '',
  itemCount = 1,
  mode,
  onClose,
  onCompleted,
  onSubmit,
}: DriveActionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const copy = COPY[mode];
  const hasInput = mode !== 'delete';

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
      if (hasInput) {
        inputRef.current?.focus();
        inputRef.current?.select();
      } else {
        cancelRef.current?.focus();
      }
    });

    return () => {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    };
  }, [hasInput]);

  const requestClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    requestClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedName = name.trim();

    if (hasInput && !normalizedName) {
      setError('名称不能为空。');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await onSubmit(normalizedName);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      onCompleted();
      onClose();
    } catch {
      setError('操作失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={handleCancel}>
      <form
        className={styles.shell}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <p className={styles.kicker}>115 / Cloud Drive</p>
            <h2>{copy.title}</h2>
            <p className={styles.description}>{copy.description}</p>
          </div>
          <button
            aria-label="关闭"
            className={styles.close}
            disabled={isSubmitting}
            type="button"
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          {hasInput ? (
            <label className={styles.field} htmlFor={inputId}>
              <span className={styles.fieldLabel}>
                {mode === 'rename' ? '新名称' : '文件夹名称'}
              </span>
              <input
                ref={inputRef}
                className={styles.input}
                disabled={isSubmitting}
                id={inputId}
                maxLength={255}
                placeholder={mode === 'rename' ? '输入新名称' : '例如：待整理'}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                }}
              />
            </label>
          ) : (
            <div className={styles.dangerNote}>
              {itemCount > 1 ? (
                <>
                  确定删除已选中的 <strong>{itemCount}</strong>{' '}
                  个项目？删除后会进入 115 回收站。
                </>
              ) : (
                <>
                  确定删除 <strong>{entryName}</strong>
                  ？文件夹内的内容也会一并删除。
                </>
              )}
            </div>
          )}

          {error && (
            <div className={styles.alert} role="alert">
              {error}
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            ref={cancelRef}
            className={`${ui.button} ${ui.buttonSecondary}`}
            disabled={isSubmitting}
            type="button"
            onClick={requestClose}
          >
            取消
          </button>
          <button
            className={`${ui.button} ${mode === 'delete' ? ui.buttonDanger : ui.buttonPrimary}`}
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '处理中…' : copy.submit}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
