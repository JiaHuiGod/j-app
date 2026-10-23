export interface SiteConnection {
  readonly id: string;
  readonly name: string;
  readonly loginUrl: string;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
  readonly pinned: boolean;
}

export type SiteConnectionStatus = 'connected' | 'empty';

export interface SiteConnectionSummary extends SiteConnection {
  readonly cookieCount: number;
  readonly status: SiteConnectionStatus;
}

export interface CreateSiteConnectionInput {
  readonly name: string;
  readonly loginUrl: string;
}

export interface SetSiteConnectionPinnedInput {
  readonly connectionId: string;
  readonly pinned: boolean;
}

export interface RemoveSiteConnectionResult {
  readonly removed: boolean;
  readonly connection: SiteConnectionSummary | null;
}

export interface ClearAllSiteConnectionsResult {
  readonly clearedCount: number;
  readonly remaining: readonly SiteConnectionSummary[];
}
