/**
 * Whitelist for PATCH /api/bot-instances/[id] (AF-10).
 * Clients must not overwrite ownership or VPS assignment except via admin-only fields.
 */

/** Users may assign an admin-managed VpsNode when creating/editing a surebet desk. */
const USER_ALLOWED = new Set(['name', 'status', 'config', 'lastBalance', 'lastHeartbeat', 'vpsId']);
const ADMIN_EXTRA = new Set<string>();

export function pickBotInstancePatch(
    body: Record<string, unknown>,
    { isAdmin }: { isAdmin: boolean }
): Record<string, unknown> {
    const allowed = new Set(USER_ALLOWED);
    if (isAdmin) {
        for (const key of ADMIN_EXTRA) allowed.add(key);
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body ?? {})) {
        if (!allowed.has(key)) continue;
        out[key] = value;
    }
    return out;
}
