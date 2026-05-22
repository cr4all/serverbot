export function formatSignedMoney(n: number): string {
    const v = Number(n) || 0;
    const sign = v > 0 ? '+' : '';
    return `${sign}$${v.toFixed(2)}`;
}

export function formatPercent(n: number): string {
    const v = Number(n) || 0;
    return `${v.toFixed(1)}%`;
}

export function pnlColorClass(n: number): string {
    if (n > 0) return 'text-emerald-600 dark:text-emerald-400';
    if (n < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-700 dark:text-gray-300';
}
