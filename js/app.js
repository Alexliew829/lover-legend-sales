const companyNames = {
  balakong: "Lover Legend Adenium - Balakong",
  belimbing: "Lover Legend Gardening - Belimbing"
};

function selectedMonth() {
  return document.getElementById("monthPicker").value;
}

function sameMonth(date) {
  return String(date || "").slice(0, 7) === selectedMonth();
}

function showPage(name, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-" + name).classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  el.classList.add("active");
}

function totalBy(type, company = "", dateMode = "month") {
  return rows
    .filter(r => r.type === type)
    .filter(r => company ? r.company === company : true)
    .filter(r => {
      if (dateMode === "today") return r.date === todayISO();
      if (dateMode === "month") return sameMonth(r.date);
      return true;
    })
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
}


function upsertLocalRow(newRow) {
  const index = rows.findIndex(r =>
    r.type === newRow.type &&
    r.date === newRow.date &&
    r.company === newRow.company &&
    (r.location || "") === (newRow.location || "")
  );
  if (index >= 0) rows[index] = newRow;
  else rows.push(newRow);
}

function removeLocalFairLocationOutsideDates(location, keepDates) {
  rows = rows.filter(r => {
    if (r.type !== "fair") return true;
    if ((r.location || "") !== location) return true;
    return keepDates.includes(r.date);
  });
}

function fairByLocation() {
  const grouped = {};
  rows.filter(r => r.type === "fair")
    .filter(r => sameMonth(r.date))
    .forEach(r => {
      const location = r.location || "Fair";
      if (!grouped[location]) grouped[location] = 0;
      grouped[location] += Number(r.amount || 0);
    });
  return grouped;
}

function renderFairLocationList() {
  const grouped = fairByLocation();
  const locations = Object.keys(grouped).sort();
  const container = document.getElementById("fairLocationList");

  if (!container) return;

  if (locations.length === 0) {
    container.innerHTML = `<div class="sub">这个月份还没有 Fair 记录</div>`;
    return;
  }

  container.innerHTML = locations.map(location => {
    const total = grouped[location];
    return `
      <div class="fair-location-card">
        <div class="fair-location-title">${location}</div>
        <div class="fair-location-row"><span>营业额</span><b>${money(total)}</b></div>
        <div class="fair-location-row"><span>佣金 6%</span><b>${money(total * 0.06)}</b></div>
      </div>
    `;
  }).join("");
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

  document.getElementById("balakongToday").textContent = money(balakongToday);
  document.getElementById("balakongMonth").textContent = money(balakongMonth);
  document.getElementById("belimbingToday").textContent = money(belimbingToday);
  document.getElementById("belimbingMonth").textContent = money(belimbingMonth);

  renderFairLocationList();

  document.getElementById("fairMonthTotal").textContent = money(fairMonth);
  document.getElementById("fairCommissionTotal").textContent = money(fairMonth * 0.06);
  document.getElementById("gardeningTotal").textContent = money(gardening);
  document.getElementById("grandTotal").textContent = money(grand);

  const warning = document.getElementById("todayWarning");
  const done = document.getElementById("todayDone");

  if (balakongToday === 0 && belimbingToday === 0 && fairToday === 0) {
    warning.classList.remove("hidden");
    done.classList.add("hidden");
  } else {
    warning.classList.add("hidden");
    done.classList.remove("hidden");
  }
}

function renderTable() {
  const selected = rows
    .filter(r => sameMonth(r.date))
    .sort((a, b) => {
      const order = String(a.company).localeCompare(String(b.company));
      if (order !== 0) return order;
      return String(a.date).localeCompare(String(b.date));
    });

  document.getElementById("recordTable").innerHTML = selected.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.type === "fair" ? "Fair" : "每日"}</td>
      <td>${companyNames[r.company] || r.company}</td>
      <td>${r.location || "-"}</td>
      <td>${money(r.amount)}</td>
    </tr>
  `).join("") || `<tr><td colspan="5" style="text-align:center;">这个月份还没有记录</td></tr>`;
}

function renderAll() {
  renderDashboard();
  renderTable();
}

async function saveDailySales() {
  const date = document.getElementById("saleDate").value;
  const company = document.getElementById("company").value;
  const amount = toAmount(document.getElementById("dailySales").value);

  if (!date) {
    alert("请选择日期");
    return;
  }

  const localRow = {
    type: "daily",
    date,
    company,
    location: "",
    amount,
    updatedAt: new Date().toISOString()
  };

  upsertLocalRow(localRow);
  document.getElementById("dailySales").value = "0.00";
  renderAll();
  showTempMsg("saveMsg");

  try {
    setSync("同步中...");
    await saveDailyToSheet(date, company, amount);
    setSync("已同步", true);
  } catch (err) {
    setSync("同步失败：" + err.message, false, true);
    alert("同步失败：" + err.message);
  }
}

function syncFairInputs() {
  const start = document.getElementById("fairStart").value;
  const end = document.getElementById("fairEnd").value;

  if (!start || !end || new Date(start) > new Date(end)) {
    document.getElementById("fairInputs").innerHTML = "";
    return;
  }

  let html = "<h3>Fair 每日营业额</h3>";

  dateRange(start, end).forEach(date => {
    const old = rows.find(r => r.type === "fair" && r.date === date);

    html += `
      <label>${date} RM</label>
      <input type="text" class="fairAmount money-input" data-date="${date}" value="${old ? formatAmount(old.amount) : "0.00"}" inputmode="decimal">
    `;
  });

  document.getElementById("fairInputs").innerHTML = html;
  attachMoneyInputs();
}

async function saveFairSales() {
  const location = document.getElementById("fairLocation").value.trim();
  const inputs = document.querySelectorAll(".fairAmount");

  if (!location) {
    alert("请输入 Fair 地点");
    return;
  }

  localStorage.setItem("lover_last_fair_location", location);

  if (inputs.length === 0) {
    alert("请选择 Fair 日期");
    return;
  }

  const records = [...inputs].map(input => ({
    date: input.dataset.date,
    amount: toAmount(input.value)
  }));

  const keepDates = records.map(r => r.date);
  removeLocalFairLocationOutsideDates(location, keepDates);

  records.forEach(item => {
    upsertLocalRow({
      type: "fair",
      date: item.date,
      company: "belimbing",
      location,
      amount: item.amount,
      updatedAt: new Date().toISOString()
    });
  });

  renderAll();
  showTempMsg("fairSaveMsg");

  try {
    setSync("同步中...");
    await saveFairToSheet(location, records);
    setSync("已同步", true);
  } catch (err) {
    setSync("同步失败：" + err.message, false, true);
    alert("Fair 同步失败：" + err.message);
  }
}

function exportCSV() {
  let csv = "\uFEFF公司,日期,类别,地点,营业额\n";
  const selected = rows.filter(r => sameMonth(r.date));

  function addSection(company, title) {
    let total = 0;
    csv += `"${title}",,,,\n`;

    selected
      .filter(r => r.type === "daily" && r.company === company)
      .sort((a,b) => String(a.date).localeCompare(String(b.date)))
      .forEach(r => {
        total += Number(r.amount || 0);
        csv += `"${title}",${r.date},"每日","",${Number(r.amount || 0).toFixed(2)}\n`;
      });

    csv += `"${title} Total",,,,${total.toFixed(2)}\n\n`;
  }

  addSection("balakong", "Lover Legend Adenium - Balakong");
  addSection("belimbing", "Lover Legend Gardening - Belimbing");

  let fairTotal = 0;
  const fairLocations = [...new Set(selected.filter(r => r.type === "fair").map(r => r.location || "Fair"))].sort();

  csv += `"Fair",,,,\n`;

  fairLocations.forEach(location => {
    let locationTotal = 0;
    csv += `"${location}",,,,\n`;

    selected
      .filter(r => r.type === "fair" && (r.location || "Fair") === location)
      .sort((a,b) => String(a.date).localeCompare(String(b.date)))
      .forEach(r => {
        locationTotal += Number(r.amount || 0);
        fairTotal += Number(r.amount || 0);
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
  const backup = {
    app: "Lover Legend Sales V4.1",
    backupAt: new Date().toISOString(),
    rows
  };

  downloadFile(
    `Sales_Backup_${todayISO()}.json`,
    JSON.stringify(backup, null, 2),
    "application/json;charset=utf-8;"
  );
}

async function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;

  backupData();

  const reader = new FileReader();

  reader.onload = async function(e) {
    try {
      const backup = JSON.parse(e.target.result);
      const restoredRows = backup.rows || [];

      if (!Array.isArray(restoredRows)) {
        alert("这个备份文件不正确。");
        return;
      }

      const ok = confirm("系统已先自动 Backup。确定恢复？Google Sheets 现有资料会被覆盖。");
      if (!ok) return;

      await restoreRowsToSheet(restoredRows);
      await loadFromSheet();
      alert("恢复完成");
    } catch (err) {
      alert("恢复失败：" + err.message);
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

function monthClose() {
  const month = selectedMonth();
  const lastDay = getLastDayOfMonth(month);
  const today = new Date();

  today.setHours(0,0,0,0);
  lastDay.setHours(0,0,0,0);

  if (today < lastDay) {
    alert(`今天不是月底，无法进行月结。\n${month} 的最后一天是 ${lastDay.getFullYear()}-${String(lastDay.getMonth()+1).padStart(2,"0")}-${String(lastDay.getDate()).padStart(2,"0")}`);
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

async function clearTestData() {
  const word = prompt("确定清空测试资料？请输入 DELETE 才能继续。");
  if (word !== "DELETE") return;

  try {
    rows = [];
    renderAll();
    await clearAllSheet();
    setSync("已清空并同步", true);
    showTempMsg("clearMsg");
  } catch (err) {
    alert("清空失败：" + err.message);
  }
}

document.getElementById("monthPicker").value = monthISO();
document.getElementById("saleDate").value = todayISO();
document.getElementById("fairStart").value = todayISO();
document.getElementById("fairEnd").value = todayISO();

const lastFairLocation = localStorage.getItem("lover_last_fair_location");
if (lastFairLocation) document.getElementById("fairLocation").value = lastFairLocation;

document.getElementById("monthPicker").addEventListener("change", renderAll);
document.getElementById("fairStart").addEventListener("change", syncFairInputs);
document.getElementById("fairEnd").addEventListener("change", syncFairInputs);

attachMoneyInputs();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

renderAll();
loadFromSheet();
