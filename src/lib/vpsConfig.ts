/**
 * VPS addresses are operator configuration, so they live in this project's .env file and are never hard-coded.
 *
 *   VPS_BETONLINE_ADDRESS=168.121.74.27
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

/** Everything the dashboard needs to reach one VPS. */
export interface VpsConnection {
    /** host or host:port of the VPS agent. */
    address: string;
    /** Username the client presents to that VPS. */
    username: string;
    /** Password the client presents to that VPS. Never logged, never sent to the browser. */
    password: string;
}

/**
 * Reads the login this client uses for one VPS.
 * Variables: VPS_<ROLE>_ADDRESS, VPS_<ROLE>_USERNAME, VPS_<ROLE>_PASSWORD.
 * Returns null when the role is not configured at all; throws when it is half configured.
 */
export function readVpsConnection(role: VpsRole, env: NodeJS.ProcessEnv = process.env): VpsConnection | null {
    if (!VPS_ROLES.includes(role)) {
        throw new Error(`unknown VPS role: ${role}`);
    }

    const address = String(env[`VPS_${role}_ADDRESS`] ?? '').trim();
    const username = String(env[`VPS_${role}_USERNAME`] ?? '').trim();
    const password = String(env[`VPS_${role}_PASSWORD`] ?? '');

    if (!address && !username && !password) return null;
    if (!isValidVpsAddress(address)) {
        throw new Error(`VPS_${role}_ADDRESS must be host or host:port`);
    }
    if (!username || !password) {
        throw new Error(`VPS_${role}_USERNAME and VPS_${role}_PASSWORD are required when the address is set`);
    }

    return { address, username, password };
}

/** Both VPS connections, when fully configured. */
export function readAllVpsConnections(env: NodeJS.ProcessEnv = process.env): VpsConnection[] {
    return VPS_ROLES.map((role) => readVpsConnection(role, env)).filter((c): c is VpsConnection => c !== null);
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
