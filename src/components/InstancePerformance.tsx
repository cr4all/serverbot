'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IBettingStatsResponse } from '@/types';
import StatsKpiGrid from '@/components/stats/StatsKpiGrid';
import CumulativePnLChart from '@/components/stats/CumulativePnLChart';
import ResultBreakdownBar from '@/components/stats/ResultBreakdownBar';
import { PERIOD_PRESETS, presetToApiQuery, type PeriodPreset } from '@/components/stats/periodPresets';

interface InstancePerformanceProps {
    instanceId: string;
}

export default function InstancePerformance({ instanceId }: InstancePerformanceProps) {
    const [preset, setPreset] = useState<PeriodPreset>('30d');
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Performance</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Submit metrics use bet time; settlement metrics use settled time. Includes mock/test bets.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-900/50">
                        {PERIOD_PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setPreset(p.id)}
                                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                                    preset === p.id
                                        ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300'
                                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
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
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {stats && !loading && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Period: {new Date(stats.period.start).toLocaleDateString()} –{' '}
                    {new Date(stats.period.end).toLocaleDateString()} (UTC)
                </p>
            )}

            {loading && (
                <div className="animate-pulse space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
                        ))}
                    </div>
                    <div className="h-40 rounded-lg bg-gray-200 dark:bg-gray-700" />
                </div>
            )}

            {error && !loading && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                </div>
            )}

            {stats && !loading && !error && (
                <>
                    {stats.settlement.pending > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                            {stats.settlement.pending} bet(s) awaiting settlement in this period.
                        </div>
                    )}

                    <StatsKpiGrid stats={stats} />

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Cumulative PnL</h3>
                            <CumulativePnLChart points={stats.series.cumulativePnLByDay} />
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Result breakdown</h3>
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
