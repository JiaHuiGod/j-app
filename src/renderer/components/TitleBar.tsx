import { useEffect, useState } from 'react';
import { AppMark } from './AppMark';
import { GlobeIcon } from './GlobeIcon';

interface TitleBarProps {
  proxyEnabled: boolean;
  onOpenProxySettings: () => void;
}

export function TitleBar({ proxyEnabled, onOpenProxySettings }: TitleBarProps) {
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
    <header className={`titlebar${isMac ? ' titlebar--mac' : ''}`}>
      <div className="titlebar-brand">
        <AppMark size={22} />
        <span className="titlebar-app-name">J App</span>
      </div>

      <span className="titlebar-divider" aria-hidden="true" />

      <nav className="titlebar-nav" aria-label="主导航">
        <span
          aria-current="page"
          className="titlebar-nav-item titlebar-nav-item--active"
        >
          概览
        </span>
        {/* Add future navigation entries here. */}
      </nav>

      <div className="titlebar-drag-space" aria-hidden="true" />

      <div className="titlebar-actions">
        <button
          aria-label={`网络代理，当前${proxyEnabled ? '已开启' : '未开启'}`}
          className={`titlebar-action${proxyEnabled ? ' is-enabled' : ''}`}
          title={`网络代理：${proxyEnabled ? '已开启' : '未开启'}`}
          type="button"
          onClick={onOpenProxySettings}
        >
          <GlobeIcon className="titlebar-action-icon" />
          <span>代理</span>
          <span className="titlebar-action-dot" aria-hidden="true" />
        </button>
        {/* Add global toolbar actions here. */}
      </div>

      {!isMac && (
        <div className="window-controls">
          <button
            aria-label="最小化"
            className="window-control"
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
            className="window-control"
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
            className="window-control window-control--close"
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
