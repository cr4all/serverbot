import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import Bot from '@/models/Bot';
import BotAssignment from '@/models/BotAssignment';
import User from '@/models/User';

export async function PATCH(request: Request, { params }: { params: any }) {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const _params = await params;
        const id = _params.id;
        const body = await request.json();

        await connectDB();

        const before = await Bot.findById(id).lean();
        if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const updated = await Bot.findByIdAndUpdate(id, body, { new: true }).lean();

        // If isDefault changed from falsy to true, assign to all existing users
        try {
            const beforeDefault = !!before.isDefault;
            const afterDefault = !!(body.isDefault || updated?.isDefault);
            if (!beforeDefault && afterDefault) {
                const users = await User.find({}).lean();
                const userIds = users.map((u: any) => String(u._id));
                if (userIds.length > 0) {
                    const existing = await BotAssignment.find({ botId: id, userId: { $in: userIds } }).lean();
                    const existingSet = new Set(existing.map((e: any) => String(e.userId)));
                    const toCreate = userIds.filter((uid) => !existingSet.has(uid)).map((uid) => ({ botId: id, userId: uid, createdBy: (session.user as any).id }));
                    if (toCreate.length > 0) await BotAssignment.insertMany(toCreate);
                }
            }
        } catch (e) {
            console.error('Error assigning default bot to users on update:', e);
        }

        return NextResponse.json(updated);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
