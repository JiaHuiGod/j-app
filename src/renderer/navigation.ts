export type AppPage = 'overview' | 'drive' | 'local' | 'settings';

export interface NavigationItem {
  readonly id: AppPage;
  readonly label: string;
}

/**
 * Add future pages here and register their component in App.tsx.
 */
export const NAVIGATION_ITEMS = [
  { id: 'overview', label: '概览' },
  { id: 'drive', label: '网盘' },
  { id: 'local', label: '本地' },
  { id: 'settings', label: '设置' },
] as const satisfies readonly NavigationItem[];
