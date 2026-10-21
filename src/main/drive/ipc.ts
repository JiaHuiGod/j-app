import { ipcMain } from 'electron';
import type { DriveError, DriveResult } from '@shared/drive';
import { IpcChannel } from '@shared/ipc';
import { listDriveAccounts } from './accounts';
import { list115Folder, search115Folder } from './115';

function unexpectedFailure<T>(context: string, error: unknown): DriveResult<T> {
  console.error(`Failed to ${context}:`, error);

  return {
    ok: false,
    error: {
      code: 'api',
      message: '115 网盘暂时不可用，请稍后重试。',
    } satisfies DriveError,
  };
}

export function registerDriveIpcHandlers(): void {
  ipcMain.handle(IpcChannel.ListDriveAccounts, async () => {
    try {
      return {
        ok: true,
        data: await listDriveAccounts(),
      } satisfies DriveResult<Awaited<ReturnType<typeof listDriveAccounts>>>;
    } catch (error) {
      return unexpectedFailure('read drive accounts', error);
    }
  });

  ipcMain.handle(IpcChannel.ListDriveFolder, async (_event, input: unknown) => {
    try {
      return await list115Folder(input);
    } catch (error) {
      return unexpectedFailure('list the 115 folder', error);
    }
  });

  ipcMain.handle(
    IpcChannel.SearchDriveFolder,
    async (_event, input: unknown) => {
      try {
        return await search115Folder(input);
      } catch (error) {
        return unexpectedFailure('search the 115 folder', error);
      }
    },
  );
}
