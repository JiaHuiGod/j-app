import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppInfo, DesktopApi } from '@shared/ipc';
import App from './App';

const appInfo: AppInfo = {
  appName: 'J App',
  appVersion: '0.1.0',
  electronVersion: '44.9.1',
  chromeVersion: '144.0.0.0',
  nodeVersion: '24.0.0',
  platform: 'win32',
  arch: 'x64',
  isPackaged: false,
};

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('renders the window chrome and reads app info through the preload API', async () => {
    const getAppInfo = vi
      .fn<() => Promise<AppInfo>>()
      .mockResolvedValue(appInfo);
    const toggleMaximize = vi.fn<() => void>();
    const windowControls: DesktopApi['windowControls'] = {
      minimize: vi.fn<() => void>(),
      toggleMaximize,
      close: vi.fn<() => void>(),
      isMaximized: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
      onMaximizedChange: vi
        .fn<(listener: (isMaximized: boolean) => void) => () => void>()
        .mockReturnValue(() => {}),
    };
    const desktopApi: DesktopApi = {
      platform: 'win32',
      getAppInfo,
      windowControls,
    };

    Object.defineProperty(window, 'desktop', {
      configurable: true,
      value: desktopApi,
    });

    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: /构建可靠的桌面应用/ }),
    ).toBeDefined();
    expect(screen.getByText('概览')).toBeDefined();
    expect(await screen.findByText(appInfo.electronVersion)).toBeDefined();
    expect(screen.getByText('Preload bridge 已连接')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '最大化' }));

    expect(toggleMaximize).toHaveBeenCalledOnce();
    expect(getAppInfo).toHaveBeenCalledOnce();
  });
});
