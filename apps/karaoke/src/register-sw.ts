/**
 * 서비스워커 등록. dev에서는 등록하지 않는다 —
 * 캐시가 HMR을 가로채 "고쳤는데 안 바뀌는" 상황을 만든다.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 등록 실패는 오프라인 지원만 없는 것이라 앱 동작에는 영향이 없다.
    });
  });
}
