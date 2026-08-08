import * as Sentry from '@sentry/nextjs';

// 서버(nodejs/edge) 에러 트래킹 초기화. DSN은 GlitchTip(sentry 프로토콜 호환)을
// 가리키며, NEXT_PUBLIC_*이라 빌드 시 인라인된다 — GA_ID와 같은 주입 경로
// (Dockerfile ARG ← promote.yml ← GitHub Variables). DSN은 클라이언트 번들에
// 어차피 노출되는 값이라 시크릿이 아니다. 미설정(dev/프리뷰)이면 SDK가 no-op.
export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    // ponytail: 에러만 수집한다. tracing/profiling은 GlitchTip 지원도 얕고
    // 지금 필요한 건 "왜 죽었나"뿐 — 필요해지면 tracesSampleRate부터.
  });
}

// RSC 렌더·라우트 핸들러(API)에서 던져진 서버 에러를 잡는 Next 공식 훅.
export const onRequestError = Sentry.captureRequestError;
