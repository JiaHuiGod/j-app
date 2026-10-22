import { useEffect, useId, useRef, useState } from 'react';
import type { ThemePreference } from '@shared/appearance';
import { getThemeLabel, THEME_OPTIONS } from '../lib/theme';
import { NAVIGATION_ITEMS, type AppPage } from '../navigation';
import { AppMark } from './AppMark';
import { GlobeIcon } from './GlobeIcon';
import { ThemeIcon } from './ThemeIcon';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  activePage: AppPage;
  proxyEnabled: boolean;
  themePreference: ThemePreference;
  themeError: string;
  isThemeLoading: boolean;
  isThemeSaving: boolean;
  onNavigate: (page: AppPage) => void;
  onOpenProxySettings: () => void;
  onSelectTheme: (preference: ThemePreference) => void;
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.themeCheck}
      focusable="false"
      viewBox="0 0 12 12"
    >
      <path d="m2.5 6.2 2.2 2.2 4.8-5.1" />
    </svg>
  );
}

export function TitleBar({
  activePage,
  proxyEnabled,
  themePreference,
  themeError,
  isThemeLoading,
  isThemeSaving,
  onNavigate,
  onOpenProxySettings,
  onSelectTheme,
}: TitleBarProps) {
  const { platform, windowControls } = window.desktop;
  const isMac = platform === 'darwin';
  const [isMaximized, setIsMaximized] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeControlRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const themeMenuId = useId();
  const themeLabel = getThemeLabel(themePreference);

  useEffect(() => {
    let isMounted = true;

    void windowControls
      .isMaximized()
      .then((maximized) => {
        if (isMounted) {
          setIsMaximized(maximized);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to read window state:', error);
      });

    const unsubscribe = windowControls.onMaximizedChange((maximized) => {
      setIsMaximized(maximized);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [windowControls]);

  useEffect(() => {
    if (!isThemeMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!themeControlRef.current?.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsThemeMenuOpen(false);
        themeButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isThemeMenuOpen]);

  return (
    <header className={`${styles.titlebar}${isMac ? ` ${styles.mac}` : ''}`}>
      <div className={styles.brand}>
        <AppMark size={22} />
        <span className={styles.appName}>J App</span>
      </div>

      <span className={styles.divider} aria-hidden="true" />

      <nav className={styles.nav} aria-label="主导航">
        {NAVIGATION_ITEMS.map((item) => {
          const isActive = item.id === activePage;

          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              className={`${styles.navItem}${isActive ? ` ${styles.active}` : ''}`}
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className={styles.dragSpace} aria-hidden="true" />

      <div className={styles.actions}>
        <button
          aria-label={`网络代理，当前${proxyEnabled ? '已开启' : '未开启'}`}
          className={`${styles.action}${proxyEnabled ? ` ${styles.enabled}` : ''}`}
          title={`网络代理：${proxyEnabled ? '已开启' : '未开启'}`}
          type="button"
          onClick={onOpenProxySettings}
        >
          <GlobeIcon className={styles.actionIcon} />
          <span className={styles.actionLabel}>代理</span>
          <span className={styles.actionDot} aria-hidden="true" />
        </button>

        <div className={styles.themeControl} ref={themeControlRef}>
          <button
            aria-controls={themeMenuId}
            aria-expanded={isThemeMenuOpen}
            aria-haspopup="menu"
            aria-label={`主题，当前${themeLabel}`}
            className={`${styles.action}${isThemeMenuOpen ? ` ${styles.actionOpen}` : ''}`}
            disabled={isThemeLoading}
            ref={themeButtonRef}
            title={`主题：${themeLabel}`}
            type="button"
            onClick={() => {
              setIsThemeMenuOpen((current) => !current);
            }}
          >
            <ThemeIcon
              className={styles.actionIcon}
              preference={themePreference}
            />
            <span className={styles.actionLabel}>主题</span>
          </button>

          {isThemeMenuOpen && (
            <div
              aria-label="选择主题"
              className={styles.themeMenu}
              id={themeMenuId}
              role="menu"
            >
              {THEME_OPTIONS.map((option) => {
                const isSelected = option.value === themePreference;

                return (
                  <button
                    aria-checked={isSelected}
                    className={`${styles.themeOption}${isSelected ? ` ${styles.themeOptionSelected}` : ''}`}
                    disabled={isThemeSaving}
                    key={option.value}
                    role="menuitemradio"
                    type="button"
                    onClick={() => {
                      setIsThemeMenuOpen(false);

                      if (!isSelected) {
                        onSelectTheme(option.value);
                      }
                    }}
                  >
                    <ThemeIcon
                      className={styles.themeOptionIcon}
                      preference={option.value}
                    />
                    <span>{option.label}</span>
                    {isSelected && <CheckIcon />}
                  </button>
                );
              })}
            </div>
          )}

          <span aria-live="polite" className="sr-only">
            {isThemeLoading
              ? '正在读取主题…'
              : isThemeSaving
                ? '正在应用主题…'
                : themeError}
          </span>
        </div>
        {/* Add global toolbar actions here. */}
      </div>

      {!isMac && (
        <div className={styles.windowControls}>
          <button
            aria-label="最小化"
            className={styles.windowControl}
            title="最小化"
            type="button"
            onClick={windowControls.minimize}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12">
              <path d="M2.5 6h7" />
            </svg>
          </button>

          <button
            aria-label={isMaximized ? '还原' : '最大化'}
            className={styles.windowControl}
            title={isMaximized ? '还原' : '最大化'}
            type="button"
            onClick={windowControls.toggleMaximize}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12">
              {isMaximized ? (
                <>
                  <path d="M4.5 2.5h5v5" />
                  <rect height="5" rx="0.4" width="5" x="2.5" y="4.5" />
                </>
              ) : (
                <rect height="6" rx="0.4" width="6" x="3" y="3" />
              )}
            </svg>
          </button>

          <button
            aria-label="关闭"
            className={`${styles.windowControl} ${styles.close}`}
            title="关闭"
            type="button"
            onClick={windowControls.close}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>
      )}
    </header>
  );
}
