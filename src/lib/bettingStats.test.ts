import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateBetRows,
  excludeMockFromTemplateStats,
  periodRange,
  templateSummary,
  type BetStatsRow,
} from './bettingStats.ts';

const NOW = new Date('2026-09-30T12:00:00.000Z');

describe('periodRange', () => {
  it('uses the ISO week containing the reference instant', () => {
    const range = periodRange('week', 0, NOW);
    assert.equal(range.start.toISOString(), '2026-09-28T00:00:00.000Z');
    assert.equal(range.end.toISOString(), '2026-10-04T23:59:59.999Z');
  });

  it('shifts a week and a calendar month by offset', () => {
    const prevWeek = periodRange('week', -1, NOW);
    assert.equal(prevWeek.start.toISOString(), '2026-09-21T00:00:00.000Z');
    assert.equal(prevWeek.end.toISOString(), '2026-09-27T23:59:59.999Z');

    const month = periodRange('month', 0, NOW);
    assert.equal(month.start.toISOString(), '2026-09-01T00:00:00.000Z');
    assert.equal(month.end.toISOString(), '2026-09-30T23:59:59.999Z');

    const prevMonth = periodRange('month', -1, new Date('2026-01-15T00:00:00.000Z'));
    assert.equal(prevMonth.start.toISOString(), '2025-12-01T00:00:00.000Z');
    assert.equal(prevMonth.end.toISOString(), '2025-12-31T23:59:59.999Z');
  });

  it('starts an ISO week on Monday across the year boundary', () => {
    const range = periodRange('week', 0, new Date('2026-01-01T00:00:00.000Z'));
    assert.equal(range.start.toISOString(), '2025-12-29T00:00:00.000Z');
    assert.equal(range.end.toISOString(), '2026-01-04T23:59:59.999Z');
  });
});

describe('aggregateBetRows', () => {
  const range = periodRange('month', 0, NOW);

  const rows: BetStatsRow[] = [
    {
      createdAt: '2026-09-02T00:00:00.000Z',
      stake: 10,
      odds: 2,
      placeStatus: 'SUCCESS',
      settlement: {
        status: 'SETTLED',
        result: 'WON',
        profit: 11,
        settledAt: '2026-09-02T18:00:00.000Z',
      },
    },
    {
      createdAt: '2026-09-03T00:00:00.000Z',
      stake: 10,
      odds: 4,
      placeStatus: 'SUCCESS',
      settlement: {
        status: 'SETTLED',
        result: 'LOST',
        profit: -10,
        settledAt: '2026-09-03T18:00:00.000Z',
      },
    },
    {
      createdAt: '2026-09-04T00:00:00.000Z',
      stake: 8,
      odds: 1.5,
      status: 'SUCCESS',
      settlement: {
        status: 'SETTLED',
        result: 'HALF_WON',
        profit: 4,
        settledAt: '2026-09-04T12:00:00.000Z',
      },
    },
    {
      createdAt: '2026-09-05T00:00:00.000Z',
      stake: 5,
      odds: 3,
      placeStatus: 'SUCCESS',
      settlement: { status: 'PENDING' },
    },
    {
      createdAt: '2026-09-06T00:00:00.000Z',
      stake: 5,
      placeStatus: 'FAILED',
    },
    {
      createdAt: '2026-08-01T00:00:00.000Z',
      stake: 100,
      odds: 9,
      placeStatus: 'SUCCESS',
      settlement: {
        status: 'SETTLED',
        result: 'WON',
        profit: 800,
        settledAt: '2026-08-02T00:00:00.000Z',
      },
    },
    {
      createdAt: '2026-09-07T00:00:00.000Z',
      stake: 20,
      odds: 1.2,
      placeStatus: 'SUCCESS',
      settlement: {
        status: 'SETTLED',
        result: 'WON',
        profit: 99,
        settledAt: '2026-09-07T00:00:00.000Z',
        raw: { mock: true },
      },
    },
  ];

  it('counts placement, settlement, ROI, and win rate inside the period', () => {
    const stats = aggregateBetRows(rows, range);
    assert.equal(stats.execution.betsPlaced, 5);
    assert.equal(stats.execution.submitFailed, 1);
    assert.equal(stats.execution.submitSuccessRate, 5 / 6);
    assert.equal(stats.settlement.settled, 4);
    assert.equal(stats.settlement.pending, 1);
    assert.equal(stats.settlement.won, 2);
    assert.equal(stats.settlement.lost, 1);
    assert.equal(stats.settlement.halfWon, 1);
    assert.equal(stats.performance.netPnL, 11 - 10 + 4 + 99);
    assert.equal(stats.performance.totalStakedSettled, 10 + 10 + 8 + 20);
    assert.equal(stats.performance.roi, ((11 - 10 + 4 + 99) / 48) * 100);
    assert.equal(stats.performance.winRate, 2 / 3);
    assert.equal(stats.performance.avgOdds, (2 + 4 + 1.5 + 3 + 1.2) / 5);
    assert.equal(stats.series.cumulativePnLByDay.find((p) => p.date === '2026-09-02')?.pnl, 11);
    assert.equal(stats.series.cumulativePnLByDay.find((p) => p.date === '2026-09-03')?.pnl, 1);
    assert.equal(stats.series.cumulativePnLByDay.find((p) => p.date === '2026-09-04')?.pnl, 5);
  });

  it('drops mock rows and does not treat an unsettled bet as settled via createdAt', () => {
    const stats = aggregateBetRows(rows, range, { excludeMock: true });
    assert.equal(stats.settlement.settled, 3);
    assert.equal(stats.settlement.won, 1);
    assert.equal(stats.performance.netPnL, 5);
    assert.equal(stats.execution.betsPlaced, 4);
    assert.equal(stats.series.cumulativePnLByDay.find((p) => p.date === '2026-09-07')?.pnl, 5);
  });

  it('returns zero rates when there is nothing to divide', () => {
    const stats = aggregateBetRows([], range);
    assert.equal(stats.execution.submitSuccessRate, 0);
    assert.equal(stats.performance.roi, 0);
    assert.equal(stats.performance.winRate, 0);
    assert.equal(stats.performance.avgOdds, 0);
  });
});

describe('templateSummary', () => {
  const range = periodRange('month', -1, NOW);

  it('marks fewer than 10 settled bets as insufficient', () => {
    const rows: BetStatsRow[] = Array.from({ length: 9 }, (_, i) => ({
      createdAt: '2026-08-02T00:00:00.000Z',
      stake: 1,
      placeStatus: 'SUCCESS',
      settlement: {
        status: 'SETTLED',
        result: 'WON',
        profit: 1,
        settledAt: `2026-08-${String(i + 2).padStart(2, '0')}T00:00:00.000Z`,
      },
    }));
    const summary = templateSummary(aggregateBetRows(rows, range, { excludeMock: true }));
    assert.equal(summary.settled, 9);
    assert.equal(summary.insufficientData, true);
    assert.equal(summary.performance.netPnL, 9);
  });

  it('clears insufficientData at 10 settled bets', () => {
    const rows: BetStatsRow[] = Array.from({ length: 10 }, () => ({
      createdAt: '2026-08-10T00:00:00.000Z',
      stake: 2,
      placeStatus: 'SUCCESS',
      settlement: {
        status: 'SETTLED',
        result: 'LOST',
        profit: -2,
        settledAt: '2026-08-20T00:00:00.000Z',
      },
    }));
    const summary = templateSummary(aggregateBetRows(rows, range));
    assert.equal(summary.insufficientData, false);
    assert.equal(summary.winRate, 0);
    assert.equal(summary.roi, -100);
  });
});

describe('excludeMockFromTemplateStats', () => {
  it('excludes mock bets unless the env flag is false', () => {
    assert.equal(excludeMockFromTemplateStats({}), true);
    assert.equal(excludeMockFromTemplateStats({ STATS_EXCLUDE_MOCK: 'false' }), false);
    assert.equal(excludeMockFromTemplateStats({ STATS_EXCLUDE_MOCK: '0' }), false);
    assert.equal(excludeMockFromTemplateStats({ STATS_EXCLUDE_MOCK: 'true' }), true);
  });
});
