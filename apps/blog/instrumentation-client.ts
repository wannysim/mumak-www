import * as Sentry from '@sentry/nextjs';

// 브라우저 에러 트래킹 초기화 (Next 15.3+ instrumentation-client 컨벤션).
// Spotify/검색/그래프(WebGPU) 같은 클라이언트 위젯의 런타임 에러가 대상.
// DSN 미설정(dev/프리뷰)이면 no-op — analytics.tsx의 GA 게이트와 같은 원칙.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  // 광고차단기·확장프로그램발 노이즈를 줄이는 기본 무시 목록은 SDK 기본값을
  // 신뢰한다. ponytail: 커스텀 필터는 실제 노이즈를 본 뒤에.
});

// App Router 네비게이션 계측 훅 — tracing을 안 켰으므로 사실상 no-op이지만,
// export가 없으면 SDK가 콘솔 경고를 찍는다.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
