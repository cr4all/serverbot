/**
 * Client-side execution: one tip, two VPSs, both legs or nothing.
 *
 * Order is fixed for safety:
 *   1. prepare on BOTH VPSs (in parallel) - nothing is placed yet
 *   2. commit on BOTH, only when both answered ok
 *   3. verify on each site (open bets)
 * A leg that is not confirmed becomes ONE_LEG / REVIEW_NEEDED so a human acts; nothing is retried automatically.
 */
import { randomUUID } from 'node:crypto';
import type { VpsClient, VpsLeg } from './vpsClient';

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
}

export interface ExecutionDeps {
    /** Clients for the two VPSs. A missing entry means that side is not configured. */
    vps: Partial<Record<'BETONLINE' | 'PS3838', VpsClient>>;
    /** Optional persistence hook (Mongo in the app, a fake in tests). */
    save?: (record: ExecutionRecord) => Promise<void>;
    now?: () => Date;
    idFactory?: () => string;
}

const LEG_ORDER = ['BETONLINE', 'PS3838'] as const;

function legOf(tipLegs: VpsLeg[], bookmaker: string): VpsLeg | undefined {
    return tipLegs.find((l) => String(l.bookmaker).toUpperCase() === bookmaker);
}

function describe(legs: ExecutionLeg[]): string {
    return legs.map((l) => `${l.bookmaker}=${l.state}`).join('; ');
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
    const { tipId, clientId, stake, legs, deps } = params;
    const now = deps.now ?? (() => new Date());
    const executionId = (deps.idFactory ?? (() => `ex_${randomUUID()}`))();

    const record: ExecutionRecord = {
        executionId,
        tipId,
        clientId,
        totalStake: stake,
        state: 'ABORTED',
        legs: LEG_ORDER.map((bookmaker) => ({ bookmaker, state: 'PENDING' as LegState })),
        createdAt: now().toISOString(),
    };

    const finish = async (state: JobState, note: string | null) => {
        record.state = state;
        record.note = note;
        if (deps.save) await deps.save(record);
        return record;
    };

    // 1. Both sides must exist and be able to place the bet.
    const missing = LEG_ORDER.filter((bm) => !deps.vps[bm]);
    if (missing.length > 0) {
        for (const leg of record.legs) leg.state = 'NOT_READY';
        return finish('ABORTED', `VPS not configured for: ${missing.join(', ')}`);
    }

    await Promise.all(
        LEG_ORDER.map(async (bookmaker) => {
            const tipLeg = legOf(legs, bookmaker);
            const leg = record.legs.find((l) => l.bookmaker === bookmaker)!;
            if (!tipLeg) {
                leg.state = 'NOT_READY';
                leg.reason = 'tip has no leg for this bookmaker';
                return;
            }

            try {
                const result = await deps.vps[bookmaker]!.prepare(
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
            }
        })
    );

    if (record.legs.some((l) => l.state !== 'READY')) {
        // Not both ready: nothing may be placed.
        return finish('ABORTED', describe(record.legs));
    }

    // 2. Commit both, in parallel.
    await Promise.all(
        LEG_ORDER.map(async (bookmaker) => {
            const tipLeg = legOf(legs, bookmaker)!;
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

    // 3. Confirm on the sites themselves.
    await Promise.all(
        committed.map(async (leg) => {
            const tipLeg = legOf(legs, leg.bookmaker)!;
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

    const verified = record.legs.filter((l) => l.state === 'VERIFIED');
    if (verified.length === 2) return finish('DONE', null);
    if (verified.length === 1) return finish('ONE_LEG', describe(record.legs) + ' - check both sites manually');
    return finish('REVIEW_NEEDED', 'site confirmation missing: ' + describe(record.legs));
}
