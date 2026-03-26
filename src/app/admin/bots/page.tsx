'use client';

import { useEffect, useState } from 'react';
import type { ConfigParamDataType, IConfigParam } from '@/types';

const DATA_TYPES: ConfigParamDataType[] = ['String', 'Number', 'Union', 'Boolean'];
const BOT_LOGO_EXTENSIONS = ['jpg', 'svg', 'png', 'webp'] as const;

const getBotLogoFileName = (type: string, subtype: number) => {
    const normalizedType = type
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${normalizedType}-${subtype}.png`;
};

const BotLogo = ({
    name,
    type,
    subtype,
    tier,
}: {
    name: string;
    type: string;
    subtype: number;
    tier?: string;
}) => {
    const [logoExtIndex, setLogoExtIndex] = useState(0);
    const fileName = getBotLogoFileName(type, subtype);
    const baseFileName = fileName.replace(/\.(png|jpg|jpeg|svg|webp)$/i, '');
    const currentExt = BOT_LOGO_EXTENSIONS[logoExtIndex];
    const src = `/bot-logos/${baseFileName}.${currentExt}`;
    const hasError = logoExtIndex >= BOT_LOGO_EXTENSIONS.length;
    const tierLabel = tier === 'free' ? 'Free' : tier === 'paid' ? 'Paid' : null;
    const tierBadgeClass =
        tier === 'free'
            ? 'bg-emerald-600 text-white ring-emerald-200 shadow-emerald-950/45 dark:bg-emerald-500 dark:text-emerald-950 dark:ring-emerald-100'
            : 'bg-amber-500 text-amber-950 ring-amber-100 shadow-amber-950/45 dark:bg-amber-400 dark:text-amber-950 dark:ring-amber-50';

    useEffect(() => {
        setLogoExtIndex(0);
    }, [type, subtype]);

    if (hasError) {
        return (
            <div className="relative h-[50px] w-[120px] shrink-0 overflow-hidden rounded-md">
                <div className="flex h-full w-full items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                    <span className="text-xs font-semibold">BOT</span>
                </div>
                {tierLabel && (
                    <span
                        className={`absolute left-0 top-2 z-20 -translate-x-3 rotate-[-45deg] rounded-sm px-5 py-0.5 text-[10px] font-extrabold tracking-wide ring-1 shadow-lg ${tierBadgeClass}`}
                    >
                        {tierLabel}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="relative h-[50px] w-[120px] shrink-0 overflow-hidden rounded-md">
            <img
                src={src}
                alt={`${name} logo`}
                className="h-full w-full rounded-md object-contain"
                onError={() => setLogoExtIndex((prev) => prev + 1)}
            />
            {tierLabel && (
                <span
                    className={`absolute left-0 top-2 z-20 -translate-x-3 rotate-[-45deg] rounded-sm px-5 py-0.5 text-[10px] font-extrabold tracking-wide ring-1 shadow-lg ${tierBadgeClass}`}
                >
                    {tierLabel}
                </span>
            )}
        </div>
    );
};

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
                    .map((p) => {
                        const param = p as ConfigParamWithStr;
                        return {
                            paramName: param.paramName.trim(),
                            dataType: param.dataType,
                            ...(param.dataType === 'Union' && {
                                unionValues: parseUnionValuesFromString(getUnionValuesString(param)),
                            }),
                        };
                    }),
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
                      unionValuesStr: Array.isArray(p.unionValues)
                          ? p.unionValues.join(', ')
                          : undefined,
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

    type ConfigParamWithStr = IConfigParam & { unionValuesStr?: string };

    const setUnionValuesFromString = (index: number, str: string) => {
        setFormData((prev) => {
            const next = [...prev.configParams] as ConfigParamWithStr[];
            next[index] = { ...next[index], unionValuesStr: str };
            return { ...prev, configParams: next };
        });
    };

    const getUnionValuesString = (p: ConfigParamWithStr) =>
        p.unionValuesStr !== undefined && p.unionValuesStr !== null
            ? p.unionValuesStr
            : (p.unionValues || []).join(', ');

    function parseUnionValuesFromString(str: string): (string | number)[] {
        if (typeof str !== 'string' || !str.trim()) return [];
        return str
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => (Number.isNaN(Number(s)) ? s : Number(s)));
    }

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
                                        {p.dataType === 'Union' && (
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
                    <article
                        key={bot._id}
                        className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                    >
                        {(() => {
                            const params = Array.isArray(bot.configParams) ? bot.configParams : [];
                            const tier = (bot as { botTier?: string }).botTier;
                            return (
                                <>
                                    <div className="flex flex-1 flex-col p-6">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <BotLogo
                                                    name={bot.name}
                                                    type={bot.type}
                                                    subtype={typeof bot.subtype === 'number' ? bot.subtype : 0}
                                                    tier={tier}
                                                />
                                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {bot.name}
                                                </h2>
                                            </div>
                                        </div>

                                        {bot.description ? (
                                            <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
                                                {bot.description}
                                            </p>
                                        ) : (
                                            <p className="mt-2 text-sm italic text-gray-400">No description</p>
                                        )}

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                {bot.type}
                                            </span>
                                            {bot.version && (
                                                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-400">
                                                    v{bot.version}
                                                </span>
                                            )}
                                        </div>

                                        {params.length > 0 && (
                                            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="font-medium text-gray-600 dark:text-gray-300">
                                                    Parameters:
                                                </span>{' '}
                                                {params.map((p: any) => p.paramName).join(', ')}
                                            </p>
                                        )}
                                    </div>

                                    <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/40">
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <button
                                                type="button"
                                                onClick={() => openEdit(bot)}
                                                className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:focus:ring-offset-gray-900 sm:flex-1"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(bot)}
                                                className="w-full rounded-md border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 dark:border-red-600 dark:text-red-400 dark:focus:ring-offset-gray-900 sm:flex-1"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </article>
                ))}
            </div>
        </div>
    );
}
