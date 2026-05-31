import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import Bot from '@/models/Bot';
import { allowedLocalesErrorMessage, isValidLocale } from '@/lib/locales';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        await connectDB();

        const query: any = { _id: id };
        if ((session.user as any).role !== 'admin') {
            query.userId = (session.user as any).id;
        }

        const instance = await BotInstance.findOne(query).populate('botId').populate('userId', 'name');

        if (!instance) {
            return NextResponse.json(
                { error: 'Bot instance not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json(instance);
    } catch (error) {
        console.error('Error fetching bot instance:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bot instance' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = (session.user as any).role === 'admin';
        const { id } = await params;
        const body = await request.json();
        await connectDB();

        if (body?.config?.locale && !isValidLocale(body.config.locale)) {
            return NextResponse.json({ error: allowedLocalesErrorMessage() }, { status: 400 });
        }

        // Ensure user owns the instance
        const updateQuery: any = { _id: id };
        if ((session.user as any).role !== 'admin') {
            updateQuery.userId = (session.user as any).id;
        }

        if (body?.status && String(body.status).toUpperCase() === 'RUNNING') {
            const inst = await BotInstance.findOne(updateQuery).select('botId').lean<{ botId?: unknown } | null>();
            if (!inst?.botId) {
                return NextResponse.json({ error: 'Bot instance not found or unauthorized' }, { status: 404 });
            }
            const t = await Bot.findById(inst.botId)
                .select('templateStatus name')
                .lean<{ templateStatus?: 'AVAILABLE' | 'MAINTENANCE'; name?: string } | null>();
            if (!isAdmin && t?.templateStatus === 'MAINTENANCE') {
                return NextResponse.json(
                    { error: 'This bot template is under maintenance and cannot be started right now.', code: 'BOT_TEMPLATE_MAINTENANCE' },
                    { status: 423 }
                );
            }
        }

        if (body?.config && typeof body.config === 'object') {
            const existingForTier = await BotInstance.findOne(updateQuery).populate('botId');
            const tier = (existingForTier?.botId as { botTier?: string } | null)?.botTier;
            if (tier === 'free') {
                delete body.config.licenseKey;
            }
        }

        const instance = await BotInstance.findOneAndUpdate(
            updateQuery,
            { $set: body },
            { new: true, runValidators: true }
        );

        if ('status' in body)
        {
            try {
                const BOT_SERVER = process.env.NEXT_PUBLIC_BOTMANAGER_URL || 'http://localhost:4000';
                let api_path = '';
                if (body.status.toLowerCase() === 'running'){
                    api_path = 'start';
                }
                else if (body.status.toLowerCase() === 'stopped'){
                    api_path = 'stop';
                }
                const res = await fetch(`${BOT_SERVER}/bot/${api_path}/${id}`);
                if (res.ok) {
                    return NextResponse.json(
                        { error: `Bot instance is ${api_path}` },
                        { status: 200 }
                    );
                }
                else {
                    return NextResponse.json(
                        { error: 'Failed to update bot instance' },
                        { status: 500 }
                    );
                }
            } catch (error) {
                console.error('Failed to fetch instances', error);
            }
        }

        if (!instance) {
            return NextResponse.json(
                { error: 'Bot instance not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json(instance);
    } catch (error) {
        console.error('Error updating bot instance:', error);
        return NextResponse.json(
            { error: 'Failed to update bot instance' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        await connectDB();

        const deleteQuery: any = { _id: id };
        if ((session.user as any).role !== 'admin') {
            deleteQuery.userId = (session.user as any).id;
        }

        const instance = await BotInstance.findOneAndDelete(deleteQuery);

        if (!instance) {
            return NextResponse.json(
                { error: 'Bot instance not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json({ message: 'Bot instance deleted successfully' });
    } catch (error) {
        console.error('Error deleting bot instance:', error);
        return NextResponse.json(
            { error: 'Failed to delete bot instance' },
            { status: 500 }
        );
    }
}
