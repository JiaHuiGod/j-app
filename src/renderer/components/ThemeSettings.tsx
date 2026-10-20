import { useEffect, useRef, useState } from 'react';
import { type ThemePreference } from '@shared/appearance';
import { toErrorMessage } from '../lib/errors';
import styles from './ThemeSettings.module.css';

interface ThemeOption {
  readonly value: ThemePreference;
  readonly label: string;
  readonly description: string;
}

const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    value: 'light',
    label: '浅色',
    description: '始终使用明亮界面',
  },
  {
    value: 'dark',
    label: '深色',
    description: '始终使用暗色界面',
  },
  {
    value: 'system',
    label: '跟随系统',
    description: '随操作系统外观切换',
  },
];

const THEME_PREVIEW_CLASSES: Record<ThemePreference, string> = {
  light: styles.previewLight ?? '',
  dark: styles.previewDark ?? '',
  system: styles.previewSystem ?? '',
};

function ThemePreview({ mode }: { mode: ThemePreference }) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.preview} ${THEME_PREVIEW_CLASSES[mode]}`}
    >
      <span className={styles.previewWindow}>
        <span className={styles.previewBar}>
          <span />
          <span />
          <span />
        </span>
        <span className={styles.previewContent}>
          <span className={styles.previewTitle} />
          <span className={styles.previewLine} />
          <span className={`${styles.previewLine} ${styles.previewShort}`} />
        </span>
      </span>
    </span>
  );
}

export function ThemeSettings() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    void window.desktop.appearance
      .get()
      .then((state) => {
        if (isMountedRef.current) {
          setPreference(state.preference);
        }
      })
      .catch((loadFailure: unknown) => {
        if (isMountedRef.current) {
          setError(
            toErrorMessage(loadFailure, '无法读取主题设置，请稍后重试。'),
          );
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

  const handleSelect = async (theme: ThemePreference) => {
    if (isLoading || isSaving || theme === preference) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const state = await window.desktop.appearance.setTheme(theme);

      if (isMountedRef.current) {
        setPreference(state.preference);
      }
    } catch (saveFailure: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(saveFailure, '主题切换失败，请稍后重试。'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  return (
    <section aria-labelledby="appearance-title" className={styles.card}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Appearance</p>
          <h2 id="appearance-title">外观</h2>
          <p>选择应用主题，更改会立即生效并保存在本机。</p>
        </div>
        <span
          aria-live="polite"
          className={`${styles.status}${isSaving ? ` ${styles.saving}` : ''}`}
        >
          {isLoading ? '读取中…' : isSaving ? '正在应用…' : '即时生效'}
        </span>
      </header>

      <fieldset className={styles.fieldset} disabled={isLoading || isSaving}>
        <legend className="sr-only">主题模式</legend>
        <div className={styles.options}>
          {THEME_OPTIONS.map((option) => {
            const isSelected = preference === option.value;

            return (
              <label
                className={`${styles.option}${isSelected ? ` ${styles.selected}` : ''}`}
                key={option.value}
              >
                <input
                  checked={isSelected}
                  className={styles.input}
                  name="theme"
                  type="radio"
                  value={option.value}
                  onChange={() => {
                    void handleSelect(option.value);
                  }}
                />
                <ThemePreview mode={option.value} />
                <span className={styles.copy}>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                <span className={styles.check} aria-hidden="true">
                  <svg focusable="false" viewBox="0 0 12 12">
                    <path d="m2.5 6.2 2.2 2.2 4.8-5.1" />
                  </svg>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
