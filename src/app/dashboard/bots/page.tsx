'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { IBotInstance } from '@/types';
import MessageDialog from '@/components/MessageDialog';
import SurebetCredentialsDialog from '@/components/SurebetCredentialsDialog';
import SurebetBotCard from '@/components/SurebetBotCard';
import { groupSurebetDesks, type SurebetDesk } from '@/lib/surebetDesks';
import PageHeader from '@/components/terminal/PageHeader';
import EmptyState from '@/components/terminal/EmptyState';
import { BotsPageSkeleton } from '@/components/terminal/Skeleton';

export default function BotsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [instances, setInstances] = useState<IBotInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [activeDesk, setActiveDesk] = useState<SurebetDesk | null>(null);
  const [messageDialog, setMessageDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'warning' | 'danger' | 'success';
  }>({ open: false, title: '', message: '', variant: 'info' });

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    else if (status === 'authenticated') void fetchInstances();
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const interval = setInterval(() => void fetchInstances(), 30_000);
    return () => clearInterval(interval);
  }, [status]);

  const fetchInstances = async () => {
    try {
      const res = await fetch(`/api/bot-instances`);
      if (res.ok) setInstances(await res.json());
    } catch (error) {
      console.error('Failed to fetch instances', error);
    } finally {
      setLoading(false);
    }
  };

  const desks = useMemo(() => groupSurebetDesks(instances), [instances]);

  const openCreate = () => {
    setDialogMode('create');
    setActiveDesk(null);
    setCredentialsOpen(true);
  };

  const openCredentials = (desk: SurebetDesk) => {
    setDialogMode('edit');
    setActiveDesk(desk);
    setCredentialsOpen(true);
  };

  const deleteDesk = async (desk: SurebetDesk) => {
    if (!confirm(`Delete “${desk.name}”? Both bookmaker logins for this bot will be removed.`)) return;
    try {
      await Promise.all(
        [desk.betonline, desk.ps3838]
          .filter(Boolean)
          .map((instance) => fetch(`/api/bot-instances/${instance!._id}`, { method: 'DELETE' }))
      );
      void fetchInstances();
    } catch (e) {
      console.error(e);
      setMessageDialog({
        open: true,
        title: 'Delete failed',
        message: 'Could not remove this bot. Try again.',
        variant: 'danger',
      });
    }
  };

  if (status === 'unauthenticated') return null;
  if (status === 'loading' || loading || !session) return <BotsPageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Bots"
        description="Surebet desks pair BetOnline and PS3838 credentials. OTP challenges appear when a bookmaker login needs a code."
        actions={
          <button type="button" className="pt-btn pt-btn--primary" onClick={openCreate}>
            New surebet bot
          </button>
        }
      />

      <SurebetCredentialsDialog
        open={credentialsOpen}
        onClose={() => setCredentialsOpen(false)}
        onSuccess={fetchInstances}
        mode={dialogMode}
        deskId={activeDesk?.deskId}
        deskName={activeDesk?.name}
        betonline={activeDesk?.betonline ?? null}
        ps3838={activeDesk?.ps3838 ?? null}
        defaultName={`Surebet bot ${desks.length + 1}`}
      />

      <MessageDialog
        open={messageDialog.open}
        title={messageDialog.title}
        message={messageDialog.message}
        variant={messageDialog.variant}
        onClose={() => setMessageDialog({ open: false, title: '', message: '', variant: 'info' })}
      />

      {desks.length === 0 ? (
        <div className="pt-card">
          <EmptyState
            title="No surebet bots yet"
            message="Create a bot with both bookmaker accounts. The board only fires when both legs can take the same tip."
          />
          <div className="mt-4 flex justify-center">
            <button type="button" className="pt-btn pt-btn--primary" onClick={openCreate}>
              Create surebet bot
            </button>
          </div>
        </div>
      ) : (
        <section className="sb-bot-grid" aria-label="Surebet bots">
          {desks.map((desk) => (
            <SurebetBotCard
              key={desk.deskId}
              desk={desk}
              onCredentials={() => openCredentials(desk)}
              onDelete={() => void deleteDesk(desk)}
              onStatusChange={() => void fetchInstances()}
            />
          ))}
        </section>
      )}
    </div>
  );
}
