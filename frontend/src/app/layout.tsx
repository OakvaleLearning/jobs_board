import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Inter } from 'next/font/google';
import { Providers } from '@/lib/query-client';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'opsz'],
});

const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'Oakvale jobs portal',
  description:
    'A credentialed care marketplace. CPD-accredited Nigerian workers, verified and placed with proof.',
};

// This is an auth-gated, client-data portal — every page renders per-request behind
// the JWT/session, so there is nothing to statically pre-render. Forcing dynamic
// rendering keeps `next build` from trying (and failing) to prerender client pages.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
