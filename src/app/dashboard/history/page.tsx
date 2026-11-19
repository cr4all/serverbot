'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { IBettingStatsResponse, IBotInstance } from '@/types';
import { groupSurebetDesks } from '@/lib/surebetDesks';
import PageHeader from '@/components/terminal/PageHeader';
import KpiCard from '@/components/terminal/KpiCard';
import EmptyState from '@/components/terminal/EmptyState';
import ErrorState from '@/components/terminal/ErrorState';
import StatusBadge from '@/components/terminal/StatusBadge';
import { HistoryPageSkeleton, KpiGridSkeleton, PanelSkeleton, SkeletonRegion } from '@/components/terminal/Skeleton';
import CumulativePnLChart from '@/components/stats/CumulativePnLChart';
import ResultBreakdownBar from '@/components/stats/ResultBreakdownBar';
import { formatPercent, formatSignedUnits } from '@/components/stats/formatStats';
import type { Execution, Tip } from '@/lib/terminal/surebetTypes';
import { formatExecutionReason } from '@/lib/formatExecutionReason';

type BetRow = {
  _id?: string;
  createdAt?: string;
  stake?: number;
  odds?: number;
  selection?: string;
  eventName?: string;
  bookmaker?: string;
  settlement?: { result?: string; profit?: number };
  [key: string]: unknown;
};

type Tab = 'executions' | 'bets' | 'analytics';

export default function HistoryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('executions');
  const [instances, setInstances] = useState<IBotInstance[]>([]);
  const [instanceId, setInstanceId] = useState('');
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [stats, setStats] = useState<IBettingStatsResponse | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'all' | 'DONE' | 'ABORTED' | 'ONE_LEG' | 'REVIEW_NEEDED'>('all');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const [instRes, sureRes] = await Promise.all([
          fetch('/api/bot-instances'),
          fetch('/api/surebets', { cache: 'no-store' }),
        ]);
        if (cancelled) return;
        if (instRes.ok) {
          const data = await instRes.json();
          const list = Array.isArray(data) ? data : [];
          setInstances(list);
          const desks = groupSurebetDesks(list);
          const first = desks[0]?.betonline?._id || desks[0]?.ps3838?._id || list[0]?._id;
          if (first) setInstanceId(String(first));
        }
        const sureData = await sureRes.json().catch(() => ({}));
        if (!sureRes.ok) setError(sureData?.error ?? `Hub ${sureRes.status}`);
        else setError(null);
        setTips(Array.isArray(sureData?.tips) ? sureData.tips : []);
        setExecutions(Array.isArray(sureData?.executions) ? sureData.executions : []);
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message ?? 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const id = setInterval(() => {
      void fetch('/api/surebets', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          setTips(Array.isArray(data?.tips) ? data.tips : []);
          setExecutions(Array.isArray(data?.executions) ? data.executions : []);
        })
        .catch(() => undefined);
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status]);

  const options = useMemo(() => {
    const desks = groupSurebetDesks(instances);
    const opts: Array<{ id: string; label: string }> = [];
    for (const desk of desks) {
      const id = desk.betonline?._id || desk.ps3838?._id;
      if (id) opts.push({ id: String(id), label: desk.name });
    }
    return opts;
  }, [instances]);

  useEffect(() => {
    if (!instanceId || tab !== 'bets') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bet-history/${instanceId}?limit=100`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (!cancelled) setError(data?.error ?? `Failed (${res.status})`);
          return;
        }
        const rows = Array.isArray(data) ? data : Array.isArray(data?.bets) ? data.bets : [];
        if (!cancelled) setBets(rows);
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message ?? 'Failed to load bet history');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instanceId, tab]);

  useEffect(() => {
    if (!instanceId || tab !== 'analytics') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bot-instances/${instanceId}/stats?period=month`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(data?.error ?? `Stats failed (${res.status})`);
          return;
        }
        if (!cancelled) setStats(data as IBettingStatsResponse);
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message ?? 'Failed to load stats');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instanceId, tab]);

  const filtered = useMemo(
    () => (stateFilter === 'all' ? executions : executions.filter((e) => e.state === stateFilter)),
    [executions, stateFilter]
  );
  const selected = filtered.find((e) => e.executionId === selectedId) ?? filtered[0] ?? null;
  const avgOpenRoi = useMemo(() => {
    if (!tips.length) return null;
    return tips.reduce((acc, t) => acc + (Number(t.profitPercent) || 0), 0) / tips.length;
  }, [tips]);

  if (status === 'unauthenticated') return null;
  if (status === 'loading' || loading) return <HistoryPageSkeleton />;

  return (
    <div>
      <PageHeader
        title="History"
        description="Executions, instance bet history, and realized stats in one place."
      />

      <div className="pt-filters">
        {(
          [
            ['executions', 'Executions'],
            ['bets', 'Bets'],
            ['analytics', 'Analytics'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`pt-btn ${tab === id ? 'pt-btn--primary' : 'pt-btn--ghost'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        {tab !== 'executions' ? (
          <select className="pt-select" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} aria-label="Instance">
            {options.length === 0 ? <option value="">No instances</option> : null}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="pt-select"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)}
            aria-label="State"
          >
            <option value="all">All states</option>
            <option value="DONE">DONE</option>
            <option value="ABORTED">ABORTED</option>
            <option value="ONE_LEG">ONE_LEG</option>
            <option value="REVIEW_NEEDED">REVIEW_NEEDED</option>
          </select>
        )}
      </div>

      {error ? <ErrorState message={error} /> : null}

      {tab === 'executions' ? (
        <div className="pt-grid-2">
          <div className="pt-card !p-0 overflow-hidden">
            {filtered.length === 0 ? (
              <EmptyState title="No executions" message="Runs from the Board appear here." />
            ) : (
              <div className="pt-table-wrap">
                <table className="pt-table">
                  <thead>
                    <tr>
                      <th>Execution</th>
                      <th>State</th>
                      <th>Stake</th>
                      <th>Tip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr
                        key={e.executionId}
                        className={selected?.executionId === e.executionId ? 'is-selected cursor-pointer' : 'cursor-pointer'}
                        onClick={() => setSelectedId(e.executionId)}
                      >
                        <td className="font-mono text-xs">{e.executionId}</td>
                        <td>
                          <StatusBadge state={e.state} />
                        </td>
                        <td>{e.totalStake}</td>
                        <td className="font-mono text-xs text-[color:var(--pt-muted)]">{e.tipId ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="pt-card">
            {!selected ? (
              <EmptyState title="Select an execution" />
            ) : (
              <>
                <h2 className="pt-card__title font-mono text-sm !normal-case tracking-normal">{selected.executionId}</h2>
                <StatusBadge state={selected.state} />
                <p className="mt-3 text-sm text-[color:var(--pt-muted)]">Stake {selected.totalStake}</p>
                {selected.tipId ? (
                  <p className="mt-1 text-xs text-[color:var(--pt-muted)]">
                    Tip {selected.tipId}
                    {tips.find((t) => t.tipId === selected.tipId)?.eventName
                      ? ` · ${tips.find((t) => t.tipId === selected.tipId)?.eventName}`
                      : ''}
                  </p>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed">
                  {formatExecutionReason(selected.note, selected.legs)}
                </p>
                <ul className="mt-4 space-y-2">
                  {selected.legs.map((leg) => (
                    <li key={`${selected.executionId}-${leg.bookmaker}`} className="rounded-md border border-[color:var(--pt-border)] px-3 py-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{leg.bookmaker}</span>
                        <StatusBadge state={leg.state} />
                      </div>
                      {leg.odds != null ? (
                        <p className="mt-1 text-xs text-[color:var(--pt-muted)]">Odds {leg.odds}</p>
                      ) : null}
                      {leg.orderId ? <p className="mt-1 font-mono text-xs text-[color:var(--pt-muted)]">{leg.orderId}</p> : null}
                      {leg.reason ? (
                        <p className="mt-1 text-xs text-[color:var(--pt-danger)]">
                          {formatExecutionReason(leg.reason, null)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'bets' ? (
        <div className="pt-card !p-0 overflow-hidden">
          {!instanceId ? (
            <EmptyState title="No instance" message="Create a surebet bot first." />
          ) : bets.length === 0 ? (
            <EmptyState title="No bet history" />
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Event</th>
                    <th>Stake</th>
                    <th>Odds</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((b, i) => (
                    <tr key={String(b._id ?? i)}>
                      <td className="text-xs text-[color:var(--pt-muted)]">
                        {b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}
                      </td>
                      <td>{String(b.eventName ?? b.selection ?? '—')}</td>
                      <td>{b.stake ?? '—'}</td>
                      <td>{b.odds ?? '—'}</td>
                      <td>
                        {b.settlement?.result ? (
                          <StatusBadge state={String(b.settlement.result).toUpperCase()} label={String(b.settlement.result)} />
                        ) : (
                          <span className="text-[color:var(--pt-muted)]">pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'analytics' ? (
        !instanceId ? (
          <div className="pt-card">
            <EmptyState title="No bot instance" />
          </div>
        ) : !stats ? (
          <SkeletonRegion label="Loading stats">
            <p className="pt-skel-caption">Loading analytics for this bot…</p>
            <KpiGridSkeleton />
            <div className="pt-grid-2" style={{ marginTop: '1.05rem' }}>
              <PanelSkeleton lines={5} />
              <PanelSkeleton lines={4} />
            </div>
          </SkeletonRegion>
        ) : (
          <>
            <div className="pt-kpi-grid">
              <KpiCard label="Realized P&L" value={formatSignedUnits(stats.performance.netPnL)} hint="Settled · last month UTC" />
              <KpiCard label="Realized ROI" value={formatPercent(stats.performance.roi)} />
              <KpiCard label="Win rate" value={formatPercent(stats.performance.winRate)} />
              <KpiCard
                label="Open tips avg ROI"
                value={avgOpenRoi == null ? '—' : `${avgOpenRoi.toFixed(2)}%`}
                hint="Expected from hub tips"
              />
            </div>
            <div className="pt-grid-2">
              <div className="pt-card">
                <h2 className="pt-card__title">Cumulative P&L</h2>
                <CumulativePnLChart points={stats.series.cumulativePnLByDay ?? []} />
              </div>
              <div className="pt-card">
                <h2 className="pt-card__title">Settlement</h2>
                <ResultBreakdownBar
                  won={stats.settlement.won}
                  lost={stats.settlement.lost}
                  draw={stats.settlement.draw}
                  void={stats.settlement.void}
                />
              </div>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
