// Service worker — caches the app shell for offline use
const CACHE = "projects-demo-v1";
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
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok && response.type === "basic") {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match("/index.html")))
  );
});
