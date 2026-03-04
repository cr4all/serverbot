import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import BotInstance from '@/models/BotInstance';

export async function GET(request: Request) {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
        const skip = (page - 1) * limit;

        const total = await User.countDocuments();
        const users = await User.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

        // Aggregate bot instance counts per user
        const agg = await BotInstance.aggregate([
            {
                $group: {
                    _id: '$userId',
                    total: { $sum: 1 },
                    running: { $sum: { $cond: [{ $eq: ['$status', 'RUNNING'] }, 1, 0] } },
                    stopped: { $sum: { $cond: [{ $eq: ['$status', 'STOPPED'] }, 1, 0] } },
                },
            },
        ]);

        const countsMap: Record<string, any> = {};
        for (const c of agg) {
            countsMap[String(c._id)] = c;
        }

        // Don't send passwords back
        const safeUsers = users.map((u: any) => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt,
            totalInstances: countsMap[String(u._id)]?.total || 0,
            runningInstances: countsMap[String(u._id)]?.running || 0,
            stoppedInstances: countsMap[String(u._id)]?.stopped || 0,
        }));

        return NextResponse.json({
            users: safeUsers,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (e) {
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
