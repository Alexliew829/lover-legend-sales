const CACHE_NAME="lover-sales-v6-3";
const FILES=["./","./index.html","./style.css","./manifest.json","./js/utils.js","./js/sheet.js","./js/app.js","./icons/icon-192.png","./icons/icon-512.png","./images/logo.png","./images/Logo2.jpg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME?caches.delete(k):null))));self.clients.claim()});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(u.hostname.includes("script.google.com"))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
