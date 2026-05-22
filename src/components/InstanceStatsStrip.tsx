'use client';

import { useEffect, useState } from 'react';
import type { IBettingStatsResponse } from '@/types';
import {
    formatPercent,
    formatSignedUnits,
    pnlColorClass,
} from '@/components/stats/formatStats';

const INSTANCE_DISCLAIMER =
    'This instance · last calendar month (UTC) · includes mock/test bets';

interface InstanceStatsStripProps {
    botInstanceId: string;
    className?: string;
}

function formatMonthPeriodLabel(start: string, end: string): string {
    try {
        const s = new Date(start);
        const e = new Date(end);
        const fmtMonth = (d: Date) =>
            d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
            return fmtMonth(s);
        }
        const fmt = (d: Date) =>
            d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `${fmt(s)} – ${fmt(e)}`;
    } catch {
        return 'Last month';
    }
}

function pnlAccentClass(n: number): string {
    if (n > 0) {
        return 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-white dark:border-emerald-800/50 dark:from-emerald-950/40 dark:via-gray-900/60 dark:to-gray-900/40';
    }
    if (n < 0) {
        return 'border-red-200/80 bg-gradient-to-br from-red-50/90 via-white to-white dark:border-red-900/50 dark:from-red-950/35 dark:via-gray-900/60 dark:to-gray-900/40';
    }
    return 'border-gray-200/90 bg-gradient-to-br from-gray-50/80 via-white to-white dark:border-gray-700 dark:from-gray-800/50 dark:via-gray-900/50 dark:to-gray-900/40';
}

function pnlBarClass(n: number): string {
    if (n > 0) return 'bg-emerald-500';
    if (n < 0) return 'bg-red-500';
    return 'bg-gray-400 dark:bg-gray-500';
}

function TrendIcon({ positive }: { positive: boolean }) {
    return (
        <svg
            className={`h-4 w-4 shrink-0 ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
        >
            {positive ? (
                <path
                    fillRule="evenodd"
                    d="M10 3a.75.75 0 01.55.24l5.25 5.5a.75.75 0 11-1.08 1.04L10 5.27 5.28 9.78a.75.75 0 01-1.08-1.04l5.25-5.5A.75.75 0 0110 3z"
                    clipRule="evenodd"
                />
            ) : (
                <path
                    fillRule="evenodd"
                    d="M10 17a.75.75 0 01-.55-.24l-5.25-5.5a.75.75 0 111.08-1.04L10 14.73l4.72-4.51a.75.75 0 111.08 1.04l-5.25 5.5A.75.75 0 0110 17z"
                    clipRule="evenodd"
                />
            )}
        </svg>
    );
}

export default function InstanceStatsStrip({ botInstanceId, className = '' }: InstanceStatsStripProps) {
    const [stats, setStats] = useState<IBettingStatsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!botInstanceId) {
            setStats(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(false);

        (async () => {
            try {
                const res = await fetch(
                    `/api/bot-instances/${botInstanceId}/stats?period=month&offset=-1`
                );
                if (!res.ok) throw new Error('fetch failed');
                const data = (await res.json()) as IBettingStatsResponse;
                if (!cancelled) setStats(data);
            } catch {
                if (!cancelled) {
                    setStats(null);
                    setError(true);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [botInstanceId]);

    const boxClass = `relative overflow-hidden rounded-xl border shadow-sm px-3 py-2.5 min-h-[4.5rem] ${className}`;

    if (loading) {
        return (
            <div className={`${boxClass} border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-900/40`}>
                <div className="flex items-center gap-3 animate-pulse">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div
                className={`${boxClass} border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-900/40`}
                title={INSTANCE_DISCLAIMER}
            >
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-600 dark:text-gray-300">Last month · </span>
                    Stats unavailable
                </p>
            </div>
        );
    }

    const netPnL = stats.performance.netPnL;
    const periodLabel = formatMonthPeriodLabel(stats.period.start, stats.period.end);
    const hasWinRate = stats.settlement.won + stats.settlement.lost > 0;
    const roiDisplay =
        stats.performance.totalStakedSettled > 0 ? formatPercent(stats.performance.roi) : '—';

    return (
        <div
            className={`${boxClass} ${pnlAccentClass(netPnL)}`}
            title={INSTANCE_DISCLAIMER}
        >
            {netPnL !== 0 && (
                <div
                    className={`absolute left-0 top-0 h-full w-1 ${pnlBarClass(netPnL)}`}
                    aria-hidden
                />
            )}
            <div className={netPnL !== 0 ? 'pl-2' : ''}>
                <div className="flex items-center gap-2.5">
                    <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            netPnL > 0
                                ? 'bg-emerald-100 dark:bg-emerald-900/40'
                                : netPnL < 0
                                  ? 'bg-red-100 dark:bg-red-900/40'
                                  : 'bg-gray-100 dark:bg-gray-800'
                        }`}
                    >
                        {netPnL !== 0 && <TrendIcon positive={netPnL > 0} />}
                        {netPnL === 0 && (
                            <span className="text-xs font-bold text-gray-400">—</span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {periodLabel} · Net PnL
                        </p>
                        <p
                            className={`text-base font-bold tabular-nums leading-tight ${pnlColorClass(netPnL)}`}
                        >
                            {formatSignedUnits(netPnL)}
                        </p>
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                        {hasWinRate && (
                            <div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">Win</p>
                                <p className="text-xs font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                                    {formatPercent(stats.performance.winRate)}
                                </p>
                            </div>
                        )}
                        <div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">ROI</p>
                            <p
                                className={`text-xs font-semibold tabular-nums ${pnlColorClass(stats.performance.roi)}`}
                            >
                                {roiDisplay}
                            </p>
                        </div>
                    </div>
                </div>
                <p className="mt-2 text-[10px] leading-snug text-gray-400 dark:text-gray-500">
                    Settled {stats.settlement.settled} · Placed {stats.execution.betsPlaced}
                    {stats.settlement.pending > 0 ? ` · Pending ${stats.settlement.pending}` : ''}
                </p>
            </div>
        </div>
    );
}
