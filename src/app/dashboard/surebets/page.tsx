'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingState from '@/components/terminal/LoadingState';

/** Legacy Live Run entry — Board is the canonical page. */
export default function SurebetsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/opportunities');
  }, [router]);
  return <LoadingState label="Redirecting to Board…" />;
}
