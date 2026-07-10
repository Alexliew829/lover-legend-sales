function todayISO() {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function isoToDisplay(value) {
  if (!value) return "";

  const text = String(value).trim();

  // 已经是 dd-MM-yyyy
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    return text;
  }

  // yyyy-MM-dd → dd-MM-yyyy
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}-${month}-${year}`;
  }

  return text;
}

function displayToISO(value) {
  if (!value) return "";

  const text = String(value).trim();

  // 已经是 yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  // dd-MM-yyyy → yyyy-MM-dd
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    const [day, month, year] = text.split("-");
    return `${year}-${month}-${day}`;
  }

  return text;
}

function monthISO() {
  return todayISO().slice(0, 7);
}

function currentYear() {
  return new Date().getFullYear();
}

function sameMonthDisplay(date, month) {
  return displayToISO(date).slice(0, 7) === month;
}

function sameYearDisplay(date, year) {
  return displayToISO(date).slice(0, 4) === String(year);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatAmount(value) {
  return money(value);
}

function cleanAmount(value) {
  return String(value || "")
    .replace(/,/g, "")
    .trim();
}

function toAmount(value) {
  return Number(cleanAmount(value) || 0);
}

function formatMoneyInput(input) {
  input.value = formatAmount(toAmount(input.value));
}

function moneyFocusHandler(event) {
  event.target.value = cleanAmount(event.target.value);

  if (
    event.target.value === "0.00" ||
    event.target.value === "0"
  ) {
    event.target.value = "";
  }
}

function moneyBlurHandler(event) {
  formatMoneyInput(event.target);
}

function enterToSaveHandler(event) {
  if (
    event.key === "Enter" &&
    event.target.id === "dailySales"
  ) {
    event.preventDefault();
    saveDailySales();
  }
}

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
  const dates = [];

  const [startYear, startMonth, startDay] = startISO
    .split("-")
    .map(Number);

  const [endYear, endMonth, endDay] = endISO
    .split("-")
    .map(Number);

  let current = new Date(
    startYear,
    startMonth - 1,
    startDay
  );

  const last = new Date(
    endYear,
    endMonth - 1,
    endDay
  );

  while (current <= last) {
    const iso = [
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, "0"),
      String(current.getDate()).padStart(2, "0")
    ].join("-");

    dates.push(isoToDisplay(iso));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function getLastDayOfMonth(month) {
  const [year, monthNumber] = month
    .split("-")
    .map(Number);

  return new Date(year, monthNumber, 0);
}

function showTempMsg(id) {
  const element = document.getElementById(id);

  if (!element) return;

  element.classList.remove("hidden");

  setTimeout(() => {
    element.classList.add("hidden");
  }, 2500);
}

function nowText() {
  return new Date().toLocaleTimeString("zh-MY", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normLoc(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function canonicalLocation(value) {
  let text = String(value || "").trim();

  if (!text) return "";

  text = text
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const compact = text
    .replace(/\s+/g, "")
    .toLowerCase();

  if (
    compact === "sunway" ||
    compact === "sunwaymall"
  ) {
    return "Sunway";
  }

  if (
    compact === "ioi" ||
    compact === "ioimall"
  ) {
    return "IOI";
  }

  if (
    compact === "midvalley" ||
    compact === "midvalleymall"
  ) {
    return "Mid Valley";
  }

  return text
    .split(" ")
    .map(part => {
      const lower = part.toLowerCase();

      if (lower === "ioi") {
        return "IOI";
      }

      if (
        part.length <= 3 &&
        part === part.toUpperCase()
      ) {
        return part;
      }

      return (
        part.charAt(0).toUpperCase() +
        part.slice(1).toLowerCase()
      );
    })
    .join(" ");
}

function monthAfter(month) {
  const [year, monthNumber] = month
    .split("-")
    .map(Number);

  const next = new Date(year, monthNumber, 1);

  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, "0")
  ].join("-");
}

function yearAfter(year) {
  return String(Number(year) + 1);
}

function syncKey(row) {
  return [
    row.type,
    row.date,
    row.company,
    canonicalLocation(row.location || "")
  ].join("|");
}
