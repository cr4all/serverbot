import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createVpsClient, type OtpChallenge } from '@/lib/vpsClient';
import { VPS_ROLES, type VpsRole } from '@/lib/vpsConfig';
import { resolveClientVpsConnections } from '@/lib/vpsNodes';

const VPS_TIMEOUT_MS = Number(process.env.VPS_TIMEOUT_MS ?? 15000);

/**
 * Poll all configured VPS agents for in-flight authenticator challenges.
 * Credentials stay on the server; the browser only sees challenge metadata.
 */
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionClientId = (session.user as { id?: string }).id ?? '';
    if (!sessionClientId) {
        return NextResponse.json({ error: 'Session has no user id' }, { status: 400 });
    }

    const url = new URL(request.url);
    const bookmaker = String(url.searchParams.get('bookmaker') ?? '').trim().toUpperCase();
    // Optional filter only when the caller asks; VPS Chrome clientIds often differ from dashboard user ids.
    const clientId = String(url.searchParams.get('clientId') ?? '').trim();

    const roles: VpsRole[] = bookmaker && (VPS_ROLES as string[]).includes(bookmaker)
        ? [bookmaker as VpsRole]
        : [...VPS_ROLES];

    let connections;
    try {
        connections = await resolveClientVpsConnections(sessionClientId);
    } catch (err) {
        return NextResponse.json({ error: (err as Error)?.message ?? 'VPS configuration is invalid' }, { status: 500 });
    }

    const byId = new Map<string, OtpChallenge & { role: VpsRole }>();
    const errors: Array<{ role: VpsRole; reason: string }> = [];

    await Promise.all(
        roles.map(async (role) => {
            const connection = connections[role];
            if (!connection) return;
            try {
                const vps = createVpsClient({ connection, timeoutMs: VPS_TIMEOUT_MS });
                const result = await vps.listOtpPending({
                    clientId: clientId || undefined,
                    bookmaker: bookmaker || undefined,
                });
                for (const challenge of result.challenges) {
                    if (!byId.has(challenge.challengeId)) {
                        byId.set(challenge.challengeId, { ...challenge, role });
                    }
                }
            } catch (err) {
                errors.push({ role, reason: (err as Error)?.message ?? 'unreachable' });
            }
        })
    );

    return NextResponse.json({
        ok: true,
        challenges: [...byId.values()],
        errors: errors.length ? errors : undefined,
    });
}
