import { shrineFor } from '@/lib/chains';

/** The moment of minting: a seal pressed onto the page in the chain's ink. */
export function Stamp({ chainId, label }: { chainId: number; label: string }) {
  const shrine = shrineFor(chainId);
  const ink = shrine?.ink ?? 'var(--seal)';
  return (
    <div className="stamp-wrap">
      <svg className="stamp" width="148" height="148" viewBox="0 0 148 148" aria-label={`Sealed on ${shrine?.chain.name}`}>
        <defs>
          <filter id="stamp-ink">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" />
          </filter>
        </defs>
        <g filter="url(#stamp-ink)">
          <rect x="8" y="8" width="132" height="132" rx="14" fill="none" stroke="var(--seal)" strokeWidth="7" />
          <rect x="20" y="20" width="108" height="108" rx="8" fill="none" stroke="var(--seal)" strokeWidth="2" />
          <text x="74" y="68" textAnchor="middle" fill="var(--seal)" style={{ font: '700 30px var(--font-display)' }}>
            SEALED
          </text>
          <text x="74" y="98" textAnchor="middle" fill="var(--seal)" style={{ font: '600 18px var(--font-mono)' }}>
            {label}
          </text>
          <rect x="60" y="108" width="28" height="22" rx="4" fill={ink} />
          <text x="74" y="124" textAnchor="middle" fill="#fff" style={{ font: '700 14px var(--font-display)' }}>
            {shrine?.mark ?? '?'}
          </text>
        </g>
      </svg>
    </div>
  );
}
