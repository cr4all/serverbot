import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import Bot from '@/models/Bot';
import BotInstance from '@/models/BotInstance';

type Action = 'restart' | 'clear';

async function startInstances(instanceIds: string[]) {
  if (instanceIds.length === 0) return { matched: 0, started: 0 };
  const BOT_SERVER = process.env.NEXT_PUBLIC_BOTMANAGER_URL || 'http://localhost:4000';
  let started = 0;
  await Promise.all(
    instanceIds.map(async (id) => {
      try {
        const res = await fetch(`${BOT_SERVER}/bot/start/${id}`);
        if (res.ok) started += 1;
      } catch (e) {
        console.error('Failed to start instance from snapshot', id, e);
      }
    }),
  );
  // Best-effort: reflect running state in DB for the requested instances
  await BotInstance.updateMany({ _id: { $in: instanceIds } }, { $set: { status: 'RUNNING' } });
  return { matched: instanceIds.length, started };
}

export async function POST(request: Request, { params }: { params: any }) {
  const session: any = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const _params = await params;
    const id = _params.id;
    const body = await request.json().catch(() => ({}));
    const action: Action = body?.action === 'clear' ? 'clear' : 'restart';

    await connectDB();

    const bot = await Bot.findById(id).lean<any>();
    if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const templateStatus = (bot as { templateStatus?: 'AVAILABLE' | 'MAINTENANCE' }).templateStatus ?? 'AVAILABLE';
    if (templateStatus !== 'AVAILABLE' && action === 'restart') {
      return NextResponse.json({ error: 'Template must be AVAILABLE to restart snapshot.' }, { status: 409 });
    }

    const rawIds = (bot as { maintenanceSnapshotInstanceIds?: unknown[] }).maintenanceSnapshotInstanceIds ?? [];
    const instanceIds = rawIds.map((x) => String(x)).filter(Boolean);

    let restartResult: null | { matched: number; started: number } = null;
    if (action === 'restart') {
      // Only start instances that still exist
      const existing = await BotInstance.find({ _id: { $in: instanceIds.map((x) => new mongoose.Types.ObjectId(x)) } })
        .select('_id')
        .lean<Array<{ _id: mongoose.Types.ObjectId }>>();
      const existingIds = existing.map((e) => String(e._id));
      restartResult = await startInstances(existingIds);
    }

    await Bot.findByIdAndUpdate(id, { $set: { maintenanceSnapshotInstanceIds: [], maintenanceSnapshotCreatedAt: null } });

    return NextResponse.json({
      action,
      snapshotCount: instanceIds.length,
      restartResult,
      cleared: true,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

