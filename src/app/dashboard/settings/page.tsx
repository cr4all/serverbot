'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/terminal/PageHeader';
import { SettingsPageSkeleton } from '@/components/terminal/Skeleton';
import ChangePasswordDialog from '@/app/components/ChangePasswordDialog';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'unauthenticated') return null;
  if (status === 'loading' || !session) return <SettingsPageSkeleton />;

  const user = session.user as { name?: string | null; email?: string | null; role?: string };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Profile from your session. Password changes use the existing API."
      />

      <div className="pt-card max-w-xl">
        <h2 className="pt-card__title">Profile</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--pt-muted)]">Name</dt>
            <dd>{user.name ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--pt-muted)]">Email</dt>
            <dd>{user.email ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--pt-muted)]">Role</dt>
            <dd className="uppercase tracking-wide text-xs font-semibold">{user.role ?? 'user'}</dd>
          </div>
        </dl>
        <button type="button" className="pt-btn pt-btn--primary mt-5" onClick={() => setPasswordOpen(true)}>
          Change password
        </button>
      </div>

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
