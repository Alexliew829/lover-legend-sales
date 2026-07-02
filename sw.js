const CACHE_NAME = "lover-sales-v4-2";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/utils.js",
  "./js/sheet.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/logo.png",
  "./images/Logo2.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes("script.google.com")) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
