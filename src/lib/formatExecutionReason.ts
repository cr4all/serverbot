/**
 * Turn raw execution / leg failure codes into readable sentences for History (and Board brief lines).
 */

type LegLike = {
  bookmaker?: string | null;
  state?: string | null;
  reason?: string | null;
};

const PATTERNS: Array<{ re: RegExp; text: (m: RegExpMatchArray) => string }> = [
  {
    re: /line moved \(requested ([^,]+), site ([^)]+)\)/i,
    text: (m) => `The tip line (${m[1].trim()}) no longer matches the site line (${m[2].trim()}).`,
  },
  {
    re: /odds moved \(([^)]+)\)/i,
    text: (m) => `Odds moved against the tip (${m[1].trim()}).`,
  },
  {
    re: /unsupported sport\s+(\w+)/i,
    text: (m) => `This bookmaker adapter does not support the sport “${m[1]}” yet.`,
  },
  {
    re: /event not found/i,
    text: () => 'The event could not be found on the bookmaker site.',
  },
  {
    re: /no session for client/i,
    text: () => 'The VPS Chrome session is missing or not logged in.',
  },
  {
    re: /login rejected \(invalid credentials\)/i,
    text: () => 'Login was rejected — check the bookmaker username and password.',
  },
  {
    re: /otp relay failed|otp input not found|authenticator verification/i,
    text: () => 'Login needs an authenticator code (OTP) that was missing or cancelled.',
  },
  {
    re: /verification dialog did not close/i,
    text: () => 'Authenticator verification did not finish after the code was submitted.',
  },
  {
    re: /login not confirmed/i,
    text: () => 'The site did not confirm a logged-in session after login.',
  },
  {
    re: /odds changed: no surebet/i,
    text: () => 'After prepare, the odds no longer formed a surebet, so both legs were aborted.',
  },
  {
    re: /VPS not configured/i,
    text: () => 'A VPS connection for this bookmaker is not configured.',
  },
  {
    re: /ONE_LEG|one.?leg/i,
    text: () => 'Only one leg may have been placed — check both bookmakers manually.',
  },
  {
    re: /commit without a successful prepare/i,
    text: () => 'Commit was blocked because prepare did not succeed on this leg.',
  },
];

export function formatExecutionReason(
  reason: string | null | undefined,
  legs?: LegLike[] | null,
  brief = false
): string {
  const raw = String(reason ?? '').trim();
  const legBits = (legs ?? [])
    .filter((l) => l?.reason)
    .map((l) => `${String(l.bookmaker ?? 'leg').toUpperCase()}: ${String(l.reason)}`);

  const pieces = [raw, ...legBits].filter(Boolean);
  if (pieces.length === 0) return brief ? 'Failed' : 'No failure detail was recorded.';

  const rendered = pieces.map((piece) => {
    for (const { re, text } of PATTERNS) {
      const m = piece.match(re);
      if (m) return text(m);
    }
    return piece;
  });

  const unique = [...new Set(rendered)];
  if (brief) {
    const first = unique[0] ?? 'Failed';
    return first.length > 120 ? `${first.slice(0, 117)}…` : first;
  }
  return unique.join(' ');
}

export function isSuccessExecutionState(state: string | null | undefined): boolean {
  const s = String(state ?? '').toUpperCase();
  return s === 'DONE' || s === 'VERIFIED' || s === 'SETTLED';
}

export function isInFlightExecutionState(state: string | null | undefined): boolean {
  const s = String(state ?? '').toUpperCase();
  return (
    s === 'PREPARING' ||
    s === 'COMMITTING' ||
    s === 'RUNNING' ||
    s === 'PENDING' ||
    s === 'READY'
  );
}

export function isFailedExecutionState(state: string | null | undefined): boolean {
  const s = String(state ?? '').toUpperCase();
  return s === 'ABORTED' || s === 'ONE_LEG' || s === 'REVIEW_NEEDED' || s === 'REJECTED' || s === 'FAILED';
}
