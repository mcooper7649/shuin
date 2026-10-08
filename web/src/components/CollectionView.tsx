'use client';

import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { formatEther, type Address, type Hex } from 'viem';
import { useAccount, useBalance, useReadContracts, useWriteContract } from 'wagmi';
import { shuinCollectionAbi } from '@/lib/abi';
import { explorerAddress, shrineFor } from '@/lib/chains';
import { gatewayUrl } from '@/lib/ipfs';
import { short } from './ConnectButton';
import { SealForm } from './SealForm';

type CollectionMeta = {
  name?: string;
  description?: string;
  image?: string;
  shuin?: { allowlist?: string };
};

function when(ts: bigint) {
  return new Date(Number(ts) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function CollectionView({ chainId, address }: { chainId: number; address: Address }) {
  const shrine = shrineFor(chainId);
  const { address: me } = useAccount();
  const [pageUrl, setPageUrl] = useState('');
  useEffect(() => setPageUrl(window.location.href), []);
  const contract = { address, abi: shuinCollectionAbi, chainId } as const;
  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      { ...contract, functionName: 'name' },
      { ...contract, functionName: 'symbol' },
      { ...contract, functionName: 'config' },
      { ...contract, functionName: 'totalMinted' },
      { ...contract, functionName: 'contractURI' },
      { ...contract, functionName: 'owner' },
    ],
  });
  const [name, symbol, config, minted, contractUri, owner] = data?.map((d) => d.result) ?? [];
  const { data: balance, refetch: refetchBalance } = useBalance({ address, chainId });
  const { writeContractAsync, isPending: withdrawing } = useWriteContract();

  const { data: meta, isLoading: loadingMeta } = useQuery({
    queryKey: ['contract-meta', contractUri],
    enabled: !!contractUri,
    queryFn: async (): Promise<CollectionMeta> => (await fetch(gatewayUrl(contractUri as string)!)).json(),
  });

  const allowlistUri = meta?.shuin?.allowlist;
  const { data: proof, isLoading: loadingProof } = useQuery({
    queryKey: ['allowlist', allowlistUri, me],
    enabled: !!allowlistUri && !!me,
    queryFn: async (): Promise<Hex[] | null> => {
      const dump = await (await fetch(gatewayUrl(allowlistUri)!)).json();
      const tree = StandardMerkleTree.load<[string]>(dump);
      for (const [i, [a]] of tree.entries()) {
        if (a.toLowerCase() === me!.toLowerCase()) return tree.getProof(i) as Hex[];
      }
      return null;
    },
  });

  if (isLoading) return <p style={{ padding: '60px 0' }}>Reading the collection…</p>;
  if (!config) {
    return (
      <div className="alert alert-warn" style={{ margin: '60px 0' }}>
        No Shuin collection at <span className="mono">{address}</span> on {shrine?.chain.name ?? `chain ${chainId}`}.
      </div>
    );
  }

  const [maxSupply, mintStart, mintEnd, price, publicMint, soulbound, allowlistRoot] = config as readonly [
    bigint, bigint, bigint, bigint, boolean, boolean, Hex,
  ];
  const isOwner = !!me && !!owner && me.toLowerCase() === (owner as string).toLowerCase();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const hasAllowlist = /[1-9a-f]/i.test(allowlistRoot.slice(2));

  let blocked: string | undefined;
  if (!publicMint && !isOwner) blocked = 'Only the creator can mint in this collection.';
  else if (mintStart && now < mintStart) blocked = `Minting opens ${when(mintStart)}.`;
  else if (mintEnd && now > mintEnd) blocked = 'Minting has closed.';
  else if (maxSupply && (minted as bigint) >= maxSupply) blocked = 'Sold out.';
  else if (hasAllowlist && loadingMeta) blocked = 'Checking the allowlist…';
  else if (hasAllowlist && !allowlistUri) blocked = 'This collection’s allowlist isn’t published, so proofs can’t be built here.';
  else if (hasAllowlist && me && (loadingProof || proof === undefined)) blocked = 'Checking the allowlist…';
  else if (hasAllowlist && me && proof === null) blocked = 'Your wallet isn’t on the allowlist.';

  const cover = gatewayUrl(meta?.image);
  const explorer = explorerAddress(chainId, address);

  return (
    <>
      <header className="coll-head">
        {cover ? <img className="coll-cover" src={cover} alt="" /> : <div className="coll-cover" />}
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
            <span className="mark mark-lg" style={{ ['--c' as string]: shrine?.ink }}>{shrine?.mark}</span>
            <span className="hint">{shrine?.chain.name}</span>
            {soulbound && <span className="hint">· Soulbound</span>}
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
            {name as string} <span className="mono hint">{symbol as string}</span>
          </h1>
          {meta?.description && <p style={{ color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: '60ch' }}>{meta.description}</p>}
          <div className="stats">
            <div className="stat"><b>{(minted as bigint).toString()}{maxSupply ? ` / ${maxSupply}` : ''}</b><span>Sealed</span></div>
            <div className="stat"><b>{price ? `${formatEther(price)} ${shrine?.chain.nativeCurrency.symbol}` : 'Free'}</b><span>Price</span></div>
            {mintEnd > 0n && <div className="stat"><b style={{ fontSize: '1rem' }}>{when(mintEnd)}</b><span>Closes</span></div>}
            <div className="stat">
              <b style={{ fontSize: '1rem' }} className="mono">
                {explorer ? <a href={explorer} target="_blank" rel="noreferrer">{short(address)} ↗</a> : short(address)}
              </b>
              <span>Contract</span>
            </div>
          </div>
        </div>
      </header>

      <div className="two-col">
        <SealForm
          collection={address}
          chainId={chainId}
          price={price}
          proof={proof ?? []}
          blockedReason={blocked}
          onSealed={() => {
            refetch();
            refetchBalance();
          }}
        />
        <div className="stack" style={{ alignContent: 'start' }}>
          <div className="card stack">
            <span className="section-title">Share this mint page</span>
            <input className="input mono" readOnly value={pageUrl} onFocus={(e) => e.target.select()} />
            {hasAllowlist && <p className="hint" style={{ margin: 0 }}>Allowlist mint. Only listed wallets can seal.</p>}
          </div>
          {isOwner && (
            <div className="card stack">
              <span className="section-title">Creator</span>
              <div>
                Balance: <b>{balance ? `${formatEther(balance.value)} ${balance.symbol}` : '…'}</b>
              </div>
              <button
                className="btn"
                disabled={!balance?.value || withdrawing}
                onClick={async () => {
                  await writeContractAsync({ ...contract, functionName: 'withdraw', args: [me!] });
                  setTimeout(() => refetchBalance(), 4000);
                }}
              >
                Withdraw to {short(me)}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
