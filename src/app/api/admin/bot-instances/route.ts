import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import User from '@/models/User';
import Bot from '@/models/Bot';
import { groupSurebetDesks, type SurebetDesk } from '@/lib/surebetDesks';
import type { IBotInstance } from '@/types';

function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type AdminBotRow =
    | {
          kind: 'desk';
          deskId: string;
          name: string;
          createdAt: Date | string;
          status: string;
          running: boolean;
          userId: { _id?: string; name?: string; email?: string } | null;
          betonline: IBotInstance | null;
          ps3838: IBotInstance | null;
          instanceIds: string[];
      }
    | {
          kind: 'instance';
          instance: IBotInstance;
      };

function deskStatus(desk: SurebetDesk): string {
    const statuses = [desk.betonline?.status, desk.ps3838?.status]
        .map((s) => String(s ?? '').toUpperCase())
        .filter(Boolean);
    if (statuses.includes('RUNNING')) return 'RUNNING';
    if (statuses.includes('STARTING')) return 'STARTING';
    if (statuses.includes('STOPPING')) return 'STOPPING';
    if (statuses.includes('ERROR')) return 'ERROR';
    return 'STOPPED';
}

function ownerOf(desk: SurebetDesk) {
    const seed = desk.betonline ?? desk.ps3838;
    return (seed?.userId as { _id?: string; name?: string; email?: string } | undefined) ?? null;
}

function toDeskRow(desk: SurebetDesk): AdminBotRow {
    const instanceIds = [desk.betonline, desk.ps3838]
        .filter(Boolean)
        .map((i) => String((i as IBotInstance)._id));
    return {
        kind: 'desk',
        deskId: desk.deskId,
        name: desk.name,
        createdAt: desk.createdAt,
        status: deskStatus(desk),
        running: desk.running,
        userId: ownerOf(desk),
        betonline: desk.betonline,
        ps3838: desk.ps3838,
        instanceIds,
    };
}

export async function GET(req: NextRequest) {
    const session: any = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name')?.trim() || '';
        const instanceId = searchParams.get('instanceId')?.trim() || '';
        const owner = searchParams.get('owner')?.trim() || '';
        const template = searchParams.get('template')?.trim() || '';
        const status = searchParams.get('status')?.trim() || '';
        const licenseKey = searchParams.get('licenseKey')?.trim() || '';
        const createdFrom = searchParams.get('createdFrom')?.trim() || '';
        const createdTo = searchParams.get('createdTo')?.trim() || '';
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};

        if (name) {
            filter.name = { $regex: name, $options: 'i' };
        }
        if (instanceId) {
            filter.$expr = {
                $regexMatch: {
                    input: { $toString: '$_id' },
                    regex: escapeRegex(instanceId),
                    options: 'i',
                },
            };
        }
        if (createdFrom || createdTo) {
            filter.createdAt = {} as Record<string, Date>;
            if (createdFrom) {
                (filter.createdAt as Record<string, Date>).$gte = new Date(createdFrom);
            }
            if (createdTo) {
                const d = new Date(createdTo);
                d.setHours(23, 59, 59, 999);
                (filter.createdAt as Record<string, Date>).$lte = d;
            }
        }
        if (owner) {
            const users = await User.find({
                $or: [
                    { name: { $regex: owner, $options: 'i' } },
                    { email: { $regex: owner, $options: 'i' } },
                ],
            }).select('_id');
            const userIds = users.map((u) => u._id);
            filter.userId = { $in: userIds };
        }
        if (template) {
            if (mongoose.Types.ObjectId.isValid(template)) {
                filter.botId = new mongoose.Types.ObjectId(template);
            } else {
                const bots = await Bot.find({ name: { $regex: template, $options: 'i' } }).select('_id');
                const botIds = bots.map((b: { _id: unknown }) => b._id);
                filter.botId = { $in: botIds };
            }
        }
        if (licenseKey) {
            filter['config.licenseKey'] = { $regex: licenseKey, $options: 'i' };
        }

        // Load matches, then pull in the other bookmaker leg for any deskId hit.
        const initial = (await BotInstance.find(filter)
            .populate('botId', 'name type')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .lean()) as unknown as IBotInstance[];

        const initialIds = initial.map((i) => i._id).filter(Boolean);
        const deskIds = [
            ...new Set(
                initial
                    .map((i) => String((i.config as { deskId?: string } | undefined)?.deskId ?? '').trim())
                    .filter(Boolean)
            ),
        ];
        let matched = initial;
        if (deskIds.length > 0) {
            const mates = (await BotInstance.find({
                'config.deskId': { $in: deskIds },
                ...(initialIds.length ? { _id: { $nin: initialIds } } : {}),
            })
                .populate('botId', 'name type')
                .populate('userId', 'name email')
                .lean()) as unknown as IBotInstance[];
            if (mates.length) matched = [...initial, ...mates];
        }

        const desks = groupSurebetDesks(matched);
        const deskInstanceIds = new Set<string>();
        for (const desk of desks) {
            if (desk.betonline?._id) deskInstanceIds.add(String(desk.betonline._id));
            if (desk.ps3838?._id) deskInstanceIds.add(String(desk.ps3838._id));
        }
        const leftovers = matched.filter((inst) => !deskInstanceIds.has(String(inst._id)));

        let rows: AdminBotRow[] = [
            ...desks.map(toDeskRow),
            ...leftovers.map((instance) => ({ kind: 'instance' as const, instance })),
        ];

        if (status) {
            const want = status.toUpperCase();
            rows = rows.filter((row) => {
                if (row.kind === 'desk') return row.status === want;
                return String(row.instance.status ?? '').toUpperCase() === want;
            });
        }

        rows.sort((a, b) => {
            const aMs = new Date(a.kind === 'desk' ? a.createdAt : a.instance.createdAt).getTime();
            const bMs = new Date(b.kind === 'desk' ? b.createdAt : b.instance.createdAt).getTime();
            return bMs - aMs;
        });

        const total = rows.length;
        const running = rows.filter((row) =>
            row.kind === 'desk'
                ? row.running
                : String(row.instance.status ?? '').toUpperCase() === 'RUNNING'
        ).length;
        const pageRows = rows.slice(skip, skip + limit);

        // Backward-compatible `instances` flattened for callers that still expect raw docs.
        const instances = pageRows.flatMap((row) => {
            if (row.kind === 'instance') return [row.instance];
            return [row.betonline, row.ps3838].filter(Boolean);
        });

        return NextResponse.json({
            rows: pageRows,
            instances,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
            stats: { total, running, rawInstances: matched.length },
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
