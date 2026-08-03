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
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById("page-"+name).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  el.classList.add("active");

  // V12.8: every time Live is opened, start from today's date.
  // A previous date is loaded only when the user deliberately selects it.
  if(name==="live"&&document.getElementById("liveDate")){
    setDateControl("liveDate",todayISO());
    updateLiveInputFromSelectedDate();
  }

  // V12.8: page switching never waits for or triggers cloud sync.
  // Periodic/background sync is handled separately.
}
function rowKey(r){return [r.type,r.date,r.company,canonicalLocation(r.location||"")].join("|")}
function dedupeRows(list){const m=new Map();list.forEach(r=>{const k=rowKey(r),old=m.get(k);if(!old||String(r.updatedAt||"")>=String(old.updatedAt||""))m.set(k,r)});return [...m.values()]}
function upsertLocalRow(n){rows=dedupeRows([...rows,n])}
function getDailyAmount(d,c){const f=rows.find(r=>r.type==="daily"&&r.date===d&&r.company===c);return f?Number(f.amount||0):0}
function updateDailyInputFromSelectedDate(){const d=isoToDisplay(document.getElementById("saleDate").value),c=document.getElementById("company").value,a=getDailyAmount(d,c);document.getElementById("dailySales").value=formatAmount(a);document.getElementById("salesDateResult").textContent=`${companyNames[c]}｜${d}｜${money(a)}`;renderSalesMonthlyList()}
function totalBy(type,company="",mode="month"){return rows.filter(r=>r.type===type).filter(r=>company?r.company===company:true).filter(r=>mode==="today"?r.date===isoToDisplay(todayISO()):mode==="month"?sameMonth(r.date):mode==="year"?sameYear(r.date):true).reduce((s,r)=>s+Number(r.amount||0),0)}
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
  liveRateSchedules:[]
};

let commissionSettings={...DEFAULT_COMMISSION_SETTINGS};

function normalizeCommissionSettings(settings){
  const source=settings||{};
  const rate1=Number(source.rate1);
  const rate2=Number(source.rate2);
  const rate3=Number(source.rate3);
  const liveHostRates={};
  const liveHosts={};
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
  Object.keys(liveHostRates).forEach(key=>{if(!liveHosts[key])liveHosts[key]=key.replace(/(^|\s)\S/g,c=>c.toUpperCase())});

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
    return{...DEFAULT_COMMISSION_SETTINGS,liveHostRates:{},liveHosts:{},liveRateSchedules:[]};
  }
  return{rate1,rate2,rate3,liveHostRates,liveHosts,liveRateSchedules};
}
function getCommissionSettings(){
  return{
    ...commissionSettings,
    liveHostRates:{...(commissionSettings.liveHostRates||{})},
    liveHosts:{...(commissionSettings.liveHosts||{})},
    liveRateSchedules:(commissionSettings.liveRateSchedules||[]).map(item=>({...item}))
  };
}

function applyCommissionSettings(settings){
  commissionSettings=normalizeCommissionSettings(settings);
  localStorage.setItem(
    "lover_commission_settings_cache",
    JSON.stringify(commissionSettings)
  );
  loadCachedCommissionSettings();
loadCommissionSettingsForm();
  if(typeof renderDashboard==="function")renderDashboard();
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
function getEffectiveCommissionSettings(){
  const current=getCommissionSettings();
  const snapshot=(systemState.commissionSnapshots||{})[selectedMonth()];
  if(!snapshot)return current;

  // V12.8: historical snapshots created before per-host commission support may
  // not contain liveHostRates/liveHosts. Keep the month Fair rates, but fall
  // back to the latest saved host commission settings instead of showing 0%.
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
    liveRateSchedules:Array.isArray(snapshot&&snapshot.liveRateSchedules)
      ?snapshot.liveRateSchedules
      :(current.liveRateSchedules||[])
  });
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

function findLiveRateSchedule(date,settings=getEffectiveCommissionSettings()){
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(String(date||""))
    ?String(date)
    :displayToISO(date);
  if(!iso)return null;
  const month=iso.slice(0,7);
  return (settings.liveRateSchedules||[]).find(item=>{
    if(liveScheduleMonth(item)!==month)return false;
    const effectiveEnd=item.endDate||monthLastISO(month);
    return iso>=item.startDate&&iso<=effectiveEnd;
  })||null;
}

function getLiveHostRate(host,date=""){
  const settings=getEffectiveCommissionSettings();
  const schedule=findLiveRateSchedule(date,settings);
  if(schedule)return Number(schedule.rate||0);
  const key=normalizeLiveHostKey(host);
  const specific=Number((settings.liveHostRates||{})[key]);
  return Number.isFinite(specific)?specific:0;
}
function renderLiveHostCommissionSettings(){
  const container=document.getElementById("liveHostCommissionList");
  if(!container)return;
  const settings=getCommissionSettings();
  const hosts=collectLiveHosts();
  container.innerHTML=hosts.length?hosts.map(host=>{
    const key=normalizeLiveHostKey(host);
    const rate=Number.isFinite(Number((settings.liveHostRates||{})[key]))
      ?Number(settings.liveHostRates[key]):0;
    return `<label class="host-commission-row"><span>${host}</span><span class="commission-input-row"><input type="text" inputmode="decimal" data-live-host-key="${key}" value="${rate}"><span>%</span></span></label>`;
  }).join(""):'<div class="sub">新增 Live 主播后会自动显示在这里</div>';
}

function renderLiveRateSchedules(){
  const container=document.getElementById("liveRateScheduleList");
  if(!container)return;
  const schedules=liveSchedulesForMonth(selectedMonth());
  container.innerHTML=schedules.length
    ?schedules.map(item=>`
      <div class="live-rate-schedule-row ${item.endDate?"":"is-open"}">
        <div class="live-rate-schedule-info">
          <span>${isoToDisplay(item.startDate)} 至 ${
            item.endDate?isoToDisplay(item.endDate):'<span class="live-rate-schedule-open">进行中 · 月底自动结束</span>'
          }</span>
          <span class="live-rate-schedule-rate">${money(item.rate).replace(".00","")}%</span>
        </div>
        <div class="live-rate-schedule-actions">
          <button type="button" class="live-rate-schedule-edit" onclick="editLiveRateSchedule('${item.id}')">${item.endDate?"修改结束日期":"填写结束日期"}</button>
          <button type="button" class="live-rate-schedule-remove" onclick="removeLiveRateSchedule('${item.id}')">删除</button>
        </div>
      </div>
    `).join("")
    :`<div class="live-schedule-empty">${selectedMonth()} 没有特别日期规则，使用各主播一般佣金</div>`;
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

function addLiveRateSchedule(){
  const start=document.getElementById("liveScheduleStart");
  const end=document.getElementById("liveScheduleEnd");
  const rateEl=document.getElementById("liveScheduleRate");
  const startDate=String(start&&start.value||"");
  const endDate=String(end&&end.value||"");
  const rate=Number(rateEl&&rateEl.value);

  if(!startDate){
    alert("请选择开始日期");
    return;
  }
  if(startDate.slice(0,7)!==selectedMonth()){
    alert(`开始日期必须属于目前选择的月份：${selectedMonth()}`);
    return;
  }
  if(endDate&&endDate.slice(0,7)!==startDate.slice(0,7)){
    alert("结束日期不能跨月份；下个月请新增另一条特别佣金日期");
    return;
  }
  if(endDate&&endDate<startDate){
    alert("结束日期不能早于开始日期");
    return;
  }
  if(!Number.isFinite(rate)||rate<0){
    alert("请输入正确的直播佣金百分比");
    return;
  }

  const previous=getCommissionSettings();
  const item={
    id:`live_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    startDate,
    endDate,
    rate
  };

  try{
    const schedules=validateLiveRateSchedules([
      ...(previous.liveRateSchedules||[]),
      item
    ]);
    applyCommissionSettings({...previous,liveRateSchedules:schedules});
    renderLiveRateSchedules();
    renderDashboard();
    renderTable();
    if(start)setDateControl("liveScheduleStart","");
    if(end)setDateControl("liveScheduleEnd","");
  }catch(error){
    alert(error.message);
  }
}

function editLiveRateSchedule(id){
  const previous=getCommissionSettings();
  const item=(previous.liveRateSchedules||[]).find(rule=>rule.id===id);
  if(!item)return;

  const value=prompt(
    `请输入结束日期（dd-mm-yyyy）\n开始日期：${isoToDisplay(item.startDate)}\n留空代表继续到本月底`,
    item.endDate?isoToDisplay(item.endDate):""
  );
  if(value===null)return;

  const trimmed=String(value||"").trim();
  const endDate=trimmed?displayToISO(trimmed):"";
  if(trimmed&&!/^\d{4}-\d{2}-\d{2}$/.test(endDate)){
    alert("日期格式必须是 dd-mm-yyyy");
    return;
  }
  if(endDate&&endDate.slice(0,7)!==item.startDate.slice(0,7)){
    alert("结束日期不能跨月份；下个月请新增另一条特别佣金日期");
    return;
  }
  if(endDate&&endDate<item.startDate){
    alert("结束日期不能早于开始日期");
    return;
  }

  try{
    const schedules=validateLiveRateSchedules(
      (previous.liveRateSchedules||[]).map(rule=>
        rule.id===id?{...rule,endDate}:{...rule}
      )
    );
    applyCommissionSettings({...previous,liveRateSchedules:schedules});
    renderLiveRateSchedules();
    renderDashboard();
    renderTable();
  }catch(error){
    alert(error.message);
  }
}

function clearLiveScheduleInputs(){
  setDateControl("liveScheduleStart","");
  setDateControl("liveScheduleEnd","");
  const rateEl=document.getElementById("liveScheduleRate");
  if(rateEl)rateEl.value="";
}

function removeLiveRateSchedule(id){
  const previous=getCommissionSettings();
  const schedules=(previous.liveRateSchedules||[]).filter(item=>item.id!==id);
  applyCommissionSettings({...previous,liveRateSchedules:schedules});
  renderLiveRateSchedules();
  clearLiveScheduleInputs();
  renderDashboard();
  renderTable();
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

function renderDashboard(){const bt=totalBy("daily","balakong","today"),blt=totalBy("daily","belimbing","today"),ft=totalBy("fair","","today"),bm=totalBy("daily","balakong","month"),blm=totalBy("daily","belimbing","month"),fm=totalBy("fair","","month"),by=totalBy("daily","balakong","year"),bly=totalBy("daily","belimbing","year"),fy=totalBy("fair","","year");document.getElementById("balakongMonth").textContent=money(bm);document.getElementById("belimbingMonth").textContent=money(blm);renderFairLocationList();document.getElementById("fairMonthTotal").textContent=money(fm);renderFairCommission(fm);document.getElementById("monthGrandTotal").textContent=money(bm+blm+fm);document.getElementById("balakongYearTotal").textContent=money(by);document.getElementById("belimbingYearTotal").textContent=money(bly);document.getElementById("fairYearTotal").textContent=money(fy);document.getElementById("yearGrandTotal").textContent=money(by+bly+fy);renderTodayCompanyStatus()}
function sortReportRows(list){const rank=r=>r.type==="daily"&&r.company==="balakong"?0:r.type==="daily"&&r.company==="belimbing"?1:2;return [...list].sort((a,b)=>rank(a)-rank(b)||canonicalLocation(a.location).localeCompare(canonicalLocation(b.location))||displayToISO(a.date).localeCompare(displayToISO(b.date)))}
function renderTable(){const s=sortReportRows(dedupeRows(rows).filter(r=>sameMonth(r.date)&&Number(r.amount)>0));document.getElementById("recordTable").innerHTML=s.map(r=>`<tr><td>${r.date}</td><td>${r.type==="fair"?"Fair":"每日"}</td><td>${companyNames[r.company]||r.company}</td><td>${r.location||"-"}</td><td>${money(r.amount)}</td></tr>`).join("")||'<tr><td colspan="5" style="text-align:center;">这个月份还没有记录</td></tr>'}
function renderAll(){rows=dedupeRows(rows);renderDashboard();renderTable();updateDailyInputFromSelectedDate();renderFairLocationOptions();updateFairPageMode();renderFairMonthlyList();renderFairDailySummary();renderLiveDailySummary();renderLiveMonthlyList()}
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

  try{
    setSync("已储存，正在后台同步...");
    const saved=await saveDailyToSheet(d,c,a,localRow.clientUpdatedAt);
    if(saved)upsertLocalRow(saved);
    clearPendingRow(localRow);
    renderAll();
    setSync("已同步",true);
  }catch(e){
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
    else setSync("同步暂未完成",false,true);
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

function syncFairInputs(){const start=document.getElementById("fairStart").value,end=document.getElementById("fairEnd").value,loc=canonicalLocation(document.getElementById("fairLocation").value.trim());if(!start||!end||new Date(start)>new Date(end)){document.getElementById("fairInputs").innerHTML="";return}let html="<h3>Fair 每日营业额</h3>";dateRange(start,end).forEach(d=>{const old=rows.find(r=>r.type==="fair"&&r.date===d&&canonicalLocation(r.location)===loc);html+=`<label>${d} 营业额</label><input type="text" class="fairAmount money-input" data-date="${d}" value="${old?formatAmount(old.amount):"0.00"}" inputmode="decimal">`});document.getElementById("fairInputs").innerHTML=html;attachMoneyInputs()}
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
    if(typeof setPendingRetrySyncStatus==="function")setPendingRetrySyncStatus();
    else setSync("同步暂未完成",false,true);
  }
}
function exportCSV(scope="month"){let csv="\uFEFF公司,日期,类别,地点,营业额\n";const selected=sortReportRows(dedupeRows(rows).filter(r=>(scope==="year"?sameYear(r.date):sameMonth(r.date))&&Number(r.amount)>0));selected.forEach(r=>{csv+=`"${companyNames[r.company]||r.company}",${r.date},"${r.type==="fair"?"Fair":"每日"}","${r.location||""}",${Number(r.amount).toFixed(2)}\n`});downloadFile(`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.csv`,csv,"text/csv;charset=utf-8;")}
const ACTIVE_MONTH_STORAGE_KEY="lover_sales_active_month_v82";
let systemState={currentMonth:monthISO(),closedMonths:[],commissionSnapshots:{},dataVersion:"12.8"};
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
function applySystemState(state){if(state){systemState.currentMonth=state.currentMonth||monthISO();systemState.closedMonths=Array.isArray(state.closedMonths)?state.closedMonths:[];systemState.commissionSnapshots=state.commissionSnapshots||{};systemState.dataVersion=state.dataVersion||"12.8"}updateReadOnlyMode()}
async function monthClose(){
  const m=selectedMonth();
  if(m!==systemState.currentMonth){alert("只能结算系统当前月份："+systemState.currentMonth);return}
  if(systemState.closedMonths.includes(m)){alert(m+" 已经完成月底结算。\n系统日期进入新月份后会自动切换。");return}
  const ok=confirm(`准备完成 ${m} 月底结算。\n\n强烈建议先按“导出本月 Excel”，确认资料完整并保存副本。\n\n结算后：\n• 不会立即切换到下个月\n• ${m} 会保留“已结算”状态，但发现手误时仍可修正\n• 营业、Fair、Live 与 Commission 历史资料不会删除\n• 系统日期进入新月份后才自动切换\n\n确定继续结算？`);
  if(!ok)return;
  try{setSync("正在完成月底结算...");const result=await closeMonthInSheet(m);applySystemState(result.systemState);setSync("月底结算已完成",true);alert(`${m} 月底结算已完成。\n目前仍停留在 ${m}，资料仍可在以后发现错误时修正。\n系统日期进入新月份后会自动切换。`)}catch(e){alert("月底结算失败："+e.message);setSync("月底结算失败",false,true)}
}
function yearClose(){const y=selectedYear();if(!confirm(`确定导出 ${y} 全年 Excel？\n\nV12.8 不会提前切换年份；系统日期进入新年份后自动进入新月份。`))return;exportCSV("year")}
function initializeCurrentMonth(){
  const current=monthISO();
  document.getElementById("monthPicker").value=current;
  document.getElementById("yearPicker").value=current.slice(0,4);
  const dashboardDate=document.getElementById("dashboardDate");
  if(dashboardDate&&!dashboardDate.value)setDateControl("dashboardDate",todayISO());
  saveActiveMonth(current);
}
initializeCurrentMonth();
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

// V12.8: paint Home immediately, then read local cache, then force one cloud refresh.
// Every new page instance runs this path, so closing/reopening the phone still
// checks Google Sheet instead of trusting the previous "已同步" state.
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
      markCloudCheckPending("本机资料已显示 · 云端后台同步中");
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
        ? "本机资料已显示 · 云端后台同步中"
        : "正在读取云端资料");
    }

    // This forced read is deliberately inside finally-style startup flow:
    // local cache failure can never prevent cloud synchronization.
    const result = await loadFromSheet({
      background: true,
      force: true,
      loadYear: false,
      suppressStartStatus: true,
      timeoutMs: 15000
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

if (sessionStorage.getItem(ACCESS_UNLOCK_SESSION_KEY) === "1" ||
    isMobileAccessStillValid()) {
  startInitialSalesDataLoad();
} else {
  window.addEventListener(
    "lover-sales-unlocked",
    startInitialSalesDataLoad,
    { once: true }
  );
}


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
    : canonicalLocation(r.location||"");
  return [r.type,r.date,r.company,location].join("|");
}
function getSavedLiveHosts(){
  try{return JSON.parse(localStorage.getItem("lover_live_hosts_v69")||"[]")}catch(e){return[]}
}
function collectLiveHosts(){
  const merged=[];
  const cloudHosts=Object.values((getCommissionSettings().liveHosts)||{});
  [...rows.filter(r=>r.type==="live").map(r=>canonicalLiveHost(r.location)),...cloudHosts,...getSavedLiveHosts()]
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
}

const LIVE_LAST_SESSION_KEY="lover_live_last_saved_session_v72";
function saveLastLiveSession(host,dateISO){
  const cleanHost=canonicalLiveHost(host);
  if(!cleanHost||!dateISO)return;
  try{
    localStorage.setItem(LIVE_LAST_SESSION_KEY,JSON.stringify({host:cleanHost,dateISO}));
  }catch(e){}
}
function restoreLastLiveSession(){
  const hostEl=document.getElementById("liveHost");
  const dateEl=document.getElementById("liveDate");
  if(!hostEl||!dateEl)return;
  try{
    const saved=JSON.parse(localStorage.getItem(LIVE_LAST_SESSION_KEY)||"null");
    if(saved&&saved.host)hostEl.value=canonicalLiveHost(saved.host);
  }catch(e){}
  // V12.8: do not restore the previously saved date.
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
async function saveLiveSales(){
  if(!ensureWritableSelection())return;
  const dateEl=document.getElementById("liveDate");
  const hostInput=document.getElementById("liveHost");
  const amountEl=document.getElementById("liveSales");
  const d=isoToDisplay(dateEl.value);
  const host=selectedLiveHost();
  const amount=toAmount(amountEl.value);
  if(!host){alert("请输入主播名字");return}
  if(!d){alert("请选择日期");return}
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
  rows=dedupeRows(rows);
  renderDashboard();
  renderTable();
  updateDailyInputFromSelectedDate();
  renderFairLocationOptions();
  renderLiveHostOptions();
  updateLiveInputFromSelectedDate();
  loadCommissionSettingsForm();
  renderLiveHostCommissionSettings();
  renderLiveRateSchedules();
  renderMonthlySummary();
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
function renderMonthlySummary(){
  const body=document.getElementById("monthlySummaryBody");
  if(!body)return;
  const list=buildMonthlySummary();
  body.innerHTML=list.length?list.map(item=>`<tr class="monthly-summary-row${item.month===selectedMonth()?" active":""}" onclick="selectSummaryMonth('${item.month}')"><td><b>${item.month.slice(5,7)}-${item.month.slice(0,4)}</b></td><td>${money(item.balakong)}</td><td>${money(item.belimbing)}</td><td>${money(item.fair)}</td><td>${money(item.live)}</td><td><b>${money(item.total)}</b></td></tr>`).join(""):'<tr><td colspan="6" class="summary-empty">还没有月份资料</td></tr>';
}
function toggleMonthlySummary(force){
  const card=document.getElementById("monthlySummaryCard");
  const btn=document.getElementById("monthlySummaryBtn");
  if(!card)return;

  const show=typeof force==="boolean"
    ?force
    :card.classList.contains("hidden");

  card.classList.toggle("hidden",!show);
  if(btn)btn.classList.toggle("active",show);
  if(!show)return;

  // V12.8: summary opens immediately from local year data.
  renderMonthlySummary();
  setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"start"}),50);
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

function exportCSV(scope="month"){
  let csv="\uFEFF公司,日期,类别,地点/主播,营业额,佣金%,佣金金额\n";
  const selected=sortReportRows(dedupeRows(rows).filter(r=>(scope==="year"?sameYear(r.date):sameMonth(r.date))&&Number(r.amount)>0));
  const fairTotal=selected.filter(r=>r.type==="fair").reduce((sum,r)=>sum+Number(r.amount||0),0);
  selected.forEach(r=>{
    const rate=r.type==="live"?getLiveHostRate(r.location,r.date):r.type==="fair"?getFairCommissionRate(fairTotal)*100:0;
    const commission=(r.type==="live"||r.type==="fair")?Number(r.amount||0)*rate/100:0;
    csv+=`"${r.type==="live"?"Live":(companyNames[r.company]||r.company)}",${r.date},"${r.type==="fair"?"Fair":r.type==="live"?"Live":"每日"}","${r.location||""}",${Number(r.amount).toFixed(2)},${rate?Number(rate.toFixed(2)):""},${rate?commission.toFixed(2):""}\n`;
  });
  downloadFile(`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.csv`,csv,"text/csv;charset=utf-8;");
}

bindDateControl("liveScheduleStart");
bindDateControl("liveScheduleEnd");

/* Live controls */
if(document.getElementById("liveDate")){
  setDateControl("liveDate",todayISO());
  bindDateControl("liveDate",updateLiveInputFromSelectedDate);
}
if(document.getElementById("liveHost")){
  document.getElementById("liveHost").addEventListener("input",updateLiveInputFromSelectedDate);
  document.getElementById("liveHost").addEventListener("blur",()=>{
    const input=document.getElementById("liveHost");
    const host=selectedLiveHost();
    input.value=host;
    if(host)saveLiveHost(host);
    updateLiveInputFromSelectedDate();
  });
}

restoreLastLiveSession();


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
  const previous=getCommissionSettings();
  try{
    const fair=readFairCommissionInputs();
    const settings=normalizeCommissionSettings({...previous,...fair});

    // V12.8：单击后立即套用，并由所有已开启装置自动读取最新佣金。
    if(button){button.disabled=true;button.textContent="正在储存...";}
    applyCommissionSettings(settings);
    if((systemState.closedMonths||[]).includes(selectedMonth())){
      systemState.commissionSnapshots={...(systemState.commissionSnapshots||{}),[selectedMonth()]:settings};
    }
    saveLocalDataCache(settings);
    renderDashboard();
    renderTable();
    showTempMsg("fairCommissionSettingsMsg");
    setSync("Fair 佣金已更新，正在后台同步...");

    const saved=await saveFairCommissionSettingsToSheet(settings,selectedMonth());
    applyCommissionSettings(saved||settings);
    if((systemState.closedMonths||[]).includes(selectedMonth())){
      systemState.commissionSnapshots={...(systemState.commissionSnapshots||{}),[selectedMonth()]:(saved||settings)};
    }
    saveLocalDataCache(saved||settings);
    renderDashboard();
    renderTable();
    setSync("已同步",true);
  }catch(e){
    applyCommissionSettings(previous);
    saveLocalDataCache(previous);
    renderDashboard();
    renderTable();
    alert("Fair 佣金设置储存失败："+e.message);
    setSync("Fair 佣金同步失败",false,true);
  }finally{
    if(button){button.disabled=false;button.textContent="💾 储存 Fair 佣金";}
  }
}

async function saveLiveCommissionSettings(){
  const button=document.getElementById("saveLiveCommissionBtn");
  const previous=getCommissionSettings();
  const previousSnapshot=(systemState.commissionSnapshots||{})[selectedMonth()]||null;
  try{
    const live=readLiveCommissionInputs();
    const settings=normalizeCommissionSettings({...previous,...live});

    // V12.8: apply locally first and immediately refresh Home/Report.
    if(button){button.disabled=true;button.textContent="正在储存...";}
    applyCommissionSettings(settings);
    if((systemState.closedMonths||[]).includes(selectedMonth())){
      systemState.commissionSnapshots={
        ...(systemState.commissionSnapshots||{}),
        [selectedMonth()]:normalizeCommissionSettings({
          ...((systemState.commissionSnapshots||{})[selectedMonth()]||{}),
          ...settings
        })
      };
    }
    renderLiveHostCommissionSettings();
    renderLiveRateSchedules();
    renderDashboard();
    renderTable();
    saveLocalDataCache(settings);
    showTempMsg("liveCommissionSettingsMsg");
    setSync("Live 佣金已更新，正在后台同步...");

    const saved=await saveLiveCommissionSettingsToSheet(settings,selectedMonth());
    const confirmed=normalizeCommissionSettings(saved||settings);
    applyCommissionSettings(confirmed);
    if((systemState.closedMonths||[]).includes(selectedMonth())){
      systemState.commissionSnapshots={
        ...(systemState.commissionSnapshots||{}),
        [selectedMonth()]:normalizeCommissionSettings({
          ...((systemState.commissionSnapshots||{})[selectedMonth()]||{}),
          ...confirmed
        })
      };
    }
    renderLiveHostCommissionSettings();
    renderLiveRateSchedules();
    renderDashboard();
    renderTable();
    saveLocalDataCache(confirmed);
    setSync("已同步",true);
  }catch(e){
    applyCommissionSettings(previous);
    if(previousSnapshot){
      systemState.commissionSnapshots={
        ...(systemState.commissionSnapshots||{}),
        [selectedMonth()]:previousSnapshot
      };
    }
    renderLiveHostCommissionSettings();
    renderDashboard();
    renderTable();
    saveLocalDataCache(previous);
    alert("Live 主播佣金储存失败："+e.message);
    setSync("Live 佣金同步失败",false,true);
  }finally{
    if(button){button.disabled=false;button.textContent="💾 储存直播佣金制度";}
  }
}

async function resetFairCommissionSettings(){
  if(!confirm("确定只恢复 Fair 默认佣金？\n\nRM50,000 以下：6%\nRM50,000 以上：7%\nRM100,000 以上：8%\n\nLive 与各主播佣金不会改变。"))return;

  const previous=getCommissionSettings();
  const previousSnapshot=(systemState.commissionSnapshots||{})[selectedMonth()]||null;
  const settings=normalizeCommissionSettings({...previous,rate1:6,rate2:7,rate3:8});

  try{
    // V12.8：确认恢复后先立即更新本机与 Home，再在后台同步 Google Sheet。
    applyCommissionSettings(settings);
    if((systemState.closedMonths||[]).includes(selectedMonth())){
      systemState.commissionSnapshots={
        ...(systemState.commissionSnapshots||{}),
        [selectedMonth()]:settings
      };
    }
    saveLocalDataCache(settings);
    loadCommissionSettingsForm();
    renderDashboard();
    renderTable();
    showTempMsg("fairCommissionSettingsMsg");
    setSync("Fair 默认佣金已更新，正在后台同步...");

    const saved=await saveCommissionSettingsToSheet(settings,selectedMonth());
    const confirmed=normalizeCommissionSettings(saved||settings);
    applyCommissionSettings(confirmed);
    if((systemState.closedMonths||[]).includes(selectedMonth())){
      systemState.commissionSnapshots={
        ...(systemState.commissionSnapshots||{}),
        [selectedMonth()]:confirmed
      };
    }
    saveLocalDataCache(confirmed);
    loadCommissionSettingsForm();
    renderDashboard();
    renderTable();
    setSync("已同步",true);
    alert("Fair 佣金已恢复默认并自动储存");
  }catch(e){
    applyCommissionSettings(previous);
    if(previousSnapshot){
      systemState.commissionSnapshots={
        ...(systemState.commissionSnapshots||{}),
        [selectedMonth()]:previousSnapshot
      };
    }
    saveLocalDataCache(previous);
    loadCommissionSettingsForm();
    renderDashboard();
    renderTable();
    alert("Fair 恢复默认失败："+e.message);
    setSync("Fair 佣金同步失败",false,true);
  }
}



/* ================= V12.8 Backup / Restore ================= */
function getBackupPayload(){return{system:"Lover Legend Sales System",version:"12.8",createdAt:new Date().toISOString(),rows:dedupeRows(rows),commissionSettings:getCommissionSettings(),
accessSettings:getAccessPasswordSettings(),
closedMonths:[...systemState.closedMonths],commissionSnapshots:{...(systemState.commissionSnapshots||{})},currentMonth:systemState.currentMonth,fairLocations:getSavedFairLocations(),liveHosts:getSavedLiveHosts?getSavedLiveHosts():[]}}
function backupAllData(){const payload=getBackupPayload();const stamp=new Date().toISOString().replace(/[:T]/g,"-").slice(0,19);downloadFile(`Lover_Legend_Sales_V12_5_Backup_${stamp}.json`,JSON.stringify(payload,null,2),"application/json;charset=utf-8;")}
async function restoreBackupFile(file){
  let payload;try{payload=JSON.parse(await file.text())}catch(e){alert("Backup 文件无法读取或不是有效 JSON。");return}
  if(!payload||!Array.isArray(payload.rows)||!payload.commissionSettings){alert("这不是有效的 Lover Legend Sales Backup。");return}
  const ok=confirm(`准备 Restore 完整备份。\n\n备份版本：${payload.version||"未知"}\n备份时间：${payload.createdAt||"未知"}\n营业记录：${payload.rows.length} 笔\n\n恢复将覆盖 Google Sheet 目前所有月份营业资料、Fair、Live、Commission 与结算状态。\n此操作无法自动撤销。\n\n确定继续？`);if(!ok)return;
  try{setSync("正在恢复 Backup...");await restoreBackupToSheet(payload);localStorage.setItem("lover_fair_locations",JSON.stringify(payload.fairLocations||[]));if(payload.liveHosts)localStorage.setItem("lover_live_hosts",JSON.stringify(payload.liveHosts));await loadFromSheet({force:true});document.getElementById("monthPicker").value=monthISO();document.getElementById("yearPicker").value=monthISO().slice(0,4);renderAll();updateReadOnlyMode();setSync("Backup 已恢复",true);alert("Restore 已完成。Google Sheet 与本机画面已重新载入。") }catch(e){alert("Restore 失败："+e.message);setSync("Restore 失败",false,true)}
}
const restoreInput=document.getElementById("restoreFile");if(restoreInput)restoreInput.addEventListener("change",async e=>{const file=e.target.files&&e.target.files[0];e.target.value="";if(file)await restoreBackupFile(file)});
let lastObservedSystemMonth=monthISO();setInterval(()=>{const nowMonth=monthISO();if(nowMonth!==lastObservedSystemMonth){lastObservedSystemMonth=nowMonth;systemState.currentMonth=nowMonth;document.getElementById("monthPicker").value=nowMonth;document.getElementById("yearPicker").value=nowMonth.slice(0,4);renderAll();updateReadOnlyMode();loadFromSheet({force:true})}},60000);
