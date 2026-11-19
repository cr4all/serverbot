'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import OpportunityBoard from '@/components/terminal/OpportunityBoard';
import { BoardPageSkeleton } from '@/components/terminal/Skeleton';

export default function OpportunitiesPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'unauthenticated') return null;
  if (status === 'loading') return <BoardPageSkeleton />;

  return <OpportunityBoard />;
}
