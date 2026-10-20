import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './ipc';
import { installSecurityPolicies } from './security';
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
    .then(() => {
      if (process.platform === 'win32') {
        app.setAppUserModelId('com.japp.desktop');
      }

      installSecurityPolicies();
      registerIpcHandlers();
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
