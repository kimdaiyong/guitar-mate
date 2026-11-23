/* 기타 메이트 서비스 워커
   - 앱 셸을 캐시해서 오프라인에서도 열림
   - Network-first: 온라인일 때는 항상 최신 버전을 받아오고, 실패하면 캐시로 대체
   - 화면(index.html)은 캐시를 건너뛰고(no-store) 언제나 새 파일을 먼저 받아온다
*/
const CACHE = 'guitar-mate-v5';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './privacy.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* 화면 요청: 브라우저 캐시도 쓰지 않고(no-store) 네트워크에서 새로 받아온 뒤, 실패하면 캐시된 앱 셸 */
  if (req.mode === 'navigate') {
    const fresh = new Request(req.url, { cache: 'no-store', credentials: 'same-origin', redirect: 'follow' });
    event.respondWith(
      fetch(fresh)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  /* index.html 을 직접 요청할 때도 같은 규칙 */
  if (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/guitar-mate/')){
    event.respondWith(
      fetch(new Request(req.url, { cache: 'no-store', credentials: 'same-origin', redirect: 'follow' }))
        .then((res) => {
          if (res && res.ok){
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* 그 밖의 리소스: 네트워크 우선, 실패하면 캐시 */
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
