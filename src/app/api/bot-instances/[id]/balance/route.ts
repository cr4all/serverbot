import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import { mainbotFetch } from '@/lib/mainbotClient';
import { ownedInstanceQuery } from '@/lib/botInstanceService';

/** Proxies mainbot `/bot/balance/{id}` so the browser never needs the internal token. */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        await connectDB();
        const isAdmin = (session.user as any).role === 'admin';
        const inst = await BotInstance.findOne(ownedInstanceQuery(id, (session.user as any).id, isAdmin))
            .select('_id')
            .lean();
        if (!inst) {
            return NextResponse.json({ error: 'Bot instance not found or unauthorized' }, { status: 404 });
        }

        const res = await mainbotFetch(`/bot/balance/${id}`, { signal: request.signal });
        const body = await res.text();
        return new NextResponse(body, {
            status: res.status,
            headers: { 'Content-Type': res.headers.get('content-type') || 'text/plain; charset=utf-8' },
        });
    } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') {
            return new NextResponse('Request aborted', { status: 499 });
        }
        console.error('Error fetching balance:', error);
        return new NextResponse('Bot server is not reachable', { status: 502 });
    }
}
