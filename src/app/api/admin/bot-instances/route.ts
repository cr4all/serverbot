import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import User from '@/models/User';
import Bot from '@/models/Bot';

export async function GET(req: NextRequest) {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name')?.trim() || '';
        const instanceId = searchParams.get('instanceId')?.trim() || '';
        const owner = searchParams.get('owner')?.trim() || '';
        const template = searchParams.get('template')?.trim() || '';
        const status = searchParams.get('status')?.trim() || '';
        const licenseKey = searchParams.get('licenseKey')?.trim() || '';
        const createdFrom = searchParams.get('createdFrom')?.trim() || '';
        const createdTo = searchParams.get('createdTo')?.trim() || '';
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};

        if (name) {
            filter.name = { $regex: name, $options: 'i' };
        }
        if (instanceId) {
            try {
                filter._id = new mongoose.Types.ObjectId(instanceId);
            } catch {
                filter._id = new mongoose.Types.ObjectId('000000000000000000000000');
            }
        }
        if (status) {
            filter.status = status;
        }
        if (createdFrom || createdTo) {
            filter.createdAt = {} as Record<string, Date>;
            if (createdFrom) {
                (filter.createdAt as Record<string, Date>).$gte = new Date(createdFrom);
            }
            if (createdTo) {
                const d = new Date(createdTo);
                d.setHours(23, 59, 59, 999);
                (filter.createdAt as Record<string, Date>).$lte = d;
            }
        }
        if (owner) {
            const users = await User.find({
                $or: [
                    { name: { $regex: owner, $options: 'i' } },
                    { email: { $regex: owner, $options: 'i' } },
                ],
            }).select('_id');
            const userIds = users.map((u) => u._id);
            filter.userId = { $in: userIds };
        }
        if (template) {
            const bots = await Bot.find({ name: { $regex: template, $options: 'i' } }).select('_id');
            const botIds = bots.map((b: { _id: unknown }) => b._id);
            filter.botId = { $in: botIds };
        }
        if (licenseKey) {
            filter['config.licenseKey'] = { $regex: licenseKey, $options: 'i' };
        }

        const [instances, total, runningCount] = await Promise.all([
            BotInstance.find(filter)
                .populate('botId', 'name type')
                .populate('userId', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            BotInstance.countDocuments(filter),
            BotInstance.countDocuments({ ...filter, status: 'RUNNING' }),
        ]);
        return NextResponse.json({
            instances,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            stats: { total, running: runningCount },
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
