'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { use } from 'react';
import Link from 'next/link';
import RealTimeMonitor from '@/components/RealTimeMonitor';
import InstancePerformance from '@/components/InstancePerformance';
import InstanceStatsStrip from '@/components/InstanceStatsStrip';
import { IBotInstance } from '@/types';

type MonitorTab = 'monitor' | 'performance';

function ChevronLeftIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
                fillRule="evenodd"
                d="M11.78 5.22a.75.75 0 010 1.06L8.06 10l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z"
                clipRule="evenodd"
            />
        </svg>
    );
}

export default function InstanceMonitorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    const { data: session, status } = useSession();
    const router = useRouter();
    const [instance, setInstance] = useState<IBotInstance | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<MonitorTab>('monitor');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchInstance();
        }
    }, [status, id]);

    const fetchInstance = async () => {
        try {
            const res = await fetch(`/api/bot-instances/${id}`);
            if (res.ok) {
                const data = await res.json();
                setInstance(data);
            } else {
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Failed to fetch instance', error);
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading' || loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading instance…</p>
                </div>
            </div>
        );
    }
    if (!session || !instance) return null;

    const isRunning = instance.status === 'RUNNING';
    const botTemplateName = (instance.botId as { name?: string })?.name ?? 'Unknown';
    const balance =
        instance.config?.balance ?? instance.lastBalance ?? null;

    const tabs: { id: MonitorTab; label: string; description: string }[] = [
        { id: 'monitor', label: 'Live monitor', description: 'Logs, bets & tips' },
        { id: 'performance', label: 'Performance', description: 'PnL & analytics' },
    ];

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
                <ChevronLeftIcon className="h-4 w-4" />
                Back to dashboard
            </Link>

            <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700/80 dark:bg-gray-800/90">
                <div className="border-b border-gray-100 px-5 py-5 sm:px-6 dark:border-gray-700/80">
                    <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                                <span
                                    className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ${
                                        isRunning
                                            ? 'bg-emerald-500 ring-emerald-500/20'
                                            : 'bg-red-500 ring-red-500/20'
                                    }`}
                                    aria-hidden
                                />
                                <h1 className="truncate text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                                    {instance.name}
                                </h1>
                                <span
                                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                                        isRunning
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700/80 dark:text-gray-300'
                                    }`}
                                >
                                    {instance.status}
                                </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center rounded-lg bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                                    <span className="text-gray-400 dark:text-gray-500">Template · </span>
                                    <span className="ml-0.5 font-medium text-gray-800 dark:text-gray-200">
                                        {botTemplateName}
                                    </span>
                                </span>
                                {instance.config?.username && (
                                    <span className="inline-flex items-center rounded-lg bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                                        <span className="text-gray-400 dark:text-gray-500">User · </span>
                                        <span className="ml-0.5 font-medium text-gray-800 dark:text-gray-200">
                                            {instance.config.username}
                                        </span>
                                    </span>
                                )}
                                {balance != null && (
                                    <span className="inline-flex items-center rounded-lg bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                                        <span className="text-gray-400 dark:text-gray-500">Balance · </span>
                                        <span className="ml-0.5 font-medium tabular-nums text-gray-800 dark:text-gray-200">
                                            ${balance}
                                        </span>
                                    </span>
                                )}
                                <span className="inline-flex items-center rounded-lg bg-gray-50 px-2.5 py-1 font-mono text-[10px] text-gray-400 dark:bg-gray-900/50 dark:text-gray-500">
                                    {id.slice(-8)}
                                </span>
                            </div>
                    </div>
                </div>

                <div className="px-5 py-4 sm:px-6">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Last month snapshot
                    </p>
                    <InstanceStatsStrip botInstanceId={id} />
                </div>
            </section>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div
                    className="inline-flex w-full max-w-md rounded-xl border border-gray-200 bg-gray-100/80 p-1 dark:border-gray-700 dark:bg-gray-900/60 sm:w-auto"
                    role="tablist"
                    aria-label="Instance views"
                >
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex flex-1 flex-col rounded-lg px-4 py-2.5 text-left transition sm:flex-none sm:min-w-[8.5rem] ${
                                tab === t.id
                                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            <span className="text-sm font-semibold">{t.label}</span>
                            <span
                                className={`mt-0.5 text-[10px] ${
                                    tab === t.id
                                        ? 'text-gray-500 dark:text-gray-400'
                                        : 'text-gray-400 dark:text-gray-500'
                                }`}
                            >
                                {t.description}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div
                className={
                    tab === 'performance'
                        ? 'overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700/80 dark:bg-gray-800/90'
                        : ''
                }
            >
                {tab === 'monitor' ? (
                    <RealTimeMonitor instanceId={id} isInstanceRunning={isRunning} />
                ) : (
                    <div className="p-5 sm:p-6">
                        <InstancePerformance instanceId={id} embedded />
                    </div>
                )}
            </div>
        </div>
    );
}
