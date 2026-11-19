'use client';

import type { CSSProperties, ReactNode } from 'react';

type BoneProps = {
  className?: string;
  style?: CSSProperties;
};

/** Single shimmer block. */
export function Bone({ className = '', style }: BoneProps) {
  return <span className={`pt-skel ${className}`.trim()} style={style} aria-hidden />;
}

/** Accessible loading region wrapper. */
export function SkeletonRegion({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({
  titleWidth = '9rem',
  lines = 1,
}: {
  titleWidth?: string;
  lines?: number;
}) {
  return (
    <div className="pt-page-header">
      <Bone className="pt-skel--title" style={{ width: titleWidth }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Bone key={i} className="pt-skel--line" style={{ width: i === 0 ? '72%' : '48%', marginTop: '0.55rem' }} />
      ))}
    </div>
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="pt-kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="pt-kpi pt-skel-card">
          <Bone className="pt-skel--label" />
          <Bone className="pt-skel--value" />
          <Bone className="pt-skel--hint" />
        </div>
      ))}
    </div>
  );
}

export function FiltersSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="pt-filters">
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} className="pt-skel--chip" style={{ width: i === count - 1 ? '6.5rem' : '8.5rem' }} />
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 4,
  className = '',
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={`pt-card !p-0 overflow-hidden ${className}`.trim()}>
      <div className="pt-table-wrap">
        <table className="pt-table">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}>
                  <Bone className="pt-skel--th" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}>
                    <Bone className="pt-skel--td" style={{ width: c === 0 ? '78%' : '55%' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PanelSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="pt-card pt-skel-card">
      <Bone className="pt-skel--label" style={{ width: '7rem', marginBottom: '1rem' }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Bone key={i} className="pt-skel--line" style={{ width: `${88 - i * 8}%`, marginTop: i ? '0.65rem' : 0 }} />
      ))}
    </div>
  );
}

export function BotCardSkeleton() {
  return (
    <article className="sb-bot-card pt-skel-card" aria-hidden>
      <div className="sb-bot-card__media">
        <div className="sb-bot-card__media-shade" />
      </div>
      <div className="sb-bot-card__body">
        <Bone className="pt-skel--title" style={{ width: '55%' }} />
        <div className="sb-bot-card__meta" style={{ marginTop: '1rem' }}>
          <Bone className="pt-skel--line" style={{ width: '70%' }} />
          <Bone className="pt-skel--line" style={{ width: '52%', marginTop: '0.65rem' }} />
        </div>
        <div className="sb-bot-card__actions">
          <Bone className="pt-skel--chip" style={{ width: '5.5rem' }} />
          <Bone className="pt-skel--chip" style={{ width: '5.5rem' }} />
        </div>
      </div>
    </article>
  );
}

/** Desk / dashboard overview while tips + bots load. */
export function DeskPageSkeleton() {
  return (
    <SkeletonRegion label="Loading desk overview">
      <PageHeaderSkeleton titleWidth="10rem" lines={2} />
      <p className="pt-skel-caption">Loading tips, bots, and recent runs…</p>
      <KpiGridSkeleton />
      <div className="pt-grid-2" style={{ marginTop: '1.05rem' }}>
        <TableSkeleton rows={6} cols={3} />
        <div className="space-y-4">
          <PanelSkeleton lines={4} />
          <PanelSkeleton lines={3} />
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Board while open tips load. */
export function BoardPageSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <SkeletonRegion label="Loading board" className="space-y-4">
      {!compact ? (
        <>
          <PageHeaderSkeleton titleWidth="6rem" lines={2} />
          <p className="pt-skel-caption">Fetching open hub tips…</p>
          <KpiGridSkeleton />
        </>
      ) : (
        <p className="pt-skel-caption">Fetching open hub tips…</p>
      )}
      <FiltersSkeleton />
      <div className="pt-grid-2">
        <TableSkeleton rows={7} cols={5} />
        <PanelSkeleton lines={8} />
      </div>
    </SkeletonRegion>
  );
}

/** Bots list while instances load. */
export function BotsPageSkeleton() {
  return (
    <SkeletonRegion label="Loading bots">
      <PageHeaderSkeleton titleWidth="5rem" lines={2} />
      <p className="pt-skel-caption">Loading surebet desks…</p>
      <section className="sb-bot-grid" aria-hidden>
        <BotCardSkeleton />
        <BotCardSkeleton />
      </section>
    </SkeletonRegion>
  );
}

/** History while executions / stats load. */
export function HistoryPageSkeleton() {
  return (
    <SkeletonRegion label="Loading history">
      <PageHeaderSkeleton titleWidth="7rem" lines={1} />
      <p className="pt-skel-caption">Loading executions and stats…</p>
      <FiltersSkeleton count={3} />
      <div className="pt-grid-2">
        <TableSkeleton rows={7} cols={4} />
        <PanelSkeleton lines={6} />
      </div>
    </SkeletonRegion>
  );
}

/** Settings while session resolves. */
export function SettingsPageSkeleton() {
  return (
    <SkeletonRegion label="Loading settings">
      <PageHeaderSkeleton titleWidth="7rem" lines={1} />
      <p className="pt-skel-caption">Loading account settings…</p>
      <div className="pt-card pt-skel-card" style={{ maxWidth: '32rem' }}>
        <Bone className="pt-skel--label" style={{ width: '6rem' }} />
        <Bone className="pt-skel--input" style={{ marginTop: '0.55rem' }} />
        <Bone className="pt-skel--label" style={{ width: '5rem', marginTop: '1rem' }} />
        <Bone className="pt-skel--input" style={{ marginTop: '0.55rem' }} />
        <Bone className="pt-skel--chip" style={{ width: '7rem', marginTop: '1.25rem' }} />
      </div>
    </SkeletonRegion>
  );
}

/** Generic in-page redirect wait. */
export function RedirectSkeleton({ label }: { label: string }) {
  return (
    <SkeletonRegion label={label}>
      <PageHeaderSkeleton titleWidth="8rem" lines={1} />
      <p className="pt-skel-caption">{label}</p>
      <PanelSkeleton lines={3} />
    </SkeletonRegion>
  );
}

/** Instance monitor while bot details load. */
export function InstancePageSkeleton() {
  return (
    <SkeletonRegion label="Loading instance">
      <PageHeaderSkeleton titleWidth="12rem" lines={2} />
      <p className="pt-skel-caption">Loading instance monitor…</p>
      <FiltersSkeleton count={3} />
      <div className="pt-grid-2">
        <PanelSkeleton lines={10} />
        <PanelSkeleton lines={6} />
      </div>
    </SkeletonRegion>
  );
}
