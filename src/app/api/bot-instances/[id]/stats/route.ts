import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BetHistory from '@/models/BetHistory';
import BotInstance from '@/models/BotInstance';
import { aggregateBetRows, parseStatsQuery, periodRange, type BetStatsRow } from '@/lib/bettingStats';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid instance id' }, { status: 400 });
    }

    const url = new URL(request.url);
    const parsed = parseStatsQuery(url.searchParams.get('period'), url.searchParams.get('offset'));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();

    const query: { _id: string; userId?: string } = { _id: id };
    if ((session.user as { role?: string }).role !== 'admin') {
      query.userId = (session.user as { id?: string }).id;
    }
    const instance = await BotInstance.findOne(query).select('_id').lean();
    if (!instance) {
      return NextResponse.json({ error: 'Bot instance not found or unauthorized' }, { status: 404 });
    }

    const range = periodRange(parsed.period, parsed.offset);
    const rows = await BetHistory.find({
      botInstanceId: id,
      $or: [
        { createdAt: { $gte: range.start, $lte: range.end } },
        { 'settlement.settledAt': { $gte: range.start, $lte: range.end } },
      ],
    }).lean<BetStatsRow[]>();

    return NextResponse.json(aggregateBetRows(rows, range, { excludeMock: false }));
  } catch (error) {
    console.error('Error fetching instance stats:', error);
    return NextResponse.json({ error: 'Failed to fetch instance stats' }, { status: 500 });
  }
}
