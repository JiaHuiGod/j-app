export interface SiteConnection {
  readonly id: string;
  readonly name: string;
  readonly loginUrl: string;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
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
