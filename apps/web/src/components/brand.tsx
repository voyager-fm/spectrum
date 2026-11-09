import { useId } from 'react';

/**
 * Spectrum's mark: specification lines on a spectrum gradient. This is the one place the full
 * spectrum appears; everywhere else the interface uses the single indigo accent.
 */
export function BrandMark({ className }: { className?: string }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.62 0.21 25)" />
          <stop offset="0.35" stopColor="oklch(0.76 0.17 70)" />
          <stop offset="0.65" stopColor="oklch(0.6 0.2 300)" />
          <stop offset="1" stopColor="oklch(0.511 0.262 276.966)" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#${gradient})`} />
      <rect x="6" y="7" width="12" height="2" rx="1" fill="white" />
      <rect x="6" y="11" width="9" height="2" rx="1" fill="white" fillOpacity="0.85" />
      <rect x="6" y="15" width="6" height="2" rx="1" fill="white" fillOpacity="0.7" />
    </svg>
  );
}
