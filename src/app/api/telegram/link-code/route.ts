import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { generateLinkCode, LINK_CODE_TTL_MS } from '@/lib/telegramLogic';

async function sessionUserId(): Promise<string | null> {
    const session = await getServerSession(authOptions);
    const id = (session?.user as any)?.id;
    return id ? String(id) : null;
}

export async function GET() {
    const userId = await sessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const user = await User.findById(userId).select('telegramChatId').lean<{ telegramChatId?: string } | null>();
    return NextResponse.json({
        linked: Boolean(user?.telegramChatId),
        botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
    });
}

export async function POST() {
    try {
        const userId = await sessionUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await connectDB();
        const code = generateLinkCode();
        const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
        await User.updateOne(
            { _id: userId },
            { $set: { telegramLinkCode: code, telegramLinkExpiresAt: expiresAt } }
        );
        return NextResponse.json({
            code,
            expiresAt: expiresAt.toISOString(),
            botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
        });
    } catch (error) {
        console.error('Error issuing telegram link code:', error);
        return NextResponse.json({ error: 'Failed to issue link code' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const userId = await sessionUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await connectDB();
        await User.updateOne(
            { _id: userId },
            { $unset: { telegramChatId: 1, telegramLinkCode: 1, telegramLinkExpiresAt: 1 } }
        );
        return NextResponse.json({ linked: false });
    } catch (error) {
        console.error('Error unlinking telegram:', error);
        return NextResponse.json({ error: 'Failed to unlink telegram' }, { status: 500 });
    }
}
