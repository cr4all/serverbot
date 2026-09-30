import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';

const BOT_SERVER = process.env.NEXT_PUBLIC_BOTMANAGER_URL || 'http://localhost:4000';

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if ((session.user as { role?: string }).role !== 'admin') {
            return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        }

        const { id } = await params;
        await connectDB();

        const instance = await BotInstance.findById(id).select('status').lean();
        if (!instance) {
            return NextResponse.json({ error: 'Bot instance not found' }, { status: 404 });
        }
        if (String(instance.status).toUpperCase() !== 'RUNNING') {
            return NextResponse.json(
                { error: 'Instance must be RUNNING to sync settlement', code: 'NOT_RUNNING' },
                { status: 409 }
            );
        }

        const res = await fetch(`${BOT_SERVER}/bot/settlement/${id}`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return NextResponse.json(
                { error: data?.error || 'Settlement request failed', ...data },
                { status: res.status }
            );
        }
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error triggering settlement:', error);
        return NextResponse.json({ error: 'Failed to trigger settlement' }, { status: 500 });
    }
}
