'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '@/components/terminal/PageHeader';
import StatusBadge from '@/components/terminal/StatusBadge';
import EmptyState from '@/components/terminal/EmptyState';
import ErrorState from '@/components/terminal/ErrorState';
import { BoardPageSkeleton } from '@/components/terminal/Skeleton';
import Toast, { type ToastMessage } from '@/components/terminal/Toast';
import VpsLinkStatus from '@/components/terminal/VpsLinkStatus';
import {
  formatExecutionReason,
  isFailedExecutionState,
  isInFlightExecutionState,
  isSuccessExecutionState,
} from '@/lib/formatExecutionReason';
import { groupSurebetDesks } from '@/lib/surebetDesks';
import {
  type BookmakerVpsStatus,
  type Execution,
  type Tip,
  secondsLeft,
} from '@/lib/terminal/surebetTypes';
import { formatLocalStamp, formatLocalTime } from '@/lib/formatLocalTime';

const POLL_MS = 3000;
const HEALTH_POLL_MS = 5000;
const VPS_POLL_MS = 2000;
const WARM_RETRY_MS = 8000;
const DESKS_POLL_MS = 30000;
const WARM_TOAST_MIN_MS = 30000;
const RECENT_BETS_MAX = 10;

type VpsWarmLeg = {
  reachable: boolean;
  loggedIn: boolean;
  loginAttempts?: number;
  lastError?: string | null;
};

type VpsWarmState = {
  bol: VpsWarmLeg;
  ps: VpsWarmLeg;
  ready: boolean;
  warming: boolean;
  log: Array<{ at: number; tone: 'info' | 'success' | 'warning' | 'danger'; message: string }>;
};

const WARM_TONE_CLASS: Record<string, string> = {
  info: 'text-[color:var(--pt-muted)]',
  success: 'text-[color:var(--pt-success)]',
  warning: 'text-[color:var(--pt-text)]',
  danger: 'text-[color:var(--pt-danger)]',
};

function betRank(state: string): number {
  if (isSuccessExecutionState(state)) return 0;
  if (isInFlightExecutionState(state)) return 1;
  if (isFailedExecutionState(state)) return 2;
  return 3;
}

type PrepareBoth = {
  busy?: boolean;
  ok?: boolean;
  legs?: Array<{ bookmaker: string; ok: boolean; odds?: number | null; reason?: string | null; stake?: number | null }>;
  reason?: string | null;
};

type PrepareBol = {
  busy?: boolean;
  ok?: boolean;
  odds?: number | null;
  reason?: string | null;
  stake?: number;
};

function legDetails(execution: Execution | null | undefined): string[] {
  if (!execution) return [];
  return execution.legs.map((leg) => {
    const price = leg.odds != null ? ` @ ${leg.odds}` : '';
    const reason = leg.reason ? ` — ${leg.reason}` : '';
    return `${leg.bookmaker}: ${leg.state}${price}${reason}`;
  });
}

function tipLabelForExecution(execution: Execution, tips: Tip[]): string {
  return betContext(execution, tips).eventName;
}

/** Readable tip/event context for history cards (open tip wins, else frozen tipSummary). */
function betContext(execution: Execution, tips: Tip[]) {
  const tip = execution.tipId ? tips.find((t) => t.tipId === execution.tipId) ?? null : null;
  const summary = execution.tipSummary ?? null;
  const legs =
    tip?.legs?.map((leg) => ({
      bookmaker: leg.bookmaker,
      selection: leg.selection,
      odds: leg.odds as number | null | undefined,
      marketType: leg.marketType ?? null,
      line: leg.line ?? null,
    })) ??
    summary?.legs?.map((leg) => ({
      bookmaker: leg.bookmaker,
      selection: leg.selection ?? '',
      odds: leg.odds,
      marketType: leg.marketType ?? null,
      line: leg.line ?? null,
    })) ??
    [];
  return {
    eventName: tip?.eventName || summary?.eventName || execution.tipId || execution.executionId,
    sport: tip?.sport || summary?.sport || '',
    profitPercent: tip?.profitPercent ?? summary?.profitPercent ?? null,
    legs,
  };
}

export default function OpportunityBoard({ compact = false }: { compact?: boolean }) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [updatedAt, setUpdatedAt] = useState('');
  const [betOnlineStatus, setBetOnlineStatus] = useState<BookmakerVpsStatus | null>(null);
  const [ps3838Status, setPs3838Status] = useState<BookmakerVpsStatus | null>(null);
  const [runningDeskId, setRunningDeskId] = useState<string | null>(null);
  const [vpsWarm, setVpsWarm] = useState<VpsWarmState | null>(null);
  const [betOnlineResults, setBetOnlineResults] = useState<Record<string, PrepareBol>>({});
  const [prepareBothResults, setPrepareBothResults] = useState<Record<string, PrepareBoth>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState('all');
  const [bookFilter, setBookFilter] = useState('all');
  const [minRoi, setMinRoi] = useState('');
  const [hideExpired, setHideExpired] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastSeq = useRef(0);
  const warmInFlight = useRef(false);
  const lastWarmAt = useRef(0);
  const lastWarmToast = useRef({ message: '', at: 0 });
  /** executionId -> last observed state (for request/response toasts). */
  const executionStateRef = useRef<Map<string, string>>(new Map());
  const executionToastBooted = useRef(false);

  const pushToast = useCallback((next: Omit<ToastMessage, 'id'>) => {
    toastSeq.current += 1;
    setToast({ ...next, id: toastSeq.current });
  }, []);

  const closeToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/surebets', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error ?? `Request failed (${res.status})`);
      else setError(null);
      setTips(Array.isArray(data?.tips) ? data.tips : []);
      setExecutions(Array.isArray(data?.executions) ? data.executions : []);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to reach the hub');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBetOnline = useCallback(async () => {
    try {
      const res = await fetch('/api/surebets/betonline', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setBetOnlineStatus(data as BookmakerVpsStatus);
      else {
        setBetOnlineStatus({
          configured: false,
          accountReady: false,
          reachable: false,
          reason: data?.error ?? `Request failed (${res.status})`,
        });
      }
    } catch (e) {
      setBetOnlineStatus({
        configured: false,
        accountReady: false,
        reachable: false,
        reason: (e as Error)?.message ?? 'VPS unreachable',
      });
    }
  }, []);

  const loadPs3838 = useCallback(async () => {
    try {
      const res = await fetch('/api/surebets/ps3838', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPs3838Status(data as BookmakerVpsStatus);
      else {
        setPs3838Status({
          configured: false,
          accountReady: false,
          reachable: false,
          reason: data?.error ?? `Request failed (${res.status})`,
        });
      }
    } catch (e) {
      setPs3838Status({
        configured: false,
        accountReady: false,
        reachable: false,
        reason: (e as Error)?.message ?? 'VPS unreachable',
      });
    }
  }, []);

  const loadRunningDesk = useCallback(async () => {
    try {
      const res = await fetch('/api/bot-instances', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      const desks = groupSurebetDesks(Array.isArray(data) ? data : []);
      setRunningDeskId(desks.find((desk) => desk.running)?.deskId ?? null);
    } catch {
      // Keep the last known desk; the board falls back to manual mode only when none was found.
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    void loadBetOnline();
    void loadPs3838();
    const id = setInterval(() => {
      void loadBetOnline();
      void loadPs3838();
    }, HEALTH_POLL_MS);
    return () => clearInterval(id);
  }, [loadBetOnline, loadPs3838]);

  useEffect(() => {
    void loadRunningDesk();
    const id = setInterval(() => void loadRunningDesk(), DESKS_POLL_MS);
    return () => clearInterval(id);
  }, [loadRunningDesk]);

  // Poll warm state for the running desk; nudge a (non-reset) warm every ~8s while not ready.
  useEffect(() => {
    if (!runningDeskId) {
      setVpsWarm(null);
      return;
    }
    let cancelled = false;
    const base = `/api/surebets/desks/${encodeURIComponent(runningDeskId)}`;

    const warm = async () => {
      if (warmInFlight.current) return;
      warmInFlight.current = true;
      lastWarmAt.current = Date.now();
      try {
        const res = await fetch(`${base}/warm`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data && Array.isArray(data.log)) setVpsWarm(data as VpsWarmState);
      } catch {
        // Next poll tick retries.
      } finally {
        warmInFlight.current = false;
      }
    };

    const poll = async () => {
      try {
        const res = await fetch(`${base}/vps-status`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !data) return;
        setVpsWarm(data as VpsWarmState);
        if (data.ready !== true && Date.now() - lastWarmAt.current >= WARM_RETRY_MS) void warm();
      } catch {
        // Keep last warm snapshot.
      }
    };

    lastWarmAt.current = 0;
    void poll();
    const id = setInterval(() => void poll(), VPS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [runningDeskId]);

  // Surface a warm failure once per new danger log entry (throttled).
  useEffect(() => {
    if (!vpsWarm || vpsWarm.ready) return;
    const last = vpsWarm.log?.[vpsWarm.log.length - 1];
    if (!last || last.tone !== 'danger') return;
    const now = Date.now();
    if (last.message === lastWarmToast.current.message || now - lastWarmToast.current.at < WARM_TOAST_MIN_MS) return;
    lastWarmToast.current = { message: last.message, at: now };
    pushToast({ tone: 'danger', title: 'VPS connection problem', message: last.message });
  }, [vpsWarm, pushToast]);

  const vpsReady = !runningDeskId || vpsWarm?.ready === true;
  const vpsLocked = !!runningDeskId && !vpsReady;

  const sports = useMemo(() => {
    const set = new Set(tips.map((t) => t.sport).filter(Boolean));
    return Array.from(set).sort();
  }, [tips]);

  const books = useMemo(() => {
    const set = new Set<string>();
    for (const tip of tips) for (const leg of tip.legs) set.add(leg.bookmaker);
    return Array.from(set).sort();
  }, [tips]);

  const filtered = useMemo(() => {
    const min = Number(minRoi);
    return tips.filter((tip) => {
      const left = secondsLeft(tip.expiresAtUtc);
      const hasExecution = executions.some((execution) => execution.tipId === tip.tipId);
      if (hideExpired && left <= 0 && !hasExecution) return false;
      if (sportFilter !== 'all' && tip.sport !== sportFilter) return false;
      if (bookFilter !== 'all' && !tip.legs.some((l) => l.bookmaker === bookFilter)) return false;
      if (Number.isFinite(min) && minRoi !== '' && tip.profitPercent < min) return false;
      return true;
    });
  }, [tips, sportFilter, bookFilter, minRoi, hideExpired, executions]);

  const latestByTip = useMemo(() => {
    const map = new Map<string, Execution>();
    for (const execution of executions) {
      if (execution.tipId && !map.has(execution.tipId)) map.set(execution.tipId, execution);
    }
    return map;
  }, [executions]);

  const selected = filtered.find((t) => t.tipId === selectedId) ?? filtered[0] ?? null;
  const selectedLatest = selected ? latestByTip.get(selected.tipId) ?? null : null;

  useEffect(() => {
    if (selected && selected.tipId !== selectedId) setSelectedId(selected.tipId);
  }, [selected, selectedId]);

  const prepareBoth = async (tipId: string) => {
    const stake = Number(stakes[tipId] ?? '1');
    if (!Number.isFinite(stake) || stake <= 0) {
      setError('Stake must be a positive number');
      return;
    }
    setPrepareBothResults((prev) => ({ ...prev, [tipId]: { busy: true } }));
    try {
      const res = await fetch('/api/surebets/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipId, stake }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.error ?? `Request failed (${res.status})`;
        setPrepareBothResults((prev) => ({
          ...prev,
          [tipId]: { busy: false, ok: false, reason: message },
        }));
        pushToast({ tone: 'danger', title: 'Prepare failed', message });
        return;
      }
      const legs = Array.isArray(data?.legs) ? data.legs : [];
      setPrepareBothResults((prev) => ({
        ...prev,
        [tipId]: {
          busy: false,
          ok: data?.ok === true,
          legs,
          reason: data?.ok === true ? null : 'one or both legs not ready',
        },
      }));
      if (data?.ok !== true) {
        const details = legs.map(
          (leg: { bookmaker: string; ok: boolean; odds?: number | null; reason?: string | null }) =>
            `${leg.bookmaker}: ${leg.ok ? 'ok' : 'not ready'}${leg.odds != null ? ` @ ${leg.odds}` : ''}${
              leg.reason ? ` — ${leg.reason}` : ''
            }`
        );
        const changed = /line moved|odds moved|event not found|no surebet/i.test(details.join(' '));
        pushToast({
          tone: 'warning',
          title: changed ? 'Odds/line change detected' : 'Prepare failed',
          message: changed
            ? 'Could not prepare both legs at the original odds/line. Auto-run may rebuild if possible.'
            : 'One or both legs were not ready.',
          details,
        });
      }
    } catch (e) {
      setPrepareBothResults((prev) => ({
        ...prev,
        [tipId]: { busy: false, ok: false, reason: (e as Error)?.message ?? 'Request failed' },
      }));
    }
  };

  const prepareBetOnline = async (tipId: string) => {
    const stake = Number(stakes[tipId] ?? '1');
    if (!Number.isFinite(stake) || stake <= 0) {
      setError('Stake must be a positive number');
      return;
    }
    setBetOnlineResults((prev) => ({ ...prev, [tipId]: { busy: true } }));
    try {
      const res = await fetch('/api/surebets/betonline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipId, stake }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBetOnlineResults((prev) => ({
          ...prev,
          [tipId]: { busy: false, ok: false, reason: data?.error ?? `Request failed (${res.status})` },
        }));
        return;
      }
      setBetOnlineResults((prev) => ({
        ...prev,
        [tipId]: {
          busy: false,
          ok: data?.ok === true,
          odds: data?.odds ?? null,
          reason: data?.reason ?? null,
          stake: data?.stake,
        },
      }));
    } catch (e) {
      setBetOnlineResults((prev) => ({
        ...prev,
        [tipId]: { busy: false, ok: false, reason: (e as Error)?.message ?? 'Request failed' },
      }));
    }
  };

  // Auto-run: toast when a bet request appears, and again when the response settles.
  useEffect(() => {
    const prev = executionStateRef.current;
    const next = new Map<string, string>();
    const booted = executionToastBooted.current;

    const toastResult = (execution: Execution, label: string) => {
      const state = String(execution.state ?? '');
      if (isSuccessExecutionState(state)) {
        pushToast({
          tone: 'success',
          title: 'Bet succeeded',
          message: label,
          details: legDetails(execution),
        });
        return;
      }
      if (isFailedExecutionState(state)) {
        const review = state === 'ONE_LEG' || state === 'REVIEW_NEEDED';
        pushToast({
          tone: review ? 'warning' : 'danger',
          title: review ? 'Bet needs review' : 'Bet failed',
          message: formatExecutionReason(execution.note, execution.legs, true) || label,
          details: legDetails(execution),
        });
      }
    };

    for (const execution of executions) {
      const id = execution.executionId;
      const state = String(execution.state ?? '');
      next.set(id, state);
      const prior = prev.get(id);
      const label = tipLabelForExecution(execution, tips);

      if (!booted) continue;

      if (prior === undefined) {
        pushToast({ tone: 'info', title: 'Bet requested', message: label });
        if (!isInFlightExecutionState(state)) toastResult(execution, label);
        continue;
      }

      if (prior !== state && !isInFlightExecutionState(state)) {
        toastResult(execution, label);
      }
    }

    executionStateRef.current = next;
    executionToastBooted.current = true;
  }, [executions, tips, pushToast]);

  const alerts = executions.filter((e) => e.state === 'ONE_LEG' || e.state === 'REVIEW_NEEDED');

  // With a running desk, link state comes from the warm snapshot; otherwise from the manual health polls.
  const bolLink = vpsWarm
    ? { reachable: vpsWarm.bol.reachable, loggedIn: vpsWarm.bol.loggedIn, reason: vpsWarm.bol.lastError }
    : {
        reachable: betOnlineStatus?.reachable ?? false,
        loggedIn: betOnlineStatus?.reachable ? betOnlineStatus.accountReady : undefined,
        reason: betOnlineStatus?.reason,
      };
  const psLink = vpsWarm
    ? { reachable: vpsWarm.ps.reachable, loggedIn: vpsWarm.ps.loggedIn, reason: vpsWarm.ps.lastError }
    : {
        reachable: ps3838Status?.reachable ?? false,
        loggedIn: ps3838Status?.reachable ? ps3838Status.accountReady : undefined,
        reason: ps3838Status?.reason,
      };

  const recentBets = executions
    .map((execution, index) => ({ execution, index }))
    .sort((a, b) => betRank(a.execution.state) - betRank(b.execution.state) || a.index - b.index)
    .slice(0, RECENT_BETS_MAX)
    .map(({ execution }) => execution);
  const warmLogTail = (vpsWarm?.log ?? []).slice(-5);

  if (loading) return <BoardPageSkeleton compact={compact} />;

  return (
    <div className="board-page space-y-5">
      {!compact ? (
        <PageHeader
          title="Board"
          description="Live surebet tips — filter and inspect legs, then auto-run places when both books are ready."
          actions={
            <button type="button" className="pt-btn pt-btn--ghost" onClick={() => void load()}>
              Refresh
            </button>
          }
        />
      ) : null}

      {!compact ? (
        <div className="board-status">
          <div className="board-status__metrics">
            <div className="board-metric">
              <span className="board-metric__label">Tips</span>
              <strong className="board-metric__value">{filtered.length}</strong>
              <span className="board-metric__hint">of {tips.length} open</span>
            </div>
            <div className="board-metric">
              <span className="board-metric__label">Runs</span>
              <strong className="board-metric__value">{executions.length}</strong>
              <span className="board-metric__hint">this client</span>
            </div>
            <div className={`board-metric${alerts.length ? ' board-metric--alert' : ''}`}>
              <span className="board-metric__label">Alerts</span>
              <strong className="board-metric__value">{alerts.length}</strong>
              <span className="board-metric__hint">review needed</span>
            </div>
          </div>
          {runningDeskId ? (
            <div className="board-status__vps">
              <div className="board-status__vps-head">
                <span className="board-status__vps-title">VPS</span>
                <span
                  className={`board-status__pill ${
                    vpsReady ? 'board-status__pill--ok' : 'board-status__pill--wait'
                  }`}
                >
                  {vpsReady ? 'Ready' : vpsWarm?.warming ? 'Connecting…' : 'Not ready'}
                </span>
              </div>
              <div className="board-status__links">
                <VpsLinkStatus label="BOL" {...bolLink} />
                <VpsLinkStatus label="PS" {...psLink} />
              </div>
              {warmLogTail.length > 0 ? (
                <ul className="board-status__log">
                  {warmLogTail.map((entry) => (
                    <li key={`${entry.at}-${entry.message}`} className={WARM_TONE_CLASS[entry.tone] ?? WARM_TONE_CLASS.info}>
                      {entry.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      {alerts.length > 0 ? (
        <div className="pt-card border-[color:rgba(239,68,68,0.35)]">
          <p className="pt-card__title text-[color:#f87171]">Action required</p>
          <ul className="space-y-1 text-sm text-[color:var(--pt-muted)]">
            {alerts.slice(0, 5).map((a) => {
              const ctx = betContext(a, tips);
              return (
                <li key={a.executionId}>
                  <span className="text-[color:var(--pt-text)]">{ctx.eventName}</span> — {a.state}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <section className="board-tips">
        <div className="board-tips__head">
          <div>
            <h2 className="board-tips__title">Open tips</h2>
            <p className="board-tips__sub">Primary feed · tip filters only</p>
          </div>
          <p className="board-tips__meta">Updated {updatedAt || '—'} · poll {POLL_MS / 1000}s</p>
        </div>

        <div className="pt-filters board-tips__filters" aria-label="Tip filters">
          <select className="pt-select" value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} aria-label="Sport">
            <option value="all">All sports</option>
            {sports.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="pt-select" value={bookFilter} onChange={(e) => setBookFilter(e.target.value)} aria-label="Bookmaker">
            <option value="all">All books</option>
            {books.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <input
            className="pt-input w-28"
            type="number"
            step="0.1"
            placeholder="Min ROI %"
            value={minRoi}
            onChange={(e) => setMinRoi(e.target.value)}
            aria-label="Minimum ROI"
          />
          <label className="flex items-center gap-2 text-sm text-[color:var(--pt-muted)]">
            <input type="checkbox" checked={hideExpired} onChange={(e) => setHideExpired(e.target.checked)} />
            Hide expired
          </label>
        </div>

        <div className="pt-grid-2 board-tips__grid">
          <div className="pt-card !p-0 overflow-hidden board-tips__list">
            {vpsLocked ? (
              <div className="p-4">
                <EmptyState title="Connecting VPS…" message="Tips unlock once both bookmaker sessions show Connected." />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState title="No open tips" message="Nothing matches these tip filters, or the hub has no open tips." />
            ) : (
              <>
                <div className="pt-table-wrap board-tips__table">
                  <table className="pt-table">
                    <thead>
                      <tr>
                        <th>Match</th>
                        <th>Sport</th>
                        <th>ROI</th>
                        <th>Seen</th>
                        <th>Status</th>
                        <th>Books</th>
                        <th>Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((tip) => {
                        const left = secondsLeft(tip.expiresAtUtc);
                        const active = selected?.tipId === tip.tipId;
                        const latest = latestByTip.get(tip.tipId) ?? null;
                        const betting = latest ? isInFlightExecutionState(latest.state) : false;
                        return (
                          <tr
                            key={tip.tipId}
                            className={active ? 'is-selected cursor-pointer' : 'cursor-pointer'}
                            onClick={() => setSelectedId(tip.tipId)}
                          >
                            <td>
                              <div className="flex items-center gap-2">
                                {betting ? <span className="pt-bet-spinner shrink-0" aria-hidden /> : null}
                                <div className="min-w-0">
                                  <div className="font-medium text-[color:var(--pt-text)]">{tip.eventName}</div>
                                  <div className="mt-0.5 text-[11px] text-[color:var(--pt-muted)]">
                                    {tip.legs.map((l) => l.selection).filter(Boolean).slice(0, 2).join(' · ')}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>{tip.sport}</td>
                            <td className="text-[color:var(--pt-cyan)]">{tip.profitPercent}%</td>
                            <td className="text-xs tabular-nums text-[color:var(--pt-muted)]">
                              {formatLocalStamp(tip.createdAt ?? tip.startsAtUtc)}
                            </td>
                            <td>
                              {betting ? (
                                <span className="flex items-center gap-1.5 text-xs text-[color:var(--pt-muted)]">
                                  <span className="pt-bet-spinner" aria-hidden />
                                  Betting…
                                </span>
                              ) : latest ? (
                                <StatusBadge state={latest.state} />
                              ) : (
                                <span className="text-xs text-[color:var(--pt-muted)]">—</span>
                              )}
                            </td>
                            <td>{tip.legs.map((l) => l.bookmaker).join(' · ')}</td>
                            <td>
                              <div className="text-xs tabular-nums">{formatLocalStamp(tip.expiresAtUtc)}</div>
                              <div className="mt-0.5">
                                {left <= 0 ? (
                                  <StatusBadge state="ABORTED" label="expired" />
                                ) : (
                                  <span className="text-[11px] text-[color:var(--pt-muted)]">{left}s left</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="board-tip-cards">
                  {filtered.map((tip) => {
                    const left = secondsLeft(tip.expiresAtUtc);
                    const active = selected?.tipId === tip.tipId;
                    const latest = latestByTip.get(tip.tipId) ?? null;
                    const betting = latest ? isInFlightExecutionState(latest.state) : false;
                    return (
                      <li key={`card-${tip.tipId}`}>
                        <button
                          type="button"
                          className={`board-tip-card${active ? ' is-selected' : ''}`}
                          onClick={() => setSelectedId(tip.tipId)}
                        >
                          <div className="board-tip-card__top">
                            <div className="min-w-0">
                              <div className="board-tip-card__title">
                                {betting ? <span className="pt-bet-spinner" aria-hidden /> : null}
                                {tip.eventName}
                              </div>
                              <div className="board-tip-card__meta">
                                {tip.sport} · ROI {tip.profitPercent}% · {left <= 0 ? 'expired' : `${left}s left`}
                              </div>
                            </div>
                            {betting ? (
                              <span className="text-xs text-[color:var(--pt-muted)]">Betting…</span>
                            ) : latest ? (
                              <StatusBadge state={latest.state} />
                            ) : null}
                          </div>
                          <div className="board-tip-card__legs">
                            {tip.legs.map((leg) => (
                              <span key={`${tip.tipId}-${leg.bookmaker}`}>
                                {leg.bookmaker} {leg.selection} @{leg.odds}
                              </span>
                            ))}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="pt-card board-tips__detail">
            {!selected ? (
              <EmptyState title="Select a tip" message="Pick a match to inspect legs and prepare checks." />
            ) : (
              <>
                <h2 className="pt-card__title flex items-center gap-2">
                  {selectedLatest && isInFlightExecutionState(selectedLatest.state) ? (
                    <span className="pt-bet-spinner" aria-hidden />
                  ) : null}
                  {selected.eventName}
                </h2>
                <p className="mb-3 text-xs text-[color:var(--pt-muted)]">
                  {selected.sport} · seen {formatLocalTime(selected.createdAt, { withSeconds: true })} · starts{' '}
                  {formatLocalTime(selected.startsAtUtc, { withSeconds: true })} · expires{' '}
                  {formatLocalTime(selected.expiresAtUtc, { withSeconds: true })} · ROI {selected.profitPercent}%
                </p>
                {selectedLatest && isInFlightExecutionState(selectedLatest.state) ? (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-[color:var(--pt-border)] px-3 py-2 text-xs text-[color:var(--pt-muted)]">
                    <span className="pt-bet-spinner" aria-hidden />
                    Betting in progress…
                    <StatusBadge state={selectedLatest.state} />
                  </div>
                ) : null}
                <ul className="mb-4 space-y-2 text-sm">
                  {selected.legs.map((leg) => (
                    <li key={`${selected.tipId}-${leg.bookmaker}`} className="rounded-md border border-[color:var(--pt-border)] px-3 py-2">
                      <div className="font-semibold">{leg.bookmaker}</div>
                      <div className="text-[color:var(--pt-muted)]">
                        {leg.selection} @ {leg.odds}
                        {leg.marketType ? ` · ${leg.marketType}` : ''}
                        {leg.line != null ? ` · line ${leg.line}` : ''}
                        {' · '}
                        stake {(leg.stakeRatio * 100).toFixed(1)}%
                      </div>
                    </li>
                  ))}
                </ul>

                {selectedLatest && !isInFlightExecutionState(selectedLatest.state) ? (
                  <div
                    className={`mb-4 rounded-xl border p-3 text-xs ${
                      selectedLatest.state === 'DONE'
                        ? 'border-[color:rgba(52,199,138,0.28)] bg-[color:rgba(52,199,138,0.06)]'
                        : 'border-[color:rgba(224,122,122,0.28)] bg-[color:rgba(224,122,122,0.06)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[color:var(--pt-text)]">Latest bet</span>
                      <StatusBadge state={selectedLatest.state} />
                    </div>
                    {selectedLatest.note ? <p className="mt-2 text-[color:var(--pt-muted)]">{selectedLatest.note}</p> : null}
                    <ul className="mt-2 space-y-1 text-[color:var(--pt-muted)]">
                      {selectedLatest.legs.map((leg) => (
                        <li key={`${selectedLatest.executionId}-${leg.bookmaker}`}>
                          <span className="font-semibold text-[color:var(--pt-text)]">{leg.bookmaker}</span>: {leg.state}
                          {leg.odds != null ? ` @ ${leg.odds}` : ''}
                          {leg.reason ? ` — ${leg.reason}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-[color:var(--pt-muted)]" htmlFor={`stake-${selected.tipId}`}>
                    Stake
                  </label>
                  <input
                    id={`stake-${selected.tipId}`}
                    className="pt-input w-24"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={stakes[selected.tipId] ?? '1'}
                    onChange={(e) => setStakes((p) => ({ ...p, [selected.tipId]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="pt-btn pt-btn--ghost"
                    disabled={
                      secondsLeft(selected.expiresAtUtc) <= 0 ||
                      prepareBothResults[selected.tipId]?.busy ||
                      vpsLocked
                    }
                    title={vpsLocked ? 'Waiting for VPS connection' : undefined}
                    onClick={() => void prepareBoth(selected.tipId)}
                  >
                    {prepareBothResults[selected.tipId]?.busy ? 'Preparing…' : 'Prepare both'}
                  </button>
                  <button
                    type="button"
                    className="pt-btn pt-btn--ghost"
                    disabled={secondsLeft(selected.expiresAtUtc) <= 0 || betOnlineResults[selected.tipId]?.busy || vpsLocked}
                    title={vpsLocked ? 'Waiting for VPS connection' : undefined}
                    onClick={() => void prepareBetOnline(selected.tipId)}
                  >
                    {betOnlineResults[selected.tipId]?.busy ? 'Checking…' : 'BetOnline check'}
                  </button>
                </div>

                {prepareBothResults[selected.tipId] && !prepareBothResults[selected.tipId].busy ? (
                  <div className="mt-3 text-xs text-[color:var(--pt-muted)]">
                    {prepareBothResults[selected.tipId].ok ? (
                      <p className="text-[color:var(--pt-success)]">Both legs ready (prepare only)</p>
                    ) : (
                      <p className="text-[color:var(--pt-danger)]">
                        Prepare not ready
                        {prepareBothResults[selected.tipId].reason
                          ? `: ${prepareBothResults[selected.tipId].reason}`
                          : ''}
                      </p>
                    )}
                  </div>
                ) : null}

                {betOnlineResults[selected.tipId] && !betOnlineResults[selected.tipId].busy ? (
                  <p
                    className={`mt-2 text-xs ${
                      betOnlineResults[selected.tipId].ok ? 'text-[color:var(--pt-success)]' : 'text-[color:var(--pt-danger)]'
                    }`}
                  >
                    {betOnlineResults[selected.tipId].ok
                      ? `BetOnline ready${betOnlineResults[selected.tipId].odds != null ? ` @ ${betOnlineResults[selected.tipId].odds}` : ''}`
                      : `BetOnline not ready: ${betOnlineResults[selected.tipId].reason ?? 'unknown'}`}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="board-history pt-card">
        <div className="board-history__head">
          <div>
            <h2 className="pt-card__title mb-0">Recent bets</h2>
            <p className="mt-1 text-xs text-[color:var(--pt-muted)]">Bet history · match &amp; selection details</p>
          </div>
        </div>
        {recentBets.length === 0 ? (
          <EmptyState title="No bets yet" message="New runs from this point will appear here." />
        ) : (
          <ul className="board-history__list">
            {recentBets.map((execution) => {
              const ctx = betContext(execution, tips);
              const inFlight = isInFlightExecutionState(execution.state);
              const failed = isFailedExecutionState(execution.state);
              return (
                <li key={execution.executionId} className="board-history__item">
                  <div className="board-history__main">
                    <div className="board-history__title-row">
                      <div className="min-w-0">
                        <div className="board-history__event">{ctx.eventName}</div>
                        <div className="board-history__sub">
                          {[ctx.sport, ctx.profitPercent != null ? `ROI ${ctx.profitPercent}%` : null, `stake ${execution.totalStake}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <div className="board-history__status">
                        {inFlight ? (
                          <span className="flex items-center gap-1.5 text-xs text-[color:var(--pt-muted)]">
                            <span className="pt-bet-spinner" aria-hidden />
                            Betting…
                          </span>
                        ) : null}
                        <StatusBadge state={execution.state} />
                      </div>
                    </div>
                    <ul className="board-history__legs">
                      {(ctx.legs.length > 0 ? ctx.legs : execution.legs.map((l) => ({ bookmaker: l.bookmaker, selection: '', odds: l.odds, marketType: null, line: null }))).map(
                        (leg) => {
                          const live = execution.legs.find((l) => l.bookmaker === leg.bookmaker);
                          const odds = live?.odds ?? leg.odds;
                          return (
                            <li key={`${execution.executionId}-${leg.bookmaker}`}>
                              <span className="board-history__book">{leg.bookmaker}</span>
                              <span className="board-history__sel">
                                {leg.selection || '—'}
                                {leg.marketType ? ` · ${leg.marketType}` : ''}
                                {leg.line != null ? ` · ${leg.line}` : ''}
                                {odds != null ? ` @ ${odds}` : ''}
                              </span>
                              {live?.state ? <span className="board-history__leg-state">{live.state}</span> : null}
                            </li>
                          );
                        }
                      )}
                    </ul>
                    {failed ? (
                      <p className="board-history__fail">{formatExecutionReason(execution.note, execution.legs, true)}</p>
                    ) : null}
                    {execution.createdAt ? (
                      <p className="board-history__time">{formatLocalTime(execution.createdAt, { withSeconds: true })}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
