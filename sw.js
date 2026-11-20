const CACHE = 'break-e02fdf89aa43';

// Cache the page and every file it loads before taking over. Without this, a phone that adds the
// app to its home screen and goes straight to a course with no signal opens a blank page: the
// first visit's files were fetched before the worker existed, so none of them were kept.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        const res = await fetch('./', { cache: 'no-store' });
        if (!res.ok) return;
        const html = await res.clone().text();
        await cache.put('./', res);
        const files = [...html.matchAll(/(?:src|href)="\.?\/?((?:assets\/)[^"]+|[^"]+\.(?:png|webmanifest))"/g)].map(
          (m) => `./${m[1]}`,
        );
        await cache.addAll([...new Set(files)]);
      })
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  const isPage = request.mode === 'navigate';

  if (isPage) {
    // The page itself comes from the network when there is any, so a new build is live on the
    // next launch instead of the one after. The cached copy is the fallback with no signal.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./'))),
    );
    return;
  }

  // Everything else is content-hashed, so a cache hit is always the right file.
  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});
