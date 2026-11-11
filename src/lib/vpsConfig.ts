/**
 * VPS addresses are operator configuration, so they live in this project's .env file and are never hard-coded.
 *
 *   VPS_BETONLINE_ADDRESS=remote.pjoplus.com.br:55317
 *   VPS_PS3838_ADDRESS=168.121.74.26
 *
 * A port is optional; when present it must be 1..65535.
 */

export type VpsRole = 'BETONLINE' | 'PS3838';

export const VPS_ROLES: VpsRole[] = ['BETONLINE', 'PS3838'];

const HOST = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;

/** Validates `host` or `host:port`. */
export function isValidVpsAddress(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) return false;
    const parts = value.split(':');
    if (parts.length > 2) return false;
    const [host, port] = parts;
    if (!HOST.test(host)) return false;
    if (port === undefined) return true;
    if (!/^\d{1,5}$/.test(port)) return false;
    const n = Number(port);
    return n >= 1 && n <= 65535;
}

/** Reads both VPS addresses. Missing entries are simply absent; malformed ones throw. */
export function readVpsAddresses(env: NodeJS.ProcessEnv = process.env): Partial<Record<VpsRole, string>> {
    const result: Partial<Record<VpsRole, string>> = {};
    for (const role of VPS_ROLES) {
        const raw = String(env[`VPS_${role}_ADDRESS`] ?? '').trim();
        if (!raw) continue;
        if (!isValidVpsAddress(raw)) {
            throw new Error(`VPS_${role}_ADDRESS must be host or host:port`);
        }
        result[role] = raw;
    }
    return result;
}

/** Address of one VPS, or null when it is not configured. */
export function vpsAddressFor(role: VpsRole, env: NodeJS.ProcessEnv = process.env): string | null {
    if (!VPS_ROLES.includes(role)) {
        throw new Error(`unknown VPS role: ${role}`);
    }
    return readVpsAddresses(env)[role] ?? null;
}

/** True when both VPS addresses are configured, which is what a working deployment needs. */
export function hasBothVpsAddresses(env: NodeJS.ProcessEnv = process.env): boolean {
    const addresses = readVpsAddresses(env);
    return Boolean(addresses.BETONLINE && addresses.PS3838);
}

/** Safe display list for the dashboard: role plus address, never anything secret. */
export function describeVpsAddresses(env: NodeJS.ProcessEnv = process.env): Array<{ role: VpsRole; address: string | null }> {
    const addresses = readVpsAddresses(env);
    return VPS_ROLES.map((role) => ({ role, address: addresses[role] ?? null }));
}
