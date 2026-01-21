'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
// We need to resolve the promise for params
import { use } from 'react';
import RealTimeMonitor from '@/components/RealTimeMonitor';
import { IBotInstance } from '@/types';

// In Next.js 15+, dynamic route params are Promises.
// We can use React.use() to unwrap them if needed, or just standard async/await in a Server Component.
// Since this is a Client Component (needs hooks), we receive params as a Promise prop in recent versions or just params object in older.
// The user's package.json says next: 16.1.4. In Next 15, params is async.
// However, page props in client components are not promises in 14-. In 15 they are.
// To be safe and compliant with Next 15/16 change:
export default function InstanceMonitorPage({ params }: { params: Promise<{ id: string }> }) {
    // Unwrap params using `use()` hook (React 19 feature, which Next 15 uses)
    const { id } = use(params);

    const { data: session, status } = useSession();
    const router = useRouter();
    const [instance, setInstance] = useState<IBotInstance | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchInstance();
        }
    }, [status, id]);

    const fetchInstance = async () => {
        try {
            const res = await fetch(`/api/bot-instances/${id}`);
            if (res.ok) {
                const data = await res.json();
                setInstance(data);
            } else {
                // If not found or unauthorized
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Failed to fetch instance', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
        if (!confirm('Stop this bot instance?')) return;
        try {
            await fetch(`/api/bot-instances/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'STOPPED' })
            });
            fetchInstance(); // Refresh
        } catch (e) {
            console.error(e);
        }
    };

    if (status === 'loading' || loading) return <div className="p-8 text-center">Loading Monitor...</div>;
    if (!session || !instance) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-10 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white shadow dark:bg-gray-800">
                <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                                {instance.name}
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                ID: {id} | Template: {(instance.botId as any)?.name}
                            </p>
                            <div className="mt-2 flex gap-4 text-sm text-gray-600 dark:text-gray-300">
                                {instance.config?.username && (
                                    <span>User: <strong className="text-gray-900 dark:text-white">{instance.config.username}</strong></span>
                                )}
                                {instance.config?.balance && (
                                    <span>Balance: <strong className="text-gray-900 dark:text-white">${instance.config.balance}</strong></span>
                                )}
                            </div>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                            <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium ${instance.status === 'RUNNING'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>
                                {instance.status}
                            </span>
                            {instance.status === 'RUNNING' && (
                                <button
                                    onClick={handleStop}
                                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                >
                                    Emergency Stop
                                </button>
                            )}
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                <RealTimeMonitor instanceId={id} />
            </main>
        </div>
    );
}
