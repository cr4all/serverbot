import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { HubError, listOpenTips, isHubConfigured } from '@/lib/hubClient';
import { createVpsClient } from '@/lib/vpsClient';
import { executeTip } from '@/lib/executionService';
import { readVpsConnection } from '@/lib/vpsConfig';
import connectDB from '@/lib/db';
import ClientExecution from '@/models/ClientExecution';
import type { ExecutionRecord } from '@/lib/executionService';

/** Returns open tips plus this client's recent executions. The hub token stays on the server. */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isHubConfigured()) {
        return NextResponse.json(
            { error: 'Hub is not configured (HUB_URL / HUB_CLIENT_TOKEN)', configured: false, tips: [], executions: [] },
            { status: 503 }
        );
    }

    const clientId = (session.user as { id?: string }).id ?? '';
    try {
        const tips = await listOpenTips(50);
        let executions: unknown[] = [];
        if (clientId) {
            await connectDB();
            executions = await ClientExecution.find({ clientId }).sort({ createdAt: -1 }).limit(50).lean();
        }
        return NextResponse.json({ configured: true, tips, executions });
    } catch (err) {
        const status = err instanceof HubError ? err.status : 502;
        return NextResponse.json({ error: (err as Error)?.message ?? 'hub request failed', configured: true, tips: [], executions: [] }, { status });
    }
}

/** Runs a tip for the signed-in client. Stake defaults to 1 when the body omits it. */
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

    // The client runs the bet on its own VPSs; the hub only supplied the tip.
    let tip;
    try {
        const tips = await listOpenTips(200);
        tip = tips.find((t) => t.tipId === tipId);
    } catch (err) {
        const status = err instanceof HubError ? err.status : 502;
        return NextResponse.json({ error: (err as Error)?.message ?? 'hub request failed' }, { status });
    }

    if (!tip) {
        return NextResponse.json({ error: 'tip not found or expired' }, { status: 404 });
    }

    let connections;
    try {
        connections = {
            BETONLINE: readVpsConnection('BETONLINE'),
            PS3838: readVpsConnection('PS3838'),
        };
    } catch (err) {
        return NextResponse.json({ error: (err as Error)?.message ?? 'VPS configuration is invalid' }, { status: 500 });
    }

    const vps: Record<string, ReturnType<typeof createVpsClient>> = {};
    if (connections.BETONLINE) vps.BETONLINE = createVpsClient({ connection: connections.BETONLINE });
    if (connections.PS3838) vps.PS3838 = createVpsClient({ connection: connections.PS3838 });

    try {
        const record = await executeTip({
            tipId: tip.tipId,
            clientId,
            stake,
            legs: tip.legs.map((leg) => ({
                bookmaker: String(leg.bookmaker).toUpperCase(),
                eventName: leg.eventName,
                sport: leg.sport,
                marketType: leg.marketType,
                period: leg.period,
                line: leg.line,
                selection: leg.selection,
                odds: leg.odds,
                stakeRatio: leg.stakeRatio,
            })),
            deps: {
                vps: vps as never,
                save: async (record: ExecutionRecord) => {
                    await connectDB();
                    await ClientExecution.updateOne(
                        { executionId: record.executionId },
                        { $set: { ...record, clientId } },
                        { upsert: true }
                    );
                },
            },
        });

        const started = record.state !== 'ABORTED';
        return NextResponse.json(record, { status: started ? 202 : 409 });
    } catch (err) {
        return NextResponse.json({ error: (err as Error)?.message ?? 'execution failed' }, { status: 502 });
    }
}
