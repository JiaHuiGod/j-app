import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LocalVideoApi,
  LocalVideoFolderSnapshot,
  LocalVideoLibrary,
} from '@shared/local-video';
import { GlobalVideoPlayerProvider } from '../../playback/GlobalVideoPlayerProvider';
import { LocalVideoPage } from './LocalVideoPage';
import { LocalVideoProvider } from './LocalVideoProvider';

const library: LocalVideoLibrary = {
  id: 'library-local',
  name: 'Videos',
  scannedAt: '2026-10-22T12:00:00.000Z',
  truncated: false,
  videos: [
    {
      id: 'video-alpha',
      title: 'Alpha',
      fileName: 'Alpha.mp4',
      libraryId: 'library-local',
      libraryName: 'Videos',
      relativePath: 'Alpha.mp4',
      extension: 'mp4',
      size: 1024,
      modifiedAt: '2026-10-21T12:00:00.000Z',
      videoUrl: 'japp-local://video/library-local/video-alpha',
      posters: [
        {
          id: 'poster-alpha-1',
          name: 'Alpha-poster.jpg',
          kind: 'poster',
          url: 'japp-local://poster/library-local/poster-alpha-1',
        },
        {
          id: 'poster-alpha-2',
          name: 'Alpha-thumb.jpg',
          kind: 'thumb',
          url: 'japp-local://poster/library-local/poster-alpha-2',
        },
      ],
    },
    {
      id: 'video-bravo',
      title: 'Bravo',
      fileName: 'Bravo.webm',
      libraryId: 'library-local',
      libraryName: 'Videos',
      relativePath: 'Season 2/Bravo.webm',
      extension: 'webm',
      size: 2048,
      modifiedAt: '2026-10-22T12:00:00.000Z',
      videoUrl: 'japp-local://video/library-local/video-bravo',
      posters: [],
    },
  ],
};

const snapshot: LocalVideoFolderSnapshot = {
  libraries: [library],
  errors: [],
};

describe('LocalVideoPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});

    const localVideo: LocalVideoApi = {
      chooseFolders: vi
        .fn<LocalVideoApi['chooseFolders']>()
        .mockResolvedValue({ ok: true, data: snapshot }),
      loadLibraries: vi
        .fn<LocalVideoApi['loadLibraries']>()
        .mockResolvedValue({ ok: true, data: snapshot }),
      rescan: vi
        .fn<LocalVideoApi['rescan']>()
        .mockResolvedValue({ ok: true, data: snapshot }),
      removeFolder: vi.fn<LocalVideoApi['removeFolder']>().mockResolvedValue({
        ok: true,
        data: { libraries: [], errors: [] },
      }),
      getSubtitles: vi.fn<LocalVideoApi['getSubtitles']>().mockResolvedValue({
        ok: true,
        data: [
          {
            id: 'subtitle-alpha',
            label: 'Alpha.zh-CN.srt',
            content: '1\n00:00:01,000 --> 00:00:02,000\n你好\n',
            format: 'srt',
          },
        ],
      }),
      cancelScan: vi
        .fn<LocalVideoApi['cancelScan']>()
        .mockResolvedValue(undefined),
      onScanProgress: vi
        .fn<LocalVideoApi['onScanProgress']>()
        .mockReturnValue(() => {}),
    };

    Object.defineProperty(window, 'desktop', {
      configurable: true,
      value: { localVideo },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('switches between poster grid and thumb list, then plays a file source', async () => {
    render(
      <GlobalVideoPlayerProvider>
        <LocalVideoProvider>
          <LocalVideoPage />
        </LocalVideoProvider>
      </GlobalVideoPlayerProvider>,
    );

    const playAlpha = await screen.findByRole('button', {
      name: '播放 Alpha',
    });

    expect(playAlpha).toBeDefined();
    expect(document.querySelector('img')?.getAttribute('src')).toBe(
      'japp-local://poster/library-local/poster-alpha-1',
    );

    fireEvent.click(screen.getByRole('button', { name: '列表视图' }));

    await waitFor(() => {
      expect(document.querySelector('img')?.getAttribute('src')).toBe(
        'japp-local://poster/library-local/poster-alpha-2',
      );
    });
    expect(window.localStorage.getItem('japp.local-view.v1')).toBe('list');
    expect(screen.getByText('Videos / Alpha.mp4')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '播放 Alpha' }));

    const dialog = await screen.findByRole('dialog', {
      name: /播放 Alpha/,
    });
    const video = dialog.querySelector('video');

    expect(video?.getAttribute('src')).toBe(
      'japp-local://video/library-local/video-alpha',
    );
    expect(video?.getAttribute('poster')).toBe(
      'japp-local://poster/library-local/poster-alpha-1',
    );

    fireEvent.click(within(dialog).getByRole('button', { name: '字幕设置' }));

    expect(
      within(dialog).getByRole('option', { name: 'Alpha.zh-CN.srt' }),
    ).toBeDefined();
  });

  it('asks for confirmation before removing a folder', async () => {
    render(
      <GlobalVideoPlayerProvider>
        <LocalVideoProvider>
          <LocalVideoPage />
        </LocalVideoProvider>
      </GlobalVideoPlayerProvider>,
    );

    await screen.findByRole('button', { name: '播放 Alpha' });
    const removeButton = screen.getByRole('button', {
      name: '移除文件夹 Videos',
    });

    fireEvent.click(removeButton);

    const dialog = await screen.findByRole('dialog', {
      name: '移除本地视频文件夹？',
    });

    expect(dialog.textContent).toContain('Videos');
    expect(dialog.textContent).toContain('不会删除磁盘上的文件');
    expect(screen.getByRole('button', { name: '播放 Alpha' })).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: '播放 Alpha' })).toBeDefined();

    fireEvent.click(removeButton);
    const confirmation = await screen.findByRole('dialog', {
      name: '移除本地视频文件夹？',
    });
    fireEvent.click(
      within(confirmation).getByRole('button', { name: '确认移除' }),
    );

    await waitFor(() => {
      expect(screen.getByText('还没有本地视频库')).toBeDefined();
    });
  });
});
