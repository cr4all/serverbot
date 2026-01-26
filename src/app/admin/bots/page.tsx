'use client';

import { useEffect, useState } from 'react';

export default function AdminBotsPage() {
    const [bots, setBots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', type: '', description: '', version: '1.0.0' });

    useEffect(() => {
        fetchBots();
    }, []);

    const fetchBots = async () => {
        try {
            const res = await fetch('/api/bots');
            if (res.ok) {
                const data = await res.json();
                setBots(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/bots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                setIsFormOpen(false);
                setFormData({ name: '', type: '', description: '', version: '1.0.0' });
                fetchBots();
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return <div className="text-center">Loading templates...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bot Templates</h1>
                <button
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                    {isFormOpen ? 'Cancel' : 'Add Template'}
                </button>
            </div>

            {isFormOpen && (
                <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Name</label>
                            <input
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="mt-1 block w-full rounded-md border p-2 dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Type</label>
                            <input
                                required
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="mt-1 block w-full rounded-md border p-2 dark:bg-gray-700"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="mt-1 block w-full rounded-md border p-2 dark:bg-gray-700"
                            />
                        </div>
                        <button type="submit" className="w-full rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 sm:col-span-2">
                            Create Template
                        </button>
                    </form>
                </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {bots.map((bot) => (
                    <div key={bot._id} className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 dark:text-white">{bot.name}</h3>
                            <span className="text-xs font-mono text-gray-500">{bot.version}</span>
                        </div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{bot.description}</p>
                        <div className="mt-4 flex items-center justify-between">
                            <span className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">{bot.type}</span>
                            <span className="text-xs text-gray-400">ID: {bot._id.slice(-6)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
