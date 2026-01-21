'use client';

import { useEffect, useState } from 'react';

export default function AdminOverview() {
    const [stats, setStats] = useState({
        users: 0,
        bots: 0,
        instances: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            // We'll use the existing or new APIs to aggregate stats
            const [u, b, i] = await Promise.all([
                fetch('/api/admin/users').then(r => r.json()),
                fetch('/api/bots').then(r => r.json()),
                fetch('/api/admin/bot-instances').then(r => r.json()),
            ]);
            setStats({
                users: Array.isArray(u) ? u.length : 0,
                bots: Array.isArray(b) ? b.length : 0,
                instances: Array.isArray(i) ? i.length : 0,
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

            <div className="grid gap-6 sm:grid-cols-3">
                <StatCard title="Total Users" value={stats.users} loading={loading} color="bg-blue-500" />
                <StatCard title="Bot Templates" value={stats.bots} loading={loading} color="bg-purple-500" />
                <StatCard title="Total Instances" value={stats.instances} loading={loading} color="bg-green-500" />
            </div>

            <div className="mt-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
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
