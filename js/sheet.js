const API_URL = window.LOVER_API_URL;
let rows = [];

function setSync(text, good = false, error = false) {
  const el = document.getElementById("syncStatus");
  if (!el) return;

  if (error) {
    el.textContent = "🔴 " + text;
    return;
  }

  el.textContent = (good ? "🟢 " : "🟡 ") + text;
}

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callback = "ll_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    params.callback = callback;

    const script = document.createElement("script");
    const query = new URLSearchParams(params).toString();

    window[callback] = function(data) {
      delete window[callback];
      script.remove();
      resolve(data);
    };

    script.onerror = function() {
      delete window[callback];
      script.remove();
      reject(new Error("无法连接 Google Apps Script"));
    };

    script.src = API_URL + "?" + query;
    document.body.appendChild(script);
  });
}

async function loadFromSheet() {
  setSync("正在同步 Google Sheets...");

  try {
    const json = await jsonp({ action: "load" });
    if (!json.ok) throw new Error(json.message || "读取失败");

    rows = json.rows || [];
    renderAll();

    const now = new Date();
    setSync("已同步 " + now.toLocaleTimeString("zh-MY", { hour: "2-digit", minute: "2-digit" }), true);
  } catch (err) {
    setSync("同步失败：" + err.message, false, true);
    alert("同步失败：" + err.message);
  }
}

async function saveDailyToSheet(date, company, amount) {
  const json = await jsonp({ action: "saveDaily", date, company, amount });
  if (!json.ok) throw new Error(json.message || "储存失败");
}

async function saveFairToSheet(location, records) {
  const json = await jsonp({
    action: "saveFairBatch",
    location,
    records: JSON.stringify(records)
  });

  if (!json.ok) throw new Error(json.message || "储存失败");
}

async function restoreRowsToSheet(restoredRows) {
  const json = await jsonp({
    action: "restoreRows",
    rows: JSON.stringify(restoredRows)
  });

  if (!json.ok) throw new Error(json.message || "恢复失败");
}

async function clearAllSheet() {
  const json = await jsonp({ action: "clearAll" });
  if (!json.ok) throw new Error(json.message || "清空失败");
}
