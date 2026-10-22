import type { ReactNode } from 'react';

interface PlayerIconProps {
  readonly className?: string;
}

function IconFrame({
  children,
  className,
}: PlayerIconProps & { readonly children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 20 20"
    >
      {children}
    </svg>
  );
}

export function PlayIcon({ className }: PlayerIconProps) {
  return (
    <IconFrame className={className}>
      <path d="M7 4.8 15.2 10 7 15.2V4.8Z" />
    </IconFrame>
  );
}

export function PauseIcon({ className }: PlayerIconProps) {
  return (
    <IconFrame className={className}>
      <path d="M7.4 4.6v10.8M12.6 4.6v10.8" />
    </IconFrame>
  );
}

export function VolumeIcon({ className }: PlayerIconProps) {
  return (
    <IconFrame className={className}>
      <path d="M3.2 7.7h3l4-3.2v11l-4-3.2h-3V7.7Z" />
      <path d="M13 7.4a4 4 0 0 1 0 5.2M15.2 5.6a6.6 6.6 0 0 1 0 8.8" />
    </IconFrame>
  );
}

export function MutedIcon({ className }: PlayerIconProps) {
  return (
    <IconFrame className={className}>
      <path d="M3.2 7.7h3l4-3.2v11l-4-3.2h-3V7.7Z" />
      <path d="m13 7.8 4 4.4M17 7.8l-4 4.4" />
    </IconFrame>
  );
}

export function SubtitlesIcon({ className }: PlayerIconProps) {
  return (
    <IconFrame className={className}>
      <rect height="11" rx="2" width="15" x="2.5" y="4.5" />
      <path d="M5.5 12.2h4.2M11.8 12.2h2.7M5.5 9.5h2.8M10.5 9.5h4" />
    </IconFrame>
  );
}

export function FullscreenIcon({ className }: PlayerIconProps) {
  return (
    <IconFrame className={className}>
      <path d="M7.2 3.5H3.5v3.7M12.8 3.5h3.7v3.7M16.5 12.8v3.7h-3.7M3.5 12.8v3.7h3.7" />
    </IconFrame>
  );
}

export function ExitFullscreenIcon({ className }: PlayerIconProps) {
  return (
    <IconFrame className={className}>
      <path d="M3.5 7.2h3.7V3.5M16.5 7.2h-3.7V3.5M16.5 12.8h-3.7v3.7M3.5 12.8h3.7v3.7" />
    </IconFrame>
  );
}

export function MinimizePlayerIcon({ className }: PlayerIconProps) {
  return (
    <IconFrame className={className}>
      <rect height="12" rx="2" width="14" x="3" y="4" />
      <rect height="6" rx="1.4" width="7.5" x="9.5" y="10" />
    </IconFrame>
  );
}

export function CheckIcon({ className }: PlayerIconProps) {
  return (
    <IconFrame className={className}>
      <path d="m4.2 10.3 3.1 3.1 8.5-6.8" />
    </IconFrame>
  );
}

export function RestorePlayerIcon({ className }: PlayerIconProps) {
  return (
    <IconFrame className={className}>
      <path d="M7 4.8 15.2 10 7 15.2V4.8Z" />
    </IconFrame>
  );
}
