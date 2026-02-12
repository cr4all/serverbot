'use client';

import { useEffect, useState } from 'react';

type ProxyStatus = {
    total: number;
    invalidCount: number;
    invalidList: string[];
    byRegion: Record<string, number>;
};

export default function AdminOverview() {
    const [stats, setStats] = useState({
        users: 0,
        bots: 0,
        instances: 0,
    });
    const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [proxyLoading, setProxyLoading] = useState(true);
    const [proxyError, setProxyError] = useState(false);
    const [showInvalidList, setShowInvalidList] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchProxyStatus();
    }, []);

    const fetchStats = async () => {
        try {
            const [u, b, i] = await Promise.all([
                fetch('/api/admin/users').then(r => r.json()),
                fetch('/api/bots').then(r => r.json()),
                fetch('/api/admin/bot-instances').then(r => r.json()),
            ]);
            setStats({
                users: Array.isArray(u) ? u.length : 0,
                bots: Array.isArray(b) ? b.length : 0,
                instances: i?.pagination?.total ?? (Array.isArray(i) ? i.length : 0),
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchProxyStatus = async () => {
        setProxyError(false);
        setProxyLoading(true);
        try {
            const res = await fetch('/api/admin/proxies/status');
            if (res.ok) {
                const data = await res.json();
                setProxyStatus(data);
            } else {
                setProxyError(true);
            }
        } catch (e) {
            console.error(e);
            setProxyError(true);
        } finally {
            setProxyLoading(false);
        }
    };

    const validCount = proxyStatus ? proxyStatus.total - proxyStatus.invalidCount : 0;
    const proxyHealthy = proxyStatus && proxyStatus.invalidCount === 0;
    const regionEntries = proxyStatus?.byRegion
        ? Object.entries(proxyStatus.byRegion).sort((a, b) => b[1] - a[1])
        : [];
    const maxRegionCount = regionEntries[0]?.[1] ?? 1;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Overview</h1>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Users" value={stats.users} loading={loading} color="bg-blue-500" />
                <StatCard title="Bot Templates" value={stats.bots} loading={loading} color="bg-purple-500" />
                <StatCard title="Total Instances" value={stats.instances} loading={loading} color="bg-green-500" />
                <StatCard
                    title="Proxies"
                    value={proxyLoading ? '…' : proxyStatus?.total ?? '—'}
                    loading={false}
                    color={proxyHealthy ? 'bg-emerald-500' : proxyStatus ? 'bg-amber-500' : 'bg-slate-500'}
                />
            </div>

            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Proxy Status</h2>
                    <div className="flex items-center gap-3">
                        {proxyStatus && (
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    proxyHealthy
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                }`}
                            >
                                <span className={`h-1.5 w-1.5 rounded-full ${proxyHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {proxyHealthy ? 'All healthy' : 'Degraded'}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={fetchProxyStatus}
                            disabled={proxyLoading}
                            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            {proxyLoading ? 'Refreshing…' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {proxyLoading && !proxyStatus ? (
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-16 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                            ))}
                        </div>
                        <div className="h-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                    </div>
                ) : proxyError ? (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 py-8 dark:border-red-900/50 dark:bg-red-900/10">
                        <p className="text-sm text-red-600 dark:text-red-400">Failed to load proxy status</p>
                        <button
                            type="button"
                            onClick={fetchProxyStatus}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                            Retry
                        </button>
                    </div>
                ) : proxyStatus ? (
                    <div className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/50">
                                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</span>
                                <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{proxyStatus.total}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/20">
                                <span className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Valid</span>
                                <p className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{validCount}</p>
                            </div>
                            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                                <span className="text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">Invalid</span>
                                <p className="mt-1 text-2xl font-semibold text-red-700 dark:text-red-300">{proxyStatus.invalidCount}</p>
                            </div>
                        </div>

                        {regionEntries.length > 0 && (
                            <div>
                                <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">By region</h3>
                                <div className="space-y-2">
                                    {regionEntries.map(([region, count]) => (
                                        <div key={region} className="flex items-center gap-3">
                                            <span className="w-12 text-sm font-medium text-gray-600 dark:text-gray-400">{region}</span>
                                            <div className="flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                                <div
                                                    className="h-2 rounded-full bg-blue-500 dark:bg-blue-600"
                                                    style={{ width: `${(count / maxRegionCount) * 100}%` }}
                                                />
                                            </div>
                                            <span className="w-8 text-right text-sm font-medium text-gray-900 dark:text-white">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {proxyStatus.invalidList.length > 0 && (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowInvalidList((v) => !v)}
                                    className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                    Invalid proxies ({proxyStatus.invalidList.length})
                                    <span className="text-gray-400">{showInvalidList ? '▼' : '▶'}</span>
                                </button>
                                {showInvalidList && (
                                    <ul className="mt-2 space-y-1 rounded-md border border-red-200 bg-red-50/50 px-4 py-2 font-mono text-sm text-gray-700 dark:border-red-900/50 dark:bg-red-900/10 dark:text-gray-300">
                                        {proxyStatus.invalidList.map((proxy) => (
                                            <li key={proxy}>{proxy}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Welcome, Admin</h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Use the navigation menu to manage users, bot templates, and observe platform activity.
                </p>
            </div>
        </div>
    );
}

function StatCard({ title, value, loading, color }: any) {
    return (
        <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="p-5">
                <div className="flex items-center">
                    <div className={`flex-shrink-0 rounded-md p-3 ${color}`}>
                        {/* Placeholder Icon */}
                        <div className="h-6 w-6 text-white">📊</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                        <dl>
                            <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">{title}</dt>
                            <dd>
                                <div className="text-lg font-medium text-gray-900 dark:text-white">
                                    {loading ? '...' : value}
                                </div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );
}
