import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createVpsClient } from '@/lib/vpsClient';
import { VPS_ROLES, type VpsRole } from '@/lib/vpsConfig';
import { resolveClientVpsConnections } from '@/lib/vpsNodes';

const VPS_TIMEOUT_MS = Number(process.env.VPS_TIMEOUT_MS ?? 15000);

/** Cancels a waiting OTP challenge on the VPS (login will fail closed). */
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
    const roleHint = String(body?.role ?? body?.bookmaker ?? '').trim().toUpperCase();
    if (!challengeId) {
        return NextResponse.json({ error: 'challengeId is required' }, { status: 400 });
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

    for (const role of roles) {
        const connection = connections[role];
        if (!connection) continue;
        try {
            const vps = createVpsClient({ connection, timeoutMs: VPS_TIMEOUT_MS });
            const result = await vps.cancelOtp(challengeId);
            if (result.ok) {
                return NextResponse.json({ ok: true, challengeId, role });
            }
        } catch {
            // try next role
        }
    }

    return NextResponse.json({ ok: false, error: 'challenge not found on any VPS' }, { status: 404 });
}
