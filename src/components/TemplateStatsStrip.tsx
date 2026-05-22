'use client';

import { useEffect, useState } from 'react';
import type { ITemplateBettingStatsResponse } from '@/types';
import {
    formatPercent,
    formatSignedUnits,
    pnlColorClass,
} from '@/components/stats/formatStats';

const DISCLAIMER =
    'All users · last calendar month · settled bets only · mock/test bets excluded';

interface TemplateStatsStripProps {
    botId: string | null | undefined;
    /** When false, skip fetch (e.g. hidden card) */
    enabled?: boolean;
    compact?: boolean;
    className?: string;
}

function formatPeriodLabel(start: string, end: string): string {
    try {
        const s = new Date(start);
        const e = new Date(end);
        const fmt = (d: Date) =>
            d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
        if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
            return fmt(s);
        }
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

function MiniMetric({
    label,
    value,
    valueClassName = 'text-gray-800 dark:text-gray-100',
}: {
    label: string;
    value: string;
    valueClassName?: string;
}) {
    return (
        <div className="min-w-0 rounded-md border border-gray-200/80 bg-white/70 px-2.5 py-1.5 dark:border-gray-600/60 dark:bg-gray-800/50">
            <p className="truncate text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {label}
            </p>
            <p className={`mt-0.5 text-sm font-semibold tabular-nums leading-tight ${valueClassName}`}>
                {value}
            </p>
        </div>
    );
}

function StripShell({
    children,
    compact,
    accentPnL,
    className,
    title,
}: {
    children: React.ReactNode;
    compact: boolean;
    accentPnL?: number;
    className?: string;
    title?: string;
}) {
    const accent =
        accentPnL !== undefined ? pnlAccentClass(accentPnL) : 'border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-900/40';
    return (
        <div
            className={`relative overflow-hidden rounded-xl border shadow-sm ${accent} ${
                compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
            } ${className ?? ''}`}
            title={title}
        >
            {accentPnL !== undefined && accentPnL !== 0 && (
                <div
                    className={`absolute left-0 top-0 h-full w-1 ${pnlBarClass(accentPnL)}`}
                    aria-hidden
                />
            )}
            <div className={accentPnL !== undefined && accentPnL !== 0 ? 'pl-2' : ''}>
                {children}
            </div>
        </div>
    );
}

function LoadingSkeleton({ compact, className }: { compact: boolean; className?: string }) {
    return (
        <StripShell compact={compact} className={className}>
            <div className="flex items-center gap-3">
                <div
                    className={`shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700 ${compact ? 'h-9 w-9' : 'h-11 w-11'} animate-pulse`}
                />
                <div className="min-w-0 flex-1 space-y-2">
                    <div className={`rounded bg-gray-200 dark:bg-gray-700 ${compact ? 'h-3 w-24' : 'h-3 w-32'} animate-pulse`} />
                    <div className={`rounded bg-gray-200 dark:bg-gray-700 ${compact ? 'h-5 w-36' : 'h-7 w-44'} animate-pulse`} />
                    {!compact && (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-10 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {!compact && (
                <p className="mt-2.5 text-[10px] text-gray-400 dark:text-gray-500">{DISCLAIMER}</p>
            )}
        </StripShell>
    );
}

function StatsContent({
    stats,
    compact,
}: {
    stats: ITemplateBettingStatsResponse;
    compact: boolean;
}) {
    const { performance, settlement, period } = stats;
    const netPnL = performance.netPnL;
    const periodLabel = formatPeriodLabel(period.start, period.end);
    const hasWinRate = settlement.won + settlement.lost > 0;
    const roiDisplay =
        performance.totalStakedSettled > 0 ? formatPercent(performance.roi) : '—';

    const heroValue = (
        <span className={`font-bold tabular-nums tracking-tight ${pnlColorClass(netPnL)}`}>
            {formatSignedUnits(netPnL)}
        </span>
    );

    if (compact) {
        return (
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
                    <p className="text-base leading-tight">{heroValue}</p>
                </div>
                {hasWinRate && (
                    <div className="shrink-0 text-right">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Win</p>
                        <p className="text-xs font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                            {formatPercent(performance.winRate)}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                    <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner ${
                            netPnL > 0
                                ? 'bg-emerald-100 ring-1 ring-emerald-200/60 dark:bg-emerald-900/50 dark:ring-emerald-800/40'
                                : netPnL < 0
                                  ? 'bg-red-100 ring-1 ring-red-200/60 dark:bg-red-900/50 dark:ring-red-900/40'
                                  : 'bg-gray-100 ring-1 ring-gray-200/60 dark:bg-gray-800 dark:ring-gray-700'
                        }`}
                    >
                        {netPnL !== 0 && <TrendIcon positive={netPnL > 0} />}
                        {netPnL === 0 && (
                            <svg
                                className="h-5 w-5 text-gray-400"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden
                            >
                                <path d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-gray-900/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:bg-white/10 dark:text-gray-300">
                                Template performance
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">{periodLabel}</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Net profit (units)</p>
                        <p className="mt-0.5 text-2xl leading-none">{heroValue}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <MiniMetric
                    label="ROI"
                    value={roiDisplay}
                    valueClassName={pnlColorClass(performance.roi)}
                />
                <MiniMetric
                    label="Win rate"
                    value={hasWinRate ? formatPercent(performance.winRate) : '—'}
                />
                <MiniMetric label="Settled" value={String(settlement.settled)} />
            </div>

            {settlement.settled > 0 && (
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-700">
                    {(
                        [
                            { n: settlement.won, cls: 'bg-emerald-500' },
                            { n: settlement.lost, cls: 'bg-red-500' },
                            { n: settlement.draw, cls: 'bg-amber-500' },
                            { n: settlement.void, cls: 'bg-gray-400 dark:bg-gray-500' },
                        ] as const
                    ).map((seg, i) =>
                        seg.n > 0 ? (
                            <div
                                key={i}
                                className={seg.cls}
                                style={{ width: `${(seg.n / settlement.settled) * 100}%` }}
                                title={`${seg.n} bets`}
                            />
                        ) : null
                    )}
                </div>
            )}

            <p className="text-[10px] leading-snug text-gray-400 dark:text-gray-500">{DISCLAIMER}</p>
        </div>
    );
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

    if (loading) {
        return <LoadingSkeleton compact={compact} className={className} />;
    }

    if (error) {
        return (
            <StripShell compact={compact} className={className} title={DISCLAIMER}>
                <p
                    className={`${compact ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400`}
                >
                    <span className="font-medium text-gray-600 dark:text-gray-300">Last month · </span>
                    Profit data unavailable
                </p>
            </StripShell>
        );
    }

    if (!stats) return null;

    if (stats.insufficientData) {
        return (
            <StripShell compact={compact} className={className} title={DISCLAIMER}>
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <svg
                            className="h-4 w-4 text-amber-600 dark:text-amber-400"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden
                        >
                            <path
                                fillRule="evenodd"
                                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 0010 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                    <div>
                        <p
                            className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-700 dark:text-gray-300`}
                        >
                            Not enough settled data
                        </p>
                        {!compact && (
                            <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                                Need at least {stats.minSettledRequired} settled bets · {DISCLAIMER}
                            </p>
                        )}
                    </div>
                </div>
            </StripShell>
        );
    }

    return (
        <StripShell compact={compact} accentPnL={stats.performance.netPnL} className={className} title={DISCLAIMER}>
            <StatsContent stats={stats} compact={compact} />
        </StripShell>
    );
}
