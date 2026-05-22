'use client';

import { useEffect, useState } from 'react';
import type { ITemplateBettingStatsResponse } from '@/types';
import { formatPercent, formatSignedMoney, pnlColorClass } from '@/components/stats/formatStats';

const DISCLAIMER =
    'All users · last calendar month · settled bets only · mock/test bets excluded';

interface TemplateStatsStripProps {
    botId: string | null | undefined;
    /** When false, skip fetch (e.g. hidden card) */
    enabled?: boolean;
    compact?: boolean;
    className?: string;
}

export default function TemplateStatsStrip({
    botId,
    enabled = true,
    compact = false,
    className = '',
}: TemplateStatsStripProps) {
    const [stats, setStats] = useState<ITemplateBettingStatsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!enabled || !botId) {
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
                    `/api/bots/${botId}/template-stats?period=month&offset=-1`
                );
                if (!res.ok) throw new Error('fetch failed');
                const data = (await res.json()) as ITemplateBettingStatsResponse;
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
    }, [botId, enabled]);

    if (!botId || !enabled) return null;

    const textSize = compact ? 'text-xs' : 'text-sm';
    const boxClass = compact
        ? 'rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 dark:border-gray-600 dark:bg-gray-900/40'
        : 'rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 dark:border-blue-900/40 dark:bg-blue-950/25';

    if (loading) {
        return (
            <div className={`${boxClass} ${className}`}>
                <div className={`animate-pulse ${compact ? 'h-4' : 'h-5'} w-full max-w-md rounded bg-gray-200 dark:bg-gray-700`} />
                {!compact && (
                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">{DISCLAIMER}</p>
                )}
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${boxClass} ${className}`} title={DISCLAIMER}>
                <p className={`${textSize} text-gray-500 dark:text-gray-400`}>
                    Last month stats unavailable
                </p>
            </div>
        );
    }

    if (!stats) return null;

    if (stats.insufficientData) {
        return (
            <div className={`${boxClass} ${className}`} title={DISCLAIMER}>
                <p className={`${textSize} text-gray-600 dark:text-gray-400`}>
                    Not enough settled bets last month
                    <span className="text-gray-400 dark:text-gray-500">
                        {' '}
                        (need {stats.minSettledRequired}+, have {stats.settlement.settled})
                    </span>
                </p>
                {!compact && (
                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">{DISCLAIMER}</p>
                )}
            </div>
        );
    }

    const winLabel =
        stats.settlement.won + stats.settlement.lost > 0
            ? formatPercent(stats.performance.winRate)
            : '—';
    const roiLabel =
        stats.performance.totalStakedSettled > 0
            ? formatPercent(stats.performance.roi)
            : '—';

    return (
        <div className={`${boxClass} ${className}`} title={DISCLAIMER}>
            <p className={`${textSize} font-medium text-gray-800 dark:text-gray-200`}>
                <span className="text-gray-500 dark:text-gray-400">Last month · </span>
                <span>{stats.settlement.settled} settled</span>
                <span className="text-gray-400 dark:text-gray-500"> · </span>
                <span>{winLabel} win</span>
                <span className="text-gray-400 dark:text-gray-500"> · </span>
                <span className={pnlColorClass(stats.performance.netPnL)}>
                    {formatSignedMoney(stats.performance.netPnL)} PnL
                </span>
                <span className="text-gray-400 dark:text-gray-500"> · </span>
                <span className={pnlColorClass(stats.performance.roi)}>{roiLabel} ROI</span>
            </p>
            {!compact && (
                <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">{DISCLAIMER}</p>
            )}
        </div>
    );
}
