import path from 'node:path';
import { app } from 'electron';

export function getAppIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../resources/icon.png');
}
