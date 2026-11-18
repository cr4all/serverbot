'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import OpportunityBoard from '@/components/terminal/OpportunityBoard';
import LoadingState from '@/components/terminal/LoadingState';

export default function OpportunitiesPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'loading') return <LoadingState />;
  if (status !== 'authenticated') return null;

  return <OpportunityBoard />;
}
