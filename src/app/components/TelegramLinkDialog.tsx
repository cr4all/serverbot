"use client";

import { useEffect, useState } from "react";

type LinkState = { linked: boolean; botUsername: string | null };

export default function TelegramLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [state, setState] = useState<LinkState | null>(null);
    const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setCode(null);
        fetch("/api/telegram/link-code")
            .then((r) => r.json())
            .then((d) => setState({ linked: Boolean(d?.linked), botUsername: d?.botUsername ?? null }))
            .catch(() => setState({ linked: false, botUsername: null }));
    }, [open]);

    if (!open) return null;

    const issueCode = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/telegram/link-code", { method: "POST" });
            const data = await res.json();
            if (!res.ok) return alert(data?.error || "Failed to issue code");
            setCode({ code: data.code, expiresAt: data.expiresAt });
            setState((s) => ({ linked: s?.linked ?? false, botUsername: data.botUsername ?? s?.botUsername ?? null }));
        } catch (e) {
            console.error(e);
            alert("Error issuing code");
        } finally {
            setLoading(false);
        }
    };

    const unlink = async () => {
        if (!confirm("Telegram 연결을 해제할까요?")) return;
        setLoading(true);
        try {
            const res = await fetch("/api/telegram/link-code", { method: "DELETE" });
            if (!res.ok) return alert("Failed to unlink");
            setState((s) => ({ linked: false, botUsername: s?.botUsername ?? null }));
            setCode(null);
        } finally {
            setLoading(false);
        }
    };

    const botLink = state?.botUsername ? `https://t.me/${state.botUsername}` : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
                <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Telegram 연결</h3>

                <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                    상태: {state == null ? "확인 중..." : state.linked ? "연결됨" : "연결 안 됨"}
                </p>

                {code ? (
                    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-gray-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-gray-100">
                        <div>
                            Telegram 봇{botLink ? (
                                <> (<a href={botLink} target="_blank" rel="noreferrer" className="text-blue-600 underline dark:text-blue-400">@{state?.botUsername}</a>)</>
                            ) : null}에 다음 명령을 보내세요.
                        </div>
                        <div className="mt-2 select-all font-mono text-lg font-bold">/link {code.code}</div>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            유효 시간: {new Date(code.expiresAt).toLocaleTimeString()}까지 (10분)
                        </div>
                    </div>
                ) : null}

                <div className="mt-6 flex justify-end gap-3">
                    {state?.linked && (
                        <button
                            type="button"
                            onClick={unlink}
                            disabled={loading}
                            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                            연결 해제
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        닫기
                    </button>
                    <button
                        type="button"
                        onClick={issueCode}
                        disabled={loading}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? "..." : state?.linked ? "다른 채팅으로 다시 연결" : "연결 코드 발급"}
                    </button>
                </div>
            </div>
        </div>
    );
}
