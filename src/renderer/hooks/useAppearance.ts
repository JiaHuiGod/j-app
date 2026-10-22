import { useCallback, useEffect, useRef, useState } from 'react';
import type { ThemePreference } from '@shared/appearance';
import { toErrorMessage } from '../lib/errors';

export interface AppearanceController {
  readonly preference: ThemePreference;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly error: string;
  readonly setPreference: (preference: ThemePreference) => Promise<void>;
}

export function useAppearance(): AppearanceController {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const preferenceRef = useRef<ThemePreference>('system');
  const isMountedRef = useRef(true);
  const isSavingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    void window.desktop.appearance
      .get()
      .then((state) => {
        if (isMountedRef.current) {
          preferenceRef.current = state.preference;
          setPreferenceState(state.preference);
        }
      })
      .catch((loadFailure: unknown) => {
        if (isMountedRef.current) {
          setError(
            toErrorMessage(loadFailure, '无法读取主题设置，请稍后重试。'),
          );
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setPreference = useCallback(
    async (nextPreference: ThemePreference): Promise<void> => {
      if (isSavingRef.current || nextPreference === preferenceRef.current) {
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      setError('');

      try {
        const state = await window.desktop.appearance.setTheme(nextPreference);

        if (isMountedRef.current) {
          preferenceRef.current = state.preference;
          setPreferenceState(state.preference);
        }
      } catch (saveFailure: unknown) {
        if (isMountedRef.current) {
          setError(toErrorMessage(saveFailure, '主题切换失败，请稍后重试。'));
        }
      } finally {
        isSavingRef.current = false;

        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [],
  );

  return {
    error,
    isLoading,
    isSaving,
    preference,
    setPreference,
  };
}
