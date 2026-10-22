import type { SubtitleFormat } from '../../lib/subtitles';

export interface VideoPlayerSource {
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
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
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly kicker?: string;
  readonly onProgress: (position: number, duration: number) => void;
  readonly onEnded: () => void;
  readonly onSelectPlaylist: (id: string) => void;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}
