import { useCallback, useEffect, useState, type RefObject } from 'react';
import {
  getSessionPlaybackRate,
  readPlayerMuted,
  readPlayerVolume,
  savePlayerMuted,
  savePlayerVolume,
  setSessionPlaybackRate,
} from '../../lib/player-preferences';

export interface VideoMediaState {
  readonly isPlaying: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly bufferedEnd: number;
  readonly volume: number;
  readonly isMuted: boolean;
  readonly playbackRate: number;
  readonly isFullscreen: boolean;
}

export interface VideoMediaController extends VideoMediaState {
  readonly togglePlay: () => void;
  readonly seekTo: (time: number) => void;
  readonly setVolume: (volume: number) => void;
  readonly toggleMute: () => void;
  readonly setPlaybackRate: (rate: number) => void;
  readonly toggleFullscreen: () => void;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function useVideoMediaState(
  videoRef: RefObject<HTMLVideoElement | null>,
  stageRef: RefObject<HTMLDivElement | null>,
  sourceUrl: string,
): VideoMediaController {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolumeState] = useState(() => readPlayerVolume());
  const [isMuted, setIsMutedState] = useState(() => readPlayerMuted());
  const [playbackRate, setPlaybackRateState] = useState(() =>
    getSessionPlaybackRate(),
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const initialVolume = readPlayerVolume();
    const initialMuted = readPlayerMuted();
    const initialRate = getSessionPlaybackRate();

    video.volume = initialVolume;
    video.muted = initialMuted;
    video.playbackRate = initialRate;
    setVolumeState(initialVolume);
    setIsMutedState(initialMuted);
    setPlaybackRateState(initialRate);

    const handlePlay = () => {
      setIsPlaying(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    const syncTime = () => {
      setCurrentTime(finiteOrZero(video.currentTime));
    };
    const syncDuration = () => {
      setDuration(
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : 0,
      );
    };
    const syncBuffered = () => {
      const ranges = video.buffered;
      setBufferedEnd(
        ranges.length > 0 ? finiteOrZero(ranges.end(ranges.length - 1)) : 0,
      );
    };
    const syncVolume = () => {
      setVolumeState(video.volume);
      setIsMutedState(video.muted);
      savePlayerVolume(video.volume);
      savePlayerMuted(video.muted);
    };
    const syncRate = () => {
      setPlaybackRateState(video.playbackRate);
    };
    const restoreSessionRate = () => {
      const rate = getSessionPlaybackRate();

      if (video.playbackRate !== rate) {
        video.playbackRate = rate;
      }

      setPlaybackRateState(rate);
    };
    const syncFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);
    video.addEventListener('timeupdate', syncTime);
    video.addEventListener('seeking', syncTime);
    video.addEventListener('seeked', syncTime);
    video.addEventListener('durationchange', syncDuration);
    video.addEventListener('loadedmetadata', syncDuration);
    video.addEventListener('loadedmetadata', restoreSessionRate);
    video.addEventListener('progress', syncBuffered);
    video.addEventListener('timeupdate', syncBuffered);
    video.addEventListener('volumechange', syncVolume);
    video.addEventListener('ratechange', syncRate);
    video.addEventListener('emptied', syncTime);
    document.addEventListener('fullscreenchange', syncFullscreen);

    setIsPlaying(!video.paused);
    syncTime();
    syncDuration();
    syncBuffered();
    syncFullscreen();

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handlePause);
      video.removeEventListener('timeupdate', syncTime);
      video.removeEventListener('seeking', syncTime);
      video.removeEventListener('seeked', syncTime);
      video.removeEventListener('durationchange', syncDuration);
      video.removeEventListener('loadedmetadata', syncDuration);
      video.removeEventListener('loadedmetadata', restoreSessionRate);
      video.removeEventListener('progress', syncBuffered);
      video.removeEventListener('timeupdate', syncBuffered);
      video.removeEventListener('volumechange', syncVolume);
      video.removeEventListener('ratechange', syncRate);
      video.removeEventListener('emptied', syncTime);
      document.removeEventListener('fullscreenchange', syncFullscreen);
    };
  }, [stageRef, videoRef]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !sourceUrl) {
      return;
    }

    const nextRate = getSessionPlaybackRate();

    video.playbackRate = nextRate;
    setPlaybackRateState(nextRate);
    setCurrentTime(0);
    setBufferedEnd(0);
    setDuration(0);
  }, [sourceUrl, videoRef]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [videoRef]);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      const limit =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : Number.POSITIVE_INFINITY;
      const nextTime = Math.max(0, Math.min(time, limit));

      video.currentTime = nextTime;
      setCurrentTime(finiteOrZero(nextTime));
    },
    [videoRef],
  );

  const setVolume = useCallback(
    (nextVolume: number) => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      const clamped = Math.max(0, Math.min(1, nextVolume));

      video.volume = clamped;

      if (clamped > 0 && video.muted) {
        video.muted = false;
      }

      setVolumeState(clamped);
      setIsMutedState(video.muted);
      savePlayerVolume(clamped);
      savePlayerMuted(video.muted);
    },
    [videoRef],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setIsMutedState(video.muted);
    savePlayerMuted(video.muted);
  }, [videoRef]);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      const video = videoRef.current;

      if (!video || !Number.isFinite(rate) || rate <= 0) {
        return;
      }

      video.playbackRate = rate;
      setSessionPlaybackRate(rate);
      setPlaybackRateState(rate);
    },
    [videoRef],
  );

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }

    if (typeof stage.requestFullscreen === 'function') {
      void stage.requestFullscreen().catch(() => undefined);
    }
  }, [stageRef]);

  return {
    bufferedEnd,
    currentTime,
    duration,
    isFullscreen,
    isMuted,
    isPlaying,
    playbackRate,
    toggleFullscreen,
    toggleMute,
    togglePlay,
    seekTo,
    setPlaybackRate,
    setVolume,
    volume,
  };
}
