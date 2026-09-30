export function formatSignedUnits(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return '0.00 units';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)} units`;
}

export const TEMPLATE_STATS_FOOTNOTE =
  'All users · last calendar month · settled bets only · mock/test bets excluded';
