import crypto from 'node:crypto';

/**
 * At-rest encryption for betting-site credentials entered by a client when creating a bot.
 *
 * Mirrors mainbot/lib/central/credentialsCrypto.js exactly: AES-256-GCM, payload
 * `enc:v1:<iv b64>:<tag b64>:<ciphertext b64>`. Both sides are covered by tests; changing the format in one place
 * without the other makes stored credentials unreadable.
 */

const PREFIX = 'enc:v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Derives a 32-byte key from CREDENTIALS_KEY (any length). */
export function deriveKey(rawKey: string): Buffer {
    const value = String(rawKey ?? '');
    if (value.length < 16) {
        throw new Error('CREDENTIALS_KEY must be at least 16 characters');
    }
    return crypto.createHash('sha256').update(value, 'utf8').digest();
}

/** Encrypts a secret for storage. */
export function encryptSecret(plain: string, rawKey: string): string {
    if (typeof plain !== 'string' || plain.length === 0) {
        throw new Error('secret must be a non-empty string');
    }
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(rawKey), iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** Decrypts a stored secret. Throws on tampering or a wrong key. */
export function decryptSecret(payload: string, rawKey: string): string {
    const parts = String(payload ?? '').split(':');
    if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== PREFIX) {
        throw new Error('unsupported credential payload');
    }
    const iv = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const ciphertext = Buffer.from(parts[4], 'base64');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        throw new Error('invalid credential payload');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(rawKey), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** True when a value is already encrypted. */
export function isEncrypted(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

/** Safe display form: keeps the domain, hides the local part. */
export function maskAccount(username: string | null | undefined): string {
    const value = String(username ?? '');
    const at = value.indexOf('@');
    if (at > 1) return `${value[0]}***${value.slice(at)}`;
    return value.length <= 2 ? '***' : `${value[0]}***`;
}

/** Key used by the app; read from the environment so it is never in the repository. */
export function credentialsKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string {
    const key = String(env.CREDENTIALS_KEY ?? '');
    if (key.length < 16) {
        throw new Error('CREDENTIALS_KEY is not configured (needs at least 16 characters)');
    }
    return key;
}

/**
 * Builds the `config.account` value stored on a BotInstance.
 * Returns the previous value untouched when the password field was left blank by the edit form.
 */
export function buildAccountConfig(
    input: { username?: string; password?: string } | null | undefined,
    previous: { username?: string; secret?: string } | null | undefined,
    env: NodeJS.ProcessEnv = process.env,
): { username: string; secret: string } | null {
    const username = String(input?.username ?? '').trim();
    const password = String(input?.password ?? '');
    if (!username) return null;
    if (!password) {
        // Keep the stored secret when the user did not retype the password.
        return previous?.secret ? { username, secret: previous.secret } : null;
    }
    return { username, secret: encryptSecret(password, credentialsKeyFromEnv(env)) };
}

/** Removes the secret (and masks username) before a bot instance is sent to the browser. */
export function stripAccountSecret<T extends Record<string, any>>(instance: T): T {
    if (!instance?.config?.account) return instance;
    const account = { ...instance.config.account };
    delete account.secret;
    if (typeof account.username === 'string') {
        account.usernameMasked = maskAccount(account.username);
        // Keep a truncated username for UI labels; never send the full local-part when it looks like an email.
        account.username = maskAccount(account.username);
    }
    return { ...instance, config: { ...instance.config, account } } as T;
}
