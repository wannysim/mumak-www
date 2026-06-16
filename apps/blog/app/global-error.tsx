'use client';

import { useEffect } from 'react';

import '@mumak/ui/globals.css';

// global-error는 루트 레이아웃 자체가 실패한 치명적 상황에서만 렌더된다.
// 이 경계는 [locale]/layout의 IntlProvider 바깥이라 locale/번역을 쓸 수 없어
// 중립 문구를 하드코딩한다. 자체 <html>/<body>를 제공해야 한다.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
          <p className="text-muted-foreground mb-8">An unexpected error occurred. Please try again in a moment.</p>
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
