'use client';

import type { Trait } from '@/lib/ipfs';

export function TraitsEditor({ traits, onChange }: { traits: Trait[]; onChange: (t: Trait[]) => void }) {
  const set = (i: number, patch: Partial<Trait>) =>
    onChange(traits.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="section-title">Traits</span>
      {traits.map((t, i) => (
        <div className="trait-row" key={i}>
          <input className="input" placeholder="e.g. Ink" value={t.trait_type} onChange={(e) => set(i, { trait_type: e.target.value })} />
          <input className="input" placeholder="e.g. Vermilion" value={t.value} onChange={(e) => set(i, { value: e.target.value })} />
          <button type="button" className="btn btn-ghost" aria-label="Remove trait" onClick={() => onChange(traits.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-ghost" onClick={() => onChange([...traits, { trait_type: '', value: '' }])}>
          + Add trait
        </button>
      </div>
    </div>
  );
}
