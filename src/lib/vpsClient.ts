/**
 * Client-side HTTP client for one VPS agent.
 *
 * The dashboard connects TO the VPS (inbound API on VPS_AGENT_PORT) and authenticates with the VPS credentials
 * from .env. Credentials never reach the browser: these calls run on the server only.
 */
import type { VpsConnection } from './vpsConfig';

export interface VpsLeg {
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

export interface PrepareResult {
    ok: boolean;
    reason?: string | null;
    odds?: number | null;
}

export interface CommitResult {
    ok: boolean;
    orderId?: string | null;
    odds?: number | null;
    reason?: string | null;
    duplicate?: boolean;
}

export interface VerifyResult {
    found: boolean;
    orderId?: string | null;
}

export interface OtpChallenge {
    challengeId: string;
    clientId: string;
    bookmaker: string;
    createdAt: number;
    status: 'waiting' | 'resolved' | 'cancelled';
}

export interface OtpPendingResult {
    ok: boolean;
    challenges: OtpChallenge[];
}

export interface OtpSubmitResult {
    ok: boolean;
    challengeId?: string;
    reason?: string;
}

export class VpsError extends Error {
    constructor(message: string, public status: number) {
        super(message);
        this.name = 'VpsError';
    }
}

/** Normalises an address that may omit the port (the inbound API port is separate). */
function baseUrl(address: string, defaultPort: number): string {
    const value = String(address ?? '').trim();
    if (!value) throw new VpsError('VPS address is empty', 500);
    const withScheme = /^https?:\/\//i.test(value) ? value : `http://${value}`;
    const url = new URL(withScheme);
    if (!url.port) url.port = String(defaultPort);
    return url.toString().replace(/\/+$/, '');
}

export function createVpsClient(options: {
    connection: VpsConnection;
    /** Port the VPS inbound API listens on; defaults to 4400. */
    port?: number;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}) {
    const { connection } = options;
    const fetchImpl = options.fetchImpl ?? fetch;
    const timeoutMs = options.timeoutMs ?? 30000;
    const url = baseUrl(connection.address, options.port ?? Number(process.env.VPS_AGENT_PORT ?? 4400));
    const auth = 'Basic ' + Buffer.from(`${connection.username}:${connection.password}`, 'utf8').toString('base64');

    async function call<T>(path: string, body: unknown): Promise<T> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetchImpl(`${url}${path}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: auth },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            const text = await res.text();
            const json = text ? JSON.parse(text) : null;
            if (!res.ok) {
                throw new VpsError(json?.reason ?? json?.error ?? `VPS returned ${res.status}`, res.status);
            }
            return json as T;
        } finally {
            clearTimeout(timer);
        }
    }

    const payload = (executionId: string, clientId: string, leg: VpsLeg, stake: number, extra: Record<string, unknown> = {}) => ({
        executionId,
        clientId,
        leg,
        stake,
        ...extra,
    });

    return {
        address: connection.address,
        async health(): Promise<{ ok: boolean; reason?: string | null }> {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetchImpl(`${url}/agent/health`, {
                    headers: { authorization: auth },
                    signal: controller.signal,
                });
                if (!res.ok) return { ok: false, reason: `VPS returned ${res.status}` };
                const text = await res.text();
                const json = text ? JSON.parse(text) : null;
                return { ok: json?.ok === true };
            } catch (err) {
                return { ok: false, reason: (err as Error)?.message ?? 'VPS unreachable' };
            } finally {
                clearTimeout(timer);
            }
        },
        async prepare(executionId: string, clientId: string, leg: VpsLeg, stake: number, expiresAtUtc?: string): Promise<PrepareResult> {
            return call<PrepareResult>('/agent/prepare', payload(executionId, clientId, leg, stake, { expiresAtUtc }));
        },
        async commit(executionId: string, clientId: string, leg: VpsLeg, stake: number): Promise<CommitResult> {
            return call<CommitResult>('/agent/commit', payload(executionId, clientId, leg, stake));
        },
        async verify(executionId: string, clientId: string, leg: VpsLeg, orderId?: string | null): Promise<VerifyResult> {
            return call<VerifyResult>('/agent/verify', payload(executionId, clientId, leg, 0, { orderId }));
        },
        async listOtpPending(filters: { clientId?: string; bookmaker?: string } = {}): Promise<OtpPendingResult> {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const qs = new URLSearchParams();
                if (filters.clientId) qs.set('clientId', filters.clientId);
                if (filters.bookmaker) qs.set('bookmaker', filters.bookmaker);
                const suffix = qs.toString() ? `?${qs}` : '';
                const res = await fetchImpl(`${url}/agent/otp/pending${suffix}`, {
                    headers: { authorization: auth },
                    signal: controller.signal,
                });
                const text = await res.text();
                const json = text ? JSON.parse(text) : null;
                if (!res.ok) {
                    throw new VpsError(json?.reason ?? json?.error ?? `VPS returned ${res.status}`, res.status);
                }
                return {
                    ok: json?.ok === true,
                    challenges: Array.isArray(json?.challenges) ? json.challenges : [],
                };
            } finally {
                clearTimeout(timer);
            }
        },
        async submitOtp(challengeId: string, code: string): Promise<OtpSubmitResult> {
            return call<OtpSubmitResult>('/agent/otp', { challengeId, code });
        },
        async cancelOtp(challengeId: string): Promise<{ ok: boolean; challengeId: string }> {
            return call<{ ok: boolean; challengeId: string }>('/agent/otp/cancel', { challengeId });
        },
    };
}

export type VpsClient = ReturnType<typeof createVpsClient>;
