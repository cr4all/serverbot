/**
 * Nearby-line surebet helpers.
 * Run: node --experimental-strip-types --test src/lib/nearbySurebet.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyStakeRatios,
    isNearbyRebuildEnabled,
    isShowRebuiltEnabled,
    nearbyLineCandidates,
    redactRebuildForClient,
    stakeRatiosFromOdds,
    tipLine,
    withSharedLine,
} from './nearbySurebet.ts';

describe('nearbySurebet', () => {
    it('orders nearby candidates by distance from the tip line', () => {
        assert.deepEqual(nearbyLineCandidates(2.5, { steps: [0.5, 1], maxPerSide: 1 }), [2, 3, 1.5, 3.5]);
    });

    it('shares one line across handicap/total legs', () => {
        const legs = withSharedLine(
            [
                {
                    bookmaker: 'BETONLINE',
                    eventName: 'A - B',
                    sport: 'basketball',
                    marketType: 'handicap',
                    period: 'incl_ot',
                    line: 2.5,
                    selection: 'team1',
                    odds: 1.9,
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
            ],
            2
        );
        assert.equal(tipLine(legs), 2);
        assert.deepEqual(
            legs.map((l) => l.line),
            [2, 2]
        );
    });

    it('keeps only pairs that are still a surebet', () => {
        assert.equal(stakeRatiosFromOdds(1.9, 1.9), null);
        const ok = stakeRatiosFromOdds(2.1, 2.1);
        assert.ok(ok);
        assert.equal(ok!.ratioA + ok!.ratioB, 1);
        assert.ok(ok!.profitPercent > 0);

        const applied = applyStakeRatios(
            [
                {
                    bookmaker: 'BETONLINE',
                    eventName: 'A - B',
                    sport: 'basketball',
                    marketType: 'total',
                    period: 'incl_ot',
                    line: 220.5,
                    selection: 'over',
                    odds: 2.1,
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
                    odds: 2.1,
                    stakeRatio: 0.5,
                },
            ],
            { BETONLINE: 2.1, PS3838: 2.1 }
        );
        assert.ok(applied);
        assert.equal(applied![0].stakeRatio, 0.5);
        assert.equal(applied![1].stakeRatio, 0.5);
    });

    it('defaults nearby rebuild on and show-rebuilt off', () => {
        assert.equal(isNearbyRebuildEnabled({}), true);
        assert.equal(isNearbyRebuildEnabled({ SUREBET_NEARBY_REBUILD: '0' }), false);
        assert.equal(isShowRebuiltEnabled({}), false);
        assert.equal(isShowRebuiltEnabled({ SUREBET_SHOW_REBUILT: '1' }), true);
    });

    it('redacts rebuild fields unless the show flag is on', () => {
        const row = { executionId: 'ex_1', rebuilt: true, rebuild: { appliedLine: 2 }, state: 'DONE' };
        assert.deepEqual(redactRebuildForClient(row, {}), { executionId: 'ex_1', state: 'DONE' });
        assert.deepEqual(redactRebuildForClient(row, { SUREBET_SHOW_REBUILT: '1' }), row);
    });
});
