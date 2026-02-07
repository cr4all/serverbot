import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotAssignment from '@/models/BotAssignment';
import Bot from '@/models/Bot';
import User from '@/models/User';

export async function GET(request: Request) {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectDB();

        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        const filter: any = {};
        if (userId) filter.userId = userId;

        const assigns = await BotAssignment.find(filter)
            .populate('botId', 'name description')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json(assigns);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { botId, botIds, userId } = body;
        if ((!botId && !botIds) || !userId) return NextResponse.json({ error: 'botId(s) and userId required' }, { status: 400 });

        await connectDB();

        // ensure user exists
        const user = await User.findById(userId).lean();
        if (!user) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

        // normalize to array
        const ids = botIds && Array.isArray(botIds) ? botIds.map(String) : [String(botId)];

        // filter existing assignments
        const existing = await BotAssignment.find({ userId, botId: { $in: ids } }).lean();
        const existingIds = new Set(existing.map((e: any) => String(e.botId)));

        const toCreate = ids.filter((id) => !existingIds.has(id));

        if (toCreate.length === 0) {
            // nothing to create
            return NextResponse.json({ created: 0 });
        }

        // validate bots exist
        const botsFound = await Bot.find({ _id: { $in: toCreate } }).lean();
        const foundIds = new Set(botsFound.map((b: any) => String(b._id)));
        const validToCreate = toCreate.filter((id) => foundIds.has(id));

        if (validToCreate.length === 0) return NextResponse.json({ created: 0 });

        const docs = validToCreate.map((id) => ({ botId: id, userId, createdBy: (session.user as any).id }));
        const inserted = await BotAssignment.insertMany(docs);

        return NextResponse.json({ created: inserted.length }, { status: 201 });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { botId, botIds, userId } = body;
        if ((!botId && !botIds) || !userId) return NextResponse.json({ error: 'botId(s) and userId required' }, { status: 400 });

        await connectDB();

        // normalize to array
        const ids = botIds && Array.isArray(botIds) ? botIds.map(String) : [String(botId)];

        const res = await BotAssignment.deleteMany({ userId, botId: { $in: ids } });
        return NextResponse.json({ deletedCount: res.deletedCount });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
