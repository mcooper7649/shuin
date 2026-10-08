# Shuin

**Leave your mark. On any chain.**

Shuin is a multichain NFT minter. Drop in an image, video, audio file or 3D model, pick a chain, and press your seal. Or launch your own collection with a price, supply cap, mint window, allowlist and royalties, and share its mint page.

The name comes from *goshuin*, the ink seals travelers collect from shrine to shrine. Every chain is a shrine, and every mint is a seal.

Shuin is the successor to [nft-minter-project](https://github.com/mcooper7649/nft-minter-project), a single-contract Ropsten minter.

## Layout

| Path | What |
| --- | --- |
| `contracts/` | Foundry project: `ShuinCollection` (ERC-721 + per-token URIs, ERC-2981 royalties, ERC-4906 metadata updates, optional ERC-5192 soulbound, Merkle allowlist, price, supply cap, mint window) and `ShuinFactory` (deploys ERC-1167 clones). |
| `web/` | Next.js 15 + wagmi/viem app: seal (mint) page, collection launcher, per-collection mint pages at `/c/<chainId>/<address>`, server-side IPFS uploads. |
| `scripts/sync-abi.sh` | Rebuilds the contracts and regenerates `web/src/lib/abi.ts`. |

## Chains

`NEXT_PUBLIC_CHAINS` (comma-separated chain ids, first is the default) picks which chains the app offers: Ethereum, Base, Arbitrum, Optimism, Polygon, Zora, Sepolia and Base Sepolia are supported. The default is Sepolia and Base Sepolia. A chain only works once the factory has been deployed there; the UI checks this itself.

The factory is deployed through the canonical CREATE2 deployer, so it has the same address on every chain: `0xce678Cb3Fd98A121a5989ab7469adF81D5A644ac`. That address only holds while the bytecode is unchanged. After changing the contracts, run `scripts/sync-abi.sh`. It regenerates the ABI and writes the new address into `web/src/lib/chains.ts` and this README. The shared **Shuin Open Book** collection's address depends on the deployer key. Use the same key everywhere to keep it identical too.

## Contracts

```bash
cd contracts
forge test
# deploy (idempotent: re-running skips what's already there)
cast wallet import shuin-deployer --interactive
forge script script/Deploy.s.sol --rpc-url sepolia --account shuin-deployer --broadcast
```

## Web

```bash
cd web
cp .env.example .env.local   # fill in PINATA_JWT and NEXT_PUBLIC_OPEN_BOOK
npm install
npm run dev
```

Without `PINATA_JWT`, `next dev` keeps uploads in memory and serves them from `/api/ipfs/<cid>`. Set `NEXT_PUBLIC_IPFS_GATEWAY=http://localhost:3000/api/ipfs/` to use that store. Combined with `anvil --chain-id 11155111` and `NEXT_PUBLIC_RPC_11155111=http://127.0.0.1:8545`, the whole app runs offline with no keys.

**Uploads** go through `/api/pin`, which holds the Pinata JWT on the server. The old app shipped its Pinata key and secret in the browser bundle. The route limits files to 50 MB and image, video, audio and glTF types, and rate-limits each IP.

### Docker

```bash
docker build -t shuin web --build-arg NEXT_PUBLIC_OPEN_BOOK=0x...
docker run -p 3000:3000 -e PINATA_JWT=... shuin
```

## Roadmap

- ERC-1155 editions (open / timed / limited)
- Gasless mints via Coinbase Smart Wallet + paymaster on Base
- Lazy minting with EIP-712 vouchers
- Cross-chain gallery ("your seal book")
- Farcaster Frame / mini-app mint pages
- AI assist for descriptions and traits via local Ollama
