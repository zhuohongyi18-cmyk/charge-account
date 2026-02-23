const LS_KEY = "simple-bills-v1";

const CATEGORIES = {
  expense: ["餐饮", "交通", "购物", "房租", "娱乐", "学习", "医疗", "其他"],
  income: ["工资", "兼职", "奖金", "理财", "退款", "其他"]
};

const el = (id) => document.getElementById(id);

const formAdd = el("formAdd");
const typeEl = el("type");
const amountEl = el("amount");
const categoryEl = el("category");
const dateEl = el("date");
const noteEl = el("note");
const monthEl = el("month");
const qEl = el("q");
const listEl = el("list");

const sumIncomeEl = el("sumIncome");
const sumExpenseEl = el("sumExpense");
const sumNetEl = el("sumNet");

const btnExport = el("btnExport");
const fileImport = el("fileImport");
const btnClear = el("btnClear");

function todayISO(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function monthISO(dStr){
  // YYYY-MM
  return (dStr || "").slice(0,7);
}

function moneyFmt(n){
  const x = Number(n || 0);
  return x.toFixed(2);
}

function loadBills(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return [];
    const data = JSON.parse(raw);
    if(!Array.isArray(data)) return [];
    return data;
  }catch(e){
    return [];
  }
}

function saveBills(bills){
  localStorage.setItem(LS_KEY, JSON.stringify(bills));
}

let bills = loadBills();

function setCategories(){
  const t = typeEl.value;
  const cats = CATEGORIES[t] || [];
  categoryEl.innerHTML = cats.map(c=>`<option value="${c}">${c}</option>`).join("");
}

function ensureMonthOptions(){
  // 最近 18 个月 + 全部
  const now = new Date();
  const opts = [`<option value="all">全部月份</option>`];
  for(let i=0;i<18;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    opts.push(`<option value="${ym}">${ym}</option>`);
  }
  monthEl.innerHTML = opts.join("");
}

function getFiltered(){
  const m = monthEl.value;
  const q = (qEl.value || "").trim().toLowerCase();

  return bills
    .filter(b => m === "all" ? true : monthISO(b.date) === m)
    .filter(b => {
      if(!q) return true;
      const hay = `${b.category||""} ${b.note||""}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a,b)=> (b.date + b.id).localeCompare(a.date + a.id));
}

function render(){
  const data = getFiltered();

  let income = 0, expense = 0;
  for(const b of data){
    const amt = Number(b.amount || 0);
    if(b.type === "income") income += amt;
    else expense += amt;
  }
  sumIncomeEl.textContent = moneyFmt(income);
  sumExpenseEl.textContent = moneyFmt(expense);
  sumNetEl.textContent = moneyFmt(income - expense);

  if(data.length === 0){
    listEl.innerHTML = `<div class="meta">暂无记录</div>`;
    return;
  }

  listEl.innerHTML = data.map(b=>{
    const cls = b.type === "income" ? "income" : "expense";
    const sign = b.type === "income" ? "+" : "-";
    return `
      <div class="item">
        <div class="left">
          <div>
            <span class="badge">${b.category || "未分类"}</span>
            <span class="meta"> ${b.date}</span>
          </div>
          <div class="meta">${b.note ? b.note : "（无备注）"}</div>
        </div>
        <div class="right">
          <div class="money ${cls}">${sign}${moneyFmt(b.amount)}</div>
          <button class="icon-btn" data-del="${b.id}" title="删除">删</button>
        </div>
      </div>
    `;
  }).join("");
}

function addBill({type, amount, category, date, note}){
  const amt = Number(String(amount).replace(/,/g,""));
  if(!Number.isFinite(amt) || amt <= 0){
    alert("金额请输入大于 0 的数字");
    return;
  }
  const item = {
    id: String(Date.now()),
    type,
    amount: amt,
    category,
    date,
    note: (note || "").trim()
  };
  bills.push(item);
  saveBills(bills);
  render();
}

function delBill(id){
  bills = bills.filter(b=> b.id !== id);
  saveBills(bills);
  render();
}

btnExport.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(bills, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bills-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

fileImport.addEventListener("change", async (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  try{
    const text = await f.text();
    const data = JSON.parse(text);
    if(!Array.isArray(data)) throw new Error("格式不对");
    // 合并（按 id 去重）
    const map = new Map(bills.map(x=>[x.id,x]));
    for(const x of data){
      if(x && x.id) map.set(x.id, x);
    }
    bills = Array.from(map.values());
    saveBills(bills);
    alert("导入成功");
    fileImport.value = "";
    render();
  }catch(err){
    alert("导入失败：请确认是导出的 JSON 文件");
  }
});

btnClear.addEventListener("click", ()=>{
  if(!confirm("确定清空所有记录吗？此操作不可恢复。")) return;
  bills = [];
  saveBills(bills);
  render();
});

typeEl.addEventListener("change", ()=>{
  setCategories();
});

formAdd.addEventListener("submit", (e)=>{
  e.preventDefault();
  addBill({
    type: typeEl.value,
    amount: amountEl.value,
    category: categoryEl.value,
    date: dateEl.value,
    note: noteEl.value
  });
  amountEl.value = "";
  noteEl.value = "";
});

listEl.addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-del]");
  if(!btn) return;
  const id = btn.getAttribute("data-del");
  delBill(id);
});

// init
ensureMonthOptions();
setCategories();
dateEl.value = todayISO();
monthEl.value = monthISO(todayISO());
render();

monthEl.addEventListener("change", render);
qEl.addEventListener("input", render);
const btnDonate = document.getElementById("btnDonate");
const donateModal = document.getElementById("donateModal");
const donateClose = document.getElementById("donateClose");
const donateMask = document.getElementById("donateMask");

function openDonate(){
  donateModal.classList.remove("hidden");
}
function closeDonate(){
  donateModal.classList.add("hidden");
}

btnDonate?.addEventListener("click", openDonate);
donateClose?.addEventListener("click", closeDonate);
donateMask?.addEventListener("click", closeDonate);

// ESC 关闭
window.addEventListener("keydown", (e)=>{
  if(e.key === "Escape" && donateModal && !donateModal.classList.contains("hidden")){
    closeDonate();
  }
});