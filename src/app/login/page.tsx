'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [data, setData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await signIn('credentials', {
            redirect: false,
            email: data.email,
            password: data.password,
        });

        if (result?.error) {
            setError(result.error);
        } else {
            try {
                const res = await fetch('/api/bot-instances');
                if (res.ok) {
                    const instances = await res.json();
                    const hasInstances = Array.isArray(instances) && instances.length > 0;
                    router.push(hasInstances ? '/dashboard' : '/dashboard/our-bots');
                } else {
                    router.push('/dashboard');
                }
            } catch {
                router.push('/dashboard');
            }
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(165deg,#0b1220_0%,#121c34_48%,#0e1730_100%)] px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 rounded-[1.25rem] border border-[rgba(130,160,220,0.18)] bg-[linear-gradient(180deg,rgba(28,44,76,0.95),rgba(22,35,61,0.98))] p-8 shadow-[0_24px_48px_rgba(8,16,36,0.35)]">
                <div>
                    <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-[#eef3fb]">
                        Sign in to your account
                    </h2>
                    <p className="mt-2 text-center text-sm text-[#93a4c2]">
                        Or{' '}
                        <Link
                            href="/register"
                            className="font-medium text-[#7aa2ff] transition-colors hover:text-[#9bb4ff]"
                        >
                            create a new account
                        </Link>
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="email-address" className="sr-only">
                                Email address
                            </label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                required
                                className="relative block w-full rounded-xl border border-[rgba(130,160,220,0.18)] bg-[rgba(11,18,32,0.55)] px-3 py-2.5 text-[#eef3fb] placeholder:text-[#93a4c2] focus:border-[rgba(91,124,250,0.65)] focus:outline-none focus:ring-2 focus:ring-[rgba(91,124,250,0.18)] sm:text-sm"
                                placeholder="Email address"
                                value={data.email}
                                onChange={(e) => setData({ ...data, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="relative block w-full rounded-xl border border-[rgba(130,160,220,0.18)] bg-[rgba(11,18,32,0.55)] px-3 py-2.5 text-[#eef3fb] placeholder:text-[#93a4c2] focus:border-[rgba(91,124,250,0.65)] focus:outline-none focus:ring-2 focus:ring-[rgba(91,124,250,0.18)] sm:text-sm"
                                placeholder="Password"
                                value={data.password}
                                onChange={(e) => setData({ ...data, password: e.target.value })}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-[rgba(224,122,122,0.34)] bg-[rgba(224,122,122,0.12)] p-4">
                            <div className="flex">
                                <div className="ml-1">
                                    <h3 className="text-sm font-medium text-[#f0a0a0]">
                                        Login Failed
                                    </h3>
                                    <div className="mt-2 text-sm text-[#f0a0a0]/90]">
                                        <p>{error}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            className="group relative flex w-full justify-center rounded-xl bg-[linear-gradient(180deg,#6b8ff5,#4f74e8)] px-3 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(79,116,232,0.28)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b7cfa]"
                        >
                            Sign in
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
