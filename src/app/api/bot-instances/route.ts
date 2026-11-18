import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import Bot from '@/models/Bot'; // ensure model is registered
import User from '@/models/User'; // ensure model is registered
import BotInstance from '@/models/BotInstance';
import BotAssignment from '@/models/BotAssignment';
import { allowedLocalesErrorMessage, isValidLocale } from '@/lib/locales';
import { buildAccountConfig, stripAccountSecret } from '@/lib/credentialsCrypto';
import VpsNode from '@/models/VpsNode';
import mongoose from 'mongoose';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Cast session user to any to access id if types aren't augmented
        const userId = (session.user as any).id;

        await connectDB();

            const instances = await BotInstance.find({ userId })
                .populate('botId') // Populate bot template info
                .sort({ createdAt: -1 });

        // Never send the encrypted account secret back to the browser.
        return NextResponse.json(instances.map((i) => stripAccountSecret(i.toObject())));
    } catch (error) {
        console.error('Error fetching bot instances:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bot instances' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = (session.user as any).role === 'admin';
        const userId = (session.user as any).id;
        const body = await request.json();

        await connectDB();

        if (body?.config?.locale && !isValidLocale(body.config.locale)) {
            return NextResponse.json({ error: allowedLocalesErrorMessage() }, { status: 400 });
        }

        const botId = body.botId;
        if (!botId) {
            return NextResponse.json({ error: 'botId is required' }, { status: 400 });
        }

        const t = await Bot.findById(botId)
            .select('templateStatus name type')
            .lean<{ templateStatus?: 'AVAILABLE' | 'MAINTENANCE'; name?: string; type?: string } | null>();
        if (!t) {
            return NextResponse.json({ error: 'bot template not found' }, { status: 404 });
        }

        const templateType = String(t.type ?? '').toUpperCase();
        const isSurebetDesk = templateType === 'BETONLINE' || templateType === 'PS3838';

        // Surebet desk templates are open to every logged-in user; other bots still need assignment.
        if (!isAdmin && !isSurebetDesk) {
            const allowed = await BotAssignment.findOne({ botId, userId });
            if (!allowed) {
                return NextResponse.json({ error: 'Forbidden: bot template not assigned to user' }, { status: 403 });
            }
        }

        if (!isAdmin && t.templateStatus === 'MAINTENANCE') {
            return NextResponse.json(
                { error: 'This bot template is under maintenance and cannot be created right now.', code: 'BOT_TEMPLATE_MAINTENANCE' },
                { status: 423 }
            );
        }

        if (body.botId && body.config && typeof body.config === 'object') {
            const bot = await Bot.findById(body.botId).select('botTier').lean();
            if ((bot as { botTier?: string } | null)?.botTier === 'free') {
                delete body.config.licenseKey;
            }
        }

        // Betting-site credentials are entered by the client and stored encrypted (D31/D32).
        const accountInput = body?.account ?? body?.config?.account ?? null;
        delete body.account;

        let account = null;
        try {
            account = buildAccountConfig(accountInput, null);
        } catch (err) {
            return NextResponse.json(
                { error: 'Account credentials cannot be stored: ' + ((err as Error)?.message ?? 'server misconfigured') },
                { status: 500 }
            );
        }

        let vpsId: mongoose.Types.ObjectId | undefined;
        if (body.vpsId !== undefined && body.vpsId !== null && body.vpsId !== '') {
            const raw = String(body.vpsId);
            if (!mongoose.Types.ObjectId.isValid(raw)) {
                return NextResponse.json({ error: 'Invalid vpsId' }, { status: 400 });
            }
            const node = await VpsNode.findOne({ _id: raw, enabled: true })
                .select('role')
                .lean<{ role?: string } | null>();
            if (!node) {
                return NextResponse.json({ error: 'VPS not found or disabled' }, { status: 404 });
            }
            if (isSurebetDesk && String(node.role ?? '').toUpperCase() !== templateType) {
                return NextResponse.json(
                    { error: `VPS role ${node.role} does not match bot type ${templateType}` },
                    { status: 400 }
                );
            }
            vpsId = new mongoose.Types.ObjectId(raw);
        } else if (isSurebetDesk) {
            return NextResponse.json({ error: 'vpsId is required for surebet bots' }, { status: 400 });
        }

        // Force userId from session
        const instanceData: any = { ...body, userId: userId, lastBalance: 0 };
        delete instanceData.vpsId;
        if (vpsId) instanceData.vpsId = vpsId;
        if (account) {
            instanceData.config = { ...(body.config ?? {}), account };
        }

        const instance = await BotInstance.create(instanceData);

        // Populate before returning to be helpful for the UI
        await instance.populate('botId');

        return NextResponse.json(stripAccountSecret(instance.toObject()), { status: 201 });
    } catch (error) {
        console.error('Error creating bot instance:', error);
        return NextResponse.json(
            { error: 'Failed to create bot instance' },
            { status: 500 }
        );
    }
}
