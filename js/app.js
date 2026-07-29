function getSavedFairLocations(){try{return JSON.parse(localStorage.getItem("lover_fair_locations")||"[]")}catch(e){return[]}}
function saveFairLocation(location){const loc=canonicalLocation(location);if(!loc)return;const list=getSavedFairLocations();if(!list.some(x=>canonicalLocation(x)===loc))list.push(loc);list.sort();localStorage.setItem("lover_fair_locations",JSON.stringify(list));renderFairLocationOptions()}
function collectFairLocations(){const fromRows=[...new Set(rows.filter(r=>r.type==="fair").map(r=>canonicalLocation(r.location)).filter(Boolean))],fromStorage=getSavedFairLocations(),merged=[];[...fromRows,...fromStorage].forEach(x=>{const loc=canonicalLocation(x);if(loc&&!merged.some(y=>canonicalLocation(y)===loc))merged.push(loc)});merged.sort();localStorage.setItem("lover_fair_locations",JSON.stringify(merged));return merged}
function renderFairLocationOptions(){const el=document.getElementById("fairLocationListOptions");if(el)el.innerHTML=collectFairLocations().map(loc=>`<option value="${loc}"></option>`).join("")}
function getSavedLiveHosts(){try{return JSON.parse(localStorage.getItem("lover_live_hosts")||"[]")}catch(e){return[]}}
function collectLiveHosts(){const merged=[];[...rows.filter(r=>r.type==="live").map(r=>String(r.location||"").trim()).filter(Boolean),...getSavedLiveHosts()].forEach(n=>{const k=normHost(n);if(k&&!merged.some(x=>normHost(x)===k))merged.push(n)});merged.sort((a,b)=>a.localeCompare(b));localStorage.setItem("lover_live_hosts",JSON.stringify(merged));return merged}
function canonicalHost(value){const raw=String(value||"").trim().replace(/\s+/g," ");if(!raw)return"";const found=collectLiveHosts().find(n=>normHost(n)===normHost(raw));return found||formatHostName(raw)}
function saveLiveHost(value){const host=canonicalHost(value);if(!host)return;const list=getSavedLiveHosts();if(!list.some(x=>normHost(x)===normHost(host)))list.push(host);list.sort((a,b)=>a.localeCompare(b));localStorage.setItem("lover_live_hosts",JSON.stringify(list));renderLiveHostOptions();renderLiveHostCommissionSettings()}
function renderLiveHostOptions(){const el=document.getElementById("liveHostListOptions");if(el)el.innerHTML=collectLiveHosts().map(n=>`<option value="${n}"></option>`).join("")}
function safeAmount(value){
  const n=Number(String(value??"").replace(/,/g,"").trim());
  return Number.isFinite(n)?n:0;
}

function safeFormatAmount(value){
  return formatAmount(safeAmount(value));
}

const LIVE_SESSION_KEY="lover_live_session_v74";
const LIVE_DELETE_TOMBSTONES_KEY="lover_live_delete_tombstones_v74";
let commissionSyncInProgress=false;
let pendingCommissionSettings=null;
function saveLiveSession(){const host=document.getElementById("liveHost")?.value||"",date=document.getElementById("liveDate")?.value||todayISO(),sales=safeAmount(document.getElementById("liveSales")?.value);localStorage.setItem(LIVE_SESSION_KEY,JSON.stringify({host,date,sales}))}
function restoreLiveSession(){try{const s=JSON.parse(localStorage.getItem(LIVE_SESSION_KEY)||"null");if(!s)return false;if(s.host)document.getElementById("liveHost").value=canonicalHost(s.host);if(s.date)setDateControl("liveDate",s.date);if(s.sales!==undefined)document.getElementById("liveSales").value=safeFormatAmount(s.sales);return true}catch(e){return false}}
function getLiveDeleteTombstones(){try{return JSON.parse(localStorage.getItem(LIVE_DELETE_TOMBSTONES_KEY)||"{}")||{}}catch(e){return{}}}
function addLiveDeleteTombstone(date,host){const m=getLiveDeleteTombstones();m[`${date}|${normHost(host)}`]=Date.now();localStorage.setItem(LIVE_DELETE_TOMBSTONES_KEY,JSON.stringify(m))}
function clearLiveDeleteTombstone(date,host){const m=getLiveDeleteTombstones();delete m[`${date}|${normHost(host)}`];localStorage.setItem(LIVE_DELETE_TOMBSTONES_KEY,JSON.stringify(m))}
function applyLiveDeleteTombstones(list){const m=getLiveDeleteTombstones(),now=Date.now(),max=604800000;Object.keys(m).forEach(k=>{if(now-Number(m[k]||0)>max)delete m[k]});localStorage.setItem(LIVE_DELETE_TOMBSTONES_KEY,JSON.stringify(m));return list.filter(r=>r.type!=="live"||!m[`${r.date}|${normHost(r.location)}`])}
function refreshLiveViewsImmediately(){rows=dedupeRows(applyLiveDeleteTombstones(rows));renderLiveDailyList();renderLiveHostList();renderLiveHostOptions();renderLiveHostCommissionSettings();renderTable();const lm=totalBy("live","","month"),ly=totalBy("live","","year"),me=document.getElementById("liveMonthTotal"),ye=document.getElementById("liveYearTotal");if(me)me.textContent=money(lm);if(ye)ye.textContent=money(ly);renderLiveCommission();const mg=document.getElementById("monthGrandTotal");if(mg)mg.textContent=money(totalBy("daily","balakong","month")+totalBy("daily","belimbing","month")+totalBy("fair","","month")+lm);const yg=document.getElementById("yearGrandTotal");if(yg)yg.textContent=money(totalBy("daily","balakong","year")+totalBy("daily","belimbing","year")+totalBy("fair","","year")+ly);saveLocalDataCache()}
function applyCommissionSettingsImmediately(settings,options={}){
  commissionSettings=normalizeCommissionSettings(settings);

  localStorage.setItem(
    "lover_commission_settings_cache",
    JSON.stringify(commissionSettings)
  );

  const rate1=document.getElementById("commissionRate1");
  const rate2=document.getElementById("commissionRate2");
  const rate3=document.getElementById("commissionRate3");
  const liveRate=document.getElementById("liveCommissionRate");

  if(rate1)rate1.value=commissionSettings.rate1;
  if(rate2)rate2.value=commissionSettings.rate2;
  if(rate3)rate3.value=commissionSettings.rate3;
  if(liveRate)liveRate.value=commissionSettings.liveRate;

  document.querySelectorAll(".live-host-rate-input").forEach(input=>{
    const key=normHost(input.dataset.hostKey);
    const custom=Number(commissionSettings.liveHostRates?.[key]);
    input.value=Number.isFinite(custom)
      ?custom
      :commissionSettings.liveRate;
  });

  if(options.refreshHostList===true){
    renderLiveHostCommissionSettings();
  }

  renderDashboard();
  saveLocalDataCache(commissionSettings);
}
function selectedMonth(){return document.getElementById("monthPicker").value}
function selectedYear(){return document.getElementById("yearPicker").value}
function sameMonth(date){return sameMonthDisplay(date,selectedMonth())}
function sameYear(date){return sameYearDisplay(date,selectedYear())}
function showPage(name,el){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.getElementById("page-"+name).classList.add("active");document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));el.classList.add("active")}
function rowKey(r){const l=r.type==="live"?normHost(r.location||""):canonicalLocation(r.location||"");return[r.type,r.date,r.company,l].join("|")}
function dedupeRows(list){const m=new Map();list.forEach(r=>{const k=rowKey(r),old=m.get(k);if(!old||String(r.updatedAt||"")>=String(old.updatedAt||""))m.set(k,r)});return [...m.values()]}
function upsertLocalRow(n){rows=dedupeRows([...rows,n])}
function getDailyAmount(d,c){const f=rows.find(r=>r.type==="daily"&&r.date===d&&r.company===c);return f?Number(f.amount||0):0}
function updateDailyInputFromSelectedDate(){const d=isoToDisplay(document.getElementById("saleDate").value),c=document.getElementById("company").value,a=getDailyAmount(d,c);document.getElementById("dailySales").value=formatAmount(a);document.getElementById("salesDateResult").textContent=`${companyNames[c]}｜${d}｜${money(a)}`}
function totalBy(type,company="",mode="month"){return rows.filter(r=>r.type===type).filter(r=>company?r.company===company:true).filter(r=>mode==="today"?r.date===isoToDisplay(todayISO()):mode==="month"?sameMonth(r.date):mode==="year"?sameYear(r.date):true).reduce((s,r)=>s+Number(r.amount||0),0)}
function fairLocationsThisMonth(){return [...new Set(rows.filter(r=>r.type==="fair"&&sameMonth(r.date)&&Number(r.amount)>0).map(r=>canonicalLocation(r.location||"Fair")))].sort()}
function fairByLocation(){const g={};rows.filter(r=>r.type==="fair"&&sameMonth(r.date)&&Number(r.amount)>0).forEach(r=>{const l=canonicalLocation(r.location||"Fair");g[l]=(g[l]||0)+Number(r.amount||0)});return g}
function renderFairLocationList(){const g=fairByLocation(),locs=Object.keys(g).sort(),c=document.getElementById("fairLocationList");if(!locs.length){c.innerHTML='<div class="sub">这个月份还没有 Fair 记录</div>';return}c.innerHTML='<div class="fair-location-grid">'+locs.map(l=>`<div class="fair-location-card"><div class="fair-location-title">${l}</div><div class="fair-location-row"><span>营业额</span><b>${money(g[l])}</b></div><div class="fair-location-row"><span>佣金 6%</span><b>${money(g[l]*0.06)}</b></div></div>`).join("")+'</div>'}
function hasTodayDailyRecord(company){
  const today=isoToDisplay(todayISO());
  return rows.some(r=>
    r.type==="daily" &&
    r.company===company &&
    r.date===today
  );
}

function renderTodayCompanyStatus(){
  const balakongRecorded=hasTodayDailyRecord("balakong");
  const belimbingRecorded=hasTodayDailyRecord("belimbing");
  const warning=document.getElementById("todayWarning");
  const done=document.getElementById("todayDone");

  if(!warning||!done)return;

  if(balakongRecorded&&belimbingRecorded){
    warning.classList.add("hidden");
    done.classList.remove("hidden");
    done.innerHTML=
      "🟢 Balakong 今天已记录<br>"+
      "🟢 Belimbing 今天已记录";
    return;
  } 

  done.classList.add("hidden");
  warning.classList.remove("hidden");

  warning.innerHTML=
    (balakongRecorded
      ?"🟢 Balakong 今天已记录"
      :"🔴 Balakong 今天还没有记录")+
    "<br>"+
    (belimbingRecorded
      ?"🟢 Belimbing 今天已记录"
      :"🔴 Belimbing 今天还没有记录");
}

const DEFAULT_COMMISSION_SETTINGS={
  rate1:6,
  rate2:7,
  rate3:8,
  liveRate:10,
  liveHostRates:{}
};

let commissionSettings={...DEFAULT_COMMISSION_SETTINGS};

function normalizeCommissionSettings(settings){
  const source=settings||{};
  const rate1=Number(source.rate1);
  const rate2=Number(source.rate2);
  const rate3=Number(source.rate3);
  const liveRate=Number(source.liveRate);
  const liveHostRates={};

  Object.entries(source.liveHostRates||{}).forEach(([key,value])=>{
    const rate=Number(value);
    const normalizedKey=normHost(key);
    if(normalizedKey&&Number.isFinite(rate)&&rate>=0){
      liveHostRates[normalizedKey]=rate;
    }
  });

  if(
    !Number.isFinite(rate1)||
    !Number.isFinite(rate2)||
    !Number.isFinite(rate3)||
    !Number.isFinite(liveRate)||
    rate1<0||rate2<0||rate3<0||liveRate<0
  ){
    return{
      ...DEFAULT_COMMISSION_SETTINGS,
      liveHostRates:{}
    };
  }

  return{rate1,rate2,rate3,liveRate,liveHostRates};
}

function getCommissionSettings(){
  return{...commissionSettings};
}

function applyCommissionSettings(settings){commissionSettings=normalizeCommissionSettings(commissionSyncInProgress&&pendingCommissionSettings?pendingCommissionSettings:settings);localStorage.setItem("lover_commission_settings_cache",JSON.stringify(commissionSettings));loadCommissionSettingsForm();if(typeof renderDashboard==="function")renderDashboard()}

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

function getLiveHostCommissionRate(host){
  const settings=getCommissionSettings();
  const key=normHost(host);
  const custom=Number(settings.liveHostRates?.[key]);
  return Number.isFinite(custom)?custom:Number(settings.liveRate||10);
}

function renderLiveHostCommissionSettings(){
  const container=document.getElementById("liveHostCommissionList");
  if(!container)return;

  const settings=getCommissionSettings();
  const hosts=collectLiveHosts();

  if(!hosts.length){
    container.innerHTML='<div class="sub">还没有主播记录；新增主播后会自动出现在这里。</div>';
    return;
  }

  container.innerHTML=hosts.map(host=>{
    const key=normHost(host);
    const rate=getLiveHostCommissionRate(host);

    return`
      <div class="live-host-commission-row">
        <div class="live-host-commission-name">${host}</div>
        <div class="live-host-commission-input">
          <input
            type="number"
            class="live-host-rate-input"
            data-host-key="${key}"
            min="0"
            max="100"
            step="0.1"
            inputmode="decimal"
            value="${rate}"
          >
          <span>%</span>
        </div>
      </div>
    `;
  }).join("");
}

function loadCommissionSettingsForm(){
  const settings=getCommissionSettings();
  const rate1=document.getElementById("commissionRate1");
  const rate2=document.getElementById("commissionRate2");
  const rate3=document.getElementById("commissionRate3");
  const liveRate=document.getElementById("liveCommissionRate");
  if(rate1)rate1.value=settings.rate1;
  if(rate2)rate2.value=settings.rate2;
  if(rate3)rate3.value=settings.rate3;
  if(liveRate)liveRate.value=settings.liveRate;
  renderLiveHostCommissionSettings();
}

async function saveCommissionSettings(){
  const rate1=Number(document.getElementById("commissionRate1").value);
  const rate2=Number(document.getElementById("commissionRate2").value);
  const rate3=Number(document.getElementById("commissionRate3").value);

  if(
    !Number.isFinite(rate1)||
    !Number.isFinite(rate2)||
    !Number.isFinite(rate3)||
    rate1<0||rate2<0||rate3<0
  ){
    alert("请输入正确的 Fair 佣金百分比");
    return;
  }

  const previous=getCommissionSettings();
  const next={...previous,rate1,rate2,rate3};

  commissionSyncInProgress=true;
  pendingCommissionSettings=next;

  applyCommissionSettingsImmediately(next);
  showTempMsg("commissionSettingsMsg");
  setSync("Fair 佣金已更新，后台同步中...");

  try{
    const saved=await saveCommissionSettingsToSheet(next);

    commissionSyncInProgress=false;
    pendingCommissionSettings=null;

    applyCommissionSettingsImmediately(saved||next);
    setSync("已同步",true);
  }catch(e){
    commissionSyncInProgress=false;
    pendingCommissionSettings=null;

    applyCommissionSettingsImmediately(previous);
    alert("Fair 佣金储存失败，已恢复原设置："+e.message);
    setSync("Fair 佣金同步失败",false,true);
  }
}
async function resetCommissionSettings(){
  const ok=confirm(
    "确定恢复默认佣金？\n\n"+
    "RM50,000 以下：6%\n"+
    "RM50,000 以上：7%\n"+
    "RM100,000 以上：8%"
  );
  if(!ok)return;

  try{
    setSync("正在恢复默认佣金...");
    const saved=await saveCommissionSettingsToSheet({rate1:6,rate2:7,rate3:8,liveRate:getCommissionSettings().liveRate});
    applyCommissionSettings(saved||{rate1:6,rate2:7,rate3:8,liveRate:getCommissionSettings().liveRate});
    showTempMsg("commissionSettingsMsg");
    setSync("已同步",true);
  }catch(e){
    alert("恢复默认值失败："+e.message);
    setSync("佣金设置同步失败",false,true);
  }
}

async function saveLiveCommissionSetting(){const liveRate=Number(document.getElementById("liveCommissionRate").value);if(!Number.isFinite(liveRate)||liveRate<0){alert("请输入正确的默认 Live 佣金百分比");return}const liveHostRates={};document.querySelectorAll(".live-host-rate-input").forEach(input=>{const key=normHost(input.dataset.hostKey),rate=Number(input.value);if(key&&Number.isFinite(rate)&&rate>=0)liveHostRates[key]=rate});const previous=getCommissionSettings(),next={...previous,liveRate,liveHostRates};commissionSyncInProgress=true;pendingCommissionSettings=next;applyCommissionSettingsImmediately(next,{refreshForm:false});showTempMsg("liveCommissionSettingsMsg");setSync("Live 佣金已更新，后台同步中...");try{const saved=await saveCommissionSettingsToSheet(next);commissionSyncInProgress=false;pendingCommissionSettings=null;applyCommissionSettingsImmediately(saved||next);setSync("已同步",true)}catch(e){commissionSyncInProgress=false;pendingCommissionSettings=null;applyCommissionSettingsImmediately(previous);alert("Live 佣金储存失败，已恢复原设置："+e.message);setSync("Live 佣金同步失败",false,true)}}
async function resetLiveCommissionSetting(){
  if(!confirm("确定所有主播恢复默认佣金 10%？"))return;

  const previous=getCommissionSettings();
  const next={
    ...previous,
    liveRate:10,
    liveHostRates:{}
  };

  commissionSyncInProgress=true;
  pendingCommissionSettings=next;

  // 所有输入框立即显示 10，不等待云端。
  applyCommissionSettingsImmediately(next);
  showTempMsg("liveCommissionSettingsMsg");
  setSync("已恢复默认 10%，后台同步中...");

  try{
    const saved=await saveCommissionSettingsToSheet(next);

    commissionSyncInProgress=false;
    pendingCommissionSettings=null;

    applyCommissionSettingsImmediately(saved||next);
    setSync("已同步",true);
  }catch(e){
    commissionSyncInProgress=false;
    pendingCommissionSettings=null;

    applyCommissionSettingsImmediately(previous);
    alert("恢复默认佣金失败，已恢复原设置："+e.message);
    setSync("Live 佣金同步失败",false,true);
  }
}
function renderLiveCommission(){
  const label=document.getElementById("liveCommissionLabel");
  const value=document.getElementById("liveCommissionTotal");

  const commission=Object.entries(liveByHost()).reduce(
    (sum,[host,sales])=>sum+(Number(sales||0)*getLiveHostCommissionRate(host)/100),
    0
  );

  if(label)label.textContent="Live 本月总佣金";
  if(value)value.textContent=money(commission);
}
function getFairCommissionRate(total){
  const amount=Number(total||0);
  const settings=getCommissionSettings();

  if(amount>=100000)return settings.rate3/100;
  if(amount>=50000)return settings.rate2/100;
  return settings.rate1/100;
}

function renderFairCommission(total){
  const amount=Number(total||0);
  const settings=getCommissionSettings();
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

function liveByHost(){
  if(isLiveMonthClosed(selectedMonth())){
    return{};
  }

  const grouped={};

  rows
    .filter(r=>
      r.type==="live"&&
      sameMonth(r.date)&&
      safeAmount(r.amount)>0
    )
    .forEach(r=>{
      const host=canonicalHost(r.location||"主播");

      grouped[host]=
        (grouped[host]||0)+
        safeAmount(r.amount);
    });

  return grouped;
}

function renderLiveHostList(){
  const container=document.getElementById("liveHostList");
  if(!container)return;

  const grouped=liveByHost();
  const hosts=Object.keys(grouped).sort((a,b)=>a.localeCompare(b));

  if(!hosts.length){
    container.innerHTML='<div class="sub">这个月份还没有 Live 记录</div>';
    return;
  }

  container.innerHTML='<div class="live-host-grid">'+hosts.map(host=>{
    const rate=getLiveHostCommissionRate(host);
    const sales=Number(grouped[host]||0);

    return`
      <div class="live-host-card">
        <div class="live-host-title">${host}</div>
        <div class="fair-location-row"><span>销售额</span><b>${money(sales)}</b></div>
        <div class="fair-location-row"><span>佣金 ${rate}%</span><b>${money(sales*rate/100)}</b></div>
      </div>
    `;
  }).join("")+'</div>';
}

function getLiveAmount(d,h){
  const found=rows.find(r=>
    r.type==="live"&&
    r.date===d&&
    normHost(r.location)===normHost(h)
  );

  return found?safeAmount(found.amount):0;
}

function updateLiveInputFromSelectedDate(options={}){
  const date=isoToDisplay(
    document.getElementById("liveDate").value
  );

  const host=canonicalHost(
    document.getElementById("liveHost").value
  );

  const amount=host
    ?getLiveAmount(date,host)
    :0;

  if(options.preserveTyped!==true){
    document.getElementById("liveSales").value=
      safeFormatAmount(amount);
  }

  document.getElementById("liveDateResult").textContent=
    host
      ?`${host}｜${date}｜${money(amount)}`
      :`请选择主播｜${date}`;

  renderLiveDailyList();
}

const LIVE_CLOSED_MONTHS_KEY="lover_live_closed_months_v75";

function getClosedLiveMonths(){
  try{
    return JSON.parse(
      localStorage.getItem(LIVE_CLOSED_MONTHS_KEY)||"[]"
    )||[];
  }catch(e){
    return[];
  }
}

function isLiveMonthClosed(month){
  return getClosedLiveMonths().includes(month);
}

function markLiveMonthClosed(month){
  const months=getClosedLiveMonths();

  if(!months.includes(month)){
    months.push(month);
    months.sort();

    localStorage.setItem(
      LIVE_CLOSED_MONTHS_KEY,
      JSON.stringify(months)
    );
  }
}

function clearLiveMonthClosed(month){
  const months=getClosedLiveMonths()
    .filter(item=>item!==month);

  localStorage.setItem(
    LIVE_CLOSED_MONTHS_KEY,
    JSON.stringify(months)
  );
}

function getSelectedHistoricalLiveQuery(){
  const host=canonicalHost(
    document.getElementById("liveHost")?.value||""
  );

  const iso=document.getElementById("liveDate")?.value||"";

  if(!host||!iso)return null;

  const month=iso.slice(0,7);

  if(!isLiveMonthClosed(month))return null;

  return{
    host,
    date:isoToDisplay(iso),
    month
  };
}

function renderLiveDailyList(){
  const container=document.getElementById("liveDailyList");
  const totalEl=document.getElementById("liveAllHostsTotal");

  if(!container||!totalEl)return;

  const historical=getSelectedHistoricalLiveQuery();

  if(historical){
    const record=rows.find(r=>
      r.type==="live"&&
      r.date===historical.date&&
      normHost(r.location)===normHost(historical.host)&&
      safeAmount(r.amount)>0
    );

    container.innerHTML=record
      ?`<div class="live-daily-row">
          <span>${canonicalHost(record.location)}</span>
          <span>${record.date}</span>
          <b>${money(record.amount)}</b>
        </div>`
      :'<div class="sub">这个主播在所选日期没有记录。</div>';

    totalEl.textContent=record
      ?money(record.amount)
      :"0.00";

    return;
  }

  if(isLiveMonthClosed(selectedMonth())){
    container.innerHTML=
      '<div class="sub">这个月份已经结算，Live 列表已隐藏。</div>';

    totalEl.textContent="0.00";
    return;
  }

  const records=rows
    .filter(r=>
      r.type==="live"&&
      sameMonth(r.date)&&
      safeAmount(r.amount)>0
    )
    .sort((a,b)=>
      canonicalHost(a.location).localeCompare(
        canonicalHost(b.location),
        undefined,
        {sensitivity:"base"}
      )||
      displayToISO(a.date).localeCompare(
        displayToISO(b.date)
      )
    );

  container.innerHTML=records.length
    ?records.map(r=>`
      <div class="live-daily-row">
        <span>${canonicalHost(r.location)}</span>
        <span>${r.date}</span>
        <b>${money(r.amount)}</b>
      </div>
    `).join("")
    :'<div class="sub">这个月份还没有 Live 销售记录</div>';

  totalEl.textContent=money(
    records.reduce(
      (sum,r)=>sum+safeAmount(r.amount),
      0
    )
  );
}

async function saveLiveSales(){
  const host=canonicalHost(
    document.getElementById("liveHost").value
  );

  const date=isoToDisplay(
    document.getElementById("liveDate").value
  );

  const amount=safeAmount(
    document.getElementById("liveSales").value
  );

  if(!host){
    alert("请输入主播名字");
    return;
  }

  if(!date){
    alert("请选择日期");
    return;
  }

  document.getElementById("liveHost").value=host;
  document.getElementById("liveSales").value=
    safeFormatAmount(amount);

  saveLiveHost(host);

  const month=displayToISO(date).slice(0,7);
  clearLiveMonthClosed(month);

  const now=new Date().toISOString();

  const row={
    type:"live",
    date,
    company:"live",
    location:host,
    amount,
    updatedAt:now,
    clientUpdatedAt:now
  };

  if(amount<=0){
    addLiveDeleteTombstone(date,host);

    rows=rows.filter(r=>!(
      r.type==="live"&&
      r.date===date&&
      normHost(r.location)===normHost(host)
    ));
  }else{
    clearLiveDeleteTombstone(date,host);
    upsertLocalRow(row);
  }

  addPendingRow(row);
  saveLiveSession();

  refreshLiveViewsImmediately();
  updateLiveInputFromSelectedDate();
  showTempMsg("liveSaveMsg");
  setSync("已储存，后台同步中...");

  try{
    const saved=await saveLiveToSheet(
      date,
      host,
      amount,
      now
    );

    if(saved&&safeAmount(saved.amount)<=0){
      rows=rows.filter(r=>!(
        r.type==="live"&&
        r.date===date&&
        normHost(r.location)===normHost(host)
      ));

      clearLiveDeleteTombstone(date,host);
    }else if(saved){
      clearLiveDeleteTombstone(date,host);
      upsertLocalRow(saved);
    }

    clearPendingRow(row);
    refreshLiveViewsImmediately();
    updateLiveInputFromSelectedDate();
    setSync("已同步",true);
  }catch(e){
    refreshLiveViewsImmediately();

    setSync(
      "已保存在本机，云端会自动重试",
      false,
      true
    );
  }
}

function renderDashboard(){
  const bm=totalBy("daily","balakong","month");
  const blm=totalBy("daily","belimbing","month");
  const fm=totalBy("fair","","month");

  const lm=isLiveMonthClosed(selectedMonth())
    ?0
    :totalBy("live","","month");

  const by=totalBy("daily","balakong","year");
  const bly=totalBy("daily","belimbing","year");
  const fy=totalBy("fair","","year");
  const ly=totalBy("live","","year");

  document.getElementById("balakongMonth").textContent=money(bm);
  document.getElementById("belimbingMonth").textContent=money(blm);

  renderFairLocationList();

  document.getElementById("fairMonthTotal").textContent=money(fm);
  renderFairCommission(fm);

  renderLiveHostList();

  document.getElementById("liveMonthTotal").textContent=money(lm);
  renderLiveCommission();

  document.getElementById("monthGrandTotal").textContent=
    money(bm+blm+fm+lm);

  document.getElementById("balakongYearTotal").textContent=money(by);
  document.getElementById("belimbingYearTotal").textContent=money(bly);
  document.getElementById("fairYearTotal").textContent=money(fy);
  document.getElementById("liveYearTotal").textContent=money(ly);

  document.getElementById("yearGrandTotal").textContent=
    money(by+bly+fy+ly);

  renderTodayCompanyStatus();
}
function sortReportRows(list){const rank=r=>r.type==="daily"&&r.company==="balakong"?0:r.type==="daily"&&r.company==="belimbing"?1:r.type==="fair"?2:3;return[...list].sort((a,b)=>rank(a)-rank(b)||String(a.location||"").localeCompare(String(b.location||""))||displayToISO(a.date).localeCompare(displayToISO(b.date)))}
function renderTable(){const s=sortReportRows(dedupeRows(rows).filter(r=>sameMonth(r.date)&&Number(r.amount)>0));document.getElementById("recordTable").innerHTML=s.map(r=>{const ty=r.type==="fair"?"Fair":r.type==="live"?"Live":"每日",co=r.type==="live"?canonicalHost(r.location):(companyNames[r.company]||r.company),lo=r.type==="live"?"-":(r.location||"-");return`<tr><td>${r.date}</td><td>${ty}</td><td>${co}</td><td>${lo}</td><td>${money(r.amount)}</td></tr>`}).join("")||'<tr><td colspan="5" style="text-align:center;">这个月份还没有记录</td></tr>'}
function renderAll(){rows=dedupeRows(applyLiveDeleteTombstones(rows));renderDashboard();renderTable();updateDailyInputFromSelectedDate();renderFairLocationOptions();
renderLiveHostOptions();renderLiveDailyList();renderLiveHostCommissionSettings()}
async function saveDailySales(){
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

  try{
    setSync("已储存，正在后台同步...");
    const saved=await saveDailyToSheet(d,c,a,localRow.clientUpdatedAt);
    if(saved)upsertLocalRow(saved);
    clearPendingRow(localRow);
    renderAll();
    setSync("已同步",true);
  }catch(e){
    setSync("有未同步资料，系统会自动重试",false,true);
  }
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

function syncFairInputs(){const start=document.getElementById("fairStart").value,end=document.getElementById("fairEnd").value,loc=canonicalLocation(document.getElementById("fairLocation").value.trim());if(!start||!end||new Date(start)>new Date(end)){document.getElementById("fairInputs").innerHTML="";return}let html="<h3>Fair 每日营业额</h3>";dateRange(start,end).forEach(d=>{const old=rows.find(r=>r.type==="fair"&&r.date===d&&canonicalLocation(r.location)===loc);html+=`<label>${d} 营业额</label><input type="text" class="fairAmount money-input" data-date="${d}" value="${old?formatAmount(old.amount):"0.00"}" inputmode="decimal">`});document.getElementById("fairInputs").innerHTML=html;attachMoneyInputs()}
async function saveFairSales(){
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
        canonicalLocation(r.location)===loc
      ));
    }else{
      upsertLocalRow(row);
    }

    addPendingRow(row);
  });

  renderAll();
  showTempMsg("fairSaveMsg");

  try{
    setSync("已储存，正在后台同步...");
    const result=await saveFairBatchToSheet(loc,records);

    if(result&&Array.isArray(result.rows)){
      result.rows.forEach(r=>{
        if(Number(r.amount)<=0){
          rows=rows.filter(x=>syncKey(x)!==syncKey(r));
        }else{
          upsertLocalRow(r);
        }
      });
    }

    records.forEach(i=>clearPendingRow({
      type:"fair",
      date:i.date,
      company:"belimbing",
      location:loc
    }));

    renderAll();
    setSync("已同步",true);
  }catch(e){
    setSync("有未同步资料，系统会自动重试",false,true);
  }
}
function exportCSV(scope="month"){let csv="\uFEFF公司/主播,日期,类别,地点,营业额\n";const s=sortReportRows(dedupeRows(rows).filter(r=>(scope==="year"?sameYear(r.date):sameMonth(r.date))&&Number(r.amount)>0));s.forEach(r=>{const ty=r.type==="fair"?"Fair":r.type==="live"?"Live":"每日",co=r.type==="live"?canonicalHost(r.location):(companyNames[r.company]||r.company),lo=r.type==="live"?"":(r.location||"");csv+=`"${co}",${r.date},"${ty}","${lo}",${Number(r.amount).toFixed(2)}
`});downloadFile(`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.csv`,csv,"text/csv;charset=utf-8;")}
function monthClose(){
  const month=selectedMonth();
  const next=monthAfter(month);

  if(!confirm(
    `确定完成 ${month} 月底结算？\n\n`+
    `系统将切换到 ${next}。\n`+
    "历史资料不会删除。"
  )){
    return;
  }

  markLiveMonthClosed(month);

  document.getElementById("monthPicker").value=next;
  renderAll();

  alert("已完成月底结算，进入 "+next);
}
function yearClose(){const y=selectedYear(),ny=yearAfter(y);if(!confirm(`确定完成 ${y} 年底结算？\n\n系统将导出全年 Excel，\n并切换到 ${ny}。\n历史资料不会删除。`))return;exportCSV("year");document.getElementById("yearPicker").value=ny;document.getElementById("monthPicker").value=`${ny}-01`;renderAll();alert("已完成年底结算，进入 "+ny)}
document.getElementById("monthPicker").value=monthISO();
document.getElementById("yearPicker").value=currentYear();

setDateControl("saleDate",todayISO());
const liveSessionRestored=restoreLiveSession();if(!liveSessionRestored)setDateControl("liveDate",todayISO());

const fairSessionRestored=restoreFairSession();

if(!fairSessionRestored){
  setDateControl("fairStart",todayISO());
  setDateControl("fairEnd",todayISO());
}

bindDateControl("saleDate",updateDailyInputFromSelectedDate);
bindDateControl("liveDate",()=>{saveLiveSession();updateLiveInputFromSelectedDate()});

bindDateControl("fairStart",()=>{
  saveFairSession();
  syncFairInputs();
});

bindDateControl("fairEnd",()=>{
  saveFairSession();
  syncFairInputs();
});

renderFairLocationOptions();

document.getElementById("monthPicker").addEventListener("change",renderAll);
document.getElementById("yearPicker").addEventListener("change",()=>{
  renderAll();
  loadFromSheet({force:true});
});
document.getElementById("company").addEventListener("change",updateDailyInputFromSelectedDate);
document.getElementById("liveHost").addEventListener("input",()=>{
  saveLiveSession();
  updateLiveInputFromSelectedDate({preserveTyped:true});
});
document.getElementById("liveHost").addEventListener("blur",()=>{const i=document.getElementById("liveHost");i.value=canonicalHost(i.value);saveLiveHost(i.value);saveLiveSession();updateLiveInputFromSelectedDate()});

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

document.getElementById("liveSales").addEventListener("input",saveLiveSession);document.getElementById("liveSales").addEventListener("blur",saveLiveSession);attachMoneyInputs();
renderAll();

loadFromSheet().then(()=>{syncFairInputs();const s=JSON.parse(localStorage.getItem(LIVE_SESSION_KEY)||"null");if(s?.host)document.getElementById("liveHost").value=canonicalHost(s.host);if(s?.date)setDateControl("liveDate",s.date);updateLiveInputFromSelectedDate({preserveTyped:true});if(s?.sales!==undefined)document.getElementById("liveSales").value=safeFormatAmount(s.sales)});
