/**
 * 노래방 앱 서비스워커.
 *
 * 빌드 산출물 이름에 해시가 붙기 때문에 정적 프리캐시 목록 대신 런타임 캐싱을 쓴다.
 * 한 번 방문한 뒤에는 앱 셸과 가사가 캐시에 남아 오프라인에서도 열린다.
 * (재생 자체는 YouTube 네트워크가 필요하다.)
 */
const VERSION = 'v1';
const SHELL_CACHE = `karaoke-shell-${VERSION}`;
const ASSET_CACHE = `karaoke-assets-${VERSION}`;
const LYRICS_CACHE = `karaoke-lyrics-${VERSION}`;
const CURRENT = [SHELL_CACHE, ASSET_CACHE, LYRICS_CACHE];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(cache => cache.addAll(['/', '/manifest.webmanifest']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => !CURRENT.includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

/** 해시 파일명은 불변이라 캐시를 먼저 본다. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/** 가사는 갱신될 수 있으므로 캐시를 즉시 주고 뒤에서 새로 받아 둔다. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);

  return hit ?? network;
}

/** 문서는 최신을 먼저 시도하고, 오프라인이면 캐시된 셸을 돌려준다. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
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
  if (url.pathname.startsWith('/lyrics/')) {
    event.respondWith(staleWhileRevalidate(request, LYRICS_CACHE));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
