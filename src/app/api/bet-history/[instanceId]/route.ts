import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BetHistory from '@/models/BetHistory';
import BotInstance from '@/models/BotInstance';

export async function GET(
  request: Request,
  { params }: { params: { instanceId: string } }
) {
  try {
    const { instanceId } = await params;

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

    // Query by botInstanceId field in your BetHistory schema
    const bets = await BetHistory.find({ botInstanceId: instanceId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json(bets);
  } catch (error) {
    console.error('Error fetching bet history:', error);
    return NextResponse.json({ error: 'Failed to fetch bet history' }, { status: 500 });
  }
}
