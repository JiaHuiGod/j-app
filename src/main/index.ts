import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { applyThemePreference } from './appearance/theme';
import { cleanupOrphanSitePartitions } from './connections/partition-cleanup';
import { registerIpcHandlers } from './ipc';
import { registerLocalVideoProtocol } from './local-video/protocol';
import { applyProxySettings } from './network/proxy';
import { installSecurityPolicies } from './security';
import { loadSettings } from './settings/store';
import { createMainWindow, focusMainWindow } from './window';

if (started) {
  // Squirrel uses this process to create or remove Windows shortcuts.
  app.quit();
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName('J App');

  app.on('second-instance', () => {
    focusMainWindow();
  });

  void app
    .whenReady()
    .then(async () => {
      if (process.platform === 'win32') {
        app.setAppUserModelId('com.japp.desktop');
      }

      installSecurityPolicies();

      const settings = await loadSettings();

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
      createMainWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createMainWindow();
        }
      });
    })
    .catch((error: unknown) => {
      console.error('Failed to start the application:', error);
      app.quit();
    });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
