'use client';

import { useEffect, useState } from 'react';

export default function AdminInstancesPage() {
    const [instances, setInstances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInstances();
    }, []);

    const fetchInstances = async () => {
        try {
            const res = await fetch('/api/admin/bot-instances');
            if (res.ok) {
                const data = await res.json();
                setInstances(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center">Loading platform instances...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Global Instance Monitoring</h1>

            <div className="overflow-x-auto rounded-lg bg-white shadow dark:bg-gray-800">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-750">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Instance Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Owner</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Template</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                        {instances.map((instance) => (
                            <tr key={instance._id}>
                                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{instance.name}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                    {instance.userId?.name} <span className="text-xs">({instance.userId?.email})</span>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                    {instance.botId?.name}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm">
                                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${instance.status === 'RUNNING' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {instance.status}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500 dark:text-gray-400">
                                    {new Date(instance.createdAt).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {instances.length === 0 && (
                            <tr><td colSpan={5} className="py-10 text-center text-gray-500">No instances found on the platform.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

