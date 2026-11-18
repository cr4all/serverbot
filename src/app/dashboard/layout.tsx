'use client';

import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ChangePasswordDialog from '@/app/components/ChangePasswordDialog';
import OtpChallengeDialog from '@/components/OtpChallengeDialog';

type IconProps = { className?: string };

function IconCrest({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h10v4.2a5 5 0 0 1-10 0V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7 6H4.4v1.1A4 4 0 0 0 8.4 11M17 6h2.6v1.1A4 4 0 0 1 15.6 11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M12 13v4M8.5 21h7M9.5 17.5h5V21h-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function IconDesk({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconBoard({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v1a1.5 1.5 0 0 0 0 3v1A2.5 2.5 0 0 1 17.5 16h-11A2.5 2.5 0 0 1 4 13.5v-1a1.5 1.5 0 0 0 0-3v-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M9 8v8M13 8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconBots({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="7" y="7" width="10" height="10" rx="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function IconHistory({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12a8 8 0 1 0 2.3-5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 5v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconAdmin({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 4.5 6v5.5c0 4.4 3.1 8 7.5 9.5 4.4-1.5 7.5-5.1 7.5-9.5V6L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconKey({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11.5 12H21M17 12v3M20 12v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconLogout({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m15 16 4-4-4-4M9 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMenu({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconClose({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconBall({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m12 7 3.4 2.5-1.3 4h-4.2l-1.3-4L12 7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 3v4M4.7 9.3l3.3 1.9M19.3 9.3l-3.3 1.9M7.6 19.2l1.2-3.4M16.4 19.2l-1.2-3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconChart({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m7 15 4-4 3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPulse({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12h4l2.2-5.4L13.5 17l2-5H21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrophy({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 6H5v1a3.5 3.5 0 0 0 3.5 3.5M16 6h3v1a3.5 3.5 0 0 1-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 12v4M9 20h6M10 16h4v4h-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

const NAV = [
  {
    href: '/dashboard',
    label: 'Desk',
    icon: IconDesk,
    match: (p: string) => p === '/dashboard',
  },
  {
    href: '/dashboard/opportunities',
    label: 'Board',
    icon: IconBoard,
    match: (p: string) =>
      p.startsWith('/dashboard/opportunities') || p.startsWith('/dashboard/surebets'),
  },
  {
    href: '/dashboard/bots',
    label: 'Bots',
    icon: IconBots,
    match: (p: string) => p.startsWith('/dashboard/bots') || p.startsWith('/dashboard/instance'),
  },
  {
    href: '/dashboard/history',
    label: 'History',
    icon: IconHistory,
    match: (p: string) =>
      p.startsWith('/dashboard/history') ||
      p.startsWith('/dashboard/executions') ||
      p.startsWith('/dashboard/bets') ||
      p.startsWith('/dashboard/analytics'),
  },
] as const;

const TICKER = [
  { label: 'Live odds streams', icon: IconBall },
  { label: 'Surebet engine', icon: IconTrophy },
  { label: 'Real-time execution', icon: IconPulse },
  { label: 'Bot fleet ready', icon: IconBots },
  { label: 'Hub + VPS desk', icon: IconCrest },
  { label: 'Arbitrage radar', icon: IconChart },
  { label: 'PS3838 + BetOnline', icon: IconBoard },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname() ?? '';
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const displayName = session?.user?.name ?? session?.user?.email ?? 'Signed in';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'S';

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="pt-shell pt-shell--topbar">
      <div className="pt-shell__noise" aria-hidden />

      <header className="pt-topbar">
        <div className="pt-topbar__inner">
          <Link href="/dashboard" className="pt-brand">
            <span className="pt-brand__crest" aria-hidden>
              <IconCrest className="pt-brand__crest-icon" />
            </span>
            <span className="pt-brand__copy">
              <strong>Surebet</strong>
              <small>Terminal</small>
            </span>
          </Link>

          <nav className="pt-topnav" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`pt-topnav__link${item.match(pathname) ? ' is-active' : ''}`}
              >
                <item.icon className="pt-topnav__icon" />
                <span>{item.label}</span>
              </Link>
            ))}
            {isAdmin ? (
              <Link
                href="/admin"
                className={`pt-topnav__link${pathname.startsWith('/admin') ? ' is-active' : ''}`}
              >
                <IconAdmin className="pt-topnav__icon" />
                <span>Admin</span>
              </Link>
            ) : null}
          </nav>

          <div className="pt-topbar__actions">
            <span className="pt-live">
              <span className="pt-live__dot" aria-hidden />
              Hub + VPS desk
            </span>

            <div className="pt-user" title={displayName}>
              <span className="pt-avatar" aria-hidden>
                {initial}
              </span>
              <span className="pt-user__meta">
                <small>Operator</small>
                <strong>{displayName}</strong>
              </span>
            </div>

            <Link href="/dashboard/settings" className="pt-action" aria-label="Settings" title="Settings">
              <IconSettings className="pt-action__icon" />
              <span className="pt-action__label">Settings</span>
            </Link>
            <button
              type="button"
              className="pt-action"
              aria-label="Change password"
              title="Change password"
              onClick={() => setIsChangePasswordOpen(true)}
            >
              <IconKey className="pt-action__icon" />
              <span className="pt-action__label">Password</span>
            </button>
            <button
              type="button"
              className="pt-action pt-action--signout"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <IconLogout className="pt-action__icon" />
              <span className="pt-action__label">Sign out</span>
            </button>

            <button
              type="button"
              className="pt-action pt-action--menu"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="pt-mobile-drawer"
              onClick={() => setMobileOpen(true)}
            >
              <IconMenu className="pt-action__icon" />
            </button>
          </div>
        </div>

        <div className="pt-ticker" aria-hidden>
          <div className="pt-ticker__track">
            {[...TICKER, ...TICKER].map((item, index) => (
              <span className="pt-ticker__item" key={`${item.label}-${index}`}>
                <item.icon className="pt-ticker__icon" />
                {item.label}
                <span className="pt-ticker__dot" />
              </span>
            ))}
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="pt-drawer-backdrop"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <aside className="pt-drawer" id="pt-mobile-drawer" aria-label="Mobile menu">
            <div className="pt-drawer__head">
              <Link href="/dashboard" className="pt-brand" onClick={closeMobile}>
                <span className="pt-brand__crest" aria-hidden>
                  <IconCrest className="pt-brand__crest-icon" />
                </span>
                <span className="pt-brand__copy">
                  <strong>Surebet</strong>
                  <small>Terminal</small>
                </span>
              </Link>
              <button type="button" className="pt-drawer__close" aria-label="Close menu" onClick={closeMobile}>
                <IconClose />
              </button>
            </div>

            <nav className="pt-drawer__nav" aria-label="Mobile main">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`pt-drawer__link${item.match(pathname) ? ' is-active' : ''}`}
                  onClick={closeMobile}
                >
                  <item.icon className="pt-drawer__icon" />
                  <span>{item.label}</span>
                </Link>
              ))}
              {isAdmin ? (
                <Link
                  href="/admin"
                  className={`pt-drawer__link${pathname.startsWith('/admin') ? ' is-active' : ''}`}
                  onClick={closeMobile}
                >
                  <IconAdmin className="pt-drawer__icon" />
                  <span>Admin</span>
                </Link>
              ) : null}
            </nav>

            <div className="pt-drawer__actions">
              <div className="pt-drawer__user">
                <span className="pt-avatar" aria-hidden>
                  {initial}
                </span>
                <span className="pt-user__meta">
                  <small>Operator</small>
                  <strong>{displayName}</strong>
                </span>
              </div>
              <Link href="/dashboard/settings" className="pt-drawer__action" onClick={closeMobile}>
                <IconSettings className="pt-drawer__icon" />
                Settings
              </Link>
              <button
                type="button"
                className="pt-drawer__action"
                onClick={() => {
                  closeMobile();
                  setIsChangePasswordOpen(true);
                }}
              >
                <IconKey className="pt-drawer__icon" />
                Change password
              </button>
              <button
                type="button"
                className="pt-drawer__action pt-drawer__action--signout"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <IconLogout className="pt-drawer__icon" />
                Sign out
              </button>
            </div>
          </aside>
        </>
      ) : null}

      <main className="pt-content">{children}</main>

      {isChangePasswordOpen ? (
        <ChangePasswordDialog open={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
      ) : null}
      <OtpChallengeDialog />
    </div>
  );
}
