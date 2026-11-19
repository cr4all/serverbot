'use client';

type Props = {
  label: string;
  reachable: boolean;
  loggedIn?: boolean;
  reason?: string | null;
  /** Kept for call-site compatibility; the board always uses the detailed card. */
  compact?: boolean;
};

/** Soft orbital link: Desk ↔ bookmaker session. */
export default function VpsLinkStatus({ label, reachable, loggedIn, reason }: Props) {
  const ready = reachable && (loggedIn === undefined || loggedIn);
  const tone = ready ? 'up' : reachable ? 'partial' : 'down';
  const status = ready ? 'Connected' : reachable ? 'Online · signing in' : 'Unreachable';

  return (
    <div className={`vps-link vps-link--${tone}`} title={reason || status}>
      <div className="vps-link__visual" aria-hidden>
        <svg className="vps-link__svg" viewBox="0 0 148 52" fill="none">
          <defs>
            <linearGradient id={`vps-grad-${label}`} x1="28" y1="26" x2="120" y2="26" gradientUnits="userSpaceOnUse">
              <stop className="vps-link__grad-a" offset="0%" />
              <stop className="vps-link__grad-b" offset="100%" />
            </linearGradient>
            <filter id={`vps-glow-${label}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* faint track */}
          <path className="vps-link__track" d="M30 26 C52 10, 96 10, 118 26 C96 42, 52 42, 30 26 Z" />

          {/* primary path */}
          <path
            className="vps-link__path"
            d="M34 26 H114"
            stroke={`url(#vps-grad-${label})`}
            filter={ready ? `url(#vps-glow-${label})` : undefined}
          />

          {/* traveling packet when connecting / connected */}
          {tone !== 'down' ? (
            <circle className="vps-link__packet" r="2.4" filter={ready ? `url(#vps-glow-${label})` : undefined}>
              <animateMotion dur={ready ? '2.4s' : '1.5s'} repeatCount="indefinite" path="M34 26 H114" />
            </circle>
          ) : null}

          <circle className="vps-link__node vps-link__node--a" cx="26" cy="26" r="7.5" />
          <circle className="vps-link__node-core" cx="26" cy="26" r="3.2" />
          <circle className="vps-link__node vps-link__node--b" cx="122" cy="26" r="7.5" />
          <circle className="vps-link__node-core" cx="122" cy="26" r="3.2" />

          {!ready && reachable ? (
            <g className="vps-link__hint">
              <circle cx="74" cy="26" r="8" />
              <path d="M74 21.5 V26.5 L77 29" />
            </g>
          ) : null}

          {!reachable ? (
            <g className="vps-link__break">
              <path d="M68 20 L80 32" />
              <path d="M80 20 L68 32" />
            </g>
          ) : null}
        </svg>
      </div>
      <div className="vps-link__meta">
        <strong>{label}</strong>
        <span className={`vps-link__status vps-link__status--${tone}`}>{status}</span>
        {reason && !ready ? <em className="vps-link__reason">{reason}</em> : null}
      </div>
    </div>
  );
}
