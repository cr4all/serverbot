import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import Bot from '@/models/Bot';
import { parseStatsQuery } from '@/lib/statsApiParams';
import { fetchTemplateBettingStats } from '@/services/statsAggregate';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: botId } = await params;
        const parsed = parseStatsQuery(new URL(request.url).searchParams);
        if ('error' in parsed) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }

        await connectDB();

        const template = await Bot.findById(botId).select('_id name').lean();
        if (!template) {
            return NextResponse.json({ error: 'Bot template not found' }, { status: 404 });
        }

        const stats = await fetchTemplateBettingStats({
            botId,
            period: parsed.period,
            offset: parsed.offset,
            options:
                parsed.excludeMock !== undefined ? { excludeMock: parsed.excludeMock } : undefined,
        });

        return NextResponse.json({
            botId,
            botName: template.name,
            ...stats,
        });
    } catch (error) {
        console.error('Error fetching template betting stats:', error);
        return NextResponse.json({ error: 'Failed to fetch template stats' }, { status: 500 });
    }
}
