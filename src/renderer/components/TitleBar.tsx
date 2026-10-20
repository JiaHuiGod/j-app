import { useEffect, useState } from 'react';
import { NAVIGATION_ITEMS, type AppPage } from '../navigation';
import { AppMark } from './AppMark';
import { GlobeIcon } from './GlobeIcon';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  activePage: AppPage;
  proxyEnabled: boolean;
  onNavigate: (page: AppPage) => void;
  onOpenProxySettings: () => void;
}

export function TitleBar({
  activePage,
  proxyEnabled,
  onNavigate,
  onOpenProxySettings,
}: TitleBarProps) {
  const { platform, windowControls } = window.desktop;
  const isMac = platform === 'darwin';
  const [isMaximized, setIsMaximized] = useState(false);

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
          <span>代理</span>
          <span className={styles.actionDot} aria-hidden="true" />
        </button>
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
