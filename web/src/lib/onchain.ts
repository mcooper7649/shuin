import { toHex, type Hex } from 'viem';

/** Max bytes per data contract (EIP-170 limit minus the STOP prefix byte). Matches ShuinStore.MAX_CHUNK. */
export const MAX_CHUNK = 24_575;

/** Media budget for one mint transaction, keeping it well under the 16.7M per-tx gas cap. */
export const ONCHAIN_MEDIA_BUDGET = 48_000;

/** Collection cover thumbnails are stored inside contractURI, so they get a much smaller budget. */
export const ONCHAIN_COVER_BUDGET = 8_000;

/** Inline allowlists live in contractURI too; beyond this size they need IPFS. */
export const ONCHAIN_ALLOWLIST_MAX = 100;

export function chunk(bytes: Uint8Array): Hex[] {
  const out: Hex[] = [];
  for (let i = 0; i < bytes.length; i += MAX_CHUNK) out.push(toHex(bytes.subarray(i, i + MAX_CHUNK)));
  return out;
}

/** Rough gas for mintOnChain: ~230 gas/byte stored plus fixed mint overhead. Excludes the L1 data fee. */
export function estimateOnChainGas(bytes: number): bigint {
  return BigInt(Math.ceil(bytes * 230 + 350_000));
}

export type Compressed = { blob: Blob; mime: string; width?: number; height?: number; recompressed: boolean };

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Couldn’t read that image.'));
    };
    img.src = url;
  });
}

function encode(img: HTMLImageElement, maxDim: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve({ blob: b, w, h }) : reject(new Error('Image encoding failed.'))), 'image/webp', quality),
  );
}

/**
 * Fit an image under `budget` bytes for on-chain storage. Files already small enough are kept
 * byte-for-byte (so SVGs and animated GIFs survive); everything else is re-encoded as WebP,
 * stepping quality and then dimensions down until it fits.
 */
export async function fitImage(file: File, budget: number): Promise<Compressed> {
  if (file.size <= budget) return { blob: file, mime: file.type || 'image/png', recompressed: false };
  if (file.type === 'image/svg+xml') {
    throw new Error(`This SVG is ${(file.size / 1024).toFixed(0)} KB; on-chain SVGs must be under ${(budget / 1000).toFixed(0)} KB.`);
  }
  const img = await loadImage(file);
  for (const maxDim of [1600, 1200, 1024, 800, 640, 512, 384, 256, 192, 128]) {
    for (const q of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
      const { blob, w, h } = await encode(img, maxDim, q);
      if (blob.size <= budget) return { blob, mime: 'image/webp', width: w, height: h, recompressed: true };
    }
  }
  throw new Error('Couldn’t compress this image small enough for on-chain storage.');
}

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function jsonDataUri(data: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:application/json;base64,${btoa(bin)}`;
}
