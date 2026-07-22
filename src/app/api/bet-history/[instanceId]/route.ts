import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BetHistory from '@/models/BetHistory';
import BotInstance from '@/models/BotInstance';

export async function GET(request: NextRequest, context: { params: any }) {
  try {
    // `params` may be a plain object or a Promise depending on environment/types.
    const params = await context.params;
    const { instanceId } = params as { instanceId: string };

    const session: any = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // If not admin, ensure the session user owns the instance
    if ((session.user as any).role !== 'admin') {
      const instance = await BotInstance.findOne({ _id: instanceId, userId: (session.user as any).id });
      if (!instance) {
        return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });
      }
    }

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || '50');
    const placeStatusRaw = String(url.searchParams.get('placeStatus') || 'ALL').trim().toUpperCase();
    const placeStatus =
      placeStatusRaw === '' || placeStatusRaw === 'ALL'
        ? null
        : placeStatusRaw;

    if (placeStatus != null && placeStatus !== 'SUCCESS' && placeStatus !== 'FAILED') {
      return NextResponse.json(
        { error: 'placeStatus must be SUCCESS, FAILED, or ALL' },
        { status: 400 },
      );
    }

    // Query by botInstanceId; optional placeStatus filter (legacy status fallback)
    const query: Record<string, unknown> = { botInstanceId: instanceId };
    if (placeStatus) {
      query.$or = [{ placeStatus }, { status: placeStatus }];
    }

    const bets = await BetHistory.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json(bets);
  } catch (error) {
    console.error('Error fetching bet history:', error);
    return NextResponse.json({ error: 'Failed to fetch bet history' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: any }) {
  try {
    const params = await context.params;
    const { instanceId } = params as { instanceId: string };

    const session: any = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    if ((session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const url = new URL(request.url);
    const betId = url.searchParams.get('betId');
    if (!betId) {
      return NextResponse.json({ error: 'betId query param required' }, { status: 400 });
    }

    const result = await BetHistory.findOneAndDelete({
      _id: betId,
      botInstanceId: instanceId,
    });

    if (!result) {
      return NextResponse.json({ error: 'Bet not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting bet history:', error);
    return NextResponse.json({ error: 'Failed to delete bet' }, { status: 500 });
  }
}
