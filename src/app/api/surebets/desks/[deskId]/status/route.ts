import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';

/**
 * Start/stop a surebet desk (BetOnline + PS3838 pair) without calling the legacy botManager.
 * Auto-run picks up RUNNING instances via surebetAutoRunner.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ deskId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id ?? '';
  if (!userId) {
    return NextResponse.json({ error: 'Session has no user id' }, { status: 400 });
  }

  const { deskId: rawDeskId } = await params;
  const deskId = String(rawDeskId ?? '').trim();
  if (!deskId) {
    return NextResponse.json({ error: 'deskId is required' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const status = String(body?.status ?? '')
    .trim()
    .toUpperCase();
  if (status !== 'RUNNING' && status !== 'STOPPED') {
    return NextResponse.json({ error: 'status must be RUNNING or STOPPED' }, { status: 400 });
  }

  await connectDB();

  const filter: Record<string, unknown> = {
    userId,
    'config.deskId': deskId,
  };
  if ((session.user as { role?: string }).role === 'admin' && body?.userId) {
    filter.userId = String(body.userId);
  }

  const instances = await BotInstance.find(filter).populate('botId', 'type').exec();
  const surebet = instances.filter((inst) => {
    const type = String((inst.botId as { type?: string } | null)?.type ?? '').toUpperCase();
    return type === 'BETONLINE' || type === 'PS3838';
  });

  if (surebet.length === 0) {
    return NextResponse.json({ error: 'Surebet desk not found' }, { status: 404 });
  }

  await BotInstance.updateMany(
    { _id: { $in: surebet.map((i) => i._id) } },
    { $set: { status } }
  );

  return NextResponse.json({
    deskId,
    status,
    updated: surebet.map((i) => String(i._id)),
  });
}
