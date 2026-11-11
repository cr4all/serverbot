'use client';

import { useCallback, useEffect, useState } from 'react';

interface Leg {
    bookmaker: string;
    eventName: string;
    selection: string;
    odds: number;
    stakeRatio: number;
}

interface Tip {
    tipId: string;
    eventName: string;
    sport: string;
    startsAtUtc: string;
    expiresAtUtc: string;
    profitPercent: number;
    legs: Leg[];
}

interface Execution {
    executionId: string;
    totalStake: number;
    state: string;
    note?: string | null;
    legs: Array<{ bookmaker: string; state: string; reason?: string | null; orderId?: string | null }>;
}

const POLL_MS = 3000;

function secondsLeft(iso: string): number {
    const end = new Date(iso).getTime();
    return Number.isNaN(end) ? 0 : Math.max(0, Math.floor((end - Date.now()) / 1000));
}

function stateClass(state: string): string {
    if (state === 'DONE') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    if (state === 'ONE_LEG' || state === 'REVIEW_NEEDED') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    if (state === 'ABORTED') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
}

export default function SurebetsPage() {
    const [tips, setTips] = useState<Tip[]>([]);
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [stakes, setStakes] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<string>('');

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
        }
    }, []);

    useEffect(() => {
        void load();
        const id = setInterval(() => void load(), POLL_MS);
        return () => clearInterval(id);
    }, [load]);

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
            if (!res.ok) setError(data?.error ?? `Run failed (${res.status})`);
            else await load();
        } catch (e) {
            setError((e as Error)?.message ?? 'Run failed');
        } finally {
            setBusy(null);
        }
    };

    const alerts = executions.filter((e) => e.state === 'ONE_LEG' || e.state === 'REVIEW_NEEDED');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Surebets</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Live tips from the hub. Both legs must be ready before anything is placed.
                </p>
            </div>

            {error && (
                <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                    {error}
                </div>
            )}

            {alerts.length > 0 && (
                <div className="rounded-md border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100">
                    <p className="font-semibold">Action required</p>
                    <ul className="mt-1 list-disc pl-5">
                        {alerts.slice(0, 5).map((a) => (
                            <li key={a.executionId}>{a.executionId} - {a.state} - check both sites manually</li>
                        ))}
                    </ul>
                </div>
            )}

            <section>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Open tips ({tips.length})</h2>
                {tips.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No open tips right now.</p>
                ) : (
                    <div className="mt-3 space-y-3">
                        {tips.map((tip) => {
                            const left = secondsLeft(tip.expiresAtUtc);
                            const expired = left <= 0;
                            return (
                                <div key={tip.tipId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{tip.eventName}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {tip.sport} - starts {new Date(tip.startsAtUtc).toLocaleString()} - profit {tip.profitPercent}%
                                            </p>
                                        </div>
                                        <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                            {expired ? 'expired' : `${left}s left`}
                                        </span>
                                    </div>

                                    <ul className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                        {tip.legs.map((leg) => (
                                            <li key={`${tip.tipId}-${leg.bookmaker}`}>
                                                <span className="font-medium">{leg.bookmaker}</span> - {leg.eventName} - {leg.selection} @ {leg.odds} - stake {(leg.stakeRatio * 100).toFixed(1)}%
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="mt-3 flex items-center gap-2">
                                        <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor={`stake-${tip.tipId}`}>Stake</label>
                                        <input
                                            id={`stake-${tip.tipId}`}
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={stakes[tip.tipId] ?? '1'}
                                            onChange={(e) => setStakes((p) => ({ ...p, [tip.tipId]: e.target.value }))}
                                            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                        />
                                        <button
                                            type="button"
                                            disabled={expired || busy === tip.tipId}
                                            onClick={() => void run(tip.tipId)}
                                            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                                        >
                                            {busy === tip.tipId ? 'Running...' : 'Run'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">My executions ({executions.length})</h2>
                {executions.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Nothing executed yet.</p>
                ) : (
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                                    <th className="py-2 pr-4">Execution</th>
                                    <th className="py-2 pr-4">State</th>
                                    <th className="py-2 pr-4">Stake</th>
                                    <th className="py-2 pr-4">Legs</th>
                                    <th className="py-2">Note</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {executions.map((e) => (
                                    <tr key={e.executionId} className="text-gray-700 dark:text-gray-300">
                                        <td className="py-2 pr-4 font-mono text-xs">{e.executionId}</td>
                                        <td className="py-2 pr-4">
                                            <span className={`rounded px-2 py-0.5 text-xs ${stateClass(e.state)}`}>{e.state}</span>
                                        </td>
                                        <td className="py-2 pr-4">{e.totalStake}</td>
                                        <td className="py-2 pr-4">{e.legs.map((l) => `${l.bookmaker}:${l.state}`).join(' / ')}</td>
                                        <td className="py-2 text-xs text-gray-500 dark:text-gray-400">{e.note ?? ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <p className="text-xs text-gray-400 dark:text-gray-500">
                Refreshed every {POLL_MS / 1000}s - last update {updatedAt || '-'}
            </p>
        </div>
    );
}
