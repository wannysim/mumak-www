/**
 * 노래방 앱 서비스워커.
 *
 * 빌드 때 해시가 붙은 JS/CSS와 아이콘 목록을 아래 marker에 주입해 앱 셸을 프리캐시한다.
 * 일본어 폰트 조각은 첫 화면에서 실제로 사용된 것만 페이지가 메시지로 넘겨 캐시한다.
 * 사용자가 불러온 가사는 서비스워커가 아닌 브라우저 IndexedDB에만 저장한다.
 * (재생 자체는 YouTube 네트워크가 필요하다.)
 */
const RELEASE = 'v3-local-first';
const BUILD_ID = 'dev';
const CACHE_PREFIX = 'karaoke-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${RELEASE}-${BUILD_ID}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${RELEASE}-${BUILD_ID}`;
const CURRENT = [SHELL_CACHE, ASSET_CACHE];
const PRECACHE_URLS = ['/', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then(cache => cache.add('/')),
      caches.open(ASSET_CACHE).then(cache => cache.addAll(PRECACHE_URLS.filter(url => url !== '/'))),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(key => key.startsWith(CACHE_PREFIX) && !CURRENT.includes(key)).map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** 페이지가 실제로 불러온 동일 오리진 에셋만 캐시한다. */
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_VISITED_ASSETS' || !Array.isArray(event.data.urls)) return;

  const urls = event.data.urls.slice(0, 200).flatMap(url => {
    if (typeof url !== 'string') return [];
    try {
      const parsed = new URL(url, self.location.origin);
      if (
        parsed.origin === self.location.origin &&
        (parsed.pathname.startsWith('/assets/') || parsed.pathname.startsWith('/icons/'))
      ) {
        return [parsed.href];
      }
    } catch {
      // 잘못된 메시지는 무시한다.
    }
    return [];
  });

  event.waitUntil(
    caches.open(ASSET_CACHE).then(cache =>
      Promise.all(
        urls.map(url =>
          cache.add(url).catch(() => {
            // 개별 폰트 조각이 사라져도 다른 에셋 캐시는 유지한다.
          })
        )
      )
    )
  );
});

/** 해시 파일명은 불변이라 캐시를 먼저 본다. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  // install의 URL 문자열 요청과 브라우저의 module/font 요청은 Vary: Origin 기준이 다를 수 있다.
  // 동일 오리진의 content-addressed 에셋만 이 경로에 오므로 Vary 차이는 무시해도 안전하다.
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/** 문서는 최신을 먼저 시도하고, 오프라인이면 캐시된 셸을 돌려준다. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      return response;
    }
    return (await cache.match(request)) ?? (await cache.match('/')) ?? response;
  } catch (error) {
    const hit = (await cache.match(request)) ?? (await cache.match('/'));
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // YouTube 등 외부 오리진은 건드리지 않는다. 캐시하면 재생이 깨진다.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }
  if (
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
