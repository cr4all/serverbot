export function mainbotBaseUrl(): string {
    return (process.env.NEXT_PUBLIC_BOTMANAGER_URL || 'http://localhost:4000').replace(/\/$/, '');
}

/** Headers for mainbot internal API (`/bot/*`). Token is optional until MAINBOT_INTERNAL_TOKEN is set. */
export function mainbotHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...(extra ?? {}) };
    const token = process.env.MAINBOT_INTERNAL_TOKEN;
    if (token) headers['X-Internal-Token'] = token;
    return headers;
}

export function mainbotFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const p = path.startsWith('/') ? path : `/${path}`;
    return fetch(`${mainbotBaseUrl()}${p}`, {
        ...init,
        headers: { ...mainbotHeaders(), ...((init.headers as Record<string, string> | undefined) ?? {}) },
    });
}
