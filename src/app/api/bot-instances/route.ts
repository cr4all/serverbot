import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import Bot from '@/models/Bot'; // ensure model is registered
import User from '@/models/User'; // ensure model is registered
import BotInstance from '@/models/BotInstance';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Cast session user to any to access id if types aren't augmented
        const userId = (session.user as any).id;

        await connectDB();

        const instances = await BotInstance.find({ userId })
            .populate('botId') // Populate bot template info
            .sort({ createdAt: -1 });

        return NextResponse.json(instances);
    } catch (error) {
        console.error('Error fetching bot instances:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bot instances' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const body = await request.json();

        await connectDB();

        // Force userId from session
        const instanceData = { ...body, userId:userId, lastBalance: 0 };

        const instance = await BotInstance.create(instanceData);

        // Populate before returning to be helpful for the UI
        await instance.populate('botId');

        return NextResponse.json(instance, { status: 201 });
    } catch (error) {
        console.error('Error creating bot instance:', error);
        return NextResponse.json(
            { error: 'Failed to create bot instance' },
            { status: 500 }
        );
    }
}
