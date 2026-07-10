const CACHE_NAME = "lover-sales-v6-6";

const CORE_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./version.json",
  "./js/utils.js",
  "./js/sheet.js",
  "./js/app.js",
  "./js/update.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/logo.png",
  "./images/Logo2.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(
        CORE_FILES.map(async url => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) {
              await cache.put(url, response.clone());
            }
          } catch (err) {
            // Installation should not fail just because one optional file is unavailable.
          }
        })
      );
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: "no-store" });

    if (response && response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Google Apps Script requests must always go directly to the network.
  if (
    url.hostname.includes("script.google.com") ||
    url.hostname.includes("script.googleusercontent.com")
  ) {
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  }
});
