function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoToDisplay(dateText) {
  if (!dateText) return "";
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateText)) return dateText;
  const [yyyy, mm, dd] = String(dateText).split("-");
  return `${dd}-${mm}-${yyyy}`;
}
function displayToISO(dateText) {
  if (!dateText) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return dateText;
  const [dd, mm, yyyy] = String(dateText).split("-");
  return `${yyyy}-${mm}-${dd}`;
}
function monthISO() { return todayISO().slice(0, 7); }
function sameMonthDisplay(dateText, monthText) {
  const iso = displayToISO(dateText);
  return iso.slice(0, 7) === monthText;
}
function money(num) {
  return Number(num || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatAmount(num) { return money(num); }
function cleanAmount(value) { return String(value || "").replace(/,/g, "").trim(); }
function toAmount(value) { return Number(cleanAmount(value) || 0); }
function formatMoneyInput(input) { input.value = formatAmount(toAmount(input.value)); }
function moneyFocusHandler(e) { e.target.value = cleanAmount(e.target.value); if (e.target.value === "0.00" || e.target.value === "0") e.target.value = ""; }
function moneyBlurHandler(e) { formatMoneyInput(e.target); }
function enterToSaveHandler(e) { if (e.key === "Enter" && e.target.id === "dailySales") { e.preventDefault(); saveDailySales(); } }
function attachMoneyInputs() {
  document.querySelectorAll(".money-input").forEach(input => {
    input.removeEventListener("focus", moneyFocusHandler);
    input.removeEventListener("blur", moneyBlurHandler);
    input.removeEventListener("keydown", enterToSaveHandler);
    input.addEventListener("focus", moneyFocusHandler);
    input.addEventListener("blur", moneyBlurHandler);
    input.addEventListener("keydown", enterToSaveHandler);
  });
}
function dateRange(startISO, endISO) {
  const arr = [];
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);
  let current = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  while (current <= last) {
    const iso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    arr.push(isoToDisplay(iso));
    current.setDate(current.getDate() + 1);
  }
  return arr;
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
function getLastDayOfMonth(monthText) {
  const [year, month] = monthText.split("-").map(Number);
  return new Date(year, month, 0);
}
function showTempMsg(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2500);
}
function nowText() {
  return new Date().toLocaleTimeString("zh-MY", { hour: "2-digit", minute: "2-digit" });
}
