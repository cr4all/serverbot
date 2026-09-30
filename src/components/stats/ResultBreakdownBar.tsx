'use client';

interface ResultBreakdownBarProps {
    won: number;
    lost: number;
    draw: number;
    void: number;
}

const SEGMENTS = [
    { key: 'won' as const, label: 'Won', className: 'bg-emerald-500' },
    { key: 'lost' as const, label: 'Lost', className: 'bg-red-500' },
    { key: 'draw' as const, label: 'Draw', className: 'bg-amber-500' },
    { key: 'void' as const, label: 'Void', className: 'bg-gray-400 dark:bg-gray-500' },
];

export default function ResultBreakdownBar({ won, lost, draw, void: voidCount }: ResultBreakdownBarProps) {
    const total = won + lost + draw + voidCount;
    const counts = { won, lost, draw, void: voidCount };

    if (total === 0) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">No settled results in this period.</p>;
    }

    return (
        <div className="space-y-2">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                {SEGMENTS.map((seg) => {
                    const n = counts[seg.key];
                    if (n <= 0) return null;
                    const pct = (n / total) * 100;
                    return (
                        <div
                            key={seg.key}
                            className={seg.className}
                            style={{ width: `${pct}%` }}
                            title={`${seg.label}: ${n}`}
                        />
                    );
                })}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
                {SEGMENTS.map((seg) => (
                    <span key={seg.key} className="inline-flex items-center gap-1">
                        <span className={`inline-block h-2 w-2 rounded-sm ${seg.className}`} />
                        {seg.label}: {counts[seg.key]}
                    </span>
                ))}
            </div>
        </div>
    );
}
