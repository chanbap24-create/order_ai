// 행사 POS 오프라인 캐시 — 앱 셸을 저장해 인터넷 없이도 열리게 한다. 내용 바꾸면 VERSION을 올릴 것.
const VERSION = 'expo-pos-v7';
const SHELL = ['/expo-pos/index.html', '/expo-pos/manifest.webmanifest', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// 캐시 우선, 네트워크로 갱신 (온라인이면 다음 실행 때 새 버전 반영)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
