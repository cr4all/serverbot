import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isHubConfigured, listOpenTips } from '@/lib/hubClient';
import { createVpsClient } from '@/lib/vpsClient';
import { resolveClientVpsConnections } from '@/lib/vpsNodes';

const VPS_TIMEOUT_MS = Number(process.env.VPS_TIMEOUT_MS ?? 120000);
const ROLES = ['BETONLINE', 'PS3838'] as const;

/**
 * Prepare-only check for both legs. Never commits.
 * Used to verify event/odds/session on both VPSs before a real Run.
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
    const tipId = typeof body?.tipId === 'string' ? body.tipId.trim() : '';
    const stake = body?.stake === undefined || body?.stake === null || body?.stake === '' ? 1 : Number(body.stake);
    if (!tipId) {
        return NextResponse.json({ error: 'tipId is required' }, { status: 400 });
    }
    if (!Number.isFinite(stake) || stake <= 0) {
        return NextResponse.json({ error: 'stake must be a positive number' }, { status: 400 });
    }

    if (!isHubConfigured()) {
        return NextResponse.json({ error: 'Hub is not configured' }, { status: 503 });
    }

    let tip;
    try {
        const tips = await listOpenTips(200);
        tip = tips.find((entry) => entry.tipId === tipId);
    } catch (err) {
        return NextResponse.json({ error: (err as Error)?.message ?? 'hub request failed' }, { status: 502 });
    }
    if (!tip) {
        return NextResponse.json({ error: 'tip not found or expired' }, { status: 404 });
    }

    let connections;
    try {
        connections = await resolveClientVpsConnections(clientId);
    } catch (err) {
        return NextResponse.json({ error: (err as Error)?.message ?? 'VPS configuration is invalid' }, { status: 500 });
    }

    const missingVps = ROLES.filter((role) => !connections[role]);
    if (missingVps.length > 0) {
        return NextResponse.json(
            {
                error: `VPS not configured for: ${missingVps.join(', ')}. Select a VPS when creating the bot.`,
                missing: missingVps,
            },
            { status: 409 }
        );
    }

    // Bookmaker logins may live on the VPS env; dashboard-stored accounts are optional.

    const executionId = `prep_${randomUUID()}`;
    const legs = await Promise.all(
        ROLES.map(async (role) => {
            const tipLeg = tip.legs.find((entry) => String(entry.bookmaker).toUpperCase() === role);
            if (!tipLeg) {
                return { bookmaker: role, ok: false, reason: 'tip has no leg for this bookmaker', odds: null, stake: null };
            }
            const legStake = Number((stake * Number(tipLeg.stakeRatio)).toFixed(2));
            const vps = createVpsClient({ connection: connections[role]!, timeoutMs: VPS_TIMEOUT_MS });
            try {
                const result = await vps.prepare(
                    executionId,
                    clientId,
                    {
                        bookmaker: role,
                        eventName: tipLeg.eventName,
                        sport: tipLeg.sport,
                        marketType: tipLeg.marketType,
                        period: tipLeg.period,
                        line: tipLeg.line === null || tipLeg.line === undefined ? null : Number(tipLeg.line),
                        selection: tipLeg.selection,
                        odds: Number(tipLeg.odds),
                        stakeRatio: Number(tipLeg.stakeRatio),
                    },
                    legStake,
                    tip.expiresAtUtc
                );
                return {
                    bookmaker: role,
                    ok: result?.ok === true,
                    odds: result?.odds ?? null,
                    reason: result?.reason ?? null,
                    stake: legStake,
                };
            } catch (err) {
                return {
                    bookmaker: role,
                    ok: false,
                    odds: null,
                    reason: (err as Error)?.message ?? 'prepare failed',
                    stake: legStake,
                };
            }
        })
    );

    const bothReady = legs.every((leg) => leg.ok === true);
    return NextResponse.json({
        ok: bothReady,
        executionId,
        tipId,
        stake,
        committed: false,
        legs,
    });
}
