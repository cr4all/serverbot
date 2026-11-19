import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import { createVpsClient } from '@/lib/vpsClient';
import { resolveClientVpsConnections } from '@/lib/vpsNodes';
import {
  appendWarmLog,
  canAttemptLogin,
  ensureDeskWarm,
  maxLoginAttempts,
  patchLeg,
  resetDeskWarm,
  setWarming,
  type BookmakerKey,
} from '@/lib/deskWarmState';

const VPS_TIMEOUT_MS = Number(process.env.VPS_TIMEOUT_MS ?? 180000);

async function assertDeskOwned(userId: string, deskId: string): Promise<boolean> {
  await connectDB();
  const count = await BotInstance.countDocuments({
    userId,
    'config.deskId': deskId,
  });
  return count > 0;
}

async function warmOne(
  snap: ReturnType<typeof ensureDeskWarm>,
  bookmaker: BookmakerKey,
  clientId: string,
  connection: { address: string; username: string; password: string } | null | undefined
) {
  if (!connection) {
    patchLeg(snap, bookmaker, {
      reachable: false,
      loggedIn: false,
      lastError: `${bookmaker} VPS is not configured`,
    });
    appendWarmLog(snap, 'danger', `${bookmaker}: VPS not configured`);
    return;
  }

  const vps = createVpsClient({ connection, timeoutMs: VPS_TIMEOUT_MS });
  const health = await vps.health();
  if (!health.ok) {
    patchLeg(snap, bookmaker, {
      reachable: false,
      loggedIn: false,
      lastError: health.reason ?? 'unreachable',
    });
    appendWarmLog(snap, 'danger', `${bookmaker}: unreachable (${health.reason ?? 'unknown'})`);
    return;
  }

  patchLeg(snap, bookmaker, { reachable: true, lastError: null });

  const leg = bookmaker === 'BETONLINE' ? snap.bol : snap.ps;
  if (leg.loggedIn) {
    appendWarmLog(snap, 'success', `${bookmaker}: already logged in`);
    return;
  }

  if (!canAttemptLogin(leg)) {
    patchLeg(snap, bookmaker, {
      lastError: `login blocked after ${maxLoginAttempts()} attempts — Stop then Run to retry`,
    });
    appendWarmLog(
      snap,
      'danger',
      `${bookmaker}: login blocked after ${maxLoginAttempts()} attempts`
    );
    return;
  }

  patchLeg(snap, bookmaker, { bumpAttempt: true });
  appendWarmLog(
    snap,
    'info',
    `${bookmaker}: ensuring session (attempt ${leg.loginAttempts}/${maxLoginAttempts()})`
  );

  try {
    const result = await vps.ensureSession(clientId, bookmaker);
    if (result.ok && result.loggedIn) {
      patchLeg(snap, bookmaker, {
        loggedIn: true,
        lastError: null,
      });
      appendWarmLog(
        snap,
        'success',
        `${bookmaker}: ${result.reused ? 'session reused' : 'logged in'}`
      );
      return;
    }
    const reason = result.reason ?? 'session not ready';
    patchLeg(snap, bookmaker, { loggedIn: false, lastError: reason });
    appendWarmLog(snap, 'warning', `${bookmaker}: ${reason}`);
  } catch (err) {
    const reason = (err as Error)?.message ?? 'session ensure failed';
    patchLeg(snap, bookmaker, { loggedIn: false, lastError: reason });
    appendWarmLog(snap, 'danger', `${bookmaker}: ${reason}`);
  }
}

/**
 * After Run: health-check both VPS and ensure sessions (reuse first, login if needed, ≤3 attempts).
 * Body optional: { reset?: boolean } — reset clears attempt counters (used on fresh Run).
 */
export async function POST(
  request: Request,
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

  const body = await request.json().catch(() => ({}));
  const snap = body?.reset === true ? resetDeskWarm(clientId, deskId) : ensureDeskWarm(clientId, deskId);

  if (snap.warming) {
    return NextResponse.json({ ...snap, busy: true });
  }

  setWarming(snap, true);
  try {
    let connections;
    try {
      connections = await resolveClientVpsConnections(clientId);
    } catch (err) {
      appendWarmLog(snap, 'danger', (err as Error)?.message ?? 'VPS configuration invalid');
      return NextResponse.json({ error: (err as Error)?.message ?? 'VPS configuration invalid' }, { status: 500 });
    }

    await Promise.all([
      warmOne(snap, 'BETONLINE', clientId, connections.BETONLINE ?? null),
      warmOne(snap, 'PS3838', clientId, connections.PS3838 ?? null),
    ]);

    return NextResponse.json(snap);
  } finally {
    setWarming(snap, false);
  }
}
