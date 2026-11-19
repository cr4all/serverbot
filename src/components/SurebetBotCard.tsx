'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SurebetDesk } from '@/lib/surebetDesks';
import type { IBettingStatsResponse } from '@/types';
import { IconClock, IconHistory, IconTicket } from '@/components/BettingIcons';
import { deskHeroSrc, deskMediaClass } from '@/lib/deskVisual';
import Toast, { type ToastMessage } from '@/components/terminal/Toast';

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

type WarmSnap = {
  ready?: boolean;
  warming?: boolean;
  bol?: { reachable?: boolean; loggedIn?: boolean; lastError?: string | null; loginAttempts?: number };
  ps?: { reachable?: boolean; loggedIn?: boolean; lastError?: string | null; loginAttempts?: number };
  log?: Array<{ tone: string; message: string }>;
};

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
  const [warm, setWarm] = useState<WarmSnap | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

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

  useEffect(() => {
    if (!running || desk.deskId.startsWith('legacy-')) {
      setWarm(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/surebets/desks/${encodeURIComponent(desk.deskId)}/vps-status`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok) setWarm(data as WarmSnap);
      } catch {
        /* ignore poll errors */
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [running, desk.deskId]);

  const pushToast = (tone: ToastMessage['tone'], title: string, message: string) => {
    setToast({ id: Date.now(), tone, title, message });
  };

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
        pushToast('danger', 'Status update failed', data?.error ?? `Failed (${res.status})`);
        return;
      }
      setRunning(next === 'RUNNING');
      onStatusChange?.();

      if (next === 'RUNNING') {
        pushToast('info', 'Warming VPS', 'Checking connection and login on both bookmakers…');
        const warmRes = await fetch(`/api/surebets/desks/${encodeURIComponent(desk.deskId)}/warm`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reset: true }),
        });
        const warmData = (await warmRes.json().catch(() => ({}))) as WarmSnap & { error?: string };
        if (!warmRes.ok) {
          const msg = warmData?.error ?? `Warm failed (${warmRes.status})`;
          setRunError(msg);
          pushToast('danger', 'VPS warm failed', msg);
        } else {
          setWarm(warmData);
          if (warmData.ready) {
            pushToast('success', 'VPS ready', 'Both bookmakers are linked and logged in.');
          } else {
            const last =
              warmData.log?.filter((l) => l.tone === 'danger' || l.tone === 'warning').slice(-1)[0]
                ?.message ?? 'Waiting for login…';
            pushToast('warning', 'VPS not ready', last);
          }
        }
      }
    } catch (e) {
      setRunError((e as Error)?.message ?? 'Request failed');
      pushToast('danger', 'Request failed', (e as Error)?.message ?? 'Request failed');
    } finally {
      setRunBusy(false);
    }
  };

  const bets = stats?.execution?.betsPlaced;
  const settled = stats?.settlement?.settled;
  const pnl = stats?.performance?.netPnL;
  const locked = running;
  const mediaClass = deskMediaClass(desk.deskId);
  const hero = deskHeroSrc(desk.deskId);

  return (
    <article className={`sb-bot-card${locked ? ' sb-bot-card--running' : ''}`}>
      <div
        className={`sb-bot-card__media ${mediaClass}`}
        aria-hidden
        style={{ backgroundImage: `url(${hero})` }}
      >
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

        {running && warm ? (
          <div className="sb-warm-chips">
            <span className={`sb-chip ${warm.bol?.loggedIn ? 'sb-chip--ok' : 'sb-chip--warn'}`}>
              BOL {warm.bol?.loggedIn ? 'ready' : warm.bol?.reachable ? 'login…' : 'down'}
            </span>
            <span className={`sb-chip ${warm.ps?.loggedIn ? 'sb-chip--ok' : 'sb-chip--warn'}`}>
              PS {warm.ps?.loggedIn ? 'ready' : warm.ps?.reachable ? 'login…' : 'down'}
            </span>
          </div>
        ) : null}

        {runError ? <p className="mt-2 text-sm text-[color:var(--sb-danger)]">{runError}</p> : null}

        <div className="sb-bot-card__actions">
          <button
            type="button"
            className={`sb-btn ${running ? 'pt-btn--stop' : 'pt-btn--run'} ${running ? 'sb-btn--ghost' : 'sb-btn--primary'}`}
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
          <Link href="/dashboard/opportunities" className="sb-btn sb-btn--ghost pt-btn--board">
            Open board
          </Link>
          <button
            type="button"
            className="sb-btn sb-btn--ghost"
            onClick={onCredentials}
            disabled={locked}
            title={locked ? 'Stop the bot to edit credentials' : 'Edit bot'}
          >
            Edit bot
          </button>
          <button
            type="button"
            className="sb-btn sb-btn--danger"
            onClick={onDelete}
            disabled={locked}
            title={locked ? 'Stop the bot before deleting' : 'Delete'}
          >
            Delete
          </button>
        </div>
        {running ? (
          <p className="mt-3 text-xs text-[color:var(--sb-mist)]">
            Running — only Stop and Board stay active. Tips appear on the Board after both VPS sessions are ready.
          </p>
        ) : null}
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </article>
  );
}
