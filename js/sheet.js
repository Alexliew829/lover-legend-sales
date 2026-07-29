const API_URL = window.LOVER_API_URL;
let rows = [];
let pendingRows = [];
let pendingSyncRunning = false;
let cloudLoadPromise = null;
let lastCloudLoadAt = 0;

const LOCAL_DATA_CACHE_KEY = "lover_sales_data_cache_v682";
const CLOUD_LOAD_COOLDOWN_MS = 4000;

function loadLocalDataCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(LOCAL_DATA_CACHE_KEY) || "null");
    if (!cached || !Array.isArray(cached.rows)) return false;

    rows = typeof applyLiveDeleteTombstones==="function"
      ? applyLiveDeleteTombstones(cached.rows)
      : cached.rows;

    if (cached.commissionSettings && typeof applyCommissionSettings === "function") {
      applyCommissionSettings(cached.commissionSettings);
    }

    renderAll();
    return true;
  } catch (err) {
    return false;
  }
}

function saveLocalDataCache(commissionSettings = null) {
  try {
    localStorage.setItem(LOCAL_DATA_CACHE_KEY, JSON.stringify({
      rows,
      commissionSettings:
        commissionSettings ||
        (typeof getCommissionSettings === "function" ? getCommissionSettings() : null),
      savedAt: Date.now()
    }));
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

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callback = "ll_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    params.callback = callback;

    const script = document.createElement("script");
    const query = new URLSearchParams(params).toString();

    const timer = setTimeout(() => {
      delete window[callback];
      script.remove();
      reject(new Error("连接 Google Apps Script 超时"));
    }, 8000);

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

    script.src = API_URL + "?" + query;
    document.body.appendChild(script);
  });
}

async function loadFromSheet(options = {}) {
  const force = options.force === true;
  const now = Date.now();

  if (cloudLoadPromise) return cloudLoadPromise;
  if (!force && now - lastCloudLoadAt < CLOUD_LOAD_COOLDOWN_MS) return;

  lastCloudLoadAt = now;

  cloudLoadPromise = (async () => {
    // 第一时间显示本机最后一次成功同步的资料。
    const hasLocalData = loadLocalDataCache();

    if (hasLocalData) {
      setSync("已显示本机资料，后台更新中...");
    } else {
      setSync("正在读取资料...");
    }

    // 未同步资料不再阻塞云端读取。
    // 先在后台尝试上传，然后无论成功与否都继续读取。
    loadPendingRows();

    if (pendingRows.length > 0) {
      try {
        await syncPendingRows();
      } catch (err) {
        console.warn("Pending sync failed:", err);
      }
    }

    try {
      const selectedYear =
        document.getElementById("yearPicker")?.value ||
        String(new Date().getFullYear());

      const json = await jsonp({
        action: "load",
        year: selectedYear
      });

      if (!json.ok) {
        throw new Error(json.message || "读取失败");
      }

      rows = typeof applyLiveDeleteTombstones==="function"?applyLiveDeleteTombstones(json.rows||[]):(json.rows||[]);

      if (
        json.commissionSettings &&
        typeof applyCommissionSettings === "function"
      ) {
        applyCommissionSettings(json.commissionSettings);
      }

      renderAll();
      saveLocalDataCache(json.commissionSettings || null);
      setSync("已同步", true);
    } catch (err) {
      loadPendingRows();

      if (hasLocalData) {
        setSync("已显示本机资料，云端稍后重试", false, true);
      } else if (pendingRows.length > 0) {
        setSync(
          `有 ${pendingRows.length} 笔资料等待同步`,
          false,
          true
        );
      } else {
        setSync("同步失败：" + err.message, false, true);
      }
    }
  })();

  try {
    return await cloudLoadPromise;
  } finally {
    cloudLoadPromise = null;
  }
}

async function syncPendingRows() {
  if (pendingSyncRunning) return;
  pendingSyncRunning = true;

  try {
    loadPendingRows();

    if (pendingRows.length === 0) {
      setSync("已同步", true);
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

    for (const row of liveRows) {
      const saved = await saveLiveToSheet(row.date,row.location,row.amount,row.clientUpdatedAt||"");
      if(saved&&Number(saved.amount)<=0){rows=rows.filter(x=>syncKey(x)!==syncKey(saved));if(typeof clearLiveDeleteTombstone==="function")clearLiveDeleteTombstone(row.date,row.location)}
      else if(saved){if(typeof clearLiveDeleteTombstone==="function")clearLiveDeleteTombstone(row.date,row.location);upsertLocalRow(saved)}
      clearPendingRow(row);
    }

    renderAll();
    saveLocalDataCache();
    setSync("已同步", true);
  } catch (err) {
    loadPendingRows();

    if (pendingRows.length > 0) {
      setSync(
        `有 ${pendingRows.length} 笔资料等待同步`,
        false,
        true
      );
    } else {
      setSync("云端暂时连接失败", false, true);
    }
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
  return json.row || null;
}

async function saveFairBatchToSheet(location, records) {
  const json = await jsonp({
    action: "saveFairBatch",
    location,
    records: JSON.stringify(records)
  });

  if (!json.ok) throw new Error(json.message || "Fair 储存失败");
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

async function saveLiveToSheet(date,host,amount,clientUpdatedAt=""){const json=await jsonp({action:"saveLive",date,host,amount,clientUpdatedAt});if(!json.ok)throw new Error(json.message||"Live 储存失败");return json.row||null}

async function saveCommissionSettingsToSheet(settings) {
  const json = await jsonp({
    action: "saveCommissionSettings",
    rate1: settings.rate1,
    rate2: settings.rate2,
    rate3: settings.rate3,
    liveRate: settings.liveRate,
    liveHostRates: JSON.stringify(settings.liveHostRates || {})
  });
  if (!json.ok) throw new Error(json.message || "佣金设置储存失败");
  return json.commissionSettings || null;
}

async function resetCommissionSettingsInSheet() {
  const json = await jsonp({ action: "resetCommissionSettings" });
  if (!json.ok) throw new Error(json.message || "恢复默认值失败");
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
