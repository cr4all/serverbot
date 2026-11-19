'use client';

import { useCallback, useEffect, useState } from 'react';

type VpsRole = 'BETONLINE' | 'PS3838';

type VpsNodeRow = {
  _id: string;
  name: string;
  role: VpsRole;
  address: string;
  username: string;
  enabled: boolean;
  notes?: string;
};

type FormState = {
  name: string;
  role: VpsRole;
  address: string;
  username: string;
  password: string;
  enabled: boolean;
  notes: string;
};

const emptyForm = (role: VpsRole = 'BETONLINE'): FormState => ({
  name: '',
  role,
  address: '',
  username: '',
  password: '',
  enabled: true,
  notes: '',
});

export default function AdminVpsPage() {
  const [nodes, setNodes] = useState<VpsNodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'' | VpsRole>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/vps-nodes');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load VPS nodes');
      setNodes(Array.isArray(data.nodes) ? data.nodes : []);
    } catch (err) {
      setError((err as Error)?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startCreate = (role: VpsRole) => {
    setEditingId(null);
    setForm(emptyForm(role));
  };

  const startEdit = (node: VpsNodeRow) => {
    setEditingId(node._id);
    setForm({
      name: node.name,
      role: node.role,
      address: node.address,
      username: node.username,
      password: '',
      enabled: node.enabled,
      notes: node.notes || '',
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        role: form.role,
        address: form.address.trim(),
        username: form.username.trim(),
        enabled: form.enabled,
        notes: form.notes,
      };
      if (form.password) payload.password = form.password;

      const res = await fetch(editingId ? `/api/admin/vps-nodes/${editingId}` : '/api/admin/vps-nodes', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId ? payload : { ...payload, password: form.password }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      setEditingId(null);
      setForm(emptyForm(form.role));
      await load();
    } catch (err) {
      setError((err as Error)?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (node: VpsNodeRow) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/vps-nodes/${node._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !node.enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Update failed');
      }
      await load();
    } catch (err) {
      setError((err as Error)?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (node: VpsNodeRow) => {
    if (!confirm(`Delete VPS "${node.name}" (${node.address})?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/vps-nodes/${node._id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Delete failed');
      if (editingId === node._id) {
        setEditingId(null);
        setForm(emptyForm());
      }
      await load();
    } catch (err) {
      setError((err as Error)?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const filtered = roleFilter ? nodes.filter((n) => n.role === roleFilter) : nodes;
  const bol = filtered.filter((n) => n.role === 'BETONLINE');
  const ps = filtered.filter((n) => n.role === 'PS3838');

  const Section = ({ title, rows }: { title: string; rows: VpsNodeRow[] }) => (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
        <span className="text-xs text-gray-500">{rows.length} node(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Address</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Username</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Enabled</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((n) => (
              <tr key={n._id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{n.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{n.address}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{n.username}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      n.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {n.enabled ? 'enabled' : 'disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  <div className="inline-flex items-center justify-end gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleEnabled(n)}
                      title={n.enabled ? 'Disable this VPS (hide from bot create)' : 'Enable this VPS'}
                      aria-label={n.enabled ? 'Disable VPS' : 'Enable VPS'}
                      className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                    >
                      {n.enabled ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(n)}
                      title="Edit VPS name, address, and credentials"
                      aria-label="Edit VPS"
                      className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.5 19.213l-4 1 1-4L16.862 3.487z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(n)}
                      title="Delete this VPS node"
                      aria-label="Delete VPS"
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v10a2 2 0 002 2h2a2 2 0 002-2V7" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  No VPS nodes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">VPS Management</h1>
          <p className="mt-1 text-sm text-gray-500">Add BetOnline and PS3838 agent endpoints for surebet desks</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startCreate('BETONLINE')}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add BetOnline VPS
          </button>
          <button
            type="button"
            onClick={() => startCreate('PS3838')}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add PS3838 VPS
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <form
        onSubmit={save}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">
          {editingId ? 'Edit VPS' : 'New VPS'}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs font-medium text-gray-500">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          <label className="block text-xs font-medium text-gray-500">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as VpsRole }))}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="BETONLINE">BETONLINE</option>
              <option value="PS3838">PS3838</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-500">
            Address (host or host:port)
            <input
              required
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="168.121.74.27 or host:4400"
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          <label className="block text-xs font-medium text-gray-500">
            Username
            <input
              required
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          <label className="block text-xs font-medium text-gray-500">
            Password {editingId ? <em className="font-normal">(blank = keep)</em> : null}
            <input
              type="password"
              required={!editingId}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
            />
            Enabled
          </label>
          <label className="block text-xs font-medium text-gray-500 sm:col-span-2 lg:col-span-3">
            Notes
            <input
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create VPS'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm());
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Filter</span>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as '' | VpsRole)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="">All roles</option>
          <option value="BETONLINE">BetOnline</option>
          <option value="PS3838">PS3838</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          {(roleFilter === '' || roleFilter === 'BETONLINE') && <Section title="BetOnline VPS" rows={bol} />}
          {(roleFilter === '' || roleFilter === 'PS3838') && <Section title="PS3838 VPS" rows={ps} />}
        </div>
      )}
    </div>
  );
}
