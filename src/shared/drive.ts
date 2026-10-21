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
