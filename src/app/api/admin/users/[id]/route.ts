import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        await connectDB();

        // If admin requests a password reset, generate a temporary password,
        // hash it and store on the user, then return the temp password.
        if (body?.resetPassword) {
            const user = await User.findById(id);
            if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

            // generate reasonably strong temporary password
            const tempPassword = crypto
                .randomBytes(12)
                .toString('base64')
                .replace(/[^a-zA-Z0-9]/g, '')
                .slice(0, 12);

            const hashed = await bcrypt.hash(tempPassword, 12);
            user.password = hashed;
            await user.save();

            return NextResponse.json({ message: 'Password reset', tempPassword });
        }

        const updatedUser = await User.findByIdAndUpdate(id, body, { new: true });
        if (!updatedUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json(updatedUser);
    } catch (e) {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectDB();
        await User.findByIdAndDelete(id);
        return NextResponse.json({ message: 'User deleted' });
    } catch (e) {
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
