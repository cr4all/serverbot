'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import he from 'he';

interface RealTimeMonitorProps {
    instanceId: string;
}

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
}

interface BetEntry {
    _id: string;
    createdAt: string;
    botInstanceId?: string;
    tip_id?: string;
    tip?: string;
    stake: number;
    failedCount: number;
    status: 'SUCCESS' | 'FAILED';
    balance?: number;
}

interface TipEntry {
    id: string;
    timestamp: string;
    message: string;
    source: string;
}

export default function RealTimeMonitor({ instanceId }: RealTimeMonitorProps) {
    const { data: session } = useSession();
    const isAdmin = (session?.user as any)?.role === 'admin';
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [bets, setBets] = useState<BetEntry[]>([]);
    const [tips, setTips] = useState<TipEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(0); // Default simulated balance
    const socketRef = useRef<Socket | null>(null);
    // Use client-exposed env var. NEXT_PUBLIC_* vars are inlined into browser bundles.
    // Keep fallback to server-only BOTMANAGER_URL and localhost for safety.
    const SOCKET_URL = process.env.NEXT_PUBLIC_BOTMANAGER_URL || 'http://localhost:4000';

    // Function to fetch the current balance from the server
    const fetchBalance = async (signal?: AbortSignal) => {
        try {
            const res = await fetch(`${SOCKET_URL}/bot/balance/${instanceId}`, { signal });
            if (!res.ok) {
                console.error('Failed to fetch balance', res.status);
                return;
            }
            const data = await res.json();
            if (data && typeof data.balance === 'number') {
                setCurrentBalance(data.balance);
            }
        } catch (e) {
            if ((e as any).name === 'AbortError') return;
            console.error('Failed to fetch balance', e);
        }
    };

    useEffect(() => {
        // Clear any previous logs, bets, and tips when this monitor is opened or when instanceId changes
        setLogs([]);
        setBets([]);
        setTips([]);

        // socket connection
        socketRef.current = io(SOCKET_URL, {
            query: { instanceId },
            transports: ['websocket'],
        });

        socketRef.current.on('connect', () => {
            setIsConnected(true);
            console.log('Connected to WebSocket');
            socketRef.current?.send(JSON.stringify({ subscribe: instanceId }));
        });

        socketRef.current.on('disconnect', () => {
            setIsConnected(false);
            console.log('Disconnected from WebSocket');
        });

        socketRef.current.on('log', (data: LogEntry) => {
            setLogs((prev) => [data, ...prev].slice(0, 100)); // Keep last 100 logs
        });

        socketRef.current.on('bet', (data: any) => {
            const mapped: Partial<BetEntry> = {
                _id: data._id || data.id || Math.random().toString(36).substr(2, 9),
                createdAt: data.createdAt || new Date().toISOString(),
                stake: data.stake || data.amount || 0,
                status: data.status || (data.result === 'WIN' ? 'SUCCESS' : 'FAILED'),
                failedCount: data.failedCount || 0,
                balance: data.balance,
            };
            setBets((prev) => [mapped as BetEntry, ...prev].slice(0, 20));
        });

        socketRef.current.on('tip', (data: TipEntry) => {
            setTips((prev) => {
                const withoutSame = prev.filter(t => t.id !== data.id);
                return [data, ...withoutSame].slice(0, 10);
            });
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [instanceId]);

    // Fetch balance initially and every 1 minute
    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();

        // initial fetch
        fetchBalance(controller.signal);

        // Poll every 1 minute
        const interval = setInterval(() => fetchBalance(), 60_000);

        return () => {
            mounted = false;
            controller.abort();
            clearInterval(interval);
        };
    }, [instanceId, SOCKET_URL]);

    // Poll DB for BetHistory for this instance
    useEffect(() => {
        let mounted = true;
        const fetchBets = async () => {
            try {
                const res = await fetch(`/api/bet-history/${instanceId}?limit=10`);
                if (!res.ok) return;
                const dataRaw = await res.json();
                if (mounted) {
                    const mapped = (dataRaw || []).map((b: any) => ({
                        _id: b._id,
                        createdAt: b.createdAt,
                        botInstanceId: b.botInstanceId || b.botInstance || b.botInstanceId,
                        tip_id: b.tip_id,
                        tip: b.tip,
                        stake: b.stake,
                        failedCount: b.failedCount || 0,
                        status: b.status,
                        balance: b.balance,
                    } as BetEntry));
                    setBets(mapped);
                }
            } catch (e) {
                console.error('Failed to fetch bet history', e);
            }
        };

        fetchBets();
        const poll = setInterval(fetchBets, 3000);

        return () => {
            mounted = false;
            clearInterval(poll);
        };
    }, [instanceId]);

    const removeBet = async (betId: string) => {
        try {
            const res = await fetch(`/api/bet-history/${instanceId}?betId=${encodeURIComponent(betId)}`, { method: 'DELETE' });
            if (!res.ok) return;
            setBets((prev) => prev.filter((b) => b._id !== betId));
        } catch (e) {
            console.error('Failed to remove bet', e);
        }
    };

    const decodeTipMessage = (s: string) => {
        if (!s) return s;
        let decoded = s;
        try {
            decoded = decodeURIComponent(s);
        } catch (e) {
            decoded = s;
        }
        try {
            return he.decode(decoded);
        } catch (e) {
            return decoded;
        }
    };

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Betting History - full width first row */}
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 lg:col-span-2">
                <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Betting History</h3>
                <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Time</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Status</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Tip</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Stake</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Balance</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Failures</th>
                                {isAdmin && <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800 text-sm">
                            {bets.map((bet) => (
                                <tr key={bet._id}>
                                    <td className="px-3 py-2 text-gray-500 dark:text-gray-300">{new Date(bet.createdAt).toLocaleString()}</td>
                                    <td className="px-3 py-2">
                                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${bet.status === 'SUCCESS' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                            {bet.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="text-sm text-gray-700 dark:text-gray-200 truncate max-w-sm">{decodeTipMessage(bet.tip || bet.tip_id || '')}</div>
                                    </td>
                                    <td className={`px-3 py-2 font-medium text-gray-700 dark:text-gray-200`}>{bet.stake}</td>
                                    <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{bet.balance != null ? `$${Number(bet.balance).toFixed(2)}` : '—'}</td>
                                    <td className={`px-3 py-2 font-medium ${bet.failedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>{bet.failedCount}</td>
                                    {isAdmin && (
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                onClick={() => removeBet(bet._id)}
                                                aria-label="Remove bet"
                                                className="inline-flex items-center rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                                title="Remove bet"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {bets.length === 0 && (
                                <tr><td colSpan={isAdmin ? 7 : 6} className="px-3 py-4 text-center text-gray-500">No bets yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* System Logs - same row as Latest Tips */}
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">System Logs</h3>
                    <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            Live Balance: <span className="text-lg font-bold text-gray-900 dark:text-white">${currentBalance.toFixed(2)}</span>
                        </div>
                        <button
                            onClick={() => fetchBalance()}
                            aria-label="Refresh balance"
                            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            Refresh
                        </button>
                        <span className={`inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} title={isConnected ? 'Connected' : 'Simulating/Connecting'} />
                    </div>
                </div>
                <div className="h-64 overflow-y-auto rounded bg-gray-900 p-4 font-mono text-xs text-gray-300 sm:h-80">
                    {logs.map((log, i) => (
                        <div key={i} className="mb-1">
                            <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                            <span className={log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARN' ? 'text-yellow-400' : 'text-blue-400'}>
                                {log.level}
                            </span>:{' '}
                            {log.message}
                        </div>
                    ))}
                    {logs.length === 0 && <div className="text-gray-600">No logs received yet...</div>}
                </div>
            </div>

            {/* Latest Tips - same row as System Logs */}
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Latest Tips</h3>
                <div className="space-y-3">
                    {tips.map((tip) => (
                        <div key={tip.id} className="border-l-4 border-blue-500 bg-blue-50 p-3 dark:bg-blue-900/20 dark:border-blue-400">
                            <div className="flex justify-between">
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{tip.source}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{tip.timestamp.split('T')[1]?.split('.')[0]}</span>
                            </div>
                            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{decodeTipMessage(tip.message)}</p>
                        </div>
                    ))}
                    {tips.length === 0 && <div className="text-center text-gray-500 py-4">No tips received</div>}
                </div>
            </div>
        </div>
    );
}
