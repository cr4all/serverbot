import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BetHistory from '@/models/BetHistory';
import BotInstance from '@/models/BotInstance';
import {
  aggregateBetRows,
  excludeMockFromTemplateStats,
  parseStatsQuery,
  periodRange,
  templateSummary,
  type BetStatsRow,
} from '@/lib/bettingStats';

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
      return NextResponse.json({ error: 'Invalid bot id' }, { status: 400 });
    }

    const url = new URL(request.url);
    const parsed = parseStatsQuery(url.searchParams.get('period'), url.searchParams.get('offset'));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();

    const botObjectId = new mongoose.Types.ObjectId(id);
    const instances = await BotInstance.find({ botId: botObjectId }).select('_id').lean<Array<{ _id: mongoose.Types.ObjectId }>>();
    const instanceIds = instances.map((row) => row._id);
    const range = periodRange(parsed.period, parsed.offset);

    const rows = await BetHistory.find({
      $and: [
        { 'settlement.status': 'SETTLED' },
        { 'settlement.settledAt': { $gte: range.start, $lte: range.end } },
        {
          $or: [
            { botId: botObjectId },
            {
              botInstanceId: { $in: instanceIds },
              $or: [{ botId: null }, { botId: { $exists: false } }],
            },
          ],
        },
      ],
    }).lean<BetStatsRow[]>();

    const stats = aggregateBetRows(rows, range, { excludeMock: excludeMockFromTemplateStats() });
    return NextResponse.json(templateSummary(stats));
  } catch (error) {
    console.error('Error fetching template stats:', error);
    return NextResponse.json({ error: 'Failed to fetch template stats' }, { status: 500 });
  }
}
