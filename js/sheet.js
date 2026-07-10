const API_URL = window.LOVER_API_URL;
let rows = [];
let pendingRows = [];

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
  loadPendingRows();

  if (pendingRows.length === 0) {
    setSync("已同步", true);
    return;
  }

  setSync(`正在自动同步 ${pendingRows.length} 笔资料...`);

  const copy = [...pendingRows];

  for (const row of copy) {
    try {
      if (row.type === "daily") {
        const saved = await saveDailyToSheet(row.date, row.company, row.amount, row.clientUpdatedAt || "");
        if (saved) upsertLocalRow(saved);
      } else if (row.type === "fair") {
        await saveFairSingleToSheet(row.date, row.location, row.amount, row.clientUpdatedAt || "");
      }
      clearPendingRow(row);
    } catch (err) {
      setSync(`有 ${pendingRows.length} 笔未同步资料，系统会自动重试`, false, true);
      return;
    }
  }

  await loadFromSheet();
}

async function saveDailyToSheet(date, company, amount, clientUpdatedAt = "") {
  const json = await jsonp({ action: "saveDaily", date, company, amount, clientUpdatedAt });
  if (!json.ok) {
    if (json.conflict) {
      const ok = confirm(`云端资料已更新。\n\n云端金额：${money(json.cloudAmount)}\n你准备储存：${money(amount)}\n\n确定覆盖？`);
      if (!ok) throw new Error("已取消覆盖");
      const force = await jsonp({ action: "saveDaily", date, company, amount, clientUpdatedAt, force: "1" });
      if (!force.ok) throw new Error(force.message || "储存失败");
      return force.row || null;
    }
    throw new Error(json.message || "储存失败");
  }
  return json.row || null;
}

async function saveFairSingleToSheet(date, location, amount, clientUpdatedAt = "") {
  const json = await jsonp({ action: "saveFairSingle", date, location, amount, clientUpdatedAt });
  if (!json.ok) {
    if (json.conflict) {
      const ok = confirm(`云端 Fair 资料已更新。\n\n地点：${location}\n日期：${date}\n云端金额：${money(json.cloudAmount)}\n你准备储存：${money(amount)}\n\n确定覆盖？`);
      if (!ok) throw new Error("已取消覆盖");
      const force = await jsonp({ action: "saveFairSingle", date, location, amount, clientUpdatedAt, force: "1" });
      if (!force.ok) throw new Error(force.message || "储存失败");
      return;
    }
    throw new Error(json.message || "储存失败");
  }
}

async function saveFairToSheet(location, records) {
  for (const item of records) {
    await saveFairSingleToSheet(item.date, location, item.amount, item.clientUpdatedAt || "");
  }
}


setInterval(() => {
  loadPendingRows();
  if (pendingRows.length > 0) {
    syncPendingRows();
  }
}, 30000);
