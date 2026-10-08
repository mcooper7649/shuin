'use client';

import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getAddress, isAddress, parseEther, parseEventLogs, toHex, zeroHash, type Address, type Hex } from 'viem';
import { useAccount, useBytecode, useChainId, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi';
import { shuinFactoryAbi } from '@/lib/abi';
import { FACTORY_ADDRESS, shrineFor } from '@/lib/chains';
import { pinFile, pinJson } from '@/lib/ipfs';
import { MediaDrop } from './MediaDrop';
import { Steps, type StepState } from './Steps';

const STEP_LABELS = ['Pin cover and collection details', 'Sign in your wallet', 'Deploy your collection'];

/** Parse pasted addresses or a CSV. Takes the first 0x… token on each line. */
function parseAllowlist(text: string): { addresses: Address[]; bad: number } {
  const addresses = new Set<Address>();
  let bad = 0;
  for (const line of text.split(/\r?\n/)) {
    const token = line.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!line.trim()) continue;
    if (token && isAddress(token)) addresses.add(getAddress(token));
    else bad++;
  }
  return { addresses: [...addresses], bad };
}

function toUnix(local: string): bigint {
  return local ? BigInt(Math.floor(new Date(local).getTime() / 1000)) : 0n;
}

export function LaunchForm() {
  const router = useRouter();
  const chainId = useChainId();
  const shrine = shrineFor(chainId);
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const { data: factoryCode } = useBytecode({ address: FACTORY_ADDRESS, chainId });
  const factoryLive = !!factoryCode && factoryCode !== '0x';

  const [cover, setCover] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [royalty, setRoyalty] = useState('5');
  const [maxSupply, setMaxSupply] = useState('');
  const [price, setPrice] = useState('0');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [publicMint, setPublicMint] = useState(true);
  const [soulbound, setSoulbound] = useState(false);
  const [allowlistText, setAllowlistText] = useState('');

  const [step, setStep] = useState(-1);
  const [failedAt, setFailedAt] = useState(-1);
  const [error, setError] = useState<string>();

  const allowlist = parseAllowlist(allowlistText);
  const busy = step >= 0 && failedAt < 0;

  async function launch(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !publicClient) return;
    if (!name.trim() || !symbol.trim()) return setError('A collection needs a name and a symbol.');
    const royaltyBps = Math.round(Number(royalty || 0) * 100);
    if (!(royaltyBps >= 0 && royaltyBps <= 1000)) return setError('Royalties can be 0–10%.');
    let priceWei: bigint;
    try {
      priceWei = parseEther(price || '0');
    } catch {
      return setError('Price must be a number, like 0.01.');
    }
    if (start && end && toUnix(end) <= toUnix(start)) return setError('The mint window must end after it starts.');

    setError(undefined);
    setFailedAt(-1);
    let current = 0;
    try {
      setStep((current = 0));
      const coverPin = cover ? await pinFile(cover) : undefined;
      let allowlistRoot: Hex = zeroHash;
      let allowlistUri: string | undefined;
      if (allowlist.addresses.length) {
        const tree = StandardMerkleTree.of(allowlist.addresses.map((a) => [a]), ['address']);
        allowlistRoot = tree.root as Hex;
        allowlistUri = (await pinJson(tree.dump(), `${symbol}-allowlist.json`)).uri;
      }
      const contractMeta = {
        name: name.trim(),
        description: description.trim(),
        image: coverPin?.uri,
        seller_fee_basis_points: royaltyBps,
        fee_recipient: address,
        shuin: { allowlist: allowlistUri },
      };
      const metaPin = await pinJson(contractMeta, `${symbol}-collection.json`);

      setStep((current = 1));
      if (walletChainId !== chainId) await switchChainAsync({ chainId });
      const salt = toHex(crypto.getRandomValues(new Uint8Array(32)));
      const hash = await writeContractAsync({
        chainId,
        address: FACTORY_ADDRESS,
        abi: shuinFactoryAbi,
        functionName: 'createCollection',
        args: [
          salt,
          name.trim(),
          symbol.trim().toUpperCase(),
          metaPin.uri,
          address,
          BigInt(royaltyBps),
          {
            maxSupply: BigInt(maxSupply || 0),
            mintStart: toUnix(start),
            mintEnd: toUnix(end),
            price: priceWei,
            publicMint,
            soulbound,
            allowlistRoot,
          },
        ],
      });

      setStep((current = 2));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('The transaction reverted.');
      const [created] = parseEventLogs({ abi: shuinFactoryAbi, eventName: 'CollectionCreated', logs: receipt.logs });
      if (!created) throw new Error('Deployed, but couldn’t find the new collection address in the receipt.');
      router.push(`/c/${chainId}/${created.args.collection}`);
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setFailedAt(current);
      setError((err.shortMessage || err.message || 'Something went wrong').split('\n')[0]);
    }
  }

  const steps = STEP_LABELS.map((label, i) => ({
    label,
    state: (failedAt === i ? 'error' : i < step ? 'done' : i === step && failedAt < 0 ? 'active' : 'idle') as StepState,
  }));

  return (
    <form className="two-col" onSubmit={launch}>
      <div className="card stack">
        <span className="section-title">The collection</span>
        <MediaDrop file={cover} onChange={setCover} accept="image/*" label="Cover image" />
        <div className="row">
          <label className="field">
            <span>Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Harbor Studies" maxLength={64} />
          </label>
          <label className="field">
            <span>Symbol</span>
            <input className="input mono" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="HRBR" maxLength={10} />
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>

      <div className="card stack">
        <span className="section-title">Mint rules</span>
        <div className="row">
          <label className="field">
            <span>Price ({shrine?.chain.nativeCurrency.symbol ?? 'ETH'})</span>
            <input className="input mono" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="field">
            <span>Max supply</span>
            <input className="input mono" inputMode="numeric" value={maxSupply} onChange={(e) => setMaxSupply(e.target.value.replace(/\D/g, ''))} placeholder="Unlimited" />
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span>Mint opens</span>
            <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Mint closes</span>
            <input className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Creator royalty (%)</span>
          <input className="input mono" inputMode="decimal" value={royalty} onChange={(e) => setRoyalty(e.target.value)} />
          <span className="hint">ERC-2981, paid on secondary sales by marketplaces that honor it. Max 10%.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={publicMint} onChange={(e) => setPublicMint(e.target.checked)} />
          <span><b>Anyone can mint</b>. Turn off to keep minting to yourself.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={soulbound} onChange={(e) => setSoulbound(e.target.checked)} />
          <span><b>Soulbound</b>. Tokens can never be transferred. Good for badges and credentials. This can’t be changed later.</span>
        </label>
        <label className="field">
          <span>Allowlist (optional)</span>
          <textarea className="input mono" value={allowlistText} onChange={(e) => setAllowlistText(e.target.value)} placeholder={'One address per line, or paste a CSV\n0x…'} />
          <span className="hint">
            {allowlist.addresses.length
              ? `${allowlist.addresses.length} address${allowlist.addresses.length === 1 ? '' : 'es'}${allowlist.bad ? `, ${allowlist.bad} line(s) skipped` : ''}. Only these wallets can mint.`
              : 'Leave empty to let anyone mint.'}
          </span>
        </label>

        {step >= 0 && <Steps steps={steps} />}
        {error && <div className="alert alert-err">{error}</div>}
        {factoryCode !== undefined && !factoryLive && (
          <div className="alert alert-warn">Shuin isn’t set up on {shrine?.chain.name} yet. Pick another chain.</div>
        )}
        {isConnected ? (
          <button className="btn btn-seal btn-big" type="submit" disabled={busy || !factoryLive}>
            {busy ? 'Launching…' : `Launch on ${shrine?.chain.name}`}
          </button>
        ) : (
          <p className="hint" style={{ textAlign: 'center', margin: 0 }}>Connect a wallet to launch.</p>
        )}
      </div>
    </form>
  );
}
