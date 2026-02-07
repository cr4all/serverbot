'use client';

import { useEffect, useState } from 'react';

export default function AdminBotsPage() {
    const [bots, setBots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBotId, setEditingBotId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', type: '', description: '', version: '1.0.0', isDefault: false });

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
            let res;
            if (editingBotId) {
                res = await fetch(`/api/bots/${editingBotId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });
            } else {
                res = await fetch('/api/bots', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });
            }

            if (res.ok) {
                setIsFormOpen(false);
                setEditingBotId(null);
                setFormData({ name: '', type: '', description: '', version: '1.0.0', isDefault: false });
                fetchBots();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const openEdit = (bot: any) => {
        setFormData({
            name: bot.name || '',
            type: bot.type || '',
            description: bot.description || '',
            version: bot.version || '1.0.0',
            isDefault: !!bot.isDefault,
        });
        setEditingBotId(bot._id);
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) return <div className="text-center">Loading templates...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bot Templates</h1>
                <button
                    onClick={() => {
                        if (isFormOpen) {
                            setIsFormOpen(false);
                            setEditingBotId(null);
                            setFormData({ name: '', type: '', description: '', version: '1.0.0', isDefault: false });
                        } else {
                            setIsFormOpen(true);
                        }
                    }}
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

                        <div className="sm:col-span-2 flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                    className="h-4 w-4 rounded border-gray-300 dark:bg-gray-700"
                                />
                                <span>Assign this template to new users by default</span>
                            </label>
                        </div>

                        <button type="submit" className="w-full rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 sm:col-span-2">
                            {editingBotId ? 'Save Changes' : 'Create Template'}
                        </button>
                    </form>
                </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {bots.map((bot) => (
                    <div key={bot._id} className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">{bot.name}</h3>
                                {bot.isDefault && (
                                    <div className="mt-1 inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Default</div>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-mono text-gray-500">{bot.version}</div>
                                <div className="mt-2">
                                    <button
                                        onClick={() => openEdit(bot)}
                                        className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
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
