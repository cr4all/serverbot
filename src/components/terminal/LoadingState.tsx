'use client';

export default function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="pt-loading">{label}</div>;
}
