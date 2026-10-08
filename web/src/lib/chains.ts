import type { Address, Chain } from 'viem';
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  sepolia,
  zora,
} from 'viem/chains';

/**
 * Every chain is a shrine; each gets its own ink and a one-letter mark
 * that appears on the chain picker, mint receipts and gallery cards.
 */
export type ShrineInfo = {
  chain: Chain;
  mark: string;
  ink: string;
  testnet: boolean;
};

export const SHRINES: ShrineInfo[] = [
  { chain: sepolia, mark: 'S', ink: '#6b74c9', testnet: true },
  { chain: baseSepolia, mark: 'b', ink: '#4f86f0', testnet: true },
  { chain: mainnet, mark: 'E', ink: '#4c5bd4', testnet: false },
  { chain: base, mark: 'B', ink: '#1f63f0', testnet: false },
  { chain: arbitrum, mark: 'A', ink: '#1c8ea8', testnet: false },
  { chain: optimism, mark: 'O', ink: '#c8323c', testnet: false },
  { chain: polygon, mark: 'P', ink: '#7b4bd8', testnet: false },
  { chain: zora, mark: 'Z', ink: '#3a3a3a', testnet: false },
];

/** Comma-separated chain ids to offer, e.g. "8453,84532". Defaults to the testnets. */
const enabledIds = (process.env.NEXT_PUBLIC_CHAINS || `${sepolia.id},${baseSepolia.id}`)
  .split(',')
  .map((id) => Number(id.trim()));

// Keep the order of the env list so the first id is the default chain.
export const ENABLED_SHRINES = enabledIds
  .map((id) => SHRINES.find((s) => s.chain.id === id))
  .filter((s): s is ShrineInfo => !!s);

export const ENABLED_CHAINS = ENABLED_SHRINES.map((s) => s.chain) as [Chain, ...Chain[]];

export function shrineFor(chainId: number | undefined): ShrineInfo | undefined {
  return SHRINES.find((s) => s.chain.id === chainId);
}

export function explorerTx(chainId: number, hash: string): string | undefined {
  const url = shrineFor(chainId)?.chain.blockExplorers?.default.url;
  return url ? `${url}/tx/${hash}` : undefined;
}

export function explorerAddress(chainId: number, address: string): string | undefined {
  const url = shrineFor(chainId)?.chain.blockExplorers?.default.url;
  return url ? `${url}/address/${address}` : undefined;
}

/**
 * The factory is deployed through the canonical CREATE2 deployer, so its address is
 * the same everywhere. Whether a given chain actually has it is checked at runtime.
 */
export const FACTORY_ADDRESS: Address = '0xce678Cb3Fd98A121a5989ab7469adF81D5A644ac';

export const OPEN_BOOK_ADDRESS = (process.env.NEXT_PUBLIC_OPEN_BOOK || undefined) as
  | Address
  | undefined;
