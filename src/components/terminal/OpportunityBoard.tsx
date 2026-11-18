'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '@/components/terminal/PageHeader';
import KpiCard from '@/components/terminal/KpiCard';
import StatusBadge from '@/components/terminal/StatusBadge';
import EmptyState from '@/components/terminal/EmptyState';
import ErrorState from '@/components/terminal/ErrorState';
import LoadingState from '@/components/terminal/LoadingState';
import Toast, { type ToastMessage } from '@/components/terminal/Toast';
import {
  type BetOnlineStatus,
  type Execution,
  type Tip,
  secondsLeft,
} from '@/lib/terminal/surebetTypes';

const POLL_MS = 3000;

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

function failureSummary(execution: Execution | null | undefined): string {
  if (!execution) return '';
  const reasons = execution.legs
    .map((leg) => `${leg.bookmaker}: ${leg.reason || leg.state}`)
    .filter(Boolean)
    .join(' · ');
  return reasons || execution.note || execution.state;
}

function looksLikeOddsOrLineChange(execution: Execution): boolean {
  const text = [
    execution.note ?? '',
    ...execution.legs.map((leg) => leg.reason ?? ''),
  ].join(' ');
  return /odds moved|line moved|no surebet|event not found|changed/i.test(text);
}

function truncateText(value: string, max = 150): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export default function OpportunityBoard({ compact = false }: { compact?: boolean }) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [betOnlineStatus, setBetOnlineStatus] = useState<BetOnlineStatus | null>(null);
  const [betOnlineResults, setBetOnlineResults] = useState<Record<string, PrepareBol>>({});
  const [prepareBothResults, setPrepareBothResults] = useState<Record<string, PrepareBoth>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState('all');
  const [bookFilter, setBookFilter] = useState('all');
  const [minRoi, setMinRoi] = useState('');
  const [hideExpired, setHideExpired] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastSeq = useRef(0);

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
      if (res.ok) setBetOnlineStatus(data as BetOnlineStatus);
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

  useEffect(() => {
    void load();
    void loadBetOnline();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load, loadBetOnline]);

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
            ? 'Could not prepare both legs at the original odds/line. Run will try a recalculation.'
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

  const run = async (tipId: string) => {
    const stake = Number(stakes[tipId] ?? '1');
    if (!Number.isFinite(stake) || stake <= 0) {
      setError('Stake must be a positive number');
      return;
    }
    setBusy(tipId);
    setError(null);
    try {
      const res = await fetch('/api/surebets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipId, stake }),
      });
      const data = await res.json().catch(() => ({}));
      const execution = data?.executionId ? (data as Execution) : null;

      if (!res.ok) {
        if (execution) {
          const changed = looksLikeOddsOrLineChange(execution);
          setError(null);
          pushToast({
            tone: 'danger',
            title: changed ? 'Odds/line change detected' : 'Bet cancelled',
            message: changed
              ? 'Tried to rebuild the surebet with the new odds/line, but the profit condition was not met.'
              : `Execution ended in ${execution.state}.`,
            details: legDetails(execution),
          });
          await load();
        } else {
          const message = data?.error ?? `Run failed (${res.status})`;
          setError(message);
          pushToast({ tone: 'danger', title: 'Bet failed', message });
        }
        return;
      }

      if (execution) {
        if (execution.state === 'DONE') {
          pushToast({
            tone: 'success',
            title: execution.rebuilt ? 'Bet placed after surebet rebuild' : 'Bet placed',
            message:
              execution.rebuilt && execution.rebuild
                ? `Applied line ${execution.rebuild.appliedLine} · expected profit ${execution.rebuild.profitPercent}%`
                : 'Both legs were committed and verified.',
            details: execution.legs.map((leg) => `${leg.bookmaker}${leg.orderId ? `: ${leg.orderId}` : ''}`),
          });
        } else if (execution.state === 'ONE_LEG' || execution.state === 'REVIEW_NEEDED') {
          pushToast({
            tone: 'warning',
            title: 'Review required',
            message: execution.state,
            details: legDetails(execution),
          });
        } else {
          pushToast({
            tone: 'info',
            title: `Execution state: ${execution.state}`,
            details: legDetails(execution),
          });
        }
      }
      await load();
    } catch (e) {
      const message = (e as Error)?.message ?? 'Run failed';
      setError(message);
      pushToast({ tone: 'danger', title: 'Bet failed', message });
    } finally {
      setBusy(null);
    }
  };

  const alerts = executions.filter((e) => e.state === 'ONE_LEG' || e.state === 'REVIEW_NEEDED');
  const vpsLabel = !betOnlineStatus
    ? 'Checking…'
    : !betOnlineStatus.configured
      ? 'Not configured'
      : betOnlineStatus.reachable
        ? 'Reachable'
        : 'Unreachable';

  if (loading) return <LoadingState label="Loading opportunities…" />;

  return (
    <div className="space-y-4">
      {!compact ? (
        <PageHeader
          title="Board"
          description="Open hub tips. Filters use tip fields only (sport, bookmaker, ROI, expiry)."
          actions={
            <button type="button" className="pt-btn pt-btn--ghost" onClick={() => void load()}>
              Refresh
            </button>
          }
        />
      ) : null}

      {!compact ? (
        <div className="pt-kpi-grid">
          <KpiCard label="Open tips" value={tips.length} hint={`Showing ${filtered.length}`} />
          <KpiCard label="Executions" value={executions.length} hint="Recent for this client" />
          <KpiCard label="Alerts" value={alerts.length} hint="ONE_LEG / REVIEW_NEEDED" />
          <KpiCard label="BetOnline VPS" value={vpsLabel} hint={betOnlineStatus?.reason ?? undefined} />
        </div>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      {alerts.length > 0 ? (
        <div className="pt-card border-[color:rgba(239,68,68,0.35)]">
          <p className="pt-card__title text-[color:#f87171]">Action required</p>
          <ul className="space-y-1 text-sm text-[color:var(--pt-muted)]">
            {alerts.slice(0, 5).map((a) => (
              <li key={a.executionId}>
                <span className="font-mono text-xs text-[color:var(--pt-text)]">{a.executionId}</span> — {a.state}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="pt-filters">
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

      <div className="pt-grid-2">
        <div className="pt-card !p-0 overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState title="No open tips" message="Nothing matches the current filters, or the hub has no open tips." />
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Sport</th>
                    <th>ROI</th>
                    <th>Last run</th>
                    <th>Books</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tip) => {
                    const left = secondsLeft(tip.expiresAtUtc);
                    const active = selected?.tipId === tip.tipId;
                    const latest = latestByTip.get(tip.tipId) ?? null;
                    return (
                      <tr
                        key={tip.tipId}
                        className={active ? 'is-selected cursor-pointer' : 'cursor-pointer'}
                        onClick={() => setSelectedId(tip.tipId)}
                      >
                        <td>
                          <div className="font-medium text-[color:var(--pt-text)]">{tip.eventName}</div>
                          <div className="mt-0.5 text-xs text-[color:var(--pt-muted)] font-mono">{tip.tipId}</div>
                        </td>
                        <td>{tip.sport}</td>
                        <td className="text-[color:var(--pt-cyan)]">{tip.profitPercent}%</td>
                        <td>
                          {latest ? (
                            <div className="space-y-1">
                              <StatusBadge state={latest.state} />
                              {latest.state !== 'DONE' ? (
                                <div className="max-w-[220px] text-[11px] leading-snug text-[color:var(--pt-danger)]">
                                  {truncateText(failureSummary(latest), 120)}
                                </div>
                              ) : latest.rebuilt && latest.rebuild ? (
                                <div className="text-[11px] leading-snug text-[color:var(--pt-success)]">
                                  rebuilt line {latest.rebuild.appliedLine}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-[color:var(--pt-muted)]">—</span>
                          )}
                        </td>
                        <td>{tip.legs.map((l) => l.bookmaker).join(' · ')}</td>
                        <td>{left <= 0 ? <StatusBadge state="ABORTED" label="expired" /> : `${left}s`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pt-card">
          {!selected ? (
            <EmptyState title="Select a tip" message="Choose a row to inspect legs and run." />
          ) : (
            <>
              <h2 className="pt-card__title">{selected.eventName}</h2>
              <p className="mb-3 text-xs text-[color:var(--pt-muted)]">
                {selected.sport} · starts {new Date(selected.startsAtUtc).toLocaleString()} · expected ROI{' '}
                {selected.profitPercent}%
              </p>
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

              {selectedLatest ? (
                <div
                  className={`mb-4 rounded-xl border p-3 text-xs ${
                    selectedLatest.state === 'DONE'
                      ? 'border-[color:rgba(52,199,138,0.28)] bg-[color:rgba(52,199,138,0.06)]'
                      : 'border-[color:rgba(224,122,122,0.28)] bg-[color:rgba(224,122,122,0.06)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[color:var(--pt-text)]">Recent run</span>
                    <StatusBadge state={selectedLatest.state} />
                  </div>
                  {selectedLatest.rebuilt && selectedLatest.rebuild ? (
                    <p className="mt-2 text-[color:var(--pt-success)]">
                      Rebuilt line {selectedLatest.rebuild.appliedLine} (was {selectedLatest.rebuild.originalLine ?? '—'}) ·{' '}
                      {selectedLatest.rebuild.profitPercent}%
                    </p>
                  ) : null}
                  {selectedLatest.note ? (
                    <p className="mt-2 text-[color:var(--pt-muted)]">{selectedLatest.note}</p>
                  ) : null}
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
                  className="pt-btn pt-btn--primary"
                  disabled={secondsLeft(selected.expiresAtUtc) <= 0 || busy === selected.tipId}
                  onClick={() => void run(selected.tipId)}
                >
                  {busy === selected.tipId ? 'Running…' : 'Run'}
                </button>
                <button
                  type="button"
                  className="pt-btn pt-btn--ghost"
                  disabled={
                    secondsLeft(selected.expiresAtUtc) <= 0 ||
                    busy === selected.tipId ||
                    prepareBothResults[selected.tipId]?.busy
                  }
                  onClick={() => void prepareBoth(selected.tipId)}
                >
                  {prepareBothResults[selected.tipId]?.busy ? 'Preparing…' : 'Prepare both'}
                </button>
                <button
                  type="button"
                  className="pt-btn pt-btn--ghost"
                  disabled={secondsLeft(selected.expiresAtUtc) <= 0 || betOnlineResults[selected.tipId]?.busy}
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
                  {Array.isArray(prepareBothResults[selected.tipId].legs) ? (
                    <ul className="mt-1 list-disc pl-4">
                      {prepareBothResults[selected.tipId].legs!.map((leg) => (
                        <li key={leg.bookmaker}>
                          {leg.bookmaker}: {leg.ok ? 'ok' : 'not ready'}
                          {leg.odds != null ? ` @ ${leg.odds}` : ''}
                          {leg.reason ? ` — ${leg.reason}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
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

              <p className="mt-3 text-xs text-[color:var(--pt-muted)]">
                Stake splits by leg ratios. Prepare never places. Run commits only when both legs are ready.
              </p>
            </>
          )}
        </div>
      </div>

      {!compact ? (
        <div className="pt-card">
          <h2 className="pt-card__title">Recent executions ({executions.length})</h2>
          {executions.length === 0 ? (
            <EmptyState title="No executions yet" />
          ) : (
            <div className="pt-table-wrap">
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Execution</th>
                    <th>State</th>
                    <th>Stake</th>
                    <th>Legs</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.slice(0, 12).map((e) => (
                    <tr key={e.executionId}>
                      <td className="font-mono text-xs">{e.executionId}</td>
                      <td>
                        <StatusBadge state={e.state} />
                      </td>
                      <td>{e.totalStake}</td>
                      <td className="text-xs text-[color:var(--pt-muted)]">
                        {e.legs.map((l) => `${l.bookmaker}:${l.state}`).join(' / ')}
                      </td>
                      <td className="text-xs text-[color:var(--pt-muted)]">
                        <div>{e.note ?? ''}</div>
                        <div className="mt-1 text-[11px] leading-snug">
                          {e.legs.map((leg) => `${leg.bookmaker}: ${leg.reason || leg.state}`).join(' · ')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-[color:var(--pt-muted)]">
            Poll every {POLL_MS / 1000}s · last update {updatedAt || '—'}
          </p>
        </div>
      ) : null}

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
