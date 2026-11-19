'use client';

import { useEffect, useState } from 'react';

export default function AdminOverview() {
    const [stats, setStats] = useState({
        users: 0,
        instances: 0,
        vps: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const [u, i, v] = await Promise.all([
                fetch('/api/admin/users?limit=1').then((r) => r.json()),
                fetch('/api/admin/bot-instances?limit=1').then((r) => r.json()),
                fetch('/api/admin/vps-nodes').then((r) => r.json()),
            ]);
            setStats({
                users: u?.pagination?.total ?? (Array.isArray(u?.users) ? u.users.length : 0),
                instances: i?.pagination?.total ?? (Array.isArray(i) ? i.length : 0),
                vps: Array.isArray(v?.nodes) ? v.nodes.length : 0,
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Overview</h1>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Total Users" value={stats.users} loading={loading} color="bg-blue-500" />
                                <StatCard title="Surebet bots" value={stats.instances} loading={loading} color="bg-green-500" />
                <StatCard title="VPS Nodes" value={stats.vps} loading={loading} color="bg-indigo-500" />
            </div>

            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Welcome, Admin</h2>
                <p className="text-gray-600 dark:text-gray-400">
                    Manage users, VPS agents, and running bot instances from the navigation menu.
                </p>
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    loading,
    color,
}: {
    title: string;
    value: number | string;
    loading: boolean;
    color: string;
}) {
    return (
        <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="p-5">
                <div className="flex items-center">
                    <div className={`flex-shrink-0 rounded-md p-3 ${color}`}>
                        <div className="h-6 w-6 text-white opacity-90" aria-hidden />
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
