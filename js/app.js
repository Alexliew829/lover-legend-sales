const companyNames = { balakong: "Lover Legend Adenium - Balakong", belimbing: "Lover Legend Gardening - Belimbing" };
function selectedMonth() { return document.getElementById("monthPicker").value; }
function sameMonth(date) { return sameMonthDisplay(date, selectedMonth()); }
function showPage(name, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-" + name).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  el.classList.add("active");
}
function upsertLocalRow(newRow) {
  const index = rows.findIndex(r => r.type === newRow.type && r.date === newRow.date && r.company === newRow.company && (r.location || "") === (newRow.location || ""));
  if (index >= 0) rows[index] = newRow; else rows.push(newRow);
}
function removeLocalFairLocationOutsideDates(location, keepDates) {
  rows = rows.filter(r => r.type !== "fair" || (r.location || "") !== location || keepDates.includes(r.date));
}
function getDailyAmount(dateDisplay, company) {
  const found = rows.find(r => r.type === "daily" && r.date === dateDisplay && r.company === company);
  return found ? Number(found.amount || 0) : 0;
}
function updateDailyInputFromSelectedDate() {
  const dateDisplay = isoToDisplay(document.getElementById("saleDate").value);
  const company = document.getElementById("company").value;
  const amount = getDailyAmount(dateDisplay, company);
  document.getElementById("dailySales").value = formatAmount(amount);
  const el = document.getElementById("salesDateResult");
  if (el) el.textContent = `${companyNames[company]}｜${dateDisplay}｜${money(amount)}`;
}
function totalBy(type, company = "", dateMode = "month") {
  return rows.filter(r => r.type === type)
    .filter(r => company ? r.company === company : true)
    .filter(r => dateMode === "today" ? r.date === isoToDisplay(todayISO()) : dateMode === "month" ? sameMonth(r.date) : true)
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
}
function fairByLocation() {
  const grouped = {};
  rows.filter(r => r.type === "fair").filter(r => sameMonth(r.date)).forEach(r => {
    const location = r.location || "Fair";
    grouped[location] = (grouped[location] || 0) + Number(r.amount || 0);
  });
  return grouped;
}
function renderFairLocationList() {
  const grouped = fairByLocation();
  const locations = Object.keys(grouped).sort();
  const container = document.getElementById("fairLocationList");
  if (!container) return;
  if (locations.length === 0) { container.innerHTML = `<div class="sub">这个月份还没有 Fair 记录</div>`; return; }
  container.innerHTML = `<div class="fair-location-grid">` + locations.map(location => {
    const total = grouped[location];
    return `<div class="fair-location-card"><div class="fair-location-title">${location}</div><div class="fair-location-row"><span>营业额</span><b>${money(total)}</b></div><div class="fair-location-row"><span>佣金 6%</span><b>${money(total * 0.06)}</b></div></div>`;
  }).join("") + `</div>`;
}
function renderDashboard() {
  const balakongToday = totalBy("daily", "balakong", "today");
  const belimbingToday = totalBy("daily", "belimbing", "today");
  const fairToday = totalBy("fair", "", "today");
  const balakongMonth = totalBy("daily", "balakong", "month");
  const belimbingMonth = totalBy("daily", "belimbing", "month");
  const fairMonth = totalBy("fair", "", "month");
  const gardening = belimbingMonth + fairMonth;
  const grand = balakongMonth + gardening;
  document.getElementById("balakongMonth").textContent = money(balakongMonth);
  document.getElementById("belimbingMonth").textContent = money(belimbingMonth);
  renderFairLocationList();
  document.getElementById("fairMonthTotal").textContent = money(fairMonth);
  document.getElementById("fairCommissionTotal").textContent = money(fairMonth * 0.06);
  document.getElementById("gardeningTotal").textContent = money(gardening);
  document.getElementById("grandTotal").textContent = money(grand);
  const warning = document.getElementById("todayWarning");
  const done = document.getElementById("todayDone");
  if (balakongToday === 0 && belimbingToday === 0 && fairToday === 0) { warning.classList.remove("hidden"); done.classList.add("hidden"); }
  else { warning.classList.add("hidden"); done.classList.remove("hidden"); }
}
function renderTable() {
  const selected = rows.filter(r => sameMonth(r.date));
  const ordered = [];
  ["balakong", "belimbing"].forEach(company => {
    selected.filter(r => r.type === "daily" && r.company === company).sort((a,b) => displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r => ordered.push(r));
  });
  const fairLocations = [...new Set(selected.filter(r => r.type === "fair").map(r => r.location || "Fair"))].sort();
  fairLocations.forEach(location => {
    selected.filter(r => r.type === "fair" && (r.location || "Fair") === location).sort((a,b) => displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r => ordered.push(r));
  });
  document.getElementById("recordTable").innerHTML = ordered.map(r => `<tr><td>${r.date}</td><td>${r.type === "fair" ? "Fair" : "每日"}</td><td>${companyNames[r.company] || r.company}</td><td>${r.location || "-"}</td><td>${money(r.amount)}</td></tr>`).join("") || `<tr><td colspan="5" style="text-align:center;">这个月份还没有记录</td></tr>`;
}
function renderAll() { renderDashboard(); renderTable(); updateDailyInputFromSelectedDate(); }
async function saveDailySales() {
  const dateDisplay = isoToDisplay(document.getElementById("saleDate").value);
  const company = document.getElementById("company").value;
  const amount = toAmount(document.getElementById("dailySales").value);
  if (!dateDisplay) { alert("请选择日期"); return; }
  const localRow = { type: "daily", date: dateDisplay, company, location: "", amount, updatedAt: new Date().toISOString() };
  upsertLocalRow(localRow);
  document.getElementById("dailySales").value = formatAmount(amount);
  renderAll(); showTempMsg("saveMsg");
  try {
    setSync("同步中...");
    const savedRow = await saveDailyToSheet(dateDisplay, company, amount);
    if (savedRow) upsertLocalRow(savedRow);
    renderAll(); setSync("已同步", true);
  } catch (err) { setSync("同步失败：" + err.message, false, true); alert("同步失败：" + err.message); }
}
function syncFairInputs() {
  const start = document.getElementById("fairStart").value;
  const end = document.getElementById("fairEnd").value;
  if (!start || !end || new Date(start) > new Date(end)) { document.getElementById("fairInputs").innerHTML = ""; return; }
  let html = "<h3>Fair 每日营业额</h3>";
  dateRange(start, end).forEach(dateDisplay => {
    const old = rows.find(r => r.type === "fair" && r.date === dateDisplay);
    html += `<label>${dateDisplay} 营业额</label><input type="text" class="fairAmount money-input" data-date="${dateDisplay}" value="${old ? formatAmount(old.amount) : "0.00"}" inputmode="decimal">`;
  });
  document.getElementById("fairInputs").innerHTML = html;
  attachMoneyInputs();
}
async function saveFairSales() {
  const location = document.getElementById("fairLocation").value.trim();
  const inputs = document.querySelectorAll(".fairAmount");
  if (!location) { alert("请输入 Fair 地点"); return; }
  localStorage.setItem("lover_last_fair_location", location);
  if (inputs.length === 0) { alert("请选择 Fair 日期"); return; }
  const records = [...inputs].map(input => ({ date: input.dataset.date, amount: toAmount(input.value) }));
  const keepDates = records.map(r => r.date);
  removeLocalFairLocationOutsideDates(location, keepDates);
  records.forEach(item => upsertLocalRow({ type: "fair", date: item.date, company: "belimbing", location, amount: item.amount, updatedAt: new Date().toISOString() }));
  renderAll(); showTempMsg("fairSaveMsg");
  try { setSync("同步中..."); await saveFairToSheet(location, records); setSync("已同步", true); }
  catch (err) { setSync("同步失败：" + err.message, false, true); alert("Fair 同步失败：" + err.message); }
}
function exportCSV() {
  let csv = "\uFEFF公司,日期,类别,地点,营业额\n";
  const selected = rows.filter(r => sameMonth(r.date));
  function addSection(company, title) {
    let total = 0; csv += `"${title}",,,,\n`;
    selected.filter(r => r.type === "daily" && r.company === company).sort((a,b) => displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r => {
      total += Number(r.amount || 0); csv += `"${title}",${r.date},"每日","",${Number(r.amount || 0).toFixed(2)}\n`;
    });
    csv += `"${title} Total",,,,${total.toFixed(2)}\n\n`;
  }
  addSection("balakong", "Lover Legend Adenium - Balakong");
  addSection("belimbing", "Lover Legend Gardening - Belimbing");
  let fairTotal = 0;
  const fairLocations = [...new Set(selected.filter(r => r.type === "fair").map(r => r.location || "Fair"))].sort();
  csv += `"Fair",,,,\n`;
  fairLocations.forEach(location => {
    let locationTotal = 0; csv += `"${location}",,,,\n`;
    selected.filter(r => r.type === "fair" && (r.location || "Fair") === location).sort((a,b) => displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r => {
      locationTotal += Number(r.amount || 0); fairTotal += Number(r.amount || 0);
      csv += `"Fair",${r.date},"Fair","${r.location || ""}",${Number(r.amount || 0).toFixed(2)}\n`;
    });
    csv += `"${location} Total",,,,${locationTotal.toFixed(2)}\n\n`;
  });
  csv += `"Fair Total",,,,${fairTotal.toFixed(2)}\n\n`;
  const balakong = totalBy("daily", "balakong", "month");
  const belimbing = totalBy("daily", "belimbing", "month");
  const gardening = belimbing + fairTotal;
  const grand = balakong + gardening;
  csv += `"Gardening Total",,,Belimbing + Fair,${gardening.toFixed(2)}\n`;
  csv += `"Grand Total",,,Balakong + Gardening,${grand.toFixed(2)}\n`;
  downloadFile(`Lover_Sales_${selectedMonth()}.csv`, csv, "text/csv;charset=utf-8;");
}
function backupData() {
  const backup = { app: "Lover Legend Sales V4.4", backupAt: new Date().toISOString(), rows };
  downloadFile(`Sales_Backup_${isoToDisplay(todayISO())}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8;");
}
async function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const choice = prompt("Restore 前请选择：\n1 = 先 Backup 再 Restore\n2 = 直接 Restore\n取消 = 不恢复");
  if (choice === null) { event.target.value = ""; return; }
  if (choice !== "1" && choice !== "2") { alert("请输入 1 或 2"); event.target.value = ""; return; }
  if (choice === "1") backupData();
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const backup = JSON.parse(e.target.result);
      const restoredRows = backup.rows || [];
      if (!Array.isArray(restoredRows)) { alert("这个备份文件不正确。"); return; }
      const ok = confirm("确定 Restore？Google Sheet 现有资料会被覆盖。");
      if (!ok) return;
      rows = restoredRows.map(r => ({ ...r, date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? isoToDisplay(r.date) : r.date }));
      renderAll();
      await restoreRowsToSheet(rows);
      await loadFromSheet();
      alert("恢复完成");
    } catch (err) { alert("恢复失败：" + err.message); }
    finally { event.target.value = ""; }
  };
  reader.readAsText(file);
}
function monthClose() {
  const month = selectedMonth();
  const lastDay = getLastDayOfMonth(month);
  const today = new Date();
  today.setHours(0,0,0,0); lastDay.setHours(0,0,0,0);
  if (today < lastDay) {
    const lastIso = `${lastDay.getFullYear()}-${String(lastDay.getMonth()+1).padStart(2,"0")}-${String(lastDay.getDate()).padStart(2,"0")}`;
    alert(`今天不是月底，无法进行月结。\n${month} 的最后一天是 ${isoToDisplay(lastIso)}`);
    return;
  }
  backupData();
  const [year, monthNum] = month.split("-").map(Number);
  const next = new Date(year, monthNum, 1);
  const nextMonth = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}`;
  document.getElementById("monthPicker").value = nextMonth;
  renderAll();
  alert("已完成月底结算，进入 " + nextMonth);
}
async function seedTestData() {
  const ok = confirm("确定输入测试资料？这会先清空目前 Google Sheet 测试资料。");
  if (!ok) return;
  try {
    setSync("正在输入测试资料...");
    const seededRows = await seedTestDataToSheet();
    rows = seededRows || [];
    document.getElementById("monthPicker").value = "2026-07";
    renderAll();
    setSync("测试资料已同步", true);
    showTempMsg("seedMsg");
  } catch (err) { setSync("输入测试资料失败：" + err.message, false, true); alert("输入测试资料失败：" + err.message); }
}
async function clearTestData() {
  const word = prompt("确定清空测试资料？请输入 DELETE 才能继续。");
  if (word !== "DELETE") return;
  try {
    rows = []; renderAll();
    await clearAllSheet();
    setSync("已清空并同步", true);
    showTempMsg("clearMsg");
  } catch (err) { alert("清空失败：" + err.message); }
}
document.getElementById("monthPicker").value = monthISO();
document.getElementById("saleDate").value = todayISO();
document.getElementById("fairStart").value = todayISO();
document.getElementById("fairEnd").value = todayISO();
const lastFairLocation = localStorage.getItem("lover_last_fair_location");
if (lastFairLocation) document.getElementById("fairLocation").value = lastFairLocation;
document.getElementById("monthPicker").addEventListener("change", renderAll);
document.getElementById("saleDate").addEventListener("change", updateDailyInputFromSelectedDate);
document.getElementById("company").addEventListener("change", updateDailyInputFromSelectedDate);
document.getElementById("fairStart").addEventListener("change", syncFairInputs);
document.getElementById("fairEnd").addEventListener("change", syncFairInputs);
attachMoneyInputs();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
renderAll();
loadFromSheet();
