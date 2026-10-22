import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GlobalVideoPlayerProvider,
  useGlobalVideoPlayer,
  type GlobalVideoPlayerRequest,
} from './GlobalVideoPlayerProvider';

vi.mock('hls.js', () => {
  class MockHls {
    static isSupported = () => true;
    static Events = { ERROR: 'hls-error' };
    static ErrorTypes = {
      MEDIA_ERROR: 'mediaError',
      NETWORK_ERROR: 'networkError',
    };

    readonly loadSource = vi.fn<(url: string) => void>();
    readonly attachMedia = vi.fn<(media: HTMLMediaElement) => void>();
    readonly destroy = vi.fn<() => void>();
    readonly on =
      vi.fn<(event: string, listener: (...args: unknown[]) => void) => void>();
  }

  return { default: MockHls };
});

let genericPlayer: GlobalVideoPlayerRequest;

function GenericPlayerTrigger() {
  const { showPlayer } = useGlobalVideoPlayer();

  return (
    <button
      type="button"
      onClick={() => {
        showPlayer(genericPlayer);
      }}
    >
      打开通用播放器
    </button>
  );
}

describe('GlobalVideoPlayerProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    genericPlayer = {
      title: 'Generic.mp4',
      shortTitle: 'Generic',
      source: {
        url: 'http://127.0.0.1:9999/generic/master.m3u8',
        width: 1920,
        height: 1080,
      },
      playlist: [{ id: 'generic', title: 'Generic.mp4' }],
      activeId: 'generic',
      subtitleTracks: [],
      resumePosition: null,
      onClose: vi.fn<GlobalVideoPlayerRequest['onClose']>(),
      onEnded: vi.fn<GlobalVideoPlayerRequest['onEnded']>(),
      onProgress: vi.fn<GlobalVideoPlayerRequest['onProgress']>(),
      onRetry: vi.fn<GlobalVideoPlayerRequest['onRetry']>(),
      onSelectPlaylist: vi.fn<GlobalVideoPlayerRequest['onSelectPlaylist']>(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('minimizes and restores any player shown through the global host', async () => {
    render(
      <GlobalVideoPlayerProvider>
        <GenericPlayerTrigger />
      </GlobalVideoPlayerProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '打开通用播放器' }));

    const dialog = await screen.findByRole('dialog', {
      name: /播放 Generic\.mp4/,
    });

    fireEvent.click(
      within(dialog).getByRole('button', { name: '最小化播放器' }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /播放 Generic\.mp4/ }),
      ).toBeNull();
    });
    expect(
      screen.getByRole('button', { name: '恢复播放 Generic.mp4' }),
    ).toBeDefined();
    expect(screen.getByText('Generic')).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: '恢复播放 Generic.mp4' }),
    );

    const restoredDialog = await screen.findByRole('dialog', {
      name: /播放 Generic\.mp4/,
    });

    fireEvent.click(
      within(restoredDialog).getByRole('button', { name: '关闭播放器' }),
    );

    await waitFor(() => {
      expect(genericPlayer.onClose).toHaveBeenCalledOnce();
    });
    expect(
      screen.queryByRole('dialog', { name: /播放 Generic\.mp4/ }),
    ).toBeNull();
  });
});
