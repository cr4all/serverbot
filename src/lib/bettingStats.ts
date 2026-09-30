export type StatsPeriodType = 'week' | 'month';

export const TEMPLATE_MIN_SETTLED = 10;

export const STATS_DEFINITIONS = {
  roi: 'netPnL / totalStaked (settled)',
  winRate: 'won / (won+lost)',
} as const;

export interface PeriodRange {
  type: StatsPeriodType;
  start: Date;
  end: Date;
}

export interface BetStatsSettlement {
  status?: string | null;
  result?: string | null;
  profit?: number | null;
  settledAt?: Date | string | null;
  raw?: { mock?: boolean } | null;
}

export interface BetStatsRow {
  createdAt?: Date | string | null;
  stake?: number | null;
  odds?: number | null;
  placeStatus?: string | null;
  status?: string | null;
  settlement?: BetStatsSettlement | null;
}

export interface DailyPnLPoint {
  date: string;
  pnl: number;
}

export interface InstanceBetStats {
  period: { type: StatsPeriodType; start: string; end: string };
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
    halfWon: number;
    halfLost: number;
    cashout: number;
  };
  performance: {
    netPnL: number;
    roi: number;
    winRate: number;
    avgOdds: number;
    totalStakedSettled: number;
  };
  series: { cumulativePnLByDay: DailyPnLPoint[] };
  definitions: { roi: string; winRate: string };
}

export interface TemplateBetStats {
  period: { type: StatsPeriodType; start: string; end: string };
  settled: number;
  winRate: number;
  roi: number;
  performance: { netPnL: number };
  insufficientData: boolean;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function inRange(value: unknown, start: Date, end: Date): boolean {
  const d = toDate(value);
  if (!d) return false;
  const t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfIsoWeekUtc(now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  return start;
}

function eachUtcDay(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur.getTime() <= last.getTime()) {
    keys.push(utcDateKey(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return keys;
}

export function periodRange(period: StatsPeriodType, offset: number, now = new Date()): PeriodRange {
  const shift = Number.isFinite(offset) ? Math.trunc(offset) : 0;
  if (period === 'week') {
    const start = startOfIsoWeekUtc(now);
    start.setUTCDate(start.getUTCDate() + shift * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    end.setUTCMilliseconds(-1);
    return { type: 'week', start, end };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + shift, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + shift + 1, 1));
  end.setUTCMilliseconds(-1);
  return { type: 'month', start, end };
}

export function parseStatsQuery(
  periodRaw: string | null,
  offsetRaw: string | null,
): { ok: true; period: StatsPeriodType; offset: number } | { ok: false; error: string } {
  const period = String(periodRaw || '').trim().toLowerCase();
  if (period !== 'week' && period !== 'month') {
    return { ok: false, error: 'period must be week or month' };
  }
  const offset = offsetRaw == null || offsetRaw === '' ? 0 : Number(offsetRaw);
  if (!Number.isFinite(offset) || !Number.isInteger(offset)) {
    return { ok: false, error: 'offset must be an integer' };
  }
  return { ok: true, period, offset };
}

export function isMockBet(row: BetStatsRow): boolean {
  return row.settlement?.raw?.mock === true;
}

export function excludeMockFromTemplateStats(env?: { STATS_EXCLUDE_MOCK?: string }): boolean {
  const value = (env ?? (process.env as { STATS_EXCLUDE_MOCK?: string })).STATS_EXCLUDE_MOCK;
  if (value == null || value === '') return true;
  return value !== 'false' && value !== '0';
}

function placeOf(row: BetStatsRow): 'SUCCESS' | 'FAILED' | null {
  const raw = String(row.placeStatus || row.status || '').trim().toUpperCase();
  if (raw === 'SUCCESS' || raw === 'FAILED') return raw;
  return null;
}

function emptyStats(range: PeriodRange): InstanceBetStats {
  const days = eachUtcDay(range.start, range.end);
  return {
    period: {
      type: range.type,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    execution: { betsPlaced: 0, submitFailed: 0, submitSuccessRate: 0 },
    settlement: {
      settled: 0,
      pending: 0,
      won: 0,
      lost: 0,
      draw: 0,
      void: 0,
      halfWon: 0,
      halfLost: 0,
      cashout: 0,
    },
    performance: { netPnL: 0, roi: 0, winRate: 0, avgOdds: 0, totalStakedSettled: 0 },
    series: { cumulativePnLByDay: days.map((date) => ({ date, pnl: 0 })) },
    definitions: { ...STATS_DEFINITIONS },
  };
}

export function aggregateBetRows(
  rows: BetStatsRow[],
  range: PeriodRange,
  options: { excludeMock?: boolean } = {},
): InstanceBetStats {
  const stats = emptyStats(range);
  const daily = new Map<string, number>();
  let oddsSum = 0;
  let oddsCount = 0;

  for (const row of rows) {
    if (options.excludeMock && isMockBet(row)) continue;

    const placed = placeOf(row);
    const createdInRange = inRange(row.createdAt, range.start, range.end);
    if (createdInRange && placed === 'SUCCESS') {
      stats.execution.betsPlaced += 1;
      const odds = toNumber(row.odds);
      if (odds != null) {
        oddsSum += odds;
        oddsCount += 1;
      }
      const settlementStatus = String(row.settlement?.status || '').trim().toUpperCase();
      if (!row.settlement || settlementStatus === '' || settlementStatus === 'PENDING') {
        stats.settlement.pending += 1;
      }
    } else if (createdInRange && placed === 'FAILED') {
      stats.execution.submitFailed += 1;
    }

    const settlementStatus = String(row.settlement?.status || '').trim().toUpperCase();
    if (settlementStatus !== 'SETTLED') continue;
    if (!inRange(row.settlement?.settledAt, range.start, range.end)) continue;

    stats.settlement.settled += 1;
    const profit = toNumber(row.settlement?.profit) ?? 0;
    const stake = toNumber(row.stake) ?? 0;
    stats.performance.netPnL += profit;
    stats.performance.totalStakedSettled += stake;

    const result = String(row.settlement?.result || '').trim().toUpperCase();
    if (result === 'WON') stats.settlement.won += 1;
    else if (result === 'LOST') stats.settlement.lost += 1;
    else if (result === 'DRAW') stats.settlement.draw += 1;
    else if (result === 'VOID') stats.settlement.void += 1;
    else if (result === 'HALF_WON') stats.settlement.halfWon += 1;
    else if (result === 'HALF_LOST') stats.settlement.halfLost += 1;
    else if (result === 'CASHOUT') stats.settlement.cashout += 1;

    const settledAt = toDate(row.settlement?.settledAt);
    if (settledAt) {
      const key = utcDateKey(settledAt);
      daily.set(key, (daily.get(key) ?? 0) + profit);
    }
  }

  const attempts = stats.execution.betsPlaced + stats.execution.submitFailed;
  stats.execution.submitSuccessRate = attempts === 0 ? 0 : stats.execution.betsPlaced / attempts;
  stats.performance.avgOdds = oddsCount === 0 ? 0 : oddsSum / oddsCount;
  const decided = stats.settlement.won + stats.settlement.lost;
  stats.performance.winRate = decided === 0 ? 0 : stats.settlement.won / decided;
  stats.performance.roi =
    stats.performance.totalStakedSettled === 0
      ? 0
      : (stats.performance.netPnL / stats.performance.totalStakedSettled) * 100;

  let running = 0;
  stats.series.cumulativePnLByDay = stats.series.cumulativePnLByDay.map((point) => {
    running += daily.get(point.date) ?? 0;
    return { date: point.date, pnl: running };
  });

  return stats;
}

export function templateSummary(stats: InstanceBetStats, minSettled = TEMPLATE_MIN_SETTLED): TemplateBetStats {
  return {
    period: stats.period,
    settled: stats.settlement.settled,
    winRate: stats.performance.winRate,
    roi: stats.performance.roi,
    performance: { netPnL: stats.performance.netPnL },
    insufficientData: stats.settlement.settled < minSettled,
  };
}
