export interface TipLeg {
  bookmaker: string;
  eventName: string;
  sport?: string;
  marketType?: string;
  period?: string;
  line?: number | null;
  selection: string;
  odds: number;
  stakeRatio: number;
}

export interface Tip {
  tipId: string;
  eventName: string;
  sport: string;
  startsAtUtc: string;
  expiresAtUtc: string;
  profitPercent: number;
  status?: string;
  legs: TipLeg[];
}

export interface ExecutionLeg {
  bookmaker: string;
  state: string;
  reason?: string | null;
  orderId?: string | null;
  odds?: number | null;
}

export interface Execution {
  executionId: string;
  tipId?: string;
  totalStake: number;
  state: string;
  note?: string | null;
  legs: ExecutionLeg[];
  createdAt?: string;
  rebuilt?: boolean;
  rebuild?: {
    originalLine: number | null;
    appliedLine: number;
    profitPercent: number;
    reason: string;
  } | null;
}

export interface BetOnlineStatus {
  configured: boolean;
  accountReady: boolean;
  reachable: boolean;
  reason?: string | null;
}

export function secondsLeft(iso: string): number {
  const end = new Date(iso).getTime();
  return Number.isNaN(end) ? 0 : Math.max(0, Math.floor((end - Date.now()) / 1000));
}
