'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IBotInstance, IBettingStatsResponse } from '@/types';
import { groupSurebetDesks } from '@/lib/surebetDesks';
import PageHeader from '@/components/terminal/PageHeader';
import KpiCard from '@/components/terminal/KpiCard';
import StatusBadge from '@/components/terminal/StatusBadge';
import LoadingState from '@/components/terminal/LoadingState';
import EmptyState from '@/components/terminal/EmptyState';
import type { Execution, Tip } from '@/lib/terminal/surebetTypes';
import CumulativePnLChart from '@/components/stats/CumulativePnLChart';
import { formatSignedUnits } from '@/components/stats/formatStats';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [instances, setInstances] = useState<IBotInstance[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [hubError, setHubError] = useState<string | null>(null);
  const [stats, setStats] = useState<IBettingStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;
    const load = async () => {
      try {
        const [instRes, sureRes] = await Promise.all([
          fetch('/api/bot-instances'),
          fetch('/api/surebets', { cache: 'no-store' }),
        ]);
        if (cancelled) return;
        if (instRes.ok) {
          const data = await instRes.json();
          setInstances(Array.isArray(data) ? data : []);
        }
        const sureData = await sureRes.json().catch(() => ({}));
        if (!sureRes.ok) setHubError(sureData?.error ?? `Hub ${sureRes.status}`);
        else setHubError(null);
        setTips(Array.isArray(sureData?.tips) ? sureData.tips : []);
        setExecutions(Array.isArray(sureData?.executions) ? sureData.executions : []);
      } catch (e) {
        if (!cancelled) setHubError((e as Error)?.message ?? 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const id = setInterval(() => void load(), 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status]);

  const desks = useMemo(() => groupSurebetDesks(instances), [instances]);

  useEffect(() => {
    const firstId = desks[0]?.betonline?._id || desks[0]?.ps3838?._id;
    if (!firstId) {
      setStats(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bot-instances/${firstId}/stats?period=month`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStats(data as IBettingStatsResponse);
      } catch {
        /* stats optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [desks]);

  if (status === 'loading' || loading) return <LoadingState label="Loading terminal…" />;
  if (!session) return null;

  const alerts = executions.filter((e) => e.state === 'ONE_LEG' || e.state === 'REVIEW_NEEDED');
  const pnl = stats?.performance?.netPnL;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user?.name ?? 'operator'}. Live tips and executions from your hub client.`}
        actions={
          <Link href="/dashboard/opportunities" className="pt-btn pt-btn--primary">
            Open board
          </Link>
        }
      />

      <div className="pt-kpi-grid">
        <KpiCard label="Open tips" value={tips.length} hint={hubError ? 'Hub issue' : 'From hub'} />
        <KpiCard label="Surebet bots" value={desks.length} hint="BetOnline + PS3838 desks" />
        <KpiCard label="Recent runs" value={executions.length} hint={`${alerts.length} need attention`} />
        <KpiCard
          label="Realized P&L"
          value={pnl == null ? '—' : formatSignedUnits(pnl)}
          hint={stats ? 'First bot · last month UTC' : 'No instance stats yet'}
        />
      </div>

      {hubError ? (
        <div className="mb-4 pt-card text-sm text-[color:#f87171]">{hubError}</div>
      ) : null}

      <div className="pt-grid-2">
        <div className="pt-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="pt-card__title !mb-0">Open tips</h2>
            <Link href="/dashboard/opportunities" className="text-xs text-[color:var(--pt-primary)]">
              Open board
            </Link>
          </div>
          {tips.length === 0 ? (
            <EmptyState title="No open tips" message="Waiting for hub tips." />
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Sport</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {tips.slice(0, 8).map((tip) => (
                    <tr key={tip.tipId}>
                      <td className="font-medium">{tip.eventName}</td>
                      <td>{tip.sport}</td>
                      <td className="text-[color:var(--pt-cyan)]">{tip.profitPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="pt-card">
            <h2 className="pt-card__title">Recent executions</h2>
            {executions.length === 0 ? (
              <EmptyState title="No executions" />
            ) : (
              <ul className="space-y-2">
                {executions.slice(0, 6).map((e) => (
                  <li key={e.executionId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-mono text-xs">{e.executionId}</span>
                    <StatusBadge state={e.state} />
                  </li>
                ))}
              </ul>
            )}
            <Link href="/dashboard/history" className="mt-3 inline-block text-xs text-[color:var(--pt-primary)]">
              History
            </Link>
          </div>

          <div className="pt-card">
            <h2 className="pt-card__title">Bots</h2>
            {desks.length === 0 ? (
              <EmptyState title="No surebet bots" message="Create a desk with both bookmaker logins." />
            ) : (
              <ul className="space-y-2 text-sm">
                {desks.slice(0, 5).map((d) => (
                  <li key={d.deskId} className="flex justify-between gap-2">
                    <span>{d.name}</span>
                    <span className="text-[color:var(--pt-muted)] text-xs">
                      {[d.betonline ? 'BOL' : null, d.ps3838 ? 'PS' : null].filter(Boolean).join('+')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/dashboard/bots" className="mt-3 inline-block text-xs text-[color:var(--pt-primary)]">
              Manage bots
            </Link>
          </div>
        </div>
      </div>

      {stats?.series?.cumulativePnLByDay?.length ? (
        <div className="mt-4 pt-card">
          <h2 className="pt-card__title">Cumulative P&L (first bot · month)</h2>
          <CumulativePnLChart points={stats.series.cumulativePnLByDay} />
        </div>
      ) : null}
    </div>
  );
}
