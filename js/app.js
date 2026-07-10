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
function renderDashboard(){const bt=totalBy("daily","balakong","today"),blt=totalBy("daily","belimbing","today"),ft=totalBy("fair","","today"),bm=totalBy("daily","balakong","month"),blm=totalBy("daily","belimbing","month"),fm=totalBy("fair","","month"),by=totalBy("daily","balakong","year"),bly=totalBy("daily","belimbing","year"),fy=totalBy("fair","","year");document.getElementById("balakongMonth").textContent=money(bm);document.getElementById("belimbingMonth").textContent=money(blm);renderFairLocationList();document.getElementById("fairMonthTotal").textContent=money(fm);document.getElementById("fairCommissionTotal").textContent=money(fm*.06);document.getElementById("monthGrandTotal").textContent=money(bm+blm+fm);document.getElementById("balakongYearTotal").textContent=money(by);document.getElementById("belimbingYearTotal").textContent=money(bly);document.getElementById("fairYearTotal").textContent=money(fy);document.getElementById("yearGrandTotal").textContent=money(by+bly+fy);document.getElementById("todayWarning").classList.toggle("hidden",!(bt===0&&blt===0&&ft===0));document.getElementById("todayDone").classList.toggle("hidden",bt===0&&blt===0&&ft===0)}
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
document.getElementById("monthPicker").value=monthISO();document.getElementById("yearPicker").value=currentYear();setDateControl("saleDate",todayISO());setDateControl("fairStart",todayISO());setDateControl("fairEnd",todayISO());bindDateControl("saleDate",updateDailyInputFromSelectedDate);bindDateControl("fairStart",syncFairInputs);bindDateControl("fairEnd",syncFairInputs);renderFairLocationOptions();document.getElementById("monthPicker").addEventListener("change",renderAll);document.getElementById("yearPicker").addEventListener("change",renderAll);document.getElementById("company").addEventListener("change",updateDailyInputFromSelectedDate);document.getElementById("fairLocation").addEventListener("input",syncFairInputs);document.getElementById("fairLocation").addEventListener("blur",()=>{document.getElementById("fairLocation").value=canonicalLocation(document.getElementById("fairLocation").value);saveFairLocation(document.getElementById("fairLocation").value);syncFairInputs()});attachMoneyInputs();if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));renderAll();loadFromSheet();
