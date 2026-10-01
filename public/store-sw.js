// 까브 매장 PWA — 설치 가능 조건용 최소 서비스워커 (네트워크 우선, 오프라인 안내)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(
          '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:40px 20px;text-align:center;color:#555"><h3>오프라인입니다</h3><p>네트워크 연결 후 다시 열어주세요.</p></body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        ),
      ),
    );
  }
});
