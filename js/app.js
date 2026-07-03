
function getSavedFairLocations(){
  try{
    return JSON.parse(localStorage.getItem("lover_fair_locations")||"[]");
  }catch(e){
    return [];
  }
}

function saveFairLocation(location){
  const loc=canonicalLocation(location);
  if(!loc)return;
  const list=getSavedFairLocations();
  const exists=list.some(x=>canonicalLocation(x)===loc);
  if(!exists)list.push(loc);
  list.sort();
  localStorage.setItem("lover_fair_locations",JSON.stringify(list));
  renderFairLocationOptions();
}

function collectFairLocations(){
  const fromRows=[...new Set(rows.filter(r=>r.type==="fair").map(r=>canonicalLocation(r.location)).filter(Boolean))];
  const fromStorage=getSavedFairLocations();
  const merged=[];
  [...fromRows,...fromStorage].forEach(x=>{
    const loc=canonicalLocation(x);
    if(loc&&!merged.some(y=>canonicalLocation(y)===loc))merged.push(loc);
  });
  merged.sort();
  localStorage.setItem("lover_fair_locations",JSON.stringify(merged));
  return merged;
}

function renderFairLocationOptions(){
  const el=document.getElementById("fairLocationListOptions");
  if(!el)return;
  const list=collectFairLocations();
  el.innerHTML=list.map(loc=>`<option value="${loc}"></option>`).join("");
}

const companyNames={balakong:"Lover Legend Adenium - Balakong",belimbing:"Lover Legend Gardening - Belimbing"};
function selectedMonth(){return document.getElementById("monthPicker").value}
function selectedYear(){return document.getElementById("yearPicker").value}
function sameMonth(date){return sameMonthDisplay(date,selectedMonth())}
function sameYear(date){return sameYearDisplay(date,selectedYear())}
function showPage(name,el){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.getElementById("page-"+name).classList.add("active");document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));el.classList.add("active")}
function upsertLocalRow(n){const i=rows.findIndex(r=>r.type===n.type&&r.date===n.date&&r.company===n.company&&(r.location||"")===(n.location||""));if(i>=0)rows[i]=n;else rows.push(n)}
function removeLocalFairLocationOutsideDates(location,keepDates){const nl=canonicalLocation(location);rows=rows.filter(r=>{if(r.type!=="fair")return true;if(canonicalLocation(r.location)!==nl)return true;return keepDates.includes(r.date)})}
function getDailyAmount(d,c){const f=rows.find(r=>r.type==="daily"&&r.date===d&&r.company===c);return f?Number(f.amount||0):0}
function updateDailyInputFromSelectedDate(){const d=isoToDisplay(document.getElementById("saleDate").value);const c=document.getElementById("company").value;const a=getDailyAmount(d,c);document.getElementById("dailySales").value=formatAmount(a);document.getElementById("salesDateResult").textContent=`${companyNames[c]}｜${d}｜${money(a)}`}
function totalBy(type,company="",mode="month"){return rows.filter(r=>r.type===type).filter(r=>company?r.company===company:true).filter(r=>{if(mode==="today")return r.date===isoToDisplay(todayISO());if(mode==="month")return sameMonth(r.date);if(mode==="year")return sameYear(r.date);return true}).reduce((s,r)=>s+Number(r.amount||0),0)}
function fairLocationsThisMonth(){return [...new Set(rows.filter(r=>r.type==="fair"&&sameMonth(r.date)).map(r=>canonicalLocation(r.location||"Fair")))].sort()}
function fairByLocation(){const g={};rows.filter(r=>r.type==="fair"&&sameMonth(r.date)).forEach(r=>{const l=canonicalLocation(r.location||"Fair");g[l]=(g[l]||0)+Number(r.amount||0)});return g}
function renderFairLocationList(){const g=fairByLocation();const locs=Object.keys(g).sort();const c=document.getElementById("fairLocationList");if(!locs.length){c.innerHTML='<div class="sub">这个月份还没有 Fair 记录</div>';return}c.innerHTML='<div class="fair-location-grid">'+locs.map(l=>`<div class="fair-location-card"><div class="fair-location-title">${l}</div><div class="fair-location-row"><span>营业额</span><b>${money(g[l])}</b></div><div class="fair-location-row"><span>佣金 6%</span><b>${money(g[l]*0.06)}</b></div></div>`).join("")+'</div>'}
function renderDashboard(){const bt=totalBy("daily","balakong","today"),blt=totalBy("daily","belimbing","today"),ft=totalBy("fair","","today");const bm=totalBy("daily","balakong","month"),blm=totalBy("daily","belimbing","month"),fm=totalBy("fair","","month");const by=totalBy("daily","balakong","year"),bly=totalBy("daily","belimbing","year"),fy=totalBy("fair","","year");document.getElementById("balakongMonth").textContent=money(bm);document.getElementById("belimbingMonth").textContent=money(blm);renderFairLocationList();document.getElementById("fairMonthTotal").textContent=money(fm);document.getElementById("fairCommissionTotal").textContent=money(fm*0.06);document.getElementById("monthGrandTotal").textContent=money(bm+blm+fm);document.getElementById("balakongYearTotal").textContent=money(by);document.getElementById("belimbingYearTotal").textContent=money(bly+fy);document.getElementById("yearGrandTotal").textContent=money(by+bly+fy);document.getElementById("todayWarning").classList.toggle("hidden",!(bt===0&&blt===0&&ft===0));document.getElementById("todayDone").classList.toggle("hidden",bt===0&&blt===0&&ft===0)}
function renderTable(){const s=rows.filter(r=>sameMonth(r.date)&&Number(r.amount)>0);const o=[];["balakong","belimbing"].forEach(c=>s.filter(r=>r.type==="daily"&&r.company===c).sort((a,b)=>displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r=>o.push(r)));fairLocationsThisMonth().forEach(l=>s.filter(r=>r.type==="fair"&&(r.location||"Fair")===l).sort((a,b)=>displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r=>o.push(r)));document.getElementById("recordTable").innerHTML=o.map(r=>`<tr><td>${r.date}</td><td>${r.type==="fair"?"Fair":"每日"}</td><td>${companyNames[r.company]||r.company}</td><td>${r.location||"-"}</td><td>${money(r.amount)}</td></tr>`).join("")||'<tr><td colspan="5" style="text-align:center;">这个月份还没有记录</td></tr>'}
function renderAll(){renderDashboard();renderTable();updateDailyInputFromSelectedDate();renderFairLocationOptions()}
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
    setSync("同步中...");
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
  localStorage.setItem("lover_last_fair_location",loc);
  saveFairLocation(loc);

  if(!inputs.length){
    alert("请选择 Fair 日期");
    return;
  }

  const records=[...inputs].map(i=>({
    date:i.dataset.date,
    amount:toAmount(i.value),
    clientUpdatedAt:new Date().toISOString()
  }));

  removeLocalFairLocationOutsideDates(loc,records.map(r=>r.date));

  records.forEach(i=>{
    const row={
      type:"fair",
      date:i.date,
      company:"belimbing",
      location:loc,
      amount:i.amount,
      updatedAt:new Date().toISOString(),
      clientUpdatedAt:i.clientUpdatedAt
    };
    upsertLocalRow(row);
    addPendingRow(row);
  });

  renderAll();
  showTempMsg("fairSaveMsg");

  try{
    setSync("同步中...");
    await saveFairToSheet(loc,records);
    records.forEach(i=>clearPendingRow({type:"fair",date:i.date,company:"belimbing",location:loc,amount:i.amount}));
    setSync("已同步",true);
  }catch(e){
    setSync("有未同步资料，系统会自动重试",false,true);
  }
}

function exportCSV(scope="month"){let csv="\uFEFF公司,日期,类别,地点,营业额\n";const selected=rows.filter(r=>(scope==="year"?sameYear(r.date):sameMonth(r.date))&&Number(r.amount)>0);function sec(c,t){let total=0;csv+=`"${t}",,,,\n`;selected.filter(r=>r.type==="daily"&&r.company===c).sort((a,b)=>displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r=>{total+=Number(r.amount||0);csv+=`"${t}",${r.date},"每日","",${Number(r.amount||0).toFixed(2)}\n`});csv+=`"${t} Total",,,,${total.toFixed(2)}\n\n`}sec("balakong","Lover Legend Adenium - Balakong");sec("belimbing","Lover Legend Gardening - Belimbing");let ft=0;csv+='"Fair",,,,\n';[...new Set(selected.filter(r=>r.type==="fair").map(r=>r.location||"Fair"))].sort().forEach(l=>{let lt=0;csv+=`"${l}",,,,\n`;selected.filter(r=>r.type==="fair"&&(r.location||"Fair")===l).sort((a,b)=>displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r=>{lt+=Number(r.amount||0);ft+=Number(r.amount||0);csv+=`"Fair",${r.date},"Fair","${r.location||""}",${Number(r.amount||0).toFixed(2)}\n`});csv+=`"${l} Total",,,,${lt.toFixed(2)}\n\n`});csv+=`"Fair Total",,,,${ft.toFixed(2)}\n\n`;const b=selected.filter(r=>r.type==="daily"&&r.company==="balakong").reduce((s,r)=>s+Number(r.amount||0),0);const bl=selected.filter(r=>r.type==="daily"&&r.company==="belimbing").reduce((s,r)=>s+Number(r.amount||0),0);csv+=`"Belimbing Total",,,Belimbing + Fair,${(bl+ft).toFixed(2)}\n`;csv+=`"Grand Total",,,Balakong + Belimbing,${(b+bl+ft).toFixed(2)}\n`;downloadFile(`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.csv`,csv,"text/csv;charset=utf-8;")}
function backupData(){downloadFile(`Sales_Backup_${isoToDisplay(todayISO())}.json`,JSON.stringify({app:"Lover Legend Sales V5.1",backupAt:new Date().toISOString(),rows},null,2),"application/json;charset=utf-8;")}
async function restoreData(e){
  const file=e.target.files[0];
  if(!file)return;

  const reader=new FileReader();

  reader.onload=async ev=>{
    try{
      const backupConfirm=confirm("Restore 会先自动 Backup 目前资料。\n\n确认继续？");
      if(!backupConfirm){
        e.target.value="";
        return;
      }

      let parsed=JSON.parse(ev.target.result);
      let rr=Array.isArray(parsed)?parsed:(parsed.rows||[]);

      if(!Array.isArray(rr)||rr.length===0){
        alert("Restore 文件没有资料，已取消。Google Sheet 没有被清空。");
        e.target.value="";
        return;
      }

      const cleaned=rr.map(r=>({
        type:r.type==="fair"?"fair":"daily",
        date:/^\d{4}-\d{2}-\d{2}$/.test(r.date)?isoToDisplay(r.date):r.date,
        company:String(r.company||"").toLowerCase().includes("balakong")?"balakong":"belimbing",
        location:canonicalLocation(r.location||""),
        amount:Number(r.amount||0),
        updatedAt:r.updatedAt||new Date().toISOString()
      })).filter(r=>r.date&&r.company&&(r.type==="daily"||r.type==="fair"));

      if(cleaned.length===0){
        alert("Restore 文件格式不正确，已取消。Google Sheet 没有被清空。");
        e.target.value="";
        return;
      }

      backupData();

      if(!confirm(`Restore 文件共有 ${cleaned.length} 笔资料。\n\n确定覆盖 Google Sheet 现有资料？`)){
        e.target.value="";
        return;
      }

      setSync("正在 Restore...");
      rows=cleaned;
      renderAll();

      await restoreRowsToSheet(rows);

      pendingRows=[];
      savePendingRows();

      renderAll();
      setSync("Restore 已同步",true);
      alert("恢复完成，共导入 "+cleaned.length+" 笔资料。");
    }catch(err){
      alert("恢复失败："+err.message);
    }finally{
      e.target.value="";
    }
  };

  reader.readAsText(file);
}

function monthClose(){
  const m=selectedMonth();
  const nextMonth=monthAfter(m);
  if(!confirm(`确定完成 ${m} 月底结算？
系统会 Backup，并切换到 ${nextMonth}。
历史资料不会删除，年度累计继续保留。`))return;
  backupData();
  document.getElementById("monthPicker").value=nextMonth;
  renderAll();
  alert("已完成月底结算，进入 "+nextMonth);
}

function yearClose(){const y=selectedYear();const ny=yearAfter(y);if(!confirm(`确定完成 ${y} 年底结算？
系统会 Backup 和导出全年 Excel，并切换到 ${ny}。
历史资料不会删除。`))return;backupData();exportCSV("year");document.getElementById("yearPicker").value=ny;document.getElementById("monthPicker").value=`${ny}-01`;renderAll();alert("已完成年底结算，进入 "+ny)}
document.getElementById("monthPicker").value=monthISO();document.getElementById("yearPicker").value=currentYear();document.getElementById("saleDate").value=todayISO();document.getElementById("fairStart").value=todayISO();document.getElementById("fairEnd").value=todayISO();renderFairLocationOptions();
document.getElementById("monthPicker").addEventListener("change",renderAll);document.getElementById("yearPicker").addEventListener("change",renderAll);document.getElementById("saleDate").addEventListener("change",updateDailyInputFromSelectedDate);document.getElementById("company").addEventListener("change",updateDailyInputFromSelectedDate);document.getElementById("fairStart").addEventListener("change",syncFairInputs);document.getElementById("fairEnd").addEventListener("change",syncFairInputs);document.getElementById("fairLocation").addEventListener("input",syncFairInputs);document.getElementById("fairLocation").addEventListener("blur",()=>{document.getElementById("fairLocation").value=canonicalLocation(document.getElementById("fairLocation").value);saveFairLocation(document.getElementById("fairLocation").value);syncFairInputs();});
attachMoneyInputs();if("serviceWorker"in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(()=>{})})}renderAll();loadFromSheet();
