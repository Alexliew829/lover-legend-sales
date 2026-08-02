const CACHE_NAME = "lover-sales-v10-9";

const CORE_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./version.json",
  "./js/utils.js",
  "./js/sheet.js",
  "./js/access.js",
  "./js/app.js",
  "./js/update.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/logo.png",
  "./images/Logo2.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname.includes("script.google.com") ||
      url.hostname.includes("script.googleusercontent.com")) return;

  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  const isDocument = request.mode === "navigate" ||
    path.endsWith("/index.html") || path.endsWith("/version.json");

  event.respondWith(isDocument ? networkFirst(request) : cacheFirst(request));
});
