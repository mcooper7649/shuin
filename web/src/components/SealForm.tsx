'use client';

import { useEffect, useState } from 'react';
import { formatEther, parseEventLogs, type Address, type Hex } from 'viem';
import { useAccount, useBytecode, useChainId, useGasPrice, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi';
import { shuinCollectionAbi } from '@/lib/abi';
import { explorerTx, shrineFor } from '@/lib/chains';
import { buildMetadata, mediaKind, pinFile, pinJson, type Trait } from '@/lib/ipfs';
import { chunk, estimateOnChainGas, fitImage, ONCHAIN_MEDIA_BUDGET, type Compressed } from '@/lib/onchain';
import { useIpfsEnabled } from '@/lib/useIpfsEnabled';
import { MediaDrop } from './MediaDrop';
import { Stamp } from './Stamp';
import { Steps, type StepState } from './Steps';
import { TraitsEditor } from './TraitsEditor';

type Props = {
  collection: Address | undefined;
  /** Pin the form to one chain (collection pages); otherwise follows the chain picker. */
  chainId?: number;
  price?: bigint;
  proof?: Hex[];
  /** Set when minting isn't possible right now (window closed, not on allowlist…). */
  blockedReason?: string;
  onSealed?: () => void;
};

type Storage = 'onchain' | 'ipfs';

const STEP_LABELS: Record<Storage, string[]> = {
  ipfs: ['Upload media to IPFS', 'Pin metadata', 'Sign in your wallet', 'Confirm on-chain'],
  onchain: ['Prepare image', 'Sign in your wallet', 'Write it to the chain'],
};

function errMessage(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string };
  return (err.shortMessage || err.message || 'Something went wrong').split('\n')[0];
}

const kb = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(n < 10_240 ? 1 : 0)} KB`;

export function SealForm({ collection, chainId: fixedChainId, price = 0n, proof = [], blockedReason, onSealed }: Props) {
  const pickedChainId = useChainId();
  const chainId = fixedChainId ?? pickedChainId;
  const shrine = shrineFor(chainId);
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const { data: gasPrice } = useGasPrice({ chainId });
  const { data: code, isLoading: checkingCode } = useBytecode({ address: collection, chainId, query: { enabled: !!collection } });
  const ipfsEnabled = useIpfsEnabled();

  const [file, setFile] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [traits, setTraits] = useState<Trait[]>([]);
  const [recipient, setRecipient] = useState('');
  const [preferred, setPreferred] = useState<Storage>('onchain');
  const [compressed, setCompressed] = useState<Compressed>();
  const [compressError, setCompressError] = useState<string>();

  const [step, setStep] = useState(-1);
  const [failedAt, setFailedAt] = useState(-1);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ tokenId: bigint; hash: Hex; chainId: number; storage: Storage }>();

  const kind = file ? mediaKind(file.type, file.name) : undefined;
  // Only images go on-chain; everything else needs IPFS. Without IPFS configured, on-chain is the only option.
  const storage: Storage = kind && kind !== 'image' ? 'ipfs' : ipfsEnabled === false ? 'onchain' : preferred;
  const busy = step >= 0 && failedAt < 0 && !result;
  const deployed = !!code && code !== '0x';
  const unsupported = storage === 'ipfs' && ipfsEnabled === false;

  useEffect(() => {
    setCompressed(undefined);
    setCompressError(undefined);
    if (!file || kind !== 'image' || storage !== 'onchain') return;
    let cancelled = false;
    fitImage(file, ONCHAIN_MEDIA_BUDGET)
      .then((c) => !cancelled && setCompressed(c))
      .catch((e) => !cancelled && setCompressError(errMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [file, kind, storage]);

  const onchainCost =
    compressed && gasPrice ? Number(formatEther(estimateOnChainGas(compressed.blob.size) * gasPrice)).toPrecision(2) : undefined;

  async function seal(e: React.FormEvent) {
    e.preventDefault();
    if (!collection || !address || !publicClient) return;
    if (!file || !kind) return setError('Add an image, video, audio file or 3D model first.');
    if (!name.trim()) return setError('Give it a name.');
    const to = (recipient.trim() || address) as Address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) return setError('That recipient address doesn’t look right.');

    setError(undefined);
    setFailedAt(-1);
    setResult(undefined);
    let current = 0;
    try {
      let hash: Hex;
      if (storage === 'onchain') {
        setStep((current = 0));
        const media = compressed ?? (await fitImage(file, ONCHAIN_MEDIA_BUDGET));
        const bytes = new Uint8Array(await media.blob.arrayBuffer());
        const attributes = traits.filter((t) => t.trait_type.trim() && t.value.trim());
        const metaJson = JSON.stringify({ name: name.trim(), description: description.trim(), attributes });

        setStep((current = 1));
        if (walletChainId !== chainId) await switchChainAsync({ chainId });
        hash = await writeContractAsync({
          chainId,
          address: collection,
          abi: shuinCollectionAbi,
          functionName: 'mintOnChain',
          args: [to, metaJson, media.mime, chunk(bytes), proof],
          value: price,
        });
        setStep((current = 2));
      } else {
        setStep((current = 0));
        const media = await pinFile(file);
        const posterPin = poster && kind !== 'image' ? await pinFile(poster) : undefined;

        setStep((current = 1));
        const meta = buildMetadata({
          name: name.trim(),
          description: description.trim(),
          mediaUri: media.uri,
          kind,
          posterUri: posterPin?.uri,
          traits,
        });
        const metaPin = await pinJson(meta, `${name.trim().slice(0, 40)}.json`);

        setStep((current = 2));
        if (walletChainId !== chainId) await switchChainAsync({ chainId });
        hash = await writeContractAsync({
          chainId,
          address: collection,
          abi: shuinCollectionAbi,
          functionName: 'mint',
          args: [to, metaPin.uri, proof],
          value: price,
        });
        setStep((current = 3));
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('The transaction reverted.');
      const [sealed] = parseEventLogs({ abi: shuinCollectionAbi, eventName: 'Sealed', logs: receipt.logs });
      setStep(STEP_LABELS[storage].length);
      setResult({ tokenId: sealed?.args.tokenId ?? 0n, hash, chainId, storage });
      onSealed?.();
    } catch (e) {
      setFailedAt(current);
      setError(errMessage(e));
    }
  }

  function reset() {
    setFile(null);
    setPoster(null);
    setName('');
    setDescription('');
    setTraits([]);
    setStep(-1);
    setFailedAt(-1);
    setResult(undefined);
    setError(undefined);
  }

  if (result) {
    const tx = explorerTx(result.chainId, result.hash);
    return (
      <div className="card stack">
        <Stamp chainId={result.chainId} label={`#${result.tokenId}`} />
        <div className="receipt">
          <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>{name}</strong>
          <span>
            Token #{result.tokenId.toString()} sealed on {shrineFor(result.chainId)?.chain.name}
          </span>
          {result.storage === 'onchain' && <span className="hint">Image and metadata stored entirely on-chain.</span>}
          {tx && (
            <a href={tx} target="_blank" rel="noreferrer" className="mono">
              View transaction ↗
            </a>
          )}
        </div>
        <button className="btn" onClick={reset}>Seal another</button>
      </div>
    );
  }

  const steps = STEP_LABELS[storage].map((label, i) => ({
    label,
    state: (failedAt === i ? 'error' : i < step ? 'done' : i === step && failedAt < 0 ? 'active' : 'idle') as StepState,
  }));

  return (
    <form className="card stack" onSubmit={seal}>
      <MediaDrop
        file={file}
        onChange={setFile}
        accept={ipfsEnabled === false ? 'image/*' : undefined}
        hint={ipfsEnabled === false ? 'Any image. It’s compressed and stored fully on-chain.' : undefined}
      />
      {file && kind && kind !== 'image' && (
        <MediaDrop
          compact
          file={poster}
          onChange={setPoster}
          accept="image/*"
          label="Optional cover image (shown as the thumbnail)"
        />
      )}

      <div className="stack" style={{ gap: 8 }}>
        <span className="section-title">Storage</span>
        <div className="segmented" role="radiogroup" aria-label="Storage">
          <button
            type="button"
            role="radio"
            aria-checked={storage === 'onchain'}
            disabled={!!kind && kind !== 'image'}
            onClick={() => setPreferred('onchain')}
          >
            Fully on-chain
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={storage === 'ipfs'}
            disabled={ipfsEnabled === false}
            onClick={() => setPreferred('ipfs')}
          >
            IPFS
          </button>
        </div>
        <span className="hint">
          {storage === 'onchain'
            ? 'The image lives inside the contract itself, so there’s no server or pinning service to go away. Images are compressed to under 48 KB.'
            : 'Any media up to 50 MB, pinned to IPFS. Video, audio and 3D models always use IPFS.'}
          {ipfsEnabled === false && ' IPFS isn’t configured on this server.'}
        </span>
        {storage === 'onchain' && compressed && (
          <span className="hint mono">
            {kb(compressed.blob.size)} {compressed.mime.replace('image/', '').toUpperCase()}
            {compressed.recompressed && file ? ` (from ${kb(file.size)}, ${compressed.width}×${compressed.height})` : ''}
            {onchainCost ? ` · ≈ ${onchainCost} ${shrine?.chain.nativeCurrency.symbol} gas` : ''}
          </span>
        )}
        {compressError && <div className="alert alert-err">{compressError}</div>}
      </div>

      <label className="field">
        <span>Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. First light over the harbor" maxLength={120} />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it, and why does it matter to you?" />
      </label>
      <TraitsEditor traits={traits} onChange={setTraits} />
      <details>
        <summary className="hint" style={{ cursor: 'pointer' }}>Send to a different address</summary>
        <input className="input mono" style={{ marginTop: 8 }} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={address ?? '0x…'} />
      </details>

      {step >= 0 && <Steps steps={steps} />}
      {error && <div className="alert alert-err">{error}</div>}
      {!collection && <div className="alert alert-warn">No collection is configured for this page yet.</div>}
      {collection && !checkingCode && !deployed && (
        <div className="alert alert-warn">{fixedChainId ? `This collection doesn’t exist on ${shrine?.chain.name}.` : `Shuin isn’t set up on ${shrine?.chain.name} yet. Pick another chain above.`}</div>
      )}
      {unsupported && <div className="alert alert-warn">This file type needs IPFS, which isn’t configured here. Try an image.</div>}
      {blockedReason && <div className="alert alert-warn">{blockedReason}</div>}

      {isConnected ? (
        <button
          className="btn btn-seal btn-big"
          type="submit"
          disabled={busy || !deployed || !!blockedReason || unsupported || (storage === 'onchain' && !!file && !compressed)}
        >
          {busy ? 'Sealing…' : `Seal on ${shrine?.chain.name ?? 'chain'}${price > 0n ? ` · ${formatEther(price)} ${shrine?.chain.nativeCurrency.symbol}` : ''}`}
        </button>
      ) : (
        <p className="hint" style={{ textAlign: 'center', margin: 0 }}>Connect a wallet to seal.</p>
      )}
    </form>
  );
}
