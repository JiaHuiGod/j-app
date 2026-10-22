import type { SubtitleFormat } from '../../lib/subtitles';

export interface VideoPlayerSource {
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
  /** Defaults to HLS for 115 playback. Local files use a direct media URL. */
  readonly kind?: 'hls' | 'file';
  readonly posterUrl?: string;
}

export interface VideoPlaylistItem {
  readonly id: string;
  readonly title: string;
  /** Optional shorter label rendered in the playlist; `title` is the tooltip. */
  readonly displayTitle?: string;
}

export interface VideoSubtitleTrack {
  readonly id: string;
  readonly label: string;
  readonly content: string;
  readonly format: SubtitleFormat;
}

export interface VideoPlayerDialogProps {
  readonly title: string;
  readonly source: VideoPlayerSource;
  readonly playlist: readonly VideoPlaylistItem[];
  readonly activeId: string | null;
  readonly subtitleTracks: readonly VideoSubtitleTrack[];
  readonly resumePosition: number | null;
  readonly isMinimized: boolean;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly kicker?: string;
  readonly onProgress: (position: number, duration: number) => void;
  readonly onEnded: () => void;
  readonly onSelectPlaylist: (id: string) => void;
  readonly onRetry: () => void;
  readonly onClose: () => void;
  readonly onMinimize: () => void;
  readonly onPlayingChange?: (isPlaying: boolean) => void;
  readonly onRegisterPlaybackToggle?: (toggle: (() => void) | null) => void;
}
