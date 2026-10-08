import { createHash } from 'node:crypto';

/**
 * Local-dev stand-in for IPFS, used when PINATA_JWT isn't set outside production.
 * Lets the whole mint flow run against a local chain without any API keys.
 */
type Entry = { type: string; bytes: Buffer };
const g = globalThis as unknown as { __shuinDevStore?: Map<string, Entry> };
const store = (g.__shuinDevStore ??= new Map());

export const devStoreEnabled = () => !process.env.PINATA_JWT && process.env.NODE_ENV !== 'production';

export async function devPut(file: Blob): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const cid = 'bafydev' + createHash('sha256').update(bytes).digest('hex').slice(0, 40);
  store.set(cid, { type: file.type || 'application/octet-stream', bytes });
  return cid;
}

export const devGet = (cid: string) => store.get(cid);
