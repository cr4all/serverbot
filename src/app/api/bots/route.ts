import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import Bot from '@/models/Bot';
import BotAssignment from '@/models/BotAssignment';
import User from '@/models/User';

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

        const configParams = Array.isArray(body.configParams) ? body.configParams : [];
        const createPayload = {
            name: body.name,
            description: body.description ?? '',
            type: body.type,
            subtype: typeof body.subtype === 'number' ? body.subtype : 0,
            defaultConfig: body.defaultConfig ?? {},
            configParams,
            version: body.version ?? '1.0.0',
            isDefault: !!body.isDefault,
            requiresCredentials: body.requiresCredentials !== false,
        };
        const bot = await Bot.create(createPayload);
        if (configParams.length > 0 && mongoose.connection?.db) {
            await mongoose.connection.db.collection(Bot.collection.name).updateOne(
                { _id: bot._id },
                { $set: { configParams } }
            );
        }

        const refetched = await Bot.findById(bot._id).lean();

        // If this template is marked default, assign to all existing users (skip existing assignments)
        if (body.isDefault) {
            try {
                const users = await User.find({}).lean();
                const userIds = users.map((u: any) => String(u._id));

                if (userIds.length > 0) {
                    // find already assigned users for this bot
                    const existing = await BotAssignment.find({ botId: bot._id, userId: { $in: userIds } }).lean();
                    const existingSet = new Set(existing.map((e: any) => String(e.userId)));
                    const toCreate = userIds.filter((id) => !existingSet.has(id)).map((id) => ({ botId: bot._id, userId: id, createdBy: null }));
                    if (toCreate.length > 0) await BotAssignment.insertMany(toCreate);
                }
            } catch (e) {
                console.error('Error assigning default bot to users:', e);
            }
        }

        return NextResponse.json(refetched ?? bot, { status: 201 });
    } catch (error) {
        console.error('Error creating bot:', error);
        return NextResponse.json(
            { error: 'Failed to create bot' },
            { status: 500 }
        );
    }
}
