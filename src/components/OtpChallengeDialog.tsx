'use client';

import { useCallback, useEffect, useId, useState } from 'react';

type OtpChallenge = {
    challengeId: string;
    clientId: string;
    bookmaker: string;
    createdAt: number;
    status: string;
    role?: string;
};

/**
 * Polls /api/otp/pending while the dashboard is open.
 * When a VPS login is blocked on authenticator verification, prompts for a one-shot code
 * and relays it — digits are not stored.
 */
export default function OtpChallengeDialog() {
    const titleId = useId();
    const inputId = useId();
    const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const poll = useCallback(async () => {
        try {
            const res = await fetch('/api/otp/pending', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            const next = (Array.isArray(data?.challenges) ? data.challenges[0] : null) as OtpChallenge | null;
            setChallenge((prev) => {
                if (!next) {
                    if (prev) {
                        setCode('');
                        setError(null);
                    }
                    return null;
                }
                if (prev?.challengeId === next.challengeId) return prev;
                setCode('');
                setError(null);
                return next;
            });
        } catch {
            // transient network — keep previous challenge if any
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const tick = async () => {
            if (!cancelled) await poll();
        };
        tick();
        const timer = setInterval(tick, 2500);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [poll]);

    useEffect(() => {
        if (!challenge) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [challenge]);

    if (!challenge) return null;

    const bookmaker = challenge.bookmaker || challenge.role || 'bookmaker';

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const digits = code.trim();
        if (!/^\d{4,10}$/.test(digits)) {
            setError('Enter the 4–10 digit code from your authenticator app');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const res = await fetch('/api/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengeId: challenge.challengeId,
                    code: digits,
                    role: challenge.role || challenge.bookmaker,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.ok !== true) {
                setError(data?.error || 'Could not submit code');
                return;
            }
            setChallenge(null);
            setCode('');
        } catch {
            setError('Network error while submitting code');
        } finally {
            setBusy(false);
        }
    };

    const cancel = async () => {
        setBusy(true);
        try {
            await fetch('/api/otp/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengeId: challenge.challengeId,
                    role: challenge.role || challenge.bookmaker,
                }),
            });
        } catch {
            // ignore
        } finally {
            setBusy(false);
            setChallenge(null);
            setCode('');
        }
    };

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
                <div className="h-1.5 w-full bg-amber-500" aria-hidden />
                <form onSubmit={submit} className="p-6">
                    <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-white">
                        Authenticator code required
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {bookmaker} login on the VPS needs a one-time code from your authenticator app.
                        Enter it here once; it is relayed to the verification modal and not stored.
                    </p>

                    <label htmlFor={inputId} className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Verification code
                    </label>
                    <input
                        id={inputId}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={10}
                        value={code}
                        disabled={busy}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.35em] shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        placeholder="••••••"
                    />

                    {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

                    <div className="mt-6 flex justify-end gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={cancel}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                            Cancel login
                        </button>
                        <button
                            type="submit"
                            disabled={busy || code.length < 4}
                            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                        >
                            {busy ? 'Sending…' : 'Submit code'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
