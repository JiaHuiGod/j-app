import path from 'node:path';
import { BrowserWindow, dialog, ipcMain, type WebContents } from 'electron';
import { IpcChannel } from '@shared/ipc';
import type {
  LocalVideoFolderError,
  LocalVideoFolderSnapshot,
  LocalVideoLibrary,
  LocalVideoResult,
  LocalVideoScanProgress,
} from '@shared/local-video';
import {
  addLocalVideoDirectories,
  getLocalVideoDirectories,
  removeLocalVideoDirectory,
} from '../settings/store';
import {
  getLocalVideoRecord,
  removeLocalVideoRecord,
  storeLocalVideoRecord,
} from './registry';
import {
  LocalVideoScanCanceledError,
  localVideoLibraryId,
  scanLocalVideoFolder,
} from './scanner';
import { readLocalVideoSubtitles } from './subtitles';

let currentScanController: AbortController | null = null;
let lastSnapshot: LocalVideoFolderSnapshot | null = null;
const knownDirectories = new Map<string, string>();

function getSenderWindow(sender: WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(sender);
}

function showProgress(
  sender: WebContents,
  progress: LocalVideoScanProgress,
): void {
  if (!sender.isDestroyed()) {
    sender.send(IpcChannel.LocalVideoScanProgress, progress);
  }
}

async function scanDirectories(
  sender: WebContents,
  directories: readonly string[],
  controller: AbortController,
): Promise<LocalVideoFolderSnapshot> {
  const libraries: LocalVideoLibrary[] = [];
  const errors: LocalVideoFolderError[] = [];

  for (const [index, directory] of directories.entries()) {
    if (controller.signal.aborted) {
      throw new LocalVideoScanCanceledError();
    }

    const folderName = path.basename(directory) || directory;
    const libraryId = localVideoLibraryId(directory);
    knownDirectories.set(libraryId, directory);

    try {
      const result = await scanLocalVideoFolder(
        directory,
        (progress) => {
          showProgress(sender, progress);
        },
        controller.signal,
        {
          folderName,
          folderIndex: index + 1,
          folderCount: directories.length,
        },
      );

      storeLocalVideoRecord({
        library: result.library,
        rootPath: directory,
        videos: result.videos,
        posters: result.posters,
      });
      libraries.push(result.library);
    } catch (error) {
      if (
        error instanceof LocalVideoScanCanceledError ||
        controller.signal.aborted
      ) {
        throw error;
      }

      errors.push({
        libraryId,
        folderName,
        message:
          error instanceof Error
            ? error.message
            : '文件夹扫描失败，请稍后重试。',
      });
    }
  }

  return { libraries, errors };
}

async function scanSavedLibraries(
  sender: WebContents,
): Promise<LocalVideoResult<LocalVideoFolderSnapshot>> {
  currentScanController?.abort();

  const controller = new AbortController();
  currentScanController = controller;

  try {
    const directories = await getLocalVideoDirectories();
    const snapshot = await scanDirectories(sender, directories, controller);
    lastSnapshot = snapshot;

    return { ok: true, data: snapshot };
  } catch (error) {
    if (
      error instanceof LocalVideoScanCanceledError ||
      controller.signal.aborted
    ) {
      return { ok: false, error: '本地视频扫描已取消。' };
    }

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : '本地视频扫描失败，请稍后重试。',
    };
  } finally {
    if (currentScanController === controller) {
      currentScanController = null;
    }
  }
}

async function chooseFolders(
  sender: WebContents,
): Promise<LocalVideoResult<LocalVideoFolderSnapshot | null>> {
  const parent = getSenderWindow(sender);
  const options: Electron.OpenDialogOptions = {
    title: '选择本地视频文件夹',
    properties: ['openDirectory', 'multiSelections'],
  };
  const selection = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);

  if (selection.canceled || selection.filePaths.length === 0) {
    return { ok: true, data: null };
  }

  try {
    await addLocalVideoDirectories(selection.filePaths);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '无法保存本地视频目录。',
    };
  }

  return scanSavedLibraries(sender);
}

async function removeFolder(
  libraryId: string,
): Promise<LocalVideoResult<LocalVideoFolderSnapshot>> {
  const record = getLocalVideoRecord(libraryId);
  const directory = record?.rootPath ?? knownDirectories.get(libraryId);

  if (!directory) {
    return { ok: false, error: '没有找到要删除的文件夹。' };
  }

  try {
    await removeLocalVideoDirectory(directory);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : '无法删除本地视频文件夹。',
    };
  }

  removeLocalVideoRecord(libraryId);
  knownDirectories.delete(libraryId);

  const snapshot: LocalVideoFolderSnapshot = {
    libraries:
      lastSnapshot?.libraries.filter((library) => library.id !== libraryId) ??
      [],
    errors:
      lastSnapshot?.errors.filter((error) => error.libraryId !== libraryId) ??
      [],
  };
  lastSnapshot = snapshot;

  return { ok: true, data: snapshot };
}

export function registerLocalVideoIpcHandlers(): void {
  ipcMain.handle(IpcChannel.ChooseLocalVideoFolders, (event) =>
    chooseFolders(event.sender),
  );
  ipcMain.handle(IpcChannel.LoadLocalVideoLibraries, (event) =>
    scanSavedLibraries(event.sender),
  );
  ipcMain.handle(IpcChannel.RescanLocalVideoFolders, (event) =>
    scanSavedLibraries(event.sender),
  );
  ipcMain.handle(
    IpcChannel.RemoveLocalVideoFolder,
    (_event, libraryId: unknown) => {
      if (typeof libraryId !== 'string' || !libraryId.trim()) {
        return {
          ok: false,
          error: '文件夹参数不正确。',
        } satisfies LocalVideoResult<LocalVideoFolderSnapshot>;
      }

      return removeFolder(libraryId.trim());
    },
  );
  ipcMain.handle(
    IpcChannel.GetLocalVideoSubtitles,
    async (_event, input: unknown) => {
      if (typeof input !== 'object' || input === null) {
        return { ok: false, error: '字幕参数不正确。' };
      }

      const record = input as Record<string, unknown>;
      const libraryId =
        typeof record.libraryId === 'string' ? record.libraryId : '';
      const videoId = typeof record.videoId === 'string' ? record.videoId : '';
      const library = getLocalVideoRecord(libraryId);
      const videoPath = library?.videos.get(videoId);

      if (!videoPath) {
        return { ok: false, error: '没有找到对应的本地视频。' };
      }

      return {
        ok: true,
        data: await readLocalVideoSubtitles(videoPath),
      };
    },
  );
  ipcMain.handle(IpcChannel.CancelLocalVideoScan, () => {
    currentScanController?.abort();
  });
}
