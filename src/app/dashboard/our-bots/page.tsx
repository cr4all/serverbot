'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IBot } from '@/types';
import CreateBotDialog from '../CreateBotDialog';

const getBotLogoFileName = (type: string, subtype: number) => {
    const normalizedType = type
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${normalizedType}-${subtype}.png`;
};

const BOT_LOGO_EXTENSIONS = ['jpg', 'svg', 'png', 'webp'] as const;

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

    useEffect(() => {
        setLogoExtIndex(0);
    }, [type, subtype]);

    const tierLabel = tier === 'free' ? 'Free' : tier === 'paid' ? 'Paid' : null;
    const tierBadgeClass =
        tier === 'free'
            ? 'bg-emerald-600 text-white ring-emerald-200 shadow-emerald-950/45 dark:bg-emerald-500 dark:text-emerald-950 dark:ring-emerald-100'
            : 'bg-amber-500 text-amber-950 ring-amber-100 shadow-amber-950/45 dark:bg-amber-400 dark:text-amber-950 dark:ring-amber-50';

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

export default function OurBotsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [templates, setTemplates] = useState<IBot[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [preselectedBotId, setPreselectedBotId] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchTemplates();
        }
    }, [status, router]);

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/bots');
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const openCreateForTemplate = (botId: string) => {
        setPreselectedBotId(botId);
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setPreselectedBotId(null);
    };

    const handleSuccess = () => {
        router.push('/dashboard');
    };

    if (status === 'loading' || loading) {
        return <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading…</div>;
    }
    if (!session) return null;

    return (
        <div>
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Our Bots</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Browse bot templates assigned to your account. Create an instance to run it from the dashboard.
                    </p>
                </div>
                <Link
                    href="/dashboard"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                    ← Go to instances
                </Link>
            </div>

            <CreateBotDialog
                isOpen={dialogOpen}
                onClose={handleDialogClose}
                onSuccess={handleSuccess}
                preselectedBotId={preselectedBotId}
            />

            {templates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-600 dark:bg-gray-800">
                    <p className="font-medium text-gray-700 dark:text-gray-300">No bot templates available</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Ask an administrator to assign a bot template to your account.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map((t) => {
                        const params = t.configParams ?? [];
                        const tier = (t as { botTier?: string }).botTier;
                        return (
                            <article
                                key={String(t._id)}
                                className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                            >
                                <div className="flex flex-1 flex-col p-6">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <BotLogo
                                                name={t.name}
                                                type={t.type}
                                                subtype={t.subtype ?? 0}
                                                tier={tier}
                                            />
                                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                {t.name}
                                            </h2>
                                        </div>
                                    </div>
                                    {t.description ? (
                                        <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
                                            {t.description}
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-sm italic text-gray-400">No description</p>
                                    )}
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                            {t.type}
                                        </span>
                                        {t.version && (
                                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-400">
                                                v{t.version}
                                            </span>
                                        )}
                                    </div>
                                    {params.length > 0 && (
                                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                            <span className="font-medium text-gray-600 dark:text-gray-300">Parameters:</span>{' '}
                                            {params.map((p) => p.paramName).join(', ')}
                                        </p>
                                    )}
                                </div>
                                <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/40">
                                    <button
                                        type="button"
                                        onClick={() => openCreateForTemplate(String(t._id))}
                                        className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                                    >
                                        Create instance
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
