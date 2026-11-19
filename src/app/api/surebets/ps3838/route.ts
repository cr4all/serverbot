import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createVpsClient } from '@/lib/vpsClient';
import { resolveClientVpsConnections } from '@/lib/vpsNodes';

const VPS_TIMEOUT_MS = Number(process.env.VPS_TIMEOUT_MS ?? 120000);

/** Shows whether this client can reach the PS3838 VPS. No secret is returned. */
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
  const connection = connections.PS3838 ?? null;

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
