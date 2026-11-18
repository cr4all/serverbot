/**
 * Client-facing preflight for the distributed surebet path.
 *
 * A Run is only useful when both bookmaker accounts exist (the VPS resolves them from the database) and both VPS
 * connections are configured. This module answers "which piece is missing" before any VPS call is made.
 */
import connectDB from '@/lib/db';
import Bot from '@/models/Bot';
import BotInstance from '@/models/BotInstance';

export const SUREBET_ROLES = ['BETONLINE', 'PS3838'] as const;
export type SurebetRole = (typeof SUREBET_ROLES)[number];

export type SurebetAccountStatus = Record<SurebetRole, boolean>;

/** True when the instance has both a username and an encrypted secret. */
export function hasStoredAccount(instance: { config?: { account?: { username?: string; secret?: string } } } | null): boolean {
    const account = instance?.config?.account;
    return Boolean(account?.username && account?.secret);
}

/** Roles with at least one stored account for this client. */
export async function findSurebetAccounts(userId: string): Promise<SurebetAccountStatus> {
    const status: SurebetAccountStatus = { BETONLINE: false, PS3838: false };
    if (!userId) return status;

    await connectDB();

    const templates = await Bot.find({ type: { $in: [...SUREBET_ROLES] } })
        .select('_id type')
        .lean();

    for (const template of templates) {
        const role = String(template.type).toUpperCase() as SurebetRole;
        if (!SUREBET_ROLES.includes(role) || status[role]) continue;

        const instance = await BotInstance.findOne({ userId, botId: template._id })
            .select('config.account')
            .lean();
        if (hasStoredAccount(instance as { config?: { account?: { username?: string; secret?: string } } } | null)) {
            status[role] = true;
        }
    }

    return status;
}

/** Missing roles, in display order. */
export function missingSurebetAccounts(status: SurebetAccountStatus): SurebetRole[] {
    return SUREBET_ROLES.filter((role) => !status[role]);
}
