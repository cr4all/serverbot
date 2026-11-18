import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import VpsNode from '@/models/VpsNode';
import BotInstance from '@/models/BotInstance';
import { encryptVpsPassword, toPublicVpsNode } from '@/lib/vpsNodes';
import { isValidVpsAddress, VPS_ROLES, type VpsRole } from '@/lib/vpsConfig';

function requireAdmin(session: { user?: { role?: string } } | null) {
  return Boolean(session?.user && session.user.role === 'admin');
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    await connectDB();

    const patch: Record<string, unknown> = {};
    if (body?.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
      patch.name = name;
    }
    if (body?.role !== undefined) {
      const role = String(body.role).trim().toUpperCase() as VpsRole;
      if (!VPS_ROLES.includes(role)) {
        return NextResponse.json({ error: 'role must be BETONLINE or PS3838' }, { status: 400 });
      }
      patch.role = role;
    }
    if (body?.address !== undefined) {
      const address = String(body.address).trim();
      if (!isValidVpsAddress(address)) {
        return NextResponse.json({ error: 'address must be host or host:port' }, { status: 400 });
      }
      patch.address = address;
    }
    if (body?.username !== undefined) {
      const username = String(body.username).trim();
      if (!username) return NextResponse.json({ error: 'username cannot be empty' }, { status: 400 });
      patch.username = username;
    }
    if (body?.password !== undefined && String(body.password).length > 0) {
      patch.passwordSecret = encryptVpsPassword(String(body.password));
    }
    if (body?.enabled !== undefined) {
      patch.enabled = Boolean(body.enabled);
    }
    if (body?.notes !== undefined) {
      patch.notes = String(body.notes ?? '');
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await VpsNode.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!updated) return NextResponse.json({ error: 'VPS not found' }, { status: 404 });

    return NextResponse.json({
      ...toPublicVpsNode(updated as never),
      notes: String((updated as { notes?: string }).notes ?? ''),
    });
  } catch (err) {
    console.error('admin vps-nodes patch failed', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'Update failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session as { user?: { role?: string } } | null)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    await connectDB();
    const inUse = await BotInstance.countDocuments({ vpsId: id });
    if (inUse > 0) {
      return NextResponse.json(
        { error: `VPS is assigned to ${inUse} bot instance(s)`, code: 'VPS_IN_USE', count: inUse },
        { status: 409 }
      );
    }

    const deleted = await VpsNode.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: 'VPS not found' }, { status: 404 });
    return NextResponse.json({ message: 'VPS deleted' });
  } catch (err) {
    console.error('admin vps-nodes delete failed', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
