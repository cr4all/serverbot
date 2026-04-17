'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const hasDarkClass = document.documentElement.classList.contains('dark');
  return hasDarkClass ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [persistPreference, setPersistPreference] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = window.localStorage.getItem('theme');
      return stored === 'light' || stored === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (persistPreference) {
      document.documentElement.dataset.theme = theme;
      try {
        window.localStorage.setItem('theme', theme);
      } catch {}
    }
  }, [theme, persistPreference]);

  const nextTheme = useMemo<Theme>(() => (theme === 'dark' ? 'light' : 'dark'), [theme]);
  const label = useMemo(
    () => (theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'),
    [theme],
  );

  if (!isClient) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        // User explicit selection: store immediately to avoid "system" media query overriding.
        setPersistPreference(true);
        document.documentElement.dataset.theme = nextTheme;
        try {
          window.localStorage.setItem('theme', nextTheme);
        } catch {}
        setTheme(nextTheme);
      }}
      className="fixed bottom-4 right-4 z-50 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-800 shadow dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
    >
      {theme === 'dark' ? (
        // Sun icon
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 18v-2m10-8h-2M4 12H2m17.071-7.071-1.414 1.414M6.343 17.657l-1.414 1.414m12.728 0-1.414-1.414M6.343 6.343 4.929 4.93" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a6 6 0 100-12 6 6 0 000 12Z" />
        </svg>
      ) : (
        // Moon icon
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79Z" />
        </svg>
      )}
    </button>
  );
}

