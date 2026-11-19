'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RedirectSkeleton } from '@/components/terminal/Skeleton';

export default function AnalyticsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/history');
  }, [router]);
  return <RedirectSkeleton label="Redirecting to History…" />;
}
