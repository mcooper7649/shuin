import { NextRequest, NextResponse } from 'next/server';
import { devPut, devStoreEnabled } from '@/lib/server/devStore';

export const runtime = 'nodejs';

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = /^(image\/(png|jpeg|gif|webp|svg\+xml|avif)|video\/(mp4|webm|quicktime)|audio\/(mpeg|wav|ogg|flac|mp4|x-wav)|model\/gltf-binary|model\/gltf\+json|application\/json|application\/octet-stream)$/;

// Simple per-IP limit so an open upload endpoint can't be used as free storage.
// In-memory is fine for a single container; swap for Redis if this ever scales out.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt && !devStoreEnabled()) {
    return NextResponse.json({ error: 'Uploads are not configured on this server.' }, { status: 503 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many uploads, try again in a few minutes.' }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file in request.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Files are limited to 50 MB.' }, { status: 413 });
  }
  const name = 'name' in file && typeof file.name === 'string' && file.name ? file.name : 'upload';
  // Browsers report .glb as an empty type or octet-stream; only allow that for model files.
  const type = file.type || 'application/octet-stream';
  if (!ALLOWED.test(type) || (type === 'application/octet-stream' && !/\.(glb|gltf)$/i.test(name))) {
    return NextResponse.json({ error: `Unsupported file type: ${type}` }, { status: 415 });
  }

  if (!jwt) {
    const cid = await devPut(file);
    return NextResponse.json({ cid, uri: `ipfs://${cid}` });
  }

  const upstream = new FormData();
  upstream.append('file', file, name);
  upstream.append('network', 'public');
  upstream.append('name', `shuin/${name}`);

  const res = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: upstream,
  });
  const body = await res.json().catch(() => null);
  const cid: string | undefined = body?.data?.cid;
  if (!res.ok || !cid) {
    console.error('pinata upload failed', res.status, body);
    return NextResponse.json({ error: 'IPFS upload failed.' }, { status: 502 });
  }
  return NextResponse.json({ cid, uri: `ipfs://${cid}` });
}

/** Lets the UI know whether IPFS uploads are available on this deployment. */
export async function GET() {
  return NextResponse.json({ enabled: !!process.env.PINATA_JWT || devStoreEnabled() });
}
