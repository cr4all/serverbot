'use client';

import { useState, useEffect } from 'react';
import { IBotInstance } from '@/types';

interface CreateBotDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: IBotInstance | null;
}

export default function CreateBotDialog({ isOpen, onClose, onSuccess, initialData }: CreateBotDialogProps) {
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        botId: '',
        name: '',
        config: {
            username: '',
            password: '',
            domain: '',
            licenseKey: '',
            stake: '',
            balance: '',
        },
    });

    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
            if (initialData) {
                // Populate form for editing
                setFormData({
                    botId: (initialData.botId as any)?._id || (initialData.botId as string),
                    name: initialData.name,
                    config: {
                        username: initialData.config?.username || '',
                        password: initialData.config?.password || '',
                        domain: initialData.config?.domain || '',
                        licenseKey: initialData.config?.licenseKey || '',
                        stake: initialData.config?.stake || '',
                        balance: initialData.config?.balance || '', // Added balance
                        ...initialData.config, // preserve other keys if any
                    }
                });
            } else {
                // Reset for creation
                setFormData({
                    botId: '',
                    name: '',
                    config: {
                        username: '',
                        password: '',
                        domain: '',
                        licenseKey: '',
                        stake: '',
                        balance: '',
                    },
                });
            }
        }
    }, [isOpen, initialData]);

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/bots');
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
                // Set default template only if creating new and none selected
                if (data.length > 0 && !formData.botId && !initialData) {
                    setFormData((prev) => ({ ...prev, botId: data[0]._id }));
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name in formData.config) {
            setFormData((prev) => ({
                ...prev,
                config: { ...prev.config, [name]: value },
            }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let botIdToUse = formData.botId;

            // If creating and no template selected (and none exist), create dummy (Admin logic typically)
            if (!botIdToUse && !initialData) {
                const newBot = await fetch('/api/bots', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: 'Standard Trading Bot',
                        type: 'TRADING',
                        version: '1.0.0',
                        description: 'A standard trading bot template'
                    })
                });
                const botData = await newBot.json();
                botIdToUse = botData._id;
            }

            const url = initialData
                ? `/api/bot-instances/${initialData._id}`
                : '/api/bot-instances';

            const method = initialData ? 'PATCH' : 'POST';

            const body: any = {
                name: formData.name,
                config: formData.config,
            };

            if (!initialData) {
                body.botId = botIdToUse;
                body.status = 'STOPPED';
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert(`Failed to ${initialData ? 'update' : 'create'} bot instance`);
            }
        } catch (e) {
            console.error(e);
            alert('Error creating/updating bot');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
                <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                    {initialData ? 'Edit Bot Configuration' : 'Create New Bot'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bot Template</label>
                        <select
                            name="botId"
                            value={formData.botId}
                            onChange={handleChange}
                            disabled={!!initialData} // Disable template change when editing
                            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
                        >
                            {templates.length === 0 && <option value="">Loading...</option>}
                            {templates.map((t) => (
                                <option key={t._id} value={t._id}>
                                    {t.name} ({t.type})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Instance Name</label>
                        <input
                            type="text"
                            name="name"
                            required
                            placeholder="My Cool Bot"
                            value={formData.name}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-200">Configuration</h3>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Balance (Starting)</label>
                                <input
                                    type="number"
                                    name="balance"
                                    placeholder="e.g. 1000"
                                    value={formData.config.balance}
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Domain</label>
                                <input
                                    type="text"
                                    name="domain"
                                    required
                                    placeholder="example.com"
                                    value={formData.config.domain}
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    required
                                    value={formData.config.username}
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    value={formData.config.password}
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">License Key</label>
                                <input
                                    type="text"
                                    name="licenseKey"
                                    required
                                    value={formData.config.licenseKey}
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Stake Parameters</label>
                                <input
                                    type="text"
                                    name="stake"
                                    placeholder="e.g., 0.5, Low, High"
                                    value={formData.config.stake}
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : (initialData ? 'Update Bot' : 'Create Bot')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
