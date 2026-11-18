import connectDB from '@/lib/db';
import BotInstance from '@/models/BotInstance';
import ClientExecution from '@/models/ClientExecution';
import { isHubConfigured, listOpenTips } from '@/lib/hubClient';
import { runSurebetTipForClient } from '@/lib/runSurebetTip';

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_STAKE = 1;

type RunnerState = {
  started: boolean;
  ticking: boolean;
  timer: ReturnType<typeof setInterval> | null;
  /** clientId -> in-flight */
  busy: Set<string>;
};

const state: RunnerState = {
  started: false,
  ticking: false,
  timer: null,
  busy: new Set(),
};

function autoStake(): number {
  const n = Number(process.env.SUREBET_AUTO_STAKE ?? DEFAULT_STAKE);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STAKE;
}

function intervalMs(): number {
  const n = Number(process.env.SUREBET_AUTO_POLL_MS ?? DEFAULT_INTERVAL_MS);
  return Number.isFinite(n) && n >= 2000 ? n : DEFAULT_INTERVAL_MS;
}

function tipStillOpen(expiresAtUtc: string | undefined): boolean {
  if (!expiresAtUtc) return true;
  const end = new Date(expiresAtUtc).getTime();
  return Number.isFinite(end) && end > Date.now();
}

/** Users who have at least one RUNNING BETONLINE/PS3838 surebet instance. */
async function activeClientIds(): Promise<string[]> {
  await connectDB();
  const rows = await BotInstance.find({ status: 'RUNNING' })
    .populate('botId', 'type')
    .select('userId botId')
    .lean();

  const ids = new Set<string>();
  for (const row of rows as Array<{ userId?: unknown; botId?: { type?: string } | null }>) {
    const type = String(row.botId?.type ?? '').toUpperCase();
    if (type !== 'BETONLINE' && type !== 'PS3838') continue;
    const userId = String(row.userId ?? '').trim();
    if (userId) ids.add(userId);
  }
  return [...ids];
}

async function alreadyTried(clientId: string, tipId: string): Promise<boolean> {
  const existing = await ClientExecution.findOne({ clientId, tipId }).select('_id').lean();
  return Boolean(existing);
}

async function processClient(clientId: string): Promise<void> {
  if (state.busy.has(clientId)) return;
  state.busy.add(clientId);
  try {
    const tips = await listOpenTips(50);
    const open = tips.filter((t) => tipStillOpen(t.expiresAtUtc));
    const stake = autoStake();

    for (const tip of open) {
      if (await alreadyTried(clientId, tip.tipId)) continue;

      console.log(`[surebet-auto] client=${clientId} running tip=${tip.tipId} stake=${stake}`);
      const result = await runSurebetTipForClient({ tipId: tip.tipId, clientId, stake });
      if (!result.ok) {
        console.warn(`[surebet-auto] tip=${tip.tipId} failed: ${result.error}`);
        // Persist a sentinel abort so we do not hammer the same tip every poll.
        await ClientExecution.updateOne(
          { executionId: `auto-skip-${clientId}-${tip.tipId}` },
          {
            $setOnInsert: {
              executionId: `auto-skip-${clientId}-${tip.tipId}`,
              tipId: tip.tipId,
              clientId,
              totalStake: stake,
              state: 'ABORTED',
              note: result.error,
              legs: [],
            },
          },
          { upsert: true }
        );
      } else {
        console.log(
          `[surebet-auto] tip=${tip.tipId} state=${String((result.record as { state?: string }).state ?? '')}`
        );
      }
      // One tip per tick per client keeps VPS load predictable.
      break;
    }
  } catch (err) {
    console.error('[surebet-auto] client tick failed:', (err as Error)?.message ?? err);
  } finally {
    state.busy.delete(clientId);
  }
}

async function tick(): Promise<void> {
  if (state.ticking) return;
  state.ticking = true;
  try {
    if (!isHubConfigured()) return;
    const clients = await activeClientIds();
    if (clients.length === 0) return;
    await Promise.all(clients.map((id) => processClient(id)));
  } catch (err) {
    console.error('[surebet-auto] tick failed:', (err as Error)?.message ?? err);
  } finally {
    state.ticking = false;
  }
}

/** Starts the background poller once per Node process (Next.js instrumentation). */
export function startSurebetAutoRunner(): void {
  if (state.started) return;
  if (process.env.SUREBET_AUTO_RUN === '0' || process.env.SUREBET_AUTO_RUN === 'false') {
    console.log('[surebet-auto] disabled via SUREBET_AUTO_RUN');
    return;
  }
  state.started = true;
  const ms = intervalMs();
  console.log(`[surebet-auto] started poll=${ms}ms stake=${autoStake()}`);
  void tick();
  state.timer = setInterval(() => void tick(), ms);
  // Allow process to exit in tests / short-lived scripts.
  if (state.timer && typeof state.timer === 'object' && 'unref' in state.timer) {
    state.timer.unref?.();
  }
}

export function stopSurebetAutoRunner(): void {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  state.started = false;
}
