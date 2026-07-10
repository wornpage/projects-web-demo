// Service worker — offline fallback for the app shell.
// Network-first so deploys always win; cached copies serve only when offline.
// API requests are never intercepted or cached.
const CACHE = "projects-demo-v2";
const SHELL = [
  "/",
  "/index.html",
  "/landing.html",
  "/manifest.json",
  "/assets/demo.css",
  "/assets/demo.js",
  "/assets/landing.css",
  "/assets/favicon.png",
  "/assets/favicon.svg",
  "/data/demo-packs.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && response.type === "basic") {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
  );
});
