/**
 * Resolves which mainbot control URL to call for a bot instance (AF-10).
 *
 * Precedence:
 *   1. BOTMANAGER_URL__<vpsId>
 *   2. BOTMANAGER_URL_<BETONLINE|PS3838> from bot type
 *   3. NEXT_PUBLIC_BOTMANAGER_URL / BOTMANAGER_URL
 */

export type BotManagerTarget = {
    url: string;
    headers: Record<string, string>;
};

function trimSlash(url: string): string {
    return String(url ?? '').trim().replace(/\/+$/, '');
}

export function botControlHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
    const token = String(env.BOT_CONTROL_TOKEN || env.TIP_RECEIVE_TOKEN || '').trim();
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    return headers;
}

export function resolveBotManagerUrl(params: {
    vpsId?: string | null;
    botType?: string | null;
    env?: NodeJS.ProcessEnv;
}): string {
    const env = params.env ?? process.env;
    const vpsId = String(params.vpsId ?? '').trim();
    if (vpsId) {
        const keyed = trimSlash(env[`BOTMANAGER_URL__${vpsId}`] ?? '');
        if (keyed) return keyed;
    }
    const role = String(params.botType ?? '').trim().toUpperCase();
    if (role === 'BETONLINE' || role === 'PS3838') {
        const byRole = trimSlash(env[`BOTMANAGER_URL_${role}`] ?? '');
        if (byRole) return byRole;
    }
    return trimSlash(env.BOTMANAGER_URL || env.NEXT_PUBLIC_BOTMANAGER_URL || 'http://localhost:4000');
}

export function botManagerTarget(params: {
    vpsId?: string | null;
    botType?: string | null;
    env?: NodeJS.ProcessEnv;
}): BotManagerTarget {
    const env = params.env ?? process.env;
    return {
        url: resolveBotManagerUrl({ ...params, env }),
        headers: botControlHeaders(env),
    };
}
