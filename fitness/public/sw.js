// Простой service worker: кэш-фолбэк для оболочки приложения.
const CACHE = "fitness-shell-v3";
const SHELL = ["/", "/styles.css", "/app.js", "/manifest.webmanifest", "/icon-192.svg", "/icon-512.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return; // API — не кэшируем
  if (url.pathname.startsWith("/api/")) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((resp) => {
        if (resp.ok && (url.origin === self.location.origin)) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
