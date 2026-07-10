const API_URL = window.LOVER_API_URL;
let rows = [];
let pendingRows = [];
let pendingSyncRunning = false;

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
    }, 20000);

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

async function loadFromSheet() {
  loadPendingRows();

  if (pendingRows.length > 0) {
    setSync(`有 ${pendingRows.length} 笔未同步资料，正在自动同步...`, false, true);
    await syncPendingRows();
    return;
  }

  setSync("同步中...");

  try {
    const json = await jsonp({ action: "load" });
    if (!json.ok) throw new Error(json.message || "读取失败");

    rows = json.rows || [];
    renderAll();
    setSync("已同步", true);
  } catch (err) {
    setSync("同步失败：" + err.message, false, true);
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

    renderAll();
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

setInterval(() => {
  loadPendingRows();
  if (pendingRows.length > 0) syncPendingRows();
}, 30000);

window.addEventListener("online", () => {
  loadPendingRows();
  if (pendingRows.length > 0) syncPendingRows();
});
