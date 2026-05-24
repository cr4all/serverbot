'use client';

import { useCallback, useEffect, useState } from 'react';
import RealTimeMonitor from '@/components/RealTimeMonitor';
import InstancePerformance from '@/components/InstancePerformance';
import InstanceStatsStrip from '@/components/InstanceStatsStrip';

const STATUS_OPTIONS = ['', 'RUNNING', 'STOPPED', 'STARTING', 'STOPPING', 'ERROR'] as const;

type DetailTab = 'monitor' | 'performance';

const PAGE_SIZES = [10, 25, 50] as const;

export default function AdminInstancesPage() {
    const [instances, setInstances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any | null>(null);
    const [bets, setBets] = useState<any[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [runningCount, setRunningCount] = useState(0);
    const [configEditMode, setConfigEditMode] = useState(false);
    const [configEditValue, setConfigEditValue] = useState('');
    const [configSaving, setConfigSaving] = useState(false);
    const [detailTab, setDetailTab] = useState<DetailTab>('monitor');
    const [botTemplates, setBotTemplates] = useState<{ _id: string; name: string }[]>([]);

    const [filters, setFilters] = useState({
        name: '',
        instanceId: '',
        owner: '',
        template: '',
        status: '',
        licenseKey: '',
        createdFrom: '',
        createdTo: '',
    });

    const fetchInstances = useCallback(async (opts?: { overrideFilters?: typeof filters; overridePage?: number; overrideLimit?: number }) => {
        setLoading(true);
        const f = opts?.overrideFilters ?? filters;
        const p = opts?.overridePage ?? page;
        const l = opts?.overrideLimit ?? limit;
        try {
            const params = new URLSearchParams();
            if (f.name) params.set('name', f.name);
            if (f.instanceId) params.set('instanceId', f.instanceId);
            if (f.owner) params.set('owner', f.owner);
            if (f.template) params.set('template', f.template);
            if (f.status) params.set('status', f.status);
            if (f.licenseKey) params.set('licenseKey', f.licenseKey);
            if (f.createdFrom) params.set('createdFrom', f.createdFrom);
            if (f.createdTo) params.set('createdTo', f.createdTo);
            params.set('page', String(p));
            params.set('limit', String(l));
            const res = await fetch(`/api/admin/bot-instances?${params}`);
            if (res.ok) {
                const data = await res.json();
                setInstances(data.instances ?? []);
                setTotal(data.pagination?.total ?? 0);
                setTotalPages(data.pagination?.totalPages ?? 0);
                setRunningCount(data.stats?.running ?? 0);
                setPage(p);
                setLimit(l);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchInstances({ overridePage: 1 });
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/bots');
                if (!res.ok || cancelled) return;
                const data = await res.json();
                if (!Array.isArray(data) || cancelled) return;
                const sorted = [...data]
                    .map((b: { _id: string; name: string }) => ({ _id: String(b._id), name: b.name || String(b._id) }))
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
                setBotTemplates(sorted);
            } catch (e) {
                console.error(e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleFilterChange = (key: string, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const applyFilters = () => {
        fetchInstances({ overrideFilters: filters, overridePage: 1 });
    };

    const clearFilters = () => {
        const empty = {
            name: '',
            instanceId: '',
            owner: '',
            template: '',
            status: '',
            licenseKey: '',
            createdFrom: '',
            createdTo: '',
        };
        setFilters(empty);
        fetchInstances({ overrideFilters: empty, overridePage: 1 });
    };

    const goToPage = (p: number) => {
        if (p >= 1 && p <= totalPages) {
            fetchInstances({ overridePage: p });
        }
    };

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
        fetchInstances({ overridePage: 1, overrideLimit: newLimit });
    };

    const toggleStatus = async (instance: any) => {
        const id = instance._id;
        const isRunning = instance.status === 'RUNNING';
        const newStatus = isRunning ? 'STOPPED' : 'RUNNING';
        if (instance.status === 'STARTING' || instance.status === 'STOPPING') return;
        setTogglingId(id);
        try {
            const res = await fetch(`/api/bot-instances/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                fetchInstances();
                if (selected?._id === id) {
                    viewInstance(id);
                }
            } else {
                const err = await res.json();
                alert(err?.error || 'Failed to update instance');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to update instance');
        } finally {
            setTogglingId(null);
        }
    };

    const viewInstance = async (id: string) => {
        setConfigEditMode(false);
        setConfigEditValue('');
        setDetailTab('monitor');
        setDetailLoading(true);
        try {
            const [resInst, resBets] = await Promise.all([
                fetch(`/api/bot-instances/${id}`),
                fetch(`/api/bet-history/${id}?limit=100`),
            ]);

            if (resInst.ok) {
                const inst = await resInst.json();
                setSelected(inst);
            } else {
                const err = await resInst.json();
                alert(err?.error || 'Failed to fetch instance');
            }

            if (resBets.ok) {
                const bh = await resBets.json();
                setBets(bh);
            } else {
                setBets([]);
            }
        } catch (e) {
            console.error(e);
            setSelected(null);
            setBets([]);
        } finally {
            setDetailLoading(false);
        }
    };

    const startEditConfig = () => {
        setConfigEditValue(JSON.stringify(selected?.config ?? {}, null, 2));
        setConfigEditMode(true);
    };

    const cancelEditConfig = () => {
        setConfigEditMode(false);
        setConfigEditValue('');
    };

    const saveConfig = async () => {
        if (!selected?._id) return;
        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(configEditValue);
        } catch {
            alert('Invalid JSON. Please fix the syntax and try again.');
            return;
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            alert('Config must be a JSON object.');
            return;
        }
        setConfigSaving(true);
        try {
            const res = await fetch(`/api/bot-instances/${selected._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: parsed }),
            });
            if (res.ok) {
                const updated = await res.json();
                setSelected(updated);
                setConfigEditMode(false);
                setConfigEditValue('');
            } else {
                const err = await res.json();
                alert(err?.error || 'Failed to update config');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to update config');
        } finally {
            setConfigSaving(false);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'RUNNING': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'STOPPED': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
            case 'STARTING': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
            case 'STOPPING': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
            case 'ERROR': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[200px] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading instances…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instance Monitoring</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage and monitor all bot instances across the platform</p>
                </div>
                <div className="flex gap-3 text-sm">
                    <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-800">
                        <span className="text-gray-500 dark:text-gray-400">Total</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{total}</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800 dark:bg-emerald-900/20">
                        <span className="text-emerald-600 dark:text-emerald-400">Running</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">{runningCount}</span>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex items-center gap-2">
                    <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Instance Name</label>
                        <input
                            type="text"
                            placeholder="Search…"
                            value={filters.name}
                            onChange={(e) => handleFilterChange('name', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Instance ID</label>
                        <input
                            type="text"
                            placeholder="Partial match on ID…"
                            value={filters.instanceId}
                            onChange={(e) => handleFilterChange('instanceId', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Owner</label>
                        <input
                            type="text"
                            placeholder="Name or email…"
                            value={filters.owner}
                            onChange={(e) => handleFilterChange('owner', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Bot Template</label>
                        <select
                            value={filters.template}
                            onChange={(e) => handleFilterChange('template', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        >
                            <option value="">All</option>
                            {botTemplates.map((b) => (
                                <option key={b._id} value={b._id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        >
                            <option value="">All</option>
                            {STATUS_OPTIONS.filter(Boolean).map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">License Key</label>
                        <input
                            type="text"
                            placeholder="Search by license…"
                            value={filters.licenseKey}
                            onChange={(e) => handleFilterChange('licenseKey', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Created From</label>
                        <input
                            type="date"
                            value={filters.createdFrom}
                            onChange={(e) => handleFilterChange('createdFrom', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Created To</label>
                        <input
                            type="date"
                            value={filters.createdTo}
                            onChange={(e) => handleFilterChange('createdTo', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                    </div>
                </div>
                <div className="mt-4 flex gap-2">
                    <button
                        onClick={applyFilters}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    >
                        Apply Filters
                    </button>
                    <button
                        onClick={clearFilters}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-gray-500 dark:focus:ring-offset-gray-800"
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {total === 0 ? 'No instances' : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}
                    </span>
                    <select
                        value={limit}
                        onChange={(e) => handleLimitChange(Number(e.target.value))}
                        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                        {PAGE_SIZES.map((s) => (
                            <option key={s} value={s}>{s} per page</option>
                        ))}
                    </select>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => goToPage(1)}
                            disabled={page <= 1}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                            aria-label="First page"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                        </button>
                        <button
                            onClick={() => goToPage(page - 1)}
                            disabled={page <= 1}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                            aria-label="Previous page"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="min-w-[80px] px-3 py-1 text-center text-sm text-gray-600 dark:text-gray-400">
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => goToPage(page + 1)}
                            disabled={page >= totalPages}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                            aria-label="Next page"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <button
                            onClick={() => goToPage(totalPages)}
                            disabled={page >= totalPages}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                            aria-label="Last page"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Instance Name</th>
                            <th className="w-48 min-w-[18rem] max-w-[20rem] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Owner</th>
                            <th className="w-40 min-w-[18rem] max-w-[20rem] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Template</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                        {instances.map((instance) => (
                            <tr key={instance._id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="whitespace-nowrap px-6 py-4 text-sm">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-medium text-gray-900 dark:text-white">{instance.name}</span>
                                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400" title={instance._id}>{instance._id}</span>
                                    </div>
                                </td>
                                <td className="max-w-[20rem] truncate px-6 py-4 text-sm text-gray-500 dark:text-gray-400" title={`${instance.userId?.name || ''} (${instance.userId?.email || ''})`}>
                                    {instance.userId?.name} <span className="text-xs">({instance.userId?.email})</span>
                                </td>
                                <td className="max-w-[20rem] truncate px-6 py-4 text-sm text-gray-500 dark:text-gray-400" title={instance.botId?.name}>
                                    {instance.botId?.name}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm">
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusStyles(instance.status)}`}>
                                        {instance.status}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500 dark:text-gray-400">
                                    {new Date(instance.createdAt).toLocaleDateString()}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                    <div className="flex items-center justify-end gap-2">
                                        {instance.status === 'RUNNING' ? (
                                            <button
                                                onClick={() => toggleStatus(instance)}
                                                disabled={togglingId === instance._id}
                                                className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                                            >
                                                {togglingId === instance._id ? 'Stopping…' : 'Stop'}
                                            </button>
                                        ) : instance.status === 'STOPPED' || instance.status === 'ERROR' ? (
                                            <button
                                                onClick={() => toggleStatus(instance)}
                                                disabled={togglingId === instance._id}
                                                className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-900/20"
                                            >
                                                {togglingId === instance._id ? 'Starting…' : 'Start'}
                                            </button>
                                        ) : null}
                                        <button
                                            onClick={() => viewInstance(instance._id)}
                                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                        >
                                            View
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {instances.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <svg className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                        </svg>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No instances found</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">Try adjusting your filters or create new instances</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {selected && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                        <div className="space-y-1">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selected.name}</h2>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-gray-500 dark:text-gray-400">
                                <span>Owner: {selected.userId?.name}</span>
                                <span>Template: {selected.botId?.name}</span>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusStyles(selected.status)}`}>{selected.status}</span>
                            </div>
                            <p className="font-mono text-xs text-gray-400 dark:text-gray-500">{selected._id}</p>
                        </div>
                        <button
                            onClick={() => {
                                setSelected(null);
                                setBets([]);
                                setConfigEditMode(false);
                                setConfigEditValue('');
                                setDetailTab('monitor');
                            }}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        >
                            Close
                        </button>
                    </div>
                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            Last month snapshot
                        </p>
                        <InstanceStatsStrip botInstanceId={selected._id} />
                    </div>
                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                        <div
                            className="inline-flex w-full max-w-md rounded-xl border border-gray-200 bg-gray-100/80 p-1 dark:border-gray-700 dark:bg-gray-900/60 sm:w-auto"
                            role="tablist"
                            aria-label="Instance views"
                        >
                            {([
                                { id: 'monitor' as const, label: 'Live monitor', description: 'Logs, bets & tips' },
                                { id: 'performance' as const, label: 'Performance', description: 'PnL & analytics' },
                            ]).map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={detailTab === t.id}
                                    onClick={() => setDetailTab(t.id)}
                                    className={`flex flex-1 flex-col rounded-lg px-4 py-2.5 text-left transition sm:flex-none sm:min-w-[8.5rem] ${
                                        detailTab === t.id
                                            ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
                                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <span className="text-sm font-semibold">{t.label}</span>
                                    <span
                                        className={`mt-0.5 text-[10px] ${
                                            detailTab === t.id
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
                    <div className="p-6">
                        {detailLoading ? (
                            <div className="flex min-h-[120px] items-center justify-center">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                            </div>
                        ) : detailTab === 'monitor' ? (
                            <>
                                <div className="mb-6">
                                    <RealTimeMonitor instanceId={selected._id} />
                                </div>
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Config</h3>
                                        {configEditMode ? (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={saveConfig}
                                                    disabled={configSaving}
                                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                                                >
                                                    {configSaving ? 'Saving…' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={cancelEditConfig}
                                                    disabled={configSaving}
                                                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={startEditConfig}
                                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                            >
                                                Edit Config
                                            </button>
                                        )}
                                    </div>
                                    {configEditMode ? (
                                        <textarea
                                            value={configEditValue}
                                            onChange={(e) => setConfigEditValue(e.target.value)}
                                            className="max-h-60 min-h-[200px] w-full resize-y rounded-lg border border-gray-300 bg-white p-4 font-mono text-xs text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                                            spellCheck={false}
                                            placeholder="{}"
                                        />
                                    ) : (
                                        <pre className="max-h-60 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">{JSON.stringify(selected.config || {}, null, 2)}</pre>
                                    )}
                                </div>
                            </>
                        ) : (
                            <InstancePerformance instanceId={selected._id} embedded />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

