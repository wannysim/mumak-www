import { initClientErrorTracking } from '@/src/shared/lib/error-tracking';

// 브라우저 에러 트래킹 초기화 (Next 15.3+ instrumentation-client 컨벤션).
// Spotify/검색/그래프 같은 클라이언트 위젯의 런타임 에러가 대상.
// SDK는 load 이후 idle 시점에 lazy 로드하고, 그 전에 난 에러는 버퍼링했다가 넘긴다.
// tracing을 안 쓰므로 onRouterTransitionStart는 export하지 않는다. Next 기준 선택 export이고,
// 누락 경고는 withSentryConfig 빌드 플러그인에서만 나오는데 이 앱은 그 플러그인을 쓰지 않는다.
initClientErrorTracking();
