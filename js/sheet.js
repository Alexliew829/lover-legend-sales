const API_URL = window.LOVER_API_URL;

let rows = [];
let pendingRows = [];

let cloudSyncBusy = false;
let cloudSyncRequestedWhileBusy = false;
let cloudSyncTimer = null;
let cloudInitialSyncComplete = false;

const SALES_CACHE_KEY = "lover_sales_snapshot_v8";
const SALES_QUEUE_KEY = "lover_sales_queue_v8";
const SALES_CONFIG_KEY = "lover_sales_cloud_config_v8";

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
      "ll_v8_cb_" +
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
      `已储存本机，正在同步 ${
        queue.records.length
      } 笔资料...`
    );
  } else {
    setSync("后台检查更新中...");
  }

  window.clearTimeout(cloudSyncTimer);

  cloudSyncTimer = window.setTimeout(
    () => runCloudSync(),
    delay
  );
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
    setSync(
      "离线：资料已保存在本机",
      false,
      true
    );
    return;
  }

  if (cloudSyncBusy) {
    cloudSyncRequestedWhileBusy = true;
    return;
  }

  cloudSyncBusy = true;
  cloudSyncRequestedWhileBusy = false;

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

    console.error(
      "Google sync failed:",
      error
    );
  } finally {
    cloudSyncBusy = false;

    if (
      cloudSyncRequestedWhileBusy ||
      getCloudQueue().dirty
    ) {
      cloudSyncTimer = window.setTimeout(
        () => runCloudSync(),
        180
      );
    }
  }
}

async function pullLatestSnapshot(force = false) {
  const year = getSelectedSyncYear();
  const config = getCloudConfig();
  const knownRevision = force
    ? -1
    : Number(config.revisions[year]) || 0;

  const data = await jsonp({
    action: "pull",
    year,
    knownRevision
  });

  if (!data.ok) {
    throw new Error(
      data.message || "读取失败"
    );
  }

  if (data.unchanged) {
    config.revisions[year] =
      Number(data.revision) || 0;

    config.lastSyncAt =
      new Date().toISOString();

    saveCloudConfig(config);
    setSync("已同步", true);
    return;
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
  const sentChangedAt =
    queue.changedAt || "";

  const data = await jsonp(
    {
      action: "push",
      year,
      baseRevision:
        Number(config.revisions[year]) || 0,
      changes: JSON.stringify(
        queue.records || []
      ),
      settingsDirty:
        queue.settingsDirty ? "1" : "0",
      commissionSettings:
        JSON.stringify(
          typeof getCommissionSettings === "function"
            ? getCommissionSettings()
            : {}
        ),
      updatedBy: "Sales V8.0"
    },
    20000
  );

  if (!data.ok) {
    throw new Error(
      data.message || "同步失败"
    );
  }

  if (data.conflict) {
    if (retryCount >= 1) {
      throw new Error(
        "资料冲突仍未解决，请重新打开系统再同步"
      );
    }

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

  const latestQueue = getCloudQueue();

  if (
    latestQueue.changedAt === sentChangedAt
  ) {
    saveCloudQueue({
      dirty: false,
      changedAt: "",
      settingsDirty: false,
      records: []
    });
  }

  if (Array.isArray(data.rows)) {
    rows = mergeRows(
      data.rows,
      rows,
      getCloudQueue()
    );
  }

  if (
    data.commissionSettings &&
    typeof applyCommissionSettings === "function"
  ) {
    applyCommissionSettings(
      data.commissionSettings
    );
  }

  saveLocalDataCache(
    data.commissionSettings || null
  );

  renderAll();
  setSync("已同步", true);
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

  return {
    type: "daily",
    date,
    company,
    location: "",
    amount: Number(amount || 0),
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

  return {
    rows: (records || []).map(item => ({
      type: "fair",
      date: item.date,
      company: "belimbing",
      location,
      amount: Number(item.amount || 0),
      updatedAt:
        item.clientUpdatedAt ||
        new Date().toISOString()
    }))
  };
}

async function saveLiveToSheet(
  date,
  host,
  amount,
  clientUpdatedAt = ""
) {
  await runCloudSync();

  return {
    type: "live",
    date,
    company: "live",
    location: host,
    amount: Number(amount || 0),
    updatedAt:
      clientUpdatedAt ||
      new Date().toISOString()
  };
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
    runCloudSync();
  }
}, 15000);

loadPendingRows();
