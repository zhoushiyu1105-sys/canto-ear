// 港話聽力課 offline cache. Version changes whenever index.html changes.
const CACHE = "canto-ear-d6c31ce3c8";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "audio-pack.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("canto-ear-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// iPhone Safari asks for audio in byte ranges; answer them from the cached file with a 206.
async function rangeResponse(req) {
  const cache = await caches.open(CACHE);
  let res = await cache.match(req.url, {ignoreSearch: true});
  if (!res) {
    try { res = await fetch(req.url); if (res.ok) await cache.put(req.url, res.clone()); }
    catch (err) { return new Response("", {status: 503}); }
  }
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
  const size = buf.byteLength;
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) { start = size - parseInt(m[2], 10); end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {status: 206, headers: {
    "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
    "Content-Range": `bytes ${start}-${end}/${size}`,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes"
  }});
}

// Cache first (works offline); when online, fetch a fresh copy in the background for next time.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.headers.has("range")) { e.respondWith(rangeResponse(e.request)); return; }
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = e.request.mode === "navigate" ? "index.html" : e.request;
    const cached = await cache.match(key, {ignoreSearch: true});
    const fresh = fetch(e.request).then(r => { if (r.ok) cache.put(key, r.clone()); return r; }).catch(() => null);
    return cached || (await fresh) || new Response("離線中，而且未有快取。請聯網打開一次。", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8"}});
  }));
});
