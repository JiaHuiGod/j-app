import { useEffect, useRef, useState } from 'react';
import type { ProxySettings } from '@shared/settings';
import { ProxyDialog } from './components/ProxyDialog';
import { TitleBar } from './components/TitleBar';
import type { AppPage } from './navigation';
import { DrivePage } from './pages/DrivePage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  const [activePage, setActivePage] = useState<AppPage>('overview');
  const [isProxyDialogOpen, setIsProxyDialogOpen] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const appShellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCurrent = true;

    void window.desktop.settings
      .getProxy()
      .then((proxy) => {
        if (isCurrent) {
          setProxyEnabled(proxy.enabled);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to read proxy status:', error);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleNavigate = (page: AppPage) => {
    setActivePage(page);

    if (appShellRef.current) {
      appShellRef.current.scrollTop = 0;
    }
  };

  const handleProxySaved = (proxy: ProxySettings) => {
    setProxyEnabled(proxy.enabled);
  };

  return (
    <div className="app-window">
      <TitleBar
        activePage={activePage}
        proxyEnabled={proxyEnabled}
        onNavigate={handleNavigate}
        onOpenProxySettings={() => {
          setIsProxyDialogOpen(true);
        }}
      />

      <div className="app-shell" ref={appShellRef}>
        {activePage === 'overview' && <OverviewPage />}
        {activePage === 'drive' && <DrivePage />}
        {activePage === 'settings' && <SettingsPage />}

        <footer className="app-footer">
          <span>
            J App <span className="slash">/</span> Scaffolded for production
          </span>
          <span className="footer-path">
            src/main · src/preload · src/renderer
          </span>
        </footer>
      </div>

      {isProxyDialogOpen && (
        <ProxyDialog
          onClose={() => {
            setIsProxyDialogOpen(false);
          }}
          onSaved={handleProxySaved}
        />
      )}
    </div>
  );
}

export default App;
