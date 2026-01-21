import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import '@/models/Bot'; // Ensure Bot model is registered for populate
import '@/models/User';

export async function GET() {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectDB();
        const instances = await BotInstance.find({})
            .populate('botId', 'name type')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });
        return NextResponse.json(instances);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
