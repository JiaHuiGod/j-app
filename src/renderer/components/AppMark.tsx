interface AppMarkProps {
  size?: number;
  className?: string;
}

export function AppMark({ size = 24, className }: AppMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height={size}
      viewBox="0 0 64 64"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="16" fill="#17191f" />
      <path
        d="M38.5 13v25.2c0 8-4.9 13-13 13-6.2 0-11-3.4-12.6-9"
        fill="none"
        stroke="#fffdf8"
        strokeLinecap="round"
        strokeWidth="6.5"
      />
      <circle cx="47" cy="16.5" r="3.5" fill="#cef36b" />
    </svg>
  );
}
