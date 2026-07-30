(() => {
  const RELOAD_FLAG = "lover_sales_sw_reloaded_v66";
  const REFRESH_COOLDOWN_MS = 5000;
  let lastCloudRefresh = 0;
  let refreshRunning = false;

  async function refreshCloudData(reason = "resume") {
    const now = Date.now();

    if (
      refreshRunning ||
      now - lastCloudRefresh < REFRESH_COOLDOWN_MS ||
      typeof loadFromSheet !== "function"
    ) {
      return;
    }

    refreshRunning = true;
    lastCloudRefresh = now;

    try {
      await loadFromSheet();
    } catch (err) {
      console.warn("Cloud refresh failed:", reason, err);
    } finally {
      refreshRunning = false;
    }
  }

  async function activateWaitingWorker(registration) {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }

  async function registerAndCheckForUpdates() {
    if (!("serviceWorker" in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register("./sw.js", {
        updateViaCache: "none"
      });

      await registration.update();
      await activateWaitingWorker(registration);

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;

        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
      });

      // A successful stable load clears the one-time reload guard.
      setTimeout(() => {
        sessionStorage.removeItem(RELOAD_FLAG);
      }, 10000);
    } catch (err) {
      console.warn("Service worker update check failed:", err);
    }
  }

  window.addEventListener("load", () => {
    registerAndCheckForUpdates();
  });

  // iPhone/Android may keep the PWA suspended instead of truly closing it.
  // When it returns to the foreground, refresh Google Sheet automatically.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      registerAndCheckForUpdates();
      refreshCloudData("visibility");
    }
  });

  window.addEventListener("pageshow", event => {
    if (event.persisted) {
      registerAndCheckForUpdates();
      refreshCloudData("pageshow");
    }
  });

  window.addEventListener("online", () => {
    refreshCloudData("online");
  });
})();
