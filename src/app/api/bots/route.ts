import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import Bot from '@/models/Bot';
import BotAssignment from '@/models/BotAssignment';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as any).id;

        await connectDB();

        // Admins see all templates
        if ((session.user as any).role === 'admin') {
            const bots = await Bot.find({}).sort({ createdAt: -1 });
            return NextResponse.json(bots);
        }

        // Regular users see only assigned bot templates
        const assigns = await BotAssignment.find({ userId }).lean();
        const allowedIds = assigns.map((a: any) => a.botId).filter(Boolean);

        if (allowedIds.length === 0) {
            return NextResponse.json([]);
        }

        const bots = await Bot.find({ _id: { $in: allowedIds } }).sort({ createdAt: -1 });
        return NextResponse.json(bots);
    } catch (error) {
        console.error('Error fetching bots:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bots' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        await connectDB();

        const bot = await Bot.create(body);
        return NextResponse.json(bot, { status: 201 });
    } catch (error) {
        console.error('Error creating bot:', error);
        return NextResponse.json(
            { error: 'Failed to create bot' },
            { status: 500 }
        );
    }
}
