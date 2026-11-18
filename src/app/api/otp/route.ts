import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createVpsClient, VpsError } from '@/lib/vpsClient';
import { VPS_ROLES, type VpsRole } from '@/lib/vpsConfig';
import { resolveClientVpsConnections } from '@/lib/vpsNodes';

const VPS_TIMEOUT_MS = Number(process.env.VPS_TIMEOUT_MS ?? 15000);

/**
 * One-shot relay: user typed authenticator digits in the dashboard.
 * Forwards them to the VPS that owns the waiting Chrome verification modal.
 * Digits are not stored.
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = (session.user as { id?: string }).id ?? '';
    if (!clientId) {
        return NextResponse.json({ error: 'Session has no user id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const challengeId = String(body?.challengeId ?? '').trim();
    const code = String(body?.code ?? '').trim();
    const roleHint = String(body?.role ?? body?.bookmaker ?? '').trim().toUpperCase();

    if (!challengeId) {
        return NextResponse.json({ error: 'challengeId is required' }, { status: 400 });
    }
    if (!/^\d{4,10}$/.test(code)) {
        return NextResponse.json({ error: 'code must be 4-10 digits' }, { status: 400 });
    }

    let connections;
    try {
        connections = await resolveClientVpsConnections(clientId);
    } catch (err) {
        return NextResponse.json({ error: (err as Error)?.message ?? 'VPS configuration is invalid' }, { status: 500 });
    }

    const roles: VpsRole[] =
        roleHint && (VPS_ROLES as string[]).includes(roleHint)
            ? [roleHint as VpsRole]
            : [...VPS_ROLES];

    let lastError = 'no VPS accepted the code';
    for (const role of roles) {
        const connection = connections[role];
        if (!connection) continue;
        try {
            const vps = createVpsClient({ connection, timeoutMs: VPS_TIMEOUT_MS });
            const result = await vps.submitOtp(challengeId, code);
            if (result.ok) {
                return NextResponse.json({ ok: true, challengeId, role });
            }
            lastError = result.reason ?? lastError;
        } catch (err) {
            if (err instanceof VpsError && err.status === 409) {
                lastError = err.message;
                continue;
            }
            lastError = (err as Error)?.message ?? lastError;
        }
    }

    return NextResponse.json({ ok: false, error: lastError }, { status: 409 });
}
