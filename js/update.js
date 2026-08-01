(() => {
  const RELOAD_FLAG = "lover_sales_sw_reloaded_v971";
  const REFRESH_COOLDOWN_MS = 5000;
  const AUTO_REFRESH_MS = 30000;
  let lastCloudRefresh = 0;
  let refreshPromise = null;
  let initialSyncReady = typeof isInitialCloudSyncFinished === "function" && isInitialCloudSyncFinished();
  let autoRefreshStartTimer = null;
  let autoRefreshInterval = null;

  function activeLoadPromise() {
    return typeof getActiveCloudLoadPromise === "function"
      ? getActiveCloudLoadPromise()
      : null;
  }

  async function refreshCloudData(reason = "resume", force = false) {
    if (typeof loadFromSheet !== "function") return;

    const running = activeLoadPromise();
    if (running) return running;
    if (refreshPromise) return refreshPromise;

    if (!initialSyncReady) {
      return typeof waitForInitialCloudSync === "function"
        ? waitForInitialCloudSync()
        : undefined;
    }

    const now = Date.now();
    const manual = reason === "pull-down";
    if (!manual && now - lastCloudRefresh < REFRESH_COOLDOWN_MS) return;

    lastCloudRefresh = now;
    refreshPromise = loadFromSheet({
      force: force === true,
      skipLocalCache: true,
      loadYear: false,
      silent: true
    }).catch(err => {
      console.warn("Cloud refresh failed:", reason, err);
    }).finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  function startAutomaticRefreshAfterInitialSync() {
    if (autoRefreshStartTimer || autoRefreshInterval) return;
    autoRefreshStartTimer = setTimeout(() => {
      autoRefreshStartTimer = null;
      if (document.visibilityState === "visible") {
        refreshCloudData("post-initial-check", false);
      }
      autoRefreshInterval = setInterval(() => {
        if (document.visibilityState === "visible") {
          refreshCloudData("interval", false);
        }
      }, AUTO_REFRESH_MS);
    }, 5000);
  }

  function markInitialSyncReady() {
    if (initialSyncReady) return;
    initialSyncReady = true;
    lastCloudRefresh = Date.now();
    startAutomaticRefreshAfterInitialSync();
  }

  if (initialSyncReady) {
    startAutomaticRefreshAfterInitialSync();
  } else {
    window.addEventListener("lover-sales-initial-sync-complete", markInitialSyncReady, { once: true });
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
      refreshCloudData("visibility", false);
    }
  });

  window.addEventListener("focus", () => refreshCloudData("focus", false));
  window.addEventListener("pageshow", () => refreshCloudData("pageshow", false));
  window.addEventListener("online", () => refreshCloudData("online", false));

  // V9.7.1: mobile pull-down-to-refresh. Horizontal dragging never triggers it.
  function setupPullToRefresh() {
    if (!("ontouchstart" in window)) return;

    const indicator = document.createElement("div");
    indicator.className = "pull-refresh-indicator";
    indicator.textContent = "下拉刷新";
    document.body.appendChild(indicator);

    let startX = 0;
    let startY = 0;
    let distance = 0;
    let tracking = false;
    let verticalGesture = false;
    const threshold = 78;

    document.addEventListener("touchstart", event => {
      if (refreshRunning || window.scrollY > 0 || !event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      distance = 0;
      tracking = true;
      verticalGesture = false;
    }, { passive: true });

    document.addEventListener("touchmove", event => {
      if (!tracking || !event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!verticalGesture) {
        if (Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy)) {
          tracking = false;
          indicator.classList.remove("visible", "ready");
          return;
        }
        if (dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.25) verticalGesture = true;
      }

      if (!verticalGesture || dy <= 0 || window.scrollY > 0) return;
      event.preventDefault();
      distance = Math.min(dy, 130);
      indicator.classList.add("visible");
      indicator.classList.toggle("ready", distance >= threshold);
      indicator.textContent = distance >= threshold ? "松开刷新" : "下拉刷新";
      indicator.style.transform = `translate(-50%, ${Math.min(distance * 0.55, 58)}px)`;
    }, { passive: false });

    document.addEventListener("touchend", async () => {
      if (!tracking) return;
      const shouldRefresh = verticalGesture && distance >= threshold;
      tracking = false;
      verticalGesture = false;

      if (!shouldRefresh) {
        indicator.classList.remove("visible", "ready");
        indicator.style.transform = "translate(-50%, -70px)";
        return;
      }

      indicator.classList.add("visible", "refreshing");
      indicator.classList.remove("ready");
      indicator.textContent = "正在刷新…";
      indicator.style.transform = "translate(-50%, 48px)";
      if (navigator.vibrate) navigator.vibrate(25);

      await refreshCloudData("pull-down", true);

      indicator.textContent = "刷新完成";
      setTimeout(() => {
        indicator.classList.remove("visible", "refreshing");
        indicator.style.transform = "translate(-50%, -70px)";
      }, 650);
    }, { passive: true });

    document.addEventListener("touchcancel", () => {
      tracking = false;
      verticalGesture = false;
      indicator.classList.remove("visible", "ready", "refreshing");
      indicator.style.transform = "translate(-50%, -70px)";
    }, { passive: true });
  }

  window.addEventListener("load", setupPullToRefresh);

})();
