import type { InstanceBetStats } from '@/lib/bettingStats';

const SEGMENTS = [
  { key: 'won', label: 'Won', className: 'bg-green-500' },
  { key: 'lost', label: 'Lost', className: 'bg-red-500' },
  { key: 'draw', label: 'Draw', className: 'bg-amber-400' },
  { key: 'void', label: 'Void', className: 'bg-gray-400' },
] as const;

export default function ResultBreakdownBar({ settlement }: { settlement: InstanceBetStats['settlement'] }) {
  const counts = {
    won: settlement.won,
    lost: settlement.lost,
    draw: settlement.draw,
    void: settlement.void,
  };
  const total = counts.won + counts.lost + counts.draw + counts.void;
  const extras = [
    settlement.halfWon > 0 ? `Half won ${settlement.halfWon}` : null,
    settlement.halfLost > 0 ? `Half lost ${settlement.halfLost}` : null,
    settlement.cashout > 0 ? `Cashout ${settlement.cashout}` : null,
  ].filter(Boolean);

  if (total === 0 && extras.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No settled results in this period.</p>;
  }

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Results</div>
      {total > 0 ? (
        <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
          {SEGMENTS.map((segment) =>
            counts[segment.key] > 0 ? (
              <div
                key={segment.key}
                className={segment.className}
                style={{ width: `${(counts[segment.key] / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
        {SEGMENTS.map((segment) => (
          <span key={segment.key}>
            {segment.label} {counts[segment.key]}
          </span>
        ))}
      </div>
      {extras.length > 0 ? (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{extras.join(' · ')}</p>
      ) : null}
    </div>
  );
}
