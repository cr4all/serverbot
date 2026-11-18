'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingState from '@/components/terminal/LoadingState';

/** Merged into History — keep route for old bookmarks. */
export default function ExecutionsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/history');
  }, [router]);
  return <LoadingState label="Redirecting to History…" />;
}
