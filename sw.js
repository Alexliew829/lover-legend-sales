const CACHE_NAME = "lover-sales-v10-6";

const CORE_FILES = [
  "./",
  "./index.html",
  "./style.css?v=10.6",
  "./manifest.json",
  "./version.json",
  "./js/utils.js?v=10.6",
  "./js/sheet.js?v=10.6",
  "./js/access.js?v=10.6",
  "./js/app.js?v=10.6",
  "./js/update.js?v=10.6",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/logo.png",
  "./images/Logo2.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(CORE_FILES.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request, { cache: "no-cache" })
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }

  const response = await networkPromise;
  if (response) return response;
  return new Response("Offline", { status: 503, statusText: "Offline" });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname.includes("script.google.com") ||
      url.hostname.includes("script.googleusercontent.com")) return;

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
