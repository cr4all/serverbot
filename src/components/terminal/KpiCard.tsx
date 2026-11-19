'use client';

export default function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'tips' | 'bots' | 'run' | 'alert';
}) {
  return (
    <div className={`pt-kpi${tone ? ` pt-kpi--${tone}` : ''}`}>
      <div className="pt-kpi__label">{label}</div>
      <div className="pt-kpi__value">{value}</div>
      {hint ? <div className="pt-kpi__hint">{hint}</div> : null}
    </div>
  );
}
