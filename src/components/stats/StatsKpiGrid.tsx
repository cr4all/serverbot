'use client';

import type { IBettingStatsResponse } from '@/types';
import { formatPercent, formatSignedMoney, pnlColorClass } from './formatStats';

interface KpiCardProps {
    label: string;
    value: string;
    valueClassName?: string;
    hint?: string;
    sub?: string;
}

function KpiCard({ label, value, valueClassName = '', hint, sub }: KpiCardProps) {
    return (
        <div
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            title={hint}
        >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClassName}`}>{value}</p>
            {sub && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
        </div>
    );
}

interface StatsKpiGridProps {
    stats: IBettingStatsResponse;
}

export default function StatsKpiGrid({ stats }: StatsKpiGridProps) {
    const { execution, settlement, performance, definitions } = stats;
    const submitDenom = execution.betsPlaced + execution.submitFailed;

    return (
        <div className="space-y-4">
            <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Execution (submitted)</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    <KpiCard label="Bets placed" value={String(execution.betsPlaced)} />
                    <KpiCard label="Submit failed" value={String(execution.submitFailed)} />
                    <KpiCard
                        label="Submit success"
                        value={formatPercent(execution.submitSuccessRate)}
                        sub={submitDenom > 0 ? `${execution.betsPlaced}/${submitDenom}` : '—'}
                    />
                    <KpiCard
                        label="Avg odds"
                        value={performance.avgOdds > 0 ? performance.avgOdds.toFixed(2) : '—'}
                        hint={definitions.avgOdds}
                    />
                </div>
            </div>

            <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Settlement</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    <KpiCard label="Settled" value={String(settlement.settled)} />
                    <KpiCard
                        label="Pending"
                        value={String(settlement.pending)}
                        sub={settlement.pending > 0 ? 'Awaiting result' : undefined}
                    />
                    <KpiCard
                        label="Win rate"
                        value={settlement.won + settlement.lost > 0 ? formatPercent(performance.winRate) : '—'}
                        hint={definitions.winRate}
                    />
                    <KpiCard label="W / L / D / V" value={`${settlement.won} / ${settlement.lost} / ${settlement.draw} / ${settlement.void}`} />
                </div>
            </div>

            <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Performance (settled)</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <KpiCard
                        label="Net PnL"
                        value={formatSignedMoney(performance.netPnL)}
                        valueClassName={pnlColorClass(performance.netPnL)}
                        hint={definitions.netPnL}
                    />
                    <KpiCard
                        label="ROI"
                        value={performance.totalStakedSettled > 0 ? formatPercent(performance.roi) : '—'}
                        valueClassName={pnlColorClass(performance.roi)}
                        hint={definitions.roi}
                    />
                    <KpiCard
                        label="Staked (settled)"
                        value={`$${performance.totalStakedSettled.toFixed(2)}`}
                    />
                </div>
            </div>
        </div>
    );
}
