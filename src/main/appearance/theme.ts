import { nativeTheme } from 'electron';
import type {
  AppearanceState,
  ResolvedTheme,
  ThemePreference,
} from '@shared/appearance';
import { parseThemePreference } from '../settings/schema';
import { loadSettings, saveThemePreference } from '../settings/store';

export function applyThemePreference(preference: ThemePreference): void {
  nativeTheme.themeSource = preference;
}

function getResolvedTheme(): ResolvedTheme {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

export function getWindowBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#0f1116' : '#f4f1e8';
}

export async function getAppearanceState(): Promise<AppearanceState> {
  const settings = await loadSettings();

  applyThemePreference(settings.appearance.theme);

  return {
    preference: settings.appearance.theme,
    resolved: getResolvedTheme(),
  };
}

export async function setAppearanceTheme(
  input: unknown,
): Promise<AppearanceState> {
  const preference = parseThemePreference(input);

  await saveThemePreference(preference);
  applyThemePreference(preference);

  return {
    preference,
    resolved: getResolvedTheme(),
  };
}
