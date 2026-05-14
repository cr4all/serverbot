"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import AssignBotsToUserDialog from '../AssignBotsToUserDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import MessageDialog from '@/components/MessageDialog';

const PAGE_SIZES = [10, 25, 50] as const;

const ROLE_OPTIONS = ['', 'admin', 'user'] as const;

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [assignModalUserId, setAssignModalUserId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [resetConfirm, setResetConfirm] = useState<{ open: boolean; userId: string; label: string }>({
        open: false,
        userId: '',
        label: '',
    });
    const [resetPasswordBusy, setResetPasswordBusy] = useState(false);
    const resetPasswordInFlight = useRef(false);
    const [messageDialog, setMessageDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        variant?: 'info' | 'warning' | 'danger' | 'success';
    }>({ open: false, title: '', message: '', variant: 'info' });

    const [filters, setFilters] = useState({
        name: '',
        email: '',
        userId: '',
        role: '',
        createdFrom: '',
        createdTo: '',
    });

    const fetchUsers = useCallback(async (opts?: { overrideFilters?: typeof filters; overridePage?: number; overrideLimit?: number }) => {
        setLoading(true);
        const f = opts?.overrideFilters ?? filters;
        const p = opts?.overridePage ?? page;
        const l = opts?.overrideLimit ?? limit;
        try {
            const params = new URLSearchParams();
            if (f.name) params.set('name', f.name);
            if (f.email) params.set('email', f.email);
            if (f.userId) params.set('userId', f.userId);
            if (f.role) params.set('role', f.role);
            if (f.createdFrom) params.set('createdFrom', f.createdFrom);
            if (f.createdTo) params.set('createdTo', f.createdTo);
            params.set('page', String(p));
            params.set('limit', String(l));
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
    }, [filters, page, limit]);

    useEffect(() => {
        fetchUsers({ overridePage: 1 });
    }, []);

    const handleFilterChange = (key: string, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const applyFilters = () => {
        fetchUsers({ overrideFilters: filters, overridePage: 1 });
    };

    const clearFilters = () => {
        const empty = {
            name: '',
            email: '',
            userId: '',
            role: '',
            createdFrom: '',
            createdTo: '',
        };
        setFilters(empty);
        fetchUsers({ overrideFilters: empty, overridePage: 1 });
    };

    const goToPage = (p: number) => {
        if (p >= 1 && p <= totalPages) fetchUsers({ overridePage: p });
    };

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
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

    const openResetPasswordDialog = (user: { _id: string; name: string; email: string }) => {
        setResetConfirm({
            open: true,
            userId: user._id,
            label: `${user.name} (${user.email})`,
        });
    };

    const performResetPassword = async () => {
        const id = resetConfirm.userId;
        if (!id || resetPasswordInFlight.current) return;
        resetPasswordInFlight.current = true;
        setResetPasswordBusy(true);
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resetPassword: true }),
            });
            const data = await res.json();
            setResetConfirm({ open: false, userId: '', label: '' });
            if (res.ok) {
                setMessageDialog({
                    open: true,
                    title: 'Password reset',
                    message: `A temporary password was generated.\n\n${data.tempPassword}\n\nShare it with the user once. They should change it after signing in.`,
                    variant: 'success',
                });
                fetchUsers({ overridePage: page });
            } else {
                setMessageDialog({
                    open: true,
                    title: 'Reset failed',
                    message: data?.error || 'Failed to reset password.',
                    variant: 'danger',
                });
            }
        } catch (e) {
            console.error(e);
            setResetConfirm({ open: false, userId: '', label: '' });
            setMessageDialog({
                open: true,
                title: 'Reset failed',
                message: 'Something went wrong. Please try again.',
                variant: 'danger',
            });
        } finally {
            resetPasswordInFlight.current = false;
            setResetPasswordBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[200px] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading users…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ConfirmDialog
                open={resetConfirm.open}
                title="Reset password?"
                message={`Reset password for ${resetConfirm.label}?\n\nA new temporary password will be generated. The user should sign in and change it as soon as possible.`}
                variant="warning"
                confirmText={resetPasswordBusy ? 'Resetting…' : 'Reset password'}
                cancelText="Cancel"
                onCancel={() => {
                    if (resetPasswordBusy) return;
                    setResetConfirm({ open: false, userId: '', label: '' });
                }}
                onConfirm={performResetPassword}
            />
            <MessageDialog
                open={messageDialog.open}
                title={messageDialog.title}
                message={messageDialog.message}
                variant={messageDialog.variant}
                confirmText="OK"
                onClose={() => setMessageDialog({ open: false, title: '', message: '', variant: 'info' })}
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Search, filter, and manage user accounts</p>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex items-center gap-2">
                    <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
                        <input
                            type="text"
                            placeholder="Search…"
                            value={filters.name}
                            onChange={(e) => handleFilterChange('name', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Email</label>
                        <input
                            type="text"
                            placeholder="Search…"
                            value={filters.email}
                            onChange={(e) => handleFilterChange('email', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">User ID</label>
                        <input
                            type="text"
                            placeholder="Partial match on ID…"
                            value={filters.userId}
                            onChange={(e) => handleFilterChange('userId', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Role</label>
                        <select
                            value={filters.role}
                            onChange={(e) => handleFilterChange('role', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        >
                            <option value="">All</option>
                            {ROLE_OPTIONS.filter(Boolean).map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Joined From</label>
                        <input
                            type="date"
                            value={filters.createdFrom}
                            onChange={(e) => handleFilterChange('createdFrom', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Joined To</label>
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
                        type="button"
                        onClick={applyFilters}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    >
                        Apply Filters
                    </button>
                    <button
                        type="button"
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

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                        <tr>
                            <th className="w-48 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                            <th className="w-64 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                            <th className="w-20 px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Instances</th>
                            <th className="w-20 px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Running</th>
                            <th className="w-20 px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Stopped</th>
                            <th className="w-36 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Assigned</th>
                            <th className="w-28 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Role</th>
                            <th className="w-36 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Joined</th>
                            <th className="w-28 px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                        {users.map((user) => (
                            <tr key={user._id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">{user.totalInstances ?? 0}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">{user.runningInstances ?? 0}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">{user.stoppedInstances ?? 0}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
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
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
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
                                        onClick={() => openResetPasswordDialog(user)}
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
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={9} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <svg className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.433-2.554A9.32 9.32 0 0012 21c-1.268 0-2.39-.23-3.323-.636M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                        </svg>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No users found</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">Try adjusting your filters</p>
                                    </div>
                                </td>
                            </tr>
                        )}
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

