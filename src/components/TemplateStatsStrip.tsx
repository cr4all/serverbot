'use client';

import { useEffect, useState } from 'react';
import type { TemplateBetStats } from '@/lib/bettingStats';
import { TEMPLATE_STATS_FOOTNOTE, formatSignedUnits } from '@/lib/stats/formatStats';

export default function TemplateStatsStrip({
  botId,
  compact = false,
}: {
  botId: string;
  compact?: boolean;
}) {
  const [stats, setStats] = useState<TemplateBetStats | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState('loading');
      try {
        const res = await fetch(`/api/bots/${botId}/template-stats?period=month&offset=-1`);
        if (!res.ok) throw new Error('failed');
        const data = (await res.json()) as TemplateBetStats;
        if (!cancelled) {
          setStats(data);
          setState('ready');
        }
      } catch {
        if (!cancelled) setState('error');
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [botId]);

  const label =
    state === 'loading'
      ? 'Last month profit · …'
      : state === 'error'
        ? 'Last month profit: unavailable'
        : stats?.insufficientData
          ? 'Last month profit: not enough data'
          : `Last month profit · ${formatSignedUnits(stats?.performance.netPnL ?? 0)}`;

  return (
    <div className={compact ? 'mt-2' : 'mt-3'} title={TEMPLATE_STATS_FOOTNOTE}>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
      {compact ? null : (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{TEMPLATE_STATS_FOOTNOTE}</p>
      )}
    </div>
  );
}
