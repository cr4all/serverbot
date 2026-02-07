"use client";

import { useEffect, useState } from 'react';

type Props = {
    userId: string;
    onClose: () => void;
    onSaved?: () => void;
};

export default function AssignBotsToUserDialog({ userId, onClose, onSaved }: Props) {
    const [bots, setBots] = useState<any[]>([]);
    const [assignedIds, setAssignedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [botsRes, assignsRes] = await Promise.all([
                fetch('/api/bots'), // admin will get all
                fetch(`/api/admin/bot-assignments?userId=${userId}`),
            ]);

            const [botsData, assignsData] = await Promise.all([botsRes.json(), assignsRes.json()]);

            setBots(botsData || []);
            const ids = (assignsData || []).map((a: any) => String(a.botId._id || a.botId));
            setAssignedIds(ids);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggle = async (botId: string, currentlyAssigned: boolean) => {
        try {
            if (currentlyAssigned) {
                const res = await fetch('/api/admin/bot-assignments', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ botId, userId }),
                });
                if (res.ok) {
                    setAssignedIds((s) => s.filter((id) => id !== botId));
                } else {
                    console.error('Failed to unassign');
                }
            } else {
                const res = await fetch('/api/admin/bot-assignments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ botId, userId }),
                });
                if (res.ok) {
                    setAssignedIds((s) => [...s, botId]);
                } else {
                    console.error('Failed to assign');
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleAll = async () => {
        if (bots.length === 0) return;
        setLoading(true);
        try {
            const allIds = bots.map((b) => String(b._id));
            const allAssigned = assignedIds.length === bots.length;

            if (allAssigned) {
                // Unassign all in single request
                await fetch('/api/admin/bot-assignments', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ botIds: allIds, userId }),
                });
            } else {
                // Assign all in single request
                await fetch('/api/admin/bot-assignments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ botIds: allIds, userId }),
                });
            }

            // Refresh assignments to ensure consistency
            await fetchData();
        } catch (e) {
            console.error(e);
            await fetchData();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assign Templates to User</h3>
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-700 dark:text-gray-300">{assignedIds.length} of {bots.length} selected</div>
                        <button
                            type="button"
                            onClick={handleToggleAll}
                            disabled={loading || bots.length === 0}
                            className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            {assignedIds.length === bots.length && bots.length > 0 ? 'Clear All' : 'Select All'}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="py-8 text-center">Loading...</div>
                ) : (
                    <div className="mt-2 max-h-72 overflow-auto">
                        {bots.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">No templates available.</div>
                        ) : (
                            <ul className="space-y-2">
                                {bots.map((b: any) => {
                                    const id = String(b._id);
                                    const assigned = assignedIds.includes(id);
                                    return (
                                        <li key={id} className="flex items-center justify-between rounded-md border border-gray-200 p-3 dark:border-gray-700">
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">{b.name}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">{b.description}</div>
                                            </div>
                                            <div>
                                                <label className="inline-flex items-center text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={assigned}
                                                        onChange={() => toggle(id, assigned)}
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                                    />
                                                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Assigned</span>
                                                </label>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onSaved && onSaved();
                            onClose();
                        }}
                        disabled={loading}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
