import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import localFont from 'next/font/local';

import { themeColors } from '@/lib/theme';

import '@mumak/ui/globals.css';
import './globals.css';

const pretendard = localFont({
  src: '../public/assets/fonts/PretendardVariable.woff2',
  display: 'swap',
  variable: '--font-pretendard',
  weight: '45 920',
});
export const metadata: Metadata = {
  title: '다음 정거장 · 나의 면접 연습실',
  description: '이동 중에도, 한 문제만 더.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: '다음 정거장', statusBarStyle: 'default' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: themeColors.light },
    { media: '(prefers-color-scheme: dark)', color: themeColors.dark },
  ],
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${pretendard.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" storageKey="next-stop:theme" disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
