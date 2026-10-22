import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import Hls from 'hls.js';
import type { DrivePlaybackResult } from '@shared/drive';
import styles from './DrivePlayerDialog.module.css';

interface DrivePlayerDialogProps {
  readonly fileName: string;
  readonly playback: DrivePlaybackResult;
  readonly onClose: () => void;
  readonly onRetry: () => void;
}

export function DrivePlayerDialog({
  fileName,
  playback,
  onClose,
  onRetry,
}: DrivePlayerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    return () => {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    let hls: Hls | null = null;
    setError('');

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(playback.playbackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError(
            data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? '视频加载失败，请重新获取播放地址。'
              : '当前视频无法播放。',
          );
        }
      });
      void video.play().catch(() => undefined);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playback.playbackUrl;
      void video.play().catch(() => undefined);
    } else {
      setError('当前环境不支持 HLS 播放。');
    }

    return () => {
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [playback.playbackUrl]);

  const requestClose = () => {
    onClose();
  };

  const aspectRatio =
    playback.width && playback.height
      ? `${playback.width} / ${playback.height}`
      : '16 / 9';

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    requestClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={`播放 ${fileName}`}
      className={styles.dialog}
      onCancel={handleCancel}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>115 / PLAYBACK</p>
            <h2 title={fileName}>{fileName}</h2>
          </div>
          <button
            aria-label="关闭播放器"
            className={styles.close}
            type="button"
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        <div className={styles.stage}>
          <video
            ref={videoRef}
            className={styles.video}
            controls
            playsInline
            style={{ aspectRatio }}
            width={playback.width ?? undefined}
            height={playback.height ?? undefined}
            onError={() => {
              setError('视频加载失败，请重新获取播放地址。');
            }}
          >
            <track kind="captions" label="无字幕" />
          </video>
          {error && (
            <div className={styles.errorOverlay}>
              <p>{error}</p>
              <button className={styles.retry} type="button" onClick={onRetry}>
                重新获取播放地址
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
