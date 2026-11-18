"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import AssignBotsToUserDialog from '../AssignBotsToUserDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import MessageDialog from '@/components/MessageDialog';

const PAGE_SIZES = [10, 25, 50] as const;
const ROLE_OPTIONS = ['', 'admin', 'user'] as const;
const STATUS_OPTIONS = ['', 'active', 'pending', 'suspended'] as const;

type CreateForm = {
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  status: 'active' | 'pending' | 'suspended';
};

const emptyCreate = (): CreateForm => ({
  name: '',
  email: '',
  password: '',
  role: 'user',
  status: 'active',
});

function statusBadgeClass(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  if (status === 'suspended') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalUserId, setAssignModalUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate());
  const [createBusy, setCreateBusy] = useState(false);
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
    status: '',
    createdFrom: '',
    createdTo: '',
  });

  const fetchUsers = useCallback(
    async (opts?: { overrideFilters?: typeof filters; overridePage?: number; overrideLimit?: number }) => {
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
        if (f.status) params.set('status', f.status);
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
    },
    [filters, page, limit]
  );

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
      status: '',
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

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessageDialog({
          open: true,
          title: 'Create failed',
          message: data?.error || 'Failed to create user.',
          variant: 'danger',
        });
        return;
      }
      setShowCreate(false);
      setCreateForm(emptyCreate());
      setMessageDialog({
        open: true,
        title: 'User created',
        message: `${data.email} was created as ${data.role} (${data.status}).`,
        variant: 'success',
      });
      fetchUsers({ overridePage: 1 });
    } catch (err) {
      console.error(err);
      setMessageDialog({
        open: true,
        title: 'Create failed',
        message: 'Something went wrong. Please try again.',
        variant: 'danger',
      });
    } finally {
      setCreateBusy(false);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) fetchUsers({ overridePage: page });
      else alert(data?.error || 'Failed to delete user');
    } catch (e) {
      console.error(e);
    }
  };

  const toggleRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) fetchUsers({ overridePage: page });
      else alert('Failed to change role');
    } catch (e) {
      console.error(e);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchUsers({ overridePage: page });
      else {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Failed to update status');
      }
    } catch (e) {
      console.error(e);
    }
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
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create, approve, and manage accounts</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          {showCreate ? 'Close form' : 'Add user'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={createUser}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">New user</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-xs font-medium text-gray-500">
              Name
              <input
                required
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>
            <label className="block text-xs font-medium text-gray-500">
              Email
              <input
                required
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>
            <label className="block text-xs font-medium text-gray-500">
              Password
              <input
                required
                type="password"
                minLength={6}
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>
            <label className="block text-xs font-medium text-gray-500">
              Role
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value as 'user' | 'admin' }))}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-500">
              Status
              <select
                value={createForm.status}
                onChange={(e) =>
                  setCreateForm((p) => ({
                    ...p,
                    status: e.target.value as 'active' | 'pending' | 'suspended',
                  }))
                }
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="active">active</option>
                <option value="pending">pending</option>
                <option value="suspended">suspended</option>
              </select>
            </label>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={createBusy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createBusy ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
            <input
              type="text"
              value={filters.name}
              onChange={(e) => handleFilterChange('name', e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Email</label>
            <input
              type="text"
              value={filters.email}
              onChange={(e) => handleFilterChange('email', e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">User ID</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Role</label>
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All</option>
              {ROLE_OPTIONS.filter(Boolean).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Joined From</label>
            <input
              type="date"
              value={filters.createdFrom}
              onChange={(e) => handleFilterChange('createdFrom', e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Joined To</label>
            <input
              type="date"
              value={filters.createdTo}
              onChange={(e) => handleFilterChange('createdTo', e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
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
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} per page
              </option>
            ))}
          </select>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="rounded-lg px-2 py-1 text-sm disabled:opacity-40">
              Prev
            </button>
            <span className="px-2 text-sm text-gray-600 dark:text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg px-2 py-1 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50/80 dark:bg-gray-800/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Instances</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Joined</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <select
                    value={user.status || 'active'}
                    onChange={(e) => setStatus(user._id, e.target.value)}
                    className={`rounded-full border-0 px-2 py-1 text-xs font-semibold ${statusBadgeClass(user.status || 'active')}`}
                  >
                    <option value="active">active</option>
                    <option value="pending">pending</option>
                    <option value="suspended">suspended</option>
                  </select>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">{user.totalInstances ?? 0}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium space-x-2">
                  <button
                    type="button"
                    onClick={() => setAssignModalUserId(user._id)}
                    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRole(user._id, user.role)}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                  >
                    Role
                  </button>
                  <button
                    type="button"
                    onClick={() => openResetPasswordDialog(user)}
                    className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400"
                  >
                    Reset PW
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteUser(user._id)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                  No users found
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
