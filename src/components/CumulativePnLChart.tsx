import type { DailyPnLPoint } from '@/lib/bettingStats';

export default function CumulativePnLChart({ series }: { series: DailyPnLPoint[] }) {
  const hasMovement = series.some((point) => point.pnl !== 0);
  if (!hasMovement) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No settled profit in this period.</p>;
  }

  const width = 640;
  const height = 160;
  const pad = 16;
  const values = series.map((point) => point.pnl);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const points = series
    .map((point, index) => {
      const x = pad + (index / Math.max(series.length - 1, 1)) * (width - pad * 2);
      const y = pad + (1 - (point.pnl - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const zeroY = pad + (1 - (0 - min) / span) * (height - pad * 2);

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Cumulative profit
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full text-blue-600 dark:text-blue-400"
        role="img"
        aria-label="Cumulative settled profit"
      >
        <line x1={pad} x2={width - pad} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity="0.25" />
        <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
      </svg>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}
