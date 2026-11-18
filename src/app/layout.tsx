import type { Metadata } from 'next';
import { Fraunces, Inter, Manrope } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import ThemeToggle from './components/ThemeToggle';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body-loaded',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ServerBot',
  description: 'Distributed surebet operations',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${manrope.variable} ${inter.variable}`}>
      <body className="antialiased" style={{ fontFamily: 'var(--font-body-loaded), var(--font-body)' }}>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--font-display:var(--font-display-loaded),Georgia,serif;--font-body:var(--font-body-loaded),Segoe UI,sans-serif;}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
  try {
    var stored = window.localStorage.getItem('theme');
    var isExplicit = stored === 'light' || stored === 'dark';
    var theme = isExplicit ? stored : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();`,
          }}
        />
        <Providers>{children}</Providers>
        <ThemeToggle />
      </body>
    </html>
  );
}
