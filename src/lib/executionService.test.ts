/**
 * Client-side execution: both legs or nothing, and never a silent success.
 * Run: node --experimental-strip-types --test src/lib/executionService.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeTip } from './executionService.ts';

const LEGS = [
    { bookmaker: 'BETONLINE', eventName: 'A - B', sport: 'basketball', marketType: 'winner', period: 'incl_ot', line: null, selection: 'team1', odds: 1.59, stakeRatio: 0.6454 },
    { bookmaker: 'PS3838', eventName: 'A Cal - B Cal', sport: 'basketball', marketType: 'winner', period: 'incl_ot', line: null, selection: 'team2', odds: 2.89, stakeRatio: 0.3546 },
];

function fakeVps(overrides: any = {}) {
    const calls = { prepare: 0, commit: 0, verify: 0 };
    return {
        calls,
        prepare: async () => {
            calls.prepare += 1;
            return { ok: true, odds: 1.59 };
        },
        commit: async () => {
            calls.commit += 1;
            return { ok: true, orderId: 'ORD-1' };
        },
        verify: async () => {
            calls.verify += 1;
            return { found: true, orderId: 'ORD-1' };
        },
        ...overrides,
    };
}

const base = (vps: any, save?: any) => ({ tipId: 'tip-1', clientId: 'client-a', stake: 100, legs: LEGS as any, deps: { vps, save } });

describe('executeTip', () => {
    it('places both legs and reports DONE when both sites confirm', async () => {
        const bo = fakeVps();
        const ps = fakeVps();
        const saved: any[] = [];
        const record = await executeTip(base({ BETONLINE: bo, PS3838: ps }, async (r: any) => saved.push(r)));

        assert.equal(record.state, 'DONE');
        assert.equal(bo.calls.commit, 1);
        assert.equal(ps.calls.commit, 1);
        assert.equal(bo.calls.verify, 1);
        assert.equal(ps.calls.verify, 1);
        assert.deepEqual(record.legs.map((l) => l.state), ['VERIFIED', 'VERIFIED']);
        assert.equal(saved.length, 1);
    });

    it('splits the stake by stake ratio', async () => {
        const seen: number[] = [];
        const bo = fakeVps({ commit: async (_e: string, _c: string, _l: any, stake: number) => { seen.push(stake); return { ok: true, orderId: 'A' }; } });
        const ps = fakeVps({ commit: async (_e: string, _c: string, _l: any, stake: number) => { seen.push(stake); return { ok: true, orderId: 'B' }; } });
        await executeTip(base({ BETONLINE: bo, PS3838: ps }));
        assert.deepEqual(seen.sort((a, b) => a - b), [35.46, 64.54]);
    });

    it('places nothing when one side is not ready', async () => {
        const bo = fakeVps();
        const ps = fakeVps({ prepare: async () => ({ ok: false, reason: 'odds moved' }) });
        const record = await executeTip(base({ BETONLINE: bo, PS3838: ps }));

        assert.equal(record.state, 'ABORTED');
        assert.equal(bo.calls.commit, 0, 'the ready side must not be committed alone');
        assert.equal(ps.calls.commit, 0);
    });

    it('places nothing when a VPS is not configured', async () => {
        const bo = fakeVps();
        const record = await executeTip(base({ BETONLINE: bo }));

        assert.equal(record.state, 'ABORTED');
        assert.match(record.note ?? '', /PS3838/);
        assert.equal(bo.calls.prepare, 0, 'no call at all when the other side is missing');
    });

    it('reports ONE_LEG when only one commit is accepted', async () => {
        const bo = fakeVps();
        const ps = fakeVps({ commit: async () => ({ ok: false, reason: 'bet rejected' }) });
        const record = await executeTip(base({ BETONLINE: bo, PS3838: ps }));

        assert.equal(record.state, 'ONE_LEG');
        assert.match(record.note ?? '', /PS3838=REJECTED/);
        assert.equal(bo.calls.verify, 1);
        assert.equal(ps.calls.verify, 0);
    });

    it('reports ONE_LEG when one site does not show the bet', async () => {
        const bo = fakeVps();
        const ps = fakeVps({ verify: async () => ({ found: false }) });
        const record = await executeTip(base({ BETONLINE: bo, PS3838: ps }));

        assert.equal(record.state, 'ONE_LEG');
        assert.deepEqual(record.legs.map((l) => l.state), ['VERIFIED', 'MISSING']);
    });

    it('reports REVIEW_NEEDED when neither site confirms', async () => {
        const bo = fakeVps({ verify: async () => ({ found: false }) });
        const ps = fakeVps({ verify: async () => ({ found: false }) });
        const record = await executeTip(base({ BETONLINE: bo, PS3838: ps }));

        assert.equal(record.state, 'REVIEW_NEEDED');
        assert.match(record.note ?? '', /site confirmation missing/);
    });

    it('reports ABORTED when both commits are rejected', async () => {
        const bo = fakeVps({ commit: async () => ({ ok: false, reason: 'x' }) });
        const ps = fakeVps({ commit: async () => ({ ok: false, reason: 'y' }) });
        const record = await executeTip(base({ BETONLINE: bo, PS3838: ps }));
        assert.equal(record.state, 'ABORTED');
    });

    it('treats a VPS network error during prepare as not ready', async () => {
        const bo = fakeVps({ prepare: async () => { throw new Error('ECONNRESET'); } });
        const ps = fakeVps();
        const record = await executeTip(base({ BETONLINE: bo, PS3838: ps }));

        assert.equal(record.state, 'ABORTED');
        assert.match(record.legs[0].reason ?? '', /ECONNRESET/);
        assert.equal(ps.calls.commit, 0);
    });

    it('uses the injected clock and id for a deterministic record', async () => {
        const bo = fakeVps();
        const ps = fakeVps();
        const record = await executeTip({
            ...base({ BETONLINE: bo, PS3838: ps }),
            deps: { vps: { BETONLINE: bo, PS3838: ps }, now: () => new Date('2026-11-06T20:00:00Z'), idFactory: () => 'ex_fixed' },
        });
        assert.equal(record.executionId, 'ex_fixed');
        assert.equal(record.createdAt, '2026-11-06T20:00:00.000Z');
    });
});
