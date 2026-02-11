'use client';

import { useEffect, useState } from 'react';
import type { ConfigParamDataType, IConfigParam } from '@/types';

const DATA_TYPES: ConfigParamDataType[] = ['String', 'number', 'UNION'];

const emptyParam = (): IConfigParam => ({
    paramName: '',
    dataType: 'String',
});

export default function AdminBotsPage() {
    const [bots, setBots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBotId, setEditingBotId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        subtype: 0,
        description: '',
        version: '1.0.0',
        isDefault: false,
        configParams: [] as IConfigParam[],
    });

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

    const getInitialForm = () => ({
        name: '',
        type: '',
        subtype: 0,
        description: '',
        version: '1.0.0',
        isDefault: false,
        configParams: [] as IConfigParam[],
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                configParams: formData.configParams
                    .filter((p) => p.paramName.trim() !== '')
                    .map((p) => ({
                        paramName: p.paramName.trim(),
                        dataType: p.dataType,
                        ...(p.dataType === 'UNION' && {
                            unionValues: parseUnionValues(p.unionValues),
                        }),
                    })),
            };

            let res;
            if (editingBotId) {
                res = await fetch(`/api/bots/${editingBotId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else {
                res = await fetch('/api/bots', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            if (res.ok) {
                setIsFormOpen(false);
                setEditingBotId(null);
                setFormData(getInitialForm());
                fetchBots();
            }
        } catch (e) {
            console.error(e);
        }
    };

    function parseUnionValues(unionValues: (string | number)[] | undefined): (string | number)[] {
        if (!unionValues || !Array.isArray(unionValues)) return [];
        return unionValues.map((v) => (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v));
    }

    const openEdit = (bot: any) => {
        const params = Array.isArray(bot.configParams) ? bot.configParams : [];
        setFormData({
            name: bot.name || '',
            type: bot.type || '',
            subtype: typeof bot.subtype === 'number' ? bot.subtype : 0,
            description: bot.description || '',
            version: bot.version || '1.0.0',
            isDefault: !!bot.isDefault,
            configParams: params.length
                ? params.map((p: any) => ({
                      paramName: p.paramName || '',
                      dataType: (p.dataType || 'String') as ConfigParamDataType,
                      unionValues: p.unionValues || [],
                  }))
                : [],
        });
        setEditingBotId(bot._id);
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const addParam = () => {
        setFormData((prev) => ({
            ...prev,
            configParams: [...prev.configParams, emptyParam()],
        }));
    };

    const removeParam = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            configParams: prev.configParams.filter((_, i) => i !== index),
        }));
    };

    const updateParam = (index: number, field: keyof IConfigParam, value: any) => {
        setFormData((prev) => {
            const next = [...prev.configParams];
            (next[index] as any)[field] = value;
            return { ...prev, configParams: next };
        });
    };

    const setUnionValuesFromString = (index: number, str: string) => {
        const values = str
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => (Number.isNaN(Number(s)) ? s : Number(s)));
        updateParam(index, 'unionValues', values);
    };

    const getUnionValuesString = (p: IConfigParam) => (p.unionValues || []).join(', ');

    const handleDelete = async (bot: any) => {
        if (!confirm(`Delete template "${bot.name}"? Assignments for this template will also be removed.`)) return;
        try {
            const res = await fetch(`/api/bots/${bot._id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchBots();
                if (editingBotId === bot._id) {
                    setIsFormOpen(false);
                    setEditingBotId(null);
                    setFormData(getInitialForm());
                }
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
                    onClick={() => {
                        if (isFormOpen) {
                            setIsFormOpen(false);
                            setEditingBotId(null);
                            setFormData(getInitialForm());
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
                                placeholder="Template name"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Type (string)</label>
                            <input
                                required
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="mt-1 block w-full rounded-md border p-2 dark:bg-gray-700"
                                placeholder="e.g. TRADING"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Subtype (number)</label>
                            <input
                                type="number"
                                required
                                value={formData.subtype}
                                onChange={(e) => setFormData({ ...formData, subtype: Number(e.target.value) })}
                                className="mt-1 block w-full rounded-md border p-2 dark:bg-gray-700"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="mt-1 block w-full rounded-md border p-2 dark:bg-gray-700"
                                rows={3}
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Config parameters</label>
                                <button
                                    type="button"
                                    onClick={addParam}
                                    className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                                >
                                    + Add parameter
                                </button>
                            </div>
                            <div className="mt-2 space-y-3">
                                {formData.configParams.map((p, index) => (
                                    <div
                                        key={index}
                                        className="flex flex-wrap items-end gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-600"
                                    >
                                        <div className="min-w-[120px] flex-1">
                                            <span className="text-xs text-gray-500">Parameter name</span>
                                            <input
                                                value={p.paramName}
                                                onChange={(e) => updateParam(index, 'paramName', e.target.value)}
                                                className="mt-0.5 block w-full rounded border p-1.5 text-sm dark:bg-gray-700"
                                                placeholder="paramName"
                                            />
                                        </div>
                                        <div className="min-w-[100px]">
                                            <span className="text-xs text-gray-500">Data type</span>
                                            <select
                                                value={p.dataType}
                                                onChange={(e) =>
                                                    updateParam(index, 'dataType', e.target.value as ConfigParamDataType)
                                                }
                                                className="mt-0.5 block w-full rounded border p-1.5 text-sm dark:bg-gray-700"
                                            >
                                                {DATA_TYPES.map((dt) => (
                                                    <option key={dt} value={dt}>
                                                        {dt}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {p.dataType === 'UNION' && (
                                            <div className="min-w-[180px] flex-1">
                                                <span className="text-xs text-gray-500">Allowed values (comma-separated)</span>
                                                <input
                                                    value={getUnionValuesString(p)}
                                                    onChange={(e) => setUnionValuesFromString(index, e.target.value)}
                                                    className="mt-0.5 block w-full rounded border p-1.5 text-sm dark:bg-gray-700"
                                                    placeholder="value1, value2, value3"
                                                />
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeParam(index)}
                                            className="rounded border border-red-300 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                {formData.configParams.length === 0 && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Use the button above to add parameters.</p>
                                )}
                            </div>
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

                        <button
                            type="submit"
                            className="w-full rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 sm:col-span-2"
                        >
                            {editingBotId ? 'Save changes' : 'Create template'}
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
                                    <div className="mt-1 inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        Default
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-mono text-gray-500">{bot.version}</div>
                                <div className="mt-2 flex gap-2">
                                    <button
                                        onClick={() => openEdit(bot)}
                                        className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(bot)}
                                        className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{bot.description || '—'}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">{bot.type}</span>
                            <span className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">subtype: {bot.subtype}</span>
                            <span className="text-xs text-gray-400">ID: {bot._id.slice(-6)}</span>
                        </div>
                        {Array.isArray(bot.configParams) && bot.configParams.length > 0 && (
                            <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-600">
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Config parameters</div>
                                <ul className="mt-1 space-y-0.5 text-xs text-gray-600 dark:text-gray-300">
                                    {bot.configParams.map((p: any, i: number) => (
                                        <li key={i}>
                                            {p.paramName}: {p.dataType}
                                            {p.dataType === 'UNION' && p.unionValues?.length
                                                ? ` (${p.unionValues.join(', ')})`
                                                : ''}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
