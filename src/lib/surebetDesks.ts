import type { IBotInstance } from '@/types';

export type SurebetDesk = {
  deskId: string;
  name: string;
  createdAt: Date | string;
  betonline: IBotInstance | null;
  ps3838: IBotInstance | null;
  /** True when either bookmaker instance is RUNNING (auto-run enabled). */
  running: boolean;
};

function templateType(instance: IBotInstance) {
  return String((instance.botId as { type?: string } | undefined)?.type || '').toUpperCase();
}

function deskIdOf(instance: IBotInstance) {
  return String((instance.config as { deskId?: string } | undefined)?.deskId ?? '').trim();
}

function deskNameOf(instance: IBotInstance, fallback: string) {
  const fromConfig = String((instance.config as { deskName?: string } | undefined)?.deskName ?? '').trim();
  if (fromConfig) return fromConfig;
  const raw = String(instance.name ?? '').trim();
  return raw.replace(/\s*[·•-]\s*(BetOnline|PS3838)\s*$/i, '').trim() || fallback;
}

function createdMs(instance: IBotInstance) {
  const t = new Date(instance.createdAt as string | Date).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Groups BETONLINE + PS3838 instances into surebet bots (desks). */
export function groupSurebetDesks(instances: IBotInstance[]): SurebetDesk[] {
  const byDesk = new Map<string, SurebetDesk>();
  const unpairedBol: IBotInstance[] = [];
  const unpairedPs: IBotInstance[] = [];

  for (const instance of instances) {
    const type = templateType(instance);
    if (type !== 'BETONLINE' && type !== 'PS3838') continue;

    const deskId = deskIdOf(instance);
    if (deskId) {
      let desk = byDesk.get(deskId);
      if (!desk) {
        desk = {
          deskId,
          name: deskNameOf(instance, 'Surebet bot'),
          createdAt: instance.createdAt,
          betonline: null,
          ps3838: null,
          running: false,
        };
        byDesk.set(deskId, desk);
      }
      if (type === 'BETONLINE') desk.betonline = instance;
      else desk.ps3838 = instance;
      if (String(instance.status ?? '').toUpperCase() === 'RUNNING') desk.running = true;
      const ms = createdMs(instance);
      const deskMs = new Date(desk.createdAt).getTime();
      if (ms && (!Number.isFinite(deskMs) || ms < deskMs)) {
        desk.createdAt = instance.createdAt;
        desk.name = deskNameOf(instance, desk.name);
      }
      continue;
    }

    if (type === 'BETONLINE') unpairedBol.push(instance);
    else unpairedPs.push(instance);
  }

  unpairedBol.sort((a, b) => createdMs(a) - createdMs(b));
  unpairedPs.sort((a, b) => createdMs(a) - createdMs(b));
  const n = Math.max(unpairedBol.length, unpairedPs.length);
  for (let i = 0; i < n; i += 1) {
    const bol = unpairedBol[i] ?? null;
    const ps = unpairedPs[i] ?? null;
    const seed = bol ?? ps!;
    const deskId = `legacy-${String(seed._id)}`;
    byDesk.set(deskId, {
      deskId,
      name: deskNameOf(seed, `Surebet bot ${i + 1}`),
      createdAt: seed.createdAt,
      betonline: bol,
      ps3838: ps,
      running:
        String(bol?.status ?? '').toUpperCase() === 'RUNNING' ||
        String(ps?.status ?? '').toUpperCase() === 'RUNNING',
    });
  }

  return [...byDesk.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
