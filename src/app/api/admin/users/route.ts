import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';

export async function GET() {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectDB();
        const users = await User.find({}).sort({ createdAt: -1 });
        // Don't send passwords back
        const safeUsers = users.map(u => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt,
        }));
        return NextResponse.json(safeUsers);
    } catch (e) {
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
