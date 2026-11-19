/**
 * In-memory warm/login attempt state per desk (survives only while the Next process lives).
 * Caps re-login attempts at 3 per bookmaker until the desk is Stopped then Run again.
 */

export type BookmakerKey = 'BETONLINE' | 'PS3838';

export type VpsLegWarm = {
  reachable: boolean;
  loggedIn: boolean;
  loginAttempts: number;
  lastError: string | null;
  lastAt: number | null;
};

export type DeskWarmSnapshot = {
  deskId: string;
  clientId: string;
  warming: boolean;
  bol: VpsLegWarm;
  ps: VpsLegWarm;
  log: Array<{ at: number; tone: 'info' | 'success' | 'warning' | 'danger'; message: string }>;
  ready: boolean;
};

const MAX_LOGIN_ATTEMPTS = 3;
const MAX_LOG = 40;

const emptyLeg = (): VpsLegWarm => ({
  reachable: false,
  loggedIn: false,
  loginAttempts: 0,
  lastError: null,
  lastAt: null,
});

const store = new Map<string, DeskWarmSnapshot>();

function key(clientId: string, deskId: string) {
  return `${clientId}::${deskId}`;
}

export function getDeskWarm(clientId: string, deskId: string): DeskWarmSnapshot | null {
  return store.get(key(clientId, deskId)) ?? null;
}

export function resetDeskWarm(clientId: string, deskId: string): DeskWarmSnapshot {
  const snap: DeskWarmSnapshot = {
    deskId,
    clientId,
    warming: false,
    bol: emptyLeg(),
    ps: emptyLeg(),
    log: [],
    ready: false,
  };
  store.set(key(clientId, deskId), snap);
  return snap;
}

export function ensureDeskWarm(clientId: string, deskId: string): DeskWarmSnapshot {
  const existing = store.get(key(clientId, deskId));
  if (existing) return existing;
  return resetDeskWarm(clientId, deskId);
}

function recomputeReady(snap: DeskWarmSnapshot) {
  snap.ready = snap.bol.reachable && snap.bol.loggedIn && snap.ps.reachable && snap.ps.loggedIn;
}

export function appendWarmLog(
  snap: DeskWarmSnapshot,
  tone: DeskWarmSnapshot['log'][number]['tone'],
  message: string
) {
  snap.log.push({ at: Date.now(), tone, message });
  if (snap.log.length > MAX_LOG) snap.log.splice(0, snap.log.length - MAX_LOG);
}

export function canAttemptLogin(leg: VpsLegWarm): boolean {
  return leg.loginAttempts < MAX_LOGIN_ATTEMPTS;
}

export function maxLoginAttempts(): number {
  return MAX_LOGIN_ATTEMPTS;
}

export function patchLeg(
  snap: DeskWarmSnapshot,
  bookmaker: BookmakerKey,
  patch: Partial<VpsLegWarm> & { bumpAttempt?: boolean }
): VpsLegWarm {
  const leg = bookmaker === 'BETONLINE' ? snap.bol : snap.ps;
  if (patch.bumpAttempt) leg.loginAttempts += 1;
  if (patch.reachable !== undefined) leg.reachable = patch.reachable;
  if (patch.loggedIn !== undefined) leg.loggedIn = patch.loggedIn;
  if (patch.lastError !== undefined) leg.lastError = patch.lastError;
  leg.lastAt = Date.now();
  recomputeReady(snap);
  return leg;
}

export function setWarming(snap: DeskWarmSnapshot, warming: boolean) {
  snap.warming = warming;
}
