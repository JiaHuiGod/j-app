import type { SiteConnectionStatus } from './connections';

export type DriveProvider = '115';

export type DriveErrorCode =
  | 'no_account'
  | 'auth_required'
  | 'invalid_input'
  | 'network'
  | 'api';

export interface DriveError {
  readonly code: DriveErrorCode;
  readonly message: string;
}

export type DriveResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: DriveError };

export interface DriveAccount {
  readonly connectionId: string;
  readonly name: string;
  readonly loginUrl: string;
  readonly provider: DriveProvider;
  readonly status: SiteConnectionStatus;
  readonly cookieCount: number;
}

export interface DriveBreadcrumb {
  readonly id: string;
  readonly name: string;
}

export interface DriveEntry {
  readonly id: string;
  readonly parentId: string;
  readonly name: string;
  readonly kind: 'file' | 'folder';
  readonly size: number | null;
  readonly modifiedAt: string | null;
  readonly extension: string | null;
  readonly durationSeconds: number | null;
}

export interface DriveListInput {
  readonly connectionId: string;
  readonly folderId: string;
  readonly offset: number;
  readonly limit: number;
}

export interface DriveListing {
  readonly accountId: string;
  readonly folderId: string;
  readonly breadcrumbs: readonly DriveBreadcrumb[];
  readonly entries: readonly DriveEntry[];
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly hasMore: boolean;
}

export interface DriveSearchInput {
  readonly connectionId: string;
  readonly folderId: string;
  readonly query: string;
  readonly offset: number;
  readonly limit: number;
}

export interface DriveSearchResult {
  readonly query: string;
  readonly entries: readonly DriveEntry[];
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly hasMore: boolean;
}

export interface DriveCreateFolderInput {
  readonly connectionId: string;
  readonly parentId: string;
  readonly name: string;
}

export interface DriveRenameInput {
  readonly connectionId: string;
  readonly entryId: string;
  readonly kind: 'file' | 'folder';
  readonly name: string;
}

export interface DriveDeleteTarget {
  readonly entryId: string;
  readonly parentId: string;
}

export interface DriveDeleteInput {
  readonly connectionId: string;
  readonly entries: readonly DriveDeleteTarget[];
}

export interface DriveMoveInput {
  readonly connectionId: string;
  readonly entryIds: readonly string[];
  readonly targetFolderId: string;
}

export interface DriveUploadInput {
  readonly connectionId: string;
  readonly targetFolderId: string;
}

export interface DriveDroppedUploadInput extends DriveUploadInput {
  readonly filePaths: readonly string[];
}

export interface DriveUploadFileResult {
  readonly name: string;
  readonly status: 'success' | 'failed';
  readonly message?: string;
}

export interface DriveUploadResult {
  readonly canceled: boolean;
  readonly uploaded: number;
  readonly failed: number;
  readonly files: readonly DriveUploadFileResult[];
}

export interface DriveUploadProgress {
  readonly uploadId: string;
  readonly fileName: string;
  readonly fileIndex: number;
  readonly fileCount: number;
  readonly uploadedBytes: number;
  readonly totalBytes: number;
  readonly status: 'uploading' | 'success' | 'failed';
  readonly error?: string;
}

export type DriveOfflineTaskStatus =
  | 'downloading'
  | 'failed'
  | 'finished'
  | 'paused'
  | 'pending'
  | 'unknown';

export interface DriveOfflineTask {
  readonly id: string;
  readonly name: string;
  readonly size: number | null;
  readonly progress: number;
  readonly rate: number;
  readonly status: DriveOfflineTaskStatus;
  readonly statusText: string;
  readonly targetFolderId: string | null;
  readonly addedAt: string | null;
  readonly sourceUrl: string;
}

export interface DriveOfflineTaskList {
  readonly tasks: readonly DriveOfflineTask[];
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
}

export interface DriveOfflineListInput {
  readonly connectionId: string;
  readonly page?: number;
}

export interface DriveOfflineAddInput {
  readonly connectionId: string;
  readonly folderId: string;
  readonly urls: readonly string[];
}

export interface DriveOfflineAddError {
  readonly url: string;
  readonly message: string;
}

export interface DriveOfflineAddResult {
  readonly successCount: number;
  readonly failedCount: number;
  readonly errors: readonly DriveOfflineAddError[];
}
