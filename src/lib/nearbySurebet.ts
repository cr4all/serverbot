/**
 * Nearby-line surebet rebuild: when DeepBet tip lines are slightly wrong, try nearby
 * handicap/total lines on BOTH books and keep only pairs that are still a surebet.
 */
import type { VpsLeg } from './vpsClient';

const LINE_MARKETS = new Set([
    'total',
    'totals',
    'over_under',
    'ou',
    'handicap',
    'spread',
    'hdp',
    'asian_handicap',
]);

/** Feature is on unless explicitly disabled. */
export function isNearbyRebuildEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    const raw = String(env.SUREBET_NEARBY_REBUILD ?? '1').trim().toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

/**
 * When set, API/UI may expose that an execution used a rebuilt line.
 * Production leaves this unset so users only see a normal run.
 */
export function isShowRebuiltEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    const raw = String(env.SUREBET_SHOW_REBUILT ?? '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function isLineMarket(marketType: string | null | undefined): boolean {
    return LINE_MARKETS.has(String(marketType ?? '').trim().toLowerCase());
}

export function legsNeedLine(legs: VpsLeg[]): boolean {
    return legs.some((leg) => isLineMarket(leg.marketType) && leg.line != null && Number.isFinite(Number(leg.line)));
}

export function tipLine(legs: VpsLeg[]): number | null {
    for (const leg of legs) {
        if (isLineMarket(leg.marketType) && leg.line != null && Number.isFinite(Number(leg.line))) {
            return Number(leg.line);
        }
    }
    return null;
}

/**
 * Candidates around the tip line (does not include the original line).
 * Default steps match common Asian lines: 0.25 / 0.5 / 1.0.
 */
export function nearbyLineCandidates(
    line: number,
    { steps = [0.25, 0.5, 1], maxPerSide = 2 }: { steps?: number[]; maxPerSide?: number } = {}
): number[] {
    if (!Number.isFinite(line)) return [];
    const out: number[] = [];
    const seen = new Set<string>();
    for (const step of steps) {
        if (!(step > 0)) continue;
        for (const sign of [-1, 1]) {
            for (let i = 1; i <= maxPerSide; i += 1) {
                const value = Number((line + sign * step * i).toFixed(4));
                const key = String(value);
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(value);
            }
        }
    }
    // Prefer closer lines first.
    out.sort((a, b) => Math.abs(a - line) - Math.abs(b - line) || a - b);
    return out;
}

export function withSharedLine(legs: VpsLeg[], line: number): VpsLeg[] {
    return legs.map((leg) => {
        if (!isLineMarket(leg.marketType)) return { ...leg };
        return { ...leg, line };
    });
}

/**
 * Fair stake split for a 2-leg surebet. Returns null when it is not a surebet.
 * profitPercent is the locked ROI on total stake (same convention as tip.profitPercent).
 */
export function stakeRatiosFromOdds(
    oddsA: number,
    oddsB: number
): { ratioA: number; ratioB: number; profitPercent: number } | null {
    const a = Number(oddsA);
    const b = Number(oddsB);
    if (!(a > 1) || !(b > 1)) return null;
    const implied = 1 / a + 1 / b;
    if (!(implied < 1)) return null;
    const ratioA = Number((1 / a / implied).toFixed(6));
    const ratioB = Number((1 - ratioA).toFixed(6));
    const profitPercent = Number(((1 / implied - 1) * 100).toFixed(4));
    return { ratioA, ratioB, profitPercent };
}

export function applyStakeRatios(legs: VpsLeg[], oddsByBook: Record<string, number>): VpsLeg[] | null {
    const ordered = ['BETONLINE', 'PS3838'] as const;
    const o1 = oddsByBook[ordered[0]];
    const o2 = oddsByBook[ordered[1]];
    if (o1 == null || o2 == null) return null;
    const split = stakeRatiosFromOdds(o1, o2);
    if (!split) return null;
    return legs.map((leg) => {
        const bm = String(leg.bookmaker).toUpperCase();
        const odds = oddsByBook[bm] ?? leg.odds;
        const stakeRatio = bm === ordered[0] ? split.ratioA : bm === ordered[1] ? split.ratioB : leg.stakeRatio;
        return { ...leg, odds, stakeRatio };
    });
}

export type RebuildInfo = {
    originalLine: number | null;
    appliedLine: number;
    profitPercent: number;
    reason: string;
};

/** Strip rebuild fields from API payloads when the show flag is off. */
export function redactRebuildForClient<T extends Record<string, unknown>>(row: T, env: NodeJS.ProcessEnv = process.env): T {
    if (isShowRebuiltEnabled(env)) return row;
    const copy = { ...row };
    delete copy.rebuilt;
    delete copy.rebuild;
    return copy;
}
