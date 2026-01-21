import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Bot from '@/models/Bot';

export async function GET() {
    try {
        await connectDB();
        const bots = await Bot.find({}).sort({ createdAt: -1 });
        return NextResponse.json(bots);
    } catch (error) {
        console.error('Error fetching bots:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bots' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        await connectDB();

        const bot = await Bot.create(body);
        return NextResponse.json(bot, { status: 201 });
    } catch (error) {
        console.error('Error creating bot:', error);
        return NextResponse.json(
            { error: 'Failed to create bot' },
            { status: 500 }
        );
    }
}
