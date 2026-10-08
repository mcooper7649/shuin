'use client';

import { useQuery } from '@tanstack/react-query';

/** Whether this deployment has IPFS uploads configured (a Pinata JWT on the server). */
export function useIpfsEnabled(): boolean | undefined {
  const { data } = useQuery({
    queryKey: ['ipfs-enabled'],
    staleTime: Infinity,
    queryFn: async () => ((await (await fetch('/api/pin')).json()) as { enabled: boolean }).enabled,
  });
  return data;
}
