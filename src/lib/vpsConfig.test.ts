/**
 * VPS addresses come from the client project's .env; nothing is hard-coded.
 * Run: node --experimental-strip-types --test src/lib/vpsConfig.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    readVpsAddresses,
    vpsAddressFor,
    hasBothVpsAddresses,
    isValidVpsAddress,
    describeVpsAddresses,
} from './vpsConfig.ts';

const env = {
    VPS_BETONLINE_ADDRESS: 'remote.pjoplus.com.br:55317',
    VPS_PS3838_ADDRESS: '168.121.74.26',
} as NodeJS.ProcessEnv;

describe('vpsConfig', () => {
    it('reads both addresses from env', () => {
        assert.deepEqual(readVpsAddresses(env), {
            BETONLINE: 'remote.pjoplus.com.br:55317',
            PS3838: '168.121.74.26',
        });
    });

    it('returns an empty object when nothing is configured', () => {
        assert.deepEqual(readVpsAddresses({} as NodeJS.ProcessEnv), {});
        assert.equal(hasBothVpsAddresses({} as NodeJS.ProcessEnv), false);
    });

    it('accepts a host with or without a port', () => {
        for (const good of ['168.121.74.26', 'remote.pjoplus.com.br:55317', 'host:1', 'host:65535']) {
            assert.equal(isValidVpsAddress(good), true, good);
        }
    });

    it('rejects malformed addresses', () => {
        for (const bad of ['', 'http://host:1', 'host:', ':80', 'host:99999', 'host:abc', 'a:b:c', ' host']) {
            assert.equal(isValidVpsAddress(bad), false, bad);
        }
    });

    it('throws on a malformed configured address instead of silently ignoring it', () => {
        assert.throws(() => readVpsAddresses({ VPS_PS3838_ADDRESS: 'not an address' } as NodeJS.ProcessEnv), /VPS_PS3838_ADDRESS/);
    });

    it('reads one role', () => {
        assert.equal(vpsAddressFor('BETONLINE', env), 'remote.pjoplus.com.br:55317');
        assert.equal(vpsAddressFor('PS3838', {} as NodeJS.ProcessEnv), null);
    });

    it('reports when both are configured', () => {
        assert.equal(hasBothVpsAddresses(env), true);
        assert.equal(hasBothVpsAddresses({ VPS_BETONLINE_ADDRESS: 'h:1' } as NodeJS.ProcessEnv), false);
    });

    it('describes both roles for the dashboard', () => {
        assert.deepEqual(describeVpsAddresses(env), [
            { role: 'BETONLINE', address: 'remote.pjoplus.com.br:55317' },
            { role: 'PS3838', address: '168.121.74.26' },
        ]);
    });

    it('never contains a credential', () => {
        const text = JSON.stringify(describeVpsAddresses(env));
        assert.equal(/password|secret|token/i.test(text), false);
    });
});
