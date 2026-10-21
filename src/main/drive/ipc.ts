import { dialog, ipcMain } from 'electron';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import type {
  DriveError,
  DriveResult,
  DriveUploadInput,
  DriveUploadResult,
} from '@shared/drive';
import { IpcChannel } from '@shared/ipc';
import { parseSiteConnectionId } from '../settings/schema';
import { getMainWindow } from '../window';
import {
  create115Folder,
  delete115Entry,
  move115Entry,
  rename115Entry,
} from './actions';
import { getAccountSession } from './115';
import { listDriveAccounts } from './accounts';
import { upload115Files } from './upload';
import { list115Folder, search115Folder } from './115';

const MAX_DROPPED_FILES = 100;
const MAX_FILE_PATH_LENGTH = 4096;

interface DroppedUploadRequest {
  readonly input: DriveUploadInput;
  readonly filePaths: readonly string[];
}

interface UploadFile {
  readonly path: string;
  readonly name: string;
}

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

function isDriveError(value: unknown): value is DriveError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

function parseUploadInput(value: unknown): DriveUploadInput | DriveError {
  if (typeof value !== 'object' || value === null) {
    return {
      code: 'invalid_input',
      message: '上传参数不正确。',
    };
  }

  const input = value as Record<string, unknown>;
  let connectionId: string;

  try {
    connectionId = parseSiteConnectionId(input.connectionId);
  } catch {
    return {
      code: 'invalid_input',
      message: '站点连接 ID 格式不正确。',
    };
  }

  const targetFolderId = String(input.targetFolderId ?? '0');

  if (targetFolderId.length > 32 || !/^\d+$/.test(targetFolderId)) {
    return {
      code: 'invalid_input',
      message: '目标目录参数不正确。',
    };
  }

  return { connectionId, targetFolderId };
}

function parseDroppedUpload(value: unknown): DroppedUploadRequest | DriveError {
  const input = parseUploadInput(value);

  if (isDriveError(input)) {
    return input;
  }

  const record = value as Record<string, unknown>;
  const rawPaths = Array.isArray(record.filePaths) ? record.filePaths : [];

  if (rawPaths.length === 0 || rawPaths.length > MAX_DROPPED_FILES) {
    return {
      code: 'invalid_input',
      message: '没有可上传的文件。',
    };
  }

  const filePaths = rawPaths.flatMap((filePath) => {
    if (typeof filePath !== 'string') {
      return [];
    }

    const normalized = filePath.trim();

    return normalized &&
      normalized.length <= MAX_FILE_PATH_LENGTH &&
      path.isAbsolute(normalized) &&
      !normalized.includes('\0')
      ? [normalized]
      : [];
  });

  if (filePaths.length === 0) {
    return {
      code: 'invalid_input',
      message: '拖入的文件路径无效。',
    };
  }

  return { input, filePaths };
}

async function validateDroppedFiles(
  filePaths: readonly string[],
): Promise<readonly UploadFile[] | DriveError> {
  const files: UploadFile[] = [];
  const seen = new Set<string>();

  for (const filePath of filePaths) {
    if (seen.has(filePath)) {
      continue;
    }

    seen.add(filePath);

    try {
      const fileInfo = await lstat(filePath);

      if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
        continue;
      }

      files.push({
        path: filePath,
        name: path.basename(filePath),
      });
    } catch {
      // Ignore paths that disappeared or are no longer readable.
    }
  }

  return files.length > 0
    ? files
    : {
        code: 'invalid_input',
        message: '拖入的文件不可读取，或不是普通文件。',
      };
}

async function pickAndUpload(
  event: Electron.IpcMainInvokeEvent,
  value: unknown,
): Promise<DriveResult<DriveUploadResult>> {
  const input = parseUploadInput(value);

  if (isDriveError(input)) {
    return { ok: false, error: input };
  }

  const siteSession = await getAccountSession(input.connectionId);

  if (isDriveError(siteSession)) {
    return { ok: false, error: siteSession };
  }

  const parent = getMainWindow();
  const selection = parent
    ? await dialog.showOpenDialog(parent, {
        title: '选择要上传到 115 网盘的文件',
        buttonLabel: '上传',
        properties: ['openFile', 'multiSelections'],
      })
    : await dialog.showOpenDialog({
        title: '选择要上传到 115 网盘的文件',
        buttonLabel: '上传',
        properties: ['openFile', 'multiSelections'],
      });

  if (selection.canceled || selection.filePaths.length === 0) {
    return {
      ok: true,
      data: {
        canceled: true,
        uploaded: 0,
        failed: 0,
        files: [],
      },
    };
  }

  const files = selection.filePaths.map((filePath) => ({
    path: filePath,
    name: path.basename(filePath),
  }));

  return upload115Files(
    siteSession,
    input.targetFolderId,
    files,
    (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IpcChannel.DriveUploadProgress, progress);
      }
    },
  );
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

  ipcMain.handle(
    IpcChannel.CreateDriveFolder,
    async (_event, input: unknown) => {
      try {
        return await create115Folder(input);
      } catch (error) {
        return unexpectedFailure('create the 115 folder', error);
      }
    },
  );

  ipcMain.handle(
    IpcChannel.RenameDriveEntry,
    async (_event, input: unknown) => {
      try {
        return await rename115Entry(input);
      } catch (error) {
        return unexpectedFailure('rename the 115 entry', error);
      }
    },
  );

  ipcMain.handle(
    IpcChannel.DeleteDriveEntry,
    async (_event, input: unknown) => {
      try {
        return await delete115Entry(input);
      } catch (error) {
        return unexpectedFailure('delete the 115 entry', error);
      }
    },
  );

  ipcMain.handle(IpcChannel.MoveDriveEntry, async (_event, input: unknown) => {
    try {
      return await move115Entry(input);
    } catch (error) {
      return unexpectedFailure('move the 115 entry', error);
    }
  });

  ipcMain.handle(IpcChannel.UploadDriveFiles, async (event, input: unknown) => {
    try {
      return await pickAndUpload(event, input);
    } catch (error) {
      return unexpectedFailure('upload files to 115', error);
    }
  });

  ipcMain.handle(
    IpcChannel.UploadDroppedDriveFiles,
    async (event, input: unknown) => {
      try {
        const request = parseDroppedUpload(input);

        if (isDriveError(request)) {
          return { ok: false, error: request };
        }

        const siteSession = await getAccountSession(request.input.connectionId);

        if (isDriveError(siteSession)) {
          return { ok: false, error: siteSession };
        }

        const files = await validateDroppedFiles(request.filePaths);

        if (isDriveError(files)) {
          return { ok: false, error: files };
        }

        return upload115Files(
          siteSession,
          request.input.targetFolderId,
          files,
          (progress) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IpcChannel.DriveUploadProgress, progress);
            }
          },
        );
      } catch (error) {
        return unexpectedFailure('upload dropped files to 115', error);
      }
    },
  );
}
