/**
 * Credentials entered in the dashboard must be stored encrypted, never in clear text.
 * Run: node --experimental-strip-types --test src/lib/credentialsCrypto.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    encryptSecret,
    decryptSecret,
    deriveKey,
    isEncrypted,
    maskAccount,
    buildAccountConfig,
    stripAccountSecret,
    credentialsKeyFromEnv,
} from './credentialsCrypto.ts';

const KEY = 'test-key-should-be-long-enough-1234';
const env = { CREDENTIALS_KEY: KEY } as NodeJS.ProcessEnv;

describe('credentialsCrypto', () => {
    it('round-trips a secret and never contains it in the payload', () => {
        const enc = encryptSecret('Camaleao1992@', KEY);
        assert.ok(enc.startsWith('enc:v1:'));
        assert.ok(!enc.includes('Camaleao1992@'));
        assert.equal(decryptSecret(enc, KEY), 'Camaleao1992@');
    });

    it('uses a random IV', () => {
        assert.notEqual(encryptSecret('same', KEY), encryptSecret('same', KEY));
    });

    it('refuses a wrong key', () => {
        const enc = encryptSecret('secret', KEY);
        assert.throws(() => decryptSecret(enc, 'another-key-that-is-long-enough-9'));
    });

    it('refuses a tampered payload', () => {
        const enc = encryptSecret('secret', KEY);
        const parts = enc.split(':');
        // Flip the first auth-tag / ciphertext character deterministically (avoid flaky padding-edge flips).
        const body = parts[4];
        const flip = body[0] === 'A' ? 'B' : 'A';
        const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${flip}${body.slice(1)}`;
        assert.throws(() => decryptSecret(tampered, KEY));
    });

    it('rejects malformed payloads', () => {
        for (const bad of ['', 'plain', 'enc:v2:a:b:c', 'enc:v1:a:b']) {
            assert.throws(() => decryptSecret(bad, KEY));
        }
    });

    it('enforces key length', () => {
        assert.throws(() => deriveKey('short'), /at least 16/);
        assert.throws(() => credentialsKeyFromEnv({} as NodeJS.ProcessEnv), /CREDENTIALS_KEY/);
    });

    it('masks accounts safely', () => {
        assert.equal(maskAccount('luisbarbarossitrader@gmail.com'), 'l***@gmail.com');
        assert.equal(maskAccount('ab'), '***');
    });

    it('encrypts the password and keeps the username', () => {
        const account = buildAccountConfig({ username: ' user@example.com ', password: 'pw-1' }, null, env);
        assert.ok(account);
        assert.equal(account!.username, 'user@example.com');
        assert.ok(isEncrypted(account!.secret));
        assert.equal(decryptSecret(account!.secret, KEY), 'pw-1');
    });

    it('keeps the previous secret when the password field is blank on edit', () => {
        const first = buildAccountConfig({ username: 'u@e.com', password: 'pw-1' }, null, env)!;
        const second = buildAccountConfig({ username: 'u@e.com', password: '' }, first, env);
        assert.equal(second!.secret, first.secret);
    });

    it('returns null without a username, and for a blank password with no previous secret', () => {
        assert.equal(buildAccountConfig({ username: '', password: 'x' }, null, env), null);
        assert.equal(buildAccountConfig({ username: 'u', password: '' }, null, env), null);
    });

    it('strips the secret and masks the username before sending an instance to the browser', () => {
        const instance = { name: 'bot', config: { account: { username: 'user@e.com', secret: 'enc:v1:x:y:z' } } };
        const safe = stripAccountSecret(instance);
        assert.equal(safe.config.account.username, 'u***@e.com');
        assert.equal('secret' in safe.config.account, false);
        // The original object is not mutated.
        assert.equal(instance.config.account.secret, 'enc:v1:x:y:z');
        assert.equal(instance.config.account.username, 'user@e.com');
    });
});
