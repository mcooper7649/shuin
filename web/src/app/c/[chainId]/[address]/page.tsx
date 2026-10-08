import { notFound } from 'next/navigation';
import { isAddress } from 'viem';
import { CollectionView } from '@/components/CollectionView';
import { shrineFor } from '@/lib/chains';

type Params = { chainId: string; address: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { chainId } = await params;
  return { title: `Collection on ${shrineFor(Number(chainId))?.chain.name ?? 'chain'} · Shuin` };
}

export default async function CollectionPage({ params }: { params: Promise<Params> }) {
  const { chainId, address } = await params;
  if (!shrineFor(Number(chainId)) || !isAddress(address)) notFound();
  return <CollectionView chainId={Number(chainId)} address={address} />;
}
