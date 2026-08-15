// Lover Legend Sales PWA Service Worker V17.9
// OneSignal uses its own worker:
// /push/onesignal/OneSignalSDKWorker.js

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
