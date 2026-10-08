/** The Shuin seal: a vermilion stamp with two interlocked links pressed into it. */
export function SealMark({ size = 34, ink = 'var(--seal)' }: { size?: number; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <filter id="seal-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.2" />
        </filter>
        <mask id="seal-cut">
          <rect width="64" height="64" fill="#fff" />
          <g fill="none" stroke="#000" strokeWidth="5.5" strokeLinecap="round">
            <rect x="12" y="14" width="26" height="17" rx="8.5" transform="rotate(-35 25 22.5)" />
            <rect x="26" y="33" width="26" height="17" rx="8.5" transform="rotate(-35 39 41.5)" />
          </g>
        </mask>
      </defs>
      <g filter="url(#seal-rough)">
        <rect x="4" y="4" width="56" height="56" rx="9" fill={ink} mask="url(#seal-cut)" />
      </g>
    </svg>
  );
}
