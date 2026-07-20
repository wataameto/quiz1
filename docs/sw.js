const CACHE_NAME = 'manten-cache-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// ネットワーク優先、失敗したらキャッシュにフォールバックする方式。
// 同一オリジンのGETリクエストだけを対象にし、取得できたレスポンスは
// その都度キャッシュへ保存する（各教材フォルダのファイルを事前に
// 列挙する必要がなく、使った分だけオフライン対応が効いていく）。
//
// cache:'no-store'を指定しているのが重要。指定しないと、この内部fetch()自体が
// 通常のHTTPキャッシュルールに従ってしまい、GitHub PagesのCache-Controlヘッダー
// 次第では「ネットワークから取得したつもり」で実は古いキャッシュ応答を掴んでしまう
// （ページ側でのスーパーリロードは、SW内部のこのfetch()までは強制的にバイパス
// してくれない）。
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
