import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPlayerDialog } from './VideoPlayerDialog';
import type {
  VideoPlayerDialogProps,
  VideoPlaylistItem,
  VideoSubtitleTrack,
} from './types';

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

const playlist: readonly VideoPlaylistItem[] = [
  { id: 'a', title: 'Alpha.mp4', displayTitle: 'Alpha' },
  { id: 'b', title: 'Bravo.mp4', displayTitle: 'Bravo' },
  { id: 'c', title: 'Charlie.mp4', displayTitle: 'Charlie' },
];

const subtitleTracks: readonly VideoSubtitleTrack[] = [
  {
    id: 'zh',
    label: 'alpha.zh-CN.srt',
    content: `1
00:00:01,000 --> 00:00:05,000
第一句字幕
`,
    format: 'srt',
  },
  {
    id: 'en',
    label: 'alpha.en.srt',
    content: `1
00:00:01,000 --> 00:00:05,000
First subtitle
`,
    format: 'srt',
  },
];

function createProps(
  overrides: Partial<VideoPlayerDialogProps> = {},
): VideoPlayerDialogProps {
  return {
    title: 'Alpha.mp4',
    source: {
      url: 'http://127.0.0.1:9999/p/session-a/master.m3u8',
      width: 1920,
      height: 1080,
    },
    playlist,
    activeId: 'a',
    subtitleTracks: [],
    resumePosition: null,
    onProgress: vi.fn<VideoPlayerDialogProps['onProgress']>(),
    onEnded: vi.fn<VideoPlayerDialogProps['onEnded']>(),
    onSelectPlaylist: vi.fn<VideoPlayerDialogProps['onSelectPlaylist']>(),
    onRetry: vi.fn<VideoPlayerDialogProps['onRetry']>(),
    onClose: vi.fn<VideoPlayerDialogProps['onClose']>(),
    ...overrides,
  };
}

function duration(video: HTMLVideoElement, seconds: number): void {
  Object.defineProperty(video, 'duration', {
    configurable: true,
    value: seconds,
  });
}

function videoElement(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector('video');

  if (!video) {
    throw new Error('video element was not rendered');
  }

  return video;
}

function openPlaylistDrawer(): void {
  fireEvent.click(screen.getByRole('button', { name: '展开播放列表' }));
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1200,
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VideoPlayerDialog', () => {
  it('keeps the video mounted while toggling the playlist drawer', () => {
    const { container } = render(<VideoPlayerDialog {...createProps()} />);
    const video = videoElement(container);
    const drawer = screen.getByLabelText('播放列表与字幕');

    expect(
      screen
        .getByRole('button', { name: '展开播放列表' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Playlist')).toBeDefined();
    expect(screen.getByText('播放列表')).toBeDefined();
    expect(screen.queryByRole('button', { name: /上一集|下一集/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '展开播放列表' }));

    expect(
      screen
        .getByRole('button', { name: '收起播放列表' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      screen.getByLabelText('播放列表与字幕').getAttribute('aria-hidden'),
    ).toBe('false');
    expect(videoElement(container)).toBe(video);

    fireEvent.click(screen.getByRole('button', { name: '收起播放列表' }));

    expect(
      screen
        .getByRole('button', { name: '展开播放列表' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(
      screen.getByLabelText('播放列表与字幕').getAttribute('aria-hidden'),
    ).toBe('true');
    expect(videoElement(container)).toBe(video);
  });

  it('emits playlist selection without closing the dialog', () => {
    const onSelectPlaylist =
      vi.fn<VideoPlayerDialogProps['onSelectPlaylist']>();
    const onClose = vi.fn<VideoPlayerDialogProps['onClose']>();
    const { container, rerender } = render(
      <VideoPlayerDialog {...createProps({ onClose, onSelectPlaylist })} />,
    );
    const dialog = container.querySelector('dialog');

    openPlaylistDrawer();
    fireEvent.click(screen.getByTitle('Bravo.mp4'));

    expect(onSelectPlaylist).toHaveBeenCalledWith('b');
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('dialog')).toBe(dialog);

    rerender(
      <VideoPlayerDialog
        {...createProps({
          activeId: 'b',
          onClose,
          onSelectPlaylist,
          source: {
            url: 'http://127.0.0.1:9999/p/session-b/master.m3u8',
            width: 1280,
            height: 720,
          },
          title: 'Bravo.mp4',
        })}
      />,
    );

    expect(container.querySelector('dialog')).toBe(dialog);
    expect(dialog?.getAttribute('aria-label')).toBe('播放 Bravo.mp4');
  });

  it('renders subtitle selection, toggle, delay, and cue text', () => {
    const { container } = render(
      <VideoPlayerDialog {...createProps({ subtitleTracks })} />,
    );
    const video = videoElement(container);

    duration(video, 100);
    openPlaylistDrawer();

    expect(
      screen.getByRole('option', { name: 'alpha.zh-CN.srt' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: '关闭字幕' })).toBeDefined();

    video.currentTime = 2;
    fireEvent.timeUpdate(video);
    expect(screen.getByText('第一句字幕')).toBeDefined();

    fireEvent.change(screen.getByLabelText('选择字幕'), {
      target: { value: '1' },
    });
    fireEvent.timeUpdate(video);
    expect(screen.getByText('First subtitle')).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: '字幕延迟增加 0.5 秒' }),
    );
    expect(screen.getByText('0.5s')).toBeDefined();
    video.currentTime = 1.2;
    fireEvent.timeUpdate(video);
    expect(screen.queryByText('First subtitle')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: '字幕延迟减少 0.5 秒' }),
    );
    expect(screen.getByText('0.0s')).toBeDefined();
    fireEvent.timeUpdate(video);
    expect(screen.getByText('First subtitle')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '关闭字幕' }));
    expect(screen.queryByText('First subtitle')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '开启字幕' }));
    fireEvent.timeUpdate(video);
    expect(screen.getByText('First subtitle')).toBeDefined();
  });

  it('applies resume position and can restart from the beginning', () => {
    const { container } = render(
      <VideoPlayerDialog {...createProps({ resumePosition: 125 })} />,
    );
    const video = videoElement(container);

    duration(video, 3600);
    fireEvent.loadedMetadata(video);

    expect(screen.getByText(/继续观看 · 2:05/)).toBeDefined();
    expect(video.currentTime).toBe(125);

    fireEvent.click(screen.getByRole('button', { name: '从头播放' }));

    expect(video.currentTime).toBe(0);
    expect(screen.queryByText(/继续观看 · 2:05/)).toBeNull();
  });

  it('shows an external error and recovers after retry', () => {
    const onRetry = vi.fn<VideoPlayerDialogProps['onRetry']>();
    const { rerender } = render(
      <VideoPlayerDialog
        {...createProps({ error: '无法获取播放地址。', onRetry })}
      />,
    );

    expect(screen.getByText('无法获取播放地址。')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '重新获取播放地址' }));

    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <VideoPlayerDialog
        {...createProps({
          error: null,
          onRetry,
          source: {
            url: 'http://127.0.0.1:9999/p/session-a-retry/master.m3u8',
            width: 1920,
            height: 1080,
          },
        })}
      />,
    );

    expect(screen.queryByText('无法获取播放地址。')).toBeNull();
  });

  it('reports progress before pause, end, switch, and close', () => {
    const progress = vi.fn<VideoPlayerDialogProps['onProgress']>();
    const ended = vi.fn<VideoPlayerDialogProps['onEnded']>();
    const select = vi.fn<VideoPlayerDialogProps['onSelectPlaylist']>();
    const close = vi.fn<VideoPlayerDialogProps['onClose']>();
    const { container } = render(
      <VideoPlayerDialog
        {...createProps({
          onClose: close,
          onEnded: ended,
          onProgress: progress,
          onSelectPlaylist: select,
        })}
      />,
    );
    const video = videoElement(container);

    duration(video, 100);
    fireEvent.loadedMetadata(video);
    openPlaylistDrawer();
    video.currentTime = 42;
    fireEvent.pause(video);

    expect(progress).toHaveBeenLastCalledWith(42, 100);

    fireEvent.ended(video);

    expect(ended).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenLastCalledWith(42, 100);

    video.currentTime = 50;
    fireEvent.click(screen.getByTitle('Bravo.mp4'));

    expect(select).toHaveBeenCalledWith('b');
    expect(progress).toHaveBeenLastCalledWith(50, 100);

    fireEvent.click(screen.getByRole('button', { name: '关闭播放器' }));

    expect(close).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenLastCalledWith(50, 100);
    expect(progress.mock.invocationCallOrder.at(-1)).toBeLessThan(
      close.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
