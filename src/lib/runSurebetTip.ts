import { HubError, listOpenTips } from '@/lib/hubClient';
import { createVpsClient } from '@/lib/vpsClient';
import { executeTip, type ExecutionRecord } from '@/lib/executionService';
import { redactRebuildForClient } from '@/lib/nearbySurebet';
import connectDB from '@/lib/db';
import ClientExecution from '@/models/ClientExecution';
import { resolveClientVpsConnections } from '@/lib/vpsNodes';

export type RunSurebetTipResult =
  | { ok: true; status: 202 | 409; record: Record<string, unknown> }
  | { ok: false; status: number; error: string; missing?: string[] };

/** Shared tip execution used by manual Run and the auto-runner. */
export async function runSurebetTipForClient(opts: {
  tipId: string;
  clientId: string;
  stake: number;
}): Promise<RunSurebetTipResult> {
  const tipId = String(opts.tipId ?? '').trim();
  const clientId = String(opts.clientId ?? '').trim();
  const stake = Number(opts.stake);

  if (!tipId) return { ok: false, status: 400, error: 'tipId is required' };
  if (!clientId) return { ok: false, status: 400, error: 'clientId is required' };
  if (!Number.isFinite(stake) || stake <= 0) {
    return { ok: false, status: 400, error: 'stake must be a positive number' };
  }

  let tip;
  try {
    const tips = await listOpenTips(200);
    tip = tips.find((t) => t.tipId === tipId);
  } catch (err) {
    const status = err instanceof HubError ? err.status : 502;
    return { ok: false, status, error: (err as Error)?.message ?? 'hub request failed' };
  }

  if (!tip) return { ok: false, status: 404, error: 'tip not found or expired' };

  let connections;
  try {
    connections = await resolveClientVpsConnections(clientId);
  } catch (err) {
    return { ok: false, status: 500, error: (err as Error)?.message ?? 'VPS configuration is invalid' };
  }

  const missingVps = (['BETONLINE', 'PS3838'] as const).filter((role) => !connections[role]);
  if (missingVps.length > 0) {
    return {
      ok: false,
      status: 409,
      error: `VPS not configured for: ${missingVps.join(', ')}. Select a VPS when creating the bot.`,
      missing: [...missingVps],
    };
  }

  const vps: Record<string, ReturnType<typeof createVpsClient>> = {};
  const vpsTimeoutMs = Number(process.env.VPS_TIMEOUT_MS ?? 90000);
  if (connections.BETONLINE) {
    vps.BETONLINE = createVpsClient({ connection: connections.BETONLINE, timeoutMs: vpsTimeoutMs });
  }
  if (connections.PS3838) {
    vps.PS3838 = createVpsClient({ connection: connections.PS3838, timeoutMs: vpsTimeoutMs });
  }

  try {
    const record = await executeTip({
      tipId: tip.tipId,
      clientId,
      stake,
      legs: tip.legs.map((leg) => ({
        bookmaker: String(leg.bookmaker).toUpperCase(),
        eventName: leg.eventName,
        sport: leg.sport,
        marketType: leg.marketType,
        period: leg.period,
        line: leg.line,
        selection: leg.selection,
        odds: leg.odds,
        stakeRatio: leg.stakeRatio,
      })),
      deps: {
        vps: vps as never,
        save: async (row: ExecutionRecord) => {
          await connectDB();
          await ClientExecution.updateOne(
            { executionId: row.executionId },
            { $set: { ...row, clientId } },
            { upsert: true }
          );
        },
      },
    });

    const started = record.state !== 'ABORTED';
    return {
      ok: true,
      status: started ? 202 : 409,
      record: redactRebuildForClient({ ...record } as Record<string, unknown>) as Record<string, unknown>,
    };
  } catch (err) {
    return { ok: false, status: 502, error: (err as Error)?.message ?? 'execution failed' };
  }
}
