'use client';

import { useEffect, useState } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import { ENABLED_SHRINES } from '@/lib/chains';

/** Chain picker. Works before a wallet is connected too: wagmi tracks the chosen chain either way. */
export function ShrinePicker() {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  // The chosen chain is restored from storage on the client, so only mark it after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="shrines" role="group" aria-label="Chain">
      {ENABLED_SHRINES.map((s) => (
        <button
          key={s.chain.id}
          type="button"
          className="shrine"
          style={{ ['--c' as string]: s.ink }}
          aria-pressed={mounted && s.chain.id === chainId}
          disabled={isPending}
          onClick={() => switchChain({ chainId: s.chain.id })}
        >
          <span className="mark">{s.mark}</span>
          {s.chain.name}
        </button>
      ))}
    </div>
  );
}
