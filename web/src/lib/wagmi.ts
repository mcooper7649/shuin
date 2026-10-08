import { createConfig, http, type Transport } from 'wagmi';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';
import { ENABLED_CHAINS } from './chains';

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

// Per-chain RPC overrides come from NEXT_PUBLIC_RPC_<chainId>; otherwise the chain's public RPC.
// Next.js only inlines env vars it can see literally, so the overrides are listed by hand.
const RPC_OVERRIDES: Record<number, string | undefined> = {
  1: process.env.NEXT_PUBLIC_RPC_1,
  8453: process.env.NEXT_PUBLIC_RPC_8453,
  42161: process.env.NEXT_PUBLIC_RPC_42161,
  10: process.env.NEXT_PUBLIC_RPC_10,
  137: process.env.NEXT_PUBLIC_RPC_137,
  7777777: process.env.NEXT_PUBLIC_RPC_7777777,
  11155111: process.env.NEXT_PUBLIC_RPC_11155111,
  84532: process.env.NEXT_PUBLIC_RPC_84532,
};

const transports = Object.fromEntries(
  ENABLED_CHAINS.map((c) => [c.id, http(RPC_OVERRIDES[c.id])]),
) as Record<number, Transport>;

export const wagmiConfig = createConfig({
  chains: ENABLED_CHAINS,
  connectors: [
    injected(),
    // Coinbase Smart Wallet: passkey sign-in, no extension or seed phrase needed.
    coinbaseWallet({ appName: 'Shuin', preference: 'all' }),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId, showQrModal: true })] : []),
  ],
  transports,
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
