import type { ThemePreference } from '@shared/appearance';

export interface ThemeOption {
  readonly value: ThemePreference;
  readonly label: string;
  readonly description: string;
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    value: 'light',
    label: '浅色',
    description: '始终使用明亮界面',
  },
  {
    value: 'dark',
    label: '深色',
    description: '始终使用暗色界面',
  },
  {
    value: 'system',
    label: '跟随系统',
    description: '随操作系统外观切换',
  },
];

export function getThemeLabel(preference: ThemePreference): string {
  return (
    THEME_OPTIONS.find((option) => option.value === preference)?.label ??
    '跟随系统'
  );
}
