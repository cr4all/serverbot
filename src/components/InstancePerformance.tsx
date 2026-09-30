'use client';

import { useEffect, useState } from 'react';
import type { InstanceBetStats, StatsPeriodType } from '@/lib/bettingStats';
import StatsKpiGrid from '@/components/StatsKpiGrid';
import ResultBreakdownBar from '@/components/ResultBreakdownBar';
import CumulativePnLChart from '@/components/CumulativePnLChart';

function isEmpty(stats: InstanceBetStats): boolean {
  return (
    stats.execution.betsPlaced === 0 &&
    stats.execution.submitFailed === 0 &&
    stats.settlement.settled === 0 &&
    stats.settlement.pending === 0
  );
}

export default function InstancePerformance({ instanceId }: { instanceId: string }) {
  const [period, setPeriod] = useState<StatsPeriodType>('week');
  const [stats, setStats] = useState<InstanceBetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/bot-instances/${instanceId}/stats?period=${period}&offset=0`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load performance');
        }
        const data = (await res.json()) as InstanceBetStats;
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) {
          setStats(null);
          setError(e instanceof Error ? e.message : 'Failed to load performance');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [instanceId, period]);

  return (
    <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Performance</h3>
        <div className="inline-flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-600" role="group" aria-label="Stats period">
          {(['week', 'month'] as const).map((value, idx) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`px-3 py-1.5 text-sm font-medium ${
                period === value
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
              } ${idx > 0 ? 'border-l border-gray-200 dark:border-gray-600' : ''}`}
            >
              {value === 'week' ? 'This week' : 'This month'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : stats && isEmpty(stats) ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No bets in this period.</p>
      ) : stats ? (
        <div className="space-y-6">
          <StatsKpiGrid stats={stats} />
          {stats.settlement.pending > 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {stats.settlement.pending} bet{stats.settlement.pending === 1 ? '' : 's'} awaiting settlement
            </p>
          ) : null}
          <ResultBreakdownBar settlement={stats.settlement} />
          <CumulativePnLChart series={stats.series.cumulativePnLByDay} />
        </div>
      ) : null}
    </section>
  );
}
