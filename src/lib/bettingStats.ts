/**
 * PR5a — BetHistory betting statistics (single source of truth for API/UI).
 * Execution metrics use createdAt; settlement metrics use settlement.settledAt only.
 */

import type { Types } from 'mongoose';

function getPlaceStatus(doc: { placeStatus?: string; status?: string } | null | undefined): 'SUCCESS' | 'FAILED' {
    if (!doc) return 'FAILED';
    const ps = doc.placeStatus ?? doc.status;
    return ps === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
}

export type StatsPeriodType = 'week' | 'month';

export interface StatsPeriod {
    type: StatsPeriodType;
    start: Date;
    end: Date;
    offset: number;
}

export interface BetHistoryStatsRow {
    _id?: Types.ObjectId | string;
    createdAt?: Date | string;
    stake?: number;
    odds?: number | null;
    placeStatus?: string;
    status?: string;
    settlement?: {
        status?: string;
        result?: string | null;
        profit?: number | null;
        settledAt?: Date | string | null;
        raw?: { mock?: boolean } | null;
    } | null;
}

export interface AggregateBetStatsOptions {
    excludeMock?: boolean;
}

export const STAT_DEFINITIONS = {
    roi: 'netPnL / totalStakedSettled × 100 (SETTLED bets in period by settledAt)',
    winRate: 'won / (won + lost) — VOID, DRAW, PENDING excluded',
    submitSuccessRate: 'betsPlaced / (betsPlaced + submitFailed) by createdAt',
    netPnL: 'sum(settlement.profit) for SETTLED with settledAt in period',
    avgOdds: 'average odds for SUCCESS placements with createdAt in period',
} as const;

export interface BettingStatsPayload {
    period: {
        type: StatsPeriodType;
        start: string;
        end: string;
        offset: number;
    };
    execution: {
        betsPlaced: number;
        submitFailed: number;
        submitSuccessRate: number;
    };
    settlement: {
        settled: number;
        pending: number;
        won: number;
        lost: number;
        draw: number;
        void: number;
    };
    performance: {
        netPnL: number;
        roi: number;
        winRate: number;
        avgOdds: number;
        totalStakedSettled: number;
    };
    series: {
        cumulativePnLByDay: Array<{ date: string; pnl: number; cumulative: number }>;
    };
    definitions: typeof STAT_DEFINITIONS;
}

function toDate(v: Date | string | null | undefined): Date | null {
    if (v == null) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(d: Date | null, start: Date, end: Date): boolean {
    if (!d) return false;
    return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

/** UTC calendar month with offset (0 = current month). */
export function resolveMonthPeriodUTC(ref: Date, offset: number): StatsPeriod {
    const y = ref.getUTCFullYear();
    const m = ref.getUTCMonth() + offset;
    const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { type: 'month', start, end, offset };
}

/** ISO week: Monday 00:00 UTC – Sunday 23:59:59.999 UTC. offset 0 = week containing ref. */
export function resolveWeekPeriodUTC(ref: Date, offset: number): StatsPeriod {
    const day = ref.getUTCDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - daysFromMonday, 0, 0, 0, 0)
    );
    monday.setUTCDate(monday.getUTCDate() + offset * 7);
    const end = new Date(monday);
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return { type: 'week', start: monday, end, offset };
}

export function resolveStatsPeriod(type: StatsPeriodType, offset: number, ref = new Date()): StatsPeriod {
    if (type === 'month') return resolveMonthPeriodUTC(ref, offset);
    return resolveWeekPeriodUTC(ref, offset);
}

export function isMockSettlementRow(row: BetHistoryStatsRow): boolean {
    const raw = row.settlement?.raw;
    return Boolean(raw && typeof raw === 'object' && (raw as { mock?: boolean }).mock === true);
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function utcDateKey(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/**
 * Pure aggregation from in-memory rows (unit tests + DB fetch post-process).
 */
export function aggregateBetStatsFromRows(
    rows: BetHistoryStatsRow[],
    period: StatsPeriod,
    options: AggregateBetStatsOptions = {}
): BettingStatsPayload {
    const { excludeMock = false } = options;
    const filtered = excludeMock ? rows.filter((r) => !isMockSettlementRow(r)) : rows;

    let betsPlaced = 0;
    let submitFailed = 0;
    let oddsSum = 0;
    let oddsCount = 0;

    let settled = 0;
    let pending = 0;
    let won = 0;
    let lost = 0;
    let draw = 0;
    let voidCount = 0;
    let netPnL = 0;
    let totalStakedSettled = 0;

    const dailyPnL = new Map<string, number>();

    for (const row of filtered) {
        const createdAt = toDate(row.createdAt);
        const placeStatus = getPlaceStatus(row);
        const settlement = row.settlement;

        if (inRange(createdAt, period.start, period.end)) {
            if (placeStatus === 'SUCCESS') {
                betsPlaced++;
                if (row.odds != null && !Number.isNaN(Number(row.odds))) {
                    oddsSum += Number(row.odds);
                    oddsCount++;
                }
            } else {
                submitFailed++;
            }
        }

        if (placeStatus === 'SUCCESS' && settlement?.status === 'PENDING' && inRange(createdAt, period.start, period.end)) {
            pending++;
        }

        if (settlement?.status === 'SETTLED') {
            const settledAt = toDate(settlement.settledAt);
            if (!inRange(settledAt, period.start, period.end)) continue;

            settled++;
            const profit = Number(settlement.profit) || 0;
            const stake = Number(row.stake) || 0;
            netPnL += profit;
            totalStakedSettled += stake;

            const result = settlement.result;
            if (result === 'WON') won++;
            else if (result === 'LOST') lost++;
            else if (result === 'DRAW') draw++;
            else if (result === 'VOID') voidCount++;

            if (settledAt) {
                const key = utcDateKey(settledAt);
                dailyPnL.set(key, (dailyPnL.get(key) ?? 0) + profit);
            }
        }
    }

    const denom = betsPlaced + submitFailed;
    const submitSuccessRate = denom > 0 ? round2((betsPlaced / denom) * 100) : 0;
    const winDenom = won + lost;
    const winRate = winDenom > 0 ? round2((won / winDenom) * 100) : 0;
    const roi = totalStakedSettled > 0 ? round2((netPnL / totalStakedSettled) * 100) : 0;
    const avgOdds = oddsCount > 0 ? round2(oddsSum / oddsCount) : 0;

    const sortedDays = [...dailyPnL.keys()].sort();
    let cumulative = 0;
    const cumulativePnLByDay = sortedDays.map((date) => {
        const pnl = round2(dailyPnL.get(date) ?? 0);
        cumulative = round2(cumulative + pnl);
        return { date, pnl, cumulative };
    });

    return {
        period: {
            type: period.type,
            start: period.start.toISOString(),
            end: period.end.toISOString(),
            offset: period.offset,
        },
        execution: {
            betsPlaced,
            submitFailed,
            submitSuccessRate,
        },
        settlement: {
            settled,
            pending,
            won,
            lost,
            draw,
            void: voidCount,
        },
        performance: {
            netPnL: round2(netPnL),
            roi,
            winRate,
            avgOdds,
            totalStakedSettled: round2(totalStakedSettled),
        },
        series: { cumulativePnLByDay },
        definitions: STAT_DEFINITIONS,
    };
}

export interface StatsScopeFilter {
    botInstanceId?: Types.ObjectId | string;
    botId?: Types.ObjectId | string;
}

/** Mongo $match for rows needed to compute stats in a period. */
export function buildStatsFetchMatch(scope: StatsScopeFilter, period: StatsPeriod, options: AggregateBetStatsOptions = {}) {
    const base: Record<string, unknown> = {};
    if (scope.botInstanceId != null) base.botInstanceId = scope.botInstanceId;
    if (scope.botId != null) base.botId = scope.botId;

    const mockClause =
        options.excludeMock === true ? { 'settlement.raw.mock': { $ne: true } } : {};

    return {
        ...base,
        ...mockClause,
        $or: [
            { createdAt: { $gte: period.start, $lte: period.end } },
            {
                'settlement.status': 'SETTLED',
                'settlement.settledAt': { $gte: period.start, $lte: period.end },
            },
        ],
    };
}
