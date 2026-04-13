'use client';

import { useState, useEffect } from 'react';
import { IBotInstance } from '@/types';

interface CreateBotDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: IBotInstance | null;
    /** When creating, skip template selection and open configure step with this template */
    preselectedBotId?: string | null;
}

const STEP_SELECT_TEMPLATE = 1;
const STEP_CONFIGURE_INSTANCE = 2;

function resolveBotTier(
    templates: { _id: unknown; botTier?: string }[],
    botId: string,
    initialData?: IBotInstance | null
): 'free' | 'paid' {
    const t = templates.find((x) => String(x._id) === String(botId));
    if (t?.botTier === 'free') return 'free';
    if (t?.botTier === 'paid') return 'paid';
    const bid = initialData?.botId;
    if (bid && typeof bid === 'object' && bid !== null && 'botTier' in bid) {
        const bt = (bid as { botTier?: string }).botTier;
        if (bt === 'free') return 'free';
        if (bt === 'paid') return 'paid';
    }
    return 'paid';
}

export default function CreateBotDialog({ isOpen, onClose, onSuccess, initialData, preselectedBotId }: CreateBotDialogProps) {
    const [step, setStep] = useState(STEP_SELECT_TEMPLATE);
    const [loading, setLoading] = useState(false);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const allowedLocales = ['COMMON', 'SPAIN', 'ITALY', 'AUSTRALIA', 'FINLAND'];
    const [formData, setFormData] = useState({
        botId: '',
        name: '',
        lastBalance: 0,
        config: {
            username: '',
            password: '',
            locale: 'COMMON',
            licenseKey: '',
            stake: '',
            // Proxy settings
            proxyType: '',
            proxyHost: '',
            proxyPort: '',
            proxyUsername: '',
            proxyPassword: '',
        },
    });

    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
            if (initialData) {
                setStep(STEP_CONFIGURE_INSTANCE);
                setFormData({
                    botId: (initialData.botId as any)?._id || (initialData.botId as string),
                    name: initialData.name,
                    lastBalance: initialData.lastBalance,
                    config: {
                        username: initialData.config?.username || '',
                        password: initialData.config?.password || '',
                        locale: initialData.config?.locale || 'COMMON',
                        licenseKey: initialData.config?.licenseKey || '',
                        stake: initialData.config?.stake != null ? String(initialData.config.stake) : '',
                        proxyType: initialData.config?.proxyType || '',
                        proxyHost: initialData.config?.proxyHost || '',
                        proxyPort: initialData.config?.proxyPort || '',
                        proxyUsername: initialData.config?.proxyUsername || '',
                        proxyPassword: initialData.config?.proxyPassword || '',
                        ...initialData.config,
                    },
                });
            } else if (preselectedBotId) {
                setStep(STEP_CONFIGURE_INSTANCE);
                setFormData({
                    botId: preselectedBotId,
                    name: '',
                    lastBalance: 0,
                    config: {
                        username: '',
                        password: '',
                        locale: 'COMMON',
                        licenseKey: '',
                        stake: '',
                        proxyType: '',
                        proxyHost: '',
                        proxyPort: '',
                        proxyUsername: '',
                        proxyPassword: '',
                    },
                });
            } else {
                setStep(STEP_SELECT_TEMPLATE);
                setFormData({
                    botId: '',
                    name: '',
                    lastBalance: 0,
                    config: {
                        username: '',
                        password: '',
                        locale: 'COMMON',
                        licenseKey: '',
                        stake: '',
                        proxyType: '',
                        proxyHost: '',
                        proxyPort: '',
                        proxyUsername: '',
                        proxyPassword: '',
                    },
                });
            }
        }
    }, [isOpen, initialData, preselectedBotId]);

    const fetchTemplates = async () => {
        setTemplatesLoading(true);
        try {
            const res = await fetch('/api/bots');
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setTemplatesLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const topLevelKeys = ['botId', 'name', 'lastBalance'];
        if (topLevelKeys.includes(name)) {
            setFormData((prev) => ({ ...prev, [name]: name === 'lastBalance' ? Number(value) : value }));
        } else {
            setFormData((prev) => ({
                ...prev,
                config: { ...prev.config, [name]: value },
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Validate locale is allowed
        if (!allowedLocales.includes(formData.config.locale)) {
            alert(`Locale must be one of: ${allowedLocales.join(', ')}`);
            setLoading(false);
            return;
        }

        try {
            let botIdToUse = formData.botId;

            // If creating and no template selected (and none exist), create dummy (Admin logic typically)
            // if (!botIdToUse && !initialData) {
            //     const newBot = await fetch('/api/bots', {
            //         method: 'POST',
            //         body: JSON.stringify({
            //             name: 'Standard Trading Bot',
            //             type: 'TRADING',
            //             version: '1.0.0',
            //             description: 'A standard trading bot template'
            //         })
            //     });
            //     const botData = await newBot.json();
            //     botIdToUse = botData._id;
            // }

            const url = initialData
                ? `/api/bot-instances/${initialData._id}`
                : '/api/bot-instances';

            const method = initialData ? 'PATCH' : 'POST';

            const selectedTemplate = templates.find((t) => String(t._id) === String(formData.botId));
            const configParams = selectedTemplate?.configParams ?? [];
            const config: Record<string, unknown> = { ...formData.config };
            if (resolveBotTier(templates, formData.botId, initialData) === 'free') {
                delete config.licenseKey;
                delete config.proxyType;
                delete config.proxyHost;
                delete config.proxyPort;
                delete config.proxyUsername;
                delete config.proxyPassword;
            }
            // Ensure stake is sent as number (integer or float)
            const rawStake = config.stake;
            if (rawStake !== '' && rawStake !== undefined && rawStake !== null) {
                config.stake = Number(rawStake);
            } else {
                delete config.stake;
            }
            for (const p of configParams) {
                const raw = config[p.paramName];
                if (p.dataType === 'number' && (raw !== '' && raw !== undefined && raw !== null)) {
                    config[p.paramName] = Number(raw);
                } else if (p.dataType === 'Boolean') {
                    config[p.paramName] = raw === true || raw === 'true';
                }
            }

            const body: any = {
                name: formData.name,
                config,
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

    const selectedTemplate = templates.find((t) => String(t._id) === String(formData.botId));
    const isFreeTier = resolveBotTier(templates, formData.botId, initialData) === 'free';
    const isCreateFlow = !initialData;

    const StepIndicator = () =>
        isCreateFlow ? (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-gray-100 p-2 dark:bg-gray-700/50" role="tablist" aria-label="Creation steps">
                <div
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                        step === STEP_SELECT_TEMPLATE
                            ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400'
                    }`}
                >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-current/10 text-xs font-bold">
                        {step > STEP_SELECT_TEMPLATE ? '✓' : '1'}
                    </span>
                    Choose Bot Template
                </div>
                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" aria-hidden />
                <div
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                        step === STEP_CONFIGURE_INSTANCE
                            ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400'
                    }`}
                >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-current/10 text-xs font-bold">2</span>
                    Configure
                </div>
            </div>
        ) : null;

    // Step 1: Select bot template (create flow only)
    if (isCreateFlow && step === STEP_SELECT_TEMPLATE) {
        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                onClick={(e) => e.target === e.currentTarget && onClose()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title-step1"
            >
                <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-gray-800 max-h-[90vh] flex flex-col">
                    <div className="shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                        <h2 id="dialog-title-step1" className="text-lg font-bold text-gray-900 dark:text-white">
                            Create New Bot
                        </h2>
                        <StepIndicator />
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {templatesLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400" />
                                <p className="mt-3 text-sm">Loading templates…</p>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center dark:border-gray-600 dark:bg-gray-700/30">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No templates available</p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Contact an admin to get access to a bot template.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {templates.map((t) => {
                                    const isSelected = String(formData.botId) === String(t._id);
                                    const params = t.configParams ?? [];
                                    return (
                                        <button
                                            key={t._id}
                                            type="button"
                                            onClick={() => setFormData((prev) => ({ ...prev, botId: t._id }))}
                                            className={`relative w-full rounded-xl border-2 p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                                                isSelected
                                                    ? 'border-blue-500 bg-blue-50/80 dark:border-blue-400 dark:bg-blue-900/25'
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 dark:border-gray-600 dark:bg-gray-700/50 dark:hover:border-gray-500 dark:hover:bg-gray-700'
                                            }`}
                                            aria-pressed={isSelected}
                                        >
                                            {isSelected && (
                                                <span className="absolute right-3 top-3 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white dark:bg-blue-400">
                                                    Selected
                                                </span>
                                            )}
                                            <div className="pr-20 font-semibold text-gray-900 dark:text-white">{t.name}</div>
                                            {t.description && (
                                                <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{t.description}</p>
                                            )}
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                <span className="rounded-md bg-gray-200/80 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                                                    {t.type}
                                                </span>
                                                {t.version && (
                                                    <span className="rounded-md bg-gray-200/80 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-400">
                                                        v{t.version}
                                                    </span>
                                                )}
                                            </div>
                                            {params.length > 0 && (
                                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                    Parameters: {params.map((p: { paramName: string }) => p.paramName).join(', ')}
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="shrink-0 flex justify-between gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep(STEP_CONFIGURE_INSTANCE)}
                            disabled={!formData.botId || templatesLoading}
                            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                        >
                            Next: Configure instance
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Preselected template: wait for template list before showing configure form
    if (isCreateFlow && step === STEP_CONFIGURE_INSTANCE && templatesLoading && formData.botId) {
        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                onClick={(e) => e.target === e.currentTarget && onClose()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-loading-templates"
            >
                <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl dark:bg-gray-800">
                    <h2 id="dialog-loading-templates" className="sr-only">
                        Loading bot template
                    </h2>
                    <div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400" />
                        <p className="mt-3 text-sm">Loading bot template…</p>
                    </div>
                </div>
            </div>
        );
    }

    // Step 2: Configure instance (or edit)
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title-step2"
        >
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800">
                <div className="shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                    <h2 id="dialog-title-step2" className="text-lg font-bold text-gray-900 dark:text-white">
                        {initialData ? 'Edit Bot Configuration' : 'Create New Bot'}
                    </h2>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        {initialData ? 'Update your instance settings.' : 'Configure name, credentials, and options.'}
                    </p>
                    <StepIndicator />
                </div>

                <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        <div className="space-y-5">
                            <section aria-labelledby="template-heading">
                                <h3 id="template-heading" className="sr-only">Selected template</h3>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bot template</label>
                                <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
                                    {selectedTemplate ? (
                                        <span>
                                            <span className="font-medium">{selectedTemplate.name}</span>
                                        </span>
                                    ) : (
                                        <span className="text-gray-500">No template selected</span>
                                    )}
                                </div>
                            </section>

                    {formData.botId && (() => {
                        const selected = templates.find((t) => String(t._id) === String(formData.botId));
                        const params = selected?.configParams;
                        if (!params?.length) return null;
                        return (
                            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/50">
                                <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Template config parameters</div>
                                <div className="space-y-3">
                                    {(isFreeTier
                                        ? params.filter(
                                              (p: { paramName: string }) =>
                                                  p.paramName !== 'licenseKey' &&
                                                  !['proxyType', 'proxyHost', 'proxyPort', 'proxyUsername', 'proxyPassword'].includes(
                                                      p.paramName
                                                  )
                                          )
                                        : params
                                    ).map((p: { paramName: string; dataType: string; unionValues?: (string | number)[] }, i: number) => {
                                        const name = p.paramName;
                                        const val = (formData.config as Record<string, unknown>)[name];
                                        if (p.dataType === 'Boolean') {
                                            const boolVal = val === true || val === 'true';
                                            return (
                                                <div key={i}>
                                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{p.paramName}</label>
                                                    <select
                                                        name={name}
                                                        value={boolVal ? 'true' : 'false'}
                                                        onChange={handleChange}
                                                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                    >
                                                        <option value="false">No</option>
                                                        <option value="true">Yes</option>
                                                    </select>
                                                </div>
                                            );
                                        }
                                        const isUnion = p.dataType === 'UNION' || p.dataType === 'Union';
                                        if (isUnion && p.unionValues?.length) {
                                            return (
                                                <div key={i}>
                                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{p.paramName}</label>
                                                    <select
                                                        name={name}
                                                        value={String(val ?? '')}
                                                        onChange={handleChange}
                                                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                    >
                                                        <option value="">Select...</option>
                                                        {p.unionValues.map((v) => (
                                                            <option key={String(v)} value={String(v)}>{String(v)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        }
                                        if (p.dataType === 'number') {
                                            return (
                                                <div key={i}>
                                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{p.paramName}</label>
                                                    <input
                                                        type="number"
                                                        name={name}
                                                        value={val !== undefined && val !== null && val !== '' ? Number(val) : ''}
                                                        onChange={handleChange}
                                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                    />
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={i}>
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{p.paramName}</label>
                                                <input
                                                    type="text"
                                                    name={name}
                                                    value={String(val ?? '')}
                                                    onChange={handleChange}
                                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

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
                    {!isFreeTier && (
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
                    )}

                    <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-200">Configuration</h3>

                        <div className="grid gap-4 sm:grid-cols-2">
                            
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Locale</label>
                                <select
                                    name="locale"
                                    value={formData.config.locale}
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    {allowedLocales.map((loc) => (
                                        <option key={loc} value={loc}>
                                            {loc}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <>
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
                            </>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Stake Amount</label>
                                <input
                                    type="number"
                                    name="stake"
                                    step="any"
                                    min="0"
                                    placeholder="Input stake amount"
                                    value={formData.config.stake}
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>

                            {!isFreeTier && (
                                <div className="sm:col-span-2 border-t border-gray-100 pt-4 dark:border-gray-700">
                                    <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-200">Proxy</h4>

                                    <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                                        Configure this only if you have your own proxy.
                                    </p>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Proxy Type</label>
                                            <select
                                                name="proxyType"
                                                value={formData.config.proxyType}
                                                onChange={handleChange}
                                                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            >
                                                <option value="">None</option>
                                                <option value="HTTP">HTTP</option>
                                                <option value="SOCKS5">SOCKS5</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Proxy Host/IP</label>
                                            <input
                                                type="text"
                                                name="proxyHost"
                                                placeholder="proxy.example.com or 1.2.3.4"
                                                value={formData.config.proxyHost}
                                                onChange={handleChange}
                                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Proxy Port</label>
                                            <input
                                                type="number"
                                                name="proxyPort"
                                                placeholder="8080"
                                                value={formData.config.proxyPort}
                                                onChange={handleChange}
                                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Proxy Username</label>
                                            <input
                                                type="text"
                                                name="proxyUsername"
                                                placeholder="optional"
                                                value={formData.config.proxyUsername}
                                                onChange={handleChange}
                                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Proxy Password</label>
                                            <input
                                                type="password"
                                                name="proxyPassword"
                                                placeholder="optional"
                                                value={formData.config.proxyPassword}
                                                onChange={handleChange}
                                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                        </div>
                    </div>

                    <div className="shrink-0 flex justify-between gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                        <div className="flex gap-2">
                            {!initialData && (
                                <button
                                    type="button"
                                    onClick={() => setStep(STEP_SELECT_TEMPLATE)}
                                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                        >
                            {loading ? 'Saving…' : (initialData ? 'Update Bot' : 'Create Bot')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
