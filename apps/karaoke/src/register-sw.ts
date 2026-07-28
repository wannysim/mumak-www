/**
 * 서비스워커 등록. dev에서는 등록하지 않는다 —
 * 캐시가 HMR을 가로채 "고쳤는데 안 바뀌는" 상황을 만든다.
 */
function loadedLocalAssetUrls(): string[] {
  const urls = performance.getEntriesByType('resource').flatMap(entry => {
    try {
      const url = new URL(entry.name, window.location.href);
      if (
        url.origin === window.location.origin &&
        (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))
      ) {
        return [url.href];
      }
    } catch {
      // 브라우저가 URL이 아닌 resource entry를 돌려줘도 등록 자체는 계속한다.
    }
    return [];
  });

  return [...new Set(urls)];
}

async function cacheVisitedAssets(registration: ServiceWorkerRegistration) {
  if ('fonts' in document) await document.fonts.ready;

  const readyRegistration = await navigator.serviceWorker.ready;
  const urls = loadedLocalAssetUrls();
  if (urls.length === 0) return;

  const workers = new Set([
    registration.installing,
    registration.waiting,
    registration.active,
    readyRegistration.active,
  ]);
  for (const worker of workers) worker?.postMessage({ type: 'CACHE_VISITED_ASSETS', urls }, []);
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then(cacheVisitedAssets)
      .catch(() => {
        // 등록·에셋 캐시 실패는 오프라인 지원만 없는 것이라 앱 동작에는 영향이 없다.
      });
  });
}
