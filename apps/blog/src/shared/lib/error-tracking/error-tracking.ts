type SentryModule = typeof import('./sentry-sdk');

// 브라우저 에러 트래킹(GlitchTip, sentry 프로토콜). @sentry/nextjs 클라이언트 SDK는
// 모든 페이지 First Load에 싣기엔 무거워서 load 이후 idle 시점에 동적 import한다.
// DSN 미설정(dev/프리뷰)이면 SDK를 아예 불러오지 않는다 — analytics.tsx의 GA 게이트와 같은 원칙.
// 서버 쪽 초기화는 instrumentation.ts가 별도로 담당한다.

// SDK 로드 전에 난 에러를 무한히 쌓지 않도록 상한을 둔다.
const MAX_BUFFERED_ERRORS = 10;
const IDLE_TIMEOUT_MS = 5_000;

let sentryPromise: Promise<SentryModule> | null = null;

function getDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
}

function loadSentry(): Promise<SentryModule> | null {
  const dsn = getDsn();
  if (!dsn) return null;

  sentryPromise ??= import('./sentry-sdk').then(Sentry => {
    Sentry.init({
      dsn,
      // 에러만 수집한다. tracing을 안 쓰므로 기본 포함되는 BrowserTracing(fetch/history
      // 계측, web vitals 리스너)은 런타임 비용만 들어 뺀다. 필요해지면 tracesSampleRate부터.
      integrations: defaults => defaults.filter(integration => integration.name !== 'BrowserTracing'),
    });
    return Sentry;
  });
  return sentryPromise;
}

/** SDK가 아직 안 떴으면 로드를 당겨서라도 에러를 보낸다(error.tsx 등 에러 경계용). */
export function captureException(error: unknown): void {
  loadSentry()
    ?.then(Sentry => {
      Sentry.captureException(error);
    })
    .catch(() => {
      // 리포팅 실패가 앱 동작을 깨뜨리지 않게 삼킨다.
    });
}

function runAfterLoadWhenIdle(task: () => void): void {
  const runWhenIdle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
    } else {
      window.setTimeout(task, 0);
    }
  };

  if (document.readyState === 'complete') {
    runWhenIdle();
  } else {
    window.addEventListener('load', runWhenIdle, { once: true });
  }
}

/**
 * instrumentation-client.ts에서 hydration 전에 호출한다.
 * SDK 로드 전까지 전역 에러를 버퍼링해 두었다가, SDK가 뜨면 넘기고 이후는 SDK 자체 핸들러에 맡긴다.
 */
export function initClientErrorTracking(): void {
  if (typeof window === 'undefined' || !getDsn()) return;

  const bufferedErrors: unknown[] = [];
  const bufferError = (error: unknown) => {
    if (bufferedErrors.length < MAX_BUFFERED_ERRORS) bufferedErrors.push(error);
  };
  const onError = (event: ErrorEvent) => bufferError(event.error ?? event.message);
  const onUnhandledRejection = (event: PromiseRejectionEvent) => bufferError(event.reason);

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  const stopBuffering = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };

  runAfterLoadWhenIdle(() => {
    loadSentry()
      ?.then(Sentry => {
        // init 직후부터는 SDK의 GlobalHandlers가 전역 에러를 잡으므로 버퍼 리스너를 뗀다.
        stopBuffering();
        bufferedErrors.splice(0).forEach(error => Sentry.captureException(error));
      })
      .catch(stopBuffering);
  });
}
