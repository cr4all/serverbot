import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { HubError, listOpenTips, isHubConfigured } from '@/lib/hubClient';
import connectDB from '@/lib/db';
import ClientExecution from '@/models/ClientExecution';
import { redactRebuildForClient } from '@/lib/nearbySurebet';
import { runSurebetTipForClient } from '@/lib/runSurebetTip';

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
      const rows = await ClientExecution.find({ clientId }).sort({ createdAt: -1 }).limit(50).lean();
      executions = rows.map((row) => redactRebuildForClient(row as Record<string, unknown>));
    }
    return NextResponse.json({ configured: true, tips, executions });
  } catch (err) {
    const status = err instanceof HubError ? err.status : 502;
    return NextResponse.json(
      {
        error: (err as Error)?.message ?? 'hub request failed',
        configured: true,
        tips: [],
        executions: [],
      },
      { status }
    );
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
  const stake =
    body?.stake === undefined || body?.stake === null || body?.stake === '' ? 1 : Number(body.stake);

  const result = await runSurebetTipForClient({ tipId, clientId, stake });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.missing ? { missing: result.missing } : {}) },
      { status: result.status }
    );
  }
  return NextResponse.json(result.record, { status: result.status });
}
