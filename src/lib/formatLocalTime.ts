/** Format an ISO/UTC instant as the operator's local time. */

export function formatLocalTime(
  value: string | Date | null | undefined,
  opts: { withSeconds?: boolean; dateStyle?: 'short' | 'medium' } = {}
): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  const withSeconds = opts.withSeconds === true;
  const dateStyle = opts.dateStyle ?? 'short';

  try {
    return d.toLocaleString(undefined, {
      year: dateStyle === 'medium' ? 'numeric' : '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: false,
    });
  } catch {
    return d.toISOString();
  }
}

/** Compact local clock for table cells (HH:mm:ss today, else date + time). */
export function formatLocalStamp(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  try {
    if (sameDay) {
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    }
    return formatLocalTime(d, { withSeconds: true });
  } catch {
    return d.toISOString();
  }
}
