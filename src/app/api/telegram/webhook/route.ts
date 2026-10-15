import { NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/telegramBot';

export async function POST(request: Request) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const update = await request.json();
        await handleTelegramUpdate(update);
    } catch (error) {
        // Always 200 so Telegram does not redeliver the same update.
        console.error('[telegram] webhook error', error);
    }
    return NextResponse.json({ ok: true });
}
