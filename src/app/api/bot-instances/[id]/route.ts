import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import '@/models/Bot';
import { normalizeFilterConfig, validateFilterConfig } from '@/lib/botInstanceFilters';
import { checkStartAllowed, notifyMainbotStatus, ownedInstanceQuery, validateLocale } from '@/lib/botInstanceService';

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

        const localeErr = validateLocale(body?.config);
        if (localeErr) {
            return NextResponse.json({ error: localeErr.error }, { status: localeErr.status });
        }

        // Ensure user owns the instance
        const updateQuery: any = ownedInstanceQuery(id, (session.user as any).id, isAdmin);

        if (body?.status && String(body.status).toUpperCase() === 'RUNNING') {
            const blocked = await checkStartAllowed(updateQuery, isAdmin);
            if (blocked) {
                return NextResponse.json(
                    blocked.code ? { error: blocked.error, code: blocked.code } : { error: blocked.error },
                    { status: blocked.status }
                );
            }
        }

        if (body?.config && typeof body.config === 'object') {
            const existingForTier = await BotInstance.findOne(updateQuery).populate('botId');
            const tier = (existingForTier?.botId as { botTier?: string } | null)?.botTier;
            if (tier === 'free') {
                delete body.config.licenseKey;
            }
            body.config = normalizeFilterConfig(body.config);
            const filterCheck = validateFilterConfig(body.config);
            if (!filterCheck.ok) {
                return NextResponse.json({ error: filterCheck.error }, { status: 400 });
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
                const res = await notifyMainbotStatus(id, body.status);
                if (res.ok) {
                    return NextResponse.json(
                        { error: `Bot instance is ${res.action}` },
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
