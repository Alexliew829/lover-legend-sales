function getSavedFairLocations(){try{return JSON.parse(localStorage.getItem("lover_fair_locations")||"[]")}catch(e){return[]}}
function saveFairLocation(location){const loc=canonicalLocation(location);if(!loc)return;const list=getSavedFairLocations();if(!list.some(x=>canonicalLocation(x)===loc))list.push(loc);list.sort();localStorage.setItem("lover_fair_locations",JSON.stringify(list));renderFairLocationOptions()}
function collectFairLocations(){const fromRows=[...new Set(rows.filter(r=>r.type==="fair").map(r=>canonicalLocation(r.location)).filter(Boolean))],fromStorage=getSavedFairLocations(),merged=[];[...fromRows,...fromStorage].forEach(x=>{const loc=canonicalLocation(x);if(loc&&!merged.some(y=>canonicalLocation(y)===loc))merged.push(loc)});merged.sort();localStorage.setItem("lover_fair_locations",JSON.stringify(merged));return merged}
function renderFairLocationOptions(){const el=document.getElementById("fairLocationListOptions");if(el)el.innerHTML=collectFairLocations().map(loc=>`<option value="${loc}"></option>`).join("")}
const companyNames={balakong:"Lover Legend Adenium - Balakong",belimbing:"Lover Legend Gardening - Belimbing"};
function selectedMonth(){return document.getElementById("monthPicker").value}
function selectedYear(){return document.getElementById("yearPicker").value}
function sameMonth(date){return sameMonthDisplay(date,selectedMonth())}
function sameYear(date){return sameYearDisplay(date,selectedYear())}
function showPage(name,el){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.getElementById("page-"+name).classList.add("active");document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));el.classList.add("active")}
function rowKey(r){return [r.type,r.date,r.company,canonicalLocation(r.location||"")].join("|")}
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
  rate3:8
};

let commissionSettings={...DEFAULT_COMMISSION_SETTINGS};

function normalizeCommissionSettings(settings){
  const source=settings||{};
  const rate1=Number(source.rate1);
  const rate2=Number(source.rate2);
  const rate3=Number(source.rate3);

  if(
    !Number.isFinite(rate1)||
    !Number.isFinite(rate2)||
    !Number.isFinite(rate3)||
    rate1<0||rate2<0||rate3<0
  ){
    return{...DEFAULT_COMMISSION_SETTINGS};
  }

  return{rate1,rate2,rate3};
}

function getCommissionSettings(){
  return{...commissionSettings};
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

async function saveCommissionSettings(){
  const rate1=Number(document.getElementById("commissionRate1").value);
  const rate2=Number(document.getElementById("commissionRate2").value);
  const rate3=Number(document.getElementById("commissionRate3").value);
  const settings=normalizeCommissionSettings({rate1,rate2,rate3});

  if(settings.rate1!==rate1||settings.rate2!==rate2||settings.rate3!==rate3){
    alert("请输入正确的佣金百分比");
    return;
  }

  try{
    setSync("正在同步佣金设置...");
    const saved=await saveCommissionSettingsToSheet(settings);
    applyCommissionSettings(saved||settings);
    showTempMsg("commissionSettingsMsg");
    setSync("已同步",true);
  }catch(e){
    alert("佣金设置储存失败："+e.message);
    setSync("佣金设置同步失败",false,true);
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
    const saved=await resetCommissionSettingsInSheet();
    applyCommissionSettings(saved||DEFAULT_COMMISSION_SETTINGS);
    showTempMsg("commissionSettingsMsg");
    setSync("已同步",true);
  }catch(e){
    alert("恢复默认值失败："+e.message);
    setSync("佣金设置同步失败",false,true);
  }
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

function renderDashboard(){const bt=totalBy("daily","balakong","today"),blt=totalBy("daily","belimbing","today"),ft=totalBy("fair","","today"),bm=totalBy("daily","balakong","month"),blm=totalBy("daily","belimbing","month"),fm=totalBy("fair","","month"),by=totalBy("daily","balakong","year"),bly=totalBy("daily","belimbing","year"),fy=totalBy("fair","","year");document.getElementById("balakongMonth").textContent=money(bm);document.getElementById("belimbingMonth").textContent=money(blm);renderFairLocationList();document.getElementById("fairMonthTotal").textContent=money(fm);renderFairCommission(fm);document.getElementById("monthGrandTotal").textContent=money(bm+blm+fm);document.getElementById("balakongYearTotal").textContent=money(by);document.getElementById("belimbingYearTotal").textContent=money(bly);document.getElementById("fairYearTotal").textContent=money(fy);document.getElementById("yearGrandTotal").textContent=money(by+bly+fy);renderTodayCompanyStatus()}
function sortReportRows(list){const rank=r=>r.type==="daily"&&r.company==="balakong"?0:r.type==="daily"&&r.company==="belimbing"?1:2;return [...list].sort((a,b)=>rank(a)-rank(b)||canonicalLocation(a.location).localeCompare(canonicalLocation(b.location))||displayToISO(a.date).localeCompare(displayToISO(b.date)))}
function renderTable(){const s=sortReportRows(dedupeRows(rows).filter(r=>sameMonth(r.date)&&Number(r.amount)>0));document.getElementById("recordTable").innerHTML=s.map(r=>`<tr><td>${r.date}</td><td>${r.type==="fair"?"Fair":"每日"}</td><td>${companyNames[r.company]||r.company}</td><td>${r.location||"-"}</td><td>${money(r.amount)}</td></tr>`).join("")||'<tr><td colspan="5" style="text-align:center;">这个月份还没有记录</td></tr>'}
function renderAll(){rows=dedupeRows(rows);renderDashboard();renderTable();updateDailyInputFromSelectedDate();renderFairLocationOptions()}
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
function exportCSV(scope="month"){let csv="\uFEFF公司,日期,类别,地点,营业额\n";const selected=sortReportRows(dedupeRows(rows).filter(r=>(scope==="year"?sameYear(r.date):sameMonth(r.date))&&Number(r.amount)>0));selected.forEach(r=>{csv+=`"${companyNames[r.company]||r.company}",${r.date},"${r.type==="fair"?"Fair":"每日"}","${r.location||""}",${Number(r.amount).toFixed(2)}\n`});downloadFile(`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.csv`,csv,"text/csv;charset=utf-8;")}
function monthClose(){const m=selectedMonth(),next=monthAfter(m);if(!confirm(`确定完成 ${m} 月底结算？\n\n系统将切换到 ${next}。\n历史资料不会删除。`))return;document.getElementById("monthPicker").value=next;renderAll();alert("已完成月底结算，进入 "+next)}
function yearClose(){const y=selectedYear(),ny=yearAfter(y);if(!confirm(`确定完成 ${y} 年底结算？\n\n系统将导出全年 Excel，\n并切换到 ${ny}。\n历史资料不会删除。`))return;exportCSV("year");document.getElementById("yearPicker").value=ny;document.getElementById("monthPicker").value=`${ny}-01`;renderAll();alert("已完成年底结算，进入 "+ny)}
document.getElementById("monthPicker").value=monthISO();
document.getElementById("yearPicker").value=currentYear();

setDateControl("saleDate",todayISO());

const fairSessionRestored=restoreFairSession();

if(!fairSessionRestored){
  setDateControl("fairStart",todayISO());
  setDateControl("fairEnd",todayISO());
}

bindDateControl("saleDate",updateDailyInputFromSelectedDate);

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

attachMoneyInputs();
renderAll();

loadFromSheet().then(()=>{
  syncFairInputs();
});
