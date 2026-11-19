import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isHubConfigured, listOpenTips } from '@/lib/hubClient';
import { createVpsClient } from '@/lib/vpsClient';
import { resolveClientVpsConnections } from '@/lib/vpsNodes';

const VPS_TIMEOUT_MS = Number(process.env.VPS_TIMEOUT_MS ?? 120000);

/** Shows whether this client can reach the BetOnline VPS and has a stored account. No secret is returned. */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = (session.user as { id?: string }).id ?? '';
    let connections;
    try {
        connections = await resolveClientVpsConnections(clientId);
    } catch (err) {
        return NextResponse.json({ error: (err as Error)?.message ?? 'VPS configuration is invalid' }, { status: 500 });
    }
    const connection = connections.BETONLINE ?? null;

    if (!connection) {
        return NextResponse.json({ configured: false, accountReady: false, reachable: false });
    }

  const vps = createVpsClient({ connection, timeoutMs: VPS_TIMEOUT_MS });
  const health = await vps.health();
  // Reachability ≠ logged-in. Session truth comes from desk warm /session/ensure.
  return NextResponse.json({
    configured: true,
    accountReady: false,
    reachable: health.ok,
    reason: health.ok ? 'Reachable — session confirmed by desk warm' : health.reason ?? null,
  });
}

/**
 * Read-only BetOnline leg check: asks the VPS to find the event and verify the odds. Nothing is committed.
 * The stake is only used for the site's minimum/maximum check inside prepare.
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

    const leg = tip.legs.find((entry) => String(entry.bookmaker).toUpperCase() === 'BETONLINE');
    if (!leg) {
        return NextResponse.json({ error: 'tip has no BETONLINE leg' }, { status: 409 });
    }

    let connections;
    try {
        connections = await resolveClientVpsConnections(clientId);
    } catch (err) {
        return NextResponse.json({ error: (err as Error)?.message ?? 'VPS configuration is invalid' }, { status: 500 });
    }
    const connection = connections.BETONLINE ?? null;
    if (!connection) {
        return NextResponse.json(
            { error: 'BETONLINE VPS is not configured. Select a VPS when creating the bot.' },
            { status: 409 }
        );
    }

    const vps = createVpsClient({ connection, timeoutMs: VPS_TIMEOUT_MS });
    const legStake = Number((stake * Number(leg.stakeRatio)).toFixed(2));
    const executionId = `bo_prepare_${randomUUID()}`;

    try {
        const result = await vps.prepare(
            executionId,
            clientId,
            {
                bookmaker: String(leg.bookmaker).toUpperCase(),
                eventName: leg.eventName,
                sport: leg.sport,
                marketType: leg.marketType,
                period: leg.period,
                line: leg.line === null || leg.line === undefined ? null : Number(leg.line),
                selection: leg.selection,
                odds: Number(leg.odds),
                stakeRatio: Number(leg.stakeRatio),
            },
            legStake,
            tip.expiresAtUtc
        );

        return NextResponse.json({
            ok: result?.ok === true,
            odds: result?.odds ?? null,
            reason: result?.reason ?? null,
            executionId,
            eventName: leg.eventName,
            stake: legStake,
        });
    } catch (err) {
        return NextResponse.json({ error: (err as Error)?.message ?? 'BetOnline prepare failed' }, { status: 502 });
    }
}
