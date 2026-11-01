import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

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
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F4F7FB',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${pretendard.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
