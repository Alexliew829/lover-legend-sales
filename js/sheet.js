const API_URL = window.LOVER_API_URL;

let rows = [];
let pendingRows = [];

let cloudSyncBusy = false;
let cloudSyncPromise = null;
let cloudSyncRequestedWhileBusy = false;
let cloudSyncTimer = null;
let cloudInitialSyncComplete = false;

const SALES_CACHE_KEY = "lover_sales_snapshot_v9";
const SALES_QUEUE_KEY = "lover_sales_queue_v9";
const SALES_CONFIG_KEY = "lover_sales_cloud_config_v9";
const LEGACY_CACHE_KEYS = ["lover_sales_snapshot_v8"];
const LEGACY_QUEUE_KEYS = ["lover_sales_queue_v8"];
const LEGACY_CONFIG_KEYS = ["lover_sales_cloud_config_v8"];

function migrateLegacySyncStorage() {
  const migrate = (target, legacyKeys) => {
    if (localStorage.getItem(target)) return;
    for (const key of legacyKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        localStorage.setItem(target, value);
        return;
      }
    }
  };
  migrate(SALES_CACHE_KEY, LEGACY_CACHE_KEYS);
  migrate(SALES_QUEUE_KEY, LEGACY_QUEUE_KEYS);
  migrate(SALES_CONFIG_KEY, LEGACY_CONFIG_KEYS);
}

function getSelectedSyncYear() {
  return (
    document.getElementById("yearPicker")?.value ||
    String(new Date().getFullYear())
  );
}

function getCloudConfig() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SALES_CONFIG_KEY) || "{}"
    );

    return {
      revisions: saved.revisions || {},
      lastSyncAt: saved.lastSyncAt || ""
    };
  } catch (err) {
    return {
      revisions: {},
      lastSyncAt: ""
    };
  }
}

function saveCloudConfig(config) {
  localStorage.setItem(
    SALES_CONFIG_KEY,
    JSON.stringify(config)
  );
}

function getCloudQueue() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SALES_QUEUE_KEY) || "null"
    );

    if (!saved) {
      return {
        dirty: false,
        changedAt: "",
        settingsDirty: false,
        records: []
      };
    }

    return {
      dirty: Boolean(saved.dirty),
      changedAt: saved.changedAt || "",
      settingsDirty: Boolean(saved.settingsDirty),
      records: Array.isArray(saved.records)
        ? saved.records
        : []
    };
  } catch (err) {
    return {
      dirty: false,
      changedAt: "",
      settingsDirty: false,
      records: []
    };
  }
}

function saveCloudQueue(queue) {
  localStorage.setItem(
    SALES_QUEUE_KEY,
    JSON.stringify(queue)
  );

  pendingRows = Array.isArray(queue.records)
    ? [...queue.records]
    : [];
}

function loadPendingRows() {
  const queue = getCloudQueue();
  pendingRows = [...queue.records];
}

function savePendingRows() {
  const queue = getCloudQueue();
  queue.records = [...pendingRows];
  queue.dirty =
    queue.settingsDirty ||
    queue.records.length > 0;

  if (queue.dirty && !queue.changedAt) {
    queue.changedAt = new Date().toISOString();
  }

  saveCloudQueue(queue);
}

function saveLocalDataCache(commissionSettings = null) {
  try {
    localStorage.setItem(
      SALES_CACHE_KEY,
      JSON.stringify({
        rows,
        commissionSettings:
          commissionSettings ||
          (
            typeof getCommissionSettings === "function"
              ? getCommissionSettings()
              : null
          ),
        savedAt: Date.now()
      })
    );
  } catch (err) {}
}

function loadLocalDataCache() {
  try {
    const cached = JSON.parse(
      localStorage.getItem(SALES_CACHE_KEY) || "null"
    );

    if (!cached || !Array.isArray(cached.rows)) {
      return false;
    }

    rows = typeof applyLiveDeleteTombstones === "function"
      ? applyLiveDeleteTombstones(cached.rows)
      : cached.rows;

    if (
      cached.commissionSettings &&
      typeof applyCommissionSettings === "function"
    ) {
      applyCommissionSettings(cached.commissionSettings);
    }

    renderAll();
    return true;
  } catch (err) {
    return false;
  }
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

    if (last) {
      last.textContent = "最后同步：" + nowText();
    }
  }
}

function jsonp(params, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const callback =
      "ll_v9_cb_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 100000);

    const script = document.createElement("script");
    const payload = {
      ...params,
      callback,
      requestId:
        Date.now() +
        "-" +
        Math.floor(Math.random() * 1000000)
    };

    const timer = window.setTimeout(() => {
      delete window[callback];
      script.remove();
      reject(
        new Error("连接 Google Apps Script 超时")
      );
    }, timeout);

    window[callback] = data => {
      window.clearTimeout(timer);
      delete window[callback];
      script.remove();
      resolve(data);
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      delete window[callback];
      script.remove();
      reject(
        new Error("无法连接 Google Apps Script")
      );
    };

    script.src =
      API_URL +
      "?" +
      new URLSearchParams(payload).toString();

    document.body.appendChild(script);
  });
}

function mergeRows(remoteRows, localRows, queue) {
  const map = new Map();

  (remoteRows || []).forEach(row => {
    map.set(syncKey(row), row);
  });

  (localRows || []).forEach(row => {
    const key = syncKey(row);
    const existing = map.get(key);

    const localTime = Date.parse(
      row.clientUpdatedAt ||
      row.updatedAt ||
      ""
    ) || 0;

    const remoteTime = Date.parse(
      existing?.clientUpdatedAt ||
      existing?.updatedAt ||
      ""
    ) || 0;

    if (!existing || localTime >= remoteTime) {
      map.set(key, row);
    }
  });

  (queue.records || []).forEach(row => {
    const key = syncKey(row);

    if (Number(row.amount || 0) <= 0) {
      map.delete(key);
    } else {
      map.set(key, row);
    }
  });

  let merged = [...map.values()];

  if (
    typeof applyLiveDeleteTombstones === "function"
  ) {
    merged = applyLiveDeleteTombstones(merged);
  }

  return dedupeRows(merged);
}

function addPendingRow(row) {
  const queue = getCloudQueue();
  const key = syncKey(row);
  const index = queue.records.findIndex(
    item => syncKey(item) === key
  );

  const nextRow = {
    ...row,
    clientUpdatedAt:
      row.clientUpdatedAt ||
      new Date().toISOString()
  };

  if (index >= 0) {
    queue.records[index] = nextRow;
  } else {
    queue.records.push(nextRow);
  }

  queue.dirty = true;
  queue.changedAt = new Date().toISOString();

  saveCloudQueue(queue);
  saveLocalDataCache();
  scheduleGoogleSync(80);
}

function clearPendingRow(row) {
  const queue = getCloudQueue();
  const key = syncKey(row);

  queue.records = queue.records.filter(
    item => syncKey(item) !== key
  );

  queue.dirty =
    queue.settingsDirty ||
    queue.records.length > 0;

  if (!queue.dirty) {
    queue.changedAt = "";
  }

  saveCloudQueue(queue);
}

function markCommissionSettingsDirty() {
  const queue = getCloudQueue();

  queue.settingsDirty = true;
  queue.dirty = true;
  queue.changedAt = new Date().toISOString();

  saveCloudQueue(queue);
  saveLocalDataCache();
  scheduleGoogleSync(80);
}

function scheduleGoogleSync(delay = 80) {
  const queue = getCloudQueue();

  if (queue.dirty) {
    setSync(
      `已储存本机，正在同步 ${queue.records.length} 笔资料...`
    );
  } else {
    setSync("后台检查更新中...");
  }

  window.clearTimeout(cloudSyncTimer);

  cloudSyncTimer = window.setTimeout(() => {
    runCloudSync().catch(error => {
      console.error("Background sync failed:", error);
    });
  }, delay);
}

async function loadFromSheet(options = {}) {
  const force = options.force === true;

  if (!cloudInitialSyncComplete) {
    loadLocalDataCache();
  }

  return runCloudSync({ force });
}

async function runCloudSync(options = {}) {
  if (!navigator.onLine) {
    const error = new Error("目前离线");

    setSync(
      "离线：资料已保存在本机",
      false,
      true
    );

    throw error;
  }

  // 已有同步在运行时，等待同一个 Promise。
  // 保存函数不能提前当成成功。
  if (cloudSyncPromise) {
    cloudSyncRequestedWhileBusy = true;
    return cloudSyncPromise;
  }

  cloudSyncBusy = true;
  cloudSyncRequestedWhileBusy = false;

  cloudSyncPromise = (async () => {
    try {
      const queue = getCloudQueue();

      if (queue.dirty) {
        await pushPendingSnapshot(queue);
      } else {
        await pullLatestSnapshot(
          options.force === true
        );
      }

      cloudInitialSyncComplete = true;
      return true;
    } catch (error) {
      cloudInitialSyncComplete = true;

      const queue = getCloudQueue();

      if (queue.dirty) {
        setSync(
          `已保存在本机，${queue.records.length} 笔等待同步`,
          false,
          true
        );
      } else {
        setSync(
          "云端暂时连接失败",
          false,
          true
        );
      }

      console.error("Google sync failed:", error);
      throw error;
    } finally {
      cloudSyncBusy = false;
      cloudSyncPromise = null;
    }
  })();

  try {
    return await cloudSyncPromise;
  } finally {
    if (
      cloudSyncRequestedWhileBusy ||
      getCloudQueue().dirty
    ) {
      cloudSyncRequestedWhileBusy = false;

      cloudSyncTimer = window.setTimeout(() => {
        runCloudSync().catch(error => {
          console.error("Retry sync failed:", error);
        });
      }, 250);
    }
  }
}

async function pullLatestSnapshot(force = false) {
  const year = getSelectedSyncYear();
  const config = getCloudConfig();
  const knownRevision = force
    ? -1
    : Number(config.revisions[year]) || 0;

  const localHasData = Array.isArray(rows) && rows.length > 0;
  const data = await jsonp({
    action: "pull",
    year,
    knownRevision,
    hasLocalData: localHasData ? "1" : "0",
    forceFull: (!localHasData || force) ? "1" : "0"
  });

  if (!data.ok) {
    throw new Error(
      data.message || "读取失败"
    );
  }

  if (data.unchanged) {
    // V9.0: 本机没有资料时，绝不接受「unchanged」空回应，
    // 必须重新取得完整 Google Sheet snapshot。
    if (!localHasData) {
      const full = await jsonp({
        action: "pull",
        year,
        knownRevision: -1,
        hasLocalData: "0",
        forceFull: "1"
      });
      if (!full.ok || !Array.isArray(full.rows)) {
        throw new Error("Google Sheet 未返回完整资料");
      }
      data.unchanged = false;
      data.revision = full.revision;
      data.rows = full.rows;
      data.commissionSettings = full.commissionSettings;
    } else {
      config.revisions[year] = Number(data.revision) || 0;
      config.lastSyncAt = new Date().toISOString();
      saveCloudConfig(config);
      setSync("已同步", true);
      return;
    }
  }

  const queue = getCloudQueue();

  rows = mergeRows(
    data.rows || [],
    rows,
    queue
  );

  if (
    data.commissionSettings &&
    !queue.settingsDirty &&
    typeof applyCommissionSettings === "function"
  ) {
    applyCommissionSettings(
      data.commissionSettings
    );
  }

  config.revisions[year] =
    Number(data.revision) || 0;

  config.lastSyncAt =
    new Date().toISOString();

  saveCloudConfig(config);
  saveLocalDataCache(
    queue.settingsDirty
      ? getCommissionSettings()
      : data.commissionSettings
  );

  renderAll();
  setSync("已同步", true);
}

async function pushPendingSnapshot(
  queue,
  retryCount = 0
) {
  const year = getSelectedSyncYear();
  const config = getCloudConfig();

  const sentRecords = [...(queue.records || [])];
  const sentKeys = new Set(
    sentRecords.map(syncKey)
  );
  const sentSettingsDirty =
    Boolean(queue.settingsDirty);

  const data = await jsonp(
    {
      action: "push",
      year,
      baseRevision:
        Number(config.revisions[year]) || 0,
      changes: JSON.stringify(sentRecords),
      settingsDirty:
        sentSettingsDirty ? "1" : "0",
      commissionSettings:
        JSON.stringify(
          typeof getCommissionSettings === "function"
            ? getCommissionSettings()
            : {}
        ),
      updatedBy: "Sales V9.0 Stable"
    },
    25000
  );

  if (!data.ok) {
    throw new Error(
      data.message || "同步失败"
    );
  }

  if (data.conflict) {
    if (retryCount >= 2) {
      throw new Error(
        "资料冲突仍未解决，系统会保留本机资料并稍后重试"
      );
    }

    rows = mergeRows(
      data.rows || [],
      rows,
      getCloudQueue()
    );

    if (
      data.commissionSettings &&
      !getCloudQueue().settingsDirty &&
      typeof applyCommissionSettings === "function"
    ) {
      applyCommissionSettings(
        data.commissionSettings
      );
    }

    config.revisions[year] =
      Number(data.revision) || 0;

    saveCloudConfig(config);
    saveLocalDataCache();
    renderAll();

    return pushPendingSnapshot(
      getCloudQueue(),
      retryCount + 1
    );
  }

  config.revisions[year] =
    Number(data.revision) || 0;

  config.lastSyncAt =
    new Date().toISOString();

  saveCloudConfig(config);

  // 只清除本次云端已确认的记录。
  const latestQueue = getCloudQueue();

  latestQueue.records = latestQueue.records.filter(
    record => !sentKeys.has(syncKey(record))
  );

  if (sentSettingsDirty) {
    latestQueue.settingsDirty = false;
  }

  latestQueue.dirty =
    latestQueue.settingsDirty ||
    latestQueue.records.length > 0;

  if (!latestQueue.dirty) {
    latestQueue.changedAt = "";
  }

  saveCloudQueue(latestQueue);

  if (Array.isArray(data.rows)) {
    rows = mergeRows(
      data.rows,
      rows,
      latestQueue
    );
  }

  if (
    data.commissionSettings &&
    !latestQueue.settingsDirty &&
    typeof applyCommissionSettings === "function"
  ) {
    applyCommissionSettings(
      data.commissionSettings
    );
  }

  saveLocalDataCache(
    latestQueue.settingsDirty
      ? getCommissionSettings()
      : (data.commissionSettings || null)
  );

  renderAll();

  if (latestQueue.dirty) {
    setSync(
      `已同步部分资料，尚有 ${latestQueue.records.length} 笔等待同步`
    );
  } else {
    setSync("已同步", true);
  }
}

async function syncPendingRows() {
  return runCloudSync();
}

async function saveDailyToSheet(
  date,
  company,
  amount,
  clientUpdatedAt = ""
) {
  await runCloudSync();

  const row = {
    type: "daily",
    date,
    company,
    location: "",
    amount: Number(amount || 0)
  };

  const stillPending = getCloudQueue().records.some(
    pending => syncKey(pending) === syncKey(row)
  );

  if (stillPending) {
    throw new Error("这笔营业额仍在等待同步");
  }

  return {
    ...row,
    updatedAt:
      clientUpdatedAt ||
      new Date().toISOString()
  };
}

async function saveFairBatchToSheet(
  location,
  records
) {
  await runCloudSync();

  const resultRows = (records || []).map(item => ({
    type: "fair",
    date: item.date,
    company: "belimbing",
    location,
    amount: Number(item.amount || 0),
    updatedAt:
      item.clientUpdatedAt ||
      new Date().toISOString()
  }));

  const pendingKeys = new Set(
    getCloudQueue().records.map(syncKey)
  );

  if (
    resultRows.some(
      row => pendingKeys.has(syncKey(row))
    )
  ) {
    throw new Error("Fair 资料仍在等待同步");
  }

  return { rows: resultRows };
}

async function saveLiveToSheet(
  date,
  host,
  amount,
  clientUpdatedAt = ""
) {
  await runCloudSync();

  const row = {
    type: "live",
    date,
    company: "live",
    location: host,
    amount: Number(amount || 0),
    updatedAt:
      clientUpdatedAt ||
      new Date().toISOString()
  };

  const stillPending = getCloudQueue().records.some(
    pending => syncKey(pending) === syncKey(row)
  );

  if (stillPending) {
    throw new Error("这笔 Live 资料仍在等待同步");
  }

  return row;
}

async function saveCommissionSettingsToSheet(
  settings
) {
  if (
    typeof applyCommissionSettingsImmediately ===
    "function"
  ) {
    applyCommissionSettingsImmediately(
      settings
    );
  }

  markCommissionSettingsDirty();
  await runCloudSync();

  return getCommissionSettings();
}

async function resetCommissionSettingsInSheet() {
  return saveCommissionSettingsToSheet({
    rate1: 6,
    rate2: 7,
    rate3: 8,
    liveRate: 10,
    liveHostRates: {}
  });
}

window.addEventListener("online", () => {
  scheduleGoogleSync(100);
});

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState === "visible"
    ) {
      scheduleGoogleSync(150);
    }
  }
);

window.addEventListener("focus", () => {
  scheduleGoogleSync(150);
});

window.setInterval(() => {
  const queue = getCloudQueue();

  if (queue.dirty) {
    runCloudSync().catch(error => {
      console.error("Interval sync failed:", error);
    });
  }
}, 15000);

migrateLegacySyncStorage();
loadPendingRows();
