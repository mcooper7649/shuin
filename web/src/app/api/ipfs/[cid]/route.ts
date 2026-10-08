import { NextResponse } from 'next/server';
import { devGet, devStoreEnabled } from '@/lib/server/devStore';

export const runtime = 'nodejs';

/** Dev-only gateway for files held by the local dev store. */
export async function GET(_req: Request, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const entry = devStoreEnabled() ? devGet(cid) : undefined;
  if (!entry) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(entry.bytes), { headers: { 'content-type': entry.type } });
}
