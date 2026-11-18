/**
 * Client-side execution: one tip, two VPSs, both legs or nothing.
 *
 * Order is fixed for safety:
 *   1. prepare on BOTH VPSs (in parallel) - nothing is placed yet
 *   2. if prepare fails on a line market, optionally rebuild with nearby lines (still both-ready or abort)
 *   3. commit on BOTH, only when both answered ok
 *   4. verify on each site (open bets)
 * A leg that is not confirmed becomes ONE_LEG / REVIEW_NEEDED so a human acts; nothing is retried automatically.
 */
import { randomUUID } from 'node:crypto';
import type { VpsClient, VpsLeg } from './vpsClient';
import {
    applyStakeRatios,
    isNearbyRebuildEnabled,
    legsNeedLine,
    nearbyLineCandidates,
    stakeRatiosFromOdds,
    tipLine,
    withSharedLine,
    type RebuildInfo,
} from './nearbySurebet';

export type LegState = 'PENDING' | 'READY' | 'NOT_READY' | 'COMMITTED' | 'REJECTED' | 'VERIFIED' | 'MISSING';
export type JobState = 'ABORTED' | 'DONE' | 'ONE_LEG' | 'REVIEW_NEEDED';

export interface ExecutionLeg {
    bookmaker: string;
    state: LegState;
    reason?: string | null;
    orderId?: string | null;
    odds?: number | null;
}

export interface ExecutionRecord {
    executionId: string;
    tipId: string;
    clientId: string;
    totalStake: number;
    state: JobState;
    note?: string | null;
    legs: ExecutionLeg[];
    createdAt: string;
    /** True when a nearby-line surebet replaced the tip lines. May be redacted from API when SUREBET_SHOW_REBUILT is off. */
    rebuilt?: boolean;
    rebuild?: RebuildInfo | null;
}

export interface ExecutionDeps {
    /** Clients for the two VPSs. A missing entry means that side is not configured. */
    vps: Partial<Record<'BETONLINE' | 'PS3838', VpsClient>>;
    /** Optional persistence hook (Mongo in the app, a fake in tests). */
    save?: (record: ExecutionRecord) => Promise<void>;
    now?: () => Date;
    idFactory?: () => string;
    /** Injected for tests; defaults to process.env via nearbySurebet helpers. */
    nearbyEnabled?: boolean;
}

const LEG_ORDER = ['BETONLINE', 'PS3838'] as const;

function legOf(tipLegs: VpsLeg[], bookmaker: string): VpsLeg | undefined {
    return tipLegs.find((l) => String(l.bookmaker).toUpperCase() === bookmaker);
}

function describe(legs: ExecutionLeg[]): string {
    return legs.map((l) => `${l.bookmaker}=${l.state}`).join('; ');
}

async function prepareBoth(params: {
    executionId: string;
    clientId: string;
    stake: number;
    legs: VpsLeg[];
    recordLegs: ExecutionLeg[];
    vps: ExecutionDeps['vps'];
}): Promise<boolean> {
    const { executionId, clientId, stake, legs, recordLegs, vps } = params;

    await Promise.all(
        LEG_ORDER.map(async (bookmaker) => {
            const tipLeg = legOf(legs, bookmaker);
            const leg = recordLegs.find((l) => l.bookmaker === bookmaker)!;
            if (!tipLeg) {
                leg.state = 'NOT_READY';
                leg.reason = 'tip has no leg for this bookmaker';
                leg.odds = null;
                return;
            }

            try {
                const result = await vps[bookmaker]!.prepare(
                    executionId,
                    clientId,
                    tipLeg,
                    Number((stake * tipLeg.stakeRatio).toFixed(2))
                );
                leg.state = result?.ok === true ? 'READY' : 'NOT_READY';
                leg.reason = result?.reason ?? null;
                leg.odds = result?.odds ?? null;
            } catch (err) {
                leg.state = 'NOT_READY';
                leg.reason = (err as Error)?.message ?? 'prepare failed';
                leg.odds = null;
            }
        })
    );

    return recordLegs.every((l) => l.state === 'READY');
}

function resetPrepareState(recordLegs: ExecutionLeg[]) {
    for (const leg of recordLegs) {
        leg.state = 'PENDING';
        leg.reason = null;
        leg.odds = null;
        leg.orderId = null;
    }
}

function oddsByBookmaker(recordLegs: ExecutionLeg[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const leg of recordLegs) {
        if (leg.odds != null && Number.isFinite(Number(leg.odds))) {
            out[leg.bookmaker] = Number(leg.odds);
        }
    }
    return out;
}

function oddsSummary(recordLegs: ExecutionLeg[]): string {
    return recordLegs.map((leg) => `${leg.bookmaker} ${leg.odds ?? '-'}`).join(', ');
}

function ratiosChanged(current: VpsLeg[], next: VpsLeg[]): boolean {
    return current.some((leg) => {
        const updated = next.find((entry) => String(entry.bookmaker).toUpperCase() === String(leg.bookmaker).toUpperCase());
        if (!updated) return true;
        return (
            Math.abs(Number(updated.odds) - Number(leg.odds)) > 1e-9 ||
            Math.abs(Number(updated.stakeRatio) - Number(leg.stakeRatio)) > 1e-9
        );
    });
}

function liveOddsChanged(legs: VpsLeg[], recordLegs: ExecutionLeg[]): boolean {
    return legs.some((leg) => {
        const actual = recordLegs.find(
            (entry) => String(entry.bookmaker).toUpperCase() === String(leg.bookmaker).toUpperCase()
        )?.odds;
        return actual != null && Math.abs(Number(actual) - Number(leg.odds)) > 1e-9;
    });
}

/**
 * Runs one tip for one client.
 * @returns the record, whose `state` is DONE only when both legs are confirmed by their sites.
 */
export async function executeTip(params: {
    tipId: string;
    clientId: string;
    stake: number;
    legs: VpsLeg[];
    deps: ExecutionDeps;
}): Promise<ExecutionRecord> {
    const { tipId, clientId, stake, deps } = params;
    const now = deps.now ?? (() => new Date());
    const executionId = (deps.idFactory ?? (() => `ex_${randomUUID()}`))();

    let workingLegs: VpsLeg[] = params.legs.map((leg) => ({ ...leg }));
    let rebuild: RebuildInfo | null = null;

    const record: ExecutionRecord = {
        executionId,
        tipId,
        clientId,
        totalStake: stake,
        state: 'ABORTED',
        legs: LEG_ORDER.map((bookmaker) => ({ bookmaker, state: 'PENDING' as LegState })),
        createdAt: now().toISOString(),
        rebuilt: false,
        rebuild: null,
    };

    const finish = async (state: JobState, note: string | null) => {
        record.state = state;
        record.note = note;
        record.rebuilt = Boolean(rebuild);
        record.rebuild = rebuild;
        if (deps.save) await deps.save(record);
        return record;
    };

    const missing = LEG_ORDER.filter((bm) => !deps.vps[bm]);
    if (missing.length > 0) {
        for (const leg of record.legs) leg.state = 'NOT_READY';
        return finish('ABORTED', `VPS not configured for: ${missing.join(', ')}`);
    }

    let bothReady = await prepareBoth({
        executionId,
        clientId,
        stake,
        legs: workingLegs,
        recordLegs: record.legs,
        vps: deps.vps,
    });

    const nearbyOn = deps.nearbyEnabled ?? isNearbyRebuildEnabled();
    if (!bothReady && nearbyOn && legsNeedLine(workingLegs)) {
        const original = tipLine(workingLegs);
        if (original != null) {
            for (const candidate of nearbyLineCandidates(original)) {
                const lined = withSharedLine(workingLegs, candidate);
                resetPrepareState(record.legs);
                const probeOk = await prepareBoth({
                    executionId,
                    clientId,
                    stake,
                    legs: lined,
                    recordLegs: record.legs,
                    vps: deps.vps,
                });
                if (!probeOk) continue;

                const oddsByBook: Record<string, number> = {};
                for (const leg of record.legs) {
                    if (leg.odds != null) oddsByBook[leg.bookmaker] = Number(leg.odds);
                }
                const rebuiltLegs = applyStakeRatios(lined, oddsByBook);
                if (!rebuiltLegs) continue;

                // Re-prepare with corrected stake ratios (odds may drift slightly).
                resetPrepareState(record.legs);
                const ratioOk = await prepareBoth({
                    executionId,
                    clientId,
                    stake,
                    legs: rebuiltLegs,
                    recordLegs: record.legs,
                    vps: deps.vps,
                });
                if (!ratioOk) continue;

                const finalOdds: Record<string, number> = {};
                for (const leg of record.legs) {
                    if (leg.odds != null) finalOdds[leg.bookmaker] = Number(leg.odds);
                }
                const split = applyStakeRatios(rebuiltLegs, finalOdds);
                if (!split) continue;
                const ratios = stakeRatiosFromOdds(finalOdds.BETONLINE, finalOdds.PS3838);
                if (!ratios) continue;

                workingLegs = split;
                rebuild = {
                    originalLine: original,
                    appliedLine: candidate,
                    profitPercent: ratios.profitPercent,
                    reason: `nearby line ${candidate} (tip was ${original})`,
                };
                bothReady = true;
                break;
            }
        }
    }

    // Odds may have moved without the line changing. Recalculate the split from the odds the VPSs
    // actually returned; only a still-profitable pair may reach commit.
    if (bothReady && !rebuild) {
        const firstOdds = oddsByBookmaker(record.legs);
        if (liveOddsChanged(workingLegs, record.legs)) {
            const firstRatios = stakeRatiosFromOdds(firstOdds.BETONLINE, firstOdds.PS3838);
            if (!firstRatios) {
                return finish('ABORTED', `odds changed: no surebet (${oddsSummary(record.legs)})`);
            }

            const rebalanced = applyStakeRatios(workingLegs, firstOdds);
            if (!rebalanced) {
                return finish('ABORTED', `odds changed: no surebet (${oddsSummary(record.legs)})`);
            }

            if (ratiosChanged(workingLegs, rebalanced)) {
                resetPrepareState(record.legs);
                const ratioOk = await prepareBoth({
                    executionId,
                    clientId,
                    stake,
                    legs: rebalanced,
                    recordLegs: record.legs,
                    vps: deps.vps,
                });
                if (!ratioOk) return finish('ABORTED', describe(record.legs));

                const finalOdds = oddsByBookmaker(record.legs);
                const finalRatios = stakeRatiosFromOdds(finalOdds.BETONLINE, finalOdds.PS3838);
                if (!finalRatios) {
                    return finish('ABORTED', `odds changed: no surebet (${oddsSummary(record.legs)})`);
                }
                const finalSplit = applyStakeRatios(rebalanced, finalOdds);
                if (!finalSplit) {
                    return finish('ABORTED', `odds changed: no surebet (${oddsSummary(record.legs)})`);
                }
                workingLegs = finalSplit;
            } else {
                workingLegs = rebalanced;
            }
        }
    }

    if (!bothReady) {
        return finish('ABORTED', describe(record.legs));
    }

    await Promise.all(
        LEG_ORDER.map(async (bookmaker) => {
            const tipLeg = legOf(workingLegs, bookmaker)!;
            const leg = record.legs.find((l) => l.bookmaker === bookmaker)!;
            try {
                const result = await deps.vps[bookmaker]!.commit(
                    executionId,
                    clientId,
                    tipLeg,
                    Number((stake * tipLeg.stakeRatio).toFixed(2))
                );
                leg.state = result?.ok === true ? 'COMMITTED' : 'REJECTED';
                leg.orderId = result?.orderId ?? null;
                leg.reason = result?.reason ?? null;
                if (result?.odds != null) leg.odds = result.odds;
            } catch (err) {
                leg.state = 'REJECTED';
                leg.reason = (err as Error)?.message ?? 'commit failed';
            }
        })
    );

    const committed = record.legs.filter((l) => l.state === 'COMMITTED');
    if (committed.length === 0) {
        return finish('ABORTED', describe(record.legs));
    }

    await Promise.all(
        committed.map(async (leg) => {
            const tipLeg = legOf(workingLegs, leg.bookmaker)!;
            try {
                const result = await deps.vps[leg.bookmaker as 'BETONLINE' | 'PS3838']!.verify(
                    executionId,
                    clientId,
                    tipLeg,
                    leg.orderId
                );
                leg.state = result?.found === true ? 'VERIFIED' : 'MISSING';
                if (result?.found !== true) leg.reason = 'site does not show the bet';
            } catch (err) {
                leg.state = 'MISSING';
                leg.reason = (err as Error)?.message ?? 'verify failed';
            }
        })
    );

    // Rebuild details live only on `rebuild` / `rebuilt` (API may redact them). Keep `note` free of that leak.
    const verified = record.legs.filter((l) => l.state === 'VERIFIED');
    if (verified.length === 2) return finish('DONE', null);
    if (verified.length === 1) {
        return finish('ONE_LEG', describe(record.legs) + ' - check both sites manually');
    }
    return finish('REVIEW_NEEDED', 'site confirmation missing: ' + describe(record.legs));
}
