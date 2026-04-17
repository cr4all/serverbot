import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import ThemeToggle from './components/ThemeToggle';

export const metadata: Metadata = {
  title: "ServerBot Manager",
  description: "ServerBot Manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        {/* Prevent theme flash by setting the initial `html.dark` class early. */}
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
        <Providers>
          {children}
        </Providers>
        <ThemeToggle />
      </body>
    </html>
  );
}
