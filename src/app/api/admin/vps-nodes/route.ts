import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import VpsNode from '@/models/VpsNode';
import { encryptVpsPassword, toPublicVpsNode } from '@/lib/vpsNodes';
import { isValidVpsAddress, VPS_ROLES, type VpsRole } from '@/lib/vpsConfig';

function requireAdmin(session: { user?: { role?: string } } | null) {
  return Boolean(session?.user && session.user.role === 'admin');
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const rows = await VpsNode.find({}).sort({ role: 1, name: 1 }).lean();
    return NextResponse.json({
      nodes: rows.map((r) => ({
        ...toPublicVpsNode(r as never),
        notes: String((r as { notes?: string }).notes ?? ''),
        createdAt: (r as { createdAt?: Date }).createdAt,
        updatedAt: (r as { updatedAt?: Date }).updatedAt,
      })),
    });
  } catch (err) {
    console.error('admin vps-nodes list failed', err);
    return NextResponse.json({ error: 'Failed to list VPS nodes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const role = String(body?.role ?? '').trim().toUpperCase() as VpsRole;
    const address = String(body?.address ?? '').trim();
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    const notes = String(body?.notes ?? '').trim();
    const enabled = body?.enabled === undefined ? true : Boolean(body.enabled);

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!VPS_ROLES.includes(role)) {
      return NextResponse.json({ error: 'role must be BETONLINE or PS3838' }, { status: 400 });
    }
    if (!isValidVpsAddress(address)) {
      return NextResponse.json({ error: 'address must be host or host:port' }, { status: 400 });
    }
    if (!username) return NextResponse.json({ error: 'username is required' }, { status: 400 });
    if (!password) return NextResponse.json({ error: 'password is required' }, { status: 400 });

    await connectDB();
    const passwordSecret = encryptVpsPassword(password);
    const created = await VpsNode.create({
      name,
      role,
      address,
      username,
      passwordSecret,
      enabled,
      notes,
    });

    return NextResponse.json(
      {
        ...toPublicVpsNode(created.toObject() as never),
        notes,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('admin vps-nodes create failed', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'Failed to create VPS node' },
      { status: 500 }
    );
  }
}
