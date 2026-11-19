import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import { createVpsClient } from '@/lib/vpsClient';
import { resolveClientVpsConnections } from '@/lib/vpsNodes';
import { ensureDeskWarm, patchLeg, type BookmakerKey } from '@/lib/deskWarmState';

const VPS_TIMEOUT_MS = Number(process.env.VPS_TIMEOUT_MS ?? 15000);

async function assertDeskOwned(userId: string, deskId: string): Promise<boolean> {
  await connectDB();
  const count = await BotInstance.countDocuments({
    userId,
    'config.deskId': deskId,
  });
  return count > 0;
}

async function refreshReachable(
  snap: ReturnType<typeof ensureDeskWarm>,
  bookmaker: BookmakerKey,
  connection: { address: string; username: string; password: string } | null | undefined
) {
  if (!connection) {
    patchLeg(snap, bookmaker, {
      reachable: false,
      loggedIn: false,
      lastError: `${bookmaker} VPS is not configured`,
    });
    return;
  }
  const vps = createVpsClient({ connection, timeoutMs: VPS_TIMEOUT_MS });
  const health = await vps.health();
  const prev = bookmaker === 'BETONLINE' ? snap.bol : snap.ps;
  patchLeg(snap, bookmaker, {
    reachable: health.ok,
    lastError: health.ok ? prev.lastError : health.reason ?? 'unreachable',
  });
}

/** Poll warm state + light health refresh for Board / Run lock UI. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deskId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = (session.user as { id?: string }).id ?? '';
  if (!clientId) {
    return NextResponse.json({ error: 'Session has no user id' }, { status: 400 });
  }

  const { deskId: rawDeskId } = await params;
  const deskId = String(rawDeskId ?? '').trim();
  if (!deskId) {
    return NextResponse.json({ error: 'deskId is required' }, { status: 400 });
  }

  if (!(await assertDeskOwned(clientId, deskId))) {
    return NextResponse.json({ error: 'Surebet desk not found' }, { status: 404 });
  }

  const snap = ensureDeskWarm(clientId, deskId);

  try {
    const connections = await resolveClientVpsConnections(clientId);
    await Promise.all([
      refreshReachable(snap, 'BETONLINE', connections.BETONLINE ?? null),
      refreshReachable(snap, 'PS3838', connections.PS3838 ?? null),
    ]);
  } catch {
    // Keep last known warm snapshot if VPS config blows up mid-poll.
  }

  return NextResponse.json(snap);
}
