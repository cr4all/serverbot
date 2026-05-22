/**
 * PR5a unit tests — run: npm run test:stats
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    aggregateBetStatsFromRows,
    isMockSettlementRow,
    resolveMonthPeriodUTC,
    resolveStatsPeriod,
    resolveWeekPeriodUTC,
} from './bettingStats.ts';
import type { BetHistoryStatsRow } from './bettingStats.ts';

const ref = new Date('2026-05-15T12:00:00.000Z');

describe('resolveStatsPeriod', () => {
    it('resolveMonthPeriodUTC offset 0', () => {
        const p = resolveMonthPeriodUTC(ref, 0);
        assert.equal(p.start.toISOString(), '2026-05-01T00:00:00.000Z');
        assert.equal(p.end.toISOString(), '2026-05-31T23:59:59.999Z');
    });

    it('resolveMonthPeriodUTC offset -1', () => {
        const p = resolveStatsPeriod('month', -1, ref);
        assert.equal(p.start.toISOString(), '2026-04-01T00:00:00.000Z');
    });

    it('resolveWeekPeriodUTC contains ref Monday', () => {
        const p = resolveWeekPeriodUTC(ref, 0);
        assert.equal(p.start.getUTCDay(), 1);
        assert.ok(p.start <= ref && p.end >= ref);
    });
});

describe('aggregateBetStatsFromRows', () => {
    const period = resolveMonthPeriodUTC(ref, 0);

    it('empty rows', () => {
        const r = aggregateBetStatsFromRows([], period);
        assert.equal(r.execution.betsPlaced, 0);
        assert.equal(r.performance.roi, 0);
        assert.equal(r.performance.winRate, 0);
    });

    it('execution and settlement by correct dates', () => {
        const rows: BetHistoryStatsRow[] = [
            {
                createdAt: '2026-05-10T10:00:00.000Z',
                stake: 10,
                odds: 2,
                placeStatus: 'SUCCESS',
                settlement: { status: 'SETTLED', result: 'WON', profit: 10, settledAt: '2026-05-20T10:00:00.000Z' },
            },
            {
                createdAt: '2026-05-11T10:00:00.000Z',
                stake: 5,
                placeStatus: 'FAILED',
            },
            {
                createdAt: '2026-04-01T10:00:00.000Z',
                stake: 100,
                placeStatus: 'SUCCESS',
                settlement: { status: 'SETTLED', result: 'LOST', profit: -100, settledAt: '2026-05-05T10:00:00.000Z' },
            },
        ];
        const r = aggregateBetStatsFromRows(rows, period);
        assert.equal(r.execution.betsPlaced, 1);
        assert.equal(r.execution.submitFailed, 1);
        assert.equal(r.settlement.settled, 2);
        assert.equal(r.settlement.won, 1);
        assert.equal(r.settlement.lost, 1);
        assert.equal(r.performance.netPnL, -90);
        assert.equal(r.performance.winRate, 50);
        assert.equal(r.performance.avgOdds, 2);
    });

    it('pending only for SUCCESS created in period', () => {
        const rows: BetHistoryStatsRow[] = [
            {
                createdAt: '2026-05-10T10:00:00.000Z',
                placeStatus: 'SUCCESS',
                settlement: { status: 'PENDING' },
            },
        ];
        const r = aggregateBetStatsFromRows(rows, period);
        assert.equal(r.settlement.pending, 1);
        assert.equal(r.settlement.settled, 0);
    });

    it('excludes mock when excludeMock', () => {
        const rows: BetHistoryStatsRow[] = [
            {
                createdAt: '2026-05-10T10:00:00.000Z',
                stake: 10,
                placeStatus: 'SUCCESS',
                settlement: {
                    status: 'SETTLED',
                    result: 'WON',
                    profit: 10,
                    settledAt: '2026-05-12T10:00:00.000Z',
                    raw: { mock: true },
                },
            },
        ];
        assert.equal(isMockSettlementRow(rows[0]), true);
        const withMock = aggregateBetStatsFromRows(rows, period);
        const noMock = aggregateBetStatsFromRows(rows, period, { excludeMock: true });
        assert.equal(withMock.settlement.settled, 1);
        assert.equal(noMock.settlement.settled, 0);
    });

    it('cumulativePnLByDay', () => {
        const rows: BetHistoryStatsRow[] = [
            {
                createdAt: '2026-05-01T10:00:00.000Z',
                stake: 10,
                placeStatus: 'SUCCESS',
                settlement: { status: 'SETTLED', result: 'WON', profit: 5, settledAt: '2026-05-02T10:00:00.000Z' },
            },
            {
                createdAt: '2026-05-01T11:00:00.000Z',
                stake: 10,
                placeStatus: 'SUCCESS',
                settlement: { status: 'SETTLED', result: 'LOST', profit: -10, settledAt: '2026-05-03T10:00:00.000Z' },
            },
        ];
        const r = aggregateBetStatsFromRows(rows, period);
        assert.equal(r.series.cumulativePnLByDay.length, 2);
        assert.equal(r.series.cumulativePnLByDay[1].cumulative, -5);
    });
});
