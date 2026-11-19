import localFont from 'next/font/local';
import * as React from 'react';

import { Providers } from '@/components/providers';

import '@mumak/ui/globals.css';

// 본문 폰트는 Pretendard Variable의 서브셋이다(Latin + KS X 1001 한글 2,350자 + 앱 텍스트에 쓰인 글자,
// wght 400~700). 미포함 글리프는 fallback으로 글리프 단위 대체된다. 재생성: `bash scripts/subset-pretendard.sh mumak-next 400:700 app components`
const pretendard = localFont({
  src: '../fonts/PretendardVariableSubset.woff2',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  display: 'swap',
  weight: '400 700',
  variable: '--font-pretendard',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className={pretendard.variable}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
