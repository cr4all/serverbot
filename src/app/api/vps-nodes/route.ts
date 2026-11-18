import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listEnabledVpsNodes } from '@/lib/vpsNodes';
import type { VpsRole } from '@/lib/vpsConfig';
import { VPS_ROLES } from '@/lib/vpsConfig';

/** List enabled VPS agents for bot-create dropdowns (no passwords). */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const roleRaw = String(url.searchParams.get('role') ?? '')
    .trim()
    .toUpperCase();
  const role = VPS_ROLES.includes(roleRaw as VpsRole) ? (roleRaw as VpsRole) : undefined;

  try {
    const nodes = await listEnabledVpsNodes(role);
    return NextResponse.json({ nodes });
  } catch (err) {
    console.error('vps-nodes list failed', err);
    return NextResponse.json({ error: (err as Error)?.message ?? 'Failed to list VPS nodes' }, { status: 500 });
  }
}
