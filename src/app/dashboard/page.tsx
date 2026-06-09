'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { IBotInstance } from '@/types';
import CreateBotDialog from './CreateBotDialog';
import MessageDialog from '@/components/MessageDialog';
import { formatFilterSummary, templateSupportsTipFilters } from '@/lib/botInstanceFilters';

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
}

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [instances, setInstances] = useState<IBotInstance[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingInstance, setEditingInstance] = useState<IBotInstance | null>(null);
    const [messageDialog, setMessageDialog] = useState<{ open: boolean; title: string; message: string; variant?: 'info' | 'warning' | 'danger' | 'success' }>({
        open: false,
        title: '',
        message: '',
        variant: 'info',
    });

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchInstances();
        }
    }, [status, router]);

    // Poll for instance updates every 30 seconds when authenticated
    useEffect(() => {
        if (status !== 'authenticated') return;

        const interval = setInterval(() => {
            fetchInstances();
        }, 30_000);

        return () => clearInterval(interval);
    }, [status]);

    const fetchInstances = async () => {
        try {
            const res = await fetch(`/api/bot-instances`);
            if (res.ok) {
                const data = await res.json();
                setInstances(data);
            }
        } catch (error) {
            console.error('Failed to fetch instances', error);
        } finally {
            setLoading(false);
        }
    };

    const openCreateDialog = () => {
        setEditingInstance(null);
        setIsDialogOpen(true);
    };

    const openEditDialog = (instance: IBotInstance) => {
        setEditingInstance(instance);
        setIsDialogOpen(true);
    };

    if (status === 'loading' || loading) return <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading...</div>;
    if (!session) return null;

    return (
        <div>
            <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Your Bot Instances</h1>
                    <p className="text-sm text-gray-500">Welcome back, {session.user?.name}</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-4">
                    <button
                        onClick={openCreateDialog}
                        className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Add New Bot
                    </button>
                </div>
            </div>

            <CreateBotDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onSuccess={fetchInstances}
                initialData={editingInstance}
            />

            <MessageDialog
                open={messageDialog.open}
                title={messageDialog.title}
                message={messageDialog.message}
                variant={messageDialog.variant}
                onClose={() => setMessageDialog({ open: false, title: '', message: '', variant: 'info' })}
            />

            {instances.length === 0 ? (
                <div className="text-center text-gray-500 py-10 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <p>No bot instances found. Create one to get started!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {instances.map((instance) => (
                        <BotCard
                            key={instance._id as string}
                            instance={instance}
                            refresh={fetchInstances}
                            onEdit={() => openEditDialog(instance)}
                            onMessage={(m) => setMessageDialog(m)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

const SOCKET_URL = process.env.NEXT_PUBLIC_BOTMANAGER_URL || 'http://localhost:4000';
const RECENT_LOGS_MAX = 3;

function BotCard({
    instance,
    refresh,
    onEdit,
    onMessage,
}: {
    instance: IBotInstance;
    refresh: () => void;
    onEdit: () => void;
    onMessage: (m: { open: boolean; title: string; message: string; variant?: 'info' | 'warning' | 'danger' | 'success' }) => void;
}) {
    const isRunning = instance.status === 'RUNNING';
    const instanceId = instance._id as string;

    const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
    const socketRef = useRef<Socket | null>(null);

    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [balanceError, setBalanceError] = useState<string | null>(null);

    // WebSocket: subscribe to logs for this instance, keep last 2–3
    useEffect(() => {
        setRecentLogs([]);
        socketRef.current = io(SOCKET_URL, {
            query: { instanceId },
            transports: ['websocket'],
        });

        socketRef.current.on('connect', () => {
            socketRef.current?.send(JSON.stringify({ subscribe: instanceId }));
        });

        socketRef.current.on('log', (data: LogEntry) => {
            setRecentLogs((prev) => [data, ...prev].slice(0, RECENT_LOGS_MAX));
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [instanceId]);

    const fetchBalanceFromServer = async () => {
        setBalanceError(null);
        setIsLoadingBalance(true);
        try {
            const res = await fetch(`${SOCKET_URL}/bot/balance/${instanceId}`);
            if (!res.ok) {
                setBalanceError('Failed to fetch balance');
                return;
            }
            const data = await res.json();
            const balance = data?.balance;
            if (typeof balance !== 'number') {
                setBalanceError('Invalid balance from server');
                return;
            }
            const patchRes = await fetch(`/api/bot-instances/${instance._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lastBalance: balance }),
            });
            if (!patchRes.ok) {
                setBalanceError('Failed to save balance');
                return;
            }
            refresh();
        } catch (e) {
            console.error(e);
            setBalanceError('Failed to fetch balance');
        } finally {
            setIsLoadingBalance(false);
        }
    };

    const toggleStatus = async () => {
        const newStatus = isRunning ? 'STOPPED' : 'RUNNING';
        try {
            const res = await fetch(`/api/bot-instances/${instance._id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                onMessage({
                    open: true,
                    title: 'Cannot start bot',
                    message: err?.error || 'Failed to update instance.',
                    variant: err?.code === 'BOT_TEMPLATE_MAINTENANCE' ? 'warning' : 'danger',
                });
                return;
            }
            refresh();
        } catch (e) {
            console.error(e);
            onMessage({
                open: true,
                title: 'Request failed',
                message: 'Failed to update instance. Please try again.',
                variant: 'danger',
            });
        }
    };

    const deleteInstance = async () => {
        if (!confirm('Are you sure?')) return;
        try {
            await fetch(`/api/bot-instances/${instance._id}`, {
                method: 'DELETE',
            });
            refresh();
        } catch (e) {
            console.error(e);
        }
    };

    const filterSummary = formatFilterSummary(instance.config ?? {});
    const showFilterSummary =
        templateSupportsTipFilters(
            instance.botId && typeof instance.botId === 'object' ? (instance.botId as { type?: string; subtype?: number }) : null
        ) && filterSummary;

    return (
        <div className="overflow-hidden rounded-lg bg-white shadow transition hover:shadow-md dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className={`h-3 w-3 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate" title={instance.name}>
                            <Link href={`/dashboard/instance/${instance._id}`} className="hover:underline hover:text-blue-500 truncate">
                                {instance.name}
                            </Link>
                        </h3>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        {(instance.botId as any)?.type || 'UNKNOWN'}
                    </span>
                </div>
                <div className="mt-4 space-y-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Bot template: <span className="font-medium">{(instance.botId as any)?.name || 'Unknown'}</span>
                    </p>
                    {instance.config?.username && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Username: <span className="font-medium text-gray-900 dark:text-white">{instance.config.username}</span>
                        </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Balance: <span className="font-medium text-gray-900 dark:text-white">${instance.lastBalance ?? 0}</span>
                        <button
                            type="button"
                            onClick={fetchBalanceFromServer}
                            disabled={isLoadingBalance}
                            className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                            aria-label="Update balance from server"
                        >
                            {isLoadingBalance ? 'Updating…' : 'Update'}
                        </button>
                    </p>
                    {balanceError && (
                        <p className="text-xs text-red-600 dark:text-red-400">{balanceError}</p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Status: <span className={`font-medium ${isRunning ? 'text-green-600' : 'text-red-600'}`}>{instance.status}</span>
                    </p>
                    {showFilterSummary && (
                        <p className="text-xs text-gray-500 dark:text-gray-400" title={filterSummary!}>
                            Filters: <span className="font-medium text-gray-700 dark:text-gray-300">{filterSummary}</span>
                        </p>
                    )}
                </div>
                {/* Recent logs (2–3) */}
                <div className="mt-3 min-h-[4.5rem] rounded border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-600 dark:bg-gray-700/50">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Recent logs</p>
                    {recentLogs.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">—</p>
                    ) : (
                        <ul className="space-y-0.5 overflow-hidden">
                            {recentLogs.map((log, i) => (
                                <li key={i} className="text-xs text-gray-700 dark:text-gray-300 truncate" title={log.message}>
                                    [{log.level}] {log.message}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                    <button
                        onClick={toggleStatus}
                        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${isRunning
                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                            : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                            }`}
                    >
                        {isRunning ? 'Stop' : 'Start'}
                    </button>
                    <button
                        onClick={onEdit}
                        disabled={isRunning}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                        Edit
                    </button>
                    <button
                        onClick={deleteInstance}
                        disabled={isRunning}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                        Delete
                    </button>
                    <Link
                        href={`/dashboard/instance/${instance._id}`}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                        aria-label={`Open ${instance.name} details`}
                    >
                        Details
                    </Link>
                </div>
            </div>
        </div>
    );
}
