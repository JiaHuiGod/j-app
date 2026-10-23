import { app } from 'electron';
import started from 'electron-squirrel-startup';
import { applyThemePreference } from './appearance/theme';
import { cleanupOrphanSitePartitions } from './connections/partition-cleanup';
import { shouldStartHidden, showTrayTipOnce } from './desktop-behavior';
import { configureDevUserData } from './dev-user-data';
import { registerIpcHandlers } from './ipc';
import { registerLocalVideoProtocol } from './local-video/protocol';
import { applyProxySettings } from './network/proxy';
import { installSecurityPolicies } from './security';
import { loadSettings } from './settings/store';
import { createAppTray, destroyAppTray, refreshTrayMenu } from './tray';
import { initializeUpdates, stopUpdateChecks } from './updates/manager';
import {
  createMainWindow,
  isCloseToTrayEnabled,
  markAppQuitting,
  setCloseToTrayEnabled,
  setCloseToTrayHandler,
  setWindowVisibilityHandler,
  showMainWindow,
} from './window';

app.setName('J App');

// Squirrel builds the shortcut AUMID as
// com.squirrel.<nupkg-id>.<exe-name-without-spaces>.
// The window must use the same AUMID so Windows groups it with the shortcut.
const WINDOWS_APP_USER_MODEL_ID = 'com.squirrel.j_app.JApp';

if (process.platform === 'win32') {
  app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);
}

if (started) {
  // Squirrel uses this process to create or remove Windows shortcuts.
  app.quit();
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  configureDevUserData();

  app.on('second-instance', () => {
    void showMainWindow();
  });

  app.on('before-quit', () => {
    markAppQuitting();
  });

  app.on('will-quit', () => {
    stopUpdateChecks();
    destroyAppTray();
  });

  void app
    .whenReady()
    .then(async () => {
      installSecurityPolicies();

      const settings = await loadSettings();
      const startHidden = shouldStartHidden(settings.desktop);

      setCloseToTrayEnabled(settings.desktop.closeToTray);
      applyThemePreference(settings.appearance.theme);

      try {
        await cleanupOrphanSitePartitions(settings.connections.sites);
      } catch (error) {
        console.error('Failed to clean up orphan site partitions:', error);
      }

      try {
        await applyProxySettings(settings.network.proxy);
      } catch (error) {
        console.error('Failed to apply proxy settings:', error);
      }

      registerIpcHandlers();
      registerLocalVideoProtocol();
      await createMainWindow({ hidden: startHidden });

      const trayReady = createAppTray({
        onQuit: () => {
          markAppQuitting();
          app.quit();
        },
      });

      if (!trayReady) {
        setCloseToTrayEnabled(false);

        if (startHidden) {
          await showMainWindow();
        }
      } else {
        setCloseToTrayHandler(() => {
          showTrayTipOnce(() => {
            void showMainWindow();
          });
        });
        setWindowVisibilityHandler(refreshTrayMenu);
        refreshTrayMenu();
      }

      initializeUpdates();

      app.on('activate', () => {
        void showMainWindow();
      });
    })
    .catch((error: unknown) => {
      console.error('Failed to start the application:', error);
      app.quit();
    });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !isCloseToTrayEnabled()) {
      app.quit();
    }
  });
}
