export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type ResolvedTheme = 'light' | 'dark';

export interface AppearanceState {
  readonly preference: ThemePreference;
  readonly resolved: ResolvedTheme;
}
