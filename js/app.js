
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
function renderTable(){const s=rows.filter(r=>sameMonth(r.date));const o=[];["balakong","belimbing"].forEach(c=>s.filter(r=>r.type==="daily"&&r.company===c).sort((a,b)=>displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r=>o.push(r)));fairLocationsThisMonth().forEach(l=>s.filter(r=>r.type==="fair"&&(r.location||"Fair")===l).sort((a,b)=>displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r=>o.push(r)));document.getElementById("recordTable").innerHTML=o.map(r=>`<tr><td>${r.date}</td><td>${r.type==="fair"?"Fair":"每日"}</td><td>${companyNames[r.company]||r.company}</td><td>${r.location||"-"}</td><td>${money(r.amount)}</td></tr>`).join("")||'<tr><td colspan="5" style="text-align:center;">这个月份还没有记录</td></tr>'}
function renderAll(){renderDashboard();renderTable();updateDailyInputFromSelectedDate();renderFairLocationOptions()}
async function saveDailySales(){const d=isoToDisplay(document.getElementById("saleDate").value),c=document.getElementById("company").value,a=toAmount(document.getElementById("dailySales").value);if(!d){alert("请选择日期");return}upsertLocalRow({type:"daily",date:d,company:c,location:"",amount:a,updatedAt:new Date().toISOString()});document.getElementById("dailySales").value=formatAmount(a);renderAll();showTempMsg("saveMsg");try{setSync("同步中...");const saved=await saveDailyToSheet(d,c,a);if(saved)upsertLocalRow(saved);renderAll();setSync("已同步",true)}catch(e){setSync("同步失败："+e.message,false,true);alert("同步失败："+e.message)}}
function syncFairInputs(){const start=document.getElementById("fairStart").value,end=document.getElementById("fairEnd").value,loc=canonicalLocation(document.getElementById("fairLocation").value.trim());if(!start||!end||new Date(start)>new Date(end)){document.getElementById("fairInputs").innerHTML="";return}let html="<h3>Fair 每日营业额</h3>";dateRange(start,end).forEach(d=>{const old=rows.find(r=>r.type==="fair"&&r.date===d&&canonicalLocation(r.location)===loc);html+=`<label>${d} 营业额</label><input type="text" class="fairAmount money-input" data-date="${d}" value="${old?formatAmount(old.amount):"0.00"}" inputmode="decimal">`});document.getElementById("fairInputs").innerHTML=html;attachMoneyInputs()}
async function saveFairSales(){const loc=canonicalLocation(document.getElementById("fairLocation").value.trim());const inputs=document.querySelectorAll(".fairAmount");if(!loc){alert("请输入 Fair 地点");return}document.getElementById("fairLocation").value=loc;localStorage.setItem("lover_last_fair_location",loc);saveFairLocation(loc);if(!inputs.length){alert("请选择 Fair 日期");return}const records=[...inputs].map(i=>({date:i.dataset.date,amount:toAmount(i.value)}));removeLocalFairLocationOutsideDates(loc,records.map(r=>r.date));records.forEach(i=>upsertLocalRow({type:"fair",date:i.date,company:"belimbing",location:loc,amount:i.amount,updatedAt:new Date().toISOString()}));renderAll();showTempMsg("fairSaveMsg");try{setSync("同步中...");await saveFairToSheet(loc,records);setSync("已同步",true)}catch(e){setSync("同步失败："+e.message,false,true);alert("Fair 同步失败："+e.message)}}
function exportCSV(scope="month"){let csv="\uFEFF公司,日期,类别,地点,营业额\n";const selected=rows.filter(r=>scope==="year"?sameYear(r.date):sameMonth(r.date));function sec(c,t){let total=0;csv+=`"${t}",,,,\n`;selected.filter(r=>r.type==="daily"&&r.company===c).sort((a,b)=>displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r=>{total+=Number(r.amount||0);csv+=`"${t}",${r.date},"每日","",${Number(r.amount||0).toFixed(2)}\n`});csv+=`"${t} Total",,,,${total.toFixed(2)}\n\n`}sec("balakong","Lover Legend Adenium - Balakong");sec("belimbing","Lover Legend Gardening - Belimbing");let ft=0;csv+='"Fair",,,,\n';[...new Set(selected.filter(r=>r.type==="fair").map(r=>r.location||"Fair"))].sort().forEach(l=>{let lt=0;csv+=`"${l}",,,,\n`;selected.filter(r=>r.type==="fair"&&(r.location||"Fair")===l).sort((a,b)=>displayToISO(a.date).localeCompare(displayToISO(b.date))).forEach(r=>{lt+=Number(r.amount||0);ft+=Number(r.amount||0);csv+=`"Fair",${r.date},"Fair","${r.location||""}",${Number(r.amount||0).toFixed(2)}\n`});csv+=`"${l} Total",,,,${lt.toFixed(2)}\n\n`});csv+=`"Fair Total",,,,${ft.toFixed(2)}\n\n`;const b=selected.filter(r=>r.type==="daily"&&r.company==="balakong").reduce((s,r)=>s+Number(r.amount||0),0);const bl=selected.filter(r=>r.type==="daily"&&r.company==="belimbing").reduce((s,r)=>s+Number(r.amount||0),0);csv+=`"Belimbing Total",,,Belimbing + Fair,${(bl+ft).toFixed(2)}\n`;csv+=`"Grand Total",,,Balakong + Belimbing,${(b+bl+ft).toFixed(2)}\n`;downloadFile(`Lover_Sales_${scope==="year"?selectedYear():selectedMonth()}.csv`,csv,"text/csv;charset=utf-8;")}
function backupData(){downloadFile(`Sales_Backup_${isoToDisplay(todayISO())}.json`,JSON.stringify({app:"Lover Legend Sales V5.1",backupAt:new Date().toISOString(),rows},null,2),"application/json;charset=utf-8;")}
async function restoreData(e){const file=e.target.files[0];if(!file)return;const choice=prompt("Restore 前请选择：\n1 = 先 Backup 再 Restore\n2 = 直接 Restore\n取消 = 不恢复");if(choice===null){e.target.value="";return}if(choice!=="1"&&choice!=="2"){alert("请输入 1 或 2");e.target.value="";return}if(choice==="1")backupData();const reader=new FileReader();reader.onload=async ev=>{try{const b=JSON.parse(ev.target.result),rr=b.rows||[];if(!Array.isArray(rr)){alert("这个备份文件不正确。");return}if(!confirm("确定 Restore？Google Sheet 现有资料会被覆盖。"))return;rows=rr.map(r=>({...r,date:/^\d{4}-\d{2}-\d{2}$/.test(r.date)?isoToDisplay(r.date):r.date}));renderAll();await restoreRowsToSheet(rows);renderAll();setSync("Restore 已同步",true);alert("恢复完成")}catch(err){alert("恢复失败："+err.message)}finally{e.target.value=""}};reader.readAsText(file)}
function monthClose(){const m=selectedMonth();const nextMonth=monthAfter(m);if(!confirm(`确定完成 ${m} 月底结算？
系统会 Backup，并切换到 ${nextMonth}。
历史资料不会删除，年度累计继续保留。`))return;backupData();document.getElementById("monthPicker").value=nextMonth;renderAll();alert("已完成月底结算，进入 "+nextMonth)}
function yearClose(){const y=selectedYear();const ny=yearAfter(y);if(!confirm(`确定完成 ${y} 年底结算？
系统会 Backup 和导出全年 Excel，并切换到 ${ny}。
历史资料不会删除。`))return;backupData();exportCSV("year");document.getElementById("yearPicker").value=ny;document.getElementById("monthPicker").value=`${ny}-01`;renderAll();alert("已完成年底结算，进入 "+ny)}
document.getElementById("monthPicker").value=monthISO();document.getElementById("yearPicker").value=currentYear();document.getElementById("saleDate").value=todayISO();document.getElementById("fairStart").value=todayISO();document.getElementById("fairEnd").value=todayISO();const lastFairLocation=localStorage.getItem("lover_last_fair_location");if(lastFairLocation)document.getElementById("fairLocation").value=canonicalLocation(lastFairLocation);renderFairLocationOptions();
document.getElementById("monthPicker").addEventListener("change",renderAll);document.getElementById("yearPicker").addEventListener("change",renderAll);document.getElementById("saleDate").addEventListener("change",updateDailyInputFromSelectedDate);document.getElementById("company").addEventListener("change",updateDailyInputFromSelectedDate);document.getElementById("fairStart").addEventListener("change",syncFairInputs);document.getElementById("fairEnd").addEventListener("change",syncFairInputs);document.getElementById("fairLocation").addEventListener("input",syncFairInputs);document.getElementById("fairLocation").addEventListener("blur",()=>{document.getElementById("fairLocation").value=canonicalLocation(document.getElementById("fairLocation").value);saveFairLocation(document.getElementById("fairLocation").value);syncFairInputs();});
attachMoneyInputs();if("serviceWorker"in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(()=>{})})}renderAll();loadFromSheet();
