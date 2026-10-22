import type { ThemePreference } from '@shared/appearance';
import { THEME_OPTIONS } from '../lib/theme';
import styles from './ThemeSettings.module.css';

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

interface ThemeSettingsProps {
  readonly preference: ThemePreference;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly error: string;
  readonly onSelectTheme: (theme: ThemePreference) => void;
}

export function ThemeSettings({
  preference,
  isLoading,
  isSaving,
  error,
  onSelectTheme,
}: ThemeSettingsProps) {
  const handleSelect = (theme: ThemePreference) => {
    if (isLoading || isSaving || theme === preference) {
      return;
    }

    onSelectTheme(theme);
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
