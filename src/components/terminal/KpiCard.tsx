'use client';

export default function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="pt-kpi">
      <div className="pt-kpi__label">{label}</div>
      <div className="pt-kpi__value">{value}</div>
      {hint ? <div className="pt-kpi__hint">{hint}</div> : null}
    </div>
  );
}
