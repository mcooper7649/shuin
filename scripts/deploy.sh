#!/usr/bin/env bash
# Deploy the Shuin factory + Open Book to a chain with the shuin-deployer keystore.
# Idempotent: re-running skips whatever is already deployed.
#   scripts/deploy.sh base | base-sepolia | sepolia [--verify]
set -euo pipefail
cd "$(dirname "$0")/../contracts"

case "${1:-}" in
  base)         rpc=${BASE_RPC_URL:-https://mainnet.base.org} ;;
  base-sepolia) rpc=${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org} ;;
  sepolia)      rpc=${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com} ;;
  *) echo "usage: $0 base|base-sepolia|sepolia [--verify]" >&2; exit 1 ;;
esac
shift

pwfile=${SHUIN_DEPLOYER_PASSWORD_FILE:-$HOME/.config/shuin/deployer.pw}
forge script script/Deploy.s.sol --rpc-url "$rpc" --account shuin-deployer --password-file "$pwfile" --broadcast "$@"
