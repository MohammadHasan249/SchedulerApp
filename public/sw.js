const CACHE = "scheduler-v1";

const APP_SHELL = [
  "/",
  "/dashboard",
  "/login",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Network-first for API and auth routes
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth")) {
    return;
  }

  // Cache-first for static assets
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached ?? fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Network-first with offline fallback for pages
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, clone));
        return res;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached ?? caches.match("/offline")
        )
      )
  );
});
