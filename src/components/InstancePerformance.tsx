'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IBettingStatsResponse } from '@/types';
import StatsKpiGrid from '@/components/stats/StatsKpiGrid';
import CumulativePnLChart from '@/components/stats/CumulativePnLChart';
import ResultBreakdownBar from '@/components/stats/ResultBreakdownBar';
import { PERIOD_PRESETS, presetToApiQuery, type PeriodPreset } from '@/components/stats/periodPresets';
import {
    formatPercent,
    formatSignedMoney,
    pnlColorClass,
} from '@/components/stats/formatStats';

interface InstancePerformanceProps {
    instanceId: string;
    /** When true, omits page-level title (used inside instance detail tab). */
    embedded?: boolean;
}

function PerformanceHero({ stats }: { stats: IBettingStatsResponse }) {
    const { performance, settlement } = stats;
    const hasWinRate = settlement.won + settlement.lost > 0;

    const neutralCard =
        'border-gray-200/80 bg-white dark:border-gray-700/80 dark:bg-gray-900/50';

    const items = [
        {
            label: 'Net PnL',
            value: formatSignedMoney(performance.netPnL),
            valueClass: pnlColorClass(performance.netPnL),
            boxClass:
                performance.netPnL > 0
                    ? 'border-emerald-200/80 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/35'
                    : performance.netPnL < 0
                      ? 'border-red-200/80 bg-red-50 dark:border-red-900/50 dark:bg-red-950/35'
                      : neutralCard,
        },
        {
            label: 'ROI',
            value:
                performance.totalStakedSettled > 0 ? formatPercent(performance.roi) : '—',
            valueClass: pnlColorClass(performance.roi),
            boxClass: neutralCard,
        },
        {
            label: 'Win rate',
            value: hasWinRate ? formatPercent(performance.winRate) : '—',
            valueClass: 'text-gray-900 dark:text-white',
            boxClass: neutralCard,
        },
        {
            label: 'Settled',
            value: String(settlement.settled),
            valueClass: 'text-gray-900 dark:text-white',
            boxClass: neutralCard,
            sub: `${settlement.pending} pending`,
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {items.map((item) => (
                <div
                    key={item.label}
                    className={`rounded-xl border p-4 ${item.boxClass}`}
                >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {item.label}
                    </p>
                    <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${item.valueClass}`}>
                        {item.value}
                    </p>
                    {item.sub && (
                        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">{item.sub}</p>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function InstancePerformance({
    instanceId,
    embedded = false,
}: InstancePerformanceProps) {
    const [preset, setPreset] = useState<PeriodPreset>('month');
    const [stats, setStats] = useState<IBettingStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { period, offset } = presetToApiQuery(preset);
        try {
            const res = await fetch(
                `/api/bot-instances/${instanceId}/stats?period=${period}&offset=${offset}`
            );
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Failed (${res.status})`);
            }
            const data = (await res.json()) as IBettingStatsResponse;
            setStats(data);
        } catch (e) {
            setStats(null);
            setError(e instanceof Error ? e.message : 'Failed to load stats');
        } finally {
            setLoading(false);
        }
    }, [instanceId, preset]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {!embedded && (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Performance</h2>
                        <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                            Submit metrics use bet time; settlement metrics use settled time. Includes
                            mock/test bets.
                        </p>
                    </div>
                )}
                {embedded && (
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                            Analytics
                        </h2>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            Bet-time vs settled-time metrics · includes mock/test bets
                        </p>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                    <div
                        className="flex max-w-full flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50/80 p-1 dark:border-gray-600 dark:bg-gray-900/50"
                        role="group"
                        aria-label="Period"
                    >
                        {PERIOD_PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setPreset(p.id)}
                                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                                    preset === p.id
                                        ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-800 dark:text-blue-300 dark:ring-gray-600'
                                        : 'text-gray-600 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-white'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => loadStats()}
                        disabled={loading}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
            </div>

            {stats && !loading && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-600 dark:text-gray-300">Period · </span>
                    {new Date(stats.period.start).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                    })}{' '}
                    –{' '}
                    {new Date(stats.period.end).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                    })}{' '}
                    <span className="text-gray-400">(UTC)</span>
                </p>
            )}

            {loading && (
                <div className="animate-pulse space-y-4">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-24 rounded-xl bg-gray-200/80 dark:bg-gray-700/80" />
                        ))}
                    </div>
                    <div className="h-48 rounded-xl bg-gray-200/80 dark:bg-gray-700/80" />
                </div>
            )}

            {error && !loading && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                </div>
            )}

            {stats && !loading && !error && (
                <>
                    {stats.settlement.pending > 0 && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                            <span className="mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden>
                                ●
                            </span>
                            <span>
                                <strong>{stats.settlement.pending}</strong> bet(s) awaiting settlement in
                                this period.
                            </span>
                        </div>
                    )}

                    <PerformanceHero stats={stats} />

                    <StatsKpiGrid stats={stats} />

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                        <div className="rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 dark:border-gray-700/80 dark:bg-gray-900/30">
                            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                                Cumulative PnL
                            </h3>
                            <CumulativePnLChart points={stats.series.cumulativePnLByDay} />
                        </div>
                        <div className="rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 dark:border-gray-700/80 dark:bg-gray-900/30">
                            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                                Result breakdown
                            </h3>
                            <ResultBreakdownBar
                                won={stats.settlement.won}
                                lost={stats.settlement.lost}
                                draw={stats.settlement.draw}
                                void={stats.settlement.void}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
