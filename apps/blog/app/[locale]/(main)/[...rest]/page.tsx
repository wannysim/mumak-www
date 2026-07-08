import { notFound } from 'next/navigation';

// next-intl proxy(미들웨어)는 locale prefix만 처리하고 유효 locale 하위의 매칭되지 않는
// 경로(`/ko/qwdkqwd` 등)는 그대로 통과시킨다. 루트 not-found가 없어 이런 경로는 Next.js
// 기본 404로 떨어지므로, 이 catch-all이 받아 notFound()를 던져 (main)/not-found.tsx
// (헤더·푸터 포함 로컬라이즈드 404)로 연결한다. next-intl 권장 패턴.
export default function CatchAllNotFound() {
  notFound();
}
