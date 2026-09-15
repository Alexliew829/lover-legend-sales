// Lover Legend Sales PWA Service Worker V48.1
const LOVER_SW_BUILD = "4810";
// OneSignal uses its own worker:
// /push/onesignal/OneSignalSDKWorker.js

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
