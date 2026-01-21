'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { IBotInstance } from '@/types';
import CreateBotDialog from './CreateBotDialog';

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [instances, setInstances] = useState<IBotInstance[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingInstance, setEditingInstance] = useState<IBotInstance | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchInstances();
        }
    }, [status, router]);

    const fetchInstances = async () => {
        try {
            const res = await fetch(`/api/bot-instances`);
            if (res.ok) {
                const data = await res.json();
                setInstances(data);
            }
        } catch (error) {
            console.error('Failed to fetch instances', error);
        } finally {
            setLoading(false);
        }
    };

    const openCreateDialog = () => {
        setEditingInstance(null);
        setIsDialogOpen(true);
    };

    const openEditDialog = (instance: IBotInstance) => {
        setEditingInstance(instance);
        setIsDialogOpen(true);
    };

    if (status === 'loading' || loading) return <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading...</div>;
    if (!session) return null;

    return (
        <div>
            <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Your Bot Instances</h1>
                    <p className="text-sm text-gray-500">Welcome back, {session.user?.name}</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-4">
                    <button
                        onClick={openCreateDialog}
                        className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Add New Bot
                    </button>
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            <CreateBotDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onSuccess={fetchInstances}
                initialData={editingInstance}
            />

            {instances.length === 0 ? (
                <div className="text-center text-gray-500 py-10 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <p>No bot instances found. Create one to get started!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {instances.map((instance) => (
                        <BotCard
                            key={instance._id as string}
                            instance={instance}
                            refresh={fetchInstances}
                            onEdit={() => openEditDialog(instance)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function BotCard({
    instance,
    refresh,
    onEdit
}: {
    instance: IBotInstance;
    refresh: () => void;
    onEdit: () => void;
}) {
    const isRunning = instance.status === 'RUNNING';

    const toggleStatus = async () => {
        const newStatus = isRunning ? 'STOPPED' : 'RUNNING';
        try {
            await fetch(`/api/bot-instances/${instance._id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });
            refresh();
        } catch (e) {
            console.error(e);
        }
    };

    const deleteInstance = async () => {
        if (!confirm('Are you sure?')) return;
        try {
            await fetch(`/api/bot-instances/${instance._id}`, {
                method: 'DELETE',
            });
            refresh();
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <div className="overflow-hidden rounded-lg bg-white shadow transition hover:shadow-md dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className={`h-3 w-3 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate" title={instance.name}>
                            {isRunning ? (
                                <a href={`/dashboard/instance/${instance._id}`} className="hover:underline hover:text-blue-500">
                                    {instance.name}
                                </a>
                            ) : (
                                instance.name
                            )}
                        </h3>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        {(instance.botId as any)?.type || 'UNKNOWN'}
                    </span>
                </div>
                <div className="mt-4 space-y-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Template: <span className="font-medium">{(instance.botId as any)?.name || 'Unknown'}</span>
                    </p>
                    {instance.config?.username && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            User: <span className="font-medium text-gray-900 dark:text-white">{instance.config.username}</span>
                        </p>
                    )}
                    {instance.config?.balance && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Balance: <span className="font-medium text-gray-900 dark:text-white">${instance.config.balance}</span>
                        </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Status: <span className={`font-medium ${isRunning ? 'text-green-600' : 'text-red-600'}`}>{instance.status}</span>
                    </p>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                    <button
                        onClick={toggleStatus}
                        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${isRunning
                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                            : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                            }`}
                    >
                        {isRunning ? 'Stop' : 'Start'}
                    </button>
                    {/* NEW: Edit Button */}
                    <button
                        onClick={onEdit}
                        disabled={isRunning}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                        Edit
                    </button>
                    <button
                        onClick={deleteInstance}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
