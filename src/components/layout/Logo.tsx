import { useId } from 'react';

export function Logo({ size = 32 }: { size?: number }) {
  const gid = 'kosh-g' + useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={'url(#' + gid + ')'} />
      <path d="M22 16v32M22 33l16-17M27 28l13 20" stroke="#04130d" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
