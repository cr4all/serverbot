import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import ThemeToggle from "./components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
