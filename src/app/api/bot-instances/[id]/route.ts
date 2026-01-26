import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        await connectDB();

        const instance = await BotInstance.findOne({
            _id: id,
            userId: (session.user as any).id
        }).populate('botId');

        if (!instance) {
            return NextResponse.json(
                { error: 'Bot instance not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json(instance);
    } catch (error) {
        console.error('Error fetching bot instance:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bot instance' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        await connectDB();

        // Ensure user owns the instance
        const instance = await BotInstance.findOneAndUpdate(
            { _id: id, userId: (session.user as any).id },
            { $set: body },
            { new: true, runValidators: true }
        );

        if ('status' in body)
        {
            try {
                const BOT_SERVER = process.env.BOTMANAGER_URL || 'http://localhost:4000';
                let api_path = '';
                if (body.status.toLowerCase() === 'running'){
                    api_path = 'start';
                }
                else if (body.status.toLowerCase() === 'stopped'){
                    api_path = 'stop';
                }
                const res = await fetch(`${BOT_SERVER}/bot/${api_path}/${id}`);
                if (res.ok) {
                    return NextResponse.json(
                        { error: 'Bot instance is RUNNING' },
                        { status: 200 }
                    );
                }
                else {
                    return NextResponse.json(
                        { error: 'Failed to update bot instance' },
                        { status: 500 }
                    );
                }
            } catch (error) {
                console.error('Failed to fetch instances', error);
            }
        }

        if (!instance) {
            return NextResponse.json(
                { error: 'Bot instance not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json(instance);
    } catch (error) {
        console.error('Error updating bot instance:', error);
        return NextResponse.json(
            { error: 'Failed to update bot instance' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        await connectDB();

        const instance = await BotInstance.findOneAndDelete({
            _id: id,
            userId: (session.user as any).id
        });

        if (!instance) {
            return NextResponse.json(
                { error: 'Bot instance not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json({ message: 'Bot instance deleted successfully' });
    } catch (error) {
        console.error('Error deleting bot instance:', error);
        return NextResponse.json(
            { error: 'Failed to delete bot instance' },
            { status: 500 }
        );
    }
}
