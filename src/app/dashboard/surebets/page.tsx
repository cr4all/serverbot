'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RedirectSkeleton } from '@/components/terminal/Skeleton';

/** Legacy Live Run entry — Board is the canonical page. */
export default function SurebetsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/opportunities');
  }, [router]);
  return <RedirectSkeleton label="Redirecting to Board…" />;
}
