// Lover Legend Sales System V49.2
// V49.2 continues from V49.1, preserving the confirmed V48.8 perfect-sync/stable sync architecture.
// Only minimal Sales Card/Fair UI-cache fixes are added; V48.8 sync cadence and authoritative revision flow remain unchanged.
// Build: 4920


const DATA_REVISION_PROPERTY_ = "lover_sales_data_revision_v142";
function getDataRevision_() {
  const properties = PropertiesService.getScriptProperties();
  const raw = properties.getProperty(DATA_REVISION_PROPERTY_);
  if (raw === null || raw === "") {
    properties.setProperty(DATA_REVISION_PROPERTY_, "1");
    return 1;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1 ? value : 1;
}
function bumpDataRevision_() {
  const next = Math.max(getDataRevision_() + 1, Date.now());
  PropertiesService.getScriptProperties().setProperty(DATA_REVISION_PROPERTY_, String(next));
  return next;
}

// V32.6 Priority Sync: only turnover + sales-card changes are foreground-critical.
const PRIORITY_TURNOVER_REV_PROP_V315_ = "lover_sales_priority_turnover_rev_v315";
const PRIORITY_CARD_REV_PROP_V315_ = "lover_sales_priority_card_rev_v315";
function getPriorityRevV315_(key){ return Number(PropertiesService.getScriptProperties().getProperty(key)||0); }
function bumpPriorityRevV315_(key){ const p=PropertiesService.getScriptProperties(),n=Number(p.getProperty(key)||0)+1;p.setProperty(key,String(n));return n; }
function bumpPriorityTurnoverV315_(){ return bumpPriorityRevV315_(PRIORITY_TURNOVER_REV_PROP_V315_); }
function bumpPriorityCardV315_(){ return bumpPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_); }
function priorityRevisionCheckV315_(){ return {ok:true,turnoverRevision:getPriorityRevV315_(PRIORITY_TURNOVER_REV_PROP_V315_),salesCardRevision:getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_),restoreGeneration:getRestoreGenerationV347_()}; }

// V46.0: small durable change journal. Other devices ask only what changed since
// their last confirmed turnover/card revisions, then fetch only those contexts.
// This avoids rescanning every Sales Card on every mobile resume while preserving
// a full-snapshot fallback when the journal can no longer cover an older device.
const SYNC_CHANGE_LOG_PROP_V456_="LL_SYNC_CHANGE_LOG_V456";
const SYNC_CHANGE_LOG_LIMIT_V456_=80;
function readSyncChangeLogV456_(){
  try{const x=JSON.parse(PropertiesService.getScriptProperties().getProperty(SYNC_CHANGE_LOG_PROP_V456_)||"[]");return Array.isArray(x)?x:[]}catch(_){return[]}
}
function appendSyncChangeV456_(kind,type,dateText,location,revision){
  const rev=Math.max(0,Number(revision||0));if(!rev)return;
  const entry={kind:String(kind||""),type:normalizeType(String(type||"")),date:String(dateText||""),location:String(location||""),revision:rev,at:Date.now()};
  const list=readSyncChangeLogV456_();list.push(entry);
  const trimmed=list.slice(-SYNC_CHANGE_LOG_LIMIT_V456_);
  try{PropertiesService.getScriptProperties().setProperty(SYNC_CHANGE_LOG_PROP_V456_,JSON.stringify(trimmed))}catch(_){}
}
function priorityRevisionCheckV456_(p){
  const turnoverRevision=getPriorityRevV315_(PRIORITY_TURNOVER_REV_PROP_V315_),salesCardRevision=getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_);
  const lastTurn=Math.max(0,Number(p&&p.lastTurnoverRevision||0)),lastCard=Math.max(0,Number(p&&p.lastSalesCardRevision||0));
  const log=readSyncChangeLogV456_();
  const changes=log.filter(x=>x&&((x.kind==='turnover'&&Number(x.revision||0)>lastTurn)||(x.kind==='card'&&Number(x.revision||0)>lastCard)));
  const minTurn=Math.min.apply(null,log.filter(x=>x&&x.kind==='turnover').map(x=>Number(x.revision||0)).concat([turnoverRevision+1]));
  const minCard=Math.min.apply(null,log.filter(x=>x&&x.kind==='card').map(x=>Number(x.revision||0)).concat([salesCardRevision+1]));
  const deltaComplete=(lastTurn===turnoverRevision||lastTurn>=minTurn-1)&&(lastCard===salesCardRevision||lastCard>=minCard-1);
  return{ok:true,dataRevision:getDataRevision_(),turnoverRevision,salesCardRevision,restoreGeneration:getRestoreGenerationV347_(),changes,deltaComplete};
}
function salesCardRevisionConflictV456_(expectedRevision,type,dateText,location,currentRevision){
  const expected=Math.max(0,Number(expectedRevision||0)),current=Math.max(0,Number(currentRevision||0));
  if(expected===current)return false;
  const cardLog=readSyncChangeLogV456_().filter(x=>x&&x.kind==='card').sort((a,b)=>Number(a.revision||0)-Number(b.revision||0));
  if(!cardLog.length)return true;
  const minRevision=Number(cardLog[0].revision||0);
  if(expected<minRevision-1)return true; // journal cannot prove safety
  const wantType=normalizeType(String(type||'')),wantDate=String(dateText||''),wantLoc=String(location||'').trim().toLowerCase();
  return cardLog.some(x=>Number(x.revision||0)>expected&&normalizeType(String(x.type||''))===wantType&&String(x.date||'')===wantDate&&String(x.location||'').trim().toLowerCase()===wantLoc);
}
function revisionCheckV142_() {
  // V46.0: one lightweight global revision endpoint covers every cloud write.
  // The client can detect any cross-device change without downloading month data.
  return {
    ok:true,
    dataRevision:getDataRevision_(),
    version:DATA_VERSION_V8,
    turnoverRevision:getPriorityRevV315_(PRIORITY_TURNOVER_REV_PROP_V315_),
    salesCardRevision:getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_),
    restoreGeneration:getRestoreGenerationV347_()
  };
}

const LOAD_CACHE_KEY = "lover_sales_load_v129";
const LOAD_CACHE_SECONDS = 600;

function getLoadCache() {
  try {
    const text = CacheService.getScriptCache().get(LOAD_CACHE_KEY);
    return text ? JSON.parse(text) : null;
  } catch (err) {
    return null;
  }
}

function saveLoadCache(payload) {
  try {
    const text = JSON.stringify(payload);
    if (text.length < 95000) {
      CacheService.getScriptCache().put(LOAD_CACHE_KEY, text, LOAD_CACHE_SECONDS);
    }
  } catch (err) {}
}

function clearLoadCacheForPeriods(months) {
  try {
    const cache = CacheService.getScriptCache();
    const keys = [LOAD_CACHE_KEY];
    (months || []).forEach(month => {
      const m = String(month || "");
      if (!/^\d{4}-\d{2}$/.test(m)) return;
      keys.push(LOAD_CACHE_KEY + "_month_" + m);
      keys.push(LOAD_CACHE_KEY + "_year_" + m.slice(0, 4));
    });
    [...new Set(keys)].forEach(key => cache.remove(key));
  } catch (err) {}
}

function clearLoadCache() {
  const current = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  clearLoadCacheForPeriods([current]);
}



function monthSheetName(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM");
}

function getMonthlySheet(date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = monthSheetName(date);
  let sheet = ss.getSheetByName(name);

  if (!sheet) sheet = ss.insertSheet(name);
  ensureHeader(sheet);
  return sheet;
}

function ensureHeader(sheet) {
  const expected = ["类型", "日期", "公司", "地点", "营业额", "更新时间"];
  const current = sheet.getRange(1, 1, 1, 6).getDisplayValues()[0];
  const needsHeader = expected.some((value, index) => String(current[index] || "") !== value);

  if (needsHeader) {
    sheet.getRange(1, 1, 1, 6).setValues([expected]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 6)
      .setFontWeight("bold")
      .setBackground("#0b6b2b")
      .setFontColor("#ffffff");
  }
}

function formatSheet(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 6)
    .setFontWeight("bold")
    .setBackground("#0b6b2b")
    .setFontColor("#ffffff");

  if (lastRow > 1) {
    sheet.getRange(2, 2, lastRow - 1, 1).setNumberFormat("dd-MM-yyyy");
    sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat("#,##0.00");
    sheet.getRange(2, 6, lastRow - 1, 1).setNumberFormat("dd-MM-yyyy HH:mm");
  }

}

function normalizeRow(row) {
  const date = parseDateFromApp(row[1]);
  if (!row[0] || !date) return null;

  return {
    type: normalizeType(String(row[0] || "")),
    date: formatDateForApp(date),
    company: normalizeCompany(String(row[2] || "")),
    location: normalizeType(String(row[0] || "")) === "live"
      ? canonicalLiveHost(String(row[3] || ""))
      : canonicalLocation(String(row[3] || "")),
    amount: Number(row[4] || 0),
    updatedAt: row[5] instanceof Date&&!isNaN(row[5].getTime())
      ? row[5].toISOString()
      : formatDateTimeForApp(row[5])
  };
}

function normalizeFairLocationKey(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
}

function rowKey(row) {
  const locationKey = row.type === "live"
    ? String(row.location || "").replace(/\s+/g, "").toLowerCase()
    : normalizeFairLocationKey(row.location || "");
  const companyKey = row.type === "fair" ? "fair" : row.company;
  return [row.type, row.date, companyKey, locationKey].join("|");
}

function newerRow(a, b) {
  const aTime = parseDateTimeFromApp(a.updatedAt);
  const bTime = parseDateTimeFromApp(b.updatedAt);

  if (aTime && bTime) return aTime.getTime() >= bTime.getTime() ? a : b;
  if (bTime) return b;
  return a;
}

function loadData() {
  const cached = getLoadCache();
  if (cached) return cached;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const map = {};
  const priority = {};

  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    const isMonthly = /^\d{4}-\d{2}$/.test(name);
    const isLegacyYear = /^\d{4}$/.test(name);

    if (!isMonthly && !isLegacyYear) return;

    const sourcePriority = isMonthly ? 2 : 1;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

    values.forEach(raw => {
      const row = normalizeRow(raw);
      if (!row) return;

      const key = rowKey(row);

      if (!map[key]) {
        map[key] = row;
        priority[key] = sourcePriority;
      } else if (sourcePriority > priority[key]) {
        map[key] = row;
        priority[key] = sourcePriority;
      } else if (sourcePriority === priority[key]) {
        map[key] = newerRow(map[key], row);
      }
    });
  });

  const result = {
    ok: true,
    rows: Object.keys(map).map(key => map[key]),
    commissionSettings: getCommissionSettingsCloud(),
    accessSettings: getAccessSettingsCloud()
  };

  saveLoadCache(result);
  return result;
}

const DEFAULT_COMMISSION_SETTINGS_CLOUD = {
  rate1: 6,
  rate2: 7,
  rate3: 8,
  liveHostRates: {},
  liveHosts: {},
  inactiveLiveHosts: {}
};

function getSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Settings");
  let changed = false;

  if (!sheet) {
    sheet = ss.insertSheet("Settings");
    sheet.getRange(1, 1, 1, 2).setValues([["设置", "数值"]]);
    sheet.getRange(2, 1, 5, 2).setValues([
      ["commission_rate_1", 6],
      ["commission_rate_2", 7],
      ["commission_rate_3", 8],
      ["access_password_hash", "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"],
      ["access_password_hint", "6个数字"]
    ]);
    changed = true;
  }

  if (ensureCommissionSettingsRows(sheet)) changed = true;
  if (changed) formatSettingsSheet(sheet);

  return sheet;
}

function formatSettingsSheet(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 2)
    .setFontWeight("bold")
    .setBackground("#0b6b2b")
    .setFontColor("#ffffff");

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).setNumberFormat("0.##");
  }

}

function ensureCommissionSettingsRows(sheet) {
  const lastRow = sheet.getLastRow();
  const values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 2).getValues()
    : [];

  const existing = {};
  values.forEach((row, index) => {
    existing[String(row[0] || "").trim()] = index + 2;
  });

  const defaults = [
    ["commission_rate_1", 6],
    ["commission_rate_2", 7],
    ["commission_rate_3", 8],
    ["access_password_hash", "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"],
    ["access_password_hint", "6个数字"]
  ];

  const missing = defaults.filter(item => !existing[item[0]]);

  if (missing.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, 2).setValues(missing);
    return true;
  }

  return false;
}


const DEFAULT_ACCESS_PASSWORD_HASH_CLOUD =
  "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
const DEFAULT_ACCESS_PASSWORD_HINT_CLOUD = "6个数字";

function getSettingsValuesFast_(sheet) {
  const lastRow = sheet.getLastRow();
  return lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 2).getValues()
    : [];
}


const COMMISSION_SETTINGS_JSON_KEY_ = "commission_settings_json";

function liveScheduleMonthCloud_(item) {
  const startDate = String(item && item.startDate || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate.substring(0, 7) : "";
}

function monthLastISOCloud_(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ""))) return "";
  const parts = month.split("-").map(Number);
  const lastDay = new Date(parts[0], parts[1], 0).getDate();
  return month + "-" + String(lastDay).padStart(2, "0");
}

function normalizeCommissionSettingsPayload_(payload) {
  const source = payload || {};
  const rate1 = Number(source.rate1);
  const rate2 = Number(source.rate2);
  const rate3 = Number(source.rate3);
  const fairRevision = Number.isFinite(Number(source.fairRevision)) && Number(source.fairRevision) >= 0 ? Number(source.fairRevision) : 0;
  const liveRevision = Number.isFinite(Number(source.liveRevision)) && Number(source.liveRevision) >= 0 ? Number(source.liveRevision) : 0;
  if (![rate1, rate2, rate3].every(Number.isFinite) || rate1 < 0 || rate2 < 0 || rate3 < 0) {
    throw new Error("Invalid commission settings");
  }

  const liveHostRates = {};
  Object.entries(source.liveHostRates || {}).forEach(([key, value]) => {
    const hostKey = String(key || "").replace(/\s+/g, "").toLowerCase();
    const rate = Number(value);
    if (hostKey && Number.isFinite(rate) && rate >= 0) liveHostRates[hostKey] = rate;
  });

  const liveHosts = {};
  const inactiveLiveHosts = {};
  Object.entries(source.liveHosts || {}).forEach(([key, value]) => {
    const hostKey = String(key || "").replace(/\s+/g, "").toLowerCase();
    const hostName = String(value || "").trim().replace(/\s+/g, " ");
    if (hostKey && hostName) liveHosts[hostKey] = hostName;
  });

  Object.entries(source.inactiveLiveHosts || {}).forEach(([key, value]) => {
    const hostKey = String(key || "").replace(/\s+/g, "").toLowerCase();
    const hostName = String(value || "").trim().replace(/\s+/g, " ");
    if (hostKey && hostName && !liveHosts[hostKey]) inactiveLiveHosts[hostKey] = hostName;
  });

  Object.keys(liveHostRates).forEach(key => {
    if (!liveHosts[key] && !inactiveLiveHosts[key]) liveHosts[key] = key.charAt(0).toUpperCase() + key.slice(1);
  });

  const liveRateSchedules = (Array.isArray(source.liveRateSchedules) ? source.liveRateSchedules : [])
    .map((item, index) => {
      const startDate = String(item && item.startDate || "");
      const endDate = String(item && item.endDate || "");
      const rate = Number(item && item.rate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
          (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) ||
          (endDate && endDate < startDate) ||
          !Number.isFinite(rate) ||
          rate < 0) return null;
      return {
        id: String(item.id || (startDate + "_" + endDate + "_" + index)),
        startDate,
        endDate,
        rate
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));

  liveRateSchedules.forEach(item => {
    const month = liveScheduleMonthCloud_(item);
    if (!month) throw new Error("Invalid Live commission start date");
    if (item.endDate && item.endDate.substring(0, 7) !== month) {
      throw new Error("Live commission date range cannot cross month");
    }
  });

  for (let i = 0; i < liveRateSchedules.length - 1; i++) {
    const current = liveRateSchedules[i];
    const next = liveRateSchedules[i + 1];
    const currentMonth = liveScheduleMonthCloud_(current);
    if (currentMonth !== liveScheduleMonthCloud_(next)) continue;
    const currentEnd = current.endDate || monthLastISOCloud_(currentMonth);
    if (currentEnd >= next.startDate) {
      throw new Error("Live commission date ranges overlap");
    }
  }

  return { rate1, rate2, rate3, liveHostRates, liveHosts, inactiveLiveHosts, liveRateSchedules, fairRevision, liveRevision };
}

function commissionSettingsFromValues_(values) {
  let jsonSettings = null;
  const map = {};
  const liveHostRates = {};
  const liveHosts = {};
  const inactiveLiveHosts = {};

  (values || []).forEach(row => {
    const key = String(row[0] || "").trim();
    const rawValue = row[1];
    if (!key) return;

    if (key === COMMISSION_SETTINGS_JSON_KEY_) {
      try {
        jsonSettings = normalizeCommissionSettingsPayload_(
          JSON.parse(String(rawValue || "{}"))
        );
      } catch (err) {}
      return;
    }

    map[key] = rawValue;
    if (key.indexOf("live_host_rate::") === 0) {
      const hostKey = key.substring("live_host_rate::".length);
      const rate = Number(rawValue);
      if (hostKey && Number.isFinite(rate)) liveHostRates[hostKey] = rate;
    } else if (key.indexOf("live_host_name::") === 0) {
      const hostKey = key.substring("live_host_name::".length);
      const hostName = String(rawValue || "").trim().replace(/\s+/g, " ");
      if (hostKey && hostName) liveHosts[hostKey] = hostName;
    }
  });

  if (jsonSettings) return jsonSettings;

  return normalizeCommissionSettingsPayload_({
    rate1: Number.isFinite(Number(map.commission_rate_1)) ? Number(map.commission_rate_1) : 6,
    rate2: Number.isFinite(Number(map.commission_rate_2)) ? Number(map.commission_rate_2) : 7,
    rate3: Number.isFinite(Number(map.commission_rate_3)) ? Number(map.commission_rate_3) : 8,
    liveHostRates,
    liveHosts,
    inactiveLiveHosts,
    liveRateSchedules: []
  });
}

function upsertSettingValueFast_(sheet, key, value, existingValues) {
  const values = existingValues || getSettingsValuesFast_(sheet);
  const index = values.findIndex(row => String(row[0] || "").trim() === key);
  if (index >= 0) {
    sheet.getRange(index + 2, 2).setValue(value);
    return index + 2;
  }
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 2).setValues([[key, value]]);
  return row;
}


function upsertSettingValuesBatchFast_(sheet, entries, existingValues) {
  const values = (existingValues || getSettingsValuesFast_(sheet)).map(row => [row[0], row[1]]);
  const indexByKey = {};
  values.forEach((row, index) => {
    const key = String(row[0] || "").trim();
    if (key) indexByKey[key] = index;
  });

  (entries || []).forEach(entry => {
    const key = String(entry && entry[0] || "").trim();
    if (!key) return;
    const value = entry[1];
    if (Object.prototype.hasOwnProperty.call(indexByKey, key)) {
      values[indexByKey[key]][1] = value;
    } else {
      indexByKey[key] = values.length;
      values.push([key, value]);
    }
  });

  if (sheet.getMaxRows() < values.length + 1) {
    sheet.insertRowsAfter(sheet.getMaxRows(), values.length + 1 - sheet.getMaxRows());
  }
  if (values.length) sheet.getRange(2, 1, values.length, 2).setValues(values);
  return values;
}

function saveCommissionSnapshotFast_(sheet, targetMonth, settings, existingValues) {
  if (!targetMonth) return;
  upsertSettingValueFast_(
    sheet,
    "month_commission::" + targetMonth,
    JSON.stringify(settings),
    existingValues
  );
}

function parseCommissionPayloadFromRequest_(p) {
  let liveHostRates = {};
  let liveHosts = {};
  let inactiveLiveHosts = {};
  let liveRateSchedules = [];
  try { liveHostRates = JSON.parse(String(p.liveHostRates || "{}")); } catch (err) {}
  try { liveHosts = JSON.parse(String(p.liveHosts || "{}")); } catch (err) {}
  try { inactiveLiveHosts = JSON.parse(String(p.inactiveLiveHosts || "{}")); } catch (err) {}
  try { liveRateSchedules = JSON.parse(String(p.liveRateSchedules || "[]")); } catch (err) {}

  return normalizeCommissionSettingsPayload_({
    rate1: Number(p.rate1),
    rate2: Number(p.rate2),
    rate3: Number(p.rate3),
    liveHostRates,
    liveHosts,
    inactiveLiveHosts,
    liveRateSchedules,
    fairRevision: Number(p.fairRevision || 0),
    liveRevision: Number(p.liveRevision || 0)
  });
}

function saveFairCommissionFastCloud_(p) {
  const incoming = parseCommissionPayloadFromRequest_(p);
  const targetMonth = /^\d{4}-\d{2}$/.test(String(p.targetMonth || ""))
    ? String(p.targetMonth)
    : "";

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error("系统正在同步其他设置，请稍后再试");

  try {
    const sheet = getSettingsSheet();
    const values = getSettingsValuesFast_(sheet);
    const current = commissionSettingsFromValues_(values);
    if (Number(incoming.fairRevision || 0) < Number(current.fairRevision || 0)) {
      return { ok: true, commissionSettings: current, fastWrite: true, staleIgnored: true };
    }
    const settings = normalizeCommissionSettingsPayload_({
      ...current,
      rate1: incoming.rate1,
      rate2: incoming.rate2,
      rate3: incoming.rate3,
      fairRevision: incoming.fairRevision
    });

    const writes = [[COMMISSION_SETTINGS_JSON_KEY_, JSON.stringify(settings)]];
    if (targetMonth) writes.push(["month_commission::" + targetMonth, JSON.stringify(settings)]);
    upsertSettingValuesBatchFast_(sheet, writes, values);
    clearLoadCacheForPeriods(targetMonth ? [targetMonth] : []);

    return { ok: true, commissionSettings: settings, fastWrite: true, dataRevision: bumpDataRevision_() };
  } finally {
    lock.releaseLock();
  }
}

function saveLiveCommissionFastCloud_(p) {
  const incoming = parseCommissionPayloadFromRequest_(p);
  const targetMonth = /^\d{4}-\d{2}$/.test(String(p.targetMonth || ""))
    ? String(p.targetMonth)
    : "";

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) throw new Error("系统正在同步其他设置，请稍后再试");

  try {
    const sheet = getSettingsSheet();
    const values = getSettingsValuesFast_(sheet);
    const current = commissionSettingsFromValues_(values);
    if (Number(incoming.liveRevision || 0) < Number(current.liveRevision || 0)) {
      return { ok: true, commissionSettings: current, fastWrite: true, staleIgnored: true };
    }
    const settings = normalizeCommissionSettingsPayload_({
      ...current,
      liveHostRates: incoming.liveHostRates,
      liveHosts: incoming.liveHosts,
      inactiveLiveHosts: incoming.inactiveLiveHosts,
      liveRateSchedules: incoming.liveRateSchedules,
      liveRevision: incoming.liveRevision
    });

    const writes = [[COMMISSION_SETTINGS_JSON_KEY_, JSON.stringify(settings)]];
    if (targetMonth) writes.push(["month_commission::" + targetMonth, JSON.stringify(settings)]);
    upsertSettingValuesBatchFast_(sheet, writes, values);
    clearLoadCacheForPeriods(targetMonth ? [targetMonth] : []);

    return { ok: true, commissionSettings: settings, fastWrite: true, dataRevision: bumpDataRevision_() };
  } finally {
    lock.releaseLock();
  }
}

function buildSettingsSnapshotFromValues_(values) {
  const map = {};
  const liveHostRates = {};
  const liveHosts = {};
  const closedMonths = [];
  const commissionSnapshots = {};

  (values || []).forEach(row => {
    const key = String(row[0] || "").trim();
    const rawValue = row[1];
    if (!key) return;

    map[key] = rawValue;

    if (key.indexOf("live_host_rate::") === 0) {
      const hostKey = key.substring("live_host_rate::".length);
      const rate = Number(rawValue);
      if (hostKey && Number.isFinite(rate)) liveHostRates[hostKey] = rate;
      return;
    }

    if (key.indexOf("live_host_name::") === 0) {
      const hostKey = key.substring("live_host_name::".length);
      const hostName = String(rawValue || "").trim().replace(/\s+/g, " ");
      if (hostKey && hostName) liveHosts[hostKey] = hostName;
      return;
    }

    if (key.indexOf("closed_month::") === 0) {
      const month = key.substring("closed_month::".length);
      if (/^\d{4}-\d{2}$/.test(month)) closedMonths.push(month);
      return;
    }

    if (key.indexOf("month_commission::") === 0) {
      const month = key.substring("month_commission::".length);
      try {
        commissionSnapshots[month] = JSON.parse(String(rawValue || "{}"));
      } catch (err) {}
    }
  });

  closedMonths.sort();

  const commissionSettings = commissionSettingsFromValues_(values);

  return {
    commissionSettings,
    accessSettings: {
      accessPasswordHash: String(map.access_password_hash || DEFAULT_ACCESS_PASSWORD_HASH_CLOUD),
      accessPasswordHint: String(map.access_password_hint || DEFAULT_ACCESS_PASSWORD_HINT_CLOUD)
    },
    systemState: {
      dataVersion: DATA_VERSION_V8,
      currentMonth: currentMonthV8(),
      closedMonths,
      commissionSnapshots
    }
  };
}

function getSettingsSnapshotFast_() {
  const sheet = getSettingsSheet();
  return buildSettingsSnapshotFromValues_(getSettingsValuesFast_(sheet));
}

function replaceSettingsDataFast_(sheet, data) {
  if (sheet.getMaxRows() < data.length) {
    sheet.insertRowsAfter(sheet.getMaxRows(), data.length - sheet.getMaxRows());
  }
  const clearRows = Math.max(sheet.getLastRow(), data.length);
  if (clearRows > 0) sheet.getRange(1, 1, clearRows, 2).clearContent();
  sheet.getRange(1, 1, data.length, 2).setValues(data);
}

function acquireSettingsLock_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error("系统正在同步其他资料，请稍后再试");
  }
  return lock;
}

function getAccessSettingsCloud() {
  const sheet = getSettingsSheet();
  const lastRow = sheet.getLastRow();
  const values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 2).getValues()
    : [];
  const map = {};
  values.forEach(row => {
    map[String(row[0] || "").trim()] = String(row[1] || "").trim();
  });
  return {
    accessPasswordHash:
      map.access_password_hash ||
      DEFAULT_ACCESS_PASSWORD_HASH_CLOUD,
    accessPasswordHint:
      map.access_password_hint ||
      DEFAULT_ACCESS_PASSWORD_HINT_CLOUD
  };
}

function saveAccessSettingsCloud(p) {
  const hash = String(p.accessPasswordHash || "").trim().toLowerCase();
  const hint = String(p.accessPasswordHint || "").trim();

  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid password hash");
  if (!hint || hint.length > 100) throw new Error("Invalid password hint");

  const lock = acquireSettingsLock_();
  try {
    const sheet = getSettingsSheet();
    const existing = getSettingsValuesFast_(sheet);
    const map = new Map();
    existing.forEach(row => {
      const key = String(row[0] || "").trim();
      if (key) map.set(key, row[1]);
    });
    map.set("data_version", DATA_VERSION_V8);
    map.set("access_password_hash", hash);
    map.set("access_password_hint", hint);

    const ordered = [
      ["设置", "数值"],
      ["data_version", map.get("data_version") || DATA_VERSION_V8],
      ["commission_rate_1", map.has("commission_rate_1") ? map.get("commission_rate_1") : 6],
      ["commission_rate_2", map.has("commission_rate_2") ? map.get("commission_rate_2") : 7],
      ["commission_rate_3", map.has("commission_rate_3") ? map.get("commission_rate_3") : 8],
      ["access_password_hash", hash],
      ["access_password_hint", hint]
    ];
    const fixed = new Set(ordered.slice(1).map(row => row[0]));
    existing.forEach(row => {
      const key = String(row[0] || "").trim();
      if (key && !fixed.has(key)) ordered.push([row[0], row[1]]);
    });

    replaceSettingsDataFast_(sheet, ordered);
    clearLoadCache();
    return {
      ok: true,
      accessSettings: {
        accessPasswordHash: hash,
        accessPasswordHint: hint
      },
      dataRevision: bumpDataRevision_()
    };
  } finally {
    lock.releaseLock();
  }
}
function getCommissionSettingsCloud() {
  const sheet = getSettingsSheet();
  return commissionSettingsFromValues_(getSettingsValuesFast_(sheet));
}
function saveCommissionSettingsCloud(p) {
  const rate1 = Number(p.rate1);
  const rate2 = Number(p.rate2);
  const rate3 = Number(p.rate3);
  const targetMonth = /^\d{4}-\d{2}$/.test(String(p.targetMonth || "")) ? String(p.targetMonth) : "";
  const fairRevision = Number.isFinite(Number(p.fairRevision)) && Number(p.fairRevision) >= 0 ? Number(p.fairRevision) : 0;
  const liveRevision = Number.isFinite(Number(p.liveRevision)) && Number(p.liveRevision) >= 0 ? Number(p.liveRevision) : 0;
  let liveHostRates = {};
  let liveHosts = {};
  let inactiveLiveHosts = {};
  try { liveHostRates = JSON.parse(String(p.liveHostRates || "{}")); } catch (err) {}
  try { liveHosts = JSON.parse(String(p.liveHosts || "{}")); } catch (err) {}
  try { inactiveLiveHosts = JSON.parse(String(p.inactiveLiveHosts || "{}")); } catch (err) {}

  if (![rate1, rate2, rate3].every(Number.isFinite) || rate1 < 0 || rate2 < 0 || rate3 < 0) {
    throw new Error("Invalid commission settings");
  }

  const normalizedHostRates = {};
  Object.entries(liveHostRates).forEach(([key, value]) => {
    const hostKey = String(key || "").replace(/\s+/g, "").toLowerCase();
    const rate = Number(value);
    if (hostKey && Number.isFinite(rate) && rate >= 0) normalizedHostRates[hostKey] = rate;
  });
  const normalizedHosts = {};
  Object.entries(liveHosts || {}).forEach(([key, value]) => {
    const hostKey = String(key || "").replace(/\s+/g, "").toLowerCase();
    const hostName = String(value || "").trim().replace(/\s+/g, " ");
    if (hostKey && hostName) normalizedHosts[hostKey] = hostName;
  });
  const normalizedInactiveHosts = {};
  Object.entries(inactiveLiveHosts || {}).forEach(([key, value]) => {
    const hostKey = String(key || "").replace(/\s+/g, "").toLowerCase();
    const hostName = String(value || "").trim().replace(/\s+/g, " ");
    if (hostKey && hostName && !normalizedHosts[hostKey]) normalizedInactiveHosts[hostKey] = hostName;
  });
  Object.keys(normalizedHostRates).forEach(key => {
    if (!normalizedHosts[key] && !normalizedInactiveHosts[key]) normalizedHosts[key] = key.charAt(0).toUpperCase() + key.slice(1);
  });

  let liveRateSchedules = [];
  try { liveRateSchedules = JSON.parse(String(p.liveRateSchedules || "[]")); } catch (err) {}
  const settings = normalizeCommissionSettingsPayload_({
    rate1,
    rate2,
    rate3,
    liveHostRates: normalizedHostRates,
    liveHosts: normalizedHosts,
    inactiveLiveHosts: normalizedInactiveHosts,
    liveRateSchedules,
    fairRevision,
    liveRevision
  });
  const lock = acquireSettingsLock_();
  try {
    const sheet = getSettingsSheet();
    const existing = getSettingsValuesFast_(sheet);
    const preserved = [];

    existing.forEach(row => {
      const key = String(row[0] || "");
      if (!key || key === "设置" || key === "data_version") return;
      if (key === "commission_rate_1" || key === "commission_rate_2" || key === "commission_rate_3") return;
      if (key.indexOf("live_host_rate::") === 0) return;
      if (key.indexOf("live_host_name::") === 0) return;
      if (targetMonth && key === "month_commission::" + targetMonth) return;
      preserved.push([row[0], row[1]]);
    });

    const data = [
      ["设置", "数值"],
      ["data_version", DATA_VERSION_V8],
      ["commission_rate_1", rate1],
      ["commission_rate_2", rate2],
      ["commission_rate_3", rate3]
    ];
    Object.entries(normalizedHosts).sort((a,b)=>a[0].localeCompare(b[0]))
      .forEach(([key,name]) => data.push(["live_host_name::" + key, name]));
    Object.entries(normalizedHostRates).sort((a,b)=>a[0].localeCompare(b[0]))
      .forEach(([key,rate]) => data.push(["live_host_rate::" + key, rate]));
    preserved.forEach(row => data.push(row));
    if (targetMonth) data.push(["month_commission::" + targetMonth, JSON.stringify(settings)]);

    replaceSettingsDataFast_(sheet, data);
    clearLoadCache();
    return { ok:true, commissionSettings:settings, dataRevision:bumpDataRevision_() };
  } finally {
    lock.releaseLock();
  }
}
function resetCommissionSettingsCloud() {
  return saveCommissionSettingsCloud(DEFAULT_COMMISSION_SETTINGS_CLOUD);
}



// V14.8 OneSignal Push Notification
function formatMoneyNotification_(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}




const PUSH_DEVICE_REGISTRY_V185_="LOVER_SALES_PUSH_DEVICE_REGISTRY_V185";
const PUSH_DEVICE_REGISTRY_BACKUP_V185_="LOVER_SALES_PUSH_DEVICE_REGISTRY_PRE_V185_BACKUP";
const PUSH_DEVICE_REGISTRY_INIT_V185_="LOVER_SALES_PUSH_DEVICE_REGISTRY_V185_INITIALIZED";
const PUSH_DEVICE_STALE_MS_V185_=30*24*60*60*1000;

function normalizePushDeviceV185_(item,now){
  if(!item||typeof item!=="object")return null;
  const subscriptionId=String(item.subscriptionId||item.id||"").trim();
  const deviceKey=String(item.deviceKey||"").trim();
  if(!subscriptionId||!deviceKey)return null;
  return{
    deviceKey,
    subscriptionId,
    installationId:String(item.installationId||""),
    onesignalUserId:String(item.onesignalUserId||""),
    firstSeen:Number(item.firstSeen||now),
    lastSeen:Number(item.lastSeen||now),
    clientVersion:String(item.clientVersion||"")
  };
}

function ensurePushDeviceRegistryV185_(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty(PUSH_DEVICE_REGISTRY_INIT_V185_)==="1")return;

  // Preserve all pre-V18.7 data for safety, but DO NOT use it for sending.
  const backup={
    at:new Date().toISOString(),
    v183:props.getProperty("LOVER_SALES_PUSH_SUBSCRIPTIONS_V183")||"",
    v184:props.getProperty("LOVER_SALES_PUSH_SUBSCRIPTIONS_V18.7")||"",
    legacy:props.getProperty("LOVER_SALES_PUSH_SUBSCRIPTIONS_V18.2")||""
  };
  props.setProperty(PUSH_DEVICE_REGISTRY_BACKUP_V185_,JSON.stringify(backup));
  props.setProperty(PUSH_DEVICE_REGISTRY_V185_,"[]");
  props.setProperty(PUSH_DEVICE_REGISTRY_INIT_V185_,"1");
}

function loadPushDevicesV185_(){
  ensurePushDeviceRegistryV185_();
  const props=PropertiesService.getScriptProperties();
  const now=Date.now();
  try{
    const list=JSON.parse(props.getProperty(PUSH_DEVICE_REGISTRY_V185_)||"[]");
    return Array.isArray(list)
      ?list.map(x=>normalizePushDeviceV185_(x,now)).filter(Boolean)
      :[];
  }catch(e){return[]}
}

function savePushDevicesV185_(entries){
  ensurePushDeviceRegistryV185_();
  const now=Date.now();

  // DeviceKey is the physical-device identity. Keep newest entry only.
  const byDevice={};
  (entries||[]).forEach(item=>{
    const e=normalizePushDeviceV185_(item,now);
    if(!e)return;
    const old=byDevice[e.deviceKey];
    if(!old||e.lastSeen>=old.lastSeen)byDevice[e.deviceKey]=e;
  });

  // Defensive second dedupe by Subscription ID.
  const bySubscription={};
  Object.values(byDevice).forEach(e=>{
    const old=bySubscription[e.subscriptionId];
    if(!old||e.lastSeen>=old.lastSeen)bySubscription[e.subscriptionId]=e;
  });

  const clean=Object.values(bySubscription)
    .filter(e=>!e.lastSeen||now-e.lastSeen<=PUSH_DEVICE_STALE_MS_V185_)
    .sort((a,b)=>b.lastSeen-a.lastSeen);

  PropertiesService.getScriptProperties().setProperty(
    PUSH_DEVICE_REGISTRY_V185_,
    JSON.stringify(clean)
  );
  return clean;
}

function getRegisteredPushSubscriptionsV185_(){
  return savePushDevicesV185_(loadPushDevicesV185_()).map(e=>e.subscriptionId);
}

function registerPushSubscriptionV185_(p){
  const subscriptionId=String(p.subscriptionId||"").trim();
  const deviceKey=String(p.deviceKey||"").trim();
  const installationId=String(p.installationId||"").trim();
  const onesignalUserId=String(p.onesignalUserId||"").trim();
  const clientVersion=String(p.clientVersion||"");
  if(!subscriptionId)return{ok:false,message:"Missing subscriptionId"};
  if(!deviceKey)return{ok:false,message:"Missing deviceKey"};

  const now=Date.now();
  let devices=loadPushDevicesV185_();

  // Same physical device: always replace previous Subscription ID.
  devices=devices.filter(e=>e.deviceKey!==deviceKey);

  // V29.9 stable baseline:
  // OneSignal User ID is a USER identity and may legitimately own multiple
  // push subscriptions (for example one phone + one desktop browser).
  // Therefore never use onesignalUserId to remove another physical device.
  // installationId is local to one browser/PWA install, so it is still safe
  // to replace an older subscription for the same installation.
  if(installationId)devices=devices.filter(e=>!e.installationId||e.installationId!==installationId);

  devices.push({
    deviceKey,
    subscriptionId,
    installationId,
    onesignalUserId,
    firstSeen:now,
    lastSeen:now,
    clientVersion
  });

  devices=savePushDevicesV185_(devices);
  console.log("V18.7 device registered:",JSON.stringify({
    deviceKey:deviceKey.slice(0,10),
    subscriptionId:subscriptionId.slice(0,8),
    totalDevices:devices.length
  }));

  return{
    ok:true,
    count:devices.length,
    registered:devices.some(e=>e.deviceKey===deviceKey&&e.subscriptionId===subscriptionId),
    deviceKeyPrefix:deviceKey.slice(0,10),
    subscriptionIdPrefix:subscriptionId.slice(0,8)
  };
}

function pushSubscriptionStatusV185_(p){
  const subscriptionId=String(p&&p.subscriptionId||"").trim();
  const deviceKey=String(p&&p.deviceKey||"").trim();
  const installationId=String(p&&p.installationId||"").trim();

  const devices=savePushDevicesV185_(loadPushDevicesV185_());
  const registered=devices.some(e=>{
    if(deviceKey&&e.deviceKey===deviceKey){
      return !subscriptionId||e.subscriptionId===subscriptionId;
    }
    if(installationId&&e.installationId===installationId){
      return !subscriptionId||e.subscriptionId===subscriptionId;
    }
    return false;
  });

  return{
    ok:true,
    count:devices.length,
    registered
  };
}

function cleanupPushSubscriptionsNowV185(){
  const before=loadPushDevicesV185_();
  const after=savePushDevicesV185_(before);
  return{
    ok:true,
    before:before.length,
    remaining:after.length,
    removed:Math.max(0,before.length-after.length)
  };
}

function resetPushDeviceRegistryV185(){
  const props=PropertiesService.getScriptProperties();
  const current=props.getProperty(PUSH_DEVICE_REGISTRY_V185_)||"[]";
  props.setProperty(
    "LOVER_SALES_PUSH_DEVICE_REGISTRY_V185_MANUAL_BACKUP_"+Date.now(),
    current
  );
  props.setProperty(PUSH_DEVICE_REGISTRY_V185_,"[]");
  props.setProperty(PUSH_DEVICE_REGISTRY_INIT_V185_,"1");
  return{ok:true,remaining:0};
}

function getOneSignalCredentialsV180_() {
  const props = PropertiesService.getScriptProperties();
  return {
    appId:
      props.getProperty("ONESIGNAL_APP_ID") ||
      "c6c0be13-4f8e-42cf-8567-efde17a483b3",
    apiKey:
      props.getProperty("ONESIGNAL_API_KEY") ||
      props.getProperty("ONESIGNAL_REST_API_KEY") ||
      props.getProperty("ONESIGNAL_APP_API_KEY") ||
      ""
  };
}

function sendOneSignalRequestV181_(appId, apiKey, title, message, subscriptionIds, launchUrl) {
  const ids=[...new Set((subscriptionIds||[]).map(id=>String(id||"").trim()).filter(Boolean))];
  if(!ids.length)return{ok:false,code:0,message:"No registered subscription IDs"};

  const safeLaunchUrl=/^https:\/\/[^\s]+$/i.test(String(launchUrl||"").trim())
    ? String(launchUrl||"").trim()
    : "";

  const payload={
    app_id:appId,
    target_channel:"push",
    include_subscription_ids:ids,
    headings:{en:title},
    contents:{en:message},
    name:"Lover Legend Sales"
  };
  if(safeLaunchUrl)payload.url=safeLaunchUrl;

  const response=UrlFetchApp.fetch("https://api.onesignal.com/notifications?c=push",{
    method:"post",
    contentType:"application/json",
    headers:{Authorization:"Key "+apiKey,Accept:"application/json"},
    payload:JSON.stringify(payload),
    muteHttpExceptions:true
  });

  const code=response.getResponseCode();
  const text=response.getContentText();
  let body=null;
  try{body=JSON.parse(text||"{}")}catch(e){}
  return{
    ok:code>=200&&code<300&&Boolean(body&&body.id),
    code,
    id:body&&body.id||"",
    requested:ids.length,
    response:body||text
  };
}

function sendOneSignalNotification_(title, message, launchUrl) {
  try{
    const c=getOneSignalCredentialsV180_();
    if(!c.appId||!c.apiKey){
      const missing={ok:false,skipped:true,message:"Missing OneSignal API key"};
      console.error("OneSignal:",JSON.stringify(missing));
      return missing;
    }

    const ids=getRegisteredPushSubscriptionsV185_();
    if(!ids.length){
      const none={ok:false,skipped:true,message:"No registered subscription IDs"};
      console.warn("OneSignal:",JSON.stringify(none));
      return none;
    }

    const result=sendOneSignalRequestV181_(c.appId,c.apiKey,title,message,ids,launchUrl);
    if(result.ok){
      console.log("OneSignal direct sent:",JSON.stringify({id:result.id,code:result.code,requested:result.requested,title}));
    }else{
      console.error("OneSignal direct send failed:",JSON.stringify(result));
    }
    return result;
  }catch(err){
    const failure={ok:false,error:String(err&&err.message||err)};
    console.error("OneSignal exception:",JSON.stringify(failure));
    return failure;
  }
}

function notificationSignatureHex_(text) {
  const secret = getOneSignalCredentialsV180_().apiKey || "";
  if (!secret) return "";
  return Utilities.computeHmacSha256Signature(String(text || ""), secret).map(b => {
    const v=(b<0?b+256:b).toString(16);
    return v.length===1?"0"+v:v;
  }).join("");
}

function buildNotificationEnvelopeV185_(changes) {
  const clean=(changes||[]).map(change=>({
    action:String(change.action||""),
    oldAmount:Number(change.oldAmount||0),
    newAmount:Number(change.newAmount||0),
    date:String(change.date||""),
    location:String(change.location||""),
    type:String(change.type||""),
    company:String(change.company||""),
    notificationAction:String(change.notificationAction||""),
    notificationAmount:Number(change.notificationAmount||0),
    notificationOldAmount:Number(change.notificationOldAmount||0),
    notificationNewAmount:Number(change.notificationNewAmount||0)
  })).filter(change=>change.action&&change.date);
  if(!clean.length)return null;
  const notificationId="ntf_"+Utilities.getUuid();
  const raw=JSON.stringify({ts:Date.now(),notificationId,changes:clean});
  const payload=Utilities.base64EncodeWebSafe(raw,Utilities.Charset.UTF_8);
  const signature=notificationSignatureHex_(payload);
  return signature?{payload,signature,notificationId}:null;
}

function dispatchSalesNotificationV185_(p) {
  let finalResult;
  try {
    const payload=String(p.payload||""), signature=String(p.signature||"");
    if(!payload||!signature){
      finalResult={ok:false,message:"Missing notification envelope"};
      return finalResult;
    }

    const expected=notificationSignatureHex_(payload);
    if(!expected||expected!==signature){
      finalResult={ok:false,message:"Invalid notification signature"};
      return finalResult;
    }

    const raw=Utilities.newBlob(Utilities.base64DecodeWebSafe(payload)).getDataAsString("UTF-8");
    const data=JSON.parse(raw||"{}");

    if(!data.ts||Math.abs(Date.now()-Number(data.ts))>24*60*60*1000){
      finalResult={ok:false,message:"Notification envelope expired"};
      return finalResult;
    }
    const notificationId=String(data.notificationId||p.notificationId||"").trim();
    const ledgerKey="LL_PUSH_SENT_LEDGER_V397";
    const props=PropertiesService.getScriptProperties();
    let ledger={};
    try{ledger=JSON.parse(props.getProperty(ledgerKey)||"{}")||{}}catch(_){ledger={}}
    const cutoff=Date.now()-48*60*60*1000;
    Object.keys(ledger).forEach(k=>{if(Number(ledger[k]||0)<cutoff)delete ledger[k]});
    if(notificationId&&ledger[notificationId]){
      finalResult={ok:true,alreadySent:true,notificationId,message:"Notification already sent"};
      return finalResult;
    }

    finalResult=sendSalesChangeNotificationsV185_(Array.isArray(data.changes)?data.changes:[], String(p.launchUrl||""));
    if(finalResult&&finalResult.ok&&notificationId){
      ledger[notificationId]=Date.now();
      const ids=Object.keys(ledger).sort((a,b)=>Number(ledger[b]||0)-Number(ledger[a]||0));
      ids.slice(300).forEach(id=>delete ledger[id]);
      props.setProperty(ledgerKey,JSON.stringify(ledger));
      finalResult.notificationId=notificationId;
    }
    console.log("Notification dispatch result:",JSON.stringify(finalResult));
    return finalResult;
  } catch(e) {
    finalResult={ok:false,message:String(e&&e.message||e)};
    console.error("Notification dispatch failed:",JSON.stringify(finalResult));
    return finalResult;
  } finally {
    try{
      PropertiesService.getScriptProperties().setProperty(
        "ONESIGNAL_LAST_DISPATCH_RESULT",
        JSON.stringify({
          at:new Date().toISOString(),
          clientVersion:String(p.clientVersion||""),
          result:finalResult||{ok:false,message:"No result"}
        })
      );
    }catch(e){}
  }
}

function sendSalesChangeNotificationsV185_(changes, launchUrl) {
  const results=[];
  (changes || []).forEach(change => {
    const oldAmount = Number(change.oldAmount || 0);
    const newAmount = Number(change.newAmount || 0);
    const date = String(change.date || "");
    const location = String(change.location || "");
    const type = String(change.type || "");
    const company = String(change.company || "");
    const notificationAction=String(change.notificationAction||"");
    const entryAmount=Number(change.notificationAmount||0);
    const entryOld=Number(change.notificationOldAmount||0);
    const entryNew=Number(change.notificationNewAmount||0);

    let label = "Sales";
    let entity = "";
    if (type === "fair") {
      label = "Fair";
      entity = location;
    } else if (type === "live") {
      label = "Live";
      entity = location;
    } else {
      entity = company === "balakong" ? "Balakong" : company === "belimbing" ? "Belimbing" : "Sales";
    }

    let title = "";
    let detail = "";
    if(notificationAction === "added_entry" && entryAmount > 0){
      title = label + " 新订单 RM" + formatMoneyNotification_(entryAmount);
      detail = (entity ? entity + " · " : "") + date;
    }else if(notificationAction === "modified_entry"){
      title = label + " 订单已修改";
      detail = (entity ? entity + " · " : "") + "RM" + formatMoneyNotification_(entryOld) + " → RM" + formatMoneyNotification_(entryNew) + " · " + date;
    }else if(notificationAction === "deleted_entry"){
      title = label + " 订单已删除 RM" + formatMoneyNotification_(entryOld);
      detail = (entity ? entity + " · " : "") + date;
    }else if (change.action === "added") {
      title = label + " 新订单 RM" + formatMoneyNotification_(newAmount);
      detail = (entity ? entity + " · " : "") + date;
    }else if (!notificationAction && newAmount > oldAmount + 0.005) {
      // V42.3 fallback: legacy/alternate turnover save paths may only report the
      // authoritative total change. A positive delta is the newly added order,
      // not an edit of the whole day's turnover. Explicit modified_entry above
      // still keeps the real edit notification format.
      title = label + " 新订单 RM" + formatMoneyNotification_(newAmount - oldAmount);
      detail = (entity ? entity + " · " : "") + date;
    }else if (change.action === "deleted") {
      title = label + " 营业额已删除";
      detail = (entity ? entity + " · " : "") + "RM" + formatMoneyNotification_(oldAmount) + " · " + date;
    }else {
      title = label + " 营业额已修改";
      detail = (entity ? entity + " · " : "") + "RM" + formatMoneyNotification_(oldAmount) + " → RM" + formatMoneyNotification_(newAmount) + " · " + date;
    }

    results.push(sendOneSignalNotification_(title, detail, launchUrl));
  });
  const sent=results.filter(item=>item&&item.ok).length;
  const failed=results.length-sent;
  return {
    ok:results.length>0&&failed===0,
    attempted:results.length,
    sent,
    failed,
    results
  };
}

function maybeSendKeepaliveNotificationV185_(p,changes){
  const inline=String(p&&p.notifyInline||"")==="1";
  if(!inline)return{
    inline:false,
    attempted:0,
    sent:0,
    failed:0
  };

  const clean=Array.isArray(changes)?changes:[];
  if(!clean.length){
    return{
      inline:true,
      ok:true,
      attempted:0,
      sent:0,
      failed:0,
      skipped:true,
      message:"No new sales change"
    };
  }

  // This executes only on pagehide/keepalive requests. It never blocks the
  // normal interactive Sales/Fair/Live save path.
  const result=sendSalesChangeNotificationsV185_(clean, String(p&&p.launchUrl||""));
  console.log("V18.7 keepalive notification:",JSON.stringify(result));
  return Object.assign({inline:true},result||{});
}



/* ================= V29.9 optional bonsai product association + profit fields ================= */
const SALES_PRODUCT_LINK_SHEET_V203_ = "Sales_Product_Links";
function getSalesProductLinkSheetV203_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(SALES_PRODUCT_LINK_SHEET_V203_);
  const headers=["Link ID","Date","Type","Location / Host","Product ID","Product Name","Quantity","Actual Price","Local Delivery","Extra Fee","Remark","Created At","Updated At","Import Sync Status","Average Cost","Commission Rate %","Commission Amount","Profit","Profit Rate %","Minimum Price","Transaction ID","Product Order","Unit Price","Sale Status","Deleted At","Confirmed Once"];
  let schemaChanged=false;

  if(!sh){
    sh=ss.insertSheet(SALES_PRODUCT_LINK_SHEET_V203_);
    sh.getRange(1,1,1,26).setValues([headers]);
    sh.setFrozenRows(1);
    schemaChanged=true;
  }else{
    if(sh.getMaxColumns()<26){sh.insertColumnsAfter(sh.getMaxColumns(),26-sh.getMaxColumns());schemaChanged=true}
    // V29.9 performance: do not rewrite the 25 headers on every save.
    const current=sh.getRange(1,1,1,26).getDisplayValues()[0];
    if(headers.some((h,i)=>String(current[i]||"")!==h)){
      sh.getRange(1,1,1,26).setValues([headers]);
      schemaChanged=true;
    }
  }

  // V29.9 performance: full-column formatting is expensive in Apps Script.
  // It is schema setup, not transaction work, so run it only when the sheet is
  // created/upgraded (or once per script cache lifecycle for older sheets).
  const cache=CacheService.getScriptCache();
  const formatKey="sales_product_links_schema_v261";
  if(schemaChanged||cache.get(formatKey)!=="1"){
    sh.getRange("B:B").setNumberFormat("dd-MM-yyyy");
    sh.getRange("H:J").setNumberFormat("#,##0.00");
    sh.getRange("L:M").setNumberFormat("dd-MM-yyyy HH:mm:ss");
    sh.getRange("O:O").setNumberFormat("#,##0.00");
    sh.getRange("P:P").setNumberFormat("0.00");
    sh.getRange("Q:R").setNumberFormat("#,##0.00");
    sh.getRange("S:S").setNumberFormat("0.00");
    sh.getRange("T:T").setNumberFormat("#,##0.00");
    sh.getRange("V:V").setNumberFormat("0");
    sh.getRange("W:W").setNumberFormat("#,##0.00");
    sh.getRange("Y:Y").setNumberFormat("dd-MM-yyyy HH:mm:ss");

    try{
      const minWidths={
        1:150,2:95,3:70,4:150,5:110,6:230,7:70,8:95,9:95,10:90,
        11:180,12:145,13:145,14:135,15:100,16:110,17:120,18:100,19:100,
        20:110,21:230,22:95,23:100,24:105,25:155
      };
      let needsResize=false;
      [6,21,24,25].forEach(col=>{if(sh.getColumnWidth(col)<minWidths[col])needsResize=true});
      if(needsResize){
        sh.autoResizeColumns(1,25);
        Object.keys(minWidths).forEach(k=>{const col=Number(k);if(sh.getColumnWidth(col)<minWidths[col])sh.setColumnWidth(col,minWidths[col])});
      }
    }catch(_){}
    try{cache.put(formatKey,"1",21600)}catch(_){}
  }
  return sh;
}

function ensureLegacySaleIdsV258_(sh){
  if(!sh||sh.getLastRow()<2)return 0;
  const last=sh.getLastRow(),rows=last-1;
  const linkIds=sh.getRange(2,1,rows,1).getValues();
  const txnIds=sh.getRange(2,21,rows,1).getValues();
  let changed=0;
  for(let i=0;i<rows;i++){
    const linkId=String(linkIds[i][0]||"").trim();
    const saleId=String(txnIds[i][0]||"").trim();
    if(!linkId||saleId)continue;
    // Deterministic + persisted. The same legacy row always gets the same ID.
    txnIds[i][0]="txn_legacy_"+linkId;
    changed++;
  }
  if(changed){
    sh.getRange(2,21,rows,1).setValues(txnIds);
    bumpDataRevision_();
  }
  return changed;
}

function getOfficialSalesAmountForProductLinkV204_(type,date,location){
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(monthSheetName(date));if(!sh||sh.getLastRow()<2)return 0;
  const vals=sh.getRange(2,1,sh.getLastRow()-1,6).getValues();let best=null;
  vals.forEach(raw=>{const r=normalizeRow(raw);if(!r||r.type!==type||r.date!==formatDateForApp(date))return;const same=type==="daily"?String(r.company||"")===normalizeCompany(location):type==="live"?canonicalLiveHost(r.location)===canonicalLiveHost(location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(location);if(!same)return;best=best?newerRow(best,r):r;});
  return best?Number(best.amount||0):0;
}
function getLinkedActualPriceTotalV204_(type,date,location){
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SALES_PRODUCT_LINK_SHEET_V203_);if(!sh||sh.getLastRow()<2)return 0;
  const vals=sh.getRange(2,1,sh.getLastRow()-1,14).getValues();const d=formatDateForApp(date);let total=0;
  vals.forEach(r=>{if(!r[0])return;const rowType=normalizeType(String(r[2]||"")),rowDate=r[1] instanceof Date?formatDateForApp(r[1]):String(r[1]||"");if(rowType!==type||rowDate!==d)return;const rowLoc=String(r[3]||"");const same=type==="daily"?normalizeCompany(rowLoc||'Belimbing')===normalizeCompany(location):type==="live"?canonicalLiveHost(rowLoc)===canonicalLiveHost(location):normalizeFairLocationKey(rowLoc)===normalizeFairLocationKey(location);if(same)total+=Number(r[7]||0);});
  return total;
}
function saveSalesProductLinkV203_(p){
  const type=normalizeType(String(p.type||""));if(!["fair","live","daily"].includes(type))throw new Error("只支持 Sales / Fair / Live 盆栽关联");
  const date=parseDateFromApp(String(p.date||""));if(!date)throw new Error("盆栽关联日期无效");
  const location=type==="daily"?displayCompany(normalizeCompany(String(p.location||"Belimbing"))):type==="live"?canonicalLiveHost(String(p.location||"")):canonicalLocation(String(p.location||""));if(!location)throw new Error("地点 / 主播不能为空");
  const productName=String(p.productName||"").trim();if(!productName)throw new Error("产品不能为空");
  const qty=Number(p.quantity||0);if(!Number.isFinite(qty)||qty<=0)throw new Error("盆栽数量必须大于 0");
  const actualPrice=Math.max(0,Number(p.actualPrice||0)),delivery=Math.max(0,Number(p.localDelivery||0)),extra=Math.max(0,Number(p.extraFee||0)),averageCost=Math.max(0,Number(p.averageCost||0)),minimumPrice=Math.max(0,Number(p.minimumPrice||0)),commissionRate=Math.max(0,Number(p.commissionRate||0)),commissionAmount=actualPrice*commissionRate/100,profit=actualPrice-commissionAmount-(averageCost*qty)-delivery-extra,profitRate=actualPrice>0?profit/actualPrice*100:0,remark=String(p.remark||"").trim().slice(0,100),now=new Date();
  const official=getOfficialSalesAmountForProductLinkV204_(type,date,location);if(official<=0)throw new Error("找不到该日期的正式营业额，请先保存 Sales / Fair / Live 销售额");
  const linked=getLinkedActualPriceTotalV204_(type,date,location);if(linked+actualPrice>official+0.005)throw new Error("已关联盆栽实际售价合计 RM"+(linked+actualPrice).toFixed(2)+"，不能超过当天营业额 RM"+official.toFixed(2));
  const linkId="spl_"+Utilities.getUuid();const sh=getSalesProductLinkSheetV203_();sh.appendRow([linkId,date,type,location,String(p.productId||""),productName,qty,actualPrice,delivery,extra,remark,now,now,"PENDING_IMPORT_LINK",averageCost,commissionRate,commissionAmount,profit,profitRate,minimumPrice,String(p.transactionId||""),Math.max(1,Number(p.productOrder||1)),Math.max(0,Number(p.unitPrice!==undefined?p.unitPrice:(qty>0?actualPrice/qty:actualPrice)))]);
  return{ok:true,link:{linkId,date:formatDateForApp(date),type,location,productId:String(p.productId||""),productName,quantity:qty,actualPrice,localDelivery:delivery,extraFee:extra,averageCost,commissionRate,commissionAmount,profit,profitRate,remark,importSyncStatus:"PENDING_IMPORT_LINK",linkedActualPriceTotal:linked+actualPrice,officialSalesAmount:official,transactionId:String(p.transactionId||""),productOrder:Math.max(1,Number(p.productOrder||1))}};
}
function countSalesChangeEventsV205_(type,date,location){
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName("_Sales_Change_Log");if(!sh||sh.getLastRow()<2)return 0;
  const vals=sh.getRange(2,1,sh.getLastRow()-1,8).getValues(),d=formatDateForApp(date);let count=0;
  vals.forEach(r=>{const rd=r[0] instanceof Date?formatDateForApp(r[0]):String(r[0]||""),rt=normalizeType(String(r[1]||""));if(rd!==d||rt!==type)return;const rl=String(r[3]||"");const same=type==="live"?canonicalLiveHost(rl)===canonicalLiveHost(location):canonicalLocation(rl)===canonicalLocation(location);if(same)count++;});return count;
}
function getLinkedQuantityTotalV205_(type,date,location){
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SALES_PRODUCT_LINK_SHEET_V203_);if(!sh||sh.getLastRow()<2)return 0;
  const vals=sh.getRange(2,1,sh.getLastRow()-1,14).getValues(),d=formatDateForApp(date);let total=0;
  vals.forEach(r=>{if(!r[0])return;const rd=r[1] instanceof Date?formatDateForApp(r[1]):String(r[1]||""),rt=normalizeType(String(r[2]||""));if(rd!==d||rt!==type)return;const rl=String(r[3]||"");const same=type==="live"?canonicalLiveHost(rl)===canonicalLiveHost(location):canonicalLocation(rl)===canonicalLocation(location);if(same)total+=Math.max(0,Number(r[6]||0));});return total;
}
function salesProductLinkRowToObjV206_(r){
  const saleStatus=String(r[23]||"active").trim().toLowerCase()||"active";
  return{linkId:String(r[0]||""),date:r[1] instanceof Date?formatDateForApp(r[1]):String(r[1]||""),type:String(r[2]||""),location:String(r[3]||""),productId:String(r[4]||""),productName:String(r[5]||""),quantity:Number(r[6]||1),actualPrice:Number(r[7]||0),localDelivery:Number(r[8]||0),extraFee:Number(r[9]||0),remark:String(r[10]||""),createdAt:r[11] instanceof Date?formatDateTimeForApp(r[11]):String(r[11]||""),updatedAt:r[12] instanceof Date?formatDateTimeForApp(r[12]):String(r[12]||""),importSyncStatus:String(r[13]||""),averageCost:Number(r[14]||0),commissionRate:Number(r[15]||0),commissionAmount:Number(r[16]||0),profit:Number(r[17]||0),profitRate:Number(r[18]||0),minimumPrice:Number(r[19]||0),transactionId:String(r[20]||""),saleId:String(r[20]||""),productOrder:Number(r[21]||0),unitPrice:Number(r[22]||((Number(r[6]||1)>0)?Number(r[7]||0)/Number(r[6]||1):Number(r[7]||0))),status:saleStatus,deletedAt:r[24] instanceof Date?formatDateTimeForApp(r[24]):String(r[24]||""),confirmedOnce:r[25]===true||String(r[25]||"").toLowerCase()==="true"};
}
// V46.0: normalize legacy confirmed cards in responses only; never reprocess inventory.
function normalizeSalesCardTransactionStatesV430_(links){
  const list=(Array.isArray(links)?links:[]).map(x=>Object.assign({},x)),groups={};
  list.forEach(x=>{const tx=String(x.transactionId||x.saleId||"").trim();if(tx)(groups[tx]||(groups[tx]=[])).push(x)});
  Object.keys(groups).forEach(tx=>{const rows=groups[tx],confirmed=rows.some(r=>r.confirmedOnce===true||["PENDING_IMPORT_LINK","INVENTORY_CONFIRMED","NON_INVENTORY"].includes(String(r.importSyncStatus||"")));if(!confirmed)return;rows.forEach(r=>{r.confirmedOnce=true;const st=String(r.importSyncStatus||"");if(st==="DRAFT"||st==="DRAFT_INVENTORY_CHANGED")r.importSyncStatus=String(r.productId||"").trim()?"PENDING_IMPORT_LINK":"NON_INVENTORY"})});
  return list;
}
function sameSalesProductLinkContextV206_(r,type,dateText,location){
  if(!r||!r[0])return false;
  const rowDate=r[1] instanceof Date?formatDateForApp(r[1]):String(r[1]||""),rowType=normalizeType(String(r[2]||"")),rowLoc=String(r[3]||"");
  if(rowDate!==dateText||rowType!==type)return false;
  return type==="daily"?normalizeCompany(rowLoc||'Belimbing')===normalizeCompany(location):type==="live"?canonicalLiveHost(rowLoc)===canonicalLiveHost(location):normalizeFairLocationKey(rowLoc)===normalizeFairLocationKey(location);
}
// V46.5 read-speed optimization only. First scan the Date column alone.
// A brand-new Live/Fair/Sales context can therefore prove "no card for this date"
// without reading Type / Location / Status across the entire historical sheet.
// Only rows from the requested date are then read in full and filtered by the
// existing exact-context rules. This does not change save/delete/sync behavior.
function getSalesProductContextRowsV465_(sh,type,dateText,location){
  const last=sh?sh.getLastRow():0;if(last<2)return[];
  const count=last-1,dateValues=sh.getRange(2,2,count,1).getDisplayValues(),dateRows=[];
  for(let i=0;i<count;i++){if(String(dateValues[i][0]||"").trim()===dateText)dateRows.push(i+2)}
  if(!dateRows.length)return[];
  const blocks=[];for(let i=0;i<dateRows.length;){let j=i+1;while(j<dateRows.length&&dateRows[j]===dateRows[j-1]+1)j++;blocks.push([dateRows[i],dateRows[j-1]]);i=j}
  // Same-date rows are normally contiguous. If historical restores have made
  // them highly fragmented, fall back to the proven V46.0 reader rather than
  // risk changing any matching semantics.
  if(blocks.length>12)return getSalesProductContextRowsV459_(sh,type,dateText,location);
  const out=[];blocks.forEach(([a,b])=>{
    sh.getRange(a,1,b-a+1,26).getValues().forEach(r=>{
      if(sameSalesProductLinkContextV206_(r,type,dateText,location)&&!["deleted","cancelled"].includes(String(r[23]||"active").toLowerCase()))out.push(r);
    });
  });
  return out;
}

// Keep the proven V46.0 reader as the conservative fallback for unusual sheets.
function getSalesProductContextRowsV459_(sh,type,dateText,location){
  const last=sh?sh.getLastRow():0;if(last<2)return[];
  const count=last-1,meta=sh.getRange(2,2,count,3).getValues(),statuses=sh.getRange(2,24,count,1).getValues(),rows=[];
  for(let i=0;i<count;i++){
    const m=meta[i],rowDate=m[0] instanceof Date?formatDateForApp(m[0]):String(m[0]||""),rowType=normalizeType(String(m[1]||"")),rowLoc=String(m[2]||"");
    if(rowDate!==dateText||rowType!==type)continue;
    const same=type==="daily"?normalizeCompany(rowLoc||'Belimbing')===normalizeCompany(location):type==="live"?canonicalLiveHost(rowLoc)===canonicalLiveHost(location):normalizeFairLocationKey(rowLoc)===normalizeFairLocationKey(location);
    if(!same||["deleted","cancelled"].includes(String(statuses[i][0]||"active").toLowerCase()))continue;
    rows.push(i+2);
  }
  if(!rows.length)return[];
  const blocks=[];for(let i=0;i<rows.length;){let j=i+1;while(j<rows.length&&rows[j]===rows[j-1]+1)j++;blocks.push([rows[i],rows[j-1]]);i=j}
  if(blocks.length>10){
    return sh.getRange(2,1,count,26).getValues().filter(r=>sameSalesProductLinkContextV206_(r,type,dateText,location)&&!["deleted","cancelled"].includes(String(r[23]||"active").toLowerCase()));
  }
  const out=[];blocks.forEach(([a,b])=>{sh.getRange(a,1,b-a+1,26).getValues().forEach(r=>{if(sameSalesProductLinkContextV206_(r,type,dateText,location)&&!["deleted","cancelled"].includes(String(r[23]||"active").toLowerCase()))out.push(r)})});
  return out;
}

const SALES_CONTEXT_CACHE_SECONDS_V465_=600;
function salesContextCacheKeyV465_(salesCardRevision,restoreGeneration,type,dateText,location){
  const raw=[String(type||""),String(dateText||""),String(location||"")].join("|");
  const digest=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,raw)).replace(/=+$/g,"");
  return "LL_CTX_V465_"+String(Math.max(0,Number(salesCardRevision||0)))+"_"+String(Math.max(0,Number(restoreGeneration||0)))+"_"+digest;
}
function getCachedSalesContextV465_(key){
  try{const text=CacheService.getScriptCache().get(key);if(text===null)return null;const parsed=JSON.parse(text);return Array.isArray(parsed)?parsed:null}catch(_){return null}
}
function putCachedSalesContextV465_(key,links){
  try{const text=JSON.stringify(Array.isArray(links)?links:[]);if(text.length<95000)CacheService.getScriptCache().put(key,text,SALES_CONTEXT_CACHE_SECONDS_V465_)}catch(_){}
}
function getSalesProductLinksV206_(p){
  const type=normalizeType(String(p.type||""));if(!["fair","live","daily"].includes(type))throw new Error("只支持 Sales / Fair / Live 盆栽关联");
  const date=parseDateFromApp(String(p.date||""));if(!date)throw new Error("盆栽关联日期无效");
  const dateText=formatDateForApp(date),location=type==="daily"?displayCompany(normalizeCompany(String(p.location||"Belimbing"))):type==="live"?canonicalLiveHost(String(p.location||"")):canonicalLocation(String(p.location||""));if(!location)throw new Error("地点 / 主播不能为空");
  const salesCardRevision=getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_),restoreGeneration=getRestoreGenerationV347_(),dataRevision=getDataRevision_(),cacheKey=salesContextCacheKeyV465_(salesCardRevision,restoreGeneration,type,dateText,location),cached=getCachedSalesContextV465_(cacheKey);
  if(cached!==null)return{ok:true,links:cached,salesCardRevision,dataRevision};
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SALES_PRODUCT_LINK_SHEET_V203_);
  if(!sh||sh.getLastRow()<2){putCachedSalesContextV465_(cacheKey,[]);return{ok:true,links:[],salesCardRevision,dataRevision}}
  const active=getSalesProductContextRowsV465_(sh,type,dateText,location).map(salesProductLinkRowToObjV206_);
  const links=normalizeSalesCardTransactionStatesV430_(dedupeActiveSalesProductLinksV354_(active));
  putCachedSalesContextV465_(cacheKey,links);
  return{ok:true,links,salesCardRevision,dataRevision};
}
function deleteSalesProductLinkV206_(p){
  const linkId=String(p.linkId||"").trim();if(!linkId)throw new Error("缺少 Link ID");
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SALES_PRODUCT_LINK_SHEET_V203_);if(!sh||sh.getLastRow()<2)return{ok:true,deleted:false};
    const ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String),idx=ids.indexOf(linkId);
    if(idx<0)return{ok:true,deleted:false};
    const row=idx+2,now=new Date(),rowVals=sh.getRange(row,1,1,26).getValues()[0];
    const currentImportStatus=String(rowVals[13]||"").trim();
    if(!["DRAFT","DRAFT_INVENTORY_CHANGED"].includes(currentImportStatus))throw new Error("这张销售卡已经确认销售，不能删除");
    sh.getRange(row,13).setValue(now);
    sh.getRange(row,24,1,2).setValues([["deleted",now]]);
    const dataRevision=bumpDataRevision_();
    const salesCardRevision=bumpPriorityCardV315_();
    appendSyncChangeV456_("card",normalizeType(String(rowVals[2]||"")),rowVals[1] instanceof Date?formatDateForApp(rowVals[1]):String(rowVals[1]||""),String(rowVals[3]||""),salesCardRevision);
    return{ok:true,deleted:true,linkId,status:"deleted",dataRevision,salesCardRevision};
  }finally{lock.releaseLock()}
}
function saveSalesProductLinksV206_(p){
  const saveMode=String(p.saveMode||"confirm").toLowerCase()==="draft"?"draft":"confirm";
  const clientDeviceId=String(p.clientDeviceId||"").trim().slice(0,120),clientSequence=Math.max(0,Number(p.clientSequence||0));
  const expectedSalesCardRevisionRaw=String(p.expectedSalesCardRevision===undefined?"":p.expectedSalesCardRevision).trim();
  const hasExpectedSalesCardRevision=expectedSalesCardRevisionRaw!==""&&Number.isFinite(Number(expectedSalesCardRevisionRaw));
  const expectedSalesCardRevision=hasExpectedSalesCardRevision?Number(expectedSalesCardRevisionRaw):null;
  let list=[];try{list=JSON.parse(String(p.itemsJson||"[]"))}catch(e){throw new Error("盆栽资料格式无效")};if(!Array.isArray(list)||!list.length)throw new Error("没有盆栽资料");
  let explicitDeletedLinkIds=[];try{explicitDeletedLinkIds=JSON.parse(String(p.deletedLinkIdsJson||"[]"))}catch(e){explicitDeletedLinkIds=[]};if(!Array.isArray(explicitDeletedLinkIds))explicitDeletedLinkIds=[];explicitDeletedLinkIds=[...new Set(explicitDeletedLinkIds.map(x=>String(x||"").trim()).filter(Boolean))];
  const first=list[0]||{},type=normalizeType(String(first.type||""));if(!["fair","live","daily"].includes(type))throw new Error("只支持 Sales / Fair / Live 盆栽关联");
  const date=parseDateFromApp(String(first.date||""));if(!date)throw new Error("盆栽关联日期无效");
  const dateText=formatDateForApp(date),location=type==="daily"?displayCompany(normalizeCompany(String(first.location||"Belimbing"))):type==="live"?canonicalLiveHost(String(first.location||"")):canonicalLocation(String(first.location||""));if(!location)throw new Error("地点 / 主播不能为空");
  const official=getOfficialSalesAmountForProductLinkV204_(type,date,location);if(official<=0)throw new Error("找不到该日期的正式营业额，请先保存 Sales / Fair / Live 销售额");
  // V36.0: a typed product is matched automatically. A unique normalized exact
  // match becomes a normal Import product; no match becomes NON_INVENTORY.
  const normalizeManualProductKeyV338_=value=>String(value||"").normalize("NFKC").toLowerCase().replace(/[\s\u3000\-_./\\,，、:：;；()（）\[\]【】{}"'`~!！?？@#$%^&*+=|<>]+/g,"");
  const manualRows=list.filter(x=>!String(x&&x.productId||"").trim());
  let manualLookupReady=false,manualLookupError=null,manualMatches=new Map();
  if(manualRows.length){
    try{
      const importResult=getImportProductsV212_(),products=Array.isArray(importResult&&importResult.products)?importResult.products:[];
      products.forEach(prod=>{const key=normalizeManualProductKeyV338_(prod&&prod.productName);if(!key)return;if(!manualMatches.has(key))manualMatches.set(key,[]);manualMatches.get(key).push(prod)});
      manualLookupReady=true;
    }catch(err){manualLookupError=err}
    if(!manualLookupReady&&saveMode==="confirm")throw new Error("无法核对手动输入产品是否属于 Import 库存："+String(manualLookupError&&manualLookupError.message||manualLookupError||"未知错误"));
  }
  const normalized=list.map((x,i)=>{
    if(normalizeType(String(x.type||""))!==type||String(x.date||"")!==dateText)throw new Error("第 "+(i+1)+" 项日期或类型不一致");
    const loc=type==="daily"?displayCompany(normalizeCompany(String(x.location||"Belimbing"))):type==="live"?canonicalLiveHost(String(x.location||"")):canonicalLocation(String(x.location||""));if(loc!==location)throw new Error("第 "+(i+1)+" 项地点 / 主播不一致");
    const productName=String(x.productName||"").trim();if(!productName)throw new Error("第 "+(i+1)+" 项产品不能为空");
    let productId=String(x.productId||"").trim(),autoProduct=null,nonInventory=false;
    if(!productId&&manualLookupReady){
      const matches=manualMatches.get(normalizeManualProductKeyV338_(productName))||[];
      const uniqueIds=[...new Set(matches.map(prod=>String(prod&&prod.productId||"").trim()).filter(Boolean))];
      if(uniqueIds.length>1)throw new Error("第 "+(i+1)+" 项产品名称匹配到多个 Import 产品，请从搜索结果选择正确产品");
      if(matches.length&&uniqueIds.length===1){autoProduct=matches.find(prod=>String(prod&&prod.productId||"").trim()===uniqueIds[0])||matches[0];productId=uniqueIds[0]}
      else nonInventory=true;
    }
    const qty=Number(x.quantity||0);if(!Number.isFinite(qty)||qty<=0)throw new Error("第 "+(i+1)+" 项数量必须大于 0");
    if(saveMode==="confirm"&&autoProduct&&autoProduct.stock!==null&&autoProduct.stock!==undefined&&qty>Math.max(0,Number(autoProduct.stock)||0))throw new Error("第 "+(i+1)+" 项 "+productName+" 库存不足：Import 当前库存 "+Math.max(0,Number(autoProduct.stock)||0)+"，销售数量 "+qty);
    const unitPrice=Math.max(0,Number(x.unitPrice!==undefined?x.unitPrice:(qty>0?Number(x.actualPrice||0)/qty:Number(x.actualPrice||0))));if(!Number.isFinite(unitPrice)||unitPrice<=0)throw new Error("第 "+(i+1)+" 项售价必须大于 RM0.00");const actualPrice=unitPrice*qty,averageCost=Math.max(0,Number(autoProduct?autoProduct.averageCost:x.averageCost||0)),minimumPrice=Math.max(0,Number(autoProduct&&autoProduct.minimumPrice!==undefined?autoProduct.minimumPrice:x.minimumPrice||0)),commissionRate=Math.max(0,Number(x.commissionRate||0)),localDelivery=Math.max(0,Number(x.localDelivery||0)),extraFee=Math.max(0,Number(x.extraFee||0));const commissionAmount=actualPrice*commissionRate/100,profit=actualPrice-commissionAmount-(averageCost*qty)-localDelivery-extraFee,profitRate=actualPrice>0?profit/actualPrice*100:0;
    return{linkId:String(x.linkId||"").trim()||("spl_"+Utilities.getUuid()),transactionId:String(x.transactionId||"").trim()||("txn_"+Utilities.getUuid()),productOrder:Math.max(1,Number(x.productOrder||i+1)),productId,productName,quantity:qty,unitPrice,actualPrice,localDelivery,extraFee,remark:String(x.remark||"").trim().slice(0,100),averageCost,minimumPrice,commissionRate,commissionAmount,profit,profitRate,nonInventory};
  });
  const ids=normalized.map(x=>x.linkId);if(new Set(ids).size!==ids.length)throw new Error("盆栽 Link ID 重复，请重新展开关联盆栽后再保存");
  const lock=LockService.getScriptLock();lock.waitLock(8000);
  try{
    // V46.0 optimistic concurrency guard. A device may keep working while the
    // lightweight revision probe is slow, but an old Sales Card snapshot can
    // never overwrite a newer cloud card.
    const currentSalesCardRevisionV450=getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_);
    if(hasExpectedSalesCardRevision&&expectedSalesCardRevision!==currentSalesCardRevisionV450&&salesCardRevisionConflictV456_(expectedSalesCardRevision,type,dateText,location,currentSalesCardRevisionV450)){
      throw new Error("这一个销售卡 context 已有其他设备的新修改，本次保存已停止。请先同步这张卡后再保存。");
    }
    const sh=getSalesProductLinkSheetV203_(),last=sh.getLastRow(),vals=last>1?sh.getRange(2,1,last-1,26).getValues():[],idMap={};
    vals.forEach((r,i)=>{if(r[0])idMap[String(r[0])]={row:r,index:i+2}});
    // V36.0: reject an older delayed draft from the same device/context.  This
    // prevents a pre-delete snapshot from recreating a removed product after a
    // newer whole-card save has already won.
    const mutationKeyV349_=clientDeviceId&&clientSequence>0?"SPL_MUT_V349_"+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,[type,dateText,normalizeFairLocationKey(location),clientDeviceId].join("|"))).replace(/=+$/g,"").slice(0,38):"";
    const mutationPropsV349_=mutationKeyV349_?PropertiesService.getScriptProperties():null;
    const lastMutationV349_=mutationPropsV349_?Number(mutationPropsV349_.getProperty(mutationKeyV349_)||0):0;
    if(mutationKeyV349_&&clientSequence<lastMutationV349_){
      const authoritative=vals.filter(r=>sameSalesProductLinkContextV206_(r,type,dateText,location)&&!["deleted","cancelled"].includes(String(r[23]||"active").toLowerCase())).map(salesProductLinkRowToObjV206_);
      return{ok:true,staleMutation:true,saved:authoritative.length,links:authoritative,officialSalesAmount:official,linkedActualPriceTotal:authoritative.reduce((s,x)=>s+Number(x.actualPrice||0),0),linkedCardCount:new Set(authoritative.map(x=>String(x.transactionId||"")).filter(Boolean)).size,warning:"旧版销售卡草稿已忽略。",dataRevision:getDataRevision_(),salesCardRevision:getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_)};
    }
    const submittedIds=new Set(ids);
    const submittedTxnIds=new Set(normalized.map(x=>String(x.transactionId||"").trim()).filter(Boolean));
    // V36.0: explicit Link-ID tombstones are authoritative. A deleted product
    // must be removed even when an older client snapshot has a different or
    // legacy transactionId, which previously allowed the row to survive and
    // reappear on the next cloud refresh.
    const explicitDeletedRows=[];
    explicitDeletedLinkIds.forEach(linkId=>{
      const found=idMap[linkId];if(!found)return;
      if(!sameSalesProductLinkContextV206_(found.row,type,dateText,location))throw new Error("删除产品 Link ID 属于其他日期 / 地点，已停止保存");
      const status=String(found.row[23]||"active").toLowerCase();
      if(!["deleted","cancelled"].includes(status))explicitDeletedRows.push(found.index);
    });
    // V36.0: deleted/cancelled Link IDs are permanent tombstones.  A delayed
    // draft may still contain the deleted product; acknowledging it with the
    // current authoritative transaction prevents the old draft from reviving
    // the product, duplicating the Sales Card and double-counting profit.
    const staleTombstoneIds=new Set();
    normalized.forEach(x=>{const found=idMap[x.linkId];if(found&&["deleted","cancelled"].includes(String(found.row[23]||"active").toLowerCase()))staleTombstoneIds.add(x.linkId)});
    if(staleTombstoneIds.size){
      const authoritative=vals.filter(r=>{
        const tx=String(r[20]||"").trim(),status=String(r[23]||"active").toLowerCase();
        return submittedTxnIds.has(tx)&&sameSalesProductLinkContextV206_(r,type,dateText,location)&&!["deleted","cancelled"].includes(status);
      }).map(salesProductLinkRowToObjV206_);
      return{ok:true,staleMutation:true,ignoredDeletedLinkIds:[...staleTombstoneIds],saved:authoritative.length,links:authoritative,officialSalesAmount:official,linkedActualPriceTotal:authoritative.reduce((s,x)=>s+Number(x.actualPrice||0),0),linkedCardCount:new Set(authoritative.map(x=>String(x.transactionId||"")).filter(Boolean)).size,warning:"旧草稿包含已删除产品，已忽略并返回云端最新销售卡。",dataRevision:getDataRevision_(),salesCardRevision:getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_)};
    }
    // V32.6: confirmation is permanent for the transaction. Later "保存草稿"
    // edits must never downgrade that sale back to DRAFT.
    const confirmedTxnIdsV322=new Set();
    vals.forEach(r=>{
      const tx=String(r[20]||"").trim(),st=String(r[13]||"").trim();
      if(tx&&(["PENDING_IMPORT_LINK","INVENTORY_CONFIRMED","NON_INVENTORY"].includes(st)||r[25]===true||String(r[25]||"").toLowerCase()==="true"))confirmedTxnIdsV322.add(tx);
    });
    // V42.3: confirmation is the final immutable sale boundary. Drafts are
    // freely editable before confirmation, but no browser/cache/retry may
    // change a transaction after it has ever been confirmed.
    const attemptedConfirmedTxns=[...submittedTxnIds].filter(tx=>confirmedTxnIdsV322.has(tx));
    if(attemptedConfirmedTxns.length)throw new Error("这张销售卡已经确认销售并永久锁定，不能修改、删除或再次保存。顾客加购请新增销售卡；取消/换货请到 Import 手动调整库存并备注。");

    // V29.9 — 同一 saleId 原本存在、但本次不再提交的 active 产品，
    // 代表用户已经从该销售卡删除产品。保留原记录，并标记 deleted。
    const removedRows=[...explicitDeletedRows];
    vals.forEach((r,i)=>{
      const rowStatus=String(r[23]||"active").toLowerCase();
      const rowTxn=String(r[20]||"").trim();
      const rowLink=String(r[0]||"").trim();
      if(!rowTxn||!submittedTxnIds.has(rowTxn))return;
      if(rowStatus==="deleted"||rowStatus==="cancelled")return;
      if(!submittedIds.has(rowLink)&&!removedRows.includes(i+2))removedRows.push(i+2);
    });

    let otherPrice=0;const otherTxnIds=new Set();
    vals.forEach((r,i)=>{
      if(removedRows.includes(i+2))return;
      if(["deleted","cancelled"].includes(String(r[23]||"active").toLowerCase()))return;
      if(!sameSalesProductLinkContextV206_(r,type,dateText,location)||submittedIds.has(String(r[0])))return;
      otherPrice+=Number(r[7]||0);
      if(String(r[20]||""))otherTxnIds.add(String(r[20]));
    });

    let batchPrice=0;const batchTxnIds=new Set();normalized.forEach(x=>{batchPrice+=x.actualPrice;if(x.transactionId)batchTxnIds.add(x.transactionId)});
    if(otherPrice+batchPrice>official+0.005)throw new Error("已关联盆栽实际售价合计 RM"+(otherPrice+batchPrice).toFixed(2)+"，不能超过当天营业额 RM"+official.toFixed(2));

    const now=new Date(),appends=[],updates=[];

    // 只有正式通过销售额验证后才写 deleted，避免验证失败留下半套状态。
    if(removedRows.length){
      removedRows.sort((a,b)=>a-b);
      for(let i=0;i<removedRows.length;){
        let j=i+1;
        while(j<removedRows.length&&removedRows[j]===removedRows[j-1]+1)j++;
        const block=removedRows.slice(i,j);
        sh.getRange(block[0],13,block.length,1).setValues(block.map(()=>[now]));
        // A removed product from an already confirmed sale is itself an inventory
        // difference (+stock), so expose its tombstone to Import as pending.
        const pendingStatuses=block.map(row=>{
          const r=vals[row-2],tx=String(r?.[20]||"").trim(),old=String(r?.[13]||"").trim();
          return [confirmedTxnIdsV322.has(tx)&&old!=="NON_INVENTORY"?"PENDING_IMPORT_LINK":old];
        });
        sh.getRange(block[0],14,block.length,1).setValues(pendingStatuses);
        sh.getRange(block[0],24,block.length,2).setValues(block.map(()=>["deleted",now]));
        i=j;
      }
    }
    normalized.forEach((x,i)=>{
      let found=idMap[x.linkId];
      // V42.3: if a confirmed product was deleted, saved, and then the same
      // product is restored before Import processes the deletion, reactivate
      // the original immutable Link ID. Import can then compare the final
      // desired quantity with the already-processed quantity and net to zero.
      if(!found&&confirmedTxnIdsV322.has(x.transactionId)){
        const revived=vals.map((row,index)=>({row,index:index+2})).find(v=>{
          const r=v.row,status=String(r[23]||"active").toLowerCase();
          if(!["deleted","cancelled"].includes(status))return false;
          if(String(r[20]||"").trim()!==x.transactionId)return false;
          const sameId=String(r[4]||"").trim()&&String(r[4]||"").trim()===String(x.productId||"").trim();
          const sameName=String(r[5]||"").trim()===String(x.productName||"").trim();
          return sameSalesProductLinkContextV206_(r,type,dateText,location)&&(sameId||sameName);
        });
        if(revived){x.linkId=String(revived.row[0]||x.linkId);found=revived;idMap[x.linkId]=revived;}
      }
      if(found){
        if(!sameSalesProductLinkContextV206_(found.row,type,dateText,location))throw new Error("第 "+(i+1)+" 项 Link ID 属于其他日期 / 地点，已停止保存");

        const oldProductId=String(found.row[4]||"").trim();
        const oldProductName=String(found.row[5]||"").trim();
        const newProductId=String(x.productId||"").trim();
        const newProductName=String(x.productName||"").trim();

        // V29.9: product identity replacement is NOT an in-place overwrite.
        // Keep the old product as deleted tombstone, then append the replacement
        // with a fresh Link ID but the SAME stable saleId / transactionId.
        const identityChanged=(oldProductId!==newProductId)||(oldProductName!==newProductName);
        if(identityChanged){
          sh.getRange(found.index,13).setValue(now);
          // Replacing a product after the sale was already confirmed means two
          // inventory differences: return the old product (+) and deduct the new
          // product (-). Mark the old tombstone pending as well so both are visible.
          if(confirmedTxnIdsV322.has(x.transactionId)&&String(found.row[13]||"")!=="NON_INVENTORY")sh.getRange(found.index,14).setValue("PENDING_IMPORT_LINK");
          sh.getRange(found.index,24,1,2).setValues([["deleted",now]]);

          const newLinkId="spl_"+Utilities.getUuid();
          x.linkId=newLinkId;
          const replacementStatus=x.nonInventory&&(saveMode==="confirm"||confirmedTxnIdsV322.has(x.transactionId))?"NON_INVENTORY":(saveMode==="draft"&&!confirmedTxnIdsV322.has(x.transactionId))?"DRAFT_INVENTORY_CHANGED":"PENDING_IMPORT_LINK";
          appends.push([newLinkId,date,type,location,x.productId,x.productName,x.quantity,x.actualPrice,x.localDelivery,x.extraFee,x.remark,now,now,replacementStatus,x.averageCost,x.commissionRate,x.commissionAmount,x.profit,x.profitRate,x.minimumPrice,x.transactionId,x.productOrder,x.unitPrice,"active","",saveMode==="confirm"||confirmedTxnIdsV322.has(x.transactionId)]);
        }else{
          const createdAt=found.row[11]||now;
          const oldStatus=String(found.row[13]||"PENDING_IMPORT_LINK");
          // V29.9: only quantity change is an inventory change for the same product identity.
          // Price/cost/commission/shipping/extra fee/remark edits must NOT create a new inventory reminder.
          const inventoryChanged=Number(found.row[6]||0)!==Number(x.quantity||0);
          let status;
          const txnWasConfirmedV322=confirmedTxnIdsV322.has(x.transactionId);
          if(oldStatus==="NON_INVENTORY"&&!x.productId){status="NON_INVENTORY";}
          else if(saveMode==="draft"){
            if(txnWasConfirmedV322){
              // Confirmed once = confirmed forever. Price/cost/commission-only edits
              // do not need inventory work; qty edits do. An unprocessed first sale
              // remains pending regardless of what is edited.
              if(oldStatus==="PENDING_IMPORT_LINK")status="PENDING_IMPORT_LINK";
              else if(oldStatus==="INVENTORY_CONFIRMED"&&!inventoryChanged)status="INVENTORY_CONFIRMED";
              else status="PENDING_IMPORT_LINK";
            }else{
              if(oldStatus==="DRAFT"&&!inventoryChanged)status="DRAFT";
              else status="DRAFT_INVENTORY_CHANGED";
            }
          }else{
            status=x.nonInventory?"NON_INVENTORY":(oldStatus==="INVENTORY_CONFIRMED"&&!inventoryChanged)?"INVENTORY_CONFIRMED":"PENDING_IMPORT_LINK";
          }
          updates.push({row:found.index,values:[x.linkId,date,type,location,x.productId,x.productName,x.quantity,x.actualPrice,x.localDelivery,x.extraFee,x.remark,createdAt,now,status,x.averageCost,x.commissionRate,x.commissionAmount,x.profit,x.profitRate,x.minimumPrice,x.transactionId,x.productOrder,x.unitPrice,"active","",saveMode==="confirm"||txnWasConfirmedV322]});
        }
      }else{
        const newStatus=x.nonInventory&&(saveMode==="confirm"||confirmedTxnIdsV322.has(x.transactionId))?"NON_INVENTORY":(saveMode==="draft"&&!confirmedTxnIdsV322.has(x.transactionId))?"DRAFT":"PENDING_IMPORT_LINK";
        appends.push([x.linkId,date,type,location,x.productId,x.productName,x.quantity,x.actualPrice,x.localDelivery,x.extraFee,x.remark,now,now,newStatus,x.averageCost,x.commissionRate,x.commissionAmount,x.profit,x.profitRate,x.minimumPrice,x.transactionId,x.productOrder,x.unitPrice,"active","",saveMode==="confirm"||confirmedTxnIdsV322.has(x.transactionId)]);
      }
    });
    // V29.9: one edited transaction normally occupies adjacent rows.
    // Write adjacent dirty rows in one setValues call instead of one server call per product.
    updates.sort((a,b)=>a.row-b.row);
    for(let i=0;i<updates.length;){
      let j=i+1;
      while(j<updates.length&&updates[j].row===updates[j-1].row+1)j++;
      const block=updates.slice(i,j);
      sh.getRange(block[0].row,1,block.length,26).setValues(block.map(u=>u.values));
      i=j;
    }
    if(appends.length)sh.getRange(sh.getLastRow()+1,1,appends.length,26).setValues(appends);
    const linkedCardCount=new Set([...otherTxnIds,...batchTxnIds]).size;
    const statusById={},confirmedById={};updates.forEach(u=>{statusById[String(u.values[0])]=String(u.values[13]||"PENDING_IMPORT_LINK");confirmedById[String(u.values[0])]=u.values[25]===true});appends.forEach(r=>{statusById[String(r[0])]=String(r[13]||"PENDING_IMPORT_LINK");confirmedById[String(r[0])]=r[25]===true});const links=normalized.map(x=>({linkId:x.linkId,date:dateText,type,location,productId:x.productId,productName:x.productName,quantity:x.quantity,unitPrice:x.unitPrice,actualPrice:x.actualPrice,localDelivery:x.localDelivery,extraFee:x.extraFee,remark:x.remark,averageCost:x.averageCost,minimumPrice:x.minimumPrice,commissionRate:x.commissionRate,commissionAmount:x.commissionAmount,profit:x.profit,profitRate:x.profitRate,transactionId:x.transactionId,productOrder:x.productOrder,importSyncStatus:statusById[x.linkId]||"PENDING_IMPORT_LINK",confirmedOnce:confirmedById[x.linkId]===true}));
    // V32.6: EVERY saved-card edit (price/qty/add/remove) must advance revisions.
    // Previously an in-place price edit could leave another phone on an old RM total.
    const dataRevision=bumpDataRevision_();
    const salesCardRevision=bumpPriorityCardV315_();
    appendSyncChangeV456_("card",type,dateText,location,salesCardRevision);
    if(mutationPropsV349_&&clientSequence>lastMutationV349_)mutationPropsV349_.setProperty(mutationKeyV349_,String(clientSequence));
    return{ok:true,saved:normalized.length,links,officialSalesAmount:official,linkedActualPriceTotal:otherPrice+batchPrice,linkedCardCount:linkedCardCount,warning:"",dataRevision,salesCardRevision};
  }finally{lock.releaseLock()}
}


function confirmSalesCardInventoryV249_(p){
  const type=normalizeType(String(p.type||"")),dateText=String(p.date||""),locationRaw=String(p.location||""),transactionId=String(p.transactionId||"").trim(),linkId=String(p.linkId||"").trim();
  if(!["fair","live","daily"].includes(type)||!dateText||!locationRaw||(!transactionId&&!linkId))throw new Error("库存确认资料不完整");
  const location=type==="daily"?displayCompany(normalizeCompany(locationRaw||'Belimbing')):type==="live"?canonicalLiveHost(locationRaw):canonicalLocation(locationRaw);
  const sh=getSalesProductLinkSheetV203_(),last=sh.getLastRow();if(last<2)throw new Error("找不到销售卡资料");
  const vals=sh.getRange(2,1,last-1,26).getValues(),rows=[];
  let alreadyConfirmed=0;
  let targetTransactionId=transactionId;
  if(!targetTransactionId&&linkId){const target=vals.find(r=>String(r[0]||'').trim()===linkId);targetTransactionId=String(target?.[20]||'').trim();}
  vals.forEach((r,i)=>{
    const rd=r[1] instanceof Date?formatDateForApp(r[1]):String(r[1]||"");
    const rl=type==="daily"?displayCompany(normalizeCompany(String(r[3]||'Belimbing'))):type==="live"?canonicalLiveHost(String(r[3]||"")):canonicalLocation(String(r[3]||""));
    const sameContext=String(r[2]||"")===type&&rd===dateText&&rl===location&&String(r[4]||"");
    const sameTarget=targetTransactionId?String(r[20]||"").trim()===targetTransactionId:String(r[0]||"").trim()===linkId;
    if(!sameTarget)return;
    const currentStatus=String(r[13]||"").trim();
    const hasInventoryProduct=String(r[4]||'').trim()!=='';
    if(currentStatus==="INVENTORY_CONFIRMED"&&hasInventoryProduct){alreadyConfirmed++;return}
    // V32.7: immutable IDs are authoritative; Restore formatting must not
    // prevent a valid Import acknowledgement from closing the exact line.
    if(hasInventoryProduct&&currentStatus==="PENDING_IMPORT_LINK"&&(linkId||sameContext))rows.push(i+2);
  });
  if(!rows.length&&!alreadyConfirmed)throw new Error(linkId?"找不到待处理的产品库存记录":"这张销售卡没有待处理的 Import 库存项目");
  const lock=LockService.getScriptLock();lock.waitLock(8000);
  try{
    rows.sort((a,b)=>a-b);
    for(let i=0;i<rows.length;){
      let j=i+1;while(j<rows.length&&rows[j]===rows[j-1]+1)j++;
      const block=rows.slice(i,j);
      sh.getRange(block[0],14,block.length,1).setValues(block.map(()=>["INVENTORY_CONFIRMED"]));
      i=j;
    }
    // V46.0: Import completes and locks the entire Sales Card. Inventory rows
    // are confirmed; every manual/one-off sibling is finalized as NON_INVENTORY.
    const wholeCardRows=[];
    vals.forEach((r,i)=>{if(targetTransactionId&&String(r[20]||'').trim()===targetTransactionId&&!['deleted','cancelled'].includes(String(r[23]||'active').toLowerCase()))wholeCardRows.push(i+2)});
    wholeCardRows.forEach(row=>{
      const r=vals[row-2],status=String(r[4]||'').trim()?'INVENTORY_CONFIRMED':'NON_INVENTORY';
      sh.getRange(row,14).setValue(status);sh.getRange(row,26).setValue(true);
    });
    bumpDataRevision_();
    // V32.6: Import is authoritative for inventory completion. Advance the
    // foreground sales-card revision as soon as Import ACKs a line so every
    // open phone/computer stops showing “等待 Import” without a hard refresh.
    const ackRevisionV456=bumpPriorityCardV315_();
    appendSyncChangeV456_("card",type,dateText,location,ackRevisionV456);
  }finally{lock.releaseLock()}
  return{ok:true,transactionId:targetTransactionId||transactionId,linkId,confirmed:rows.length,alreadyConfirmed:false};
}


function getPendingInventorySalesCardsV250_(){
  runOneTimeAckRepairV403_();
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SALES_PRODUCT_LINK_SHEET_V203_);
  if(!sh||sh.getLastRow()<2)return{ok:true,items:[],count:0};
  const vals=sh.getRange(2,1,sh.getLastRow()-1,25).getValues(),items=[],resolveProductId=getImportProductIdResolverV436_();
  vals.forEach(r=>{
    const rowRecordStatus=String(r[23]||"active").toLowerCase();
    if(rowRecordStatus==="cancelled")return;
    const productId=resolveProductId(String(r[4]||"").trim(),String(r[5]||"").trim()),status=String(r[13]||"");
    // V32.6: a deleted PENDING row is a +stock difference after a confirmed
    // sale correction. Keep it in the pending feed so Sales still shows the
    // Import-processing reminder and Import can reconcile the tombstone.
    if(!productId||status!=="PENDING_IMPORT_LINK")return;
    const type=normalizeType(String(r[2]||""));if(!["live","fair","daily"].includes(type))return;
    const date=r[1] instanceof Date?formatDateForApp(r[1]):String(r[1]||"");
    const location=type==="daily"?displayCompany(normalizeCompany(String(r[3]||'Belimbing'))):type==="live"?canonicalLiveHost(String(r[3]||"")):canonicalLocation(String(r[3]||""));
    const transactionId=String(r[20]||"").trim(),linkId=String(r[0]||"").trim();if(!date||!location||!transactionId||!linkId)return;
    const created=r[11] instanceof Date?r[11]:parseDateTimeFromApp(String(r[11]||""));
    items.push({type,date,location,transactionId,saleId:transactionId,linkId,productId,productName:String(r[5]||"").trim(),quantity:Math.max(1,Number(r[6]||1)),productOrder:Math.max(1,Number(r[21]||1)),status:rowRecordStatus,saleTime:created?Utilities.formatDate(created,Session.getScriptTimeZone(),"HH:mm:ss"):"",updatedAt:r[12] instanceof Date?formatDateTimeForApp(r[12]):String(r[12]||"")});
  });
  items.sort((a,b)=>{const ad=parseDateFromApp(a.date),bd=parseDateFromApp(b.date),at=ad?ad.getTime():0,bt=bd?bd.getTime():0;return at-bt||String(a.type).localeCompare(String(b.type))||String(a.location).localeCompare(String(b.location))||String(a.transactionId).localeCompare(String(b.transactionId));});
  return{ok:true,version:"27.0",perProduct:true,items,count:items.length};
}

function getSalesInventoryAckStatusV408_(p){
  let ids=[];try{ids=JSON.parse(String(p.linkIdsJson||"[]"))}catch(_){ids=[]}
  const wanted=new Set((Array.isArray(ids)?ids:[]).map(String).filter(Boolean));
  if(!wanted.size)return{ok:true,items:[]};
  const sh=getSalesProductLinkSheetV203_(),last=sh.getLastRow();if(last<2)return{ok:true,items:[]};
  const vals=sh.getRange(2,1,last-1,14).getDisplayValues(),items=[];
  vals.forEach(r=>{const id=String(r[0]||"");if(wanted.has(id))items.push({linkId:id,status:String(r[13]||"")})});
  return{ok:true,items};
}



/* ================= V29.9 P4 Sales Inventory Feed ================= */
function deleteSalesTransactionV256_(p){
  const saleId=String(p.saleId||p.transactionId||"").trim();if(!saleId)throw new Error("缺少 saleId");
  const expectedSalesCardRevisionRaw=String(p.expectedSalesCardRevision===undefined?"":p.expectedSalesCardRevision).trim();
  const hasExpectedSalesCardRevision=expectedSalesCardRevisionRaw!==""&&Number.isFinite(Number(expectedSalesCardRevisionRaw));
  const expectedSalesCardRevision=hasExpectedSalesCardRevision?Number(expectedSalesCardRevisionRaw):null;
  const sh=getSalesProductLinkSheetV203_(),last=sh.getLastRow();if(last<2)return{ok:true,saleId,deleted:0,status:"deleted"};
  const vals=sh.getRange(2,1,last-1,25).getValues(),targets=[];
  let hasConfirmedSale=false;
  vals.forEach((r,i)=>{
    if(String(r[20]||"").trim()!==saleId)return;
    targets.push(i+2);
    const st=String(r[13]||"").trim();
    if(!["DRAFT","DRAFT_INVENTORY_CHANGED"].includes(st))hasConfirmedSale=true;
  });
  if(hasConfirmedSale)throw new Error("这张销售卡已经确认销售，不能删除");
  if(!targets.length)return{ok:true,saleId,deleted:0,status:"deleted"};
  const lock=LockService.getScriptLock();lock.waitLock(8000);
  try{
    const currentSalesCardRevisionV450=getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_);
    const deleteCtxV456=targets.length?vals[targets[0]-2]:null;
    const deleteTypeV456=deleteCtxV456?normalizeType(String(deleteCtxV456[2]||'')):'';
    const deleteDateV456=deleteCtxV456?(deleteCtxV456[1] instanceof Date?formatDateForApp(deleteCtxV456[1]):String(deleteCtxV456[1]||'')):'';
    const deleteLocV456=deleteCtxV456?String(deleteCtxV456[3]||''):'';
    if(hasExpectedSalesCardRevision&&expectedSalesCardRevision!==currentSalesCardRevisionV450&&salesCardRevisionConflictV456_(expectedSalesCardRevision,deleteTypeV456,deleteDateV456,deleteLocV456,currentSalesCardRevisionV450)){
      throw new Error("这一个销售卡 context 已有其他设备的新修改，本次删除已停止。请先同步这张卡后再删除。");
    }
    const now=new Date();
    // V46.0: a multi-product Sales Card normally occupies adjacent rows. Batch
    // timestamp + tombstone writes by contiguous blocks instead of two calls per
    // product; this shortens the critical section without changing delete rules.
    const sortedTargets=[...targets].sort((a,b)=>a-b);
    for(let i=0;i<sortedTargets.length;){
      let j=i+1;while(j<sortedTargets.length&&sortedTargets[j]===sortedTargets[j-1]+1)j++;
      const block=sortedTargets.slice(i,j),start=block[0],len=block.length;
      sh.getRange(start,13,len,1).setValues(block.map(()=>[now]));
      sh.getRange(start,24,len,2).setValues(block.map(()=>["deleted",now]));
      i=j;
    }
    // Update the in-memory snapshot too, so the success response can carry the
    // complete authoritative context and the browser does not need a second trip.
    targets.forEach(row=>{const r=vals[row-2];if(r){r[12]=now;r[23]="deleted";r[24]=now;}});
    const dataRevision=bumpDataRevision_();
    const salesCardRevision=bumpPriorityCardV315_();
    const firstTargetV456=targets.length?vals[targets[0]-2]:null;
    if(firstTargetV456)appendSyncChangeV456_("card",normalizeType(String(firstTargetV456[2]||"")),firstTargetV456[1] instanceof Date?formatDateForApp(firstTargetV456[1]):String(firstTargetV456[1]||""),String(firstTargetV456[3]||""),salesCardRevision);
    const contextLinksV459=deleteCtxV456?normalizeSalesCardTransactionStatesV430_(dedupeActiveSalesProductLinksV354_(vals.filter(r=>sameSalesProductLinkContextV206_(r,deleteTypeV456,deleteDateV456,deleteLocV456)&&!["deleted","cancelled"].includes(String(r[23]||"active").toLowerCase())).map(salesProductLinkRowToObjV206_))):[];
    return{ok:true,saleId,deleted:targets.length,status:"deleted",deletedAt:formatDateTimeForApp(now),dataRevision,salesCardRevision,type:deleteTypeV456,date:deleteDateV456,location:deleteLocV456,links:contextLinksV459};
  }finally{lock.releaseLock()}
}
// V46.0 timeout verifier: front-end timeout is not a delete failure. Read only
// the saleId/status columns first; if the card is gone, return the exact context
// authority so Card + Profit can commit together without a full-system refresh.
function verifySalesTransactionDeletedV459_(p){
  const saleId=String(p.saleId||p.transactionId||"").trim();if(!saleId)throw new Error("缺少 saleId");
  const type=normalizeType(String(p.type||"")),dateText=String(p.date||""),location=String(p.location||"");
  const sh=getSalesProductLinkSheetV203_(),last=sh.getLastRow();
  if(last<2)return{ok:true,saleId,deleted:true,exists:false,links:[],salesCardRevision:getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_),dataRevision:getDataRevision_()};
  const count=last-1;
  const saleStillExistsV459=()=>sh.getRange(2,21,Math.max(0,sh.getLastRow()-1),4).getValues().some(r=>String(r[0]||"").trim()===saleId&&!["deleted","cancelled"].includes(String(r[3]||"active").toLowerCase()));
  let exists=saleStillExistsV459();
  // The original delete execution may still be finishing after the browser's
  // timeout. Keep this as ONE verification request, but give that write a short
  // grace window before declaring that the card truly still exists.
  if(exists){Utilities.sleep(1200);exists=saleStillExistsV459();}
  let links=[];
  if(!exists&&["fair","live","daily"].includes(type)&&dateText&&location){
    links=normalizeSalesCardTransactionStatesV430_(dedupeActiveSalesProductLinksV354_(getSalesProductContextRowsV459_(sh,type,dateText,location).map(salesProductLinkRowToObjV206_)));
  }
  return{ok:true,saleId,deleted:!exists,exists,links,salesCardRevision:getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_),dataRevision:getDataRevision_()};
}

function getSalesInventoryFeedV256_(p){
  runOneTimeAckRepairV403_();
  const sh=getSalesProductLinkSheetV203_();ensureLegacySaleIdsV258_(sh);
  const last=sh.getLastRow();if(last<2)return{ok:true,version:"27.0",readOnly:true,items:[],count:0};
  const vals=sh.getRange(2,1,last-1,25).getValues(),items=[],resolveProductId=getImportProductIdResolverV436_();
  vals.forEach(r=>{
    if(!r[0])return;
    const o=salesProductLinkRowToObjV206_(r),type=normalizeType(o.type);if(!["live","fair","daily"].includes(type))return;
    // V32.6: Draft means NOT confirmed sale.  Never expose DRAFT /
    // DRAFT_INVENTORY_CHANGED to Import Cost System.  Import only receives a
    // sale after the user explicitly presses “确认销售”.
    const importStatus=String(o.importSyncStatus||"").trim();
    if(!["PENDING_IMPORT_LINK","INVENTORY_CONFIRMED"].includes(importStatus))return;
    const created=r[11] instanceof Date?r[11]:parseDateTimeFromApp(o.createdAt);
    items.push({saleId:o.saleId,productId:resolveProductId(o.productId,o.productName),productName:o.productName,quantity:o.quantity,location:o.location,host:type==="live"?o.location:"",fairLocation:type==="fair"?o.location:"",saleDate:o.date,saleTime:created?Utilities.formatDate(created,Session.getScriptTimeZone(),"HH:mm:ss"):"",type,status:o.status||"active",productOrder:o.productOrder,linkId:o.linkId,createdAt:o.createdAt,updatedAt:o.updatedAt,deletedAt:o.deletedAt,importSyncStatus:o.importSyncStatus,remark:o.remark});
  });
  items.sort((a,b)=>String(a.updatedAt).localeCompare(String(b.updatedAt))||String(a.saleId).localeCompare(String(b.saleId))||a.productOrder-b.productOrder);
  return{ok:true,version:"27.0",readOnly:true,items,count:items.length};
}

// One-time ACK-only repair for the already-processed 02-09-2026 PZ0061
// deletion residue. It changes no inventory, History, FIFO or Sales Key.
function runOneTimeAckRepairV403_(){
  const props=PropertiesService.getScriptProperties(),key="V404_ACK_AND_CONFIRM_CARD_02092026";
  if(props.getProperty(key)==="done")return 0;
  const sh=getSalesProductLinkSheetV203_(),last=sh.getLastRow();if(last<2)return 0;
  const vals=sh.getRange(2,1,last-1,26).getValues();let changed=0;
  const contextRows=vals.map((r,i)=>({r,i})).filter(x=>{
    const date=x.r[1] instanceof Date?formatDateForApp(x.r[1]):String(x.r[1]||"");
    return date==="02-09-2026"&&String(x.r[2]||"")==="fair"&&normalizeFairLocationKey(String(x.r[3]||""))===normalizeFairLocationKey("Pavilion Bukit Jalil-Adenium");
  });
  const targetTxnIds=new Set();
  contextRows.forEach(x=>{
    const tx=String(x.r[20]||"").trim();if(!tx)return;
    const sameTxn=contextRows.filter(y=>String(y.r[20]||"").trim()===tx);
    const hasFlower=sameTxn.some(y=>String(y.r[5]||"").trim()==="富贵花");
    const hasPz=sameTxn.some(y=>String(y.r[4]||"").trim()==="PZ0061"||String(y.r[5]||"").trim()==="大厚黄杨高提根1200");
    if(hasFlower&&hasPz)targetTxnIds.add(tx);
  });
  if(!targetTxnIds.size)return 0;
  contextRows.forEach(({r,i})=>{
    if(!targetTxnIds.has(String(r[20]||"").trim()))return;
    const productId=String(r[4]||"").trim(),name=String(r[5]||"").trim();
    let desired="";
    if(productId==="PZ0061"||name==="大厚黄杨高提根1200")desired="INVENTORY_CONFIRMED";
    else if(!productId&&name==="富贵花")desired="NON_INVENTORY";
    if(!desired)return;
    if(String(r[13]||"")!==desired){sh.getRange(i+2,14).setValue(desired);changed++;}
    if(r[25]!==true){sh.getRange(i+2,26).setValue(true);changed++;}
  });
  props.setProperty(key,"done");if(changed){bumpDataRevision_();bumpPriorityCardV315_();}return changed;
}

function dedupeActiveSalesProductLinksV354_(links){
  const map={};
  (Array.isArray(links)?links:[]).forEach((x,index)=>{
    const tx=String(x&& (x.transactionId||x.saleId)||"").trim(),order=Math.max(1,Number(x&&x.productOrder||1));
    const key=tx?[String(x.type||""),String(x.date||""),normalizeFairLocationKey(String(x.location||"")),tx,String(order)].join("|"):String(x.linkId||"").trim();
    const prev=map[key];
    const time=Date.parse(String(x.updatedAt||x.createdAt||""))||0;
    if(!prev||time>prev.time||(time===prev.time&&index>prev.index))map[key]={x:x,time:time,index:index};
  });
  return Object.keys(map).map(k=>map[k]).sort((a,b)=>a.index-b.index).map(v=>v.x);
}

function getAllSalesProductLinksV203_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SALES_PRODUCT_LINK_SHEET_V203_);
  if(!sh||sh.getLastRow()<2)return{ok:true,links:[],salesCardRevision:getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_),dataRevision:getDataRevision_()};
  ensureLegacySaleIdsV258_(sh);
  const vals=sh.getRange(2,1,sh.getLastRow()-1,26).getValues();
  const active=vals.filter(r=>r[0]&&!['deleted','cancelled'].includes(String(r[23]||'active').toLowerCase())).map(salesProductLinkRowToObjV206_);
  return{ok:true,links:normalizeSalesCardTransactionStatesV430_(dedupeActiveSalesProductLinksV354_(active)),salesCardRevision:getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_),dataRevision:getDataRevision_()};
}
function restoreSalesProductLinksV203_(links){
  const sh=getSalesProductLinkSheetV203_(),last=sh.getLastRow();if(last>1)sh.getRange(2,1,last-1,26).clearContent();
  const list=Array.isArray(links)?links:[];if(!list.length)return;
  const vals=list.map(x=>{const restoredStatus=String(x.importSyncStatus||"").trim();const safeStatus=["DRAFT","DRAFT_INVENTORY_CHANGED","PENDING_IMPORT_LINK","INVENTORY_CONFIRMED","NON_INVENTORY"].includes(restoredStatus)?restoredStatus:"DRAFT";const confirmedOnce=x.confirmedOnce===true||["PENDING_IMPORT_LINK","INVENTORY_CONFIRMED","NON_INVENTORY"].includes(safeStatus);return[String(x.linkId||("spl_"+Utilities.getUuid())),parseDateFromApp(String(x.date||""))||new Date(),normalizeType(String(x.type||"")),String(x.location||""),String(x.productId||""),String(x.productName||""),Math.max(0,Number(x.quantity||0)),Number(x.actualPrice||0),Number(x.localDelivery||0),Number(x.extraFee||0),String(x.remark||"").slice(0,100),parseDateTimeFromApp(x.createdAt)||new Date(),parseDateTimeFromApp(x.updatedAt)||new Date(),safeStatus,Math.max(0,Number(x.averageCost||0)),Math.max(0,Number(x.commissionRate||0)),Number(x.commissionAmount||0),Number(x.profit||0),Number(x.profitRate||0),Math.max(0,Number(x.minimumPrice||0)),String(x.saleId||x.transactionId||("txn_"+Utilities.getUuid())),Math.max(1,Number(x.productOrder||1)),Math.max(0,Number(x.unitPrice!==undefined?x.unitPrice:((Number(x.quantity||1)>0)?Number(x.actualPrice||0)/Number(x.quantity||1):Number(x.actualPrice||0)))),String(x.status||"active"),parseDateTimeFromApp(x.deletedAt)||"",confirmedOnce]});
  sh.getRange(2,1,vals.length,26).setValues(vals);
}

/* ================= V29.9 Sales / Fair / Live audit timeline ================= */
const SALES_CHANGE_LOG_SHEET_V200_ = "_Sales_Change_Log";

function getSalesChangeLogSheetV200_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let sheet=ss.getSheetByName(SALES_CHANGE_LOG_SHEET_V200_);
  if(!sheet){
    sheet=ss.insertSheet(SALES_CHANGE_LOG_SHEET_V200_);
    sheet.getRange(1,1,1,8).setValues([["Date","Type","Company","Location / Host","Old Amount","New Amount","Difference","Changed At"]]);
    sheet.setFrozenRows(1);
    sheet.getRange("A:A").setNumberFormat("dd-MM-yyyy");
    sheet.getRange("E:G").setNumberFormat("#,##0.00");
    sheet.getRange("H:H").setNumberFormat("dd-MM-yyyy HH:mm:ss");
    // V29.9: keep the audit sheet visible so the owner can verify records directly in Google Sheets.
  }
  if(sheet.isSheetHidden()) sheet.showSheet();
  return sheet;
}

// V36.0: repair a missing Fair/Live turnover audit only when an older audit
// already exists for the exact key and its final amount differs from the
// authoritative amount just confirmed in the monthly sheet. This never
// creates Sales_Product_Links and therefore cannot duplicate card profit.
function collectMissingSalesChangeLogsV355_(records, explicitChanges){
  const targets=(Array.isArray(records)?records:[]).filter(r=>r&&r.date&&(r.type==="fair"||r.type==="live"));
  if(!targets.length)return[];
  const changedKeys=new Set((Array.isArray(explicitChanges)?explicitChanges:[]).map(c=>rowKey({type:c.type,date:c.date,company:c.company,location:c.location,amount:c.newAmount,updatedAt:""})));
  const sheet=getSalesChangeLogSheetV200_(),last=sheet.getLastRow();
  if(last<2)return[];
  const vals=sheet.getRange(2,1,last-1,8).getValues();
  const latest={};
  vals.forEach(row=>{
    const date=row[0] instanceof Date?formatDateForApp(row[0]):formatDateForApp(parseDateFromApp(String(row[0]||"")));
    const type=normalizeType(String(row[1]||""));
    const company=type==="fair"?"fair":normalizeCompany(String(row[2]||""));
    const location=type==="live"?canonicalLiveHost(String(row[3]||"")):canonicalLocation(String(row[3]||""));
    if(!date||!type)return;
    const key=rowKey({type,date,company,location,amount:Number(row[5]||0),updatedAt:""});
    latest[key]={type,date,company,location,newAmount:Number(row[5]||0)};
  });
  const repairs=[];
  targets.forEach(r=>{
    const type=normalizeType(String(r.type||"")),date=r.date instanceof Date?formatDateForApp(r.date):String(r.date||"");
    const company=type==="fair"?"fair":normalizeCompany(String(r.company||""));
    const location=type==="live"?canonicalLiveHost(String(r.location||"")):canonicalLocation(String(r.location||""));
    const key=rowKey({type,date,company,location,amount:Number(r.amount||0),updatedAt:""});
    if(changedKeys.has(key))return;
    const prev=latest[key];
    const current=Number(r.amount||0);
    if(prev&&Number.isFinite(current)&&Math.abs(Number(prev.newAmount||0)-current)>0.005){
      repairs.push({action:"modified",type,date,company,location,oldAmount:Number(prev.newAmount||0),newAmount:current});
      latest[key]={type,date,company,location,newAmount:current};
    }
  });
  return repairs;
}

function appendSalesChangeLogsUnlockedV200_(changes, changedAt){
  const list=(Array.isArray(changes)?changes:[]).filter(change=>{
    const oldAmount=Number(change&&change.oldAmount||0);
    const newAmount=Number(change&&change.newAmount||0);
    return Number.isFinite(oldAmount)&&Number.isFinite(newAmount)&&oldAmount!==newAmount;
  });
  if(!list.length)return;
  const sheet=getSalesChangeLogSheetV200_();
  const when=changedAt instanceof Date&&!isNaN(changedAt.getTime())?changedAt:new Date();
  const values=list.map(change=>[
    parseDateFromApp(String(change.date||""))||new Date(),
    normalizeType(String(change.type||"")),
    normalizeType(String(change.type||""))==="fair"?"fair":normalizeCompany(String(change.company||"")),
    normalizeType(String(change.type||""))==="live"?canonicalLiveHost(String(change.location||"")):canonicalLocation(String(change.location||"")),
    Number(change.oldAmount||0),
    Number(change.newAmount||0),
    Number(change.newAmount||0)-Number(change.oldAmount||0),
    when
  ]);
  sheet.getRange(sheet.getLastRow()+1,1,values.length,8).setValues(values);
}


function salesChangeLogRowToObjV236_(row){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const tz=ss.getSpreadsheetTimeZone()||Session.getScriptTimeZone();
  const date=row[0] instanceof Date?formatDateForApp(row[0]):String(row[0]||"");
  const changedAt=row[7] instanceof Date?row[7]:parseDateTimeFromApp(row[7]);
  return{
    date,
    type:normalizeType(String(row[1]||"")),
    company:normalizeCompany(String(row[2]||"")),
    location:normalizeType(String(row[1]||""))==="live"?canonicalLiveHost(String(row[3]||"")):canonicalLocation(String(row[3]||"")),
    oldAmount:Number(row[4]||0),
    newAmount:Number(row[5]||0),
    delta:Number(row[6]||0),
    changedAt:changedAt?Utilities.formatDate(changedAt,tz,"dd-MM-yyyy HH:mm:ss"):""
  };
}
function getAllSalesChangeLogsV236_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName(SALES_CHANGE_LOG_SHEET_V200_);
  if(!sheet||sheet.getLastRow()<2)return{ok:true,logs:[]};
  if(sheet.isSheetHidden())sheet.showSheet();
  const values=sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues();
  return{ok:true,logs:values.filter(r=>r[0]).map(salesChangeLogRowToObjV236_)};
}
function restoreSalesChangeLogsV236_(payload){
  const sheet=getSalesChangeLogSheetV200_(),last=sheet.getLastRow();
  if(last>1)sheet.getRange(2,1,last-1,8).clearContent();

  let logs=Array.isArray(payload&&payload.salesChangeLogs)?payload.salesChangeLogs:null;

  // Old Backup files (before V29.9) did not contain the audit timeline.
  // Rebuild one trustworthy baseline row per official sales record so restored
  // totals agree with the restored sales data and stale pre-Restore edits cannot survive.
  if(!logs){
    logs=(Array.isArray(payload&&payload.rows)?payload.rows:[])
      .filter(r=>["daily","fair","live"].includes(normalizeType(String(r.type||""))))
      .filter(r=>Number(r.amount||0)!==0)
      .map(r=>({
        date:String(r.date||""),
        type:normalizeType(String(r.type||"")),
        company:normalizeCompany(String(r.company||"")),
        location:normalizeType(String(r.type||""))==="live"?canonicalLiveHost(String(r.location||"")):canonicalLocation(String(r.location||"")),
        oldAmount:0,
        newAmount:Number(r.amount||0),
        delta:Number(r.amount||0),
        changedAt:String(r.updatedAt||"")
      }));
  }

  if(!logs.length)return 0;
  const values=logs.map(x=>{
    const type=normalizeType(String(x.type||""));
    const oldAmount=Number(x.oldAmount||0),newAmount=Number(x.newAmount||0);
    return[
      parseDateFromApp(String(x.date||""))||new Date(),
      type,
      normalizeCompany(String(x.company||"")),
      type==="live"?canonicalLiveHost(String(x.location||"")):canonicalLocation(String(x.location||"")),
      oldAmount,
      newAmount,
      Number.isFinite(Number(x.delta))?Number(x.delta):newAmount-oldAmount,
      parseDateTimeFromApp(String(x.changedAt||""))||new Date()
    ];
  });
  sheet.getRange(2,1,values.length,8).setValues(values);
  return values.length;
}

function getSalesChangeLogV200_(p){
  const type=normalizeType(String(p.type||""));
  const date=parseDateFromApp(String(p.date||""));
  const wantedLocation=type==="fair"?normalizeFairLocationKey(String(p.location||"")):"";
  if(!date||!["daily","fair","live"].includes(type))throw new Error("新增 / 修改记录参数无效");
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sheet=ss.getSheetByName(SALES_CHANGE_LOG_SHEET_V200_);
  if(!sheet||sheet.getLastRow()<2)return{ok:true,type,date:formatDateForApp(date),logs:[]};
  if(sheet.isSheetHidden()) sheet.showSheet();
  const values=sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues();
  const wantedDate=formatDateForApp(date);
  const tz=ss.getSpreadsheetTimeZone()||Session.getScriptTimeZone();
  const logs=[];
  values.forEach(row=>{
    const rowDate=row[0] instanceof Date?row[0]:parseDateFromApp(String(row[0]||""));
    if(!rowDate||formatDateForApp(rowDate)!==wantedDate)return;
    const rowType=normalizeType(String(row[1]||""));
    if(rowType!==type)return;
    if(rowType==="fair"&&wantedLocation&&normalizeFairLocationKey(String(row[3]||""))!==wantedLocation)return;
    const changedAt=row[7] instanceof Date?row[7]:parseDateTimeFromApp(row[7]);
    logs.push({
      type:rowType,
      date:wantedDate,
      company:normalizeCompany(String(row[2]||"")),
      location:rowType==="live"?canonicalLiveHost(String(row[3]||"")):canonicalLocation(String(row[3]||"")),
      oldAmount:Number(row[4]||0),
      newAmount:Number(row[5]||0),
      delta:Number(row[6]||0),
      action:Number(row[4]||0)<=0&&Number(row[5]||0)>0?"added":(Number(row[4]||0)>0&&Number(row[5]||0)<=0?"deleted":"modified"),
      time:changedAt?Utilities.formatDate(changedAt,tz,"h:mm a"):"",
      timestampMs:changedAt?changedAt.getTime():0
    });
  });
  logs.sort((a,b)=>Number(a.timestampMs||0)-Number(b.timestampMs||0));
  return{ok:true,type,date:wantedDate,logs};
}

function saveDaily(p){
  const date=parseDateFromApp(String(p.date||""));
  if(!date)throw new Error("Missing date");
  assertWritableDateV8(date);
  const company=normalizeCompany(String(p.company||"")),amount=Number(p.amount||0);
  if(!company)throw new Error("Missing company");

  // V32.6: Sales cards mainly record bonsai sales. Turnover may be higher because
  // soil / pots / fertilizer / accessories can be sold without a sales card.
  // Therefore turnover is free when no saved card exists, and otherwise only has
  // one rule: it cannot be lower than the active saved-card total.
  const updatedAt=new Date();
  const saveResult=fastApplyRecordsSafely(
    [{type:"daily",date,company,location:"",amount,updatedAt,preventStaleOverwrite:true,
      baseCloudUpdatedAt:String(p.baseCloudUpdatedAt||""),clientDeviceId:String(p.clientDeviceId||""),clientSequence:Number(p.clientSequence||0),foregroundSave:String(p.foregroundSave||"")==="1",
      validateDailyCardFloor:true,
      notificationAction:String(p.notificationAction||""),notificationAmount:Number(p.notificationAmount||0),notificationOldAmount:Number(p.notificationOldAmount||0),notificationNewAmount:Number(p.notificationNewAmount||0)}],
    true
  );
  const turnoverRevision=bumpPriorityTurnoverV315_();
  appendSyncChangeV456_("turnover","daily",formatDateForApp(date),displayCompany(company),turnoverRevision);
  const notificationEnvelope=buildNotificationEnvelopeV185_(saveResult.changes);
  const inlineNotification=maybeSendKeepaliveNotificationV185_(p,saveResult.changes);

  return{
    ok:true,
    message:"Daily saved",
    dataRevision:saveResult.revision,
    turnoverRevision,
    notificationChangeCount:Array.isArray(saveResult.changes)?saveResult.changes.length:0,
    notificationEnvelope,
    inlineNotification,
    row:(saveResult.rows&&saveResult.rows[0])||{
      type:"daily",
      date:formatDateForApp(date),
      company,
      location:"",
      amount,
      updatedAt:formatDateTimeForApp(updatedAt)
    }
  };
}

function activeSalesCardAmountV268_(type,date,location){
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SALES_PRODUCT_LINK_SHEET_V203_);
  if(!sh||sh.getLastRow()<2)return 0;
  const dateText=formatDateForApp(date),vals=sh.getRange(2,1,sh.getLastRow()-1,25).getValues();
  return vals.reduce((sum,r)=>{
    if(!r[0])return sum;
    const status=String(r[23]||"active").trim().toLowerCase()||"active";
    if(["deleted","cancelled"].includes(status))return sum;
    const rd=r[1] instanceof Date?formatDateForApp(r[1]):String(r[1]||""),rt=normalizeType(String(r[2]||"")),rl=String(r[3]||"");
    if(rd!==dateText||rt!==type)return sum;
    const same=type==="live"?canonicalLiveHost(rl)===canonicalLiveHost(location):canonicalLocation(rl)===canonicalLocation(location);
    return same?sum+Math.max(0,Number(r[7]||0)):sum;
  },0);
}

function saveLive(p){
  const date=parseDateFromApp(String(p.date||""));
  if(!date)throw new Error("Invalid Live date");
  assertWritableDateV8(date);

  const host=canonicalLiveHost(String(p.host||""));
  const amount=Number(p.amount||0);
  if(!host)throw new Error("Invalid Live record");

  const updatedAt=new Date();
  const record={type:"live",date,company:"live",location:host,amount,updatedAt,preventStaleOverwrite:true,
    baseCloudUpdatedAt:String(p.baseCloudUpdatedAt||""),clientDeviceId:String(p.clientDeviceId||""),clientSequence:Number(p.clientSequence||0),foregroundSave:String(p.foregroundSave||"")==="1",validateLiveCardFloor:true,
    notificationAction:String(p.notificationAction||""),notificationAmount:Number(p.notificationAmount||0),notificationOldAmount:Number(p.notificationOldAmount||0),notificationNewAmount:Number(p.notificationNewAmount||0)};
  const saveResult=fastApplyRecordsSafely([record],true);
  const turnoverRevision=bumpPriorityTurnoverV315_();
  appendSyncChangeV456_("turnover","live",formatDateForApp(date),host,turnoverRevision);
  const notificationEnvelope=buildNotificationEnvelopeV185_(saveResult.changes);
  const inlineNotification=maybeSendKeepaliveNotificationV185_(p,saveResult.changes);

  return{
    ok:true,
    message:"Live saved",
    dataRevision:saveResult.revision,
    turnoverRevision,
    notificationChangeCount:Array.isArray(saveResult.changes)?saveResult.changes.length:0,
    notificationEnvelope,
    inlineNotification,
    row:(saveResult.rows&&saveResult.rows[0])||{
      type:"live",
      date:formatDateForApp(date),
      company:"live",
      location:host,
      amount,
      updatedAt:formatDateTimeForApp(updatedAt)
    }
  };
}


const FAIR_SESSION_SHEET_V282_="_Fair_Sessions";
const FAIR_MIGRATION_PROP_V282_="LL_FAIR_COMPANY_MIGRATION_V282";
function formatOperationalSheetsV282_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().forEach(sh=>{
    const name=sh.getName();
    try{
      if(/^\d{4}-\d{2}$/.test(name)){
        ensureHeader(sh);formatSheet(sh);sh.autoResizeColumns(1,6);
        const mins=[80,100,110,190,105,155];mins.forEach((w,i)=>{if(sh.getColumnWidth(i+1)<w)sh.setColumnWidth(i+1,w)});
      }else if(name===SALES_PRODUCT_LINK_SHEET_V203_){
        getSalesProductLinkSheetV203_();sh.autoResizeColumns(1,25);
      }else if(name===SALES_CHANGE_LOG_SHEET_V200_){
        getSalesChangeLogSheetV200_();sh.autoResizeColumns(1,8);
        [95,75,100,180,105,105,105,155].forEach((w,i)=>{if(sh.getColumnWidth(i+1)<w)sh.setColumnWidth(i+1,w)});
      }else if(name===TURNOVER_ENTRY_SHEET_V376_){
        const tsh=getTurnoverEntrySheetV376_();tsh.getRange("B:B").setNumberFormat("dd-MM-yyyy");tsh.getRange("E:E").setNumberFormat("dd-MM-yyyy HH:mm");tsh.autoResizeColumns(1,5);
      }else if(name===FAIR_SESSION_SHEET_V282_){
        sh.getRange("B:C").setNumberFormat("dd-MM-yyyy");sh.getRange("D:D").setNumberFormat("dd-MM-yyyy HH:mm");sh.autoResizeColumns(1,5);
      }
    }catch(_){}
  });
}
function migrateLegacyFairCompanyV282_(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty(FAIR_MIGRATION_PROP_V282_)==="1")return;
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().filter(sh=>/^\d{4}-\d{2}$/.test(sh.getName())).forEach(sh=>{
    const last=sh.getLastRow();if(last<2)return;
    const rg=sh.getRange(2,1,last-1,6),vals=rg.getValues();let changed=false;
    vals.forEach(r=>{if(normalizeType(String(r[0]||""))==="fair"&&normalizeCompany(String(r[2]||""))!=="fair"){r[2]="fair";changed=true}});
    if(changed)rg.setValues(vals);formatSheet(sh);
  });
  const log=ss.getSheetByName(SALES_CHANGE_LOG_SHEET_V200_);
  if(log&&log.getLastRow()>1){const rg=log.getRange(2,1,log.getLastRow()-1,8),vals=rg.getValues();let changed=false;vals.forEach(r=>{if(normalizeType(String(r[1]||""))==="fair"&&normalizeCompany(String(r[2]||""))!=="fair"){r[2]="fair";changed=true}});if(changed)rg.setValues(vals)}
  props.setProperty(FAIR_MIGRATION_PROP_V282_,"1");formatOperationalSheetsV282_();clearLoadCache();bumpDataRevision_();
}
const FAIR_SESSION_SHEET_V281_=FAIR_SESSION_SHEET_V282_;
function getFairSessionSheetV281_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let sh=ss.getSheetByName(FAIR_SESSION_SHEET_V281_);
  if(!sh){
    sh=ss.insertSheet(FAIR_SESSION_SHEET_V281_);
    sh.getRange(1,1,1,5).setValues([["地点","开始日期","结束日期","更新时间","状态"]]);
    sh.hideSheet();
  }
  return sh;
}
function getFairSessionsV281_(){
  migrateLegacyFairCompanyV282_();
  const sh=getFairSessionSheetV281_(),last=sh.getLastRow();
  const vals=last>1?sh.getRange(2,1,last-1,5).getValues():[];
  const byKey=new Map(),activeKeys=new Set(),deletedSeen=new Set();
  vals.forEach(r=>{
    const display=canonicalLocation(String(r[0]||"")),key=normalizeFairLocationKey(display);if(!display||!key)return;
    const status=String(r[4]||"active").toLowerCase();
    if(status==="deleted"){deletedSeen.add(key);return;}
    activeKeys.add(key);
    const item={
      location:display,
      start:r[1] instanceof Date?Utilities.formatDate(r[1],Session.getScriptTimeZone(),"yyyy-MM-dd"):String(r[1]||""),
      end:r[2] instanceof Date?Utilities.formatDate(r[2],Session.getScriptTimeZone(),"yyyy-MM-dd"):String(r[2]||""),
      updatedAt:r[3] instanceof Date?r[3].toISOString():String(r[3]||""),
      status:String(r[4]||"active")
    };
    const old=byKey.get(key);if(!old)byKey.set(key,item);else if(String(item.updatedAt)>String(old.updatedAt))byKey.set(key,{...item,location:old.location});
  });
  const sessions=[...byKey.values()].filter(x=>x.location&&x.start&&x.end);
  sessions.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const deletedKeys=[...deletedSeen].filter(key=>!activeKeys.has(key));
  return{ok:true,sessions,deletedKeys,dataRevision:getDataRevision_()};
}

// V36.0: Fair history is a shared cloud list. Existing legacy session date
// ranges are preserved. A brand-new/re-activated location gets a one-day
// registry row only; the active Fair editor never reads that range.
function ensureFairLocationHistoryV358_(location,date){
  const display=canonicalLocation(String(location||"")),key=normalizeFairLocationKey(display);if(!display||!key)return null;
  const sh=getFairSessionSheetV281_(),last=sh.getLastRow(),vals=last>1?sh.getRange(2,1,last-1,5).getValues():[];
  let active=null;
  vals.forEach((r,i)=>{if(normalizeFairLocationKey(String(r[0]||""))===key&&String(r[4]||"active").toLowerCase()!=="deleted")active={row:i+2,display:canonicalLocation(String(r[0]||""))||display};});
  if(active)return active.display;
  const d=(date instanceof Date&&!isNaN(date.getTime()))?date:new Date();
  sh.getRange(sh.getLastRow()+1,1,1,5).setValues([[display,d,d,new Date(),"active"]]);
  return display;
}
function deleteFairLocationV358_(p){
  const display=canonicalLocation(String(p.location||"")),key=normalizeFairLocationKey(display);if(!display||!key)throw new Error("Fair 地点无效");
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw new Error("系统正在同步其他资料，请稍后再试");
  try{
    const sh=getFairSessionSheetV281_(),last=sh.getLastRow(),vals=last>1?sh.getRange(2,1,last-1,5).getValues():[];
    const now=new Date();let changed=false;
    vals.forEach((r,i)=>{if(normalizeFairLocationKey(String(r[0]||""))===key&&String(r[4]||"active").toLowerCase()!=="deleted"){sh.getRange(i+2,4,1,2).setValues([[now,"deleted"]]);changed=true;}});
    if(changed)bumpDataRevision_();
    const result=getFairSessionsV281_();return{ok:true,location:display,sessions:result.sessions,deletedKeys:result.deletedKeys,dataRevision:getDataRevision_()};
  }finally{lock.releaseLock();}
}
function saveFairSessionV281_(p){
  const location=canonicalLocation(String(p.location||"")),start=String(p.start||""),end=String(p.end||"");
  if(!location||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(start)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(end)||start>end)throw new Error("Fair 地点或日期范围无效");
  const sh=getFairSessionSheetV281_(),last=sh.getLastRow(),vals=last>1?sh.getRange(2,1,last-1,5).getValues():[],key=normalizeFairLocationKey(location);
  let row=0,storedDisplay=location,duplicates=[];
  vals.forEach((r,i)=>{if(normalizeFairLocationKey(String(r[0]||""))===key&&String(r[4]||"active").toLowerCase()!=="deleted"){if(!row){row=i+2;storedDisplay=canonicalLocation(String(r[0]||""))||location}else duplicates.push(i+2)}});
  const now=new Date(),values=[[storedDisplay,new Date(start+"T00:00:00"),new Date(end+"T00:00:00"),now,"active"]];
  if(row)sh.getRange(row,1,1,5).setValues(values);
  else sh.getRange(sh.getLastRow()+1,1,1,5).setValues(values);
  duplicates.forEach(r=>sh.getRange(r,4,1,2).setValues([[now,"deleted"]]));
  const revision=bumpDataRevision_();
  return{ok:true,session:{location:storedDisplay,start,end,updatedAt:now.toISOString(),status:"active"},dataRevision:revision};
}

function saveFairSingle(p){
  return saveFairBatch({
    location:p.location,
    records:JSON.stringify([{
      date:p.date,
      amount:Number(p.amount||0),
      clientUpdatedAt:p.clientUpdatedAt||""
    }])
  });
}

function saveFairBatch(p){
  const location=canonicalLocation(String(p.location||""));
  const records=JSON.parse(String(p.records||"[]"));
  if(!location||!Array.isArray(records))throw new Error("Invalid Fair records");
  // V36.0: reject pre-Restore Fair writes before touching turnover/audit data.
  // This is the same generation guard used by the other protected Sales APIs.
  const incomingRestoreGeneration=Math.max(0,Number(p.restoreGeneration||(records[0]&&records[0].restoreGeneration)||0));
  const currentRestoreGeneration=Math.max(0,Number(getRestoreGenerationV347_()||0));
  if(incomingRestoreGeneration!==currentRestoreGeneration){
    return{ok:false,staleRestore:true,message:"资料版本已经因 Restore 更新，请刷新后再储存",restoreGeneration:currentRestoreGeneration};
  }

  const normalized=records.map(item=>{
    const date=parseDateFromApp(String(item.date||""));
    if(!date)return null;
    assertWritableDateV8(date);
    const amount=Number(item.amount||0);
    // V36.0: the server owns the saved timestamp. Device ID, mutation sequence
    // and base cloud revision protect against delayed pagehide/background retries.
    const serverUpdatedAt=new Date();
    return{
      type:"fair",
      date,
      company:"fair",
      location,
      amount,
      updatedAt:serverUpdatedAt,
      preventStaleOverwrite:true,
      baseCloudUpdatedAt:String(item.baseCloudUpdatedAt||""),
      clientDeviceId:String(item.clientDeviceId||""),
      clientSequence:Number(item.clientSequence||0),
      foregroundSave:String(p.foregroundSave||"")==="1",
      validateFairCardFloor:true,
      notificationAction:String(item.notificationAction||p.notificationAction||""),
      notificationAmount:Number(item.notificationAmount||p.notificationAmount||0),
      notificationOldAmount:Number(item.notificationOldAmount||p.notificationOldAmount||0),
      notificationNewAmount:Number(item.notificationNewAmount||p.notificationNewAmount||0)
    };
  }).filter(Boolean);

  const saveResult=fastApplyRecordsSafely(normalized,true);
  if(normalized.length)ensureFairLocationHistoryV358_(location,normalized[0].date);
  const turnoverRevision=bumpPriorityTurnoverV315_();
  normalized.forEach(r=>appendSyncChangeV456_("turnover","fair",formatDateForApp(r.date),location,turnoverRevision));
  const notificationEnvelope=buildNotificationEnvelopeV185_(saveResult.changes);
  const inlineNotification=maybeSendKeepaliveNotificationV185_(p,saveResult.changes);

  return{
    ok:true,
    message:"Fair saved",
    dataRevision:saveResult.revision,
    turnoverRevision,
    notificationChangeCount:Array.isArray(saveResult.changes)?saveResult.changes.length:0,
    notificationEnvelope,
    inlineNotification,
    rows:(saveResult.rows||normalized).map(row=>({
      type:row.type,
      date:row.date instanceof Date?formatDateForApp(row.date):String(row.date||""),
      company:row.company,
      location:row.location,
      amount:row.amount,
      updatedAt:row.updatedAt instanceof Date?formatDateTimeForApp(row.updatedAt):String(row.updatedAt||"")
    }))
  };
}

/**
 * V6.5 快速写入：
 * - 每个月份表只读取一次
 * - 只更新目标行或批量追加新行
 * - Fair 金额为 0 时只删除对应日期/地点
 * - Fair 地点忽略所有空格及大小写；同一键值若已有重复，只保留一行
 * - 不再每次储存都清空并重写整张工作表
 */
function fastApplyRecordsSafely(records, captureChanges) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error("系统正在同步其他资料，请稍后再试");
  }

  let revision = getDataRevision_();
  const changes = [];
  const savedRows = [];
  try {
    const groups = {};

    records.forEach(record => {
      const name = monthSheetName(record.date);
      if (!groups[name]) groups[name] = [];
      groups[name].push(record);
    });

    Object.keys(groups).forEach(name => {
      const groupRows=fastApplyRecordsToMonthUnlocked(name, groups[name], captureChanges ? changes : null);
      if(Array.isArray(groupRows))savedRows.push.apply(savedRows,groupRows);
    });

    // V29.9: one lightweight audit batch in the same save request. No second
    // network request and no audit data is loaded during normal app sync.
    if (captureChanges) {
      // V36.0: normal changes are logged as before. If an older version saved
      // turnover but missed its audit row, reconcile only that missing delta
      // from the last existing audit to the authoritative saved amount.
      const auditChanges=changes.concat(collectMissingSalesChangeLogsV355_(savedRows,changes));
      if(auditChanges.length)appendSalesChangeLogsUnlockedV200_(auditChanges,new Date());
    }

    clearLoadCacheForPeriods(Object.keys(groups));
    revision = bumpDataRevision_();
  } finally {
    lock.releaseLock();
  }

  return captureChanges ? { revision, changes, rows:savedRows } : revision;
}

function fastApplyRecordsToMonthUnlocked(sheetName, records, changeCollector) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  ensureHeader(sheet);

  const lastRow = sheet.getLastRow();
  const values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 6).getValues()
    : [];

  const rowNumbersByKey = {};
  const existingByKey = {};
  values.forEach((raw, index) => {
    const normalized = normalizeRow(raw);
    if (!normalized) return;
    // Preserve seconds/milliseconds for V36.0 conflict ordering.  The normal
    // display formatter intentionally shows only minutes.
    if(raw[5] instanceof Date&&!isNaN(raw[5].getTime()))normalized.updatedAt=raw[5].toISOString();
    const key = rowKey(normalized);
    if (!rowNumbersByKey[key]) rowNumbersByKey[key] = [];
    rowNumbersByKey[key].push(index + 2);
    existingByKey[key] = existingByKey[key]
      ? newerRow(existingByKey[key], normalized)
      : normalized;
  });

  const rowsToDelete = [];
  const rowsToAppend = [];
  const savedRows = [];

  records.forEach(record => {
    const normalized = {
      type: record.type,
      date: formatDateForApp(record.date),
      company: record.company,
      location: record.type === "live"
        ? canonicalLiveHost(record.location || "")
        : canonicalLocation(record.location || ""),
      amount: Number(record.amount || 0),
      updatedAt: (record.updatedAt instanceof Date&&!isNaN(record.updatedAt.getTime()))
        ? record.updatedAt.toISOString()
        : (parseDateTimeFromApp(record.updatedAt)||new Date()).toISOString()
    };

    const key = rowKey(normalized);
    const matches = rowNumbersByKey[key] || [];
    const existing = existingByKey[key] || null;
    const incomingTime=parseDateTimeFromApp(normalized.updatedAt);
    const existingTime=existing?parseDateTimeFromApp(existing.updatedAt):null;
    const baseTime=parseDateTimeFromApp(record.baseCloudUpdatedAt);
    const versionedClient=Boolean(record.clientDeviceId&&Number(record.clientSequence||0)>0);
    const baseConflict=!record.foregroundSave&&versionedClient&&(
      (baseTime&&(!existingTime||baseTime.getTime()!==existingTime.getTime()))||
      (!baseTime&&existing&&Math.abs(Number(existing.amount||0)-Number(normalized.amount||0))>0.005)
    );
    const legacyTimeConflict=!versionedClient&&record.preventStaleOverwrite&&existing&&incomingTime&&existingTime&&incomingTime.getTime()<existingTime.getTime();
    if(baseConflict||legacyTimeConflict){
      // Return the authoritative newer row so every device repairs its local
      // cache without creating another write or notification.
      savedRows.push(existing||{...normalized,amount:0,updatedAt:new Date().toISOString()});
      return;
    }
    // Validate only after the stale-request guard.  An obsolete RM500 retry
    // must be acknowledged as obsolete, not rejected because a newer RM3300
    // sales card already exists.
    if(record.validateFairCardFloor){
      const cardAmount=activeSalesCardAmountV268_("fair",record.date,record.location);
      if(Number(normalized.amount||0)+0.005<cardAmount){
        throw new Error(normalized.date+" 已有销售卡合计 RM"+cardAmount.toFixed(2)+"。Fair 营业额不能低于销售卡总额。");
      }
    }
    if(record.validateDailyCardFloor){
      const dailyName=displayCompany(normalizeCompany(record.company||'belimbing'));
      const cardAmount=activeSalesCardAmountV268_("daily",record.date,dailyName);
      if(Number(normalized.amount||0)+0.005<cardAmount)throw new Error("当天已有销售卡合计 RM"+cardAmount.toFixed(2)+"。"+dailyName+" 营业额不能低于销售卡总额。");
    }
    if(record.validateLiveCardFloor){
      const cardAmount=activeSalesCardAmountV268_("live",record.date,record.location);
      if(Number(normalized.amount||0)+0.005<cardAmount)throw new Error("当天已有销售卡合计 RM"+cardAmount.toFixed(2)+"。Live 营业额不能低于销售卡总额，请先修改或删除相关销售卡。");
    }
    const oldAmount = existing ? Number(existing.amount || 0) : 0;
    const newAmount = Number(normalized.amount || 0);

    if (changeCollector && oldAmount !== newAmount) {
      let action = "modified";
      if (oldAmount <= 0 && newAmount > 0) action = "added";
      else if (oldAmount > 0 && newAmount <= 0) action = "deleted";

      changeCollector.push({
        action,
        type: normalized.type,
        date: normalized.date,
        company: normalized.company,
        location: normalized.location,
        oldAmount,
        newAmount,
        notificationAction:String(record.notificationAction||""),
        notificationAmount:Number(record.notificationAmount||0),
        notificationOldAmount:Number(record.notificationOldAmount||0),
        notificationNewAmount:Number(record.notificationNewAmount||0)
      });
    }

    if ((record.type === "fair" || record.type === "live") && newAmount <= 0) {
      matches.forEach(rowNumber => rowsToDelete.push(rowNumber));
      delete rowNumbersByKey[key];
      delete existingByKey[key];
      savedRows.push(normalized);
      return;
    }

    const rowValues = [[
      displayType(normalized.type),
      parseDateFromApp(normalized.date),
      displayCompany(normalized.company),
      normalized.location,
      normalized.amount,
      parseDateTimeFromApp(normalized.updatedAt) || new Date()
    ]];

    if (matches.length > 0) {
      const keepRow = matches[0];
      sheet.getRange(keepRow, 1, 1, 6).setValues(rowValues);
      matches.slice(1).forEach(rowNumber => rowsToDelete.push(rowNumber));
      rowNumbersByKey[key] = [keepRow];
    } else {
      rowsToAppend.push(rowValues[0]);
    }
    existingByKey[key] = normalized;
    savedRows.push(normalized);
  });

  [...new Set(rowsToDelete)]
    .sort((a, b) => b - a)
    .forEach(rowNumber => sheet.deleteRow(rowNumber));

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 6)
      .setValues(rowsToAppend);
  }

  // V14.8: keep the fast-write design; no full-sheet sort after each save.
  formatSheetFast(sheet);
  return savedRows;
}

function formatSheetFast(sheet) {
  const lastRow = sheet.getLastRow();
  sheet.setFrozenRows(1);

  if (lastRow > 1) {
    sheet.getRange(2, 2, lastRow - 1, 1).setNumberFormat("dd-MM-yyyy");
    sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat("#,##0.00");
    sheet.getRange(2, 6, lastRow - 1, 1).setNumberFormat("dd-MM-yyyy HH:mm");
  }
}

function applyRecordsSafely(records) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const groups = {};

    records.forEach(record => {
      const name = monthSheetName(record.date);
      if (!groups[name]) groups[name] = [];
      groups[name].push(record);
    });

    Object.keys(groups).forEach(name => {
      applyRecordsToMonthUnlocked(name, groups[name]);
    });
  } finally {
    lock.releaseLock();
  }
}

function applyRecordsToMonthUnlocked(sheetName, records) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  ensureHeader(sheet);

  const values = sheet.getDataRange().getValues();
  const map = new Map();

  values.slice(1).forEach(raw => {
    const normalized = normalizeRow(raw);
    if (!normalized) return;

    const key = rowKey(normalized);
    const existing = map.get(key);

    if (!existing) map.set(key, normalized);
    else map.set(key, newerRow(existing, normalized));
  });

  records.forEach(record => {
    const normalized = {
      type: record.type,
      date: formatDateForApp(record.date),
      company: record.company,
      location: record.type === "live"
        ? canonicalLiveHost(record.location || "")
        : canonicalLocation(record.location || ""),
      amount: Number(record.amount || 0),
      updatedAt: formatDateTimeForApp(record.updatedAt || new Date())
    };

    const key = rowKey(normalized);

    if ((record.type === "fair" || record.type === "live") && normalized.amount <= 0) {
      map.delete(key);
    } else {
      map.set(key, normalized);
    }
  });

  const outputRows = Array.from(map.values());
  outputRows.sort(compareRows);

  const existingDataRows = Math.max(sheet.getLastRow() - 1, 0);
  if (existingDataRows > 0) {
    sheet.getRange(2, 1, existingDataRows, 6).clearContent();
  }

  if (outputRows.length > 0) {
    const valuesToWrite = outputRows.map(row => [
      displayType(row.type),
      parseDateFromApp(row.date),
      displayCompany(row.company),
      row.type === "live" ? canonicalLiveHost(row.location) : canonicalLocation(row.location),
      Number(row.amount || 0),
      parseDateTimeFromApp(row.updatedAt) || new Date()
    ]);

    sheet.getRange(2, 1, valuesToWrite.length, 6).setValues(valuesToWrite);
  }

  const surplus = sheet.getLastRow() - (outputRows.length + 1);
  if (surplus > 0) {
    sheet.deleteRows(outputRows.length + 2, surplus);
  }

  formatSheet(sheet);
}

function compareRows(a, b) {
  const rank = row => {
    if (row.type === "daily" && row.company === "balakong") return 0;
    if (row.type === "daily" && row.company === "belimbing") return 1;
    return 2;
  };

  return (
    rank(a) - rank(b) ||
    canonicalLocation(a.location).localeCompare(canonicalLocation(b.location)) ||
    displayToTimestamp(a.date) - displayToTimestamp(b.date)
  );
}

function displayToTimestamp(value) {
  const date = parseDateFromApp(value);
  return date ? date.getTime() : 0;
}

function deduplicateMonthlySheets() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let removed = 0;

    ss.getSheets().forEach(sheet => {
      if (!/^\d{4}-\d{2}$/.test(sheet.getName())) return;

      const before = Math.max(sheet.getLastRow() - 1, 0);
      applyRecordsToMonthUnlocked(sheet.getName(), []);
      const after = Math.max(sheet.getLastRow() - 1, 0);
      removed += Math.max(before - after, 0);
    });

    return {
      ok: true,
      message: "Duplicate rows cleaned",
      removed: removed
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 一次性迁移旧年份资料：
 * - 把 2026、2027... 复制到 2026-06、2026-07...
 * - 原来的年份工作表完全保留，不改名、不删除、不清空
 * - 月份表若已有同一笔，以更新时间较新的资料为准
 */
function copyLegacyYearSheetsToMonthlySafely() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const legacySheets = ss.getSheets().filter(sheet => /^\d{4}$/.test(sheet.getName()));
    let copied = 0;

    legacySheets.forEach(sheet => {
      const values = sheet.getDataRange().getValues();
      const groups = {};

      values.slice(1).forEach(raw => {
        const row = normalizeRow(raw);
        if (!row) return;

        const date = parseDateFromApp(row.date);
        const month = monthSheetName(date);

        if (!groups[month]) groups[month] = [];
        groups[month].push({
          type: row.type,
          date: date,
          company: row.company,
          location: row.location,
          amount: row.amount,
          updatedAt: parseDateTimeFromApp(row.updatedAt) || new Date()
        });

        copied++;
      });

      Object.keys(groups).forEach(month => {
        applyRecordsToMonthUnlocked(month, groups[month]);
      });
    });

    return {
      ok: true,
      message: "Legacy year data copied to monthly sheets safely",
      copied: copied,
      originalYearSheetsKept: true
    };
  } finally {
    lock.releaseLock();
  }
}

function canonicalLiveHost(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function canonicalLocation(value) {

  let text = String(value || "").trim();

  if (!text) return "";

  // 只整理空格，不删除任何符号
  text = text.replace(/\s+/g, " ").trim();

  // 比较时只忽略空格及大小写
  const compact = text
    .replace(/\s+/g, "")
    .toLowerCase();

  if (compact === "sunway" || compact === "sunwaymall") return "Sunway";

  if (compact === "ioi" || compact === "ioimall") return "IOI";

  if (compact === "midvalley" || compact === "midvalleymall") return "Mid Valley";

  if (compact === "kleastmall") return "KL East Mall";

  // 有符号则保留原写法，当成不同地点
  const hasSymbol = /[^a-zA-Z0-9\s]/.test(text);

  if (hasSymbol) {
    return text;
  }

  return text.split(" ").map(part => {

    const lower = part.toLowerCase();

    if (lower === "ioi") return "IOI";

    if (lower === "kl") return "KL";

    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();

  }).join(" ");
}
  

function parseDateFromApp(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value;
  }

  const text = String(value || "").trim();

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    const parts = text.split("-").map(Number);
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parts = text.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  return null;
}

function parseDateTimeFromApp(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value;
  }

  const text = String(value || "").trim();

  if (/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/.test(text)) {
    const date = parseDateFromApp(text.slice(0, 10));
    const time = text.slice(11).split(":").map(Number);
    date.setHours(time[0], time[1], 0, 0);
    return date;
  }

  const date = new Date(text);
  return isNaN(date.getTime()) ? null : date;
}

function formatDateForApp(value) {
  const date = Object.prototype.toString.call(value) === "[object Date]"
    ? value
    : parseDateFromApp(value);

  return date
    ? Utilities.formatDate(date, Session.getScriptTimeZone(), "dd-MM-yyyy")
    : "";
}

function formatDateTimeForApp(value) {
  const date = Object.prototype.toString.call(value) === "[object Date]"
    ? value
    : parseDateTimeFromApp(value);

  return date
    ? Utilities.formatDate(date, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm")
    : "";
}

function displayType(type) {
  return type === "fair" ? "Fair" : type === "live" ? "Live" : "每日";
}

function normalizeType(type) {
  const text = String(type || "").toLowerCase();
  if (type === "每日" || type === "今日" || text === "daily") return "daily";
  if (text === "fair") return "fair";
  if (text === "live") return "live";
  return text;
}

function displayCompany(company) {
  if (company === "balakong") return "Balakong";
  if (company === "belimbing") return "Belimbing";
  if (company === "fair") return "Fair";
  if (company === "live") return "Live";
  return company;
}

function normalizeCompany(company) {
  const text = String(company || "").toLowerCase();
  if (text.indexOf("adenium") >= 0 || text.indexOf("balakong") >= 0) return "balakong";
  if (text.indexOf("gardening") >= 0 || text.indexOf("belimbing") >= 0) return "belimbing";
  if (text === "fair") return "fair";
  if (text === "live") return "live";
  return text;
}

function output(obj, callback) {
  const json = JSON.stringify(obj);

  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + json + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}


/* ================= Lover Legend Sales System V18.7 ================= */
const DATA_VERSION_V8 = "4920";
const RESTORE_PREFIX_V8 = "LL_SALES_RESTORE_V8_";


function loadMonthDataV97(month) {
  const tz = Session.getScriptTimeZone();
  const current = Utilities.formatDate(new Date(), tz, "yyyy-MM");
  const m = /^\d{4}-\d{2}$/.test(String(month || "")) ? String(month) : current;
  const cacheKey = LOAD_CACHE_KEY + "_month_" + m;

  try {
    const cachedText = CacheService.getScriptCache().get(cacheKey);
    if (cachedText) return JSON.parse(cachedText);
  } catch (err) {}

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const map = {};
  const priority = {};
  const monthlySheet = ss.getSheetByName(m);

  // V14.8: a proper monthly sheet is authoritative. The old yearly sheet is
  // scanned only as a fallback when the monthly sheet does not exist or is empty.
  const names = monthlySheet && monthlySheet.getLastRow() > 1
    ? [m]
    : [m, m.slice(0, 4)];

  names.forEach(name => {
    const sheet = name === m ? monthlySheet : ss.getSheetByName(name);
    if (!sheet) return;

    const sourcePriority = name === m ? 2 : 1;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

    values.forEach(raw => {
      const row = normalizeRow(raw);
      if (!row) return;

      const parsed = parseDateFromApp(row.date);
      if (!parsed || Utilities.formatDate(parsed, tz, "yyyy-MM") !== m) return;

      const key = rowKey(row);
      if (!map[key] || sourcePriority > priority[key]) {
        map[key] = row;
        priority[key] = sourcePriority;
      } else if (sourcePriority === priority[key]) {
        map[key] = newerRow(map[key], row);
      }
    });
  });

  const settings = getSettingsSnapshotFast_();
  const result = {
    ok: true,
    month: m,
    rows: Object.keys(map).map(key => map[key]),
    commissionSettings: settings.commissionSettings,
    accessSettings: settings.accessSettings,
    systemState: settings.systemState,
    dataVersion: DATA_VERSION_V8,
    dataRevision: getDataRevision_()
  };

  try {
    const payload = JSON.stringify(result);
    if (payload.length < 95000) {
      CacheService.getScriptCache().put(cacheKey, payload, LOAD_CACHE_SECONDS);
    }
  } catch (err) {}

  return result;
}

// V46.0: one-request authoritative sync bundle. The client receives the selected
// month rows and the complete active Sales Card snapshot in the SAME Apps Script
// response, removing the older split-request window where profit/turnover
// could become new while Sales Card data was still old.
// V46.0: authoritative per-context modification timestamps. This lets a client
// distinguish "my unsynced local safety copy" from "the same card was changed on
// another device later" without treating unrelated Sales Card revisions as a conflict.
function getSalesCardContextVersionsV452_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SALES_PRODUCT_LINK_SHEET_V203_),out={};
  if(!sh||sh.getLastRow()<2)return out;
  const vals=sh.getRange(2,1,sh.getLastRow()-1,26).getValues();
  vals.forEach(r=>{
    if(!r[0])return;
    const type=normalizeType(String(r[2]||'')),dateText=r[1] instanceof Date?formatDateForApp(r[1]):String(r[1]||''),location=String(r[3]||'').trim();
    if(!type||!dateText||!location)return;
    const key=[type,dateText,location.toLowerCase()].join('|');
    const candidates=[r[12],r[24],r[11]].map(v=>v instanceof Date?v.getTime():Date.parse(String(v||''))||0);
    const ts=Math.max.apply(null,candidates);
    if(ts>Number(out[key]||0))out[key]=ts;
  });
  return out;
}

function syncBundleV450_(month) {
  const monthData = loadMonthDataV97(month);
  const cards = getAllSalesProductLinksV203_();
  return {
    ...monthData,
    ok: true,
    bundleVersion: "46.6",
    salesCardContextVersions: getSalesCardContextVersionsV452_(),
    salesProductLinks: Array.isArray(cards && cards.links) ? cards.links : [],
    turnoverRevision: getPriorityRevV315_(PRIORITY_TURNOVER_REV_PROP_V315_),
    salesCardRevision: getPriorityRevV315_(PRIORITY_CARD_REV_PROP_V315_),
    dataRevision: getDataRevision_()
  };
}

function loadYearDataV96(year) {
  const y = /^\d{4}$/.test(String(year || "")) ? String(year) : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy");
  const cacheKey = LOAD_CACHE_KEY + "_year_" + y;
  try {
    const cachedText = CacheService.getScriptCache().get(cacheKey);
    if (cachedText) return JSON.parse(cachedText);
  } catch (e) {}

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const map = {};
  const priority = {};
  const names = [y];
  for (let m = 1; m <= 12; m++) names.push(y + "-" + String(m).padStart(2, "0"));

  names.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const isMonthly = /^\d{4}-\d{2}$/.test(name);
    const sourcePriority = isMonthly ? 2 : 1;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;
    const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    values.forEach(raw => {
      const row = normalizeRow(raw);
      if (!row) return;
      const rowYear = formatDateForApp(parseDateFromApp(row.date)).slice(-4);
      if (rowYear !== y) return;
      const key = rowKey(row);
      if (!map[key] || sourcePriority > priority[key]) {
        map[key] = row;
        priority[key] = sourcePriority;
      } else if (sourcePriority === priority[key]) {
        map[key] = newerRow(map[key], row);
      }
    });
  });

  const settings = getSettingsSnapshotFast_();
  const result = {
    ok: true,
    rows: Object.keys(map).map(key => map[key]),
    commissionSettings: settings.commissionSettings,
    accessSettings: settings.accessSettings,
    systemState: settings.systemState,
    dataVersion: DATA_VERSION_V8,
    dataRevision: getDataRevision_()
  };
  try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), LOAD_CACHE_SECONDS); } catch (e) {}
  return result;
}


/* ================= V18.7 Historical Highs =================
   This endpoint is NEVER called during startup or normal sync.
   It runs only when a user expands a Top 5 panel.
   Result is cached by data revision so repeated opens are fast.
*/
function historicalHighsV174_() {
  const revision = getDataRevision_();
  const cacheKey = "LL_SALES_HISTORY_TOP5_V423_" + String(revision || 0);

  try {
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const sheets = ss.getSheets();

  // Monthly sheets are authoritative. Year sheets are used only for months
  // where no monthly sheet exists, preventing old legacy data from overriding corrections.
  const monthlySheets = {};
  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (/^\d{4}-\d{2}$/.test(name) && sheet.getLastRow() > 1) monthlySheets[name] = true;
  });

  const highs = {
    balakong: null,
    belimbing: null,
    fair: null,
    live: null
  };
  const topRows = {
    balakong: {},
    belimbing: {},
    fair: {},
    live: {}
  };

  function consider_(row) {
    if (!row || !Number(row.amount || 0) || Number(row.amount || 0) <= 0) return;
    let key = "";
    if (row.type === "daily" && row.company === "balakong") key = "balakong";
    else if (row.type === "daily" && row.company === "belimbing") key = "belimbing";
    else if (row.type === "fair") key = "fair";
    else if (row.type === "live") key = "live";
    if (!key) return;

    const amount = Number(row.amount || 0);
    const identity=rowKey(row);
    topRows[key][identity]=topRows[key][identity]?newerRow(topRows[key][identity],row):row;
    const old = highs[key];
    const newDate = parseDateFromApp(row.date);
    const oldDate = old ? parseDateFromApp(old.date) : null;

    if (!old || amount > Number(old.amount || 0) ||
        (amount === Number(old.amount || 0) && newDate && oldDate && newDate > oldDate)) {
      highs[key] = {
        type: row.type,
        company: row.company || "",
        location: row.location || "",
        date: row.date,
        amount: amount
      };
    }
  }

  sheets.forEach(sheet => {
    const name = sheet.getName();
    const isMonth = /^\d{4}-\d{2}$/.test(name);
    const isYear = /^\d{4}$/.test(name);
    if (!isMonth && !isYear) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    values.forEach(raw => {
      const row = normalizeRow(raw);
      if (!row) return;

      const parsed = parseDateFromApp(row.date);
      if (!parsed) return;
      const monthKey = Utilities.formatDate(parsed, tz, "yyyy-MM");

      // If this is a legacy year sheet, skip rows whose month has an
      // authoritative monthly sheet.
      if (isYear && monthlySheets[monthKey]) return;

      // Monthly sheet rows must actually belong to that month.
      if (isMonth && monthKey !== name) return;

      consider_(row);
    });
  });

  const top5={};
  Object.keys(topRows).forEach(key=>{
    top5[key]=Object.keys(topRows[key]).map(id=>topRows[key][id])
      .filter(row=>Number(row.amount||0)>0)
      .sort((a,b)=>Number(b.amount||0)-Number(a.amount||0)||displayToTimestamp(b.date)-displayToTimestamp(a.date))
      .slice(0,5)
      .map(row=>({
        type:row.type,
        company:row.company||"",
        location:row.location||"",
        date:row.date,
        amount:Number(row.amount||0)
      }));
    highs[key]=top5[key][0]||null;
  });

  const result = {
    ok: true,
    highs: highs,
    top5: top5,
    dataRevision: revision,
    generatedAt: new Date().toISOString()
  };

  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), 21600);
  } catch (e) {}

  return result;
}

function oneSignalLastDispatchV181_() {
  try {
    const raw=PropertiesService.getScriptProperties().getProperty("ONESIGNAL_LAST_DISPATCH_RESULT")||"";
    return raw?JSON.parse(raw):{ok:false,message:"No notification dispatch has been recorded yet"};
  } catch(e) {
    return {ok:false,message:String(e&&e.message||e)};
  }
}

function oneSignalDiagnosticsV181_() {
  const c=getOneSignalCredentialsV180_();
  return {
    ok:Boolean(c.appId&&c.apiKey),
    appId:c.appId||"",
    apiKeyPresent:Boolean(c.apiKey),
    apiKeyPrefix:c.apiKey?String(c.apiKey).slice(0,8):"",
    version:"V18.7"
  };
}


/* ================= V18.7 OneSignal Authorization =================
   Run this function ONCE from the Apps Script editor after adding the
   appsscript.json oauthScopes. Google will ask for authorization.
   It does not change Sales/Fair/Live data.
*/
function testOneSignalPushV185() {
  const ids=getRegisteredPushSubscriptionsV185_();
  console.log("Registered push subscriptions:",ids.length);
  const result=sendOneSignalNotification_(
    "🔔 Lover Legend Sales 通知测试",
    "V18.7 Direct Subscription Push 测试成功"
  );
  console.log("testOneSignalPushV185:",JSON.stringify(result));
  return result;
}

function authorizeOneSignalV185() {
  const request = UrlFetchApp.getRequest("https://api.onesignal.com/notifications?c=push", {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true
  });
  return {
    ok: true,
    version: "V18.7",
    externalRequestAuthorized: Boolean(request && request.url)
  };
}


/* ================= V29.9 Import Cost System product picker ================= */
const IMPORT_COST_SPREADSHEET_ID_V212_ = "1TD3pcl-LrB63xk6q0bjRc6lvheUxKo_OOqmsdlpNWDA";
const PRODUCT_PREFIX_RULES_V436_ = [["黄杨","BX"],["凌珊","BB"],["罗汉松","PD"],["李氏樱桃","SK"],["水梅","JL"],["酸豆","AS"],["寿娘子","SC"],["三角梅","BV"],["七里香","MR"],["九里香","MR"],["仙丹","IX"],["福建茶","HK"]];
function compatibleIdsForImportProductV436_(id,name){
  const current=String(id||"").trim().toUpperCase(),m=current.match(/^[A-Z]{2}(\d{4})$/);if(!m)return[current];
  const compact=String(name||"").replace(/\s+/g,"");const rule=PRODUCT_PREFIX_RULES_V436_.find(x=>compact.indexOf(x[0])!==-1);
  return [...new Set([current,"PZ"+m[1],rule?rule[1]+m[1]:""].filter(Boolean))];
}
function getImportProductIdResolverV436_(){
  const cache=CacheService.getScriptCache(),cacheKey="importProductIdCompatibilityV436",cached=cache.get(cacheKey);let byId={},byName={};
  if(cached){try{const parsed=JSON.parse(cached);byId=parsed.byId||{};byName=parsed.byName||{}}catch(_){byId={};byName={}}}
  const normName=x=>String(x||"").toLowerCase().replace(/[\s_\-（）()]/g,"");
  if(!Object.keys(byId).length){try{const result=getImportProductsV212_(),products=Array.isArray(result&&result.products)?result.products:[];products.forEach(p=>{compatibleIdsForImportProductV436_(p.productId,p.productName).forEach(id=>{if(!byId[id])byId[id]=p.productId});const n=normName(p.productName);if(n&&!byName[n])byName[n]=p.productId});try{cache.put(cacheKey,JSON.stringify({byId,byName}),120)}catch(_){}}catch(_){}}
  return function(id,name){const clean=String(id||"").trim().toUpperCase();return byId[clean]||byName[normName(name)]||clean};
}
function getImportProductsV212_(){
  const ss=SpreadsheetApp.openById(IMPORT_COST_SPREADSHEET_ID_V212_);
  const sh=ss.getSheetByName("Products");
  if(!sh)throw new Error("Import Cost System 找不到 Products 工作表");
  const values=sh.getDataRange().getValues();
  if(values.length<2)return{ok:true,products:[]};
  const headers=values[0].map(v=>String(v||"").trim());
  const norm=s=>String(s||"").toLowerCase().replace(/[\\s_\\-（）()]/g,"");
  const find=(aliases)=>{
    const set=aliases.map(norm);
    for(let i=0;i<headers.length;i++)if(set.includes(norm(headers[i])))return i;
    for(let i=0;i<headers.length;i++)if(set.some(a=>norm(headers[i]).includes(a)))return i;
    return -1;
  };
  const nameCol=find(["产品名","产品名称","productName","name"]);
  const idCol=find(["产品ID","productId","编号","sku","code"]);
  const costCol=find(["平均成本","averageCost","avgCost","平均成本RM"]);
  const stockCol=find(["库存","stock","目前库存","当前库存"]);
  if(nameCol<0)throw new Error("Products 工作表找不到产品名称栏位");
  const products=[];
  values.slice(1).forEach((r,idx)=>{
    const productName=String(r[nameCol]||"").trim();
    if(!productName)return;
    products.push({
      productId:idCol>=0?String(r[idCol]||"").trim():("import_row_"+(idx+2)),
      productName,
      compatibleProductIds:compatibleIdsForImportProductV436_(idCol>=0?String(r[idCol]||"").trim():"",productName),
      averageCost:costCol>=0?Math.max(0,Number(r[costCol]||0)):0,
      stock:stockCol>=0?Number(r[stockCol]||0):null
    });
  });
  products.sort((a,b)=>a.productName.localeCompare(b.productName,"zh-Hans-CN",{numeric:true,sensitivity:"base"}));
  return{ok:true,products};
}

/* ================= V36.8 cached audit reads ================= */
function getSalesChangeLogV365_(p){
  const type=normalizeType(String(p.type||"")),dateText=String(p.date||""),loc=type==="fair"?normalizeFairLocationKey(String(p.location||"")):"";
  const rev=Number(getDataRevision_()||0),key=["v365log",rev,type,dateText,loc].join("|");
  const cache=CacheService.getScriptCache();
  try{const raw=cache.get(key);if(raw){const parsed=JSON.parse(raw);if(parsed&&parsed.ok)return parsed}}catch(_){}
  const result=getSalesChangeLogV200_(p);
  try{const raw=JSON.stringify(result);if(raw.length<95000)cache.put(key,raw,60)}catch(_){}
  return result;
}



/* ================= V42.3 Fair/Live turnover entry details =================
   Auxiliary only: monthly turnover rows remain the accounting authority.
   This sheet stores the user-facing 100 + 200 + ... breakdown so old data,
   commission, profit and monthly calculations keep using the same total field.
*/
const TURNOVER_ENTRY_SHEET_V376_='_Turnover_Entries_V376';
function getTurnoverEntrySheetV376_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(TURNOVER_ENTRY_SHEET_V376_);
  if(!sh){sh=ss.insertSheet(TURNOVER_ENTRY_SHEET_V376_);sh.getRange(1,1,1,5).setValues([['类型','日期','地点/主播','明细 JSON','更新时间']]);sh.hideSheet()}
  return sh;
}
function turnoverEntryKeyV376_(type,dateText,location){
  type=normalizeType(String(type||''));
  const loc=type==='daily'?displayCompany(normalizeCompany(String(location||'Belimbing'))):type==='live'?canonicalLiveHost(String(location||'')):canonicalLocation(String(location||''));
  const lk=type==='daily'?normalizeCompany(loc):type==='live'?String(loc).replace(/\s+/g,'').toLowerCase():normalizeFairLocationKey(loc);
  return [type,String(dateText||''),lk].join('|');
}
function normalizeTurnoverEntryItemsV376_(raw){
  let arr=raw;if(typeof raw==='string'){try{arr=JSON.parse(raw)}catch(_){arr=[]}}
  if(!Array.isArray(arr))arr=[];
  return arr.slice(0,200).map((x,i)=>{
    const o=(x&&typeof x==='object')?x:{amount:x},amount=Math.round(Number(o.amount||0)*100)/100;
    if(!Number.isFinite(amount)||amount<0)return null;
    return{id:String(o.id||('e'+(i+1))),amount,createdAt:String(o.createdAt||''),updatedAt:String(o.updatedAt||'')};
  }).filter(Boolean);
}
function readAllTurnoverEntriesV376_(){
  const sh=getTurnoverEntrySheetV376_(),last=sh.getLastRow();if(last<2)return[];
  return sh.getRange(2,1,last-1,5).getValues().map(r=>{
    const type=normalizeType(String(r[0]||'')),d=r[1] instanceof Date?formatDateForApp(r[1]):String(r[1]||''),location=type==='daily'?displayCompany(normalizeCompany(String(r[2]||'Belimbing'))):type==='live'?canonicalLiveHost(String(r[2]||'')):canonicalLocation(String(r[2]||''));
    if(!['daily','fair','live'].includes(type)||!/^\d{2}-\d{2}-\d{4}$/.test(d)||!location)return null;
    return{type,date:d,location,entries:normalizeTurnoverEntryItemsV376_(String(r[3]||'[]')),updatedAt:r[4] instanceof Date?r[4].toISOString():String(r[4]||'')};
  }).filter(Boolean);
}
function getTurnoverEntriesV376_(p){
  const type=normalizeType(String(p.type||'')),dateText=String(p.date||''),location=type==='daily'?displayCompany(normalizeCompany(String(p.location||'Belimbing'))):type==='live'?canonicalLiveHost(String(p.location||'')):canonicalLocation(String(p.location||''));
  const key=turnoverEntryKeyV376_(type,dateText,location),record=readAllTurnoverEntriesV376_().find(x=>turnoverEntryKeyV376_(x.type,x.date,x.location)===key)||null;
  return{ok:true,record};
}
function getAllTurnoverEntriesV376_(){return{ok:true,records:readAllTurnoverEntriesV376_()}}
function authoritativeTurnoverAmountV376_(type,dateText,location){
  if(type==='daily'){const company=normalizeCompany(location);let amount=0;(Array.isArray(loadData().rows)?loadData().rows:[]).forEach(r=>{if(normalizeType(String(r.type||''))==='daily'&&String(r.date||'')===dateText&&normalizeCompany(r.company)===company)amount=Math.max(amount,Number(r.amount||0))});return amount;}
  const data=loadData(),normalizer=type==='live'?function(v){return String(canonicalLiveHost(v)).replace(/\s+/g,'').toLowerCase()}:normalizeFairLocationKey;
  const target=normalizer(location);let amount=0;
  (Array.isArray(data.rows)?data.rows:[]).forEach(r=>{if(normalizeType(String(r.type||''))===type&&String(r.date||'')===dateText&&normalizer(r.location||'')===target)amount=Math.max(amount,Number(r.amount||0))});
  return amount;
}
function saveTurnoverEntriesV376_(p){
  const type=normalizeType(String(p.type||''));if(!['daily','fair','live'].includes(type))throw new Error('只支持 Sales / Fair / Live 营业额明细');
  const dateText=String(p.date||''),date=parseDateFromApp(dateText);if(!date)throw new Error('营业额明细日期无效');assertWritableDateV8(date);
  const location=type==='daily'?displayCompany(normalizeCompany(String(p.location||'Belimbing'))):type==='live'?canonicalLiveHost(String(p.location||'')):canonicalLocation(String(p.location||''));if(!location)throw new Error('营业额明细地点/主播无效');
  const entries=normalizeTurnoverEntryItemsV376_(String(p.entries||'[]')),sum=Math.round(entries.reduce((s,x)=>s+Number(x.amount||0),0)*100)/100,total=Math.round(Number(p.total||0)*100)/100;
  if(Math.abs(sum-total)>0.005)throw new Error('营业额明细加总与总数不一致');
  const authoritative=Math.round(authoritativeTurnoverAmountV376_(type,dateText,location)*100)/100;
  if(Math.abs(authoritative-total)>0.005)throw new Error('云端营业额已经改变，请刷新后再修改明细');
  const sh=getTurnoverEntrySheetV376_(),key=turnoverEntryKeyV376_(type,dateText,location),last=sh.getLastRow(),vals=last>1?sh.getRange(2,1,last-1,5).getValues():[],idx=vals.findIndex(r=>{
    const t=normalizeType(String(r[0]||'')),d=r[1] instanceof Date?formatDateForApp(r[1]):String(r[1]||''),loc=t==='daily'?displayCompany(normalizeCompany(String(r[2]||'Belimbing'))):t==='live'?canonicalLiveHost(String(r[2]||'')):canonicalLocation(String(r[2]||''));return turnoverEntryKeyV376_(t,d,loc)===key;
  });
  const row=[type,date,location,JSON.stringify(entries),new Date()];
  if(idx>=0)sh.getRange(idx+2,1,1,5).setValues([row]);else sh.appendRow(row);
  sh.getRange('B:B').setNumberFormat('dd-MM-yyyy');sh.getRange('E:E').setNumberFormat('dd-MM-yyyy HH:mm');
  const record={type,date:dateText,location,entries,updatedAt:new Date().toISOString()};return{ok:true,record};
}
function restoreTurnoverEntriesV376_(records){
  const sh=getTurnoverEntrySheetV376_();if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,5).clearContent();
  const vals=(Array.isArray(records)?records:[]).map(r=>{
    const type=normalizeType(String(r.type||'')),dateText=String(r.date||''),date=parseDateFromApp(dateText),location=type==='daily'?displayCompany(normalizeCompany(String(r.location||'Belimbing'))):type==='live'?canonicalLiveHost(String(r.location||'')):canonicalLocation(String(r.location||''));
    if(!['daily','fair','live'].includes(type)||!date||!location)return null;const entries=normalizeTurnoverEntryItemsV376_(r.entries||[]);return[type,date,location,JSON.stringify(entries),parseDateTimeFromApp(r.updatedAt)||new Date()];
  }).filter(Boolean);
  if(vals.length)sh.getRange(2,1,vals.length,5).setValues(vals);sh.getRange('B:B').setNumberFormat('dd-MM-yyyy');sh.getRange('E:E').setNumberFormat('dd-MM-yyyy HH:mm');return vals.length;
}

const RESTORE_MAINTENANCE_KEY_V345_="LL_RESTORE_MAINTENANCE_V345";
const RESTORE_MAINTENANCE_TTL_MS_V345_=30*60*1000;
const RESTORE_STALLED_TTL_MS_V411_=5*60*1000;
const RESTORE_GENERATION_KEY_V347_="LL_RESTORE_GENERATION_V347";
function getRestoreGenerationV347_(){return Math.max(0,Number(PropertiesService.getScriptProperties().getProperty(RESTORE_GENERATION_KEY_V347_)||0))}
function bumpRestoreGenerationV347_(){const next=Math.max(getRestoreGenerationV347_()+1,Date.now());PropertiesService.getScriptProperties().setProperty(RESTORE_GENERATION_KEY_V347_,String(next));return next}
function restoreGenerationMatchesV347_(p){const current=getRestoreGenerationV347_();return current<=0||Number(p&&p.restoreGeneration||0)===current}
const RESTORE_BLOCKED_ACTIONS_V345_=new Set([
  "saveSalesProductLink","saveSalesProductLinks","confirmSalesCardInventoryV249","deleteSalesTransaction","deleteSalesProductLink",
  "saveDaily","saveFairSessionV281","deleteFairLocationV358","saveFairBatch","saveFairSingle","saveLive","saveTurnoverEntriesV376",
  "saveCommissionSettings","saveFairCommissionFast","saveLiveCommissionFast","saveAccessSettings","resetCommissionSettings",
  "closeMonth","closeYear","copyLegacyYearSheetsToMonthlySafely","deduplicateMonthlySheets"
]);
function getRestoreMaintenanceV345_(){
  const props=PropertiesService.getScriptProperties(),raw=props.getProperty(RESTORE_MAINTENANCE_KEY_V345_);
  if(!raw)return null;
  let state=null;try{state=JSON.parse(raw)}catch(_){props.deleteProperty(RESTORE_MAINTENANCE_KEY_V345_);return null}
  const now=Date.now(),updatedAt=Number(state&&state.updatedAt||0);
  if(!state||now-updatedAt>RESTORE_MAINTENANCE_TTL_MS_V345_){props.deleteProperty(RESTORE_MAINTENANCE_KEY_V345_);return null}
  // V42.3: the marker alone cannot prove that Restore is still active. Reconcile
  // it with the persisted job so a completed, failed, missing or abandoned job
  // cannot falsely block a new Restore as if another device were running it.
  const jobId=String(state.jobId||"");
  if(jobId){
    const job=loadRestoreJobV234_(jobId);
    const running=job&&String(job.state||"")==="running";
    const fresh=running&&(now-Number(job.updatedAt||0)<=RESTORE_STALLED_TTL_MS_V411_);
    if(!fresh){props.deleteProperty(RESTORE_MAINTENANCE_KEY_V345_);return null}
  }else if(String(state.stage||"")==="upload"&&now-updatedAt>RESTORE_STALLED_TTL_MS_V411_){
    props.deleteProperty(RESTORE_MAINTENANCE_KEY_V345_);return null;
  }
  return state;
}
function setRestoreMaintenanceV345_(state){
  const value={...(state||{}),active:true,updatedAt:Date.now()};
  PropertiesService.getScriptProperties().setProperty(RESTORE_MAINTENANCE_KEY_V345_,JSON.stringify(value));
  return value;
}
function clearRestoreMaintenanceV345_(restoreId){
  const current=getRestoreMaintenanceV345_();
  if(!current||!restoreId||String(current.restoreId||"")===String(restoreId))PropertiesService.getScriptProperties().deleteProperty(RESTORE_MAINTENANCE_KEY_V345_);
}
function publicRestoreMaintenanceV345_(){
  const state=getRestoreMaintenanceV345_();
  const restoreGeneration=getRestoreGenerationV347_();
  return state?{ok:true,active:true,restoreGeneration,restoreId:String(state.restoreId||""),jobId:String(state.jobId||""),stage:String(state.stage||"running"),updatedAt:Number(state.updatedAt||0),message:"系统正在 Restore，其他设备暂时禁止保存或同步。"}:{ok:true,active:false,restoreGeneration};
}

// V46.0: read-only health check. This function never repairs, writes, deletes or recalculates business data.
function healthV442_(){return healthV443_();}
function healthV443_(){
  const out={ok:true,apiVersion:DATA_VERSION_V8,releaseRevision:"910 → 930",sheetConnected:false,salesCardCount:0,pendingInventoryCount:0,issues:[],severe:false,dataRevision:getDataRevision_()};
  try{
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    if(!ss)throw new Error("Google Sheet 无法读取");
    out.sheetConnected=true;
    const month=currentMonthV8(),monthSheet=ss.getSheetByName(month),yearSheet=ss.getSheetByName(month.slice(0,4));
    if(!monthSheet&&!yearSheet)out.issues.push("当前月份 Sales 数据表尚未建立");
    const sh=ss.getSheetByName(SALES_PRODUCT_LINK_SHEET_V203_);
    if(sh&&sh.getLastRow()>1){
      const vals=sh.getRange(2,1,sh.getLastRow()-1,26).getDisplayValues(),seen=new Set(),cards=new Set();let duplicates=0,invalid=0;
      vals.forEach(r=>{
        const status=String(r[23]||"active").toLowerCase();if(status==="deleted"||status==="cancelled")return;
        const linkId=String(r[0]||"").trim(),type=String(r[2]||"").trim(),tx=String(r[20]||"").trim(),sync=String(r[13]||"").trim();
        if(tx)cards.add(tx);
        if(sync==="PENDING_IMPORT_LINK")out.pendingInventoryCount++;
        if(linkId){if(seen.has(linkId))duplicates++;seen.add(linkId)}else invalid++;
        if(!tx||!["daily","fair","live"].includes(type))invalid++;
      });
      out.salesCardCount=cards.size;
      if(duplicates)out.issues.push("发现 "+duplicates+" 项重复 Sales 同步记录");
      if(invalid)out.issues.push("发现 "+invalid+" 项 Sales 记录资料不完整");
      if(out.pendingInventoryCount)out.issues.push("有 "+out.pendingInventoryCount+" 项 Sales → Import 库存资料待处理");
    }
    const maintenance=getRestoreMaintenanceV345_();
    if(maintenance&&maintenance.active)out.issues.push("Backup / Restore Job 正在进行中");
  }catch(err){out.ok=false;out.severe=true;out.sheetConnected=false;out.message=err&&err.message?err.message:String(err);out.issues=[out.message]}
  return out;
}

function doGet(e) {
  const p = e.parameter || {}, action = p.action || "";
  let result;
  try {
    const restoreMaintenance=getRestoreMaintenanceV345_();
    if(action === "maintenanceStatusV345") result=publicRestoreMaintenanceV345_();
    else if(restoreMaintenance&&RESTORE_BLOCKED_ACTIONS_V345_.has(action)) result={ok:false,maintenance:true,restoreGeneration:getRestoreGenerationV347_(),message:"系统正在 Restore，暂时不能保存、同步或确认销售。请等待 Restore 完成后再试。"};
    else if(RESTORE_BLOCKED_ACTIONS_V345_.has(action)&&!restoreGenerationMatchesV347_(p)) result={ok:false,staleRestore:true,restoreGeneration:getRestoreGenerationV347_(),message:"Restore 已更新云端资料；这台设备的旧保存队列已取消。请刷新后再操作。"};
    else if (action === "warmup") result = { ok:true, version:DATA_VERSION_V8, warmedAt:new Date().toISOString() };
    else if (action === "registerPushSubscription") result = registerPushSubscriptionV185_(p);
    else if (action === "pushSubscriptionStatus") result = pushSubscriptionStatusV185_(p);
else if (action === "oneSignalDiagnostics") result = oneSignalDiagnosticsV181_();
    else if (action === "oneSignalLastDispatch") result = oneSignalLastDispatchV181_();
    else if (action === "revisionCheck") result = revisionCheckV142_();
    else if (action === "healthV443" || action === "healthV442") result = healthV443_();
    else if (action === "priorityRevisionV315") result = priorityRevisionCheckV315_();
    else if (action === "priorityRevisionV456") result = priorityRevisionCheckV456_(p);
    else if (action === "load") result = loadDataV8();
    else if (action === "loadMonth") result = loadMonthDataV97(p.month);
    else if (action === "syncBundleV450") result = syncBundleV450_(p.month);
    else if (action === "loadYear") result = loadYearDataV96(p.year);
    else if (action === "historicalHighs") result = historicalHighsV174_();
    else if (action === "getSalesChangeLog") result = getSalesChangeLogV365_(p);
    else if (action === "getAllSalesChangeLogs") result = getAllSalesChangeLogsV236_();
    else if (action === "getTurnoverEntriesV376") result = getTurnoverEntriesV376_(p);
    else if (action === "getAllTurnoverEntriesV376") result = getAllTurnoverEntriesV376_();
    else if (action === "saveSalesProductLink") result = saveSalesProductLinkV203_(p);
    else if (action === "saveSalesProductLinks") result = saveSalesProductLinksV206_(p);
    else if (action === "confirmSalesCardInventoryV249") result = confirmSalesCardInventoryV249_(p);
    else if (action === "getPendingInventorySalesCardsV250") result = getPendingInventorySalesCardsV250_();
    else if (action === "getSalesInventoryAckStatusV408") result = getSalesInventoryAckStatusV408_(p);
    else if (action === "getSalesProductLinks") result = getSalesProductLinksV206_(p);
    else if (action === "getSalesInventoryFeed") result = getSalesInventoryFeedV256_(p);
    else if (action === "deleteSalesTransaction") result = deleteSalesTransactionV256_(p);
    else if (action === "verifySalesTransactionDeletedV459") result = verifySalesTransactionDeletedV459_(p);
    else if (action === "getImportProducts") result = getImportProductsV212_();
    else if (action === "deleteSalesProductLink") result = deleteSalesProductLinkV206_(p);
    else if (action === "getAllSalesProductLinks") result = getAllSalesProductLinksV203_();
    else if (action === "dispatchSalesNotification") result = dispatchSalesNotificationV185_(p);
    else if (action === "saveDaily") result = saveDaily(p);
    else if (action === "saveFairSessionV281") result = saveFairSessionV281_(p);
    else if (action === "getFairSessionsV281") result = getFairSessionsV281_();
    else if (action === "deleteFairLocationV358") result = deleteFairLocationV358_(p);
    else if (action === "saveFairBatch") result = saveFairBatch(p);
    else if (action === "saveFairSingle") result = saveFairSingle(p);
    else if (action === "saveLive") result = saveLive(p);
    else if (action === "saveTurnoverEntriesV376") result = saveTurnoverEntriesV376_(p);
    else if (action === "saveCommissionSettings") result = saveCommissionSettingsCloud(p);
    else if (action === "saveFairCommissionFast") result = saveFairCommissionFastCloud_(p);
    else if (action === "saveLiveCommissionFast") result = saveLiveCommissionFastCloud_(p);
    else if (action === "loadAccessSettings") result = {
      ok: true,
      accessSettings: getAccessSettingsCloud()
    };
    else if (action === "saveAccessSettings") result = saveAccessSettingsCloud(p);
    else if (action === "accessVersion") result = {
      ok: true,
      version: "4920",
      accessSettingsSupported: true
    };
    else if (action === "resetCommissionSettings") result = resetCommissionSettingsCloud();
    else if (action === "closeMonth") result = closeMonthV8(p);
    else if (action === "closeYear") result = closeYearV217_(p);
    else if (action === "restoreBegin") result = restoreBeginV8(p);
    else if (action === "restoreChunk") result = restoreChunkV8(p);
    else if (action === "restorePrepare") result = restorePrepareV233_(p);
    else if (action === "restoreApplyMonth") result = restoreApplyMonthV233_(p);
    else if (action === "restoreFinalize") result = restoreFinalizeV233_(p);
    else if (action === "restoreJobStart") result = restoreJobStartV234_(p);
    else if (action === "restoreJobStatus") result = restoreJobStatusV234_(p);
    else if (action === "restoreJobStep") result = restoreJobStepV234_(p);
    else if (action === "restoreCommit") result = restoreCommitV8(p);
    else if (action === "copyLegacyYearSheetsToMonthlySafely") result = copyLegacyYearSheetsToMonthlySafely();
    else if (action === "deduplicateMonthlySheets") result = deduplicateMonthlySheets();
    else if (action === "ping") result = { ok:true, message:"Lover Legend Sales API V49.2 running", systemState:getSystemStateV8() };
    else result = { ok:false, message:"Unknown action: " + action };
  } catch (err) { result = { ok:false, message:err.message || String(err) }; }
  return output(result, p.callback);
}

function currentMonthV8(){return Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyy-MM")}

function isCurrentMonthLastDayV196_(){
  const now=new Date(),tz=Session.getScriptTimeZone();
  const y=Number(Utilities.formatDate(now,tz,"yyyy")),m=Number(Utilities.formatDate(now,tz,"MM")),d=Number(Utilities.formatDate(now,tz,"dd"));
  return d===new Date(y,m,0).getDate();
}
function sanitizeClosedMonthsV197_(months){
  const current=currentMonthV8(),allowCurrent=isCurrentMonthLastDayV196_();
  return [...new Set((months||[]).map(m=>String(m||"")).filter(m=>/^\d{4}-\d{2}$/.test(m)))]
    .filter(m=>m<current||(m===current&&allowCurrent));
}
function cleanupInvalidClosedMonthsV197_(){
  const current=currentMonthV8(),allowCurrent=isCurrentMonthLastDayV196_();
  const sheet=getSettingsSheet(),last=sheet.getLastRow();
  if(last<=1)return false;
  const values=sheet.getRange(2,1,last-1,1).getValues();
  let changed=false;
  for(let i=values.length-1;i>=0;i--){
    const key=String(values[i][0]||"");
    if(key.indexOf("closed_month::")!==0)continue;
    const month=key.substring(14);
    const valid=/^\d{4}-\d{2}$/.test(month)&&(month<current||(month===current&&allowCurrent));
    if(!valid){sheet.deleteRow(i+2);changed=true}
  }
  if(changed)clearLoadCache();
  return changed;
}
function getClosedMonthsV8(){
  cleanupInvalidClosedMonthsV197_();
  const sheet=getSettingsSheet(),last=sheet.getLastRow(),values=last>1?sheet.getRange(2,1,last-1,2).getValues():[];
  return sanitizeClosedMonthsV197_(values.filter(r=>String(r[0]||"").indexOf("closed_month::")===0).map(r=>String(r[0]).substring(14))).sort();
}
function getCommissionSnapshotsV8(){const sheet=getSettingsSheet(),last=sheet.getLastRow(),values=last>1?sheet.getRange(2,1,last-1,2).getValues():[],out={};values.forEach(r=>{const key=String(r[0]||"");if(key.indexOf("month_commission::")!==0)return;const month=key.substring(18);try{out[month]=JSON.parse(String(r[1]||"{}"))}catch(e){}});return out}
function getSystemStateV8(){
  cleanupInvalidClosedMonthsV197_();
  const sheet=getSettingsSheet(),last=sheet.getLastRow();
  const values=last>1?sheet.getRange(2,1,last-1,2).getValues():[];
  const closedMonths=[],commissionSnapshots={};
  values.forEach(r=>{
    const key=String(r[0]||"");
    if(key.indexOf("closed_month::")===0){
      const month=key.substring(14);
      if(/^\d{4}-\d{2}$/.test(month))closedMonths.push(month);
    }else if(key.indexOf("month_commission::")===0){
      const month=key.substring(18);
      try{commissionSnapshots[month]=JSON.parse(String(r[1]||"{}"))}catch(e){}
    }
  });
  const safeClosedMonths=sanitizeClosedMonthsV197_(closedMonths).sort();
  return{dataVersion:DATA_VERSION_V8,currentMonth:currentMonthV8(),closedMonths:safeClosedMonths,commissionSnapshots,restoreGeneration:getRestoreGenerationV347_()};
}
function loadDataV8(){
  const result=loadData();
  result.systemState=getSystemStateV8();
  result.dataVersion=DATA_VERSION_V8;
  result.dataRevision=getDataRevision_();
  // loadData() already includes accessSettings; do not scan Settings twice.
  return result;
}
function assertWritableDateV8(date){if(!(date instanceof Date)||isNaN(date.getTime()))throw new Error("Invalid date");return true}

function closeMonthV8(p){
  const month=String(p.month||"");if(!/^\d{4}-\d{2}$/.test(month))throw new Error("月份格式错误");if(month!==currentMonthV8())throw new Error("只能结算系统当前月份 "+currentMonthV8());if(!isCurrentMonthLastDayV196_())throw new Error("月底结算只能在当月最后一天执行");
  const lock=LockService.getScriptLock();lock.waitLock(30000);try{const sheet=getSettingsSheet(),key="closed_month::"+month,last=sheet.getLastRow(),values=last>1?sheet.getRange(2,1,last-1,2).getValues():[],found=values.findIndex(r=>String(r[0]||"")===key);if(found<0)sheet.appendRow([key,new Date()]);else sheet.getRange(found+2,2).setValue(new Date());const snapshotKey="month_commission::"+month,snapshot=JSON.stringify(getCommissionSettingsCloud()),last2=sheet.getLastRow(),values2=last2>1?sheet.getRange(2,1,last2-1,2).getValues():[],snapIndex=values2.findIndex(r=>String(r[0]||"")===snapshotKey);if(snapIndex<0)sheet.appendRow([snapshotKey,snapshot]);else sheet.getRange(snapIndex+2,2).setValue(snapshot);formatSettingsSheet(sheet);clearLoadCacheForPeriods([month]);const dataRevision=bumpDataRevision_();return{ok:true,message:"Month closed",dataRevision,systemState:getSystemStateV8()}}finally{lock.releaseLock()}
}

function closeYearV217_(p){
  const year=String(p.year||"");if(!/^\d{4}$/.test(year))throw new Error("年份格式错误");
  const now=new Date(),tz=Session.getScriptTimeZone()||"Asia/Kuala_Lumpur",cy=Utilities.formatDate(now,tz,"yyyy"),md=Utilities.formatDate(now,tz,"MM-dd");
  if(year!==cy)throw new Error("只能结算系统当前年份 "+cy);if(md!=="12-31")throw new Error("年底结算只能在 12 月 31 日执行");
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    ss.getSheets().filter(sh=>new RegExp("^"+year+"-\\\\d{2}$").test(sh.getName())).forEach(sh=>ss.deleteSheet(sh));
    const links=getSalesProductLinkSheetV203_(),last=links.getLastRow();
    if(last>1){const vals=links.getRange(2,1,last-1,23).getValues(),keep=vals.filter(r=>{const d=r[1] instanceof Date?r[1]:parseDateFromApp(String(r[1]||""));return !d||Utilities.formatDate(d,tz,"yyyy")!==year});links.getRange(2,1,last-1,23).clearContent();if(keep.length)links.getRange(2,1,keep.length,23).setValues(keep)}
    const entrySheet=getTurnoverEntrySheetV376_(),entryLast=entrySheet.getLastRow();
    if(entryLast>1){const vals=entrySheet.getRange(2,1,entryLast-1,5).getValues(),keep=vals.filter(r=>{const d=r[1] instanceof Date?r[1]:parseDateFromApp(String(r[1]||''));return !d||Utilities.formatDate(d,tz,'yyyy')!==year});entrySheet.getRange(2,1,entryLast-1,5).clearContent();if(keep.length)entrySheet.getRange(2,1,keep.length,5).setValues(keep)}
    const settings=getSettingsSheet(),slast=settings.getLastRow();
    if(slast>1){const vals=settings.getRange(2,1,slast-1,2).getValues(),del=[];vals.forEach((r,i)=>{const k=String(r[0]||"");if(k.indexOf("closed_month::"+year+"-")===0||k.indexOf("month_commission::"+year+"-")===0)del.push(i+2)});del.reverse().forEach(r=>settings.deleteRow(r));formatSettingsSheet(settings)}
    clearLoadCache();const dataRevision=bumpDataRevision_();return{ok:true,year,dataRevision,systemState:getSystemStateV8()};
  }finally{lock.releaseLock()}
}

function getRestoreBufferSheetV8(){const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName("_Restore_V8");if(!sh){sh=ss.insertSheet("_Restore_V8");sh.getRange(1,1,1,3).setValues([["Restore ID","Index","Data"]]);sh.hideSheet()}return sh}
function restoreBeginV8(p){const id=String(p.restoreId||""),total=Number(p.totalChunks||0);if(!/^restore_[a-zA-Z0-9_]+$/.test(id)||!Number.isInteger(total)||total<1||total>5000)throw new Error("Restore 参数无效");const active=getRestoreMaintenanceV345_();if(active&&String(active.restoreId||"")!==id)throw new Error("系统已有 Restore 任务正在进行，请等待完成后再试");setRestoreMaintenanceV345_({restoreId:id,stage:"upload"});const sh=getRestoreBufferSheetV8(),last=sh.getLastRow();if(last>1)sh.getRange(2,1,last-1,3).clearContent();sh.getRange(2,1,1,3).setValues([[id,-1,JSON.stringify({total,createdAt:Date.now()})]]);return{ok:true,maintenance:true}}
function restoreChunkV8(p){const id=String(p.restoreId||""),index=Number(p.index),data=String(p.data||""),sh=getRestoreBufferSheetV8(),meta=JSON.parse(String(sh.getRange(2,3).getValue()||"null"));if(String(sh.getRange(2,1).getValue())!==id||!meta||!Number.isInteger(index)||index<0||index>=meta.total)throw new Error("Restore 区块无效");setRestoreMaintenanceV345_({restoreId:id,stage:"upload"});sh.getRange(index+3,1,1,3).setValues([[id,index,data]]);return{ok:true,index}}

function readRestorePayloadV233_(restoreId){
  const id=String(restoreId||""),sh=getRestoreBufferSheetV8();
  const meta=JSON.parse(String(sh.getRange(2,3).getValue()||"null"));
  if(String(sh.getRange(2,1).getValue())!==id||!meta)throw new Error("Restore 工作已失效");
  const values=meta.total?sh.getRange(3,1,meta.total,3).getValues():[],parts=new Array(meta.total);
  values.forEach(r=>{if(String(r[0])===id&&Number.isInteger(Number(r[1])))parts[Number(r[1])]=String(r[2]||"")});
  for(let i=0;i<parts.length;i++)if(parts[i]===undefined)throw new Error("Restore 缺少区块 "+(i+1));
  let payload;
  try{payload=JSON.parse(parts.join(""))}catch(e){throw new Error("Backup JSON 无效")}
  if(!payload||!Array.isArray(payload.rows)||!payload.commissionSettings)throw new Error("Backup 内容不完整");
  return{payload,sh,meta};
}
function restoreRecordsV233_(payload){
  return payload.rows.map(r=>{
    const date=parseDateFromApp(r.date);if(!date)return null;
    return{
      type:normalizeType(r.type),date,
      company:normalizeType(r.type)==="fair"?"fair":normalizeCompany(r.company),
      location:normalizeType(r.type)==="live"?canonicalLiveHost(r.location):canonicalLocation(r.location),
      amount:Number(r.amount||0),
      updatedAt:parseDateTimeFromApp(r.updatedAt)||new Date()
    }
  }).filter(Boolean);
}
function restorePrepareV233_(p){
  const id=String(p.restoreId||""),ctx=readRestorePayloadV233_(id),payload=ctx.payload;
  const records=restoreRecordsV233_(payload),months=[...new Set(records.map(r=>monthSheetName(r.date)))].sort();
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    ss.getSheets().filter(x=>/^\d{4}(-\d{2})?$/.test(x.getName())).forEach(x=>ss.deleteSheet(x));
    const meta={...(ctx.meta||{}),preparedAt:Date.now(),months,rows:payload.rows.length};
    ctx.sh.getRange(2,3).setValue(JSON.stringify(meta));
    clearLoadCache();
  }finally{lock.releaseLock()}
  return{ok:true,months,rows:payload.rows.length,productLinks:Array.isArray(payload.productLinks)?payload.productLinks.length:0};
}
function restoreApplyMonthV233_(p){
  const id=String(p.restoreId||""),month=String(p.month||"");
  if(!/^\d{4}-\d{2}$/.test(month))throw new Error("Restore 月份参数无效");
  const ctx=readRestorePayloadV233_(id),records=restoreRecordsV233_(ctx.payload).filter(r=>monthSheetName(r.date)===month);
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    if(records.length)fastApplyRecordsToMonthUnlocked(month,records);
    clearLoadCache();
  }finally{lock.releaseLock()}
  return{ok:true,month,rows:records.length};
}
function restoreFairSessionsV282_(sessions){
  const sh=getFairSessionSheetV281_();
  if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,5).clearContent();
  const vals=(Array.isArray(sessions)?sessions:[]).map(s=>{
    const loc=canonicalLocation(String(s.location||"")),start=String(s.start||""),end=String(s.end||"");
    if(!loc||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return null;
    return[loc,new Date(start+"T00:00:00"),new Date(end+"T00:00:00"),parseDateTimeFromApp(s.updatedAt)||new Date(),"active"];
  }).filter(Boolean);
  if(vals.length)sh.getRange(2,1,vals.length,5).setValues(vals);
  sh.getRange("B:C").setNumberFormat("dd-MM-yyyy");sh.getRange("D:D").setNumberFormat("dd-MM-yyyy HH:mm");
  try{sh.autoResizeColumns(1,5)}catch(_){}
  return vals.length;
}
function restoreFinalizeV233_(p){
  const id=String(p.restoreId||""),ctx=readRestorePayloadV233_(id),payload=ctx.payload,sh=ctx.sh;
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    writeSettingsFromBackupV8(payload.commissionSettings,payload.closedMonths||[],payload.commissionSnapshots||{},payload.accessSettings||null);
    restoreSalesProductLinksV203_(payload.productLinks||[]);
    restoreSalesChangeLogsV236_(payload);
    restoreFairSessionsV282_(payload.fairSessions||[]);
    restoreTurnoverEntriesV376_(payload.turnoverEntries||[]);
    formatOperationalSheetsV282_();
    clearLoadCache();
    bumpDataRevision_();
    bumpPriorityCardV315_();
  }finally{
    lock.releaseLock();
  }
  return{ok:true,message:"Restore completed",dataRevision:getDataRevision_(),systemState:getSystemStateV8(),rows:payload.rows.length};
}

function verifyRestoredTurnoverV347_(payload){
  const expected=new Map();
  restoreRecordsV233_(payload).forEach(record=>{
    const row={type:record.type,date:formatDateForApp(record.date),company:record.company,location:record.type==="live"?canonicalLiveHost(record.location||""):canonicalLocation(record.location||""),amount:Number(record.amount||0),updatedAt:(record.updatedAt instanceof Date?record.updatedAt.toISOString():String(record.updatedAt||""))};
    const key=rowKey(row),old=expected.get(key);if(!old||newerRow(old,row)===row)expected.set(key,row);
  });
  [...expected.entries()].forEach(([key,row])=>{if(Number(row.amount||0)<=0)expected.delete(key)});
  const actual=new Map(),ss=SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().filter(sh=>/^\d{4}-\d{2}$/.test(sh.getName())).forEach(sh=>{const last=sh.getLastRow();if(last<=1)return;sh.getRange(2,1,last-1,6).getValues().forEach(raw=>{const row=normalizeRow(raw);if(!row||Number(row.amount||0)<=0)return;const key=rowKey(row),old=actual.get(key);actual.set(key,old?newerRow(old,row):row)})});
  const issues=[];
  expected.forEach((row,key)=>{const got=actual.get(key);if(!got)issues.push(`${row.type} ${row.date} ${row.location||row.company}: Backup RM${Number(row.amount).toFixed(2)} / Restore 缺失`);else if(Math.abs(Number(got.amount)-Number(row.amount))>0.005)issues.push(`${row.type} ${row.date} ${row.location||row.company}: Backup RM${Number(row.amount).toFixed(2)} / Restore RM${Number(got.amount).toFixed(2)}`)});
  actual.forEach((row,key)=>{if(!expected.has(key))issues.push(`${row.type} ${row.date} ${row.location||row.company}: Backup 无记录 / Restore RM${Number(row.amount).toFixed(2)}`)});
  const expectedTotal=[...expected.values()].reduce((s,r)=>s+Number(r.amount||0),0),actualTotal=[...actual.values()].reduce((s,r)=>s+Number(r.amount||0),0);
  if(issues.length)throw new Error("营业资料逐笔验证失败："+issues.slice(0,8).join("；"));
  return{expectedCount:expected.size,actualCount:actual.size,expectedTotal,actualTotal};
}


const RESTORE_JOB_PROP_PREFIX_V234="LL_RESTORE_JOB_V234_";
function restoreJobPropKeyV234_(jobId){return RESTORE_JOB_PROP_PREFIX_V234+String(jobId||"")}
function saveRestoreJobV234_(job){
  job.updatedAt=Date.now();
  PropertiesService.getScriptProperties().setProperty(restoreJobPropKeyV234_(job.jobId),JSON.stringify(job));
  if(job.state==="running")setRestoreMaintenanceV345_({restoreId:job.restoreId,jobId:job.jobId,stage:job.stage||"running"});
  else clearRestoreMaintenanceV345_(job.restoreId);
  return job;
}
function loadRestoreJobV234_(jobId){
  const raw=PropertiesService.getScriptProperties().getProperty(restoreJobPropKeyV234_(jobId));
  if(!raw)return null;
  try{return JSON.parse(raw)}catch(e){return null}
}
function publicRestoreJobV234_(job){
  if(!job)return{ok:false,state:"missing",message:"找不到 Restore 工作"};
  return{
    ok:true,jobId:job.jobId,state:job.state,stage:job.stage||"",
    monthIndex:Number(job.monthIndex||0),totalMonths:Array.isArray(job.months)?job.months.length:0,
    currentMonth:job.currentMonth||"",message:job.message||"",error:job.error||"",
    rows:Number(job.rows||0),productLinks:Number(job.productLinks||0),restoreGeneration:Number(job.restoreGeneration||0),updatedAt:Number(job.updatedAt||0)
  };
}
function restoreJobStartV234_(p){
  const restoreId=String(p.restoreId||"");
  try{
    const ctx=readRestorePayloadV233_(restoreId),payload=ctx.payload;
    const records=restoreRecordsV233_(payload);
    const months=[...new Set(records.map(r=>monthSheetName(r.date)))].sort();
    const jobId="rj_"+Date.now()+"_"+Math.floor(Math.random()*100000);
    const job={
      jobId,restoreId,state:"running",stage:"prepare",months,monthIndex:0,currentMonth:"",
      rows:payload.rows.length,productLinks:Array.isArray(payload.productLinks)?payload.productLinks.length:0,
      message:"Restore 工作已建立，准备恢复月份资料。",createdAt:Date.now()
    };
    saveRestoreJobV234_(job);
    return publicRestoreJobV234_(job);
  }catch(e){clearRestoreMaintenanceV345_(restoreId);throw e}
}
function restoreJobStatusV234_(p){
  return publicRestoreJobV234_(loadRestoreJobV234_(String(p.jobId||"")));
}
function restoreJobStepV234_(p){
  const jobId=String(p.jobId||""),job=loadRestoreJobV234_(jobId);
  if(!job)return{ok:false,state:"missing",message:"找不到 Restore 工作"};
  if(job.state==="success"||job.state==="failed")return publicRestoreJobV234_(job);
  try{
    if(job.stage==="prepare"){
      const prep=restorePrepareV233_({restoreId:job.restoreId});
      job.months=Array.isArray(prep.months)?prep.months:job.months;
      job.monthIndex=0;job.stage=job.months.length?"months":"finalize";
      job.message=job.months.length?`准备完成，共 ${job.months.length} 个月份。`:"没有月份资料，准备恢复设置。";
      return publicRestoreJobV234_(saveRestoreJobV234_(job));
    }
    if(job.stage==="months"){
      if(job.monthIndex>=job.months.length){
        job.stage="finalize";job.message="月份资料已完成，准备恢复设置及销售卡。";
        return publicRestoreJobV234_(saveRestoreJobV234_(job));
      }
      const month=String(job.months[job.monthIndex]);
      job.currentMonth=month;job.message=`正在恢复 ${month} (${job.monthIndex+1}/${job.months.length})`;
      saveRestoreJobV234_(job);
      restoreApplyMonthV233_({restoreId:job.restoreId,month});
      job.monthIndex+=1;
      if(job.monthIndex>=job.months.length)job.stage="finalize";
      job.message=`${month} 已恢复 (${job.monthIndex}/${job.months.length})`;
      return publicRestoreJobV234_(saveRestoreJobV234_(job));
    }
    if(job.stage==="finalize"){
      job.message="正在恢复佣金、结算设置及销售卡...";
      saveRestoreJobV234_(job);
      const fin=restoreFinalizeV233_({restoreId:job.restoreId});
      job.stage="verify";job.message="正在验证 Restore 结果...";
      saveRestoreJobV234_(job);
      const ctx=readRestorePayloadV233_(job.restoreId);
      const turnoverCheck=verifyRestoredTurnoverV347_(ctx.payload);
      const expectedLinks=Array.isArray(ctx.payload.productLinks)?ctx.payload.productLinks.length:0;
      const salesLinkSheet=getSalesProductLinkSheetV203_();
      const actualLinks=salesLinkSheet.getLastRow()>1?salesLinkSheet.getLastRow()-1:0;
      if(actualLinks!==expectedLinks)throw new Error(`销售卡验证失败：Backup ${expectedLinks} 笔，恢复后 ${actualLinks} 笔`);

      const entrySheet=getTurnoverEntrySheetV376_();
      const actualTurnoverEntries=entrySheet.getLastRow()>1?entrySheet.getLastRow()-1:0;
      const expectedTurnoverEntries=Array.isArray(ctx.payload.turnoverEntries)?ctx.payload.turnoverEntries.length:0;
      if(actualTurnoverEntries!==expectedTurnoverEntries)throw new Error(`营业额明细验证失败：Backup ${expectedTurnoverEntries} 笔，恢复后 ${actualTurnoverEntries} 笔`);

      const changeSheet=getSalesChangeLogSheetV200_();
      const actualChangeLogs=changeSheet.getLastRow()>1?changeSheet.getLastRow()-1:0;
      const expectedChangeLogs=Array.isArray(ctx.payload.salesChangeLogs)
        ?ctx.payload.salesChangeLogs.length
        :(Array.isArray(ctx.payload.rows)?ctx.payload.rows.filter(r=>["daily","fair","live"].includes(normalizeType(String(r.type||"")))&&Number(r.amount||0)!==0).length:0);
      if(actualChangeLogs!==expectedChangeLogs)throw new Error(`新增/修改历史验证失败：应有 ${expectedChangeLogs} 笔，恢复后 ${actualChangeLogs} 笔`);

      job.restoreGeneration=bumpRestoreGenerationV347_();
      const sh=ctx.sh,last=ctx.sh.getLastRow();if(last>1)sh.getRange(2,1,last-1,3).clearContent();
      job.state="success";job.stage="done";job.message=`Restore 已完成逐笔验证：营业记录 ${turnoverCheck.actualCount} 笔 / RM${turnoverCheck.actualTotal.toFixed(2)}，销售卡 ${expectedLinks} 笔，新增/修改历史 ${actualChangeLogs} 笔。`;
      return publicRestoreJobV234_(saveRestoreJobV234_(job));
    }
    throw new Error("Restore 工作阶段无效");
  }catch(e){
    job.state="failed";job.stage="failed";job.error=String(e&&e.message?e.message:e);
    job.message="Restore 失败："+job.error;
    return publicRestoreJobV234_(saveRestoreJobV234_(job));
  }
}

function restoreCommitV8(p){
  const id=String(p.restoreId||""),sh=getRestoreBufferSheetV8(),meta=JSON.parse(String(sh.getRange(2,3).getValue()||"null"));if(String(sh.getRange(2,1).getValue())!==id||!meta)throw new Error("Restore 工作已失效");const values=meta.total?sh.getRange(3,1,meta.total,3).getValues():[],parts=new Array(meta.total);values.forEach(r=>{if(String(r[0])===id&&Number.isInteger(Number(r[1])))parts[Number(r[1])]=String(r[2]||"")});for(let i=0;i<parts.length;i++)if(parts[i]===undefined)throw new Error("Restore 缺少区块 "+(i+1));let payload;try{payload=JSON.parse(parts.join(""))}catch(e){throw new Error("Backup JSON 无效")};if(!payload||!Array.isArray(payload.rows)||!payload.commissionSettings)throw new Error("Backup 内容不完整");
  const lock=LockService.getScriptLock();lock.waitLock(30000);try{const ss=SpreadsheetApp.getActiveSpreadsheet();ss.getSheets().filter(x=>/^\d{4}(-\d{2})?$/.test(x.getName())).forEach(x=>ss.deleteSheet(x));const records=payload.rows.map(r=>{const date=parseDateFromApp(r.date);if(!date)return null;return{type:normalizeType(r.type),date,company:normalizeCompany(r.company),location:normalizeType(r.type)==="live"?canonicalLiveHost(r.location):canonicalLocation(r.location),amount:Number(r.amount||0),updatedAt:parseDateTimeFromApp(r.updatedAt)||new Date()}}).filter(Boolean);const groups={};records.forEach(r=>{const name=monthSheetName(r.date);(groups[name]||(groups[name]=[])).push(r)});Object.keys(groups).forEach(name=>fastApplyRecordsToMonthUnlocked(name,groups[name]));writeSettingsFromBackupV8(payload.commissionSettings,payload.closedMonths||[],payload.commissionSnapshots||{},payload.accessSettings||null);restoreSalesProductLinksV203_(payload.productLinks||[]);restoreTurnoverEntriesV376_(payload.turnoverEntries||[]);clearLoadCache();bumpDataRevision_()}finally{lock.releaseLock();const last=sh.getLastRow();if(last>1)sh.getRange(2,1,last-1,3).clearContent()}const turnoverCheck=verifyRestoredTurnoverV347_(payload),restoreGeneration=bumpRestoreGenerationV347_();return{ok:true,message:"Restore completed and verified",restoreGeneration,turnoverCheck,dataRevision:getDataRevision_(),systemState:getSystemStateV8(),rows:payload.rows.length}
}
function writeSettingsFromBackupV8(settings,closedMonths,commissionSnapshots,accessSettings){
  const sheet=getSettingsSheet(),s=settings||{},a=accessSettings||{};
  const normalized=normalizeCommissionSettingsPayload_({
    rate1:Number(s.rate1||6),
    rate2:Number(s.rate2||7),
    rate3:Number(s.rate3||8),
    liveHostRates:s.liveHostRates||{},
    liveHosts:s.liveHosts||{},
    inactiveLiveHosts:s.inactiveLiveHosts||{},
    liveRateSchedules:s.liveRateSchedules||[],
    fairRevision:Number(s.fairRevision||0),
    liveRevision:Number(s.liveRevision||0)
  });
  const data=[
    ["设置","数值"],
    ["data_version",DATA_VERSION_V8],
    ["commission_rate_1",normalized.rate1],
    ["commission_rate_2",normalized.rate2],
    ["commission_rate_3",normalized.rate3],
    ["commission_settings_json",JSON.stringify(normalized)],
    ["access_password_hash",String(a.accessPasswordHash||DEFAULT_ACCESS_PASSWORD_HASH_CLOUD)],
    ["access_password_hint",String(a.accessPasswordHint||DEFAULT_ACCESS_PASSWORD_HINT_CLOUD)]
  ];
  Object.entries(normalized.liveHosts||{}).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([k,v])=>data.push(["live_host_name::"+k,String(v||"")]));
  Object.entries(normalized.liveHostRates||{}).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([k,v])=>data.push(["live_host_rate::"+k,Number(v)]));
  sanitizeClosedMonthsV197_(closedMonths||[]).sort().forEach(m=>data.push(["closed_month::"+m,new Date()]));
  Object.entries(commissionSnapshots||{}).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([m,v])=>data.push(["month_commission::"+m,JSON.stringify(v)]));
  if(sheet.getMaxRows()<data.length)sheet.insertRowsAfter(sheet.getMaxRows(),data.length-sheet.getMaxRows());
  sheet.clearContents();
  sheet.getRange(1,1,data.length,2).setValues(data);
  formatSettingsSheet(sheet);
}
