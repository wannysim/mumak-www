import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import localFont from 'next/font/local';

import { themeColors } from '@/lib/theme';

import '@mumak/ui/globals.css';
import './globals.css';

// 본문 폰트는 Pretendard Variable의 서브셋이다(Latin + KS X 1001 한글 2,350자 + 앱 텍스트에 쓰인 글자,
// wght 300~700). 미포함 글리프는 fallback으로 글리프 단위 대체된다. 재생성: `bash scripts/subset-pretendard.sh interview 300:700 app components lib`
const pretendard = localFont({
  src: '../fonts/PretendardVariableSubset.woff2',
  display: 'swap',
  variable: '--font-pretendard',
  weight: '300 700',
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
