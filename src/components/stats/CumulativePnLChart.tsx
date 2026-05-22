'use client';

interface Point {
    date: string;
    pnl: number;
    cumulative: number;
}

interface CumulativePnLChartProps {
    points: Point[];
}

export default function CumulativePnLChart({ points }: CumulativePnLChartProps) {
    if (!points.length) {
        return (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No settled bets in this period for chart data.
            </p>
        );
    }

    const width = 640;
    const height = 200;
    const pad = { top: 16, right: 16, bottom: 28, left: 48 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const values = points.map((p) => p.cumulative);
    const minY = Math.min(0, ...values);
    const maxY = Math.max(0, ...values);
    const rangeY = maxY - minY || 1;

    const xAt = (i: number) => pad.left + (i / Math.max(points.length - 1, 1)) * innerW;
    const yAt = (v: number) => pad.top + innerH - ((v - minY) / rangeY) * innerH;

    const linePath = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.cumulative)}`)
        .join(' ');

    const zeroY = yAt(0);

    return (
        <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full max-w-full" role="img" aria-label="Cumulative PnL chart">
                <line
                    x1={pad.left}
                    y1={zeroY}
                    x2={width - pad.right}
                    y2={zeroY}
                    className="stroke-gray-300 dark:stroke-gray-600"
                    strokeDasharray="4 4"
                />
                <path d={linePath} fill="none" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={2} />
                {points.map((p, i) => (
                    <circle
                        key={p.date}
                        cx={xAt(i)}
                        cy={yAt(p.cumulative)}
                        r={3}
                        className="fill-blue-600 dark:fill-blue-400"
                    >
                        <title>{`${p.date}: ${p.cumulative >= 0 ? '+' : ''}${p.cumulative.toFixed(2)}`}</title>
                    </circle>
                ))}
                <text x={pad.left} y={height - 6} className="fill-gray-500 text-[10px]">
                    {points[0]?.date}
                </text>
                <text x={width - pad.right} y={height - 6} textAnchor="end" className="fill-gray-500 text-[10px]">
                    {points[points.length - 1]?.date}
                </text>
                <text x={8} y={pad.top + 4} className="fill-gray-500 text-[10px]">
                    {maxY.toFixed(0)}
                </text>
                <text x={8} y={pad.top + innerH} className="fill-gray-500 text-[10px]">
                    {minY.toFixed(0)}
                </text>
            </svg>
        </div>
    );
}
