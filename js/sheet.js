const API_URL = window.LOVER_API_URL;
let rows = [];
let pendingRows = [];
let pendingSyncRunning = false;
let cloudLoadPromise = null;
let lastCloudLoadAt = 0;

const LOCAL_DATA_CACHE_KEY = "lover_sales_data_cache";
const LEGACY_LOCAL_DATA_CACHE_KEYS = [
  "lover_sales_data_cache_v95",
  "lover_sales_data_cache_v94",
  "lover_sales_data_cache_v93",
  "lover_sales_data_cache_v92"
];
const CLOUD_LOAD_COOLDOWN_MS = 20000;

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
    const cached = JSON.parse(readLocalDataCacheRaw() || "null");
    if (!cached || !Array.isArray(cached.rows)) return false;

    rows = cached.rows;

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

    renderAll();
    return true;
  } catch (err) {
    return false;
  }
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
    params._ts = Date.now();

    const script = document.createElement("script");
    const query = new URLSearchParams(params).toString();

    const timer = setTimeout(() => {
      delete window[callback];
      script.remove();
      reject(new Error("连接 Google Apps Script 超时"));
    }, 7000);

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
    loadPendingRows();

    if (pendingRows.length > 0) {
      setSync(
        `有 ${pendingRows.length} 笔未同步资料，正在后台同步...`
      );

      // 后台同步，不阻塞本机缓存及云端读取。
      syncPendingRows().catch(() => {});
    }

    const skipLocalCache = options.skipLocalCache === true || force;
    // V9.6: app startup already loaded local cache before this background call.
    // Do not parse and render the same cache a second time.
    const hasLocalData = rows.length > 0 || (!skipLocalCache && loadLocalDataCache());
    setSync(hasLocalData ? "本机资料已显示 · 云端后台同步中" : "云端后台同步中");

    try {
      const year = (typeof selectedYear === "function" && selectedYear()) || String(new Date().getFullYear());
      const json = await jsonp({ action: "loadYear", year });
      if (!json.ok) throw new Error(json.message || "读取失败");

      rows = json.rows || [];

      if (json.systemState && typeof applySystemState === "function") applySystemState(json.systemState);

      if (json.commissionSettings && typeof applyCommissionSettings === "function") {
        applyCommissionSettings(json.commissionSettings);
      }

      if (json.accessSettings && typeof applyAccessPasswordSettings === "function") {
        applyAccessPasswordSettings(json.accessSettings);
      }

      renderAll();
      saveLocalDataCache(
        json.commissionSettings || null,
        json.accessSettings || null
      );
      setSync("已同步", true);
    } catch (err) {
      setSync(
        hasLocalData ? "已显示本机资料，云端同步稍后重试" : "同步失败：" + err.message,
        false,
        true
      );
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
    loadPendingRows();
    setSync(`有 ${pendingRows.length} 笔未同步资料，系统会自动重试`, false, true);
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


async function saveLiveToSheet(date, host, amount, clientUpdatedAt = "") {
  const json = await jsonp({
    action: "saveLive",
    date,
    host,
    amount,
    clientUpdatedAt
  });
  if (!json.ok) throw new Error(json.message || "Live 储存失败");
  return json.row || null;
}

async function saveCommissionSettingsToSheet(settings, targetMonth = "") {
  const json = await jsonp({
    action: "saveCommissionSettings",
    rate1: settings.rate1,
    rate2: settings.rate2,
    rate3: settings.rate3,
    liveRate: settings.liveRate,
    liveHostRates: JSON.stringify(settings.liveHostRates || {}),
    liveHosts: JSON.stringify(settings.liveHosts || {}),
    targetMonth: targetMonth || ""
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
  const json = await jsonp({
    action: "saveAccessSettings",
    accessPasswordHash: settings.accessPasswordHash,
    accessPasswordHint: settings.accessPasswordHint
  });
  if (!json.ok) throw new Error(json.message || "密码设置同步失败");
  return json.accessSettings || null;
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
