import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppInfo } from '@shared/ipc';

type AppInfoState =
  | { status: 'loading' }
  | { status: 'success'; data: AppInfo }
  | { status: 'error'; message: string };

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '无法读取运行环境，请稍后重试。';
}

export function useAppInfo() {
  const [state, setState] = useState<AppInfoState>({ status: 'loading' });
  const requestSequence = useRef(0);

  const loadAppInfo = useCallback(async () => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;

    try {
      if (typeof window.desktop?.getAppInfo !== 'function') {
        throw new Error('Preload 桥接未加载，请重启应用。');
      }

      const data = await window.desktop.getAppInfo();

      if (requestSequence.current === requestId) {
        setState({ status: 'success', data });
      }
    } catch (error: unknown) {
      if (requestSequence.current === requestId) {
        setState({ status: 'error', message: toErrorMessage(error) });
      }
    }
  }, []);

  useEffect(() => {
    void loadAppInfo();

    return () => {
      // Invalidate an in-flight request when the component unmounts.
      requestSequence.current += 1;
    };
  }, [loadAppInfo]);

  const retry = () => {
    setState({ status: 'loading' });
    void loadAppInfo();
  };

  return { state, retry };
}
