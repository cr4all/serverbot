import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import { parseStatsQuery } from '@/lib/statsApiParams';
import { fetchInstanceBettingStats } from '@/services/statsAggregate';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const parsed = parseStatsQuery(new URL(request.url).searchParams);
        if ('error' in parsed) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }

        await connectDB();

        const ownershipQuery: { _id: string; userId?: string } = { _id: id };
        if ((session.user as { role?: string }).role !== 'admin') {
            ownershipQuery.userId = (session.user as { id: string }).id;
        }

        const instance = await BotInstance.findOne(ownershipQuery).select('_id').lean();
        if (!instance) {
            return NextResponse.json({ error: 'Bot instance not found or unauthorized' }, { status: 404 });
        }

        const stats = await fetchInstanceBettingStats({
            botInstanceId: id,
            period: parsed.period,
            offset: parsed.offset,
            options:
                parsed.excludeMock !== undefined ? { excludeMock: parsed.excludeMock } : undefined,
        });

        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error fetching instance betting stats:', error);
        return NextResponse.json({ error: 'Failed to fetch betting stats' }, { status: 500 });
    }
}
