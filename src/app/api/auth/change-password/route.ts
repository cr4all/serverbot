import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const session: any = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { currentPassword, newPassword } = await request.json();
        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        await connectDB();

        const user = await User.findById(session.user.id);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        if (!user.password) {
            return NextResponse.json({ error: 'Password change not available for OAuth users' }, { status: 400 });
        }

        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

        const hashed = await bcrypt.hash(newPassword, 12);
        user.password = hashed;
        await user.save();

        return NextResponse.json({ message: 'Password updated' });
    } catch (e) {
        console.error('Change password error', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
