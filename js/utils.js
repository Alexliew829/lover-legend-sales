function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function isoToDisplay(s){if(!s)return"";if(/^\d{2}-\d{2}-\d{4}$/.test(s))return s;const [y,m,d]=String(s).split("-");return `${d}-${m}-${y}`}
function displayToISO(s){if(!s)return"";if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const [d,m,y]=String(s).split("-");return `${y}-${m}-${d}`}
function monthISO(){return todayISO().slice(0,7)}
function currentYear(){return new Date().getFullYear()}
function sameMonthDisplay(d,m){return displayToISO(d).slice(0,7)===m}
function sameYearDisplay(d,y){return displayToISO(d).slice(0,4)===String(y)}
function money(n){return Number(n||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2})}
function formatAmount(n){return money(n)}
function cleanAmount(v){return String(v||"").replace(/,/g,"").trim()}
function toAmount(v){return Number(cleanAmount(v)||0)}
function formatMoneyInput(i){i.value=formatAmount(toAmount(i.value))}
function moneyFocusHandler(e){e.target.value=cleanAmount(e.target.value);if(e.target.value==="0.00"||e.target.value==="0")e.target.value=""}
function moneyBlurHandler(e){formatMoneyInput(e.target)}
function enterToSaveHandler(e){if(e.key==="Enter"&&e.target.id==="dailySales"){e.preventDefault();saveDailySales()}}
function attachMoneyInputs(){document.querySelectorAll(".money-input").forEach(i=>{i.removeEventListener("focus",moneyFocusHandler);i.removeEventListener("blur",moneyBlurHandler);i.removeEventListener("keydown",enterToSaveHandler);i.addEventListener("focus",moneyFocusHandler);i.addEventListener("blur",moneyBlurHandler);i.addEventListener("keydown",enterToSaveHandler)})}
function dateRange(startISO,endISO){const a=[];const[sy,sm,sd]=startISO.split("-").map(Number);const[ey,em,ed]=endISO.split("-").map(Number);let c=new Date(sy,sm-1,sd);const l=new Date(ey,em-1,ed);while(c<=l){a.push(isoToDisplay(`${c.getFullYear()}-${String(c.getMonth()+1).padStart(2,"0")}-${String(c.getDate()).padStart(2,"0")}`));c.setDate(c.getDate()+1)}return a}
function downloadFile(filename,content,type){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const l=document.createElement("a");l.href=u;l.download=filename;document.body.appendChild(l);l.click();document.body.removeChild(l)}
function getLastDayOfMonth(m){const[y,mo]=m.split("-").map(Number);return new Date(y,mo,0)}
function showTempMsg(id){const e=document.getElementById(id);if(!e)return;e.classList.remove("hidden");setTimeout(()=>e.classList.add("hidden"),2500)}
function nowText(){return new Date().toLocaleTimeString("zh-MY",{hour:"2-digit",minute:"2-digit"})}
function normLoc(s){return String(s||"").trim().replace(/\s+/g," ").toLowerCase()}

function canonicalLocation(value){let s=String(value||"").trim();if(!s)return"";s=s.replace(/[-_]+/g," ").replace(/\s+/g," ").trim();const c=s.replace(/\s+/g,"").toLowerCase();if(c==="sunway"||c==="sunwaymall")return"Sunway";if(c==="ioi"||c==="ioimall")return"IOI";if(c==="midvalley"||c==="midvalleymall")return"Mid Valley";return s.split(" ").map(p=>{const l=p.toLowerCase();if(l==="ioi")return"IOI";if(p.length<=3&&p===p.toUpperCase())return p;return p.charAt(0).toUpperCase()+p.slice(1).toLowerCase()}).join(" ")}
function monthAfter(m){const[y,mo]=m.split("-").map(Number);const d=new Date(y,mo,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function yearAfter(y){return String(Number(y)+1)}

function syncKey(row){
  return [row.type,row.date,row.company,canonicalLocation(row.location||"")].join("|");
}
function monthAfter(m){
  const [y,mo]=m.split("-").map(Number);
  const d=new Date(y,mo,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function yearAfter(y){
  return String(Number(y)+1);
}
