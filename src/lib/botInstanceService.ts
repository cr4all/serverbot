import connectDB from '@/lib/db';
import Bot from '@/models/Bot';
import '@/models/User';
import BotInstance from '@/models/BotInstance';
import BotAssignment from '@/models/BotAssignment';
import { normalizeFilterConfig, validateFilterConfig } from '@/lib/botInstanceFilters';
import { mainbotFetch } from '@/lib/mainbotClient';

export const ALLOWED_LOCALES = ['COMMON', 'UNITED_KINGDOM', 'SPAIN', 'ITALY', 'GREECE', 'AUSTRALIA', 'FINLAND', 'BRAZIL'];

export type ServiceFailure = { ok: false; status: number; error: string; code?: string };

export function validateLocale(config: unknown): ServiceFailure | null {
    const locale = (config as { locale?: unknown } | null | undefined)?.locale;
    if (locale && !ALLOWED_LOCALES.includes(locale as string)) {
        return { ok: false, status: 400, error: `Invalid locale. Allowed: ${ALLOWED_LOCALES.join(', ')}` };
    }
    return null;
}

export async function createInstanceForUser({
    userId,
    isAdmin,
    body,
}: {
    userId: string;
    isAdmin: boolean;
    body: any;
}): Promise<{ ok: true; instance: any } | ServiceFailure> {
    await connectDB();

    const localeErr = validateLocale(body?.config);
    if (localeErr) return localeErr;

    if (!isAdmin) {
        const botId = body?.botId;
        if (!botId) {
            return { ok: false, status: 400, error: 'botId is required' };
        }
        const allowed = await BotAssignment.findOne({ botId, userId });
        if (!allowed) {
            return { ok: false, status: 403, error: 'Forbidden: bot template not assigned to user' };
        }
    }

    if (body?.botId) {
        const t = await Bot.findById(body.botId)
            .select('templateStatus name')
            .lean<{ templateStatus?: 'AVAILABLE' | 'MAINTENANCE'; name?: string } | null>();
        if (!isAdmin && t?.templateStatus === 'MAINTENANCE') {
            return {
                ok: false,
                status: 423,
                error: 'This bot template is under maintenance and cannot be created right now.',
                code: 'BOT_TEMPLATE_MAINTENANCE',
            };
        }
    }

    if (body?.botId && body.config && typeof body.config === 'object') {
        const bot = await Bot.findById(body.botId).select('botTier').lean();
        if ((bot as { botTier?: string } | null)?.botTier === 'free') {
            delete body.config.licenseKey;
        }
    }

    if (body?.config && typeof body.config === 'object') {
        body.config = normalizeFilterConfig(body.config);
        const filterCheck = validateFilterConfig(body.config);
        if (!filterCheck.ok) {
            return { ok: false, status: 400, error: filterCheck.error };
        }
    }

    const instanceData = { ...body, userId, lastBalance: 0 };
    const instance = await BotInstance.create(instanceData);
    await instance.populate('botId');
    return { ok: true, instance };
}

export function ownedInstanceQuery(id: string, userId: string, isAdmin: boolean): Record<string, unknown> {
    const q: Record<string, unknown> = { _id: id };
    if (!isAdmin) q.userId = userId;
    return q;
}

/** Blocks non-admin starts of a template under maintenance. */
export async function checkStartAllowed(
    query: Record<string, unknown>,
    isAdmin: boolean
): Promise<ServiceFailure | null> {
    const inst = await BotInstance.findOne(query).select('botId').lean<{ botId?: unknown } | null>();
    if (!inst?.botId) {
        return { ok: false, status: 404, error: 'Bot instance not found or unauthorized' };
    }
    const t = await Bot.findById(inst.botId)
        .select('templateStatus name')
        .lean<{ templateStatus?: 'AVAILABLE' | 'MAINTENANCE'; name?: string } | null>();
    if (!isAdmin && t?.templateStatus === 'MAINTENANCE') {
        return {
            ok: false,
            status: 423,
            error: 'This bot template is under maintenance and cannot be started right now.',
            code: 'BOT_TEMPLATE_MAINTENANCE',
        };
    }
    return null;
}

export function mainbotActionForStatus(status: unknown): '' | 'start' | 'stop' {
    const s = String(status ?? '').toLowerCase();
    if (s === 'running') return 'start';
    if (s === 'stopped') return 'stop';
    return '';
}

/** Calls mainbot `/bot/start|stop/{id}`. Throws on network error (callers keep the old fallthrough). */
export async function notifyMainbotStatus(id: string, status: unknown): Promise<{ ok: boolean; action: string }> {
    const action = mainbotActionForStatus(status);
    const res = await mainbotFetch(`/bot/${action}/${id}`);
    return { ok: res.ok, action };
}

export async function setInstanceStatus({
    userId,
    isAdmin,
    id,
    status,
}: {
    userId: string;
    isAdmin: boolean;
    id: string;
    status: 'RUNNING' | 'STOPPED';
}): Promise<{ ok: true; action: string; instance: any } | ServiceFailure> {
    await connectDB();
    const query = ownedInstanceQuery(id, userId, isAdmin);

    if (status === 'RUNNING') {
        const blocked = await checkStartAllowed(query, isAdmin);
        if (blocked) return blocked;
    }

    const instance = await BotInstance.findOneAndUpdate(
        query,
        { $set: { status } },
        { new: true, runValidators: true }
    );
    if (!instance) {
        return { ok: false, status: 404, error: 'Bot instance not found or unauthorized' };
    }

    try {
        const r = await notifyMainbotStatus(id, status);
        if (!r.ok) return { ok: false, status: 500, error: 'Failed to update bot instance' };
        return { ok: true, action: r.action, instance };
    } catch (error) {
        console.error('Failed to reach mainbot', error);
        return { ok: false, status: 502, error: 'Bot server is not reachable' };
    }
}

/** Balance from mainbot, falling back to the stored `lastBalance`. */
export async function fetchInstanceBalance(
    id: string,
    lastBalance: unknown
): Promise<{ balance: number | null; source: 'live' | 'cached' }> {
    try {
        const res = await mainbotFetch(`/bot/balance/${id}`, { signal: AbortSignal.timeout(20_000) });
        if (res.ok) {
            const data = await res.json().catch(() => null);
            const b = Number(data?.balance);
            if (data && data.balance != null && Number.isFinite(b)) return { balance: b, source: 'live' };
        }
    } catch (error) {
        console.error('Failed to fetch balance from mainbot', error);
    }
    const cached = Number(lastBalance);
    return { balance: Number.isFinite(cached) ? cached : null, source: 'cached' };
}
