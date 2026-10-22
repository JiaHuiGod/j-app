import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  LocalVideoFolderError,
  LocalVideoFolderSnapshot,
  LocalVideoItem,
  LocalVideoLibrary,
  LocalVideoResult,
  LocalVideoScanProgress,
  LocalVideoSubtitle,
} from '@shared/local-video';
import { useGlobalVideoPlayer } from '../../playback/GlobalVideoPlayerProvider';
import {
  readLocalProgress,
  saveLocalProgress,
} from './local-video-preferences';

interface LocalVideoContextValue {
  readonly libraries: readonly LocalVideoLibrary[];
  readonly videos: readonly LocalVideoItem[];
  readonly folderErrors: readonly LocalVideoFolderError[];
  readonly isScanning: boolean;
  readonly progress: LocalVideoScanProgress | null;
  readonly error: string | null;
  readonly chooseFolders: () => void;
  readonly rescan: () => void;
  readonly removeFolder: (libraryId: string) => void;
  readonly cancelScan: () => void;
  readonly clearError: () => void;
  readonly playVideo: (videoId: string) => void;
}

const LocalVideoContext = createContext<LocalVideoContextValue | null>(null);

export function useLocalVideo(): LocalVideoContextValue {
  const context = useContext(LocalVideoContext);

  if (!context) {
    throw new Error('useLocalVideo must be used inside LocalVideoProvider.');
  }

  return context;
}

function posterUrlFor(video: LocalVideoItem): string | undefined {
  const poster =
    video.posters.find((item) => item.kind === 'poster') ??
    video.posters.find((item) => item.kind === 'thumb');

  return poster?.url;
}

export function LocalVideoProvider({ children }: { children: ReactNode }) {
  const { restorePlayer, showPlayer } = useGlobalVideoPlayer();
  const [libraries, setLibraries] = useState<readonly LocalVideoLibrary[]>([]);
  const [folderErrors, setFolderErrors] = useState<
    readonly LocalVideoFolderError[]
  >([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<LocalVideoScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanRequestRef = useRef(0);
  const playRequestRef = useRef(0);
  const playVideoRef = useRef<(videoId: string) => void>(() => {});

  const videos = useMemo(
    () => libraries.flatMap((library) => library.videos),
    [libraries],
  );

  useEffect(() => {
    return window.desktop.localVideo.onScanProgress((nextProgress) => {
      setProgress(nextProgress);
    });
  }, []);

  const applySnapshot = useCallback((snapshot: LocalVideoFolderSnapshot) => {
    setLibraries(snapshot.libraries);
    setFolderErrors(snapshot.errors);
  }, []);

  const runScan = useCallback(
    async (
      scan: () => Promise<LocalVideoResult<LocalVideoFolderSnapshot | null>>,
    ) => {
      const requestId = scanRequestRef.current + 1;
      scanRequestRef.current = requestId;
      setIsScanning(true);
      setProgress(null);
      setError(null);
      setFolderErrors([]);

      try {
        const result = await scan();

        if (scanRequestRef.current !== requestId) {
          return;
        }

        if (!result.ok) {
          if (!result.error.includes('已取消')) {
            setError(result.error);
          }
          return;
        }

        if (result.data) {
          applySnapshot(result.data);
        }
      } catch (scanError) {
        if (scanRequestRef.current !== requestId) {
          return;
        }

        setError(
          scanError instanceof Error
            ? scanError.message
            : '加载本地视频失败，请稍后重试。',
        );
      } finally {
        if (scanRequestRef.current === requestId) {
          setIsScanning(false);
        }
      }
    },
    [applySnapshot],
  );

  useEffect(() => {
    void runScan(() => window.desktop.localVideo.loadLibraries());
  }, [runScan]);

  const chooseFolders = useCallback(() => {
    void runScan(() => window.desktop.localVideo.chooseFolders());
  }, [runScan]);

  const rescan = useCallback(() => {
    void runScan(() => window.desktop.localVideo.rescan());
  }, [runScan]);

  const removeFolder = useCallback((libraryId: string) => {
    setError(null);

    void window.desktop.localVideo
      .removeFolder(libraryId)
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }

        setLibraries(result.data.libraries);
        setFolderErrors(result.data.errors);
      })
      .catch((removeError: unknown) => {
        setError(
          removeError instanceof Error
            ? removeError.message
            : '删除本地视频文件夹失败。',
        );
      });
  }, []);

  const cancelScan = useCallback(() => {
    scanRequestRef.current += 1;
    setIsScanning(false);
    setProgress(null);
    void window.desktop.localVideo.cancelScan();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setFolderErrors([]);
  }, []);

  const playVideoInternal = useCallback(
    async (videoId: string) => {
      const requestId = playRequestRef.current + 1;
      playRequestRef.current = requestId;

      const index = videos.findIndex((video) => video.id === videoId);
      const video = videos[index];

      if (!video) {
        return;
      }

      let subtitles: readonly LocalVideoSubtitle[] = [];

      try {
        const result = await window.desktop.localVideo.getSubtitles({
          libraryId: video.libraryId,
          videoId: video.id,
        });

        if (result.ok) {
          subtitles = result.data;
        }
      } catch {
        // Subtitles are optional; playback should continue without them.
      }

      if (playRequestRef.current !== requestId) {
        return;
      }

      showPlayer({
        activeId: video.id,
        kicker: 'LOCAL / PLAYBACK',
        isLoading: false,
        playlist: videos.map((item) => ({
          id: item.id,
          title: item.title,
          displayTitle: item.title,
        })),
        resumePosition: readLocalProgress(video.id),
        shortTitle: video.title,
        source: {
          kind: 'file',
          url: video.videoUrl,
          width: null,
          height: null,
          posterUrl: posterUrlFor(video),
        },
        subtitleTracks: subtitles.map((subtitle) => ({
          id: subtitle.id,
          label: subtitle.label,
          content: subtitle.content,
          format: subtitle.format,
        })),
        title: video.title,
        onClose: () => {},
        onEnded: () => {
          const next = videos[index + 1];

          if (next) {
            playVideoRef.current(next.id);
          }
        },
        onProgress: (position, duration) => {
          saveLocalProgress(video.id, position, duration);
        },
        onRetry: () => {
          playVideoRef.current(video.id);
        },
        onSelectPlaylist: (id) => {
          playVideoRef.current(id);
        },
      });
    },
    [showPlayer, videos],
  );

  const playVideo = useCallback(
    (videoId: string) => {
      restorePlayer();
      void playVideoInternal(videoId);
    },
    [playVideoInternal, restorePlayer],
  );

  useEffect(() => {
    playVideoRef.current = playVideoInternal;
  }, [playVideoInternal]);

  const context = useMemo<LocalVideoContextValue>(
    () => ({
      cancelScan,
      chooseFolders,
      clearError,
      error,
      folderErrors,
      isScanning,
      libraries,
      playVideo,
      progress,
      removeFolder,
      rescan,
      videos,
    }),
    [
      cancelScan,
      chooseFolders,
      clearError,
      error,
      folderErrors,
      isScanning,
      libraries,
      playVideo,
      progress,
      removeFolder,
      rescan,
      videos,
    ],
  );

  return (
    <LocalVideoContext.Provider value={context}>
      {children}
    </LocalVideoContext.Provider>
  );
}
