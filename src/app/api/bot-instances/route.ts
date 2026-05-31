import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import Bot from '@/models/Bot'; // ensure model is registered
import User from '@/models/User'; // ensure model is registered
import BotInstance from '@/models/BotInstance';
import BotAssignment from '@/models/BotAssignment';
import { allowedLocalesErrorMessage, isValidLocale } from '@/lib/locales';

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

        await connectDB();

        if (body?.config?.locale && !isValidLocale(body.config.locale)) {
            return NextResponse.json({ error: allowedLocalesErrorMessage() }, { status: 400 });
        }

        // Validate that the requested botId is allowed for this user
        if ((session.user as any).role !== 'admin') {
            const botId = body.botId;
            if (!botId) {
                return NextResponse.json({ error: 'botId is required' }, { status: 400 });
            }

            const allowed = await BotAssignment.findOne({ botId, userId });
            if (!allowed) {
                return NextResponse.json({ error: 'Forbidden: bot template not assigned to user' }, { status: 403 });
            }
        }

        if (body.botId) {
            const t = await Bot.findById(body.botId)
                .select('templateStatus name')
                .lean<{ templateStatus?: 'AVAILABLE' | 'MAINTENANCE'; name?: string } | null>();
            if (!isAdmin && t?.templateStatus === 'MAINTENANCE') {
                return NextResponse.json(
                    { error: 'This bot template is under maintenance and cannot be created right now.', code: 'BOT_TEMPLATE_MAINTENANCE' },
                    { status: 423 }
                );
            }
        }

        if (body.botId && body.config && typeof body.config === 'object') {
            const bot = await Bot.findById(body.botId).select('botTier').lean();
            if ((bot as { botTier?: string } | null)?.botTier === 'free') {
                delete body.config.licenseKey;
            }
        }

        // Force userId from session
        const instanceData = { ...body, userId: userId, lastBalance: 0 };

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
