import { getLocale } from 'next-intl/server';
import localFont from 'next/font/local';
import { Suspense } from 'react';

import { ThemeMetaSyncScript, ThemeProvider } from '@/src/shared/lib/theme';

import '@mumak/ui/globals.css';
import './prism.css';

const pretendard = localFont({
  src: '../public/assets/fonts/PretendardVariable.woff2',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
});

export { themeViewport as viewport } from '@/src/shared/lib/theme';

async function LocalizedRoot({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning className={pretendard.variable}>
      <head>
        <ThemeMetaSyncScript />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <LocalizedRoot>{children}</LocalizedRoot>
    </Suspense>
  );
}
