const API_URL = window.LOVER_API_URL;
let rows = [];
let pendingRows = [];
let pendingSyncRunning = false;
let cloudLoadPromise = null;
const cloudLoadPromisesByMonth = new Map();
let lastCloudLoadAt = 0;
let initialCloudSyncFinished = false;
let initialCloudSyncPromise = null;
let localDataRevision = 0;
let revisionCheckPromise = null;
let settingsWritePromise = null;
let settingsWriteDepth = 0;
let yearLoadPromises = new Map();
let loadedCloudYears = new Set();
const localRowMutationAt = new Map();

const LOCAL_DATA_CACHE_KEY = "lover_sales_data_cache";
const LEGACY_LOCAL_DATA_CACHE_KEYS = [
  "lover_sales_data_cache_v95",
  "lover_sales_data_cache_v94",
  "lover_sales_data_cache_v93",
  "lover_sales_data_cache_v92"
];
const CLOUD_LOAD_COOLDOWN_MS = 20000;
const REVISION_CHECK_TIMEOUT_MS = 2500;


function applyLocalDataRevision(value) {
  const revision = Number(value || 0);
  if (Number.isFinite(revision) && revision >= 0) localDataRevision = revision;
  return localDataRevision;
}

function getLocalDataRevision() {
  return Number(localDataRevision || 0);
}

async function checkCloudRevisionShared(timeoutMs = REVISION_CHECK_TIMEOUT_MS) {
  if (revisionCheckPromise) return revisionCheckPromise;
  revisionCheckPromise = jsonp(
    { action: "revisionCheck" },
    { timeoutMs: Number(timeoutMs || REVISION_CHECK_TIMEOUT_MS) }
  ).finally(() => { revisionCheckPromise = null; });
  return revisionCheckPromise;
}

async function loadMonthCloudShared(month, timeoutMs = 15000) {
  const key = /^\d{4}-\d{2}$/.test(String(month || "")) ? String(month) : new Date().toISOString().slice(0, 7);
  if (cloudLoadPromisesByMonth.has(key)) return cloudLoadPromisesByMonth.get(key);

  const request = jsonp(
    { action: "loadMonth", month: key },
    { timeoutMs: Number(timeoutMs || 15000) }
  ).finally(() => {
    if (cloudLoadPromisesByMonth.get(key) === request) cloudLoadPromisesByMonth.delete(key);
  });

  cloudLoadPromisesByMonth.set(key, request);
  return request;
}

/* V16.8: first paint must not wait for the full system render. */
let localCacheRenderedOnce = false;
let deferredFullRenderTimer = null;

function renderHomeFirst() {
  // V16.8: first paint must stay lightweight. Cloud merge performs dedupe later.
  if (typeof renderDashboard === "function") {
    renderDashboard();
  }

  if (typeof updateReadOnlyMode === "function") {
    updateReadOnlyMode();
  }
}

function scheduleDeferredFullRender(delay = 0) {
  if (deferredFullRenderTimer) return;

  const run = () => {
    deferredFullRenderTimer = null;
    if (typeof renderAll === "function") renderAll();
  };

  if (typeof requestIdleCallback === "function") {
    deferredFullRenderTimer = requestIdleCallback(run, { timeout: Math.max(300, delay + 300) });
  } else {
    deferredFullRenderTimer = setTimeout(run, Math.max(0, delay));
  }
}

function readLocalDataCacheRaw() {
  let raw = localStorage.getItem(LOCAL_DATA_CACHE_KEY);
  if (!raw) {
    for (const key of LEGACY_LOCAL_DATA_CACHE_KEYS) {
      raw = localStorage.getItem(key);
      if (raw) {
        localStorage.setItem(LOCAL_DATA_CACHE_KEY, raw);
        break;
      }
    }
  }
  return raw;
}

function loadLocalDataCache() {
  try {
    const raw = readLocalDataCacheRaw();
    if (!raw) return false;

    const cached = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.rows)) {
      localStorage.removeItem(LOCAL_DATA_CACHE_KEY);
      return false;
    }

    rows = cached.rows;
    applyLocalDataRevision(cached.dataRevision);

    if (
      cached.commissionSettings &&
      typeof applyCommissionSettings === "function"
    ) {
      applyCommissionSettings(
        cached.commissionSettings
      );
    }

    if (
      cached.accessSettings &&
      typeof applyAccessPasswordSettings === "function"
    ) {
      applyAccessPasswordSettings(
        cached.accessSettings
      );
    }

    renderHomeFirst();
    localCacheRenderedOnce = true;
    scheduleDeferredFullRender(50);
    return true;
  } catch (err) {
    // V16.8: damaged/partial cache must never trap startup.
    try { localStorage.removeItem(LOCAL_DATA_CACHE_KEY); } catch (e) {}
    rows = [];
    return false;
  }
}

function loadLocalDataCacheAsync() {
  return new Promise(resolve => {
    const run = () => {
      let loaded = false;
      try { loaded = loadLocalDataCache(); } catch (err) { loaded = false; }
      resolve(loaded);
    };
    // Give the unlocked Home and logo one paint before reading/parsing cache.
    setTimeout(run, 0);
  });
}

function saveLocalDataCache(
  commissionSettings = null,
  accessSettings = null
) {
  try {
    localStorage.setItem(
      LOCAL_DATA_CACHE_KEY,
      JSON.stringify({
        rows,
        commissionSettings:
          commissionSettings ||
          (
            typeof getCommissionSettings === "function"
              ? getCommissionSettings()
              : null
          ),
        accessSettings:
          accessSettings ||
          (
            typeof getAccessPasswordSettings === "function"
              ? getAccessPasswordSettings()
              : null
          ),
        dataRevision: getLocalDataRevision(),
        savedAt: Date.now()
      })
    );
  } catch (err) {}
}

function loadPendingRows() {
  try {
    pendingRows = JSON.parse(localStorage.getItem("lover_pending_rows") || "[]");
  } catch (err) {
    pendingRows = [];
  }
}

function savePendingRows() {
  localStorage.setItem("lover_pending_rows", JSON.stringify(pendingRows));
}

function setPendingRetrySyncStatus() {
  loadPendingRows();
  if (pendingRows.length > 0) {
    setSync(`有 ${pendingRows.length} 笔未同步资料，系统会自动重试`, false, true);
  } else {
    setSync("已同步", true);
  }
}

function addPendingRow(row) {
  const key = syncKey(row);
  const index = pendingRows.findIndex(r => syncKey(r) === key);
  if (index >= 0) pendingRows[index] = row;
  else pendingRows.push(row);
  savePendingRows();
}

function clearPendingRow(row) {
  const key = syncKey(row);
  pendingRows = pendingRows.filter(r => syncKey(r) !== key);
  savePendingRows();
}

function setSync(text, good = false, error = false) {
  const el = document.getElementById("syncStatus");
  if (!el) return;

  if (error) {
    el.textContent = "🔴 " + text;
    return;
  }

  el.textContent = (good ? "🟢 " : "🟡 ") + text;

  if (good) {
    const last = document.getElementById("lastSync");
    if (last) last.textContent = "最后同步：" + nowText();
  }
}


function markCloudCheckPending(text = "本机资料已显示 · 云端后台同步中") {
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = "🟡 " + text;
}

// V16.8: best-effort immediate cloud dispatch for mobile saves.
// The row stays in pendingRows until a normal JSONP confirmation succeeds, so
// closing/suspending the page cannot silently lose the user's entry.
function dispatchKeepalive(params) {
  try {
    const payload = {...params, _ts: Date.now()};
    const url = API_URL + "?" + new URLSearchParams(payload).toString();
    fetch(url, {method:"GET", mode:"no-cors", cache:"no-store", keepalive:true}).catch(()=>{});
    return true;
  } catch (err) {
    return false;
  }
}

function flushPendingRowsKeepalive() {
  try {
    loadPendingRows();
    pendingRows.forEach(row => {
      if (row.type === "daily") {
        dispatchKeepalive({action:"saveDaily", date:row.date, company:row.company, amount:row.amount, clientUpdatedAt:row.clientUpdatedAt||""});
      } else if (row.type === "live") {
        dispatchKeepalive({action:"saveLive", date:row.date, host:row.location, amount:row.amount, clientUpdatedAt:row.clientUpdatedAt||""});
      }
    });
  } catch (err) {}
}

window.addEventListener("pagehide", flushPendingRowsKeepalive);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPendingRowsKeepalive();
});

function jsonp(params, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 15000);
  return new Promise((resolve, reject) => {
    const callback = "ll_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    params.callback = callback;
    params._ts = Date.now();

    const script = document.createElement("script");
    const query = new URLSearchParams(params).toString();

    const timer = setTimeout(() => {
      delete window[callback];
      script.remove();
      reject(new Error("连接 Google Apps Script 超时"));
    }, timeoutMs);

    window[callback] = data => {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      reject(new Error("无法连接 Google Apps Script"));
    };

    script.async = true;
    script.defer = true;
    script.src = API_URL + "?" + query;
    (document.head || document.body || document.documentElement).appendChild(script);
  });
}

function beginSettingsWrite() {
  settingsWriteDepth += 1;
}

function endSettingsWrite() {
  settingsWriteDepth = Math.max(0, settingsWriteDepth - 1);
}

function isSettingsWriteRunning() {
  return settingsWriteDepth > 0 || !!settingsWritePromise;
}

function runSettingsWrite(task) {
  const previous = settingsWritePromise || Promise.resolve();
  beginSettingsWrite();
  const current = previous
    .catch(() => {})
    .then(task)
    .finally(() => {
      endSettingsWrite();
      if (settingsWritePromise === current) settingsWritePromise = null;
    });
  settingsWritePromise = current;
  return current;
}

function rowMonthKey(row) {
  const iso = typeof displayToISO === "function" ? displayToISO(row && row.date) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(0, 7) : "";
}

function markLocalRowMutation(row, timestamp = Date.now()) {
  localRowMutationAt.set(syncKey(row), Number(timestamp) || Date.now());
}

function mergeCloudRowsSafely(existingRows, cloudRows, pending, requestStartedAt) {
  const protectedLocal = (existingRows || []).filter(row =>
    Number(localRowMutationAt.get(syncKey(row)) || 0) > Number(requestStartedAt || 0)
  );
  const combined = [...(cloudRows || []), ...protectedLocal, ...(pending || [])];
  return typeof dedupeRows === "function" ? dedupeRows(combined) : combined;
}

function mergeCloudMonthRows(month, cloudRows, requestStartedAt = 0) {
  const keep = rows.filter(row => rowMonthKey(row) !== month);
  const localForMonth = rows.filter(row => rowMonthKey(row) === month);
  const pendingForMonth = pendingRows.filter(row => rowMonthKey(row) === month);
  rows = [...keep, ...mergeCloudRowsSafely(localForMonth, cloudRows, pendingForMonth, requestStartedAt)];
}

function mergeCloudYearRows(year, cloudRows, requestStartedAt = 0) {
  const keep = rows.filter(row => !rowMonthKey(row).startsWith(year + "-"));
  const localForYear = rows.filter(row => rowMonthKey(row).startsWith(year + "-"));
  const pendingForYear = pendingRows.filter(row => rowMonthKey(row).startsWith(year + "-"));
  rows = [...keep, ...mergeCloudRowsSafely(localForYear, cloudRows, pendingForYear, requestStartedAt)];
}

async function loadYearInBackground(year) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : new Date().getFullYear().toString();
  if (loadedCloudYears.has(y)) return { ok:true, year:y, cached:true };
  if (yearLoadPromises.has(y)) return yearLoadPromises.get(y);

  const task = (async () => {
    const requestStartedAt = Date.now();
    if (isSettingsWriteRunning()) {
      if (settingsWritePromise) await settingsWritePromise.catch(() => {});
    }

    try {
      const json = await jsonp({ action: "loadYear", year: y }, { timeoutMs: 20000 });
      if (!json.ok) throw new Error(json.message || "读取全年资料失败");
      const fairDraftDirtyBeforeCloud = typeof fairInputsHaveUnsavedChanges === "function"
        ? fairInputsHaveUnsavedChanges()
        : false;
      loadPendingRows();
      mergeCloudYearRows(y, json.rows || [], requestStartedAt);
      if (json.systemState && typeof applySystemState === "function") applySystemState(json.systemState);
      if (json.commissionSettings) {
        if (typeof applyCloudCommissionSettings === "function") applyCloudCommissionSettings(json.commissionSettings);
        else if (typeof applyCommissionSettings === "function") applyCommissionSettings(json.commissionSettings);
      }
      if (json.accessSettings && typeof applyAccessPasswordSettings === "function") applyAccessPasswordSettings(json.accessSettings);
      renderHomeFirst();
      scheduleDeferredFullRender(0);
      // V16.8: if Fair is currently open, repaint its date inputs from the
      // newly merged cloud rows, unless the user has an unsaved Fair draft.
      const fairPageActive = !!document.getElementById("page-fair")?.classList.contains("active");
      if (fairPageActive && !fairDraftDirtyBeforeCloud && typeof refreshFairInputsFromRows === "function") {
        refreshFairInputsFromRows(true);
      }
      saveLocalDataCache(json.commissionSettings || null, json.accessSettings || null);
      loadedCloudYears.add(y);
      setSync("已同步", true);
      return { ok:true, year:y, rows:(json.rows || []).length };
    } catch (err) {
      console.warn("Full-year background refresh failed", err);
      return { ok:false, year:y, error:err };
    }
  })().finally(() => {
    yearLoadPromises.delete(y);
  });

  yearLoadPromises.set(y, task);
  return task;
}

function getActiveCloudLoadPromise() {
  return cloudLoadPromise;
}

function isInitialCloudSyncFinished() {
  return initialCloudSyncFinished;
}

function waitForInitialCloudSync() {
  return initialCloudSyncPromise || cloudLoadPromise || Promise.resolve();
}

function salesSyncDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadFromSheet(options = {}) {
  if (settingsWritePromise) {
    await settingsWritePromise.catch(() => {});
  }
  const force = options.force === true;
  const silent = options.silent === true;
  const suppressStartStatus = options.suppressStartStatus === true;
  const statusText = String(options.statusText || "").trim();
  const now = Date.now();
  if (cloudLoadPromise) return cloudLoadPromise;
  if (!force && now - lastCloudLoadAt < CLOUD_LOAD_COOLDOWN_MS) {
    return initialCloudSyncPromise || Promise.resolve({ ok:true, skipped:true });
  }
  lastCloudLoadAt = now;

  let completedSuccessfully = false;
  cloudLoadPromise = (async () => {
    loadPendingRows();
    const pendingCountAtStart = pendingRows.length;

    const hasLocalData = rows.length > 0
      ? true
      : loadLocalDataCache();
    if (!silent && !suppressStartStatus) {
      setSync(statusText || (hasLocalData ? "本机资料已显示 · 云端后台同步中" : "正在读取本月云端资料"));
    }

    try {
      const requestedMonth = /^\d{4}-\d{2}$/.test(String(options.month || ""))
        ? String(options.month)
        : "";
      const month = requestedMonth ||
        ((typeof selectedMonth === "function" && selectedMonth()) || new Date().toISOString().slice(0, 7));

      // V16.8: opening/resuming first checks one tiny revision value.
      // Full month data is downloaded only when another device changed data.
      if (!force && hasLocalData && options.skipRevisionCheck !== true) {
        try {
          const revisionResult = await checkCloudRevisionShared(Number(options.revisionTimeoutMs || REVISION_CHECK_TIMEOUT_MS));
          if (revisionResult && revisionResult.ok) {
            const cloudRevision = Number(revisionResult.dataRevision || 0);
            if (cloudRevision === getLocalDataRevision()) {
              setSync("已同步", true);
              completedSuccessfully = true;
              return { ok:true, month, revisionOnly:true, dataRevision:cloudRevision };
            }
          } else {
            setSync("本机资料已显示 · 云端暂未确认", false, true);
            completedSuccessfully = true;
            return { ok:true, month, revisionUnconfirmed:true };
          }
        } catch (revisionError) {
          // V16.8: when local data exists, a slow/failed revision check must not
          // trigger the expensive full-month download. Keep the visible local
          // data and let the next foreground/interval/manual check try again.
          setSync("本机资料已显示 · 云端暂未确认", false, true);
          completedSuccessfully = true;
          return {
            ok: true,
            month,
            revisionUnconfirmed: true,
            error: revisionError
          };
        }
      }
      let json = null;
      let lastError = null;
      const requestStartedAt = Date.now();

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          json = await loadMonthCloudShared(month, Number(options.timeoutMs || 15000));
          if (!json || !json.ok) throw new Error((json && json.message) || "读取失败");
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          if (attempt === 1) {
            if (!silent) setSync("首次连接较慢，正在重新连接云端...");
            await salesSyncDelay(1200);
          }
        }
      }

      if (lastError) throw lastError;

      const fairDraftDirtyBeforeCloud = typeof fairInputsHaveUnsavedChanges === "function"
        ? fairInputsHaveUnsavedChanges()
        : false;
      loadPendingRows();
      mergeCloudMonthRows(month, json.rows || [], requestStartedAt);
      applyLocalDataRevision(json.dataRevision);
      if (json.systemState && typeof applySystemState === "function") applySystemState(json.systemState);
      if (json.commissionSettings) {
        if (typeof applyCloudCommissionSettings === "function") applyCloudCommissionSettings(json.commissionSettings);
        else if (typeof applyCommissionSettings === "function") applyCommissionSettings(json.commissionSettings);
      }
      if (json.accessSettings && typeof applyAccessPasswordSettings === "function") applyAccessPasswordSettings(json.accessSettings);

      renderHomeFirst();
      scheduleDeferredFullRender(0);
      // V16.8: keep Fair's visible daily amount inputs consistent with rows after
      // cloud refresh. Do not overwrite any unsaved Fair edits.
      const fairPageActive = !!document.getElementById("page-fair")?.classList.contains("active");
      if (typeof refreshFairInputsFromRows === "function" && !fairDraftDirtyBeforeCloud && (fairPageActive || options.refreshFairInputs === true)) {
        refreshFairInputsFromRows(true);
      }
      saveLocalDataCache(json.commissionSettings || null, json.accessSettings || null);
      setSync("已同步", true);
      completedSuccessfully = true;

      // Initial read has priority. Retry pending writes only after the latest
      // cloud month is visible, avoiding two simultaneous Apps Script calls.
      if (pendingCountAtStart > 0) {
        setTimeout(() => syncPendingRows().catch(() => {}), 50);
      }

      const year = month.slice(0, 4);

      // V16.8 mobile performance: startup loads only the selected month.
      // Full-year data is requested only when the user opens Monthly Summary.
      if (options.loadYear === true) {
        setTimeout(() => {
          loadYearInBackground(year).catch(() => {});
        }, 1400);
      }

      return { ok:true, month, refreshedAt:Date.now() };
    } catch (err) {
      if (!silent) {
        setSync(hasLocalData ? "已显示本机资料，云端稍后重试" : "同步失败：" + err.message, false, true);
      }
      return { ok:false, error:err };
    }
  })();

  if (!initialCloudSyncPromise) initialCloudSyncPromise = cloudLoadPromise;

  try {
    return await cloudLoadPromise;
  } finally {
    cloudLoadPromise = null;
    if (!initialCloudSyncFinished) {
      initialCloudSyncFinished = true;
      window.dispatchEvent(new CustomEvent("lover-sales-initial-sync-complete", {
        detail: { success: completedSuccessfully }
      }));
    }
  }
}

async function syncPendingRows() {
  if (pendingSyncRunning) return;
  pendingSyncRunning = true;

  try {
    loadPendingRows();

    if (pendingRows.length === 0) {
      if (initialCloudSyncFinished && !cloudLoadPromise) {
        setSync("已同步", true);
      }
      return;
    }

    setSync(`正在自动同步 ${pendingRows.length} 笔资料...`);

    const dailyRows = pendingRows.filter(r => r.type === "daily");
    const fairRows = pendingRows.filter(r => r.type === "fair");
    const liveRows = pendingRows.filter(r => r.type === "live");

    for (const row of dailyRows) {
      const saved = await saveDailyToSheet(
        row.date,
        row.company,
        row.amount,
        row.clientUpdatedAt || ""
      );
      if (saved) upsertLocalRow(saved);
      clearPendingRow(row);
    }

    const fairGroups = new Map();

    fairRows.forEach(row => {
      const loc = canonicalLocation(row.location);
      if (!fairGroups.has(loc)) fairGroups.set(loc, []);
      fairGroups.get(loc).push({
        date: row.date,
        amount: Number(row.amount || 0),
        clientUpdatedAt: row.clientUpdatedAt || ""
      });
    });

    for (const row of liveRows) {
      const saved = await saveLiveToSheet(
        row.date,
        row.location,
        row.amount,
        row.clientUpdatedAt || ""
      );
      if (saved && Number(saved.amount) > 0) upsertLocalRow(saved);
      else rows = rows.filter(x => syncKey(x) !== syncKey(row));
      clearPendingRow(row);
    }

    for (const [location, records] of fairGroups.entries()) {
      const result = await saveFairBatchToSheet(location, records);

      if (result && Array.isArray(result.rows)) {
        result.rows.forEach(r => {
          if (Number(r.amount) <= 0) {
            rows = rows.filter(x => syncKey(x) !== syncKey(r));
          } else {
            upsertLocalRow(r);
          }
        });
      }

      records.forEach(item => {
        clearPendingRow({
          type: "fair",
          date: item.date,
          company: "belimbing",
          location
        });
      });
    }

    renderAll();
    saveLocalDataCache();
    setSync("已同步", true);
  } catch (err) {
    setPendingRetrySyncStatus();
  } finally {
    pendingSyncRunning = false;
  }
}

async function saveDailyToSheet(date, company, amount, clientUpdatedAt = "") {
  const json = await jsonp({
    action: "saveDaily",
    date,
    company,
    amount,
    clientUpdatedAt
  });

  if (!json.ok) throw new Error(json.message || "储存失败");
  applyLocalDataRevision(json.dataRevision);
  return json.row || null;
}

async function saveFairBatchToSheet(location, records) {
  const json = await jsonp({
    action: "saveFairBatch",
    location,
    records: JSON.stringify(records)
  });

  if (!json.ok) throw new Error(json.message || "Fair 储存失败");
  applyLocalDataRevision(json.dataRevision);
  return json;
}

async function saveFairSingleToSheet(date, location, amount, clientUpdatedAt = "") {
  return saveFairBatchToSheet(location, [{
    date,
    amount,
    clientUpdatedAt
  }]);
}

async function saveFairToSheet(location, records) {
  return saveFairBatchToSheet(location, records);
}


async function saveLiveToSheet(date, host, amount, clientUpdatedAt = "") {
  const json = await jsonp({
    action: "saveLive",
    date,
    host,
    amount,
    clientUpdatedAt
  });
  if (!json.ok) throw new Error(json.message || "Live 储存失败");
  applyLocalDataRevision(json.dataRevision);
  return json.row || null;
}

async function saveCommissionSettingsToSheet(settings, targetMonth = "") {
  return runSettingsWrite(async () => {
    const json = await jsonp({
      action: "saveCommissionSettings",
      rate1: settings.rate1,
      rate2: settings.rate2,
      rate3: settings.rate3,
      liveHostRates: JSON.stringify(settings.liveHostRates || {}),
      liveHosts: JSON.stringify(settings.liveHosts || {}),
      inactiveLiveHosts: JSON.stringify(settings.inactiveLiveHosts || {}),
      liveRateSchedules: JSON.stringify(settings.liveRateSchedules || []),
      fairRevision: Number(settings.fairRevision || 0),
      liveRevision: Number(settings.liveRevision || 0),
      targetMonth: targetMonth || ""
    }, { timeoutMs: 20000 });
    if (!json.ok) throw new Error(json.message || "佣金设置储存失败");
    applyLocalDataRevision(json.dataRevision);
    return json.commissionSettings || null;
  });
}

async function saveCommissionFastRequest_(action, settings, targetMonth = "") {
  const params = {
    action,
    rate1: settings.rate1,
    rate2: settings.rate2,
    rate3: settings.rate3,
    liveHostRates: JSON.stringify(settings.liveHostRates || {}),
    liveHosts: JSON.stringify(settings.liveHosts || {}),
    inactiveLiveHosts: JSON.stringify(settings.inactiveLiveHosts || {}),
    liveRateSchedules: JSON.stringify(settings.liveRateSchedules || []),
    fairRevision: Number(settings.fairRevision || 0),
    liveRevision: Number(settings.liveRevision || 0),
    targetMonth: targetMonth || ""
  };

  try {
    const json = await jsonp(params, { timeoutMs: 4500 });
    if (!json.ok) throw new Error(json.message || "佣金设置储存失败");
    applyLocalDataRevision(json.dataRevision);
    return json.commissionSettings || null;
  } catch (firstError) {
    await new Promise(resolve => setTimeout(resolve, 350));
    const json = await jsonp(params, { timeoutMs: 5500 });
    if (!json.ok) throw new Error(json.message || firstError.message || "佣金设置储存失败");
    applyLocalDataRevision(json.dataRevision);
    return json.commissionSettings || null;
  }
}

async function saveFairCommissionSettingsToSheet(settings, targetMonth = "") {
  return runSettingsWrite(() =>
    saveCommissionFastRequest_("saveFairCommissionFast", settings, targetMonth)
  );
}

async function saveLiveCommissionSettingsToSheet(settings, targetMonth = "") {
  return runSettingsWrite(() =>
    saveCommissionFastRequest_("saveLiveCommissionFast", settings, targetMonth)
  );
}

async function resetCommissionSettingsInSheet() {
  const json = await jsonp({ action: "resetCommissionSettings" });
  if (!json.ok) throw new Error(json.message || "恢复默认值失败");
  applyLocalDataRevision(json.dataRevision);
  return json.commissionSettings || null;
}

setInterval(() => {
  loadPendingRows();
  if (pendingRows.length > 0) syncPendingRows();
}, 30000);

window.addEventListener("online", () => {
  loadPendingRows();
  if (pendingRows.length > 0) syncPendingRows();
});


async function closeMonthInSheet(month){const json=await jsonp({action:"closeMonth",month});if(!json.ok)throw new Error(json.message||"月底结算失败");return json}
async function restoreBackupToSheet(payload){
  const raw=JSON.stringify(payload),id="restore_"+Date.now()+"_"+Math.floor(Math.random()*100000),chunkSize=3200,total=Math.ceil(raw.length/chunkSize);
  let result=await jsonp({action:"restoreBegin",restoreId:id,totalChunks:total});if(!result.ok)throw new Error(result.message||"无法开始恢复");
  for(let i=0;i<total;i++){result=await jsonp({action:"restoreChunk",restoreId:id,index:i,data:raw.slice(i*chunkSize,(i+1)*chunkSize)});if(!result.ok)throw new Error(result.message||`恢复区块 ${i+1} 失败`);setSync(`正在恢复 Backup ${i+1}/${total}...`)}
  result=await jsonp({action:"restoreCommit",restoreId:id});if(!result.ok)throw new Error(result.message||"恢复失败");return result
}


async function loadAccessSettingsFromSheet() {
  const json = await jsonp({ action: "loadAccessSettings" });
  if (!json.ok) throw new Error(json.message || "读取密码设置失败");
  return json.accessSettings || null;
}

async function saveAccessSettingsToSheet(settings) {
  return runSettingsWrite(async () => {
    const json = await jsonp({
      action: "saveAccessSettings",
      accessPasswordHash: settings.accessPasswordHash,
      accessPasswordHint: settings.accessPasswordHint
    }, { timeoutMs: 20000 });
    if (!json.ok) throw new Error(json.message || "密码设置同步失败");
    return json.accessSettings || null;
  });
}


async function verifyAccessBackendVersion() {
  const json = await jsonp({
    action: "accessVersion"
  });

  if (!json.ok ||
      json.accessSettingsSupported !== true) {
    throw new Error(
      "Google Apps Script 密码功能未部署"
    );
  }

  return json;
}
