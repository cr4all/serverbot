import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import '@/models/Bot'; // ensure model is registered
import '@/models/User'; // ensure model is registered
import BotInstance from '@/models/BotInstance';
import { createInstanceForUser } from '@/lib/botInstanceService';

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

        const isAdmin = (session.user as any).role === 'admin';
        const userId = (session.user as any).id;
        const body = await request.json();

        const result = await createInstanceForUser({ userId, isAdmin, body });
        if (!result.ok) {
            return NextResponse.json(
                result.code ? { error: result.error, code: result.code } : { error: result.error },
                { status: result.status }
            );
        }

        return NextResponse.json(result.instance, { status: 201 });
    } catch (error) {
        console.error('Error creating bot instance:', error);
        return NextResponse.json(
            { error: 'Failed to create bot instance' },
            { status: 500 }
        );
    }
}
