import type { ThemePreference } from '@shared/appearance';

interface ThemeIconProps {
  readonly preference: ThemePreference;
  readonly className?: string;
}

function SunIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
      viewBox="0 0 16 16"
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1" />
    </svg>
  );
}

function MoonIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
      viewBox="0 0 16 16"
    >
      <path d="M12.8 10.2A5.2 5.2 0 0 1 5.8 3.2a5.2 5.2 0 1 0 7 7Z" />
    </svg>
  );
}

function SystemIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
      viewBox="0 0 16 16"
    >
      <rect height="8" rx="1.2" width="11.6" x="2.2" y="3" />
      <path d="M5.8 13.2h4.4M8 11v2.2" />
    </svg>
  );
}

export function ThemeIcon({ preference, className }: ThemeIconProps) {
  if (preference === 'light') {
    return <SunIcon className={className} />;
  }

  if (preference === 'dark') {
    return <MoonIcon className={className} />;
  }

  return <SystemIcon className={className} />;
}
