import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import BotInstance from '@/models/BotInstance';

function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toSafeUser(u: Record<string, unknown>, counts?: { total?: number; running?: number; stopped?: number }) {
    return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status ?? 'active',
        plan: u.plan ?? 'free',
        createdAt: u.createdAt,
        totalInstances: counts?.total || 0,
        runningInstances: counts?.running || 0,
        stoppedInstances: counts?.stopped || 0,
    };
}

export async function GET(request: Request) {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const name = searchParams.get('name')?.trim() || '';
        const email = searchParams.get('email')?.trim() || '';
        const userId = searchParams.get('userId')?.trim() || '';
        const role = searchParams.get('role')?.trim() || '';
        const status = searchParams.get('status')?.trim().toLowerCase() || '';
        const createdFrom = searchParams.get('createdFrom')?.trim() || '';
        const createdTo = searchParams.get('createdTo')?.trim() || '';
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};

        if (name) {
            filter.name = { $regex: name, $options: 'i' };
        }
        if (email) {
            filter.email = { $regex: email, $options: 'i' };
        }
        if (role === 'admin' || role === 'user') {
            filter.role = role;
        }
        if (status === 'active' || status === 'pending' || status === 'suspended') {
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
        if (userId) {
            filter.$expr = {
                $regexMatch: {
                    input: { $toString: '$_id' },
                    regex: escapeRegex(userId),
                    options: 'i',
                },
            };
        }

        const total = await User.countDocuments(filter);
        const users = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

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

        const countsMap: Record<string, { total?: number; running?: number; stopped?: number }> = {};
        for (const c of agg) {
            countsMap[String(c._id)] = c;
        }

        const safeUsers = users.map((u: any) => toSafeUser(u, countsMap[String(u._id)]));

        return NextResponse.json({
            users: safeUsers,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (e) {
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const name = String(body?.name ?? '').trim();
        const email = String(body?.email ?? '').trim().toLowerCase();
        const password = String(body?.password ?? '');
        const roleRaw = String(body?.role ?? 'user').trim().toLowerCase();
        const statusRaw = String(body?.status ?? 'active').trim().toLowerCase();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
        }

        const role = roleRaw === 'admin' ? 'admin' : 'user';
        const status =
            statusRaw === 'pending' || statusRaw === 'suspended' || statusRaw === 'active' ? statusRaw : 'active';

        await connectDB();

        const existing = await User.findOne({ email }).lean();
        if (existing) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        }

        const hashed = await bcrypt.hash(password, 12);
        const user = await User.create({
            name,
            email,
            password: hashed,
            role,
            status,
            plan: 'free',
        });

        return NextResponse.json(toSafeUser(user.toObject()), { status: 201 });
    } catch (e) {
        console.error('Admin create user failed', e);
        return NextResponse.json({ error: 'Create failed' }, { status: 500 });
    }
}
