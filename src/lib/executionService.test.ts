/**
 * Client-side execution: both legs or nothing, and never a silent success.
 * Run: node --experimental-strip-types --test src/lib/executionService.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeTip } from './executionService.ts';
import type { VpsLeg } from './vpsClient.ts';

const LEGS = [
    { bookmaker: 'BETONLINE', eventName: 'A - B', sport: 'basketball', marketType: 'winner', period: 'incl_ot', line: null, selection: 'team1', odds: 1.59, stakeRatio: 0.6454 },
    { bookmaker: 'PS3838', eventName: 'A Cal - B Cal', sport: 'basketball', marketType: 'winner', period: 'incl_ot', line: null, selection: 'team2', odds: 2.89, stakeRatio: 0.3546 },
];

function fakeVps(overrides: any = {}) {
    const calls = { prepare: 0, commit: 0, verify: 0 };
    return {
        calls,
        prepare: async (_executionId: string, _clientId: string, leg: any) => {
            calls.prepare += 1;
            return { ok: true, odds: Number(leg?.odds ?? 1.59) };
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

    it('recalculates the stake split from moved odds when the pair is still a surebet', async () => {
        const MOVED_LEGS: VpsLeg[] = [
            { bookmaker: 'BETONLINE', eventName: 'A - B', sport: 'basketball', marketType: 'winner', period: 'incl_ot', line: null, selection: 'team1', odds: 1.95, stakeRatio: 0.52 },
            { bookmaker: 'PS3838', eventName: 'A - B', sport: 'basketball', marketType: 'winner', period: 'incl_ot', line: null, selection: 'team2', odds: 2.1, stakeRatio: 0.48 },
        ];
        const seen: number[] = [];
        const bo = fakeVps({
            prepare: async () => ({ ok: true, odds: 2.0 }),
            commit: async (_e: string, _c: string, _l: any, stake: number) => {
                seen.push(stake);
                return { ok: true, orderId: 'BO' };
            },
        });
        const ps = fakeVps({
            prepare: async () => ({ ok: true, odds: 2.08 }),
            commit: async (_e: string, _c: string, _l: any, stake: number) => {
                seen.push(stake);
                return { ok: true, orderId: 'PS' };
            },
        });

        const record = await executeTip({
            tipId: 'tip-moved',
            clientId: 'client-a',
            stake: 100,
            legs: MOVED_LEGS,
            deps: { vps: { BETONLINE: bo, PS3838: ps }, nearbyEnabled: true },
        });

        assert.equal(record.state, 'DONE');
        assert.deepEqual(seen.sort((a, b) => a - b), [49.02, 50.98]);
    });

    it('aborts when moved odds no longer form a surebet', async () => {
        const MOVED_LEGS: VpsLeg[] = [
            { bookmaker: 'BETONLINE', eventName: 'A - B', sport: 'basketball', marketType: 'winner', period: 'incl_ot', line: null, selection: 'team1', odds: 1.99, stakeRatio: 0.51 },
            { bookmaker: 'PS3838', eventName: 'A - B', sport: 'basketball', marketType: 'winner', period: 'incl_ot', line: null, selection: 'team2', odds: 2.02, stakeRatio: 0.49 },
        ];
        const bo = fakeVps({ prepare: async () => ({ ok: true, odds: 1.98 }) });
        const ps = fakeVps({ prepare: async () => ({ ok: true, odds: 2.01 }) });

        const record = await executeTip({
            tipId: 'tip-no-edge',
            clientId: 'client-a',
            stake: 100,
            legs: MOVED_LEGS,
            deps: { vps: { BETONLINE: bo, PS3838: ps }, nearbyEnabled: true },
        });

        assert.equal(record.state, 'ABORTED');
        assert.match(record.note ?? '', /no surebet/i);
        assert.equal(bo.calls.commit, 0);
        assert.equal(ps.calls.commit, 0);
    });

    it('rebuilds a nearby line when the tip line is not ready on both books', async () => {
        const LINE_LEGS = [
            {
                bookmaker: 'BETONLINE',
                eventName: 'A - B',
                sport: 'basketball',
                marketType: 'handicap',
                period: 'incl_ot',
                line: 2.5,
                selection: 'team1',
                odds: 1.91,
                stakeRatio: 0.5,
            },
            {
                bookmaker: 'PS3838',
                eventName: 'A - B',
                sport: 'basketball',
                marketType: 'handicap',
                period: 'incl_ot',
                line: 2.5,
                selection: 'team2',
                odds: 1.95,
                stakeRatio: 0.5,
            },
        ];

        const seenLines: number[] = [];
        const commits = { bo: 0, ps: 0 };
        const prepare = async (_e: string, _c: string, leg: any) => {
            seenLines.push(Number(leg.line));
            if (Number(leg.line) === 2.5) return { ok: false, reason: 'line gone' };
            if (Number(leg.line) === 2) {
                return {
                    ok: true,
                    odds: String(leg.bookmaker).toUpperCase() === 'BETONLINE' ? 2.05 : 2.1,
                };
            }
            return { ok: false, reason: 'no market' };
        };

        const bo = fakeVps({
            prepare,
            commit: async () => {
                commits.bo += 1;
                return { ok: true, orderId: 'BO' };
            },
        });
        const ps = fakeVps({
            prepare,
            commit: async () => {
                commits.ps += 1;
                return { ok: true, orderId: 'PS' };
            },
        });
        const record = await executeTip({
            tipId: 'tip-line',
            clientId: 'client-a',
            stake: 100,
            legs: LINE_LEGS as any,
            deps: { vps: { BETONLINE: bo, PS3838: ps }, nearbyEnabled: true },
        });

        assert.equal(record.state, 'DONE');
        assert.equal(record.rebuilt, true);
        assert.equal(record.rebuild?.appliedLine, 2);
        assert.equal(record.rebuild?.originalLine, 2.5);
        assert.ok((record.rebuild?.profitPercent ?? 0) > 0);
        assert.ok(seenLines.includes(2.5));
        assert.ok(seenLines.includes(2));
        assert.equal(commits.bo, 1);
        assert.equal(commits.ps, 1);
    });

    it('does not rebuild when nearby rebuild is disabled', async () => {
        const LINE_LEGS = [
            {
                bookmaker: 'BETONLINE',
                eventName: 'A - B',
                sport: 'basketball',
                marketType: 'total',
                period: 'incl_ot',
                line: 220.5,
                selection: 'over',
                odds: 1.9,
                stakeRatio: 0.5,
            },
            {
                bookmaker: 'PS3838',
                eventName: 'A - B',
                sport: 'basketball',
                marketType: 'total',
                period: 'incl_ot',
                line: 220.5,
                selection: 'under',
                odds: 1.95,
                stakeRatio: 0.5,
            },
        ];
        let prepares = 0;
        const failPrepare = async () => {
            prepares += 1;
            return { ok: false, reason: 'gone' };
        };
        const bo = fakeVps({ prepare: failPrepare });
        const ps = fakeVps({ prepare: failPrepare });
        const record = await executeTip({
            tipId: 'tip-off',
            clientId: 'client-a',
            stake: 100,
            legs: LINE_LEGS as any,
            deps: { vps: { BETONLINE: bo, PS3838: ps }, nearbyEnabled: false },
        });
        assert.equal(record.state, 'ABORTED');
        assert.equal(record.rebuilt, false);
        assert.equal(prepares, 2);
    });
});
