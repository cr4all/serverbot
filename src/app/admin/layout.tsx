'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated' && (session?.user as any)?.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [status, session, router]);

    if (status === 'loading') {
        return <div className="flex min-h-screen items-center justify-center">Loading Admin...</div>;
    }

    if (!session || (session.user as any).role !== 'admin') {
        return null;
    }

    const navItems = [
        { name: 'Overview', href: '/admin' },
        { name: 'Users', href: '/admin/users' },
        { name: 'Bot Templates', href: '/admin/bots' },
        { name: 'All Instances', href: '/admin/instances' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 justify-between">
                        <div className="flex w-full justify-between">
                            <div className="flex items-center gap-4">
                                <Link href="/" className="text-xl font-bold text-gray-800 dark:text-white">
                                    ServerBot Admin
                                </Link>
                                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                    {navItems.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${pathname === item.href
                                                ? 'border-blue-500 text-gray-900 dark:text-white'
                                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                                }`}
                                        >
                                            {item.name}
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                >
                                    Sign Out
                                </button>
                                <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                                    Exit Admin
                                </Link>
                                <div className="flex items-center sm:hidden">
                                    <button
                                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                                        className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:hover:bg-gray-800"
                                    >
                                        <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            {isMenuOpen ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                            )}
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {isMenuOpen && (
                    <div className="sm:hidden">
                        <div className="space-y-1 pb-3 pt-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`block border-l-4 py-2 pl-3 pr-4 text-base font-medium ${pathname === item.href
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    {item.name}
                                </Link>
                            ))}
                            <button
                                onClick={() => signOut({ callbackUrl: '/login' })}
                                className="block w-full text-left border-l-4 border-transparent py-2 pl-3 pr-4 text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            <main className="py-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
