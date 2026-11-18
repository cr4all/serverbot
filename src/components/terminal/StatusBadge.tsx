'use client';

type Tone = 'success' | 'warn' | 'danger' | 'info' | 'muted';

const JOB_TONE: Record<string, Tone> = {
  DONE: 'success',
  ABORTED: 'muted',
  ONE_LEG: 'danger',
  REVIEW_NEEDED: 'warn',
  PENDING: 'info',
  READY: 'success',
  NOT_READY: 'warn',
  COMMITTED: 'success',
  REJECTED: 'danger',
  VERIFIED: 'success',
  MISSING: 'danger',
};

export function toneForState(state: string): Tone {
  return JOB_TONE[state] ?? 'info';
}

export default function StatusBadge({ state, label }: { state: string; label?: string }) {
  const tone = toneForState(state);
  return <span className={`pt-badge pt-badge--${tone}`}>{label ?? state}</span>;
}
