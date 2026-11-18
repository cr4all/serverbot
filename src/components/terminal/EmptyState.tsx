'use client';

export default function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="pt-empty">
      <p className="font-semibold text-[color:var(--pt-text)]">{title}</p>
      {message ? <p className="mt-1">{message}</p> : null}
    </div>
  );
}
