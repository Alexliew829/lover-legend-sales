function getSavedFairLocations(){try{return JSON.parse(localStorage.getItem("lover_fair_locations")||"[]")}catch(e){return[]}}
function saveFairLocation(location){const loc=canonicalLocation(location);if(!loc)return;const list=getSavedFairLocations();if(!list.some(x=>canonicalLocation(x)===loc))list.push(loc);list.sort();localStorage.setItem("lover_fair_locations",JSON.stringify(list));renderFairLocationOptions()}
function collectFairLocations(){const fromRows=[...new Set(rows.filter(r=>r.type==="fair").map(r=>canonicalLocation(r.location)).filter(Boolean))],fromStorage=getSavedFairLocations(),merged=[];[...fromRows,...fromStorage].forEach(x=>{const loc=canonicalLocation(x);if(loc&&!merged.some(y=>canonicalLocation(y)===loc))merged.push(loc)});merged.sort();localStorage.setItem("lover_fair_locations",JSON.stringify(merged));return merged}
function renderFairLocationOptions(){const el=document.getElementById("fairLocationListOptions");if(el)el.innerHTML=collectFairLocations().map(loc=>`<option value="${loc}"></option>`).join("")}
const companyNames={balakong:"Lover Legend Adenium - Balakong",belimbing:"Lover Legend Gardening - Belimbing"};
function selectedMonth(){return document.getElementById("monthPicker").value}
function selectedYear(){return document.getElementById("yearPicker").value}
function selectedDashboardDateISO(){
  const el=document.getElementById("dashboardDate");
  return el&&/^\d{4}-\d{2}-\d{2}$/.test(el.value)?el.value:todayISO();
}
function selectedDashboardDateDisplay(){return isoToDisplay(selectedDashboardDateISO())}
function sameMonth(date){return sameMonthDisplay(date,selectedMonth())}
function sameYear(date){return sameYearDisplay(date,selectedYear())}
function showPage(name,el){
  const current=document.querySelector(".page.active");
  if(current&&current.id==="page-more"&&name!=="more"&&(fairCommissionDraftDirty||liveCommissionDraftDirty)){
    const pending=[];
    if(fairCommissionDraftDirty)pending.push("Fair 佣金机制");
    if(liveCommissionDraftDirty)pending.push("直播佣金制度");
    alert("请先储存"+pending.join("和")+"，才能离开 More 页面。");
    return false;
  }
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById("page-"+name).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  el.classList.add("active");

  // V21.4: every time Live is opened, start from today's date.
  // A previous date is loaded only when the user deliberately selects it.
  if(name==="live"&&document.getElementById("liveDate")){
    setDateControl("liveDate",todayISO());
    updateLiveInputFromSelectedDate();
    renderLiveMonthlyList();
    renderLiveDailySummary();
  }
  if(name==="home")renderDashboard();
  if(name==="report")renderTable();
  if(name==="fair"&&typeof refreshFairInputsFromRows==="function")refreshFairInputsFromRows(false);

  // V21.4: page switching never waits for or triggers cloud sync.
  // Periodic/background sync is handled separately.
}
function rowKey(r){const location=r.type==="live"?normalizeLiveHostKey(r.location||""):normalizeFairLocationKey(r.location||"");return [r.type,r.date,r.company,location].join("|")}
function dedupeRows(list){const m=new Map();list.forEach(r=>{const k=rowKey(r),old=m.get(k);if(!old||String(r.updatedAt||"")>=String(old.updatedAt||""))m.set(k,r)});return [...m.values()]}
function upsertLocalRow(n){rows=dedupeRows([...rows,n])}
function getDailyAmount(d,c){const f=rows.find(r=>r.type==="daily"&&r.date===d&&r.company===c);return f?Number(f.amount||0):0}
function updateDailyInputFromSelectedDate(){const d=isoToDisplay(document.getElementById("saleDate").value),c=document.getElementById("company").value,a=getDailyAmount(d,c);document.getElementById("dailySales").value=formatAmount(a);document.getElementById("salesDateResult").textContent=`${companyNames[c]}｜${d}｜${money(a)}`;renderSalesMonthlyList()}
function totalBy(type,company="",mode="month"){return rows.filter(r=>r.type===type).filter(r=>company?r.company===company:true).filter(r=>mode==="today"?r.date===isoToDisplay(todayISO()):mode==="month"?sameMonth(r.date):mode==="year"?sameYear(r.date):true).reduce((s,r)=>s+Number(r.amount||0),0)}

// V21.4: Top 5 business performance. Uses rows already loaded in memory only;
// opening/closing Top 5 never triggers an extra cloud request.
function weekdayZh(displayDate){
  const iso=displayToISO(displayDate);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return "";
  const parts=iso.split("-").map(Number);
  const d=new Date(parts[0],parts[1]-1,parts[2]);
  return ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][d.getDay()];
}

const HISTORY_HIGH_CACHE_KEY="lover_sales_history_high_v174";
let historicalHighsMemory=null;
let historicalHighsPromise=null;

function readHistoricalHighsCache(){
  if(historicalHighsMemory)return historicalHighsMemory;
  try{
    const parsed=JSON.parse(localStorage.getItem(HISTORY_HIGH_CACHE_KEY)||"null");
    if(parsed&&parsed.ok&&parsed.highs){
      const localRevision=typeof getLocalDataRevision==="function"?Number(getLocalDataRevision()||0):0;
      if(!localRevision||Number(parsed.dataRevision||0)===localRevision){
        historicalHighsMemory=parsed;
        return parsed;
      }
    }
  }catch(e){}
  return null;
}

function saveHistoricalHighsCache(data){
  historicalHighsMemory=data||null;
  try{
    if(data&&data.ok)localStorage.setItem(HISTORY_HIGH_CACHE_KEY,JSON.stringify(data));
  }catch(e){}
}

function historicalKindForPanel(elId){
  if(elId==="balakongTop3")return "balakong";
  if(elId==="belimbingTop3")return "belimbing";
  if(elId==="fairHomeTop3"||elId==="fairPageTop3")return "fair";
  if(elId==="liveHomeTop3"||elId==="livePageTop3")return "live";
  return "";
}

function historyRecordHtml(record,kind,state="ready"){
  if(state==="loading"){
    return '<div class="history-record history-loading"><span>🏆 历史最高额</span><small>正在读取…</small></div>';
  }
  if(!record||!Number(record.amount||0)){
    return '<div class="history-record"><span>🏆 历史最高额</span><small>暂无历史记录</small></div>';
  }
  const weekday=weekdayZh(record.date);
  let detail="";
  if(kind==="fair")detail=`${canonicalLocation(record.location||"Fair")} · ${record.date} · ${weekday}`;
  else if(kind==="live")detail=`${canonicalLiveHost(record.location||"")||"未注明主播"} · ${record.date} · ${weekday}`;
  else detail=`${record.date} · ${weekday}`;
  return `<div class="history-record">
    <div class="history-record-left"><span class="history-record-label">🏆 历史最高额</span><span class="history-record-detail">${detail}</span></div>
    <strong>RM${money(record.amount)}</strong>
  </div>`;
}

function currentTopAmountForPanel(elId){
  let list=[];
  if(elId==="balakongTop3")list=top3RowsForMonth("daily",selectedMonth(),"balakong");
  else if(elId==="belimbingTop3")list=top3RowsForMonth("daily",selectedMonth(),"belimbing");
  else if(elId==="fairHomeTop3")list=top3RowsForMonth("fair",selectedMonth());
  else if(elId==="liveHomeTop3")list=top3RowsForMonth("live",selectedMonth());
  else if(elId==="fairPageTop3")list=top3RowsForMonth("fair",monthFromDateControl("fairStart"));
  else if(elId==="livePageTop3")list=top3RowsForMonth("live",getLiveSelectedMonth());
  return list.length?Number(list[0].amount||0):0;
}

function recordGapHtml(record,elId){
  const recordAmount=Number(record&&record.amount||0);
  const currentTop=currentTopAmountForPanel(elId);
  if(!recordAmount||!currentTop)return "";
  // Sales values support cents. To BREAK (not merely tie) the record, exceed it by RM0.01.
  const gap=Math.max(0,Math.round((recordAmount-currentTop+0.01)*100)/100);
  if(gap<=0)return '<div class="history-record-gap history-record-achieved">🎯 已打破历史纪录</div>';
  return `<div class="history-record-gap">🎯 距离打破纪录还差 <strong>RM${money(gap)}</strong></div>`;
}

function renderHistoricalRecordForPanel(elId,state="ready"){
  const host=document.getElementById(elId+"History");
  if(!host)return;
  const kind=historicalKindForPanel(elId);
  const data=readHistoricalHighsCache();
  if(state==="loading"&&!data){
    host.innerHTML=historyRecordHtml(null,kind,"loading");
    return;
  }
  const record=data&&data.highs?data.highs[kind]:null;
  host.innerHTML=historyRecordHtml(record,kind)+recordGapHtml(record,elId);
}

function renderAllVisibleHistoricalRecords(){
  ["balakongTop3","belimbingTop3","fairHomeTop3","liveHomeTop3","fairPageTop3","livePageTop3"]
    .forEach(id=>renderHistoricalRecordForPanel(id));
}

async function ensureHistoricalHighs(){
  const cached=readHistoricalHighsCache();
  if(cached){
    renderAllVisibleHistoricalRecords();
    return cached;
  }
  if(historicalHighsPromise)return historicalHighsPromise;
  if(typeof jsonp!=="function")return null;

  ["balakongTop3","belimbingTop3","fairHomeTop3","liveHomeTop3","fairPageTop3","livePageTop3"]
    .forEach(id=>renderHistoricalRecordForPanel(id,"loading"));

  historicalHighsPromise=jsonp(
    {action:"historicalHighs"},
    {timeoutMs:20000}
  ).then(data=>{
    if(data&&data.ok&&data.highs){
      saveHistoricalHighsCache(data);
      renderAllVisibleHistoricalRecords();
      return data;
    }
    throw new Error((data&&data.message)||"历史纪录读取失败");
  }).catch(err=>{
    console.warn("Historical highs:",err);
    renderAllVisibleHistoricalRecords();
    return null;
  }).finally(()=>{
    historicalHighsPromise=null;
  });
  return historicalHighsPromise;
}

function top3RowsForMonth(type,month,company=""){
  return dedupeRows(rows)
    .filter(r=>r.type===type)
    .filter(r=>company?r.company===company:true)
    .filter(r=>displayToISO(r.date).slice(0,7)===month)
    .filter(r=>Number(r.amount||0)>0)
    .sort((a,b)=>Number(b.amount||0)-Number(a.amount||0)||displayToISO(b.date).localeCompare(displayToISO(a.date))).slice(0,5);
}
function renderTop3List(elId,list,kind){
  const el=document.getElementById(elId);
  if(!el)return;
  const medals=["🥇","🥈","🥉"];
  const rowsHtml=list.length
    ?list.map((r,i)=>{
      const weekday=weekdayZh(r.date);
      let lead="";
      if(kind==="fair")lead=`<span class="top3-name">${canonicalLocation(r.location||"Fair")}</span><span class="top3-sep"> · </span>`;
      else if(kind==="live")lead=`<span class="top3-name">${canonicalLiveHost(r.location||"")||"未注明主播"}</span><span class="top3-sep"> · </span>`;
      return `<div class="top3-row">
        <div class="top3-meta"><span class="top3-rank">${medals[i]||"#"+(i+1)}</span>${lead}<span>${r.date}</span><span class="top3-sep"> · </span><span>${weekday}</span></div>
        <strong>RM${money(r.amount)}</strong>
      </div>`;
    }).join("")
    :'<div class="top3-empty">这个月份还没有营业额记录</div>';

  el.innerHTML=`<div id="${elId}History" class="history-record-host"></div>${rowsHtml}`;
  renderHistoricalRecordForPanel(elId);
}
function renderBusinessTop3(){
  const month=selectedMonth();
  renderTop3List("balakongTop3",top3RowsForMonth("daily",month,"balakong"),"daily");
  renderTop3List("belimbingTop3",top3RowsForMonth("daily",month,"belimbing"),"daily");
  renderTop3List("fairHomeTop3",top3RowsForMonth("fair",month),"fair");
  renderTop3List("liveHomeTop3",top3RowsForMonth("live",month),"live");
}
function renderFairPageTop3(){
  const month=monthFromDateControl("fairStart");
  renderTop3List("fairPageTop3",top3RowsForMonth("fair",month),"fair");
}
function renderLivePageTop3(){
  const month=getLiveSelectedMonth();
  renderTop3List("livePageTop3",top3RowsForMonth("live",month),"live");
}
function toggleTop3(id,btn){
  const panel=document.getElementById(id);
  if(!panel)return;
  const show=panel.classList.contains("hidden");
  panel.classList.toggle("hidden",!show);
  if(btn)btn.classList.toggle("active",show);
  if(show){
    if(id==="fairPageTop3")renderFairPageTop3();
    else if(id==="livePageTop3")renderLivePageTop3();
    else renderBusinessTop3();

    // V21.4: historical record is lazy. Top 5 opens instantly from local rows;
    // one shared history request runs only after the user explicitly expands Top 5.
    setTimeout(()=>{ ensureHistoricalHighs(); },0);
  }
}
function fairLocationsThisMonth(){return [...new Set(rows.filter(r=>r.type==="fair"&&sameMonth(r.date)&&Number(r.amount)>0).map(r=>canonicalLocation(r.location||"Fair")))].sort()}
function fairByLocation(){const g={};rows.filter(r=>r.type==="fair"&&sameMonth(r.date)&&Number(r.amount)>0).forEach(r=>{const l=canonicalLocation(r.location||"Fair");g[l]=(g[l]||0)+Number(r.amount||0)});return g}
function renderFairLocationList(){const g=fairByLocation(),locs=Object.keys(g).sort(),c=document.getElementById("fairLocationList");if(!locs.length){c.innerHTML='<div class="sub">这个月份还没有 Fair 记录</div>';return}const fairTotal=Object.values(g).reduce((sum,value)=>sum+Number(value||0),0);const rate=getFairCommissionRate(fairTotal)*100;c.innerHTML='<div class="fair-location-grid">'+locs.map(l=>`<div class="fair-location-card"><div class="fair-location-title">${l}</div><div class="fair-location-row"><span>营业额</span><b>${money(g[l])}</b></div><div class="fair-location-row"><span>佣金 ${Number(rate.toFixed(2))}%</span><b>${money(g[l]*rate/100)}</b></div></div>`).join("")+'</div>'}
function hasDashboardDateDailyRecord(company){
  const date=selectedDashboardDateDisplay();
  return rows.some(r=>
    r.type==="daily" &&
    r.company===company &&
    r.date===date
  );
}

function dashboardDateDailyAmount(company){
  return getDailyAmount(selectedDashboardDateDisplay(),company);
}

function dashboardDateTypeAmount(type){
  const date=selectedDashboardDateDisplay();
  return rows
    .filter(r=>r.type===type&&r.date===date)
    .reduce((sum,r)=>sum+Number(r.amount||0),0);
}

function hasDashboardDateTypeRecord(type){
  const date=selectedDashboardDateDisplay();
  return rows.some(r=>r.type===type&&r.date===date);
}

function dashboardDateLabel(){
  return selectedDashboardDateISO()===todayISO()
    ?"今天"
    :selectedDashboardDateDisplay();
}

function renderTodayCompanyStatus(){
  const balakongRecorded=hasDashboardDateDailyRecord("balakong");
  const belimbingRecorded=hasDashboardDateDailyRecord("belimbing");
  const fairRecorded=hasDashboardDateTypeRecord("fair");
  const liveRecorded=hasDashboardDateTypeRecord("live");

  const balakongAmount=dashboardDateDailyAmount("balakong");
  const belimbingAmount=dashboardDateDailyAmount("belimbing");
  const fairAmount=dashboardDateTypeAmount("fair");
  const liveAmount=dashboardDateTypeAmount("live");
  const totalAmount=balakongAmount+belimbingAmount+fairAmount+liveAmount;

  const warning=document.getElementById("todayWarning");
  const done=document.getElementById("todayDone");
  if(!warning||!done)return;

  const statusLine=(label,recorded,amount)=>
    `${recorded?"🟢":"🔴"} ${label}：<strong>RM${money(amount)}</strong>`+
    (recorded?"":" · 没有记录");

  const lines=[
    statusLine("Balakong",balakongRecorded,balakongAmount),
    statusLine("Belimbing",belimbingRecorded,belimbingAmount),
    statusLine("Fair",fairRecorded,fairAmount),
    statusLine("Live",liveRecorded,liveAmount),
    `<span class="daily-total-line">🟢 Total：<strong>RM${money(totalAmount)}</strong></span>`
  ];

  const allRecorded=balakongRecorded&&belimbingRecorded&&fairRecorded&&liveRecorded;
  if(allRecorded){
    warning.classList.add("hidden");
    done.classList.remove("hidden");
    done.innerHTML=lines.join("<br>");
    return;
  }

  done.classList.add("hidden");
  warning.classList.remove("hidden");
  warning.innerHTML=lines.join("<br>");
}

const DEFAULT_COMMISSION_SETTINGS={
  rate1:6,
  rate2:7,
  rate3:8,
  liveHostRates:{},
  liveHosts:{},
  inactiveLiveHosts:{},
  liveRateSchedules:[],
  fairRevision:0,
  liveRevision:0
};

let commissionSettings={...DEFAULT_COMMISSION_SETTINGS};
let liveCommissionDraftDirty=false;
let fairCommissionDraftDirty=false;
let savedFairCommissionSnapshot=null;
let savedLiveCommissionSnapshot=null;

function sortedCommissionMap(source){
  return Object.fromEntries(
    Object.entries(source||{})
      .map(([key,value])=>[String(key),value])
      .sort((a,b)=>a[0].localeCompare(b[0]))
  );
}

function fairCommissionComparable(settings){
  const source=normalizeCommissionSettings(settings||getCommissionSettings());
  return JSON.stringify({
    rate1:Number(source.rate1),
    rate2:Number(source.rate2),
    rate3:Number(source.rate3)
  });
}

function liveCommissionComparable(settings){
  const source=normalizeCommissionSettings(settings||getCommissionSettings());
  return JSON.stringify({
    liveHostRates:sortedCommissionMap(source.liveHostRates),
    liveHosts:sortedCommissionMap(source.liveHosts),
    inactiveLiveHosts:sortedCommissionMap(source.inactiveLiveHosts),
    liveRateSchedules:(source.liveRateSchedules||[])
      .map(item=>({
        id:String(item.id||""),
        startDate:String(item.startDate||""),
        endDate:String(item.endDate||""),
        rate:Number(item.rate)
      }))
      .sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.endDate.localeCompare(b.endDate)||a.id.localeCompare(b.id))
  });
}

function setSavedCommissionSnapshots(settings,{fair=true,live=true}={}){
  const normalized=normalizeCommissionSettings(settings||getCommissionSettings());
  if(fair)savedFairCommissionSnapshot=fairCommissionComparable(normalized);
  if(live)savedLiveCommissionSnapshot=liveCommissionComparable(normalized);
}

function currentFairDraftComparable(){
  const current=getCommissionSettings();
  const rate1=document.getElementById("commissionRate1");
  const rate2=document.getElementById("commissionRate2");
  const rate3=document.getElementById("commissionRate3");
  if(!rate1||!rate2||!rate3)return fairCommissionComparable(current);
  const values=[Number(rate1.value),Number(rate2.value),Number(rate3.value)];
  if(!values.every(Number.isFinite))return "invalid";
  return fairCommissionComparable({...current,rate1:values[0],rate2:values[1],rate3:values[2]});
}

function currentLiveDraftComparable(){
  const current=getCommissionSettings();
  const liveHostRates={...(current.liveHostRates||{})};
  const inputs=document.querySelectorAll("[data-live-host-key]");
  inputs.forEach(input=>{
    const key=String(input.dataset.liveHostKey||"");
    const rate=Number(input.value);
    if(key&&Number.isFinite(rate)&&rate>=0)liveHostRates[key]=rate;
  });
  return liveCommissionComparable({...current,liveHostRates});
}

function updateFairCommissionDraftState(){
  if(savedFairCommissionSnapshot===null)savedFairCommissionSnapshot=fairCommissionComparable(getCommissionSettings());
  fairCommissionDraftDirty=currentFairDraftComparable()!==savedFairCommissionSnapshot;
  const message=document.getElementById("fairCommissionSettingsMsg");
  if(message&&fairCommissionDraftDirty){
    message.textContent="尚未储存 Fair 佣金机制";
    message.classList.remove("hidden");
  }else if(message&&!fairCommissionDraftDirty&&message.textContent==="尚未储存 Fair 佣金机制"){
    message.textContent="没有需要储存的更改";
    message.classList.remove("hidden");
  }
  return fairCommissionDraftDirty;
}

function updateLiveCommissionDraftState(){
  if(savedLiveCommissionSnapshot===null)savedLiveCommissionSnapshot=liveCommissionComparable(getCommissionSettings());
  liveCommissionDraftDirty=currentLiveDraftComparable()!==savedLiveCommissionSnapshot;
  const message=document.getElementById("liveCommissionSettingsMsg");
  if(message&&liveCommissionDraftDirty){
    message.textContent="尚未储存直播佣金制度";
    message.classList.remove("hidden");
  }else if(message&&!liveCommissionDraftDirty&&message.textContent==="尚未储存直播佣金制度"){
    message.textContent="没有需要储存的更改";
    message.classList.remove("hidden");
  }
  return liveCommissionDraftDirty;
}

function normalizeCommissionSettings(settings){
  const source=settings||{};
  const rate1=Number(source.rate1);
  const rate2=Number(source.rate2);
  const rate3=Number(source.rate3);
  const fairRevision=Number.isFinite(Number(source.fairRevision))&&Number(source.fairRevision)>=0?Number(source.fairRevision):0;
  const liveRevision=Number.isFinite(Number(source.liveRevision))&&Number(source.liveRevision)>=0?Number(source.liveRevision):0;
  const liveHostRates={};
  const liveHosts={};
  const inactiveLiveHosts={};
  Object.entries(source.liveHostRates||{}).forEach(([key,value])=>{
    const cleanKey=String(key||"").replace(/\s+/g,"").toLowerCase();
    const rate=Number(value);
    if(cleanKey&&Number.isFinite(rate)&&rate>=0)liveHostRates[cleanKey]=rate;
  });
  const hostSource=Array.isArray(source.liveHosts)
    ? Object.fromEntries(source.liveHosts.map(name=>[normalizeLiveHostKey(name),canonicalLiveHost(name)]))
    : (source.liveHosts||{});
  Object.entries(hostSource).forEach(([key,value])=>{
    const cleanKey=String(key||"").replace(/\s+/g,"").toLowerCase();
    const name=canonicalLiveHost(value);
    if(cleanKey&&name)liveHosts[cleanKey]=name;
  });
  Object.entries(source.inactiveLiveHosts||{}).forEach(([key,value])=>{
    const cleanKey=String(key||"").replace(/\s+/g,"").toLowerCase();
    const name=canonicalLiveHost(value);
    if(cleanKey&&name&&!liveHosts[cleanKey])inactiveLiveHosts[cleanKey]=name;
  });
  Object.keys(liveHostRates).forEach(key=>{if(!liveHosts[key]&&!inactiveLiveHosts[key])liveHosts[key]=key.replace(/(^|\s)\S/g,c=>c.toUpperCase())});

  const liveRateSchedules=(Array.isArray(source.liveRateSchedules)?source.liveRateSchedules:[])
    .map((item,index)=>{
      const startDate=String(item&&item.startDate||"");
      const endDate=String(item&&item.endDate||"");
      const rate=Number(item&&item.rate);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||
         (endDate&&!/^\d{4}-\d{2}-\d{2}$/.test(endDate))||
         (endDate&&endDate<startDate)||
         !Number.isFinite(rate)||
         rate<0)return null;
      return{
        id:String(item.id||`${startDate}_${endDate}_${index}`),
        startDate,
        endDate,
        rate
      };
    })
    .filter(Boolean)
    .sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.endDate.localeCompare(b.endDate));

  if(![rate1,rate2,rate3].every(Number.isFinite)||rate1<0||rate2<0||rate3<0){
    return{...DEFAULT_COMMISSION_SETTINGS,liveHostRates:{},liveHosts:{},inactiveLiveHosts:{},liveRateSchedules:[],fairRevision,liveRevision};
  }
  return{rate1,rate2,rate3,liveHostRates,liveHosts,inactiveLiveHosts,liveRateSchedules,fairRevision,liveRevision};
}
function getCommissionSettings(){
  return{
    ...commissionSettings,
    liveHostRates:{...(commissionSettings.liveHostRates||{})},
    liveHosts:{...(commissionSettings.liveHosts||{})},
    inactiveLiveHosts:{...(commissionSettings.inactiveLiveHosts||{})},
    liveRateSchedules:(commissionSettings.liveRateSchedules||[]).map(item=>({...item}))
  };
}

function applyCommissionSettings(settings){
  commissionSettings=normalizeCommissionSettings(settings);
  localStorage.setItem(
    "lover_commission_settings_cache",
    JSON.stringify(commissionSettings)
  );
  loadCommissionSettingsForm();
  if(typeof renderDashboard==="function")renderDashboard();
  if(typeof renderLiveMonthlyList==="function")renderLiveMonthlyList();
  if(typeof renderLiveDailySummary==="function")renderLiveDailySummary();
}

function applyCloudCommissionSettings(settings){
  const incoming=normalizeCommissionSettings(settings);
  const local=getCommissionSettings();
  const incomingFairRevision=Number(incoming.fairRevision||0);
  const localFairRevision=Number(local.fairRevision||0);
  const incomingLiveRevision=Number(incoming.liveRevision||0);
  const localLiveRevision=Number(local.liveRevision||0);

  // V21.4: Fair and Live each have their own revision.
  // A stale device/cloud response can never overwrite a newer saved setting.
  const keepLocalFair=incomingFairRevision<localFairRevision;
  const keepLocalLive=liveCommissionDraftDirty||incomingLiveRevision<localLiveRevision;

  const merged=normalizeCommissionSettings({
    ...incoming,
    rate1:keepLocalFair?local.rate1:incoming.rate1,
    rate2:keepLocalFair?local.rate2:incoming.rate2,
    rate3:keepLocalFair?local.rate3:incoming.rate3,
    fairRevision:keepLocalFair?localFairRevision:incomingFairRevision,
    liveHostRates:keepLocalLive?local.liveHostRates:incoming.liveHostRates,
    liveHosts:keepLocalLive?local.liveHosts:incoming.liveHosts,
    inactiveLiveHosts:keepLocalLive?local.inactiveLiveHosts:incoming.inactiveLiveHosts,
    liveRateSchedules:keepLocalLive?local.liveRateSchedules:incoming.liveRateSchedules,
    liveRevision:keepLocalLive?localLiveRevision:incomingLiveRevision
  });

  applyCommissionSettings(merged);
  if(!keepLocalFair)savedFairCommissionSnapshot=fairCommissionComparable(incoming);
  if(!keepLocalLive)savedLiveCommissionSnapshot=liveCommissionComparable(incoming);
  updateFairCommissionDraftState();
  updateLiveCommissionDraftState();
}

function markLiveCommissionDraftDirty(){
  updateLiveCommissionDraftState();
}

function markFairCommissionDraftDirty(){
  updateFairCommissionDraftState();
}

function nextFairCommissionRevision(current=0){
  return Math.max(Date.now(),Number(current||0)+1);
}
function nextLiveCommissionRevision(current=0){
  return Math.max(Date.now(),Number(current||0)+1);
}

let fairCommissionRetryTimer=null;
function queueFairCommissionRetry(settings,targetMonth){
  if(fairCommissionRetryTimer)clearTimeout(fairCommissionRetryTimer);
  const snapshot=normalizeCommissionSettings(settings);
  fairCommissionRetryTimer=setTimeout(()=>{
    fairCommissionRetryTimer=null;
    saveFairCommissionSettingsToSheet(snapshot,targetMonth)
      .then(saved=>{
        const confirmed=normalizeCommissionSettings(saved||snapshot);
        const local=getCommissionSettings();
        if(Number(confirmed.fairRevision||0)>=Number(local.fairRevision||0)){
          applyCommissionSettings(confirmed);
          setSavedCommissionSnapshots(confirmed,{fair:true,live:false});
          updateFairCommissionDraftState();
          saveLocalDataCache(confirmed);
          renderDashboard();
          renderTable();
        }
        const message=document.getElementById("fairCommissionSettingsMsg");
        if(message){message.textContent="✅ Fair 佣金已同步";message.classList.remove("hidden");}
        setSync("已同步",true);
      })
      .catch(error=>{
        console.warn("Fair commission background retry delayed",error);
        const message=document.getElementById("fairCommissionSettingsMsg");
        if(message){message.textContent="本机已储存，云端稍后重试";message.classList.remove("hidden");}
        setSync("Fair 佣金等待云端同步",false,true);
        queueFairCommissionRetry(snapshot,targetMonth);
      });
  },2500);
}

let liveCommissionRetryTimer=null;
function queueLiveCommissionRetry(settings,targetMonth){
  if(liveCommissionRetryTimer)clearTimeout(liveCommissionRetryTimer);
  const snapshot=normalizeCommissionSettings(settings);
  liveCommissionRetryTimer=setTimeout(()=>{
    liveCommissionRetryTimer=null;
    saveLiveCommissionSettingsToSheet(snapshot,targetMonth)
      .then(saved=>{
        const confirmed=normalizeCommissionSettings(saved||snapshot);
        const local=getCommissionSettings();
        if(Number(confirmed.liveRevision||0)>=Number(local.liveRevision||0)){
          applyCommissionSettings(confirmed);
          setSavedCommissionSnapshots(confirmed,{fair:false,live:true});
          updateLiveCommissionDraftState();
          saveLocalDataCache(confirmed);
          renderLiveHostCommissionSettings();
          renderLiveRateSchedules();
          renderDashboard();
          renderTable();
          renderLiveMonthlyList();
        }
        const message=document.getElementById("liveCommissionSettingsMsg");
        if(message){message.textContent="✅ Live 佣金制度已同步";message.classList.remove("hidden");}
        setSync("已同步",true);
      })
      .catch(error=>{
        console.warn("Live commission background retry delayed",error);
        const message=document.getElementById("liveCommissionSettingsMsg");
        if(message){message.textContent="本机资料已保留，云端仍在等待同步";message.classList.remove("hidden");}
        setSync("Live 佣金等待云端同步",false,true);
      });
  },3500);
}

function loadCachedCommissionSettings(){
  try{
    const cached=JSON.parse(
      localStorage.getItem("lover_commission_settings_cache")||"null"
    );
    if(cached)commissionSettings=normalizeCommissionSettings(cached);
  }catch(e){
    commissionSettings={...DEFAULT_COMMISSION_SETTINGS};
  }
}

function loadCommissionSettingsForm(){
  const settings=getCommissionSettings();
  const rate1=document.getElementById("commissionRate1");
  const rate2=document.getElementById("commissionRate2");
  const rate3=document.getElementById("commissionRate3");
  if(rate1)rate1.value=settings.rate1;
  if(rate2)rate2.value=settings.rate2;
  if(rate3)rate3.value=settings.rate3;
}
function commissionConfigMonth(){
  const current=String(systemState&&systemState.currentMonth||monthISO());
  return /^\d{4}-\d{2}$/.test(current)?current:monthISO();
}

function getCommissionSettingsForMonth(month){
  const current=getCommissionSettings();
  const target=/^\d{4}-\d{2}$/.test(String(month||""))?String(month):selectedMonth();
  const snapshot=(systemState.commissionSnapshots||{})[target];
  if(!snapshot)return current;

  // V21.4: historical Fair rates come from that month's snapshot, while the
  // Live schedule is selected by the actual Live record date. This prevents
  // Home's history month selector from blocking the current month's More setup.
  return normalizeCommissionSettings({
    ...current,
    ...snapshot,
    liveHostRates:{
      ...(current.liveHostRates||{}),
      ...((snapshot&&snapshot.liveHostRates)||{})
    },
    liveHosts:{
      ...(current.liveHosts||{}),
      ...((snapshot&&snapshot.liveHosts)||{})
    },
    liveRateSchedules:(current.liveRateSchedules||[])
  });
}
function getEffectiveCommissionSettings(){
  return getCommissionSettingsForMonth(selectedMonth());
}

function liveScheduleMonth(item){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(item&&item.startDate||""))
    ?String(item.startDate).slice(0,7)
    :"";
}

function liveSchedulesForMonth(month,settings=getCommissionSettings()){
  return (settings.liveRateSchedules||[])
    .filter(item=>liveScheduleMonth(item)===month)
    .sort((a,b)=>a.startDate.localeCompare(b.startDate)||String(a.endDate||"").localeCompare(String(b.endDate||"")));
}

function monthLastISO(month){
  if(!/^\d{4}-\d{2}$/.test(String(month||"")))return "";
  const [year,monthNumber]=month.split("-").map(Number);
  const day=new Date(year,monthNumber,0).getDate();
  return `${month}-${String(day).padStart(2,"0")}`;
}

function findLiveRateSchedule(date,settings=null){
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(String(date||""))
    ?String(date)
    :displayToISO(date);
  if(!iso)return null;
  const month=iso.slice(0,7);
  const effectiveSettings=settings||getCommissionSettingsForMonth(month);
  return (effectiveSettings.liveRateSchedules||[]).find(item=>{
    if(liveScheduleMonth(item)!==month)return false;
    const effectiveEnd=item.endDate||monthLastISO(month);
    return iso>=item.startDate&&iso<=effectiveEnd;
  })||null;
}

function getLiveHostRate(host,date=""){
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(String(date||""))?String(date):displayToISO(date);
  const targetMonth=iso?iso.slice(0,7):getLiveSelectedMonth();
  const settings=getCommissionSettingsForMonth(targetMonth);
  const schedule=findLiveRateSchedule(date,settings);
  if(schedule)return Number(schedule.rate||0);
  const key=normalizeLiveHostKey(host);
  const specific=Number((settings.liveHostRates||{})[key]);
  return Number.isFinite(specific)?specific:10;
}
function renderLiveHostCommissionSettings(){
  const container=document.getElementById("liveHostCommissionList");
  if(!container)return;
  const settings=getCommissionSettings();
  const hosts=collectLiveHosts();
  container.innerHTML=hosts.length?hosts.map(host=>{
    const key=normalizeLiveHostKey(host);
    const rate=Number.isFinite(Number((settings.liveHostRates||{})[key]))
      ?Number(settings.liveHostRates[key]):10;
    return `<div class="host-commission-row">
      <span class="host-commission-name">${host}</span>
      <span class="host-commission-controls">
        <span class="commission-input-row"><input type="text" inputmode="decimal" data-live-host-key="${key}" value="${rate}"><span>%</span></span>
        <button type="button" class="remove-live-host-btn" onclick="removeLiveHost('${key}')">离职／停用</button>
      </span>
    </div>`;
  }).join(""):'<div class="sub">新增 Live 主播后会自动显示在这里</div>';
  container.querySelectorAll("[data-live-host-key]").forEach(input=>{
    input.addEventListener("input",markLiveCommissionDraftDirty);
  });
}


async function removeLiveHost(hostKey){
  const key=normalizeLiveHostKey(hostKey);
  const settings=getCommissionSettings();
  const host=canonicalLiveHost((settings.liveHosts||{})[key]||collectLiveHosts().find(name=>normalizeLiveHostKey(name)===key)||key);
  if(!key||!host)return;
  if(!confirm(`确定将主播「${host}」设为已离职／停用？

停用后会从 More 和 Live 主播名单隐藏，并清除当前一般佣金率。
历史 Live、Home、Report 与佣金记录全部保留。
以后在 Live 再输入同一名字，会自动复职并对应原历史资料。`))return;

  const previousSettings=getCommissionSettings();
  const previousSavedHosts=getSavedLiveHosts();
  const liveHosts={...(previousSettings.liveHosts||{})};
  const inactiveLiveHosts={...(previousSettings.inactiveLiveHosts||{})};
  const liveHostRates={...(previousSettings.liveHostRates||{})};
  delete liveHosts[key];
  delete liveHostRates[key];
  inactiveLiveHosts[key]=host;
  const activeHosts=previousSavedHosts.filter(name=>normalizeLiveHostKey(name)!==key);
  const nextSettings=normalizeCommissionSettings({...previousSettings,liveHosts,inactiveLiveHosts,liveHostRates,liveRevision:nextLiveCommissionRevision(previousSettings.liveRevision)});

  localStorage.setItem("lover_live_hosts_v69",JSON.stringify(activeHosts));
  applyCommissionSettings(nextSettings);
  saveLocalDataCache(nextSettings);
  renderLiveHostOptions();
  renderLiveHostCommissionSettings();
  renderDashboard();
  renderTable();
  renderLiveMonthlyList();
  const liveInput=document.getElementById("liveHost");
  if(liveInput&&normalizeLiveHostKey(liveInput.value)===key){
    liveInput.value="";
    updateLiveInputFromSelectedDate();
  }

  const message=document.getElementById("liveCommissionSettingsMsg");
  if(message){message.textContent="主播已停用，云端同步中…";message.classList.remove("hidden");}
  setSync("主播已停用，云端同步中...");

  try{
    const saved=await saveLiveCommissionSettingsToSheet(nextSettings,commissionConfigMonth());
    const confirmed=normalizeCommissionSettings(saved||nextSettings);
    applyCommissionSettings(confirmed);
    setSavedCommissionSnapshots(confirmed,{fair:false,live:true});
    updateLiveCommissionDraftState();
    saveLocalDataCache(confirmed);
    renderLiveHostOptions();
    renderLiveHostCommissionSettings();
    if(message){message.textContent="✅ 主播已设为离职／停用";message.classList.remove("hidden");}
    setSync("已同步",true);
  }catch(error){
    // V21.4: timeout must not undo the user's local action.
    console.warn("Inactive host cloud sync delayed",error);
    liveCommissionDraftDirty=true;
    queueLiveCommissionRetry(nextSettings,commissionConfigMonth());
    if(message){message.textContent="主播已停用，本机资料已保留，云端稍后重试";message.classList.remove("hidden");}
    setSync("主播停用等待云端同步",false,true);
  }
}

let liveScheduleEditingId="";

function renderLiveRateSchedules(){
  const container=document.getElementById("liveRateScheduleList");
  if(!container)return;
  const schedules=liveSchedulesForMonth(commissionConfigMonth());
  container.innerHTML=schedules.length
    ?schedules.map(item=>`
      <div class="live-rate-schedule-row ${item.endDate?"":"is-open"} ${item.id===liveScheduleEditingId?"is-editing":""}">
        <div class="live-rate-schedule-info" onclick="startEditLiveRateSchedule('${item.id}')" title="点击修改日期和佣金率">
          <span>${isoToDisplay(item.startDate)} 至 ${
            item.endDate?isoToDisplay(item.endDate):'<span class="live-rate-schedule-open">进行中 · 月底自动结束</span>'
          }</span>
          <span class="live-rate-schedule-rate">${Number(item.rate)}%</span>
        </div>
        <div class="live-rate-schedule-actions">
          <button type="button" class="live-rate-schedule-remove" onclick="event.stopPropagation();removeLiveRateSchedule('${item.id}')">删除</button>
        </div>
      </div>
    `).join("")
    :`<div class="live-schedule-empty">${commissionConfigMonth()} 没有特别日期规则，使用各主播一般佣金</div>`;
}
function validateLiveRateSchedules(schedules){
  const sorted=[...(schedules||[])].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  sorted.forEach(item=>{
    const month=liveScheduleMonth(item);
    if(!month)throw new Error("直播佣金开始日期格式错误");
    if(item.endDate&&item.endDate.slice(0,7)!==month){
      throw new Error("直播特别佣金不能跨月份，请在下个月重新新增");
    }
  });

  for(let i=0;i<sorted.length-1;i++){
    const current=sorted[i];
    const next=sorted[i+1];
    if(liveScheduleMonth(current)!==liveScheduleMonth(next))continue;
    const currentEnd=current.endDate||monthLastISO(liveScheduleMonth(current));
    if(currentEnd>=next.startDate){
      throw new Error(
        `直播佣金日期不能重叠：${isoToDisplay(current.startDate)} 至 ${
          current.endDate?isoToDisplay(current.endDate):"月底"
        }`
      );
    }
  }
  return sorted;
}

function submitLiveRateSchedule(){
  const start=document.getElementById("liveScheduleStart");
  const end=document.getElementById("liveScheduleEnd");
  const rateEl=document.getElementById("liveScheduleRate");
  const startDate=String(start&&start.value||"");
  const endDate=String(end&&end.value||"");
  const rate=Number(rateEl&&rateEl.value);

  if(!startDate){
    alert("请选择开始日期");
    return false;
  }
  const configMonth=commissionConfigMonth();
  if(startDate.slice(0,7)!==configMonth){
    alert(`开始日期必须属于当前佣金设置月份：${configMonth}`);
    return false;
  }
  if(endDate&&endDate.slice(0,7)!==startDate.slice(0,7)){
    alert("结束日期不能跨月份；下个月请新增另一条特别佣金日期");
    return false;
  }
  if(endDate&&endDate<startDate){
    alert("结束日期不能早于开始日期");
    return false;
  }
  if(!Number.isFinite(rate)||rate<0){
    alert("请输入正确的直播佣金百分比");
    return false;
  }

  const previous=getCommissionSettings();
  const existing=(previous.liveRateSchedules||[]).map(item=>({...item}));

  try{
    const schedules=validateLiveRateSchedules(
      liveScheduleEditingId
        ?existing.map(item=>item.id===liveScheduleEditingId?{...item,startDate,endDate,rate}:item)
        :[...existing,{
          id:`live_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          startDate,
          endDate,
          rate
        }]
    );

    applyCommissionSettings({...previous,liveRateSchedules:schedules,liveRevision:nextLiveCommissionRevision(previous.liveRevision)});
    markLiveCommissionDraftDirty();
    clearLiveScheduleInputs();
    renderLiveRateSchedules();
    renderDashboard();
    renderTable();
    renderLiveMonthlyList();
    return true;
  }catch(error){
    alert(error.message);
    return false;
  }
}

function startEditLiveRateSchedule(id){
  const settings=getCommissionSettings();
  const item=(settings.liveRateSchedules||[]).find(rule=>rule.id===id);
  if(!item)return;

  liveScheduleEditingId=id;
  setDateControl("liveScheduleStart",item.startDate||"");
  setDateControl("liveScheduleEnd",item.endDate||"");
  const rateEl=document.getElementById("liveScheduleRate");
  if(rateEl)rateEl.value=String(item.rate??"");

  const button=document.getElementById("liveScheduleActionBtn");
  if(button)button.textContent="更新特别佣金日期";
  renderLiveRateSchedules();
}
function clearLiveScheduleInputs(){
  setDateControl("liveScheduleStart","");
  setDateControl("liveScheduleEnd","");
  const rateEl=document.getElementById("liveScheduleRate");
  if(rateEl)rateEl.value="";
  liveScheduleEditingId="";
  const button=document.getElementById("liveScheduleActionBtn");
  if(button)button.textContent="＋ 新增特别佣金日期";
}

function removeLiveRateSchedule(id){
  const previous=getCommissionSettings();
  const schedules=(previous.liveRateSchedules||[]).filter(item=>item.id!==id);
  applyCommissionSettings({...previous,liveRateSchedules:schedules,liveRevision:nextLiveCommissionRevision(previous.liveRevision)});
  markLiveCommissionDraftDirty();
  clearLiveScheduleInputs();
  renderLiveRateSchedules();
  renderDashboard();
  renderTable();
  renderLiveMonthlyList();
}


function getFairCommissionRate(total){
  const amount=Number(total||0);
  const settings=getEffectiveCommissionSettings();

  if(amount>=100000)return settings.rate3/100;
  if(amount>=50000)return settings.rate2/100;
  return settings.rate1/100;
}

function renderFairCommission(total){
  const amount=Number(total||0);
  const settings=getEffectiveCommissionSettings();
  const rate=getFairCommissionRate(amount);
  const percent=Number((rate*100).toFixed(2));

  const label=document.getElementById("fairCommissionLabel");
  const value=document.getElementById("fairCommissionTotal");
  const message=document.getElementById("fairCommissionMessage");

  if(label){
    label.textContent=`Fair 本月总佣金 ${percent}%`;
  }

  if(value){
    value.textContent=money(amount*rate);
  }

  if(!message)return;

  if(amount<50000){
    message.textContent=`加油，达到 RM50,000 就 ${settings.rate2}%`;
    message.classList.remove("hidden");
  }else if(amount<100000){
    message.textContent=`加油，达到 RM100,000 就 ${settings.rate3}%`;
    message.classList.remove("hidden");
  }else{
    message.textContent="";
    message.classList.add("hidden");
  }
}


const companyDailyOpenV186={balakong:false,belimbing:false};

function companyDailyRowsV186(company){
  const month=selectedMonth();
  const allRows=rows.filter(r=>r.type==="daily"&&(r.company==="balakong"||r.company==="belimbing"))
    .filter(r=>String(displayToISO(r.date)).slice(0,7)===month);

  const dates=[...new Set(allRows.map(r=>r.date))].sort((a,b)=>displayToISO(b).localeCompare(displayToISO(a)));

  return dates.map(date=>{
    const row=allRows.find(r=>r.company===company&&r.date===date);
    return {
      date,
      amount: row ? Number(row.amount||0) : 0
    };
  });
}

function renderCompanyDailyV186(company){
 const el=document.getElementById(company+"MonthDaily"); if(!el)return;
 if(!companyDailyOpenV186[company]){el.classList.add("hidden");el.innerHTML="";return;}
 el.classList.remove("hidden");
 const rows2=companyDailyRowsV186(company);
 el.innerHTML=`<div class="company-daily-list">${rows2.map(x=>`<div><span>${x.date}</span><b>${money(x.amount)}</b></div>`).join("")}</div>`;
}
function toggleCompanyDailyV186(company){companyDailyOpenV186[company]=!companyDailyOpenV186[company];renderCompanyDailyV186(company);}
function renderDashboard(){const bt=totalBy("daily","balakong","today"),blt=totalBy("daily","belimbing","today"),ft=totalBy("fair","","today"),bm=totalBy("daily","balakong","month"),blm=totalBy("daily","belimbing","month"),fm=totalBy("fair","","month"),by=totalBy("daily","balakong","year"),bly=totalBy("daily","belimbing","year"),fy=totalBy("fair","","year");document.getElementById("balakongMonth").textContent=money(bm);document.getElementById("belimbingMonth").textContent=money(blm);renderFairLocationList();document.getElementById("fairMonthTotal").textContent=money(fm);renderFairCommission(fm);document.getElementById("monthGrandTotal").textContent=money(bm+blm+fm);document.getElementById("balakongYearTotal").textContent=money(by);document.getElementById("belimbingYearTotal").textContent=money(bly);document.getElementById("fairYearTotal").textContent=money(fy);document.getElementById("yearGrandTotal").textContent=money(by+bly+fy);renderTodayCompanyStatus()}
function sortReportRows(list){const rank=r=>r.type==="daily"&&r.company==="balakong"?0:r.type==="daily"&&r.company==="belimbing"?1:2;return [...list].sort((a,b)=>rank(a)-rank(b)||canonicalLocation(a.location).localeCompare(canonicalLocation(b.location))||displayToISO(a.date).localeCompare(displayToISO(b.date)))}
function renderTable(){const s=sortReportRows(dedupeRows(rows).filter(r=>sameMonth(r.date)&&Number(r.amount)>0));document.getElementById("recordTable").innerHTML=s.map(r=>`<tr><td>${r.date}</td><td>${r.type==="fair"?"Fair":"每日"}</td><td>${companyNames[r.company]||r.company}</td><td>${r.location||"-"}</td><td>${money(r.amount)}</td></tr>`).join("")||'<tr><td colspan="5" style="text-align:center;">这个月份还没有记录</td></tr>'}
function renderAll(){rows=dedupeRows(rows);renderDashboard();renderBusinessTop3();renderTable();updateDailyInputFromSelectedDate();renderFairLocationOptions();updateFairPageMode();renderFairMonthlyList();renderFairDailySummary();renderFairPageTop3();renderLiveDailySummary();renderLiveMonthlyList();renderLivePageTop3()}
async function saveDailySales(){
  if(!ensureWritableSelection())return;
  const d=isoToDisplay(document.getElementById("saleDate").value);
  const c=document.getElementById("company").value;
  const a=toAmount(document.getElementById("dailySales").value);

  if(!d){
    alert("请选择日期");
    return;
  }

  const localRow={
    type:"daily",
    date:d,
    company:c,
    location:"",
    amount:a,
    updatedAt:new Date().toISOString(),
    clientUpdatedAt:new Date().toISOString()
  };

  upsertLocalRow(localRow);
  addPendingRow(localRow);
  document.getElementById("dailySales").value=formatAmount(a);
  renderAll();
  showTempMsg("saveMsg");

  // V21.4: normal Save uses exactly one cloud write.
  // This prevents the immediate keepalive request from racing the normal save,
  // which could turn a real change such as RM9,999 -> RM0 into a later 0 -> 0
  // comparison and suppress the modification notification.
  // The pagehide/visibility keepalive fallback remains in sheet.js for pending
  // rows only when the page is actually being closed or backgrounded.
  if(typeof saveLocalDataCache==="function")saveLocalDataCache();
  setSync("已储存 · 云端后台同步中...");

  Promise.resolve().then(async()=>{
    try{
      const saved=await saveDailyToSheet(d,c,a,localRow.clientUpdatedAt);
      if(saved)upsertLocalRow(saved);
      clearPendingRow(localRow);
      renderAll();
      if(typeof saveLocalDataCache==="function")saveLocalDataCache();
      setSync("已同步",true);
    }catch(e){
      if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
      else setSync("同步暂未完成",false,true);
    }
  });
}
function saveFairSession(){
  const location=canonicalLocation(document.getElementById("fairLocation").value.trim());
  const start=document.getElementById("fairStart").value;
  const end=document.getElementById("fairEnd").value;

  if(!location||!start||!end)return;

  localStorage.setItem("lover_last_fair_session",JSON.stringify({
    location,
    start,
    end
  }));
}

function getSavedFairSession(){
  try{
    const saved=JSON.parse(localStorage.getItem("lover_last_fair_session")||"null");

    if(!saved||!saved.location||!saved.start||!saved.end){
      return null;
    }

    return saved;
  }catch(e){
    return null;
  }
}

function restoreFairSession(){
  const saved=getSavedFairSession();

  if(!saved){
    return false;
  }

  document.getElementById("fairLocation").value=canonicalLocation(saved.location);
  setDateControl("fairStart",saved.start);
  setDateControl("fairEnd",saved.end);

  return true;
}

function updateFairPageMode(){
  const location=String(document.getElementById("fairLocation")?.value||"").trim();
  const hasLocation=Boolean(location);
  document.getElementById("fairEndWrap")?.classList.toggle("hidden",!hasLocation);
  document.getElementById("fairEditArea")?.classList.toggle("hidden",!hasLocation);
  document.getElementById("fairViewOnlyHint")?.classList.toggle("hidden",hasLocation);
  document.getElementById("fairDateRange")?.classList.toggle("view-only",!hasLocation);
  const label=document.getElementById("fairStartLabel");
  if(label)label.textContent=hasLocation?"开始日期":"查看日期";
  if(!hasLocation){
    const start=document.getElementById("fairStart")?.value||todayISO();
    setDateControl("fairEnd",start);
    const inputs=document.getElementById("fairInputs");
    if(inputs)inputs.innerHTML="";
  }
}

function syncFairInputs(){const start=document.getElementById("fairStart").value,end=document.getElementById("fairEnd").value,loc=canonicalLocation(document.getElementById("fairLocation").value.trim());if(!start||!end||new Date(start)>new Date(end)){document.getElementById("fairInputs").innerHTML="";return}let html="<h3>Fair 每日营业额</h3>";dateRange(start,end).forEach(d=>{const old=rows.find(r=>r.type==="fair"&&r.date===d&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc));html+=`<label>${d} 营业额</label><input type="text" class="fairAmount money-input" data-date="${d}" value="${old?formatAmount(old.amount):"0.00"}" inputmode="decimal">`});document.getElementById("fairInputs").innerHTML=html;attachMoneyInputs();syncFairProductDatesV203()}
function fairInputsHaveUnsavedChanges(){
  const container=document.getElementById("fairInputs");
  const location=canonicalLocation(String(document.getElementById("fairLocation")?.value||"").trim());
  if(!container||!location)return false;
  const inputs=[...container.querySelectorAll(".fairAmount[data-date]")];
  return inputs.some(input=>{
    const date=String(input.dataset.date||"");
    const saved=rows.find(r=>r.type==="fair"&&r.date===date&&normalizeFairLocationKey(r.location)===normalizeFairLocationKey(location));
    const savedAmount=saved?Number(saved.amount||0):0;
    return Math.abs(toAmount(input.value)-savedAmount)>0.00001;
  });
}
function refreshFairInputsFromRows(force=false){
  const location=String(document.getElementById("fairLocation")?.value||"").trim();
  if(!location)return false;
  if(!force&&fairInputsHaveUnsavedChanges())return false;
  syncFairInputs();
  return true;
}
async function saveFairSales(){const fairLocationValue=String(document.getElementById("fairLocation")?.value||"").trim();if(!fairLocationValue){alert("请先输入 Fair 地点");return;}
  if(!ensureWritableSelection())return;
  const loc=canonicalLocation(document.getElementById("fairLocation").value.trim());
  const inputs=document.querySelectorAll(".fairAmount");

  if(!loc){
    alert("请输入 Fair 地点");
    return;
  }

  document.getElementById("fairLocation").value=loc;
  saveFairLocation(loc);
  saveFairSession();

  if(!inputs.length){
    alert("请选择 Fair 日期");
    return;
  }

  const now=new Date().toISOString();
  const records=[...inputs].map(i=>({
    date:i.dataset.date,
    amount:toAmount(i.value),
    clientUpdatedAt:now
  }));

  records.forEach(i=>{
    const row={
      type:"fair",
      date:i.date,
      company:"belimbing",
      location:loc,
      amount:i.amount,
      updatedAt:now,
      clientUpdatedAt:now
    };

    if(Number(i.amount)<=0){
      rows=rows.filter(r=>!(
        r.type==="fair" &&
        r.date===i.date &&
        r.company==="belimbing" &&
        normalizeFairLocationKey(r.location)===normalizeFairLocationKey(loc)
      ));
    }else{
      upsertLocalRow(row);
    }

    addPendingRow(row);
    if(typeof markLocalRowMutation==="function")markLocalRowMutation(row);
  });

  renderAll();
  if(typeof saveLocalDataCache==="function")saveLocalDataCache();
  showTempMsg("fairSaveMsg");

  try{
    setSync("已储存，正在后台同步...");
    const result=await saveFairBatchToSheet(loc,records);

    // V21.4: local Fair values are direct replacements, never additions. The server
    // also removes duplicate Sheet rows whose location differs only by spaces/case.
    // The response confirms the authoritative overwrite and clears pending rows.
    records.forEach(i=>clearPendingRow({
      type:"fair",
      date:i.date,
      company:"belimbing",
      location:loc
    }));
    if(typeof saveLocalDataCache==="function")saveLocalDataCache();
    setSync("已同步",true);
  }catch(e){
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
    else setSync("同步暂未完成",false,true);
  }
}
function exportCSV(scope="month"){let csv="\uFEFF公司,日期,类别,地点,营业额\n";const selected=sortReportRows(dedupeRows(rows).filter(r=>(scope==="year"?sameYear(r.date):sameMonth(r.date))&&Number(r.amount)>0));selected.forEach(r=>{csv+=`"${companyNames[r.company]||r.company}",${r.date},"${r.type==="fair"?"Fair":"每日"}","${r.location||""}",${Number(r.amount).toFixed(2)}\n`});downloadFile(`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.csv`,csv,"text/csv;charset=utf-8;")}
const ACTIVE_MONTH_STORAGE_KEY="lover_sales_active_month_v82";
let systemState={currentMonth:monthISO(),closedMonths:[],commissionSnapshots:{},dataVersion:"2140"};
function saveActiveMonth(month){if(/^\d{4}-\d{2}$/.test(String(month||"")))localStorage.setItem(ACTIVE_MONTH_STORAGE_KEY,String(month))}
function isSelectedMonthWritable(){return true}
function ensureWritableSelection(){return true}
function updateReadOnlyMode(){
  const m=selectedMonth(),closed=systemState.closedMonths.includes(m),history=m!==systemState.currentMonth;
  document.body.classList.remove("readonly-page");
  const el=document.getElementById("monthMode");
  if(el){
    el.className="month-mode "+(closed?"closed-mode":history?"history-mode":"current-mode");
    el.textContent=closed?`${m} · 已结算 · 可修正`:history?`${m} · 历史月份 · 可编辑`:`${m} · 当前月份 · 可编辑`;
  }
}
function sanitizeClosedMonthsClientV197(months,currentMonth){
  const current=String(currentMonth||monthISO()),now=new Date(),isCurrentLastDay=now.getDate()===new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  return [...new Set((Array.isArray(months)?months:[]).map(m=>String(m||"")).filter(m=>/^\d{4}-\d{2}$/.test(m)))]
    .filter(m=>m<current||(m===current&&isCurrentLastDay)).sort();
}
function applySystemState(state){if(state){systemState.currentMonth=state.currentMonth||monthISO();systemState.closedMonths=sanitizeClosedMonthsClientV197(state.closedMonths,systemState.currentMonth);systemState.commissionSnapshots=state.commissionSnapshots||{};systemState.dataVersion=state.dataVersion||"2140"}updateReadOnlyMode()}
async function monthClose(){
  const m=selectedMonth();
  if(m!==systemState.currentMonth){alert("只能结算系统当前月份："+systemState.currentMonth);return}
  if(systemState.closedMonths.includes(m)){alert(m+" 已经完成月底结算。\n系统日期进入新月份后会自动切换。");return}
  const now=new Date(),lastDay=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();if(now.getDate()!==lastDay){alert(`月底结算只能在当月最后一天执行。\n今天是 ${now.getDate()} 日，本月最后一天是 ${lastDay} 日。`);return}
  const ok=confirm(`准备完成 ${m} 月底结算。\n\n强烈建议先按“导出本月 Excel”，确认资料完整并保存副本。\n\n结算后：\n• 不会立即切换到下个月\n• ${m} 会保留“已结算”状态，但发现手误时仍可修正\n• 营业、Fair、Live 与 Commission 历史资料不会删除\n• 系统日期进入新月份后才自动切换\n\n确定继续结算？`);
  if(!ok)return;
  try{setSync("正在完成月底结算...");const result=await closeMonthInSheet(m);applySystemState(result.systemState);setSync("月底结算已完成",true);alert(`${m} 月底结算已完成。\n目前仍停留在 ${m}，资料仍可在以后发现错误时修正。\n系统日期进入新月份后会自动切换。`)}catch(e){alert("月底结算失败："+e.message);setSync("月底结算失败",false,true)}
}
function yearClose(){const y=selectedYear();if(!confirm(`确定导出 ${y} 全年 Excel？\n\nV21.4 不会提前切换年份；系统日期进入新年份后自动进入新月份。`))return;exportCSV("year")}
function initializeCurrentMonth(){
  const current=monthISO();
  document.getElementById("monthPicker").value=current;
  document.getElementById("yearPicker").value=current.slice(0,4);
  const dashboardDate=document.getElementById("dashboardDate");
  if(dashboardDate&&!dashboardDate.value)setDateControl("dashboardDate",todayISO());
  saveActiveMonth(current);
}
initializeCurrentMonth();
const dailyTotalsMonthPicker=document.getElementById("dailyTotalsMonth");
if(dailyTotalsMonthPicker){
  dailyTotalsMonthPicker.value=selectedMonth();
  dailyTotalsMonthPicker.addEventListener("change",async()=>{
    const month=dailyTotalsMonthPicker.value;
    if(!/^\d{4}-\d{2}$/.test(month))return;
    await loadDailyTotalsMonth(month);
  });
}
setDateControl("saleDate",todayISO());

const fairSessionRestored=restoreFairSession();

if(!fairSessionRestored){
  setDateControl("fairStart",todayISO());
  setDateControl("fairEnd",todayISO());
}

bindDateControl("saleDate",async()=>{
  updateDailyInputFromSelectedDate();
  await ensureDateControlMonthLoaded("saleDate");
  updateDailyInputFromSelectedDate();
});

bindDateControl("fairStart",async()=>{
  saveFairSession();
  updateFairPageMode();
  if(String(document.getElementById("fairLocation")?.value||"").trim())syncFairInputs();
  renderFairDailySummary();
  renderFairMonthlyList();
  await ensureDateControlMonthLoaded("fairStart");
  renderFairDailySummary();
  renderFairMonthlyList();
});

bindDateControl("fairEnd",async()=>{
  saveFairSession();
  if(String(document.getElementById("fairLocation")?.value||"").trim())syncFairInputs();
  renderFairMonthlyList();
  await ensureDateControlMonthLoaded("fairEnd");
  renderFairMonthlyList();
});

renderFairLocationOptions();
const fairLocationInput=document.getElementById("fairLocation");
if(fairLocationInput){
  fairLocationInput.addEventListener("input",()=>{
    saveFairSession();
    updateFairPageMode();
    if(String(fairLocationInput.value||"").trim())syncFairInputs();
    renderFairMonthlyList();
  });
  fairLocationInput.addEventListener("change",()=>refreshProductLinkContextV210("fair"));
  fairLocationInput.addEventListener("blur",()=>refreshProductLinkContextV210("fair"));
}
updateFairPageMode();

document.getElementById("monthPicker").addEventListener("change",async()=>{
  saveActiveMonth(selectedMonth());
  renderLiveRateSchedules();
  document.getElementById("yearPicker").value=selectedMonth().slice(0,4);

  const dashboardDate=document.getElementById("dashboardDate");
  if(dashboardDate){
    const currentDate=dashboardDate.value;
    if(!currentDate||currentDate.slice(0,7)!==selectedMonth()){
      setDateControl(
        "dashboardDate",
        selectedMonth()===monthISO()?todayISO():selectedMonth()+"-01"
      );
    }
  }

  const reportPicker=document.getElementById("reportMonthPicker");
  if(reportPicker)reportPicker.value=selectedMonth();
  renderAll();
  updateReadOnlyMode();
  await loadFromSheet({force:true});
});
const reportMonthPicker=document.getElementById("reportMonthPicker");
if(reportMonthPicker){
  reportMonthPicker.value=selectedMonth();
  reportMonthPicker.addEventListener("change",async()=>{
    const month=reportMonthPicker.value;
    if(!/^\d{4}-\d{2}$/.test(month))return;
    document.getElementById("monthPicker").value=month;
    document.getElementById("yearPicker").value=month.slice(0,4);
    saveActiveMonth(month);
    renderAll();
    updateReadOnlyMode();
    await loadFromSheet({force:true});
  });
}
setDateControl("dashboardDate",selectedDashboardDateISO());
bindDateControl("dashboardDate",async()=>{
  const dashboardDatePicker=document.getElementById("dashboardDate");
  if(!dashboardDatePicker.value){
    setDateControl("dashboardDate",todayISO());
  }

  const dateMonth=dashboardDatePicker.value.slice(0,7);
  if(dateMonth&&dateMonth!==selectedMonth()){
    document.getElementById("monthPicker").value=dateMonth;
    document.getElementById("yearPicker").value=dateMonth.slice(0,4);
    saveActiveMonth(dateMonth);
    const reportPicker=document.getElementById("reportMonthPicker");
    if(reportPicker)reportPicker.value=dateMonth;
    renderAll();
    updateReadOnlyMode();
    await loadFromSheet({force:true});
    return;
  }

  renderDashboard();
});

document.getElementById("yearPicker").addEventListener("change",renderAll);
document.getElementById("company").addEventListener("change",updateDailyInputFromSelectedDate);

document.getElementById("fairLocation").addEventListener("input",()=>{
  syncFairInputs();
});

document.getElementById("fairLocation").addEventListener("blur",()=>{
  const input=document.getElementById("fairLocation");
  input.value=canonicalLocation(input.value);
  saveFairLocation(input.value);
  saveFairSession();
  syncFairInputs();
});

// V21.4: paint Home immediately, restore local cache, then perform only a
// lightweight Revision check. Full month data is downloaded only when the
// cloud Revision proves that another device changed data.
attachMoneyInputs();
try { renderAll(); } catch (error) { console.warn("Initial empty Home render failed", error); }

let startupCacheLoaded = false;
let startupSalesSyncPromise = null;

function waitForFirstHomePaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function startInitialSalesDataLoad() {
  if (startupSalesSyncPromise) return startupSalesSyncPromise;

  let startupStatusTimer = setTimeout(() => {
    if (typeof markCloudCheckPending === "function") {
      markCloudCheckPending("正在快速确认云端...");
    }
  }, 2200);

  startupSalesSyncPromise = (async () => {
    await waitForFirstHomePaint();

    try {
      startupCacheLoaded = typeof loadLocalDataCacheAsync === "function"
        ? await loadLocalDataCacheAsync()
        : (typeof loadLocalDataCache === "function" && loadLocalDataCache());
    } catch (error) {
      startupCacheLoaded = false;
      console.warn("Local cache startup failed", error);
    }

    if (typeof markCloudCheckPending === "function") {
      markCloudCheckPending(startupCacheLoaded
        ? "正在快速确认云端..."
        : "正在读取云端资料");
    }

    // This forced read is deliberately inside finally-style startup flow:
    // local cache failure can never prevent cloud synchronization.
    const result = await loadFromSheet({
      background: true,
      force: false,
      loadYear: false,
      suppressStartStatus: true,
      revisionTimeoutMs: 2500,
      timeoutMs: 10000
    });

    try { syncFairInputs(); } catch (error) {}
    return result;
  })().catch(error => {
    console.warn("Initial sales data load failed", error);
    return { ok:false, error };
  }).finally(() => {
    clearTimeout(startupStatusTimer);
  });

  return startupSalesSyncPromise;
}

// V21.4: start cached Home immediately, then warm the current year's historical
// months in the background so Monthly Summary is complete on first open.
startInitialSalesDataLoad().finally(()=>{
  const startupYear=String(document.getElementById("yearPicker")?.value||selectedYear()||"");
  if(typeof loadYearInBackground==="function"&&/^\d{4}$/.test(startupYear)){
    loadYearInBackground(startupYear).catch(()=>{});
  }
});


/* ===== V7.3 Live Module ===== */
function normalizeLiveHostKey(value){
  return String(value||"").replace(/\s+/g,"").toLowerCase();
}
function canonicalLiveHost(value){
  return String(value||"").trim().replace(/\s+/g," ");
}
function rowKey(r){
  const location=r.type==="live"
    ? normalizeLiveHostKey(r.location||"")
    : normalizeFairLocationKey(r.location||"");
  return [r.type,r.date,r.company,location].join("|");
}
function getSavedLiveHosts(){
  try{return JSON.parse(localStorage.getItem("lover_live_hosts_v69")||"[]")}catch(e){return[]}
}
function collectLiveHosts(){
  const merged=[];
  const cloudHosts=Object.values((getCommissionSettings().liveHosts)||{});
  // V21.4: active host list is independent from historical Live records.
  // Deleted hosts stay in old reports but do not return to current host options.
  [...cloudHosts,...getSavedLiveHosts()]
    .filter(Boolean)
    .forEach(name=>{
      const key=normalizeLiveHostKey(name);
      if(key&&!merged.some(x=>normalizeLiveHostKey(x)===key))merged.push(canonicalLiveHost(name));
    });
  merged.sort((a,b)=>a.localeCompare(b));
  localStorage.setItem("lover_live_hosts_v69",JSON.stringify(merged));
  return merged;
}
function saveLiveHost(name){
  const host=canonicalLiveHost(name);
  if(!host)return;
  const list=collectLiveHosts();
  if(!list.some(x=>normalizeLiveHostKey(x)===normalizeLiveHostKey(host)))list.push(host);
  localStorage.setItem("lover_live_hosts_v69",JSON.stringify(list));
  renderLiveHostOptions();
}
function renderLiveHostOptions(){
  const el=document.getElementById("liveHostOptions");
  if(el)el.innerHTML=collectLiveHosts().map(name=>`<option value="${name}"></option>`).join("");
}
function selectedLiveHost(){
  const input=document.getElementById("liveHost");
  if(!input)return"";
  const raw=canonicalLiveHost(input.value);
  const existing=collectLiveHosts().find(x=>normalizeLiveHostKey(x)===normalizeLiveHostKey(raw));
  return existing||raw;
}
function getLiveAmount(date,host){
  const key=normalizeLiveHostKey(host);
  const found=rows.find(r=>r.type==="live"&&r.date===date&&normalizeLiveHostKey(r.location)===key);
  return found?Number(found.amount||0):0;
}
function updateLiveInputFromSelectedDate(){
  const dateEl=document.getElementById("liveDate");
  const amountEl=document.getElementById("liveSales");
  const resultEl=document.getElementById("liveDateResult");
  if(!dateEl||!amountEl||!resultEl)return;
  const d=isoToDisplay(dateEl.value);
  const host=selectedLiveHost();
  const amount=host?getLiveAmount(d,host):0;
  amountEl.value=formatAmount(amount);
  resultEl.textContent=host?`${host}｜${d}｜${money(amount)}`:`请选择或输入主播｜${d}`;
  renderLiveDailySummary();
  renderLiveMonthlyList();
}
function getLiveSelectedMonth(){
  const dateEl=document.getElementById("liveDate");
  const value=String(dateEl&&dateEl.value||"");
  return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(0,7):selectedMonth();
}

function monthFromDateControl(id){
  const el=document.getElementById(id);
  const value=String(el&&el.value||"");
  return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(0,7):selectedMonth();
}

async function ensureDateControlMonthLoaded(id){
  const month=monthFromDateControl(id);
  if(!month)return {ok:true,skipped:true};

  const hasMonth=rows.some(r=>displayToISO(r.date).slice(0,7)===month);
  if(hasMonth)return {ok:true,cached:true,month};

  if(typeof loadFromSheet==="function"){
    return loadFromSheet({
      force:true,
      silent:true,
      suppressStartStatus:true,
      loadYear:false,
      month
    });
  }
  return {ok:true,skipped:true,month};
}


/* ================= V21.4 on-demand 新增 / 修改记录 ================= */
const salesChangeLogOpenV200={daily:false,fair:false,live:false};

function changeLogPanelIdV200(type){
  return type==="daily"?"salesChangeLogPanel":type==="fair"?"fairChangeLogPanel":"liveChangeLogPanel";
}
function selectedChangeLogDateV200(type){
  const id=type==="daily"?"saleDate":type==="fair"?"fairStart":"liveDate";
  const iso=String(document.getElementById(id)?.value||"");
  return isoToDisplay(iso);
}
function escapeChangeLogHtmlV200(value){
  return String(value==null?"":value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}
function changeLogEntityNameV200(type,item){
  if(type==="daily")return companyNames[item.company]||item.company||"Sales";
  if(type==="fair")return canonicalLocation(item.location||"Fair");
  return canonicalLiveHost(item.location||"Live");
}
function renderChangeLogTimelineV200(type,date,items){
  const panel=document.getElementById(changeLogPanelIdV200(type));
  if(!panel)return;
  const clean=Array.isArray(items)?items:[];
  const groups=[];
  clean.forEach(item=>{
    const name=changeLogEntityNameV200(type,item);
    const key=type==="daily"?String(item.company||""):type==="fair"?normalizeFairLocationKey(name):normalizeLiveHostKey(name);
    let group=groups.find(g=>g.key===key);
    if(!group){group={key,name,items:[]};groups.push(group);}
    group.items.push(item);
  });

  // V21.4 display rule:
  // 1) any real audit row must be shown, including a single first sale (0 -> amount).
  // 2) later changes keep the first/original amount in the full timeline.
  // 3) downward correction is attached to the amount BEFORE that correction, so every row explains what happened next.
  // Only a date/entity with absolutely no audit rows shows "没有新增 / 修改记录".
  const changedGroups=groups.filter(group=>{
    const ordered=[...group.items].sort((a,b)=>Number(a.timestampMs||0)-Number(b.timestampMs||0));
    return ordered.length>0;
  });
  if(!changedGroups.length){
    panel.innerHTML=`<div class="change-log-date-title">${escapeChangeLogHtmlV200(date||"-")}</div><div class="change-log-empty">没有新增 / 修改记录</div>`;
    return;
  }

  const nextDeltaHtml=item=>{
    if(!item)return "";
    const delta=Number(item.delta||0);
    if(!delta)return "";
    const correcting=delta<0;
    const cls=correcting?"negative":"positive";
    const sign=correcting?"-":"+";
    const suffix=correcting?" 修正":"";
    return `<strong class="change-log-delta ${cls}">→ ${sign}${money(Math.abs(delta))}${suffix}</strong>`;
  };

  panel.innerHTML=`<div class="change-log-date-title">${escapeChangeLogHtmlV200(date)} · 新增 / 修改记录</div>`+changedGroups.map(group=>{
    const ordered=[...group.items].sort((a,b)=>Number(a.timestampMs||0)-Number(b.timestampMs||0));
    const first=ordered[0];
    const hasRecordedOriginal=Number(first.oldAmount||0)<=0;
    let rowsHtml="";

    // Old data that existed before the audit timeline has no trustworthy original timestamp.
    // Show the known original amount without inventing a time. Its right-side arrow explains the first real change.
    if(!hasRecordedOriginal && Number(first.oldAmount||0)>0){
      rowsHtml+=`<div class="change-log-row change-log-origin"><span class="change-log-time">—</span><span class="change-log-kind">原有金额</span><span class="change-log-value"><strong class="change-log-cumulative">${money(Number(first.oldAmount||0))}</strong>${nextDeltaHtml(first)}</span></div>`;
    }

    rowsHtml+=ordered.map((item,index)=>{
      const newAmount=Number(item.newAmount||0);
      const isRecordedFirst=hasRecordedOriginal&&index===0;
      const kind=isRecordedFirst?"第一笔销售":"当前累计";
      // The delta shown on this row belongs to the NEXT saved state.
      // Example: RM300 → +RM500, next row is RM800.
      const nextItem=ordered[index+1]||null;
      const deltaHtml=nextDeltaHtml(nextItem);
      const saleClass=(type==="live"||type==="fair")?" bonsai-sale-amount":"";return `<div class="change-log-row"><span class="change-log-time">${escapeChangeLogHtmlV200(item.time||"")}</span><span class="change-log-kind">${kind}</span><span class="change-log-value"><strong class="change-log-cumulative${saleClass}">${money(newAmount)}</strong>${deltaHtml}</span></div>`;
    }).join("");

    const finalTotal=ordered.length?Number(ordered[ordered.length-1].newAmount||0):0;
    return `<div class="change-log-group"><div class="change-log-group-title">${escapeChangeLogHtmlV200(group.name)}</div>${rowsHtml}<div class="change-log-total"><span>总数</span><strong>${money(finalTotal)}</strong></div></div>`;
  }).join("");
}
async function toggleSalesChangeLogV200(type,button){
  const panel=document.getElementById(changeLogPanelIdV200(type));
  if(!panel)return;
  const date=selectedChangeLogDateV200(type);
  if(!date){alert("请先选择日期");return;}
  // Same selected date: second click closes. If the user changed the date while
  // the panel stayed open, one click refreshes directly to the newly selected date.
  if(salesChangeLogOpenV200[type]&&String(panel.dataset.logDate||"")===date){
    salesChangeLogOpenV200[type]=false;
    panel.classList.add("hidden");
    panel.innerHTML="";
    panel.dataset.logDate="";
    if(button)button.classList.remove("active");
    return;
  }
  salesChangeLogOpenV200[type]=true;
  panel.dataset.logDate=date;
  panel.classList.remove("hidden");
  panel.innerHTML=`<div class="change-log-loading">正在读取 ${escapeChangeLogHtmlV200(date)} 记录...</div>`;
  if(button)button.classList.add("active");
  try{
    const data=await loadSalesChangeLogFromSheetV200(type,date);
    if(!salesChangeLogOpenV200[type]||String(panel.dataset.logDate||"")!==date)return;
    renderChangeLogTimelineV200(type,date,data&&data.logs);
  }catch(error){
    if(!salesChangeLogOpenV200[type]||String(panel.dataset.logDate||"")!==date)return;
    panel.innerHTML=`<div class="change-log-empty">读取失败，请稍后再试</div>`;
  }
}

function renderSalesMonthlyList(){
  const container=document.getElementById("salesMonthlyList");
  const totalEl=document.getElementById("salesMonthlyTotal");
  const titleEl=document.getElementById("salesMonthlyTitle");
  const labelEl=document.getElementById("salesMonthlyTotalLabel");
  if(!container||!totalEl)return;

  const month=monthFromDateControl("saleDate");
  const monthLabel=/^\d{4}-\d{2}$/.test(month)?`${month.slice(5,7)}-${month.slice(0,4)}`:"-";
  if(titleEl)titleEl.textContent=`Sales ${monthLabel} 销售记录`;
  if(labelEl)labelEl.textContent=`Sales ${monthLabel} 总销售额`;

  const list=rows
    .filter(r=>r.type==="daily"&&displayToISO(r.date).slice(0,7)===month&&Number(r.amount)>0)
    .sort((a,b)=>
      String(a.company||"").localeCompare(String(b.company||""))||
      displayToISO(a.date).localeCompare(displayToISO(b.date))
    );

  const total=list.reduce((sum,r)=>sum+Number(r.amount||0),0);
  if(!list.length){
    container.innerHTML='<div class="sub">这个月份还没有 Sales 记录</div>';
    totalEl.textContent="0.00";
    renderFairPageTop3();
    return;
  }

  const companies=["balakong","belimbing"];
  container.innerHTML=companies.map(company=>{
    const companyRows=list.filter(r=>r.company===company);
    if(!companyRows.length)return "";
    const companyTotal=companyRows.reduce((sum,r)=>sum+Number(r.amount||0),0);
    return `<div class="month-record-group">
      <div class="month-record-group-title">${companyNames[company]||company}</div>
      ${companyRows.map(r=>`<div class="month-record-row">
        <span>${r.date}</span>
        <strong>${money(r.amount)}</strong>
      </div>`).join("")}
      <div class="month-record-row month-record-total">
        <span>总数</span>
        <strong>${money(companyTotal)}</strong>
      </div>
    </div>`;
  }).join("");

  totalEl.textContent=money(total);
}


function renderFairDailySummary(){
  const card=document.getElementById("fairDailySummaryCard");
  const list=document.getElementById("fairDailySummaryList");
  const totalEl=document.getElementById("fairDailySummaryTotal");
  const title=document.getElementById("fairDailySummaryTitle");
  if(!card||!list||!totalEl)return;
  const location=String(document.getElementById("fairLocation")?.value||"").trim();
  const date=isoToDisplay(String(document.getElementById("fairStart")?.value||""));
  card.classList.toggle("hidden",Boolean(location));
  if(location)return;
  if(title)title.textContent=`Fair ${date||"-"} 当日销售`;
  const data=rows.filter(r=>r.type==="fair"&&r.date===date&&Number(r.amount)>0)
    .map(r=>({...r,name:canonicalLocation(r.location||"Fair")}))
    .sort((a,b)=>a.name.localeCompare(b.name,"en",{sensitivity:"base"}));
  list.className="daily-summary-list";
  list.innerHTML=data.length?data.map(r=>`<div class="daily-summary-row"><span>${r.name}</span><strong>${money(r.amount)}</strong></div>`).join(""):'<div class="daily-summary-empty">当天没有 Fair 销售记录</div>';
  totalEl.textContent=money(data.reduce((s,r)=>s+Number(r.amount||0),0));
}
function renderLiveDailySummary(){
  const card=document.getElementById("liveDailySummaryCard");
  const list=document.getElementById("liveDailySummaryList");
  const totalEl=document.getElementById("liveDailySummaryTotal");
  const title=document.getElementById("liveDailySummaryTitle");
  if(!card||!list||!totalEl)return;
  const host=selectedLiveHost();
  const date=isoToDisplay(String(document.getElementById("liveDate")?.value||""));
  card.classList.toggle("hidden",Boolean(host));
  if(host)return;
  if(title)title.textContent=`Live ${date||"-"} 当日销售`;
  const data=rows.filter(r=>r.type==="live"&&r.date===date&&Number(r.amount)>0)
    .map(r=>({...r,name:canonicalLiveHost(r.location||"")}))
    .sort((a,b)=>a.name.localeCompare(b.name,"en",{sensitivity:"base"}));
  list.className="daily-summary-list";
  list.innerHTML=data.length?data.map(r=>`<div class="daily-summary-row"><span>${r.name}</span><strong>${money(r.amount)}</strong></div>`).join(""):'<div class="daily-summary-empty">当天没有 Live 销售记录</div>';
  totalEl.textContent=money(data.reduce((s,r)=>s+Number(r.amount||0),0));
}
function renderFairMonthlyList(){
  const container=document.getElementById("fairMonthlyList");
  const totalEl=document.getElementById("fairMonthlySalesTotal");
  const titleEl=document.getElementById("fairMonthlyTitle");
  const labelEl=document.getElementById("fairMonthlyTotalLabel");
  if(!container||!totalEl)return;

  const month=monthFromDateControl("fairStart");
  const monthLabel=/^\d{4}-\d{2}$/.test(month)?`${month.slice(5,7)}-${month.slice(0,4)}`:"-";
  if(titleEl)titleEl.textContent=`Fair ${monthLabel} 销售记录`;
  if(labelEl)labelEl.textContent=`Fair ${monthLabel} 总销售额`;

  const list=rows
    .filter(r=>r.type==="fair"&&displayToISO(r.date).slice(0,7)===month&&Number(r.amount)>0)
    .map(r=>({...r,displayLocation:canonicalLocation(r.location||"Fair")}))
    .sort((a,b)=>
      a.displayLocation.localeCompare(b.displayLocation,"en",{sensitivity:"base"})||
      displayToISO(a.date).localeCompare(displayToISO(b.date))
    );

  const total=list.reduce((sum,r)=>sum+Number(r.amount||0),0);
  if(!list.length){
    container.innerHTML='<div class="sub">这个月份还没有 Fair 记录</div>';
    totalEl.textContent="0.00";
    return;
  }

  const locations=[];
  list.forEach(r=>{
    let group=locations.find(item=>item.name===r.displayLocation);
    if(!group){
      group={name:r.displayLocation,rows:[]};
      locations.push(group);
    }
    group.rows.push(r);
  });

  container.innerHTML=locations.map(group=>{
    const locationTotal=group.rows.reduce((sum,r)=>sum+Number(r.amount||0),0);
    return `<div class="month-record-group">
      <div class="month-record-group-title">${group.name}</div>
      ${group.rows.map(r=>`<div class="month-record-row">
        <span>${r.date}</span>
        <strong>${money(r.amount)}</strong>
      </div>`).join("")}
      <div class="month-record-row month-record-total">
        <span>总数</span>
        <strong>${money(locationTotal)}</strong>
      </div>
    </div>`;
  }).join("");

  totalEl.textContent=money(total);
  renderFairPageTop3();
}
function renderLiveMonthlyList(){
  const container=document.getElementById("liveMonthlyList");
  const totalEl=document.getElementById("liveSelectedHostTotal");
  const commissionTotalEl=document.getElementById("liveSelectedCommissionTotal");
  const titleEl=document.getElementById("liveMonthlyTitle");
  const totalLabelEl=document.getElementById("liveMonthlyTotalLabel");
  const commissionLabelEl=document.getElementById("liveMonthlyCommissionLabel");
  if(!container||!totalEl)return;

  const liveMonth=getLiveSelectedMonth();
  const monthLabel=/^\d{4}-\d{2}$/.test(liveMonth)?`${liveMonth.slice(5,7)}-${liveMonth.slice(0,4)}`:"-";
  if(titleEl)titleEl.textContent=`Live ${monthLabel} 销售记录`;
  if(totalLabelEl)totalLabelEl.textContent=`Live ${monthLabel} 总销售额`;
  if(commissionLabelEl)commissionLabelEl.textContent=`Live ${monthLabel} 总佣金`;

  const list=rows
    .filter(r=>r.type==="live"&&displayToISO(r.date).slice(0,7)===liveMonth&&Number(r.amount)>0)
    .map(r=>{
      const rate=getLiveHostRate(r.location,r.date);
      const amount=Number(r.amount||0);
      return{
        ...r,
        displayHost:canonicalLiveHost(r.location),
        commissionRate:rate,
        commissionAmount:amount*rate/100
      };
    })
    .sort((a,b)=>{
      const hostSort=a.displayHost.localeCompare(b.displayHost,"en",{sensitivity:"base"});
      return hostSort||displayToISO(a.date).localeCompare(displayToISO(b.date));
    });

  const total=list.reduce((sum,r)=>sum+Number(r.amount||0),0);
  const commissionTotal=list.reduce((sum,r)=>sum+Number(r.commissionAmount||0),0);

  if(!list.length){
    container.innerHTML='<div class="sub">这个月份还没有 Live 记录</div>';
    totalEl.textContent="0.00";
    if(commissionTotalEl)commissionTotalEl.textContent="0.00";
    return;
  }

  const groups=[];
  list.forEach(r=>{
    const key=normalizeLiveHostKey(r.displayHost);
    let group=groups.find(item=>item.key===key);
    if(!group){
      group={key,name:r.displayHost,rows:[]};
      groups.push(group);
    }
    group.rows.push(r);
  });

  container.innerHTML=groups.map(group=>{
    const hostTotal=group.rows.reduce((sum,r)=>sum+Number(r.amount||0),0);
    const hostCommission=group.rows.reduce((sum,r)=>sum+Number(r.commissionAmount||0),0);
    return `<div class="live-sales-group">
      <div class="live-sales-group-title"><span>${group.name}</span></div>
      <div class="live-record-row live-record-head">
        <span>日期</span>
        <span class="live-record-value">销售额</span>
        <span class="live-record-rate">佣金率</span>
        <span class="live-record-commission">佣金</span>
      </div>
      ${group.rows.map(r=>`<div class="live-record-row">
        <span>${r.date}</span>
        <strong class="live-record-value">${money(r.amount)}</strong>
        <span class="live-record-rate">${r.commissionRate}%</span>
        <strong class="live-record-commission">${money(r.commissionAmount)}</strong>
      </div>`).join("")}
      <div class="live-record-row live-record-total">
        <span>总数</span>
        <strong class="live-record-value">${money(hostTotal)}</strong>
        <span></span>
        <strong class="live-record-commission">${money(hostCommission)}</strong>
      </div>
    </div>`;
  }).join("");

  totalEl.textContent=money(total);
  if(commissionTotalEl)commissionTotalEl.textContent=money(commissionTotal);
  renderLivePageTop3();
}

const LIVE_LAST_SESSION_KEY="lover_live_last_saved_session_v72";
function saveLastLiveSession(host,dateISO){
  const cleanHost=canonicalLiveHost(host);
  if(!cleanHost||!dateISO)return;
  try{
    localStorage.setItem(LIVE_LAST_SESSION_KEY,JSON.stringify({host:cleanHost,dateISO}));
  }catch(e){}
  renderLivePageTop3();
}
function restoreLastLiveSession(){
  const hostEl=document.getElementById("liveHost");
  const dateEl=document.getElementById("liveDate");
  if(!hostEl||!dateEl)return;
  try{
    const saved=JSON.parse(localStorage.getItem(LIVE_LAST_SESSION_KEY)||"null");
    if(saved&&saved.host)hostEl.value=canonicalLiveHost(saved.host);
  }catch(e){}
  // V21.4: do not restore the previously saved date.
  setDateControl("liveDate",todayISO());
  updateLiveInputFromSelectedDate();
}
function liveByHostThisMonth(){
  const map={};
  rows.filter(r=>r.type==="live"&&sameMonth(r.date)&&Number(r.amount)>0).forEach(r=>{
    const key=normalizeLiveHostKey(r.location);
    if(!key)return;
    if(!map[key])map[key]={name:canonicalLiveHost(r.location),total:0,commission:0,rates:new Set()};
    const amount=Number(r.amount||0);
    const rate=getLiveHostRate(r.location,r.date);
    map[key].total+=amount;
    map[key].commission+=amount*rate/100;
    map[key].rates.add(rate);
  });
  return Object.values(map).sort((a,b)=>a.name.localeCompare(b.name));
}
function renderLiveHostSummary(){
  const el=document.getElementById("liveHostSummary");
  if(!el)return;
  const data=liveByHostThisMonth();
  el.innerHTML=data.length?data.map(item=>{
    const rates=[...item.rates].sort((a,b)=>a-b);
    const rateText=rates.length===1?`${rates[0]}%`:"按日期";
    return `<div class="fair-location-card"><div class="fair-location-title">${item.name}</div><div class="fair-location-row"><span>销售额</span><b>${money(item.total)}</b></div><div class="fair-location-row"><span>佣金 ${rateText}</span><b>${money(item.commission)}</b></div></div>`;
  }).join(""):'<div class="sub">这个月份还没有 Live 记录</div>';
}
function reactivateLiveHostIfNeeded(name){
  const raw=canonicalLiveHost(name);
  const key=normalizeLiveHostKey(raw);
  if(!key)return{host:raw,reactivated:false};
  const current=getCommissionSettings();
  const inactive={...(current.inactiveLiveHosts||{})};
  const historic=rows.find(r=>r.type==="live"&&normalizeLiveHostKey(r.location)===key);
  const original=canonicalLiveHost(inactive[key]||(historic&&historic.location)||raw);
  if(!inactive[key])return{host:(current.liveHosts||{})[key]||original,reactivated:false};
  const liveHosts={...(current.liveHosts||{}),[key]:original};
  const liveHostRates={...(current.liveHostRates||{}),[key]:10};
  delete inactive[key];
  const next=normalizeCommissionSettings({...current,liveHosts,liveHostRates,inactiveLiveHosts:inactive});
  const list=getSavedLiveHosts().filter(x=>normalizeLiveHostKey(x)!==key);
  list.push(original);
  localStorage.setItem("lover_live_hosts_v69",JSON.stringify(list));
  applyCommissionSettings(next);
  saveLocalDataCache(next);
  renderLiveHostOptions();
  renderLiveHostCommissionSettings();
  saveLiveCommissionSettingsToSheet(next,selectedMonth()).then(saved=>{
    const confirmed=normalizeCommissionSettings(saved||next);
    applyCommissionSettings(confirmed);
    saveLocalDataCache(confirmed);
    renderLiveHostOptions();
    renderLiveHostCommissionSettings();
    setSync("主播已复职并同步",true);
  }).catch(()=>setSync("主播已复职，云端稍后重试",false,true));
  return{host:original,reactivated:true};
}


/* ================= V21.4 Import Cost System product search ================= */
// Search/mapping behavior mirrors Lover Legend Cost and Pricing Calculator V8.2.
const IMPORT_SYSTEM_CLOUD_URL_V214="https://script.google.com/macros/s/AKfycbxWKdEC7vy_7pZ2_CPie-9L5DeIofPggZlLuwB7gW-31HqWXEOxshtCR-HB-m5qLYS6/exec";
let importProductsV214=[];
let importProductsPromiseV214=null;

function normalizeImportProductSearchTextV214(value){
  return String(value||"")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\u3000\-_./\\,，、:：;；()（）[\]【】{}"'`~!！?？@#$%^&*+=|<>]+/g,"");
}
function extractImportProductCodesV214(value){
  const source=String(value||"").normalize("NFKC").toLocaleLowerCase();
  return source.match(/[a-z]{1,6}[0-9][a-z0-9]*/g)||[];
}
function isExactProductCodeQueryV214(value){
  const query=normalizeImportProductSearchTextV214(value);
  return /^[a-z]{1,6}[0-9][a-z0-9]*$/.test(query);
}
function unorderedImportProductMatchV214(sourceValue,queryValue){
  const source=normalizeImportProductSearchTextV214(sourceValue);
  const query=normalizeImportProductSearchTextV214(queryValue);
  if(!query)return true;
  if(isExactProductCodeQueryV214(query)){
    return extractImportProductCodesV214(sourceValue).some(code=>code===query);
  }
  if(source.includes(query))return true;
  if(!/^[\p{Script=Han}]+$/u.test(query))return false;
  const counts=new Map();
  Array.from(source).forEach(ch=>counts.set(ch,(counts.get(ch)||0)+1));
  return Array.from(query).every(ch=>{
    const count=counts.get(ch)||0;
    if(count<1)return false;
    counts.set(ch,count-1);
    return true;
  });
}
function isDateLikeCorruptedNumberV214(value){
  if(typeof value!=="string")return false;
  const text=value.trim();
  return /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(text)||/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(text);
}
function parseCloudNumberV214(value){
  if(typeof value==="number")return Number.isFinite(value)?value:0;
  if(isDateLikeCorruptedNumberV214(value))return 0;
  const normalized=String(value??"").replace(/,/g,"").replace(/[^0-9.\-]/g,"").trim();
  const number=Number(normalized);
  return Number.isFinite(number)?number:0;
}
function normalizePercentValueV214(value){
  const n=parseCloudNumberV214(value);
  if(!Number.isFinite(n)||n<=0)return 0;
  return n>0&&n<1?n*100:n;
}
function buildCloudImportProductRecordsV214(data){
  const imports=Array.isArray(data?.imports)?data.imports:[];
  const batches=Array.isArray(data?.batches)?data.batches:[];
  const products=Array.isArray(data?.products)?data.products:[];

  const productById=new Map(products.map(product=>[String(product?.id||""),product]));
  const productByName=new Map(products.map(product=>[
    normalizeImportProductSearchTextV214(product?.name||""),product
  ]));
  const normalizeImportNumber=value=>String(value||"").trim().toLocaleLowerCase();

  const batchesByNumber=new Map();
  batches.forEach(batch=>{
    const key=normalizeImportNumber(batch?.importNumber);
    if(!key)return;
    if(!batchesByNumber.has(key))batchesByNumber.set(key,[]);
    batchesByNumber.get(key).push(batch);
  });

  function findMatchedItem(batch,productName){
    if(!batch||!Array.isArray(batch?.items))return null;
    const wanted=normalizeImportProductSearchTextV214(productName);
    if(!wanted)return null;
    const exact=batch.items.find(item=>
      normalizeImportProductSearchTextV214(item?.productName||item?.name||"")===wanted
    );
    if(exact)return exact;
    return batch.items.find(item=>{
      const itemName=normalizeImportProductSearchTextV214(item?.productName||item?.name||"");
      return itemName&&(itemName.includes(wanted)||wanted.includes(itemName));
    })||null;
  }

  function scoreBatch(batch,productName){
    const matchedItem=findMatchedItem(batch,productName);
    const rate=parseCloudNumberV214(batch?.rate??batch?.exchangeRate??batch?.fixedRate);
    const shippingRate=normalizePercentValueV214(
      batch?.shippingRate??batch?.fixedShippingRate??batch?.overseasShippingRate??batch?.overseasFreightRate
    );
    const inlandMisc=normalizePercentValueV214(
      batch?.inlandMiscRate??batch?.inlandMiscPercent??batch?.fixedInlandMiscPercent??batch?.inlandMiscPercentage
    );
    const updatedAt=Date.parse(batch?.updatedAt||batch?.createdAt||"")||0;
    return{
      batch,matchedItem,
      score:Number(Boolean(matchedItem))*100+Number(rate>0)*10+Number(inlandMisc>0)*5+Number(shippingRate>0)*5,
      updatedAt
    };
  }

  function resolveImportMapping(importNumber,productName){
    const candidates=batchesByNumber.get(normalizeImportNumber(importNumber))||[];
    if(!candidates.length)return{batch:null,matchedItem:null};
    const scored=candidates.map(batch=>scoreBatch(batch,productName))
      .sort((a,b)=>b.score-a.score||b.updatedAt-a.updatedAt);
    return{batch:scored[0]?.batch||null,matchedItem:scored[0]?.matchedItem||null};
  }

  const records=[];
  const seen=new Set();

  function addRecord(source){
    const productName=String(source?.productName||source?.name||"").trim();
    const category=String(source?.category||"盆栽").trim();
    const importNumber=String(source?.importNumber||"").trim();
    const currency=String(source?.currency||"").trim().toUpperCase();
    const unitPrice=parseCloudNumberV214(source?.unitPrice);

    if(!productName||category!=="盆栽"||!currency||!Number.isFinite(unitPrice)||unitPrice<=0)return;

    const key=[
      normalizeImportProductSearchTextV214(productName),
      normalizeImportNumber(importNumber),
      currency,
      unitPrice
    ].join("|");
    if(seen.has(key))return;
    seen.add(key);

    const {batch,matchedItem}=resolveImportMapping(importNumber,productName);
    const product=
      productById.get(String(source?.productId||""))||
      productByName.get(normalizeImportProductSearchTextV214(productName))||
      null;

    const inlandMiscPercent=
      normalizePercentValueV214(
        batch?.inlandMiscRate??batch?.inlandMiscPercent??batch?.fixedInlandMiscPercent??batch?.inlandMiscPercentage
      )||
      normalizePercentValueV214(
        source?.inlandMiscRate??source?.inlandMiscPercent??source?.fixedInlandMiscPercent??source?.inlandFeePercent??source?.domesticMiscPercent
      )||0;

    const shippingRate=
      normalizePercentValueV214(
        batch?.shippingRate??batch?.fixedShippingRate??batch?.overseasShippingRate??batch?.overseasFreightRate
      )||
      normalizePercentValueV214(
        source?.shippingRate??source?.fixedShippingRate??source?.overseasShippingRate
      )||0;

    records.push({
      id:String(source?.id||key),
      productId:String(source?.productId||product?.id||""),
      productName,
      importNumber,
      unitPrice,
      currency,
      inlandMiscPercent,
      shippingRate,
      averageCost:parseCloudNumberV214(product?.averageCost??source?.averageCostRM??source?.unitCost),
      minimumPrice:parseCloudNumberV214(product?.minimumPrice??source?.minimumPrice??0),
      stock:product?.stock===undefined||product?.stock===null?null:parseCloudNumberV214(product.stock),
      mappingStatus:batch?"BATCH_MATCHED":"BATCH_MISSING",
      matchedItem:Boolean(matchedItem)
    });
  }

  imports.forEach(addRecord);
  records.sort((a,b)=>a.productName.localeCompare(b.productName,"zh-Hans-CN",{numeric:true,sensitivity:"base"}));
  return records;
}

async function loadImportProductsV214(force=false){
  if(importProductsV214.length&&!force)return importProductsV214;
  if(importProductsPromiseV214)return importProductsPromiseV214;
  importProductsPromiseV214=(async()=>{
    const response=await fetch(IMPORT_SYSTEM_CLOUD_URL_V214,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"pull",knownRevision:0,hasLocalData:false,forceFull:true}),
      cache:"no-store"
    });
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!data?.ok||!Array.isArray(data.products)||!Array.isArray(data.imports)||!Array.isArray(data.batches)){
      throw new Error(data?.error||"进口系统资料不完整");
    }
    importProductsV214=buildCloudImportProductRecordsV214(data);
    return importProductsV214;
  })().finally(()=>{importProductsPromiseV214=null;});
  return importProductsPromiseV214;
}

function formatOriginalUnitPriceV214(value){
  return Number(value||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function formatPercentV214(value){
  return Number(value||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function applyImportRecordToProductCardV214(item,nameInput,record){
  nameInput.value=String(record?.productName||"");
  nameInput.dataset.productId=String(record?.productId||record?.id||"");
  item.dataset.importMapped="1";
  item.dataset.minimumPrice=String(Number(record?.minimumPrice||0));

  const costInput=item.querySelector(".product-link-avg-cost");
  if(costInput)costInput.value=formatAmount(Number(record?.averageCost||0));

  updateProductLinkMinimumWarningV214(item);
  recalcProductLinkProfitV211(item);
}
function clearImportMappingForManualProductV214(item){
  const nameInput=item.querySelector(".product-link-name");
  if(nameInput)nameInput.dataset.productId="";
  item.dataset.minimumPrice="0";
  if(item.dataset.importMapped==="1"){
    const costInput=item.querySelector(".product-link-avg-cost");
    if(costInput)costInput.value="0.00";
  }
  item.dataset.importMapped="0";
  updateProductLinkMinimumWarningV214(item);
}
function updateProductLinkMinimumWarningV214(item){
  if(!item)return;
  const warning=item.querySelector(".product-link-minimum-warning");
  const actualPrice=toAmount(item.querySelector(".product-link-price")?.value||0);
  const minimumPrice=Math.max(0,Number(item.dataset.minimumPrice||0));
  if(!warning)return;
  const low=minimumPrice>0&&actualPrice>0&&actualPrice<minimumPrice;
  warning.hidden=!low;
  warning.textContent=low?`⚠ 低于最低售价 RM${formatAmount(minimumPrice)}`:"";
  const priceInput=item.querySelector(".product-link-price");
  if(priceInput)priceInput.classList.toggle("below-minimum-price",low);
}
function setupImportProductSearchV214(item,nameInput,resultsBox){
  let blurTimer=null;
  const close=()=>{resultsBox.hidden=true;resultsBox.innerHTML="";};

  const render=async()=>{
    const keyword=String(nameInput.value||"").trim();
    try{
      const products=await loadImportProductsV214();
      const matches=products.filter(record=>{
        const searchable=[
          record.productName,
          record.importNumber,
          record.currency,
          record.unitPrice,
          record.averageCost,
          record.shippingRate,
          record.inlandMiscPercent,
          record.minimumPrice
        ].join(" ");
        return unorderedImportProductMatchV214(searchable,keyword);
      }).slice(0,30);

      resultsBox.innerHTML="";
      if(!matches.length){
        const empty=document.createElement("div");
        empty.className="product-link-search-empty";
        empty.textContent="没有符合的进口产品；可继续手动输入产品名称";
        resultsBox.appendChild(empty);
        resultsBox.hidden=false;
        return;
      }

      matches.forEach(record=>{
        const row=document.createElement("button");
        row.type="button";
        row.className="product-link-search-option";

        const line1=document.createElement("div");
        line1.className="product-link-search-line1";
        line1.textContent=
          `${record.productName} · 原购买单价 ${String(record.currency||"").toUpperCase()} ${formatOriginalUnitPriceV214(record.unitPrice)}`+
          ` · 内地杂费 ${formatPercentV214(record.inlandMiscPercent)}%`+
          ` · 平均成本 RM ${formatAmount(Number(record.averageCost||0))}`;

        const line2=document.createElement("div");
        line2.className="product-link-search-line2";
        line2.textContent=
          `最低售价 RM ${formatAmount(Number(record.minimumPrice||0))}`+
          ` · 海外运费 ${formatPercentV214(record.shippingRate)}%`+
          ` · ${record.mappingStatus==="BATCH_MATCHED"?"Batch 已匹配":"Batch 未匹配"}`;

        row.append(line1,line2);
        row.addEventListener("mousedown",e=>e.preventDefault());
        row.addEventListener("click",()=>{
          applyImportRecordToProductCardV214(item,nameInput,record);
          close();
        });
        resultsBox.appendChild(row);
      });

      resultsBox.hidden=false;
    }catch(err){
      resultsBox.innerHTML="";
      const empty=document.createElement("div");
      empty.className="product-link-search-empty error";
      empty.textContent="读取进口系统失败；仍可手动输入产品名称";
      resultsBox.appendChild(empty);
      resultsBox.hidden=false;
      console.warn("Import product search failed",err);
    }
  };

  nameInput.addEventListener("focus",render);
  nameInput.addEventListener("input",()=>{
    clearTimeout(blurTimer);
    clearImportMappingForManualProductV214(item);
    render();
  });
  nameInput.addEventListener("blur",()=>{blurTimer=setTimeout(close,180);});
}

/* ================= V21.4 optional bonsai product association ================= */

let productLinkItemSeqV206=0;
function productLinkContextV206(type){
  const pre=type==="live"?"live":"fair";
  const date=type==="live"?isoToDisplay(document.getElementById("liveDate")?.value||""):String(document.getElementById("fairProductDate")?.value||"");
  const location=type==="live"?selectedLiveHost():canonicalLocation(String(document.getElementById("fairLocation")?.value||"").trim());
  return{pre,date,location};
}
function productLinkPreV208(type){return type==="live"?"live":"fair";}
function ensureProductLinkFirstCardV208(type){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  if(!wrap)return false;
  if(!wrap.querySelector('.product-link-item'))addProductLinkItemV209(type);
  return true;
}
function toggleProductLinkBoxV206(type){
  const pre=productLinkPreV208(type),box=document.getElementById(pre+"ProductLinkBox"),body=document.getElementById(pre+"ProductLinkBody");
  if(!box||!body)return;
  const opening=body.classList.contains("hidden");
  body.classList.toggle("hidden",!opening);box.classList.toggle("product-link-collapsed",!opening);
  const btn=box.querySelector(".product-link-toggle");if(btn)btn.setAttribute("aria-expanded",opening?"true":"false");
  if(opening){
    // V21.4: show the first editable card immediately. This is a pure front-end action
    // and must never wait for date/host context or a Google Apps Script response.
    ensureProductLinkFirstCardV208(type);
    if(type==="fair")syncFairProductDatesV203();
    Promise.resolve(loadProductLinksIntoEditorV206(type)).catch(()=>{});
  }
}
function liveDeliveryDefaultV203(price){
  const n=Number(price||0);
  if(n<=0)return 0;
  if(n<=300)return 30;
  if(n<500)return 50;
  if(n<2000)return 80;
  if(n<5000)return 120;
  return 150;
}
function productLinkDefaultCommissionRateV211(type){
  // V21.4: Live linked-product commission defaults to 10%; editable per card.
  return String(type||"").toLowerCase()==="live"?10:0;
}
function recalcProductLinkProfitV211(item){
  if(!item)return;
  const qty=Math.max(0,Number(item.querySelector('.product-link-qty')?.value||0));
  const avgCost=toAmount(item.querySelector('.product-link-avg-cost')?.value||0);
  const actualPrice=toAmount(item.querySelector('.product-link-price')?.value||0);
  const rate=Math.max(0,Number(item.querySelector('.product-link-commission-rate')?.value||0));
  const delivery=toAmount(item.querySelector('.product-link-delivery')?.value||0);
  const extra=toAmount(item.querySelector('.product-link-extra')?.value||0);
  const commission=actualPrice*rate/100;
  const profit=actualPrice-commission-(avgCost*qty)-delivery-extra;
  const margin=actualPrice>0?profit/actualPrice*100:0;
  const commissionEl=item.querySelector('.product-link-commission-amount');
  const profitEl=item.querySelector('.product-link-profit');
  const marginEl=item.querySelector('.product-link-profit-rate');
  if(commissionEl)commissionEl.textContent='RM'+formatAmount(commission);
  if(profitEl)profitEl.value=formatAmount(profit);
  if(marginEl)marginEl.value=Number.isFinite(margin)?margin.toFixed(2)+'%':'0.00%';
}
function buildProductLinkItemV209(type,id,data={}){
  const live=type==="live",linkId=String(data.linkId||""),saved=!!linkId,qty=Math.max(1,Number(data.quantity||1));
  const item=document.createElement("div");
  item.className="product-link-item";
  item.dataset.productLinkItem=String(id);
  item.dataset.linkId=linkId;
  item.dataset.saved=saved?"1":"0";
  item.dataset.minimumPrice=String(Number(data.minimumPrice||0));
  item.dataset.importMapped=String(data.productId||"")?"1":"0";

  const head=document.createElement("div");head.className="product-link-item-head";
  const title=document.createElement("b");title.textContent=saved?"已保存":"";
  if(saved)title.className="product-link-saved-tag";
  const remove=document.createElement("button");remove.type="button";remove.className="product-link-remove-btn";remove.textContent="删除这棵关联";remove.addEventListener("click",()=>removeProductLinkItemV206(type,id));
  head.append(title,remove);item.appendChild(head);

  const label=(text)=>{const el=document.createElement("label");el.textContent=text;return el};
  const input=(cls,value,placeholder)=>{const el=document.createElement("input");el.className=cls;el.value=value??"";if(placeholder)el.placeholder=placeholder;return el};

  item.appendChild(label("进口产品"));
  const name=input("product-link-name",String(data.productName||""),"输入产品名称搜索，或直接手动输入");
  name.dataset.productId=String(data.productId||"");
  const searchWrap=document.createElement("div");searchWrap.className="product-link-search-wrap";
  searchWrap.appendChild(name);
  const searchResults=document.createElement("div");searchResults.className="product-link-search-results";searchResults.hidden=true;
  searchWrap.appendChild(searchResults);
  item.appendChild(searchWrap);
  setupImportProductSearchV214(item,name,searchResults);

  const grid1=document.createElement("div");grid1.className="product-link-grid";
  const qWrap=document.createElement("div");qWrap.appendChild(label("数量"));
  const q=input("product-link-qty qty-input-no-spinner",String(qty));q.type="number";q.min="1";q.step="1";q.inputMode="numeric";qWrap.appendChild(q);
  const cWrap=document.createElement("div");cWrap.appendChild(label("平均成本"));
  const c=input("product-link-avg-cost money-input",formatAmount(Number(data.averageCost||0)));c.inputMode="decimal";cWrap.appendChild(c);
  grid1.append(qWrap,cWrap);item.appendChild(grid1);

  const grid2=document.createElement("div");grid2.className="product-link-grid";
  const pWrap=document.createElement("div");pWrap.appendChild(label("实际售价"));
  const p=input("product-link-price money-input",formatAmount(Number(data.actualPrice||0)));p.inputMode="decimal";pWrap.appendChild(p);
  const minWarn=document.createElement("div");minWarn.className="product-link-minimum-warning";minWarn.hidden=true;pWrap.appendChild(minWarn);
  const rateWrap=document.createElement("div");rateWrap.appendChild(label(live?"主播佣金 %":"Fair 佣金 %"));
  const defaultRate=data.commissionRate!==undefined&&data.commissionRate!==null&&data.commissionRate!==""?Number(data.commissionRate):productLinkDefaultCommissionRateV211(type);
  const rate=input("product-link-commission-rate",Number(defaultRate||0).toFixed(2));rate.type="text";rate.inputMode="decimal";rateWrap.appendChild(rate);
  const rateHint=document.createElement("div");rateHint.className="product-link-commission-hint";rateHint.innerHTML='<span></span><b class="product-link-commission-amount">RM0.00</b>';rateWrap.appendChild(rateHint);
  grid2.append(pWrap,rateWrap);item.appendChild(grid2);

  const grid3=document.createElement("div");grid3.className="product-link-grid";
  const dWrap=document.createElement("div");dWrap.appendChild(label("本地运费"));
  const d=input("product-link-delivery money-input",formatAmount(Number(data.localDelivery||0)));d.inputMode="decimal";d.dataset.manual=(saved||Number(data.localDelivery||0)>0)?"1":"0";d.addEventListener("input",()=>{d.dataset.manual="1";recalcProductLinkProfitV211(item)});dWrap.appendChild(d);
  const eWrap=document.createElement("div");eWrap.appendChild(label("附加费用"));
  const e=input("product-link-extra money-input",formatAmount(Number(data.extraFee||0)));e.inputMode="decimal";eWrap.appendChild(e);
  grid3.append(dWrap,eWrap);item.appendChild(grid3);

  const grid4=document.createElement("div");grid4.className="product-link-grid product-link-profit-grid";
  const profitWrap=document.createElement("div");profitWrap.appendChild(label("利润"));
  const profit=input("product-link-profit money-input","0.00");profit.readOnly=true;profit.tabIndex=-1;profitWrap.appendChild(profit);
  const marginWrap=document.createElement("div");marginWrap.appendChild(label("利润率"));
  const margin=input("product-link-profit-rate","0.00%");margin.readOnly=true;margin.tabIndex=-1;marginWrap.appendChild(margin);
  grid4.append(profitWrap,marginWrap);item.appendChild(grid4);

  item.appendChild(label("备注（可空白）"));
  const remark=input("product-link-remark",String(data.remark||""),"顾客名字、电话或其他讯息");remark.maxLength=100;item.appendChild(remark);

  const recalc=()=>recalcProductLinkProfitV211(item);
  q.addEventListener("input",recalc);c.addEventListener("input",recalc);rate.addEventListener("input",recalc);e.addEventListener("input",recalc);
  p.addEventListener("input",()=>{applyLiveDeliveryDefaultItemV206(p);updateProductLinkMinimumWarningV214(item);recalc()});
  [c,p,d,e].forEach(el=>el.addEventListener("blur",()=>{el.value=formatAmount(toAmount(el.value||0));recalc();}));
  rate.addEventListener("blur",()=>{const n=Math.max(0,Number(String(rate.value||"0").replace(/[^0-9.\-]/g,""))||0);rate.value=n.toFixed(2);recalc();});
  setTimeout(()=>{updateProductLinkMinimumWarningV214(item);recalc()},0);
  return item;
}
function addProductLinkItemV209(type,data={}){
  const pre=productLinkPreV208(type),wrap=document.getElementById(pre+"ProductItems");
  if(!wrap){console.error("V21.4 product item container missing",type);return false}
  const id=++productLinkItemSeqV206;
  const item=buildProductLinkItemV209(type,id,data);
  wrap.appendChild(item);
  return true;
}
function addProductLinkItemV206(type,data={}){return addProductLinkItemV209(type,data)}
// Explicit globals keep both legacy and V21.4 button bindings reliable.
window.addProductLinkItemV206=addProductLinkItemV206;
window.addProductLinkItemV209=addProductLinkItemV209;
window.toggleProductLinkBoxV206=toggleProductLinkBoxV206;
async function removeProductLinkItemV206(type,id){
  const {pre}=productLinkContextV206(type),wrap=document.getElementById(pre+"ProductItems"),el=wrap?.querySelector(`[data-product-link-item="${id}"]`);if(!el)return;
  const linkId=String(el.dataset.linkId||""),saved=el.dataset.saved==="1";
  if(linkId&&saved){
    if(!confirm("确定删除这棵已保存的盆栽关联？\n\n这会同步删除 Google Sheet 的 Sales_Product_Links 记录。"))return;
    try{setSync("正在删除盆栽关联...");await deleteSalesProductLinkV206(linkId);el.remove();setSync("盆栽关联已删除",true);alert("盆栽关联已删除。");}
    catch(e){alert("删除盆栽关联失败："+(e.message||e));setSync("盆栽关联删除失败",false,true);return;}
  }else el.remove();
  if(wrap&&!wrap.children.length)addProductLinkItemV209(type);
}
function applyLiveDeliveryDefaultItemV206(priceInput){const item=priceInput?.closest('.product-link-item'),d=item?.querySelector('.product-link-delivery');if(!d||d.dataset.manual==='1')return;d.value=formatAmount(liveDeliveryDefaultV203(toAmount(priceInput.value||0)));}
function syncFairProductDatesV203(){const sel=document.getElementById("fairProductDate");if(!sel)return;const start=document.getElementById("fairStart")?.value,end=document.getElementById("fairEnd")?.value||start;if(!start||!end){sel.innerHTML="";return}const current=sel.value;const dates=dateRange(start,end);sel.innerHTML=dates.map(d=>`<option value="${d}">${d}</option>`).join("");if(dates.includes(current))sel.value=current;}
function collectProductLinksV206(type){
  const {pre,date,location}=productLinkContextV206(type),wrap=document.getElementById(pre+"ProductItems"),items=[...(wrap?.querySelectorAll('.product-link-item')||[])];
  return items.map(item=>{
    let linkId=String(item.dataset.linkId||"");
    const productName=String(item.querySelector('.product-link-name')?.value||"").trim(),actualPrice=toAmount(item.querySelector('.product-link-price')?.value||0),remark=String(item.querySelector('.product-link-remark')?.value||"").trim();
    if(!linkId&&(productName||actualPrice||remark)){linkId="spl_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);item.dataset.linkId=linkId;}
    const quantity=Math.max(0,Number(item.querySelector('.product-link-qty')?.value||0)),averageCost=toAmount(item.querySelector('.product-link-avg-cost')?.value||0),commissionRate=Math.max(0,Number(item.querySelector('.product-link-commission-rate')?.value||0)),localDelivery=toAmount(item.querySelector('.product-link-delivery')?.value||0),extraFee=toAmount(item.querySelector('.product-link-extra')?.value||0);
    const commissionAmount=actualPrice*commissionRate/100,profit=actualPrice-commissionAmount-(averageCost*quantity)-localDelivery-extraFee,profitRate=actualPrice>0?profit/actualPrice*100:0;
    const productId=String(item.querySelector(".product-link-name")?.dataset.productId||"");const minimumPrice=Math.max(0,Number(item.dataset.minimumPrice||0));return{linkId,type,date,location,productId,productName,quantity,averageCost,minimumPrice,actualPrice,commissionRate,commissionAmount,localDelivery,extraFee,profit,profitRate,remark};
  }).filter(x=>x.linkId||x.productName||x.actualPrice||x.remark);
}
function renderProductLinksEditorV206(type,links){const {pre}=productLinkContextV206(type),wrap=document.getElementById(pre+"ProductItems");if(!wrap)return;wrap.innerHTML="";const list=Array.isArray(links)?links:[];if(list.length)list.forEach(x=>addProductLinkItemV209(type,x));else addProductLinkItemV209(type);}
function productLinkBoxIsOpenV210(type){
  const pre=productLinkPreV208(type),body=document.getElementById(pre+"ProductLinkBody");
  return !!body&&!body.classList.contains("hidden");
}
function refreshProductLinkContextV210(type){
  if(!productLinkBoxIsOpenV210(type))return;
  // Never leave the previous host/location cards on screen while the new context is loading.
  renderProductLinksEditorV206(type,[]);
  Promise.resolve(loadProductLinksIntoEditorV206(type)).catch(()=>{});
}
async function loadProductLinksIntoEditorV206(type){
  const {date,location}=productLinkContextV206(type);if(!date||!location){renderProductLinksEditorV206(type,[]);return}
  try{setSync("正在读取已保存盆栽...");const links=await loadSalesProductLinksV206(type,date,location);renderProductLinksEditorV206(type,links);setSync("已同步",true);}
  catch(e){renderProductLinksEditorV206(type,[]);setSync("盆栽关联读取失败",false,true);}
}
async function saveProductLinksV206(type){
  const items=collectProductLinksV206(type);if(!items.length){alert("请至少输入一棵盆栽资料；如果这次没有盆栽，可以保持收起，不需要保存。");return null}
  const first=items[0];if(!first.date||!first.location){alert(type==="live"?"请先选择日期和主播":"请先选择 Fair 日期和地点");return null}
  for(const x of items){if(!x.productName){alert("每一项盆栽都需要填写产品名称。");return null}if(!Number.isFinite(Number(x.quantity))||Number(x.quantity)<=0){alert("每一项盆栽数量必须大于 0。");return null}}
  const official=dedupeRows(rows).filter(r=>r.type===type&&r.date===first.date&&(type==="live"?normalizeLiveHostKey(r.location)===normalizeLiveHostKey(first.location):normalizeFairLocationKey(r.location)===normalizeFairLocationKey(first.location))).reduce((m,r)=>Math.max(m,Number(r.amount||0)),0);
  const batchTotal=items.reduce((s,x)=>s+Number(x.actualPrice||0),0);if(official>0&&batchTotal>official+0.005){alert(`盆栽实际售价合计 RM${formatAmount(batchTotal)} 已超过当天营业额 RM${formatAmount(official)}。`);return null}
  try{setSync("盆栽资料同步中...");const result=await saveSalesProductLinksV206(items);renderProductLinksEditorV206(type,result?.links||[]);setSync("盆栽资料已保存",true);alert("盆栽资料保存成功。");if(result?.warning)alert(result.warning);return result}
  catch(e){alert("盆栽资料保存失败："+(e.message||e));setSync("盆栽资料同步失败",false,true);return null}
}
async function saveLiveSales(){
  if(!ensureWritableSelection())return;
  const dateEl=document.getElementById("liveDate");
  const hostInput=document.getElementById("liveHost");
  const amountEl=document.getElementById("liveSales");
  const d=isoToDisplay(dateEl.value);
  let host=selectedLiveHost();
  const amount=toAmount(amountEl.value);
  if(!host){alert("请输入主播名字");return}
  if(!d){alert("请选择日期");return}
  const restored=reactivateLiveHostIfNeeded(host);
  host=restored.host;
  hostInput.value=host;
  saveLiveHost(host);
  saveLastLiveSession(host,dateEl.value);
  const now=new Date().toISOString();
  const localRow={type:"live",date:d,company:"live",location:host,amount,updatedAt:now,clientUpdatedAt:now};
  if(amount<=0)rows=rows.filter(r=>rowKey(r)!==rowKey(localRow));
  else upsertLocalRow(localRow);
  addPendingRow(localRow);
  renderAll();
  showTempMsg("liveSaveMsg");
  try{
    setSync("已储存，正在后台同步...");
    const saved=await saveLiveToSheet(d,host,amount,now);
    if(saved&&Number(saved.amount)>0)upsertLocalRow(saved);
    else rows=rows.filter(r=>rowKey(r)!==rowKey(localRow));
    clearPendingRow(localRow);
    renderAll();
    setSync("已同步",true);
  }catch(e){
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
    else setSync("同步暂未完成",false,true);
  }
}
function renderDashboard(){
  const bm=totalBy("daily","balakong","month"),blm=totalBy("daily","belimbing","month"),fm=totalBy("fair","","month"),lm=totalBy("live","","month");
  const by=totalBy("daily","balakong","year"),bly=totalBy("daily","belimbing","year"),fy=totalBy("fair","","year"),ly=totalBy("live","","year");
  document.getElementById("balakongMonth").textContent=money(bm);
  document.getElementById("belimbingMonth").textContent=money(blm);
  renderFairLocationList();
  document.getElementById("fairMonthTotal").textContent=money(fm);
  renderFairCommission(fm);
  renderLiveHostSummary();
  document.getElementById("liveMonthTotal").textContent=money(lm);
  const liveCommission=liveByHostThisMonth().reduce((sum,item)=>sum+item.commission,0);
  document.getElementById("liveCommissionLabel").textContent="Live 本月总佣金";
  document.getElementById("liveCommissionTotal").textContent=money(liveCommission);
  document.getElementById("monthGrandTotal").textContent=money(bm+blm+fm+lm);
  document.getElementById("balakongYearTotal").textContent=money(by);
  document.getElementById("belimbingYearTotal").textContent=money(bly);
  document.getElementById("fairYearTotal").textContent=money(fy);
  document.getElementById("liveYearTotal").textContent=money(ly);
  document.getElementById("yearGrandTotal").textContent=money(by+bly+fy+ly);
  renderTodayCompanyStatus();
  renderBusinessTop3();
}
function sortReportRows(list){
  const rank=r=>r.type==="daily"&&r.company==="balakong"?0:r.type==="daily"&&r.company==="belimbing"?1:r.type==="fair"?2:3;
  return [...list].sort((a,b)=>rank(a)-rank(b)||(rLocation(a)).localeCompare(rLocation(b))||displayToISO(a.date).localeCompare(displayToISO(b.date)));
}
function rLocation(r){return r.type==="live"?canonicalLiveHost(r.location):canonicalLocation(r.location)}
function renderTable(){
  const reportPicker=document.getElementById("reportMonthPicker");
  const reportLabel=document.getElementById("reportMonthLabel");
  if(reportPicker&&reportPicker.value!==selectedMonth())reportPicker.value=selectedMonth();
  if(reportLabel){const m=selectedMonth();reportLabel.textContent=m?`月份：${m.slice(5,7)}-${m.slice(0,4)}`:"月份：-";}
  const s=sortReportRows(dedupeRows(rows).filter(r=>sameMonth(r.date)&&Number(r.amount)>0));
  document.getElementById("recordTable").innerHTML=s.map(r=>{const rate=r.type==="live"?getLiveHostRate(r.location,r.date):r.type==="fair"?getFairCommissionRate(totalBy("fair","","month"))*100:0;const commission=(r.type==="live"||r.type==="fair")?Number(r.amount||0)*rate/100:0;return `<tr><td>${r.date}</td><td>${r.type==="fair"?"Fair":r.type==="live"?"Live":"每日"}</td><td>${r.type==="live"?"Live":(companyNames[r.company]||r.company)}</td><td>${r.location||"-"}</td><td>${money(r.amount)}</td><td>${rate?Number(rate.toFixed(2))+"%":"-"}</td><td>${rate?money(commission):"-"}</td></tr>`}).join("")||'<tr><td colspan="7" style="text-align:center;">这个月份还没有记录</td></tr>';
}
function renderAll(){
  // V21.4: one complete render path. This replaces the older partial duplicate
  // so Fair daily/monthly totals, Home totals and Report always refresh together.
  rows=dedupeRows(rows);
  renderDashboard();
  renderTable();
  updateDailyInputFromSelectedDate();
  renderFairLocationOptions();
  updateFairPageMode();
  renderFairMonthlyList();
  renderFairDailySummary();
  renderLiveHostOptions();
  updateLiveInputFromSelectedDate();
  renderLiveDailySummary();
  renderLiveMonthlyList();
  loadCommissionSettingsForm();
  renderLiveHostCommissionSettings();
  renderLiveRateSchedules();
  renderMonthlySummary();
  const dailyTotalsCard=document.getElementById("dailyTotalsCard");
  if(dailyTotalsCard&&!dailyTotalsCard.classList.contains("hidden"))renderDailyTotals();
}

function getMonthKeyFromRow(row){
  const iso=displayToISO(row&&row.date);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso)?iso.slice(0,7):"";
}
function buildMonthlySummary(){
  const map=new Map();
  const seedMonths=new Set([selectedMonth(),systemState.currentMonth,...(systemState.closedMonths||[])]);
  seedMonths.forEach(month=>{if(/^\d{4}-\d{2}$/.test(month))map.set(month,{month,balakong:0,belimbing:0,fair:0,live:0})});
  dedupeRows(rows).forEach(row=>{
    const month=getMonthKeyFromRow(row);
    if(!month)return;
    if(!map.has(month))map.set(month,{month,balakong:0,belimbing:0,fair:0,live:0});
    const item=map.get(month),amount=Number(row.amount||0);
    if(row.type==="daily"&&row.company==="balakong")item.balakong+=amount;
    else if(row.type==="daily"&&row.company==="belimbing")item.belimbing+=amount;
    else if(row.type==="fair")item.fair+=amount;
    else if(row.type==="live")item.live+=amount;
  });
  return [...map.values()].map(item=>({...item,total:item.balakong+item.belimbing+item.fair+item.live})).sort((a,b)=>b.month.localeCompare(a.month));
}
// V21.4: expandable daily total list. It uses cached rows immediately and only
// reads the selected historical month from cloud when the user asks for it.
function buildDailyTotals(month){
  const totals=new Map();
  dedupeRows(rows).forEach(row=>{
    const iso=displayToISO(row&&row.date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||iso.slice(0,7)!==month)return;
    const amount=Number(row.amount||0);
    if(!Number.isFinite(amount)||amount===0)return;
    totals.set(iso,(totals.get(iso)||0)+amount);
  });
  return [...totals.entries()]
    .map(([date,total])=>({date,total}))
    .filter(item=>Math.abs(item.total)>0.000001)
    .sort((a,b)=>b.date.localeCompare(a.date));
}
function renderDailyTotals(){
  const picker=document.getElementById("dailyTotalsMonth");
  const listEl=document.getElementById("dailyTotalsList");
  const grandTotalEl=document.getElementById("dailyTotalsMonthGrandTotal");
  if(!picker||!listEl)return;
  const month=/^\d{4}-\d{2}$/.test(picker.value)?picker.value:selectedMonth();
  const list=buildDailyTotals(month);
  const monthGrandTotal=list.reduce((sum,item)=>sum+Number(item.total||0),0);
  if(grandTotalEl)grandTotalEl.textContent=`RM${money(monthGrandTotal)}`;
  listEl.innerHTML=list.length
    ?list.map(item=>`<div class="daily-total-row"><span class="daily-total-date">${isoToDisplay(item.date)}</span><span class="daily-total-amount">RM${money(item.total)}</span></div>`).join("")
    :'<div class="daily-total-empty">这个月份还没有营业额记录</div>';
}
async function loadDailyTotalsMonth(month){
  const status=document.getElementById("dailyTotalsStatus");
  renderDailyTotals();

  // V21.4: current month already follows the normal Home sync flow.
  // Do not make a second cloud request just because the daily summary is opened.
  // This keeps startup / Home sync speed unchanged.
  const currentMonth=selectedMonth();
  if(month===currentMonth){
    if(status)status.textContent="";
    return;
  }

  // Historical months are fetched only when the user explicitly selects them.
  if(typeof loadMonthCloudShared!=="function"||typeof mergeCloudMonthRows!=="function"){
    if(status)status.textContent="";
    return;
  }

  if(status)status.textContent="正在读取 "+month.slice(5,7)+"-"+month.slice(0,4)+" 云端资料...";
  const started=Date.now();
  try{
    const json=await loadMonthCloudShared(month,15000);
    if(!json||!json.ok)throw new Error((json&&json.message)||"读取失败");
    if(typeof loadPendingRows==="function")loadPendingRows();
    mergeCloudMonthRows(month,json.rows||[],started);
    if(json.dataRevision&&typeof applyLocalDataRevision==="function")applyLocalDataRevision(json.dataRevision);
    if(typeof saveLocalDataCache==="function")saveLocalDataCache(json.commissionSettings||null,json.accessSettings||null);
    renderDailyTotals();
    if(status)status.textContent="已载入";
  }catch(e){
    // Keep the already rendered local data. Do not show a cloud-error warning,
    // and do not add retries that could slow down the main sync path.
    if(status)status.textContent="";
    console.warn("Daily totals historical month cloud read skipped:",e);
  }
}
async function toggleDailyTotals(force){
  const card=document.getElementById("dailyTotalsCard");
  const btn=document.getElementById("dailyTotalsBtn");
  const picker=document.getElementById("dailyTotalsMonth");
  if(!card||!picker)return;
  const show=typeof force==="boolean"?force:card.classList.contains("hidden");
  card.classList.toggle("hidden",!show);
  if(btn)btn.classList.toggle("active",show);
  if(!show)return;
  if(!/^\d{4}-\d{2}$/.test(picker.value))picker.value=selectedMonth();
  renderDailyTotals();
  setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"nearest"}),30);
  await loadDailyTotalsMonth(picker.value);
}

function renderMonthlySummary(){
  const body=document.getElementById("monthlySummaryBody");
  if(!body)return;
  const list=buildMonthlySummary();
  if(!list.length){body.innerHTML='<div class="summary-empty">还没有月份资料</div>';return;}
  const current=selectedMonth();
  const sorted=[...list].sort((a,b)=>b.month.localeCompare(a.month));
  const monthLabel=m=>m.slice(5,7)+"-"+m.slice(0,4);
  const value=(item,key)=>`RM${money(item[key]||0)}`;
  const head=sorted.map(item=>`<button type="button" class="monthly-month-head${item.month===current?" active":""}" onclick="selectSummaryMonth('${item.month}')">${monthLabel(item.month)}</button>`).join("");
  const row=(label,key)=>`<div class="monthly-grid-label${key==="total"?" monthly-total-cell":""}">${label}</div>${sorted.map(item=>`<div class="monthly-grid-value${key==="total"?" monthly-total-cell":""}">${value(item,key)}</div>`).join("")}`;
  body.style.setProperty("--month-count",String(sorted.length));
  body.innerHTML=`<div class="monthly-grid-head-label">月份</div>${head}${row("Balakong","balakong")}${row("Belimbing","belimbing")}${row("Fair","fair")}${row("Live","live")}${row("总数","total")}`;
}
async function toggleMonthlySummary(force){
  const card=document.getElementById("monthlySummaryCard");
  const btn=document.getElementById("monthlySummaryBtn");
  if(!card)return;

  const show=typeof force==="boolean"
    ?force
    :card.classList.contains("hidden");

  card.classList.toggle("hidden",!show);
  if(btn)btn.classList.toggle("active",show);
  if(!show)return;

  // V21.4: show cache immediately and complete historical months in background.
  renderMonthlySummary();
  setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"start"}),50);

  const year=String(document.getElementById("yearPicker")?.value||selectedYear()||"");
  if(typeof loadYearInBackground==="function"&&/^\d{4}$/.test(year)){
    if(btn)btn.disabled=true;
    try{
      const result=await loadYearInBackground(year);
      if(result&&result.ok)renderMonthlySummary();
    }finally{
      if(btn)btn.disabled=false;
    }
  }
}
function selectSummaryMonth(month){
  if(!/^\d{4}-\d{2}$/.test(month))return;
  document.getElementById("monthPicker").value=month;
  document.getElementById("yearPicker").value=month.slice(0,4);
  saveActiveMonth(month);
  renderAll();
  updateReadOnlyMode();
  window.scrollTo({top:0,behavior:"smooth"});
}

function xlsxXmlEscapeV196(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
function xlsxColNameV196(n){let s="";for(let x=n+1;x>0;x=Math.floor((x-1)/26))s=String.fromCharCode(65+(x-1)%26)+s;return s}
function crc32V196(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function u16V196(n){return new Uint8Array([n&255,(n>>>8)&255])}
function u32V196(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
function joinBytesV196(parts){const len=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(len);let o=0;parts.forEach(b=>{out.set(b,o);o+=b.length});return out}
function zipStoreV196(files){const te=new TextEncoder(),locals=[],centrals=[];let offset=0;for(const f of files){const name=te.encode(f.name),data=typeof f.data==="string"?te.encode(f.data):f.data,crc=crc32V196(data);const local=joinBytesV196([u32V196(0x04034b50),u16V196(20),u16V196(0),u16V196(0),u16V196(0),u16V196(0),u32V196(crc),u32V196(data.length),u32V196(data.length),u16V196(name.length),u16V196(0),name,data]);locals.push(local);centrals.push(joinBytesV196([u32V196(0x02014b50),u16V196(20),u16V196(20),u16V196(0),u16V196(0),u16V196(0),u16V196(0),u32V196(crc),u32V196(data.length),u32V196(data.length),u16V196(name.length),u16V196(0),u16V196(0),u16V196(0),u16V196(0),u32V196(0),u32V196(offset),name]));offset+=local.length}const central=joinBytesV196(centrals),body=joinBytesV196(locals);const end=joinBytesV196([u32V196(0x06054b50),u16V196(0),u16V196(0),u16V196(files.length),u16V196(files.length),u32V196(central.length),u32V196(body.length),u16V196(0)]);return joinBytesV196([body,central,end])}
function exportCSV(scope="month"){
  const selected=sortReportRows(dedupeRows(rows).filter(r=>(scope==="year"?sameYear(r.date):sameMonth(r.date))&&Number(r.amount)>0));
  const fairTotal=selected.filter(r=>r.type==="fair").reduce((sum,r)=>sum+Number(r.amount||0),0);
  const table=[["公司","日期","类别","地点/主播","营业额","佣金%","佣金金额"]];
  selected.forEach(r=>{const rate=r.type==="live"?getLiveHostRate(r.location,r.date):r.type==="fair"?getFairCommissionRate(fairTotal)*100:0;const commission=(r.type==="live"||r.type==="fair")?Number(r.amount||0)*rate/100:0;table.push([r.type==="live"?"Live":(companyNames[r.company]||r.company),r.date,r.type==="fair"?"Fair":r.type==="live"?"Live":"每日",r.location||"",Number(r.amount||0),rate?Number(rate.toFixed(2)):null,rate?Number(commission.toFixed(2)):null])});
  const widths=table[0].map((_,c)=>Math.min(40,Math.max(10,...table.map(row=>String(row[c]??"").length+2))));
  const cols=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("");
  const rowsXml=table.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{const ref=xlsxColNameV196(ci)+(ri+1);if(ri===0)return `<c r="${ref}" t="inlineStr" s="1"><is><t>${xlsxXmlEscapeV196(v)}</t></is></c>`;if((ci===4||ci===6)&&v!==null)return `<c r="${ref}" s="2"><v>${Number(v).toFixed(2)}</v></c>`;if(ci===5&&v!==null)return `<c r="${ref}" s="3"><v>${Number(v).toFixed(2)}</v></c>`;return `<c r="${ref}" t="inlineStr"><is><t>${xlsxXmlEscapeV196(v??"")}</t></is></c>`}).join("")}</row>`).join("");
  const sheetXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rowsXml}</sheetData></worksheet>`;
  const files=[
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sales" sheetId="1" r:id="rId1"/></sheets></workbook>`},
    {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/styles.xml",data:`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`},
    {name:"xl/worksheets/sheet1.xml",data:sheetXml}
  ];
  const blob=new Blob([zipStoreV196(files)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
}

bindDateControl("liveScheduleStart");
bindDateControl("liveScheduleEnd");

/* Live controls */
if(document.getElementById("liveDate")){
  setDateControl("liveDate",todayISO());
  bindDateControl("liveDate",updateLiveInputFromSelectedDate);
  document.getElementById("liveDate").addEventListener("change",()=>refreshProductLinkContextV210("live"));
}
if(document.getElementById("liveHost")){
  document.getElementById("liveHost").addEventListener("input",updateLiveInputFromSelectedDate);
  document.getElementById("liveHost").addEventListener("change",()=>refreshProductLinkContextV210("live"));
  document.getElementById("liveHost").addEventListener("blur",()=>{
    const input=document.getElementById("liveHost");
    const host=selectedLiveHost();
    input.value=host;
    if(host)saveLiveHost(host);
    updateLiveInputFromSelectedDate();
    refreshProductLinkContextV210("live");
  });
}

restoreLastLiveSession();

["commissionRate1","commissionRate2","commissionRate3"].forEach(id=>{
  const el=document.getElementById(id);
  if(el)el.addEventListener("input",markFairCommissionDraftDirty);
});
window.addEventListener("beforeunload",event=>{
  if(!(fairCommissionDraftDirty||liveCommissionDraftDirty))return;
  event.preventDefault();
  event.returnValue="";
});

// V7.1: Fair and Live commission settings are saved and reset independently.
function readFairCommissionInputs(){
  const rate1=Number(document.getElementById("commissionRate1").value);
  const rate2=Number(document.getElementById("commissionRate2").value);
  const rate3=Number(document.getElementById("commissionRate3").value);
  if(![rate1,rate2,rate3].every(v=>Number.isFinite(v)&&v>=0)){
    throw new Error("请输入正确的 Fair 佣金百分比");
  }
  return {rate1,rate2,rate3};
}

function readLiveCommissionInputs(){
  const liveHostRates={};
  const liveHosts={};
  collectLiveHosts().forEach(name=>{const key=normalizeLiveHostKey(name);if(key)liveHosts[key]=canonicalLiveHost(name)});
  document.querySelectorAll("[data-live-host-key]").forEach(input=>{
    const key=String(input.dataset.liveHostKey||"");
    const rate=Number(input.value);
    if(key&&Number.isFinite(rate)&&rate>=0)liveHostRates[key]=rate;
  });
  const liveRateSchedules=validateLiveRateSchedules(
    (getCommissionSettings().liveRateSchedules||[]).map(item=>({...item}))
  );
  return {liveHostRates,liveHosts,liveRateSchedules};
}

async function saveFairCommissionSettings(){
  const button=document.getElementById("saveFairCommissionBtn");
  const message=document.getElementById("fairCommissionSettingsMsg");
  try{
    const previous=getCommissionSettings();
    const fair=readFairCommissionInputs();
    const candidate=normalizeCommissionSettings({...previous,...fair});
    const unchanged=Number(previous.rate1)===Number(candidate.rate1)&&Number(previous.rate2)===Number(candidate.rate2)&&Number(previous.rate3)===Number(candidate.rate3);
    if(unchanged&&!fairCommissionDraftDirty){
      setSavedCommissionSnapshots(previous,{fair:true,live:false});
      updateFairCommissionDraftState();
      if(message){message.textContent="没有需要储存的更改";message.classList.remove("hidden");}
      return;
    }

    const settings=normalizeCommissionSettings({
      ...candidate,
      fairRevision:nextFairCommissionRevision(previous.fairRevision)
    });

    // V21.4: save locally immediately. Do not make the user wait for Apps Script.
    applyCommissionSettings(settings);
    setSavedCommissionSnapshots(settings,{fair:true,live:false});
    updateFairCommissionDraftState();
    if((systemState.closedMonths||[]).includes(selectedMonth())){
      systemState.commissionSnapshots={...(systemState.commissionSnapshots||{}),[selectedMonth()]:settings};
    }
    saveLocalDataCache(settings);
    renderDashboard();
    renderTable();

    if(button){button.disabled=false;button.textContent="💾 储存 Fair 佣金";}
    if(message){message.textContent="本机已储存，云端同步中…";message.classList.remove("hidden");}
    setSync("Fair 佣金本机已更新，云端同步中...");

    saveFairCommissionSettingsToSheet(settings,selectedMonth())
      .then(saved=>{
        const confirmed=normalizeCommissionSettings(saved||settings);
        const local=getCommissionSettings();
        if(Number(confirmed.fairRevision||0)<Number(local.fairRevision||0))return;
        applyCommissionSettings(confirmed);
        if((systemState.closedMonths||[]).includes(selectedMonth())){
          systemState.commissionSnapshots={...(systemState.commissionSnapshots||{}),[selectedMonth()]:confirmed};
        }
        setSavedCommissionSnapshots(confirmed,{fair:true,live:false});
        updateFairCommissionDraftState();
        saveLocalDataCache(confirmed);
        renderDashboard();
        renderTable();
        if(message){message.textContent="✅ Fair 佣金已同步";message.classList.remove("hidden");}
        setSync("已同步",true);
      })
      .catch(error=>{
        console.warn("Fair commission cloud sync delayed",error);
        if(message){message.textContent="本机已储存，云端稍后重试";message.classList.remove("hidden");}
        fairCommissionDraftDirty=false;
        queueFairCommissionRetry(settings,selectedMonth());
        setSync("Fair 佣金云端稍后重试",false,true);
      });
  }catch(error){
    if(message){message.textContent=error.message||"Fair 佣金储存失败";message.classList.remove("hidden");}
    if(button){button.disabled=false;button.textContent="💾 储存 Fair 佣金";}
  }
}

async function saveLiveCommissionSettings(){
  const button=document.getElementById("saveLiveCommissionBtn");
  const message=document.getElementById("liveCommissionSettingsMsg");

  try{
    const previous=getCommissionSettings();
    const pendingStart=String(document.getElementById("liveScheduleStart")?.value||"");
    const pendingEnd=String(document.getElementById("liveScheduleEnd")?.value||"");
    const pendingRate=String(document.getElementById("liveScheduleRate")?.value||"").trim();
    if(pendingStart||pendingEnd||pendingRate){
      if(!submitLiveRateSchedule())return;
    }
    const live=readLiveCommissionInputs();
    const candidate=normalizeCommissionSettings({...previous,...live});
    const comparable=x=>JSON.stringify({liveHostRates:x.liveHostRates||{},liveHosts:x.liveHosts||{},inactiveLiveHosts:x.inactiveLiveHosts||{},liveRateSchedules:x.liveRateSchedules||[]});
    // V21.4: deleting the last special commission rule leaves candidate and
    // previous structurally identical because the delete was already applied
    // locally.  A dirty draft must still be written to cloud so [] overwrites
    // the old month snapshot instead of letting the deleted rule return.
    if(comparable(candidate)===comparable(previous) && !liveCommissionDraftDirty){
      setSavedCommissionSnapshots(previous,{fair:false,live:true});
      updateLiveCommissionDraftState();
      if(message){message.textContent="没有需要储存的更改";message.classList.remove("hidden");}
      return;
    }
    const settings=normalizeCommissionSettings({...candidate,liveRevision:nextLiveCommissionRevision(previous.liveRevision)});

    applyCommissionSettings(settings);
    setSavedCommissionSnapshots(settings,{fair:false,live:true});
    updateLiveCommissionDraftState();
    renderLiveHostCommissionSettings();
    renderLiveRateSchedules();
    renderDashboard();
    renderTable();
    renderLiveMonthlyList();
    renderLiveDailySummary();
    saveLocalDataCache(settings);

    if(button){
      button.disabled=false;
      button.textContent="💾 储存直播佣金制度";
    }
    if(message){
      message.textContent="本机已储存，云端同步中…";
      message.classList.remove("hidden");
    }
    setSync("Live 佣金本机已更新，云端同步中...");

    saveLiveCommissionSettingsToSheet(settings,commissionConfigMonth())
      .then(saved=>{
        const confirmed=normalizeCommissionSettings(saved||settings);
        const local=getCommissionSettings();
        if(Number(confirmed.liveRevision||0)<Number(local.liveRevision||0))return;
        applyCommissionSettings(confirmed);
        setSavedCommissionSnapshots(confirmed,{fair:false,live:true});
        updateLiveCommissionDraftState();
        saveLocalDataCache(confirmed);
        renderLiveHostCommissionSettings();
        renderLiveRateSchedules();
        renderDashboard();
        renderTable();
        renderLiveMonthlyList();
        if(message){
          message.textContent="✅ Live 佣金制度已同步";
          message.classList.remove("hidden");
        }
        setSync("已同步",true);
      })
      .catch(error=>{
        console.warn("Live commission cloud sync delayed",error);
        if(message){
          message.textContent="本机已储存，云端稍后重试";
          message.classList.remove("hidden");
        }
        liveCommissionDraftDirty=true;
        queueLiveCommissionRetry(settings,commissionConfigMonth());
        setSync("Live 佣金云端稍后重试",false,true);
      });
  }catch(error){
    if(message){
      message.textContent=error.message||"Live 佣金制度储存失败";
      message.classList.remove("hidden");
    }
    if(button){
      button.disabled=false;
      button.textContent="💾 储存直播佣金制度";
    }
  }
}

async function resetFairCommissionSettings(){
  if(!confirm("确定只恢复 Fair 默认佣金？\n\nRM50,000 以下：6%\nRM50,000 以上：7%\nRM100,000 以上：8%\n\nLive 与各主播佣金不会改变。"))return;

  const previous=getCommissionSettings();
  const settings=normalizeCommissionSettings({
    ...previous,
    rate1:6,rate2:7,rate3:8,
    fairRevision:nextFairCommissionRevision(previous.fairRevision)
  });

  applyCommissionSettings(settings);
  setSavedCommissionSnapshots(settings,{fair:true,live:false});
  updateFairCommissionDraftState();
  if((systemState.closedMonths||[]).includes(selectedMonth())){
    systemState.commissionSnapshots={...(systemState.commissionSnapshots||{}),[selectedMonth()]:settings};
  }
  saveLocalDataCache(settings);
  loadCommissionSettingsForm();
  renderDashboard();
  renderTable();
  setSync("Fair 默认佣金本机已更新，云端同步中...");
  alert("Fair 佣金已恢复默认。本机已生效，云端正在后台同步。");

  saveFairCommissionSettingsToSheet(settings,selectedMonth())
    .then(saved=>{
      const confirmed=normalizeCommissionSettings(saved||settings);
      const local=getCommissionSettings();
      if(Number(confirmed.fairRevision||0)<Number(local.fairRevision||0))return;
      applyCommissionSettings(confirmed);
      setSavedCommissionSnapshots(confirmed,{fair:true,live:false});
      updateFairCommissionDraftState();
      saveLocalDataCache(confirmed);
      loadCommissionSettingsForm();
      renderDashboard();
      renderTable();
      setSync("已同步",true);
    })
    .catch(error=>{
      console.warn("Fair reset cloud sync delayed",error);
      queueFairCommissionRetry(settings,selectedMonth());
      setSync("Fair 默认佣金云端稍后重试",false,true);
    });
}



/* ================= V21.4 Backup / Restore ================= */
function getBackupPayload(){
  return{
    system:"Lover Legend Sales System",
    version:"2140",
    createdAt:new Date().toISOString(),
    rows:dedupeRows(rows),
    commissionSettings:getCommissionSettings(),
    accessSettings:typeof getAccessPasswordSettings==="function"?getAccessPasswordSettings():null,
    closedMonths:sanitizeClosedMonthsClientV197(systemState.closedMonths,systemState.currentMonth),
    commissionSnapshots:{...(systemState.commissionSnapshots||{})},
    currentMonth:systemState.currentMonth,
    fairLocations:getSavedFairLocations(),
    liveHosts:typeof getSavedLiveHosts==="function"?getSavedLiveHosts():[]
  };
}
async function backupAllData(){
  try{
    const payload=getBackupPayload();
    try{payload.productLinks=await loadAllSalesProductLinksV203()}catch(e){console.warn("Product links backup unavailable",e);payload.productLinks=[]}
    const stamp=new Date().toISOString().replace(/[:T]/g,"-").slice(0,19);
    downloadFile(`Lover_Legend_Sales_V20_3_Backup_${stamp}.json`,JSON.stringify(payload,null,2),"application/json;charset=utf-8");
  }catch(e){
    console.error("Backup failed",e);
    alert("Backup 失败："+(e&&e.message?e.message:e));
  }
}
async function restoreBackupFile(file){
  let payload;
  try{payload=JSON.parse(await file.text())}catch(e){alert("Backup 文件无法读取或不是有效 JSON。");return}
  if(!payload||!Array.isArray(payload.rows)||!payload.commissionSettings){alert("这不是有效的 Lover Legend Sales Backup。");return}
  payload.closedMonths=sanitizeClosedMonthsClientV197(payload.closedMonths,payload.currentMonth||monthISO());
  const ok=confirm(`准备 Restore 完整备份。\n\n备份版本：${payload.version||"未知"}\n备份时间：${payload.createdAt||"未知"}\n营业记录：${payload.rows.length} 笔\n\n恢复将覆盖 Google Sheet 目前所有月份营业资料、Fair、Live、Commission 与结算状态。\n此操作无法自动撤销。\n\n确定继续？`);
  if(!ok)return;

  try{
    setSync("正在恢复 Backup...");
    const current=getCommissionSettings();
    payload={...payload};
    payload.commissionSettings=normalizeCommissionSettings({
      ...payload.commissionSettings,
      fairRevision:nextFairCommissionRevision(Math.max(Number(current.fairRevision||0),Number(payload.commissionSettings.fairRevision||0))),
      liveRevision:nextLiveCommissionRevision(Math.max(Number(current.liveRevision||0),Number(payload.commissionSettings.liveRevision||0)))
    });

    await restoreBackupToSheet(payload);
    localStorage.setItem("lover_fair_locations",JSON.stringify(payload.fairLocations||[]));
    if(payload.liveHosts)localStorage.setItem("lover_live_hosts",JSON.stringify(payload.liveHosts));

    // Restore is authoritative: clear local draft state/cache before reading cloud truth.
    fairCommissionDraftDirty=false;
    liveCommissionDraftDirty=false;
    localStorage.setItem("lover_commission_settings_cache",JSON.stringify(payload.commissionSettings));
    applyCommissionSettings(payload.commissionSettings);
    setSavedCommissionSnapshots(payload.commissionSettings);

    await loadFromSheet({force:true});
    loadCommissionSettingsForm();
    renderLiveHostCommissionSettings();
    document.getElementById("monthPicker").value=monthISO();
    document.getElementById("yearPicker").value=monthISO().slice(0,4);
    renderAll();
    updateReadOnlyMode();
    setSync("Backup 已恢复",true);
    alert("Restore 已完成。Google Sheet、本机 Home 与 More 佣金设置已统一重新载入。");
  }catch(e){
    alert("Restore 失败："+e.message);
    setSync("Restore 失败",false,true);
  }
}
const restoreInput=document.getElementById("restoreFile");if(restoreInput)restoreInput.addEventListener("change",async e=>{const file=e.target.files&&e.target.files[0];e.target.value="";if(file)await restoreBackupFile(file)});
let lastObservedSystemMonth=monthISO();setInterval(()=>{const nowMonth=monthISO();if(nowMonth!==lastObservedSystemMonth){lastObservedSystemMonth=nowMonth;systemState.currentMonth=nowMonth;document.getElementById("monthPicker").value=nowMonth;document.getElementById("yearPicker").value=nowMonth.slice(0,4);renderAll();updateReadOnlyMode();loadFromSheet({force:true})}},60000);
