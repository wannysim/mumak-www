import type { Metadata } from 'next';
import * as React from 'react';

import '@mumak/ui/globals.css';

export const metadata: Metadata = {
  title: 'Mumak Media Admin',
  description: 'Private image publishing console',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-svh bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
