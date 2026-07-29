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
function rowKey(r){return r.type==="live"?`live|${r.id}`:[r.type,r.date,r.company,canonicalLocation(r.location||"")].join("|")}
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

function renderDashboard(){const liveMonth=liveRows.filter(r=>sameMonth(r.date)).reduce((s,r)=>s+Number(r.amount||0),0);const liveEl=document.getElementById("liveMonthTotal");if(liveEl)liveEl.textContent=money(liveMonth);const bt=totalBy("daily","balakong","today"),blt=totalBy("daily","belimbing","today"),ft=totalBy("fair","","today"),bm=totalBy("daily","balakong","month"),blm=totalBy("daily","belimbing","month"),fm=totalBy("fair","","month"),by=totalBy("daily","balakong","year"),bly=totalBy("daily","belimbing","year"),fy=totalBy("fair","","year");document.getElementById("balakongMonth").textContent=money(bm);document.getElementById("belimbingMonth").textContent=money(blm);renderFairLocationList();document.getElementById("fairMonthTotal").textContent=money(fm);renderFairCommission(fm);document.getElementById("monthGrandTotal").textContent=money(bm+blm+fm+liveMonth);document.getElementById("balakongYearTotal").textContent=money(by);document.getElementById("belimbingYearTotal").textContent=money(bly);document.getElementById("fairYearTotal").textContent=money(fy);document.getElementById("yearGrandTotal").textContent=money(by+bly+fy);renderTodayCompanyStatus()}
function sortReportRows(list){const rank=r=>r.type==="daily"&&r.company==="balakong"?0:r.type==="daily"&&r.company==="belimbing"?1:2;return [...list].sort((a,b)=>rank(a)-rank(b)||canonicalLocation(a.location).localeCompare(canonicalLocation(b.location))||displayToISO(a.date).localeCompare(displayToISO(b.date)))}
function renderTable(){const s=sortReportRows(dedupeRows(rows).filter(r=>sameMonth(r.date)&&Number(r.amount)>0));document.getElementById("recordTable").innerHTML=s.map(r=>`<tr><td>${r.date}</td><td>${r.type==="fair"?"Fair":"每日"}</td><td>${companyNames[r.company]||r.company}</td><td>${r.location||"-"}</td><td>${money(r.amount)}</td></tr>`).join("")||'<tr><td colspan="5" style="text-align:center;">这个月份还没有记录</td></tr>'}
function renderAll(){rows=dedupeRows(rows);renderDashboard();renderTable();updateDailyInputFromSelectedDate();renderFairLocationOptions();renderLiveAll()}
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


const DEFAULT_LIVE_HOSTS=[];
let liveRows=[];
let liveHosts=[];

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function normalizeHostName(value){return String(value||"").trim().replace(/\s+/g," ")}
function normalizeLiveHosts(list){
  const map=new Map();
  (Array.isArray(list)?list:[]).forEach(item=>{
    const name=normalizeHostName(item&&item.name);
    const rate=Number(item&&item.rate);
    if(name&&Number.isFinite(rate)&&rate>=0&&rate<=100)map.set(name.toLowerCase(),{name,rate:Number(rate.toFixed(2))});
  });
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function applyLiveData(records,hosts){
  liveRows=Array.isArray(records)?records.map(r=>({...r,amount:Number(r.amount||0),commissionRate:Number(r.commissionRate||0),commissionAmount:Number(r.commissionAmount||0)})):[];
  liveHosts=normalizeLiveHosts(hosts);
  localStorage.setItem("lover_live_rows_cache_v690",JSON.stringify(liveRows));
  localStorage.setItem("lover_live_hosts_cache_v690",JSON.stringify(liveHosts));
  renderLiveAll();
}
function loadCachedLiveData(){
  try{liveRows=JSON.parse(localStorage.getItem("lover_live_rows_cache_v690")||"[]");}catch(e){liveRows=[]}
  try{liveHosts=normalizeLiveHosts(JSON.parse(localStorage.getItem("lover_live_hosts_cache_v690")||"[]"));}catch(e){liveHosts=[]}
}
function getLiveHostRate(name){const host=liveHosts.find(h=>h.name.toLowerCase()===normalizeHostName(name).toLowerCase());return host?Number(host.rate||0):0}
function renderLiveHostOptions(){
  const select=document.getElementById("liveHost");if(!select)return;
  const current=select.value;
  select.innerHTML=liveHosts.length?liveHosts.map(h=>`<option value="${escapeHtml(h.name)}">${escapeHtml(h.name)} (${money(h.rate)}%)</option>`).join(""):'<option value="">请先新增主播</option>';
  if(liveHosts.some(h=>h.name===current))select.value=current;
  document.getElementById("liveHostHint")?.classList.toggle("hidden",liveHosts.length>0);
  updateLiveCommissionPreview();
}
function updateLiveCommissionPreview(){
  const host=document.getElementById("liveHost")?.value||"";
  const amount=toAmount(document.getElementById("liveSales")?.value||0);
  const rate=getLiveHostRate(host);
  const rateEl=document.getElementById("liveCommissionRate"), amountEl=document.getElementById("liveCommissionAmount");
  if(rateEl)rateEl.value=money(rate);
  if(amountEl)amountEl.value=money(amount*rate/100);
}
function renderLiveRecords(){
  const body=document.getElementById("liveRecordList");if(!body)return;
  const list=[...liveRows].filter(r=>sameMonth(r.date)).sort((a,b)=>displayToISO(b.date).localeCompare(displayToISO(a.date))||String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  body.innerHTML=list.map(r=>`<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.host)}</td><td>${money(r.amount)}</td><td>${money(r.commissionAmount)}</td><td><button onclick="editLiveRecord('${escapeHtml(r.id)}')">修改</button><button class="delete-live" onclick="deleteLiveRecord('${escapeHtml(r.id)}')">删除</button></td></tr>`).join("")||'<tr><td colspan="5" style="text-align:center">这个月份还没有 Live 记录</td></tr>';
}
function renderLiveReport(){
  const body=document.getElementById("liveReportTable");if(!body)return;
  const list=[...liveRows].filter(r=>sameMonth(r.date)).sort((a,b)=>displayToISO(a.date).localeCompare(displayToISO(b.date))||String(a.host).localeCompare(String(b.host)));
  body.innerHTML=list.map(r=>`<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.host)}</td><td>${money(r.amount)}</td><td>${money(r.commissionRate)}%</td><td>${money(r.commissionAmount)}</td><td>${escapeHtml(r.notes||"")}</td></tr>`).join("")||'<tr><td colspan="6" style="text-align:center">这个月份还没有 Live 记录</td></tr>';
}
function renderLiveHostStats(){
  const box=document.getElementById("liveHostStats");if(!box)return;
  const map=new Map();
  liveRows.filter(r=>sameMonth(r.date)).forEach(r=>{const key=r.host||"未命名";const x=map.get(key)||{amount:0,commission:0,count:0};x.amount+=Number(r.amount||0);x.commission+=Number(r.commissionAmount||0);x.count++;map.set(key,x)});
  box.innerHTML=[...map.entries()].sort((a,b)=>b[1].amount-a[1].amount).map(([name,x])=>`<div class="host-stat-card"><div class="host-stat-title">${escapeHtml(name)}</div><div class="host-stat-grid"><div>总营业额<b>${money(x.amount)}</b></div><div>总佣金<b>${money(x.commission)}</b></div><div>直播场数<b>${x.count}</b></div></div></div>`).join("")||'<div class="sub">这个月份还没有主播统计</div>';
}
function renderLiveHostSettings(){
  const box=document.getElementById("liveHostSettingsList");if(!box)return;
  box.innerHTML=liveHosts.map((h,i)=>`<div class="host-setting-row"><input class="host-name-input" data-index="${i}" value="${escapeHtml(h.name)}" maxlength="40"><input class="host-rate-input" data-index="${i}" type="number" min="0" max="100" step="0.01" value="${h.rate}"><button type="button" onclick="removeLiveHost(${i})">×</button></div>`).join("")||'<div class="sub">还没有主播，请先新增。</div>';
}
function collectLiveHostSettingsFromForm(){
  const names=[...document.querySelectorAll(".host-name-input")], rates=[...document.querySelectorAll(".host-rate-input")];
  if(!names.length)return liveHosts;
  return normalizeLiveHosts(names.map((el,i)=>({name:el.value,rate:Number(rates[i]?.value)})));
}
function addLiveHost(){
  const name=normalizeHostName(document.getElementById("newHostName").value),rate=Number(document.getElementById("newHostRate").value);
  if(!name){alert("请输入主播名称");return}if(!Number.isFinite(rate)||rate<0||rate>100){alert("请输入 0 至 100 的佣金百分比");return}
  liveHosts=collectLiveHostSettingsFromForm();
  if(liveHosts.some(h=>h.name.toLowerCase()===name.toLowerCase())){alert("主播名称已经存在");return}
  liveHosts.push({name,rate:Number(rate.toFixed(2))});liveHosts=normalizeLiveHosts(liveHosts);
  document.getElementById("newHostName").value="";document.getElementById("newHostRate").value="";renderLiveHostSettings();renderLiveHostOptions();
}
function removeLiveHost(index){liveHosts=collectLiveHostSettingsFromForm();const host=liveHosts[index];if(!host)return;if(!confirm(`确定移除主播 ${host.name}？\n历史 Live 记录不会删除。`))return;liveHosts.splice(index,1);renderLiveHostSettings();renderLiveHostOptions()}
async function saveLiveHostSettings(){
  const hosts=collectLiveHostSettingsFromForm();
  if(document.querySelectorAll(".host-name-input").length&&hosts.length!==document.querySelectorAll(".host-name-input").length){alert("主播名称或佣金设置不正确，或名称重复");return}
  try{setSync("正在同步 Live 主播设置...");const saved=await saveLiveHostsToSheet(hosts);liveHosts=normalizeLiveHosts(saved||hosts);localStorage.setItem("lover_live_hosts_cache_v690",JSON.stringify(liveHosts));renderLiveHostSettings();renderLiveHostOptions();showTempMsg("liveHostSettingsMsg");setSync("已同步",true)}catch(e){alert("Live 主播设置储存失败："+e.message);setSync("Live 设置同步失败",false,true)}
}
async function resetLiveHostSettings(){
  if(!confirm("确定 Restore Default？\n\n将清空主播设置，但不会删除历史 Live 记录。"))return;
  try{setSync("正在恢复 Live 默认设置...");const saved=await resetLiveHostsInSheet();liveHosts=normalizeLiveHosts(saved||DEFAULT_LIVE_HOSTS);localStorage.setItem("lover_live_hosts_cache_v690",JSON.stringify(liveHosts));renderLiveHostSettings();renderLiveHostOptions();showTempMsg("liveHostSettingsMsg");setSync("已同步",true)}catch(e){alert("Restore Default 失败："+e.message);setSync("Live 设置同步失败",false,true)}
}
function liveId(){return "L"+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,7).toUpperCase()}
async function saveLiveRecord(){
  const date=isoToDisplay(document.getElementById("liveDate").value),host=normalizeHostName(document.getElementById("liveHost").value),company=document.getElementById("liveCompany").value,amount=toAmount(document.getElementById("liveSales").value),notes=document.getElementById("liveNotes").value.trim();
  if(!date){alert("请选择日期");return}if(!host){alert("请先新增并选择主播");return}if(amount<0){alert("营业额不能少于 0");return}
  const rate=getLiveHostRate(host),id=document.getElementById("liveRecordId").value||liveId(),now=new Date().toISOString();
  const row={type:"live",id,date,host,company,amount,commissionRate:rate,commissionAmount:Number((amount*rate/100).toFixed(2)),notes,updatedAt:now,clientUpdatedAt:now};
  liveRows=liveRows.filter(r=>r.id!==id);liveRows.push(row);addPendingRow(row);localStorage.setItem("lover_live_rows_cache_v690",JSON.stringify(liveRows));renderLiveAll();showTempMsg("liveSaveMsg");cancelLiveEdit(false);
  try{setSync("已储存，正在后台同步...");const saved=await saveLiveToSheet(row);if(saved){liveRows=liveRows.filter(r=>r.id!==id);liveRows.push(saved)}clearPendingRow(row);localStorage.setItem("lover_live_rows_cache_v690",JSON.stringify(liveRows));renderLiveAll();setSync("已同步",true)}catch(e){setSync("有未同步 Live 资料，系统会自动重试",false,true)}
}
function editLiveRecord(id){const r=liveRows.find(x=>x.id===id);if(!r)return;document.getElementById("liveRecordId").value=r.id;setDateControl("liveDate",displayToISO(r.date));renderLiveHostOptions();document.getElementById("liveHost").value=r.host;document.getElementById("liveCompany").value=r.company;document.getElementById("liveSales").value=money(r.amount);document.getElementById("liveNotes").value=r.notes||"";document.getElementById("cancelLiveEditBtn").classList.remove("hidden");updateLiveCommissionPreview();window.scrollTo({top:0,behavior:"smooth"})}
function cancelLiveEdit(reset=true){document.getElementById("liveRecordId").value="";document.getElementById("cancelLiveEditBtn").classList.add("hidden");if(reset){setDateControl("liveDate",todayISO());document.getElementById("liveSales").value="0.00";document.getElementById("liveNotes").value="";updateLiveCommissionPreview()}}
async function deleteLiveRecord(id){const r=liveRows.find(x=>x.id===id);if(!r||!confirm(`确定删除 ${r.date} · ${r.host} 的 Live 记录？`))return;const tomb={...r,amount:0,commissionAmount:0,deleted:true,updatedAt:new Date().toISOString(),clientUpdatedAt:new Date().toISOString()};liveRows=liveRows.filter(x=>x.id!==id);addPendingRow(tomb);localStorage.setItem("lover_live_rows_cache_v690",JSON.stringify(liveRows));renderLiveAll();try{setSync("正在同步删除...");await saveLiveToSheet(tomb);clearPendingRow(tomb);setSync("已同步",true)}catch(e){setSync("删除尚未同步，系统会自动重试",false,true)}}
function renderLiveAll(){renderLiveHostOptions();renderLiveRecords();renderLiveReport();renderLiveHostStats();renderLiveHostSettings();updateLiveCommissionPreview()}

document.getElementById("monthPicker").value=monthISO();
document.getElementById("yearPicker").value=currentYear();

setDateControl("saleDate",todayISO());
setDateControl("liveDate",todayISO());
loadCachedLiveData();

const fairSessionRestored=restoreFairSession();

if(!fairSessionRestored){
  setDateControl("fairStart",todayISO());
  setDateControl("fairEnd",todayISO());
}

bindDateControl("saleDate",updateDailyInputFromSelectedDate);
bindDateControl("liveDate",()=>{});

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
document.getElementById("liveHost").addEventListener("change",updateLiveCommissionPreview);
document.getElementById("liveSales").addEventListener("input",updateLiveCommissionPreview);

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
