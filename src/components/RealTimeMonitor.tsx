'use client';

import { useEffect, useState, useRef } from 'react';
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
    id: string;
    timestamp: string;
    amount: number;
    result: 'WIN' | 'LOSS';
    profit: number;
}

interface TipEntry {
    id: string;
    timestamp: string;
    message: string;
    source: string;
}

export default function RealTimeMonitor({ instanceId }: RealTimeMonitorProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [bets, setBets] = useState<BetEntry[]>([]);
    const [tips, setTips] = useState<TipEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(1000); // Default simulated balance
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // In a real app, this URL might come from config or environment variable
        // For now, we assume a websocket server running locally or proxied
        const SOCKET_URL = process.env.BOTMANAGER_URL || 'http://localhost:4000';

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

        socketRef.current.on('bet', (data: BetEntry) => {
            setBets((prev) => [data, ...prev].slice(0, 10));
        });

        socketRef.current.on('tip', (data: TipEntry) => {
            setTips((prev) => {
                const withoutSame = prev.filter(t => t.id !== data.id);
                return [data, ...withoutSame].slice(0, 10);
            });
        });

        // Mock Data Simulation (For demo purposes if no server is running)
        const interval = setInterval(() => {
            if (!socketRef.current?.connected) {
                // Simulate incoming data for visual verification if WS fails/not present
                const now = new Date().toISOString();
                const levels = ['INFO', 'INFO', 'INFO', 'WARN'];
                const level = levels[Math.floor(Math.random() * levels.length)];

                if (Math.random() > 0.7) {
                    setLogs((prev) => [{
                        timestamp: now,
                        level,
                        message: `System status check: ${Math.random().toFixed(2)}`
                    }, ...prev].slice(0, 50));
                }

                if (Math.random() > 0.8) {
                    const win = Math.random() > 0.5;
                    setBets((prev) => [{
                        id: Math.random().toString(36).substr(2, 9),
                        timestamp: now,
                        amount: Math.floor(Math.random() * 100),
                        result: (win ? 'WIN' : 'LOSS') as 'WIN' | 'LOSS',
                        profit: win ? Math.floor(Math.random() * 50) : -Math.floor(Math.random() * 50)
                    }, ...prev].slice(0, 20));
                }

                if (Math.random() > 0.9) {
                    const newTip = {
                        id: Math.random().toString(36).substr(2, 9),
                        timestamp: now,
                        message: `Buy signal detected on pair #${Math.floor(Math.random() * 10)}`,
                        source: 'SignalProvider_A'
                    } as TipEntry;
                    setTips((prev) => {
                        const withoutSame = prev.filter(t => t.id !== newTip.id);
                        return [newTip, ...withoutSame].slice(0, 20);
                    });
                }

                // Simulate Balance Update
                if (Math.random() > 0.8) {
                    setCurrentBalance(prev => prev + (Math.random() > 0.5 ? 10 : -5));
                }
            }
        }, 2000);

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            clearInterval(interval);
        };
    }, [instanceId]);

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
            {/* Logs Section */}
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 lg:col-span-2">
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">System Logs</h3>
                    <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            Live Balance: <span className="text-lg font-bold text-gray-900 dark:text-white">${currentBalance.toFixed(2)}</span>
                        </div>
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

            {/* Betting History */}
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Betting History</h3>
                <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Time</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Result</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800 text-sm">
                            {bets.map((bet) => (
                                <tr key={bet.id}>
                                    <td className="px-3 py-2 text-gray-500 dark:text-gray-300">{bet.timestamp.split('T')[1]?.split('.')[0]}</td>
                                    <td className="px-3 py-2">
                                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${bet.result === 'WIN' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                            {bet.result}
                                        </span>
                                    </td>
                                    <td className={`px-3 py-2 font-medium ${bet.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {bet.profit}
                                    </td>
                                </tr>
                            ))}
                            {bets.length === 0 && (
                                <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-500">No bets yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tip History */}
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
