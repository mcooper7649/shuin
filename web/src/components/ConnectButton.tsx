'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export function short(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

const LABELS: Record<string, string> = {
  injected: 'Browser wallet',
  coinbaseWalletSDK: 'Coinbase Smart Wallet (passkey)',
  walletConnect: 'WalletConnect (mobile)',
};

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (isConnected) setOpen(false);
  }, [isConnected]);

  if (!mounted) return <button className="btn" disabled>Connect</button>;

  if (isConnected) {
    return (
      <button className="btn" onClick={() => disconnect()} title="Disconnect">
        <span className="mono">{short(address)}</span>
      </button>
    );
  }

  // De-dupe: EIP-6963 announces each installed extension as its own connector.
  const seen = new Set<string>();
  const options = connectors.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)));

  return (
    <>
      <button className="btn btn-seal" onClick={() => setOpen(true)}>Connect</button>
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="card modal stack" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Connect a wallet">
            <h3>Connect a wallet</h3>
            {options.map((c) => (
              <button key={c.uid} className="btn wallet-opt" disabled={isPending} onClick={() => connect({ connector: c })}>
                {c.type === 'injected' && c.name !== 'Injected' ? c.name : LABELS[c.id] ?? c.name}
                <span aria-hidden>→</span>
              </button>
            ))}
            <p className="hint">No wallet? Coinbase Smart Wallet signs you in with a passkey. No extension or seed phrase needed.</p>
            {error && <div className="alert alert-err">{error.message.split('\n')[0]}</div>}
          </div>
        </div>
      )}
    </>
  );
}
