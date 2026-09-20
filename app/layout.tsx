import type { Metadata } from 'next';
import { Hind } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

/**
 * `next/font` rather than a `<link>` to Google Fonts: it self-hosts the
 * files at build time, so there is no third-party connection on first paint
 * and no flash while a stylesheet on someone else's server resolves.
 */
const hind = Hind({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-hind',
  display: 'swap',
});

/** Per-page metadata comes from the database (`app/page.tsx`); this is only
 *  the fallback for routes that have none of their own. */
export const metadata: Metadata = {
  title: 'Portfolio',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={hind.variable}>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
