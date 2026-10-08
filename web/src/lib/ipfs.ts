const GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';

/** Turn ipfs://CID/path (or a bare CID) into a gateway URL; pass http(s) URLs through. */
export function gatewayUrl(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('ipfs://')) return GATEWAY + uri.slice('ipfs://'.length);
  if (/^(Qm|baf)[a-zA-Z0-9]+/.test(uri)) return GATEWAY + uri;
  return uri;
}

export type PinResult = { cid: string; uri: string };

/** Upload a file through our server route; the Pinata JWT never reaches the browser. */
export async function pinFile(file: File | Blob, name?: string): Promise<PinResult> {
  const form = new FormData();
  form.append('file', file, name ?? (file instanceof File ? file.name : 'blob'));
  const res = await fetch('/api/pin', { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
  return body as PinResult;
}

export function pinJson(data: unknown, name: string): Promise<PinResult> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  return pinFile(blob, name);
}

export type Trait = { trait_type: string; value: string };

export type MediaKind = 'image' | 'video' | 'audio' | 'model';

export function mediaKind(mime: string, filename = ''): MediaKind | undefined {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('model/') || /\.(glb|gltf)$/i.test(filename)) return 'model';
  return undefined;
}

/**
 * OpenSea-style metadata. Non-image media goes in animation_url, with the
 * optional poster/cover as image so marketplaces still have a thumbnail.
 */
export function buildMetadata(opts: {
  name: string;
  description: string;
  mediaUri: string;
  kind: MediaKind;
  posterUri?: string;
  traits: Trait[];
  externalUrl?: string;
}) {
  const attributes = opts.traits.filter((t) => t.trait_type.trim() && t.value.trim());
  const meta: Record<string, unknown> = {
    name: opts.name,
    description: opts.description,
    attributes,
  };
  if (opts.kind === 'image') {
    meta.image = opts.mediaUri;
  } else {
    meta.animation_url = opts.mediaUri;
    if (opts.posterUri) meta.image = opts.posterUri;
  }
  if (opts.externalUrl) meta.external_url = opts.externalUrl;
  return meta;
}
