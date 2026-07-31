(() => {
  const RELOAD_FLAG = "lover_sales_sw_reloaded_v86";
  const REFRESH_COOLDOWN_MS = 3000;
  const AUTO_REFRESH_MS = 15000;
  let lastCloudRefresh = 0;
  let refreshRunning = false;

  async function refreshCloudData(reason = "resume", force = true) {
    const now = Date.now();
    if (refreshRunning || (!force && now - lastCloudRefresh < REFRESH_COOLDOWN_MS) || typeof loadFromSheet !== "function") return;
    refreshRunning = true;
    lastCloudRefresh = now;
    try {
      await loadFromSheet({ force: true, skipLocalCache: true });
    } catch (err) {
      console.warn("Cloud refresh failed:", reason, err);
    } finally {
      refreshRunning = false;
    }
  }

  async function activateWaitingWorker(registration) {
    if (registration && registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  async function registerAndCheckForUpdates() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      await registration.update();
      await activateWaitingWorker(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) worker.postMessage({ type: "SKIP_WAITING" });
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
      });
      setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 10000);
    } catch (err) {
      console.warn("Service worker update check failed:", err);
    }
  }

  window.addEventListener("load", () => registerAndCheckForUpdates());

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      registerAndCheckForUpdates();
      refreshCloudData("visibility");
    }
  });

  window.addEventListener("focus", () => refreshCloudData("focus"));
  window.addEventListener("pageshow", () => refreshCloudData("pageshow"));
  window.addEventListener("online", () => refreshCloudData("online"));

  // V8.6: while the app is open, read Google Sheet periodically so changes
  // made on another phone/computer appear without manually refreshing.
  setInterval(() => {
    if (document.visibilityState === "visible") refreshCloudData("interval");
  }, AUTO_REFRESH_MS);
})();
