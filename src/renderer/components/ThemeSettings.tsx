import { useEffect, useRef, useState } from 'react';
import { type ThemePreference } from '@shared/appearance';
import { toErrorMessage } from '../lib/errors';

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

function ThemePreview({ mode }: { mode: ThemePreference }) {
  return (
    <span aria-hidden="true" className={`theme-preview theme-preview--${mode}`}>
      <span className="theme-preview-window">
        <span className="theme-preview-bar">
          <span />
          <span />
          <span />
        </span>
        <span className="theme-preview-content">
          <span className="theme-preview-title" />
          <span className="theme-preview-line" />
          <span className="theme-preview-line theme-preview-line--short" />
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
    <section aria-labelledby="appearance-title" className="appearance-card">
      <header className="appearance-header">
        <div>
          <p className="settings-kicker">Appearance</p>
          <h2 id="appearance-title">外观</h2>
          <p>选择应用主题，更改会立即生效并保存在本机。</p>
        </div>
        <span
          aria-live="polite"
          className={`appearance-status${isSaving ? ' is-saving' : ''}`}
        >
          {isLoading ? '读取中…' : isSaving ? '正在应用…' : '即时生效'}
        </span>
      </header>

      <fieldset className="theme-fieldset" disabled={isLoading || isSaving}>
        <legend className="sr-only">主题模式</legend>
        <div className="theme-options">
          {THEME_OPTIONS.map((option) => {
            const isSelected = preference === option.value;

            return (
              <label
                className={`theme-option${isSelected ? ' is-selected' : ''}`}
                key={option.value}
              >
                <input
                  checked={isSelected}
                  className="theme-option-input"
                  name="theme"
                  type="radio"
                  value={option.value}
                  onChange={() => {
                    void handleSelect(option.value);
                  }}
                />
                <ThemePreview mode={option.value} />
                <span className="theme-option-copy">
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="theme-option-check" aria-hidden="true">
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
        <div className="appearance-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
