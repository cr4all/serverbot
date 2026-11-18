'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SurebetDesk } from '@/lib/surebetDesks';
import type { IBettingStatsResponse } from '@/types';
import { IconClock, IconHistory, IconTicket } from '@/components/BettingIcons';

function formatCreated(value: Date | string) {
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatPnl(n: number | undefined) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)} u`;
}

export default function SurebetBotCard({
  desk,
  onCredentials,
  onDelete,
  onStatusChange,
}: {
  desk: SurebetDesk;
  onCredentials: () => void;
  onDelete: () => void;
  onStatusChange?: () => void;
}) {
  const statsId = String(desk.betonline?._id || desk.ps3838?._id || '');
  const [stats, setStats] = useState<IBettingStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(desk.running);

  useEffect(() => {
    setRunning(desk.running);
  }, [desk.running]);

  useEffect(() => {
    if (!statsId) return;
    let cancelled = false;
    setStatsLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/bot-instances/${statsId}/stats?period=month&offset=-1`);
        if (!res.ok) throw new Error('stats failed');
        const data = (await res.json()) as IBettingStatsResponse;
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statsId]);

  const toggleRun = async () => {
    const next = running ? 'STOPPED' : 'RUNNING';
    setRunBusy(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/surebets/desks/${encodeURIComponent(desk.deskId)}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRunError(data?.error ?? `Failed (${res.status})`);
        return;
      }
      setRunning(next === 'RUNNING');
      onStatusChange?.();
    } catch (e) {
      setRunError((e as Error)?.message ?? 'Request failed');
    } finally {
      setRunBusy(false);
    }
  };

  const bets = stats?.execution?.betsPlaced;
  const settled = stats?.settlement?.settled;
  const pnl = stats?.performance?.netPnL;

  return (
    <article className="sb-bot-card">
      <div className="sb-bot-card__media" aria-hidden>
        <div className="sb-bot-card__media-shade" />
        <IconTicket className="sb-bot-card__ticket" />
      </div>

      <div className="sb-bot-card__body">
        <div className="sb-bot-card__title-row">
          <h2>{desk.name}</h2>
          <span className={`sb-pill ${running ? 'sb-pill--ready' : 'sb-pill--missing'}`}>
            {running ? 'Auto-run ON' : 'Stopped'}
          </span>
        </div>

        <dl className="sb-bot-card__meta">
          <div>
            <dt>
              <IconClock className="sb-ico" /> Created
            </dt>
            <dd>{formatCreated(desk.createdAt)}</dd>
          </div>
          <div>
            <dt>
              <IconHistory className="sb-ico" /> Betting history
            </dt>
            <dd>
              {statsLoading
                ? 'Loading…'
                : stats
                  ? `${bets ?? 0} bets · ${settled ?? 0} settled · ${formatPnl(pnl)}`
                  : 'No history yet'}
            </dd>
          </div>
        </dl>

        {runError ? <p className="mt-2 text-sm text-[color:#f0a0a0]">{runError}</p> : null}

        <div className="sb-bot-card__actions">
          <button
            type="button"
            className={`sb-btn ${running ? 'sb-btn--ghost' : 'sb-btn--primary'}`}
            disabled={runBusy || desk.deskId.startsWith('legacy-')}
            onClick={() => void toggleRun()}
            title={
              desk.deskId.startsWith('legacy-')
                ? 'Re-save credentials to enable auto-run for this desk'
                : running
                  ? 'Stop auto-betting open tips'
                  : 'Start auto-betting open tips'
            }
          >
            {runBusy ? 'Updating…' : running ? 'Stop' : 'Run'}
          </button>
          <Link href="/dashboard/opportunities" className="sb-btn sb-btn--ghost">
            Open board
          </Link>
          <button type="button" className="sb-btn sb-btn--ghost" onClick={onCredentials}>
            Credentials
          </button>
          <button type="button" className="sb-btn sb-btn--danger" onClick={onDelete}>
            Delete
          </button>
        </div>
        {running ? (
          <p className="mt-3 text-xs text-[color:var(--sb-mist)]">
            While running, eligible hub tips are bet automatically (one at a time).
          </p>
        ) : null}
      </div>
    </article>
  );
}
