/**
 * PR5a — Load BetHistory and run bettingStats aggregation (on-demand, no rollup cache).
 */

import BetHistory from '@/models/BetHistory';
import {
    aggregateBetStatsFromRows,
    buildStatsFetchMatch,
    resolveStatsPeriod,
    type AggregateBetStatsOptions,
    type BettingStatsPayload,
    type StatsPeriodType,
    type StatsScopeFilter,
} from '@/lib/bettingStats';

export type { BettingStatsPayload, StatsPeriodType };

export interface FetchInstanceStatsParams {
    botInstanceId: string;
    period: StatsPeriodType;
    offset?: number;
    options?: AggregateBetStatsOptions;
}

export interface FetchTemplateStatsParams {
    botId: string;
    period: StatsPeriodType;
    offset?: number;
    options?: AggregateBetStatsOptions;
}

const TEMPLATE_STATS_MIN_SETTLED = parseInt(process.env.STATS_TEMPLATE_MIN_SETTLED || '10', 10);

async function loadRowsForStats(
    scope: StatsScopeFilter,
    periodType: StatsPeriodType,
    offset: number,
    options: AggregateBetStatsOptions
): Promise<BettingStatsPayload> {
    const period = resolveStatsPeriod(periodType, offset);
    const match = buildStatsFetchMatch(scope, period, options);
    const rows = await BetHistory.find(match).lean();
    return aggregateBetStatsFromRows(rows, period, options);
}

/** Instance scope — includes mock bets unless options.excludeMock. */
export async function fetchInstanceBettingStats(params: FetchInstanceStatsParams): Promise<BettingStatsPayload> {
    const { botInstanceId, period, offset = 0, options = {} } = params;
    return loadRowsForStats({ botInstanceId }, period, offset, {
        excludeMock: false,
        ...options,
    });
}

/** Template scope — excludes mock by default (public-facing). */
export async function fetchTemplateBettingStats(
    params: FetchTemplateStatsParams
): Promise<BettingStatsPayload & { insufficientData: boolean; minSettledRequired: number }> {
    const excludeMockDefault = process.env.STATS_EXCLUDE_MOCK !== 'false';
    const { botId, period, offset = 0, options = {} } = params;
    const merged: AggregateBetStatsOptions = {
        excludeMock: excludeMockDefault,
        ...options,
    };
    const payload = await loadRowsForStats({ botId }, period, offset, merged);
    const minRequired = Number.isFinite(TEMPLATE_STATS_MIN_SETTLED) ? TEMPLATE_STATS_MIN_SETTLED : 10;
    return {
        ...payload,
        insufficientData: payload.settlement.settled < minRequired,
        minSettledRequired: minRequired,
    };
}

/** PR5a-v2 hook: invalidate or recompute rollups (no-op until rollups enabled). */
export async function touchStatsRollups(_scope: StatsScopeFilter, _settledAt?: Date): Promise<void> {
    if (process.env.STATS_ROLLUP_ENABLED === 'true') {
        // PR5a-v2: enqueue rollup recompute
    }
}

export { BetHistory as BetHistoryModel };
