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

const secondLibrary: LocalVideoLibrary = {
  id: 'library-movies',
  name: 'Movies',
  scannedAt: '2026-10-22T12:00:00.000Z',
  truncated: false,
  videos: [
    {
      id: 'video-charlie',
      title: 'Charlie',
      fileName: 'Charlie.mp4',
      libraryId: 'library-movies',
      libraryName: 'Movies',
      relativePath: 'Charlie.mp4',
      extension: 'mp4',
      size: 4096,
      modifiedAt: '2026-10-22T12:00:00.000Z',
      videoUrl: 'japp-local://video/library-movies/video-charlie',
      posters: [],
    },
  ],
};

const thirdLibrary: LocalVideoLibrary = {
  id: 'library-extras',
  name: 'Extras',
  scannedAt: '2026-10-22T12:00:00.000Z',
  truncated: false,
  videos: [
    {
      id: 'video-delta',
      title: 'Delta',
      fileName: 'Delta.mp4',
      libraryId: 'library-extras',
      libraryName: 'Extras',
      relativePath: 'Delta.mp4',
      extension: 'mp4',
      size: 8192,
      modifiedAt: '2026-10-22T12:00:00.000Z',
      videoUrl: 'japp-local://video/library-extras/video-delta',
      posters: [],
    },
  ],
};

const multiFolderSnapshot: LocalVideoFolderSnapshot = {
  libraries: [library, secondLibrary, thirdLibrary],
  errors: [],
};

let activeSnapshot: LocalVideoFolderSnapshot = snapshot;

describe('LocalVideoPage', () => {
  beforeEach(() => {
    activeSnapshot = snapshot;
    window.localStorage.clear();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});

    const localVideo: LocalVideoApi = {
      chooseFolders: vi
        .fn<LocalVideoApi['chooseFolders']>()
        .mockImplementation(async () => ({ ok: true, data: activeSnapshot })),
      loadLibraries: vi
        .fn<LocalVideoApi['loadLibraries']>()
        .mockImplementation(async () => ({ ok: true, data: activeSnapshot })),
      rescan: vi
        .fn<LocalVideoApi['rescan']>()
        .mockImplementation(async () => ({ ok: true, data: activeSnapshot })),
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

  const renderPage = () => {
    render(
      <GlobalVideoPlayerProvider>
        <LocalVideoProvider>
          <LocalVideoPage />
        </LocalVideoProvider>
      </GlobalVideoPlayerProvider>,
    );
  };

  it('filters videos by one or multiple folders', async () => {
    activeSnapshot = multiFolderSnapshot;
    renderPage();

    await screen.findByRole('button', { name: '播放 Delta' });
    expect(screen.getByText('4 个视频')).toBeDefined();

    const videosFilter = screen.getByRole('button', {
      name: '筛选文件夹 Videos',
    });
    const allFilter = screen.getByRole('button', { name: '全部' });

    expect(allFilter.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(videosFilter);

    expect(screen.getByRole('button', { name: '播放 Alpha' })).toBeDefined();
    expect(screen.getByRole('button', { name: '播放 Bravo' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '播放 Charlie' })).toBeNull();
    expect(screen.queryByRole('button', { name: '播放 Delta' })).toBeNull();
    expect(screen.getByText('2 / 4 个视频')).toBeDefined();
    expect(videosFilter.getAttribute('aria-pressed')).toBe('true');
    expect(allFilter.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: '筛选文件夹 Movies' }));

    expect(screen.getByRole('button', { name: '播放 Charlie' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '播放 Delta' })).toBeNull();
    expect(screen.getByText('3 / 4 个视频')).toBeDefined();
    expect(screen.getByText('已选 2 / 3 个文件夹')).toBeDefined();

    fireEvent.click(allFilter);

    expect(screen.getByRole('button', { name: '播放 Delta' })).toBeDefined();
    expect(screen.getByText('4 个视频')).toBeDefined();
    expect(allFilter.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps grouping while switching between grid and list cards', async () => {
    activeSnapshot = multiFolderSnapshot;
    renderPage();

    await screen.findByRole('button', { name: '播放 Delta' });

    const groupToggle = screen.getByRole('button', {
      name: '按文件夹分组',
    });

    expect(groupToggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(groupToggle);

    expect(window.localStorage.getItem('japp.local-group.v1')).toBe('1');
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Videos', 'Movies', 'Extras']);
    expect(document.querySelectorAll('[class*="gridCover"]').length).toBe(4);
    expect(document.querySelectorAll('[class*="listCover"]').length).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: '列表视图' }));

    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Videos', 'Movies', 'Extras']);
    expect(screen.getByRole('button', { name: '按文件夹分组' })).toBeDefined();
    expect(document.querySelectorAll('[class*="listCover"]').length).toBe(4);
    expect(document.querySelectorAll('[class*="gridCover"]').length).toBe(0);

    const search = screen.getByRole('searchbox', {
      name: '搜索本地视频',
    });

    fireEvent.change(search, { target: { value: 'Charlie' } });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Videos' })).toBeNull();
    });
    expect(screen.getByRole('button', { name: '播放 Charlie' })).toBeDefined();

    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '筛选文件夹 Videos' }));

    expect(screen.queryByRole('heading', { name: 'Videos' })).toBeNull();
    expect(screen.getByRole('button', { name: '播放 Alpha' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '播放 Charlie' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    fireEvent.click(screen.getByRole('button', { name: '网格视图' }));

    expect(screen.getByRole('button', { name: '按文件夹分组' })).toBeDefined();
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Videos', 'Movies', 'Extras']);
    expect(document.querySelectorAll('[class*="gridCover"]').length).toBe(4);
    expect(document.querySelectorAll('[class*="listCover"]').length).toBe(0);
  });

  it('scopes the player playlist to the filtered folders', async () => {
    activeSnapshot = multiFolderSnapshot;
    renderPage();

    await screen.findByRole('button', { name: '播放 Alpha' });
    fireEvent.click(screen.getByRole('button', { name: '筛选文件夹 Videos' }));
    fireEvent.click(screen.getByRole('button', { name: '播放 Alpha' }));

    const dialog = await screen.findByRole('dialog', {
      name: /播放 Alpha/,
    });

    fireEvent.click(
      within(dialog).getByRole('button', { name: '展开播放列表' }),
    );

    const playlist = within(dialog).getByRole('complementary', {
      name: '播放列表',
    });

    expect(within(playlist).getByText('Alpha')).toBeDefined();
    expect(within(playlist).getByText('Bravo')).toBeDefined();
    expect(within(playlist).queryByText('Charlie')).toBeNull();
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
