interface GlobeIconProps {
  className?: string;
}

export function GlobeIcon({ className }: GlobeIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.1"
      viewBox="0 0 16 16"
    >
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11" />
      <path d="M8 2.5c1.45 1.55 2.25 3.45 2.25 5.5S9.45 11.95 8 13.5C6.55 11.95 5.75 10.05 5.75 8S6.55 4.05 8 2.5Z" />
    </svg>
  );
}
