/**
 * Run: node --experimental-strip-types --import ./scripts/register-ts-ext.mjs --test src/lib/botManagerUrl.test.ts src/lib/botInstancePatch.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { botControlHeaders, resolveBotManagerUrl } from './botManagerUrl.ts';
import { pickBotInstancePatch } from './botInstancePatch.ts';

describe('botManagerUrl', () => {
    it('prefers per-vps url then role then default', () => {
        const env = {
            BOTMANAGER_URL__abc: 'http://vps-a:4000',
            BOTMANAGER_URL_BETONLINE: 'http://bol:4000',
            NEXT_PUBLIC_BOTMANAGER_URL: 'http://default:4000',
        } as NodeJS.ProcessEnv;
        assert.equal(resolveBotManagerUrl({ vpsId: 'abc', botType: 'BETONLINE', env }), 'http://vps-a:4000');
        assert.equal(resolveBotManagerUrl({ botType: 'BETONLINE', env }), 'http://bol:4000');
        assert.equal(resolveBotManagerUrl({ env }), 'http://default:4000');
    });

    it('adds bearer token when configured', () => {
        assert.deepEqual(botControlHeaders({ BOT_CONTROL_TOKEN: 'sekret' }), {
            authorization: 'Bearer sekret',
        });
        assert.deepEqual(botControlHeaders({}), {});
    });
});

describe('pickBotInstancePatch', () => {
    it('strips ownership fields for users and allows vpsId for admin', () => {
        const body = {
            name: 'n',
            status: 'RUNNING',
            userId: 'hack',
            botId: 'hack',
            vpsId: 'v1',
            config: { locale: 'en' },
        };
        assert.deepEqual(pickBotInstancePatch(body, { isAdmin: false }), {
            name: 'n',
            status: 'RUNNING',
            config: { locale: 'en' },
        });
        assert.equal(pickBotInstancePatch(body, { isAdmin: true }).vpsId, 'v1');
    });
});
