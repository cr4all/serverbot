"use client";

import { useCallback, useEffect, useState } from 'react';
import AssignBotsToUserDialog from '../AssignBotsToUserDialog';

const PAGE_SIZES = [10, 25, 50] as const;

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [assignModalUserId, setAssignModalUserId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const fetchUsers = useCallback(async (opts?: { overridePage?: number; overrideLimit?: number }) => {
        setLoading(true);
        const p = opts?.overridePage ?? page;
        const l = opts?.overrideLimit ?? limit;
        try {
            const params = new URLSearchParams({ page: String(p), limit: String(l) });
            const res = await fetch(`/api/admin/users?${params}`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users ?? []);
                setTotal(data.pagination?.total ?? 0);
                setTotalPages(data.pagination?.totalPages ?? 0);
                setPage(p);
                setLimit(l);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, limit]);

    useEffect(() => {
        fetchUsers({ overridePage: 1 });
    }, []);

    const goToPage = (p: number) => {
        if (p >= 1 && p <= totalPages) fetchUsers({ overridePage: p });
    };

    const handleLimitChange = (newLimit: number) => {
        fetchUsers({ overridePage: 1, overrideLimit: newLimit });
    };

    const deleteUser = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            if (res.ok) fetchUsers({ overridePage: page });
            else alert('Failed to delete user');
        } catch (e) { console.error(e); }
    };

    const toggleRole = async (id: string, currentRole: string) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ role: newRole })
            });
            if (res.ok) fetchUsers({ overridePage: page });
            else alert('Failed to change role');
        } catch (e) { console.error(e); }
    };

    const resetPassword = async (id: string) => {
        if (!confirm('Reset password for this user? A temporary password will be generated.')) return;
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resetPassword: true })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Temporary password: ${data.tempPassword}`);
                fetchUsers({ overridePage: page });
            } else {
                alert(data?.error || 'Failed to reset password');
            }
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="text-center">Loading users...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {total === 0 ? 'No users' : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}
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

            <div className="overflow-x-auto rounded-lg bg-white shadow dark:bg-gray-800">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-750">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 w-48">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 w-64">Email</th>
                            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 w-20">Instances</th>
                            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 w-20">Running</th>
                            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 w-20">Stopped</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 w-36">Assigned</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 w-28">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 w-36">Joined</th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 w-28">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                        {users.map((user) => (
                            <tr key={user._id}>
                                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400">{user.totalInstances ?? 0}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400">{user.runningInstances ?? 0}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400">{user.stoppedInstances ?? 0}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                    <button
                                        onClick={() => setAssignModalUserId(user._id)}
                                        className="mr-2 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 inline-flex items-center"
                                        title="Edit assigned templates"
                                        aria-label="Edit assigned templates"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.5 19.213l-4 1 1-4L16.862 3.487z" />
                                        </svg>
                                    </button>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                                    <button
                                        onClick={() => toggleRole(user._id, user.role)}
                                        className="mr-3 text-blue-600 hover:text-blue-900 dark:text-blue-400 inline-flex items-center"
                                        title="Change role"
                                        aria-label="Change role"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10 2a4 4 0 100 8 4 4 0 000-8zM2 18a8 8 0 0116 0H2z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => resetPassword(user._id)}
                                        className="mr-3 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 inline-flex items-center"
                                        title="Reset password"
                                        aria-label="Reset password"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a3 3 0 10-6 0v1H6v6h12V8h-3V7z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 15v2a4 4 0 004 4h2a4 4 0 004-4v-2" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => deleteUser(user._id)}
                                        className="text-red-600 hover:text-red-900 dark:text-red-400 inline-flex items-center"
                                        title="Delete user"
                                        aria-label="Delete user"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7v10a2 2 0 002 2h2a2 2 0 002-2V7" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6M9 7l1-3h4l1 3" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {assignModalUserId && (
                <AssignBotsToUserDialog
                    userId={assignModalUserId}
                    onClose={() => setAssignModalUserId(null)}
                    onSaved={() => fetchUsers()}
                />
            )}
        </div>
    );
}

