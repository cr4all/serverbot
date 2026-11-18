import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const PATCH_ALLOWED = new Set(['role', 'status', 'name']);

function toSafeUser(u: Record<string, unknown>) {
    return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status ?? 'active',
        plan: u.plan ?? 'free',
        createdAt: u.createdAt,
    };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        await connectDB();

        if (body?.resetPassword) {
            const user = await User.findById(id);
            if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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

        const patch: Record<string, unknown> = {};
        for (const key of PATCH_ALLOWED) {
            if (body?.[key] === undefined) continue;
            if (key === 'role') {
                const role = String(body.role).toLowerCase();
                if (role !== 'admin' && role !== 'user') {
                    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
                }
                patch.role = role;
            } else if (key === 'status') {
                const status = String(body.status).toLowerCase();
                if (status !== 'active' && status !== 'pending' && status !== 'suspended') {
                    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
                }
                patch.status = status;
            } else if (key === 'name') {
                const name = String(body.name ?? '').trim();
                if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
                patch.name = name;
            }
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const updatedUser = await User.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
        if (!updatedUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json(toSafeUser(updatedUser as Record<string, unknown>));
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
        if (String(session.user.id) === String(id)) {
            return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
        }
        const deleted = await User.findByIdAndDelete(id);
        if (!deleted) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        return NextResponse.json({ message: 'User deleted' });
    } catch (e) {
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
