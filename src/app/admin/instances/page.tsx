'use client';

import { useEffect, useState } from 'react';
import RealTimeMonitor from '@/components/RealTimeMonitor';

export default function AdminInstancesPage() {
    const [instances, setInstances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any | null>(null);
    const [bets, setBets] = useState<any[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

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

    const viewInstance = async (id: string) => {
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
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
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
                                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                    <button
                                        onClick={() => viewInstance(instance._id)}
                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {instances.length === 0 && (
                            <tr><td colSpan={5} className="py-10 text-center text-gray-500">No instances found on the platform.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {selected && (
                <div className="mt-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Instance: {selected.name}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Owner: {selected.userId?.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">InstanceId: {selected._id}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Template: {selected.botId?.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Status: {selected.status}</p>
                        </div>
                        <div>
                            <button onClick={() => { setSelected(null); setBets([]); }} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-300">Close</button>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="mb-4">
                            <RealTimeMonitor instanceId={selected._id} />
                        </div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Config</h3>
                        <pre className="mt-2 max-h-60 overflow-auto rounded bg-gray-100 p-3 text-sm text-gray-900 dark:bg-gray-900 dark:text-gray-100">{JSON.stringify(selected.config || {}, null, 2)}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}

