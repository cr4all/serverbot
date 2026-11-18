import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import Bot from '@/models/Bot';
import { allowedLocalesErrorMessage, isValidLocale } from '@/lib/locales';
import { buildAccountConfig, stripAccountSecret } from '@/lib/credentialsCrypto';
import { pickBotInstancePatch } from '@/lib/botInstancePatch';
import { botManagerTarget } from '@/lib/botManagerUrl';
import VpsNode from '@/models/VpsNode';
import mongoose from 'mongoose';

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

        const query: any = { _id: id };
        if ((session.user as any).role !== 'admin') {
            query.userId = (session.user as any).id;
        }

        const instance = await BotInstance.findOne(query).populate('botId').populate('userId', 'name');

        if (!instance) {
            return NextResponse.json(
                { error: 'Bot instance not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json(stripAccountSecret(instance.toObject()));
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

        const isAdmin = (session.user as any).role === 'admin';
        const { id } = await params;
        const rawBody = await request.json();
        const body = pickBotInstancePatch(rawBody ?? {}, { isAdmin }) as any;
        await connectDB();

        if (body?.config?.locale && !isValidLocale(body.config.locale)) {
            return NextResponse.json({ error: allowedLocalesErrorMessage() }, { status: 400 });
        }

        // Ensure user owns the instance
        const updateQuery: any = { _id: id };
        if ((session.user as any).role !== 'admin') {
            updateQuery.userId = (session.user as any).id;
        }

        if (body?.status && String(body.status).toUpperCase() === 'RUNNING') {
            const inst = await BotInstance.findOne(updateQuery).select('botId').lean<{ botId?: unknown } | null>();
            if (!inst?.botId) {
                return NextResponse.json({ error: 'Bot instance not found or unauthorized' }, { status: 404 });
            }
            const t = await Bot.findById(inst.botId)
                .select('templateStatus name')
                .lean<{ templateStatus?: 'AVAILABLE' | 'MAINTENANCE'; name?: string } | null>();
            if (!isAdmin && t?.templateStatus === 'MAINTENANCE') {
                return NextResponse.json(
                    { error: 'This bot template is under maintenance and cannot be started right now.', code: 'BOT_TEMPLATE_MAINTENANCE' },
                    { status: 423 }
                );
            }
        }

        if (body?.config && typeof body.config === 'object') {
            const existingForTier = await BotInstance.findOne(updateQuery).populate('botId');
            const tier = (existingForTier?.botId as { botTier?: string } | null)?.botTier;
            if (tier === 'free') {
                delete body.config.licenseKey;
            }
        }

        // Betting-site credentials: encrypt on save, keep the old secret when the password is left blank.
        const accountInput = rawBody?.account ?? rawBody?.config?.account ?? null;
        if (body?.config) delete body.config.account;
        if (accountInput) {
            const current = await BotInstance.findOne(updateQuery).select('config.account').lean<any>();
            try {
                const account = buildAccountConfig(accountInput, current?.config?.account ?? null);
                body.config = { ...(body.config ?? current?.config ?? {}), ...(account ? { account } : {}) };
                if (!account && body.config) delete body.config.account;
            } catch (err) {
                return NextResponse.json(
                    { error: 'Account credentials cannot be stored: ' + ((err as Error)?.message ?? 'server misconfigured') },
                    { status: 500 }
                );
            }
        }

        if (body.vpsId !== undefined && body.vpsId !== null && body.vpsId !== '') {
            const raw = String(body.vpsId);
            if (!mongoose.Types.ObjectId.isValid(raw)) {
                return NextResponse.json({ error: 'Invalid vpsId' }, { status: 400 });
            }
            const existing = await BotInstance.findOne(updateQuery).populate('botId', 'type').lean<{
                botId?: { type?: string } | null;
            } | null>();
            const templateType = String(existing?.botId?.type ?? '').toUpperCase();
            const node = await VpsNode.findOne({ _id: raw, enabled: true })
                .select('role')
                .lean<{ role?: string } | null>();
            if (!node) {
                return NextResponse.json({ error: 'VPS not found or disabled' }, { status: 404 });
            }
            if (
                (templateType === 'BETONLINE' || templateType === 'PS3838') &&
                String(node.role ?? '').toUpperCase() !== templateType
            ) {
                return NextResponse.json(
                    { error: `VPS role ${node.role} does not match bot type ${templateType}` },
                    { status: 400 }
                );
            }
            body.vpsId = new mongoose.Types.ObjectId(raw);
        } else if (body.vpsId !== undefined) {
            delete body.vpsId;
        }

        const instance = await BotInstance.findOneAndUpdate(
            updateQuery,
            { $set: body },
            { new: true, runValidators: true }
        ).populate('botId');

        if ('status' in body) {
            try {
                const botType = String((instance?.botId as { type?: string } | null)?.type ?? '').toUpperCase();
                const target = botManagerTarget({
                    vpsId: instance?.vpsId ? String(instance.vpsId) : null,
                    botType,
                });
                let api_path = '';
                if (String(body.status).toLowerCase() === 'running') {
                    api_path = 'start';
                } else if (String(body.status).toLowerCase() === 'stopped') {
                    api_path = 'stop';
                }
                if (api_path) {
                    const res = await fetch(`${target.url}/bot/${api_path}/${id}`, {
                        headers: target.headers,
                    });
                    if (res.ok) {
                        return NextResponse.json(
                            { message: `Bot instance is ${api_path}`, instance: stripAccountSecret(instance!.toObject()) },
                            { status: 200 }
                        );
                    }
                    const detail = await res.text().catch(() => '');
                    return NextResponse.json(
                        { error: 'Failed to update bot instance on VPS', detail: detail.slice(0, 300) },
                        { status: 500 }
                    );
                }
            } catch (error) {
                console.error('Failed to reach bot manager', error);
                return NextResponse.json(
                    { error: 'Failed to reach bot manager' },
                    { status: 502 }
                );
            }
        }

        if (!instance) {
            return NextResponse.json(
                { error: 'Bot instance not found or unauthorized' },
                { status: 404 }
            );
        }

        return NextResponse.json(stripAccountSecret(instance.toObject()));
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

        const deleteQuery: any = { _id: id };
        if ((session.user as any).role !== 'admin') {
            deleteQuery.userId = (session.user as any).id;
        }

        const instance = await BotInstance.findOneAndDelete(deleteQuery);

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
