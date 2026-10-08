#!/usr/bin/env bash
# Rebuild the contracts, regenerate web/src/lib/abi.ts from the Foundry artifacts, and
# write the factory's CREATE2 address (it changes whenever the bytecode does) into chains.ts.
set -euo pipefail
cd "$(dirname "$0")/.."
(cd contracts && forge build)
python3 - <<'PY'
import json
out = "contracts/out"
parts = []
for name in ["ShuinCollection", "ShuinFactory"]:
    abi = json.load(open(f"{out}/{name}.sol/{name}.json"))["abi"]
    var = name[0].lower() + name[1:] + "Abi"
    parts.append(f"export const {var} = {json.dumps(abi, indent=2)} as const;\n")
open("web/src/lib/abi.ts", "w").write("// Generated from contracts/out by scripts/sync-abi.sh. Don't edit by hand.\n\n" + "\n".join(parts))
PY

# Simulate the deploy script (no RPC, nothing broadcast) to get the deterministic factory address.
factory=$(cd contracts && forge script script/Deploy.s.sol 2>/dev/null | awk '/factory/ {print $2}')
if [[ ! $factory =~ ^0x[0-9a-fA-F]{40}$ ]]; then echo "could not compute factory address" >&2; exit 1; fi
sed -i -E "s|(export const FACTORY_ADDRESS: Address = ')0x[0-9a-fA-F]{40}(';)|\\1${factory}\\2|" web/src/lib/chains.ts
sed -i -E "s|(same address on every chain: \`)0x[0-9a-fA-F]{40}|\\1${factory}|" README.md
echo "factory: $factory"
