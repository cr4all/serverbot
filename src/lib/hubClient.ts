/**
 * Server-side client for the central hub.
 *
 * The hub token must never reach the browser, so every dashboard call goes through this module on the server
 * (Next route handlers) and the token stays in the server environment.
 *
 * Environment:
 *   HUB_URL           - base address of the hub, for example http://hub:4200
 *   HUB_CLIENT_TOKEN  - the hub's CLIENT_TOKEN
 */

export class HubError extends Error {
    constructor(message: string, public status: number) {
        super(message);
        this.name = 'HubError';
    }
}

function hubConfig(env: NodeJS.ProcessEnv = process.env): { url: string; token: string } {
    const url = String(env.HUB_URL ?? '').trim().replace(/\/+$/, '');
    const token = String(env.HUB_CLIENT_TOKEN ?? '').trim();
    if (!url) throw new HubError('HUB_URL is not configured', 503);
    if (!token) throw new HubError('HUB_CLIENT_TOKEN is not configured', 503);
    return { url, token };
}

async function hubFetch<T>(path: string, init: RequestInit = {}, env: NodeJS.ProcessEnv = process.env): Promise<T> {
    const { url, token } = hubConfig(env);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(`${url}${path}`, {
            ...init,
            headers: {
                'content-type': 'application/json',
                'x-client-token': token,
                ...(init.headers ?? {}),
            },
            signal: controller.signal,
            cache: 'no-store',
        });
        const text = await res.text();
        const json = text ? JSON.parse(text) : null;
        if (!res.ok) {
            throw new HubError(json?.error ?? `hub returned ${res.status}`, res.status);
        }
        return json as T;
    } finally {
        clearTimeout(timer);
    }
}

export interface HubLeg {
    bookmaker: string;
    eventName: string;
    sport: string;
    marketType: string;
    period: string;
    line: number | null;
    selection: string;
    odds: number;
    stakeRatio: number;
}

export interface HubTip {
    tipId: string;
    source: string;
    provider?: string;
    sport: string;
    eventName: string;
    startsAtUtc: string;
    expiresAtUtc: string;
    profitPercent: number;
    status: string;
    legs: HubLeg[];
}

export interface HubExecution {
    executionId: string;
    tipId: string;
    clientId: string;
    totalStake: number;
    state: string;
    note?: string | null;
    createdAt: string;
    legs: Array<{ bookmaker: string; state: string; reason?: string | null; orderId?: string | null }>;
}

/** Open tips. */
export async function listOpenTips(limit = 50): Promise<HubTip[]> {
    const data = await hubFetch<{ tips: HubTip[] }>(`/tips?limit=${limit}`);
    return data?.tips ?? [];
}

/** Executions of one client. */
export async function listExecutions(clientId: string, limit = 50): Promise<HubExecution[]> {
    const data = await hubFetch<{ executions: HubExecution[] }>(
        `/executions?clientId=${encodeURIComponent(clientId)}&limit=${limit}`
    );
    return data?.executions ?? [];
}

/** Asks the hub to run a tip for this client. */
export async function runTip(tipId: string, clientId: string, stake: number): Promise<{ started: boolean; executionId: string; state: string; note?: string | null }> {
    return hubFetch('/executions', {
        method: 'POST',
        body: JSON.stringify({ tipId, clientId, totalStake: stake }),
    });
}

/** True when the hub connection is configured (so the UI can explain what is missing). */
export function isHubConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    try {
        hubConfig(env);
        return true;
    } catch {
        return false;
    }
}
