import type { InstanceBetStats } from '@/lib/bettingStats';

function formatCount(value: number): string {
  return String(value);
}

function formatPercentRatio(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedPercent(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return '0.0%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatSignedNumber(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return '0.00';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatOdds(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '—';
  return value.toFixed(2);
}

const CARDS: Array<{
  key: string;
  label: string;
  value: (stats: InstanceBetStats) => string;
  hint?: (stats: InstanceBetStats) => string | undefined;
}> = [
  { key: 'placed', label: 'Bets placed', value: (s) => formatCount(s.execution.betsPlaced) },
  { key: 'success', label: 'Submit success', value: (s) => formatPercentRatio(s.execution.submitSuccessRate) },
  { key: 'settled', label: 'Settled', value: (s) => formatCount(s.settlement.settled) },
  { key: 'pending', label: 'Pending', value: (s) => formatCount(s.settlement.pending) },
  { key: 'pnl', label: 'Net PnL', value: (s) => formatSignedNumber(s.performance.netPnL) },
  {
    key: 'roi',
    label: 'ROI',
    value: (s) => formatSignedPercent(s.performance.roi),
    hint: (s) => s.definitions.roi,
  },
  {
    key: 'win',
    label: 'Win rate',
    value: (s) => formatPercentRatio(s.performance.winRate),
    hint: (s) => s.definitions.winRate,
  },
  { key: 'odds', label: 'Avg odds', value: (s) => formatOdds(s.performance.avgOdds) },
];

export default function StatsKpiGrid({ stats }: { stats: InstanceBetStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          title={card.hint?.(stats)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {card.label}
          </div>
          <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{card.value(stats)}</div>
        </div>
      ))}
    </div>
  );
}
