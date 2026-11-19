// 港話聽力課 offline cache. Version changes whenever index.html changes.
const CACHE = "canto-ear-b9d186de33";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("canto-ear-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first (works offline); when online, fetch a fresh copy in the background for next time.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = e.request.mode === "navigate" ? "index.html" : e.request;
    const cached = await cache.match(key, {ignoreSearch: true});
    const fresh = fetch(e.request).then(r => { if (r.ok) cache.put(key, r.clone()); return r; }).catch(() => null);
    return cached || (await fresh) || new Response("離線中，而且未有快取。請聯網打開一次。", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8"}});
  }));
});
