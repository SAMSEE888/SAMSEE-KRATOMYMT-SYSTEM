/* SSKratomYMT Frontend Logic */
const CONFIG = {
  PRICE_PER_BOTTLE: 40,
  SHEET_URL: "https://docs.google.com/spreadsheets/d/11vhg37MbHRm53SSEHLsCI3EBXx5_meXVvlRuqhFteaY", // <- เปลี่ยนได้
  API_URL: "https://script.google.com/macros/s/AKfycbwWEfiRR7yq30r8z0xXrbjPA9pjd88-y6t0IdD5Kq2KTzjPO_QyOTK4odEu0e65vUSf/exec" // <- วาง URL Web App ของ Apps Script
};

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const fmtTHB = (n) => (n ?? 0).toLocaleString('th-TH');
const parseNum = (v) => Number(v || 0);
const showLoading = (b) => $("#loadingOverlay").style.display = b ? "flex" : "none";

function todayISO() {
  const t = new Date();
  const tz = new Date(t.getTime() - (t.getTimezoneOffset() * 60000));
  return tz.toISOString().slice(0,10);
}

// ---------- Tabs ----------
document.addEventListener('DOMContentLoaded', () => {
  $("#currentDate").textContent = new Date().toLocaleDateString('th-TH', { weekday: 'long', year:'numeric', month:'long', day:'numeric' });
  $$(".tab-btn").forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));
  $("#date").value = todayISO();
  $("#openSheetBtn").addEventListener('click', () => window.open(CONFIG.SHEET_URL, "_blank"));

  initSalesForm();
  initMaterialCalc();
  initDashboard();
  initBackup();
});

function activateTab(id) {
  $$(".tab-content").forEach(c => c.classList.remove('active'));
  $$(".tab-btn").forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${id}"]`).classList.add('active');
  if (id === 'dashboard-tab') refreshDashboard();
}

// ---------- Sales Form ----------
function initSalesForm() {
  const price = CONFIG.PRICE_PER_BOTTLE;
  const sold = $("#sold");
  const pending = $("#pending");
  const cleared = $("#cleared");
  const pipeFee = $("#pipeFee");
  const shareFee = $("#shareFee");
  const otherFee = $("#otherFee");
  const saveFee = $("#saveFee");
  const dateInput = $("#date");

  function calcRevenue() {
    const rev = (parseNum(sold.value) + parseNum(cleared.value) - parseNum(pending.value)) * price;
    $("#revenue").textContent = fmtTHB(rev);
    return rev;
  }
  function calcExpense() {
    const exp = parseNum(pipeFee.value) + parseNum(shareFee.value) + parseNum(otherFee.value) + parseNum(saveFee.value);
    $("#expense").textContent = fmtTHB(exp);
    return exp;
  }
  function calcBalance() {
    const bal = calcRevenue() - calcExpense();
    $("#balance").textContent = fmtTHB(bal);
    return bal;
  }

  [sold, pending, cleared, pipeFee, shareFee, otherFee, saveFee].forEach(i => i.addEventListener('input', calcBalance));
  calcBalance();

  $("#saleForm").addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = dateInput.value;
    if (!d) return showMsg('❌ โปรดเลือกวันที่', 'error');

    // Confirm preview (validation before save)
    const payload = {
      date: d,
      sold: parseNum(sold.value),
      pending: parseNum(pending.value),
      cleared: parseNum(cleared.value),
      revenue: calcRevenue(),
      pipeFee: parseNum(pipeFee.value),
      shareFee: parseNum(shareFee.value),
      otherFee: parseNum(otherFee.value),
      saveFee: parseNum(saveFee.value),
      expense: calcExpense(),
      balance: calcBalance()
    };

    const preview =
`โปรดยืนยันข้อมูลที่จะบันทึก
----------------------------------
วันที่: ${payload.date}
จำนวนขาย (ขวด): ${payload.sold}
ค้างน้ำดิบ (ขวด): ${payload.pending}
เคลียร์ค้าง (ขวด): ${payload.cleared}
รายรับ (บาท): ${fmtTHB(payload.revenue)}
ค่าท่อม: ${fmtTHB(payload.pipeFee)}
ค่าแชร์: ${fmtTHB(payload.shareFee)}
ค่าใช้จ่ายอื่น: ${fmtTHB(payload.otherFee)}
เก็บออม: ${fmtTHB(payload.saveFee)}
รายจ่ายรวม: ${fmtTHB(payload.expense)}
ยอดคงเหลือ: ${fmtTHB(payload.balance)}
----------------------------------
กด OK เพื่อยืนยัน / Cancel เพื่อแก้ไข`;

    if (!confirm(preview)) return;

    showMsg('⏳ กำลังบันทึกข้อมูล...', 'loading');
    try {
      showLoading(true);
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        showMsg('✅ บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
        $("#saleForm").reset();
        $("#date").value = todayISO();
        calcBalance();
        // refresh dashboard silently
        refreshDashboard();
      } else {
        showMsg(`❌ เกิดข้อผิดพลาด: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showMsg(`❌ เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
      showLoading(false);
    }
  });
}

function showMsg(text, type) {
  const m = $("#msg");
  m.textContent = text;
  m.className = `msg-box ${type || ''}`;
}

// ---------- Material Calculator ----------
function initMaterialCalc() {
  const leafInput = $("#leafInput");
  const waterInput = $("#waterInput");
  const yieldInput = $("#yieldInput");
  const resultContainer = $("#resultContainer");
  const resultGroundLeaf = $("#resultGroundLeaf");
  const resultGroundWater = $("#resultGroundWater");
  const resultGroundYield = $("#resultGroundYield");
  const resultNotGroundLeaf1 = $("#resultNotGroundLeaf1");
  const resultNotGroundWater1 = $("#resultNotGroundWater1");
  const resultNotGroundYield1 = $("#resultNotGroundYield1");
  const resultNotGroundLeaf2 = $("#resultNotGroundLeaf2");
  const resultNotGroundWater2 = $("#resultNotGroundWater2");
  const resultNotGroundYield2 = $("#resultNotGroundYield2");

  $("#calculateButton").addEventListener('click', (e) => {
    e.preventDefault();
    const leaf = parseFloat(leafInput.value) || 0;
    const water = parseFloat(waterInput.value) || 0;
    const desired = parseFloat(yieldInput.value) || 0;
    if (leaf < 0 || water < 0 || desired < 0) return alert('⚠️ กรุณากรอกค่าที่เป็นบวกเท่านั้น!');

    let gLeaf=0,gWater=0,gYield=0, n1Leaf=0,n1Water=0,n1Yield=0, n2Leaf=0,n2Water=0,n2Yield=0;
    const groundLeafToWater = 20;
    const groundWaterToYield = 15/20;
    const notGroundLeafToWater1 = 15.38;
    const notGroundWaterToYield1 = 12/15.38;
    const notGroundLeafToWater2 = 15.87302;
    const notGroundWaterToYield2 = 12/15.87302;

    if (leaf>0) {
      gLeaf=leaf; gWater=leaf*groundLeafToWater; gYield=gWater*groundWaterToYield;
      n1Leaf=leaf; n1Water=leaf*notGroundLeafToWater1; n1Yield=n1Water*notGroundWaterToYield1;
      n2Leaf=leaf; n2Water=leaf*notGroundLeafToWater2; n2Yield=n2Water*notGroundWaterToYield2;
    } else if (water>0) {
      gWater=water; gLeaf=water/groundLeafToWater; gYield=water*groundWaterToYield;
      n1Water=water; n1Leaf=water/notGroundLeafToWater1; n1Yield=water*notGroundWaterToYield1;
      n2Water=water; n2Leaf=water/notGroundLeafToWater2; n2Yield=water*notGroundWaterToYield2;
    } else if (desired>0) {
      gYield=desired; gWater=desired/groundWaterToYield; gLeaf=gWater/groundLeafToWater;
      n1Yield=desired; n1Water=desired/notGroundWaterToYield1; n1Leaf=n1Water/notGroundLeafToWater1;
      n2Yield=desired; n2Water=desired/notGroundWaterToYield2; n2Leaf=n2Water/notGroundLeafToWater2;
    } else {
      return alert('⚠️ กรุณากรอกค่าข้อมูลอย่างน้อยหนึ่งช่อง!');
    }

    resultGroundLeaf.textContent = gLeaf.toFixed(2);
    resultGroundWater.textContent = gWater.toFixed(2);
    resultGroundYield.textContent = gYield.toFixed(2);
    resultNotGroundLeaf1.textContent = n1Leaf.toFixed(2);
    resultNotGroundWater1.textContent = n1Water.toFixed(2);
    resultNotGroundYield1.textContent = n1Yield.toFixed(2);
    resultNotGroundLeaf2.textContent = n2Leaf.toFixed(2);
    resultNotGroundWater2.textContent = n2Water.toFixed(2);
    resultNotGroundYield2.textContent = n2Yield.toFixed(2);
    resultContainer.style.display = 'block';
  });

  $("#resetButton").addEventListener('click', (e) => {
    e.preventDefault();
    leafInput.value = ""; waterInput.value=""; yieldInput.value="";
    resultContainer.style.display = 'none';
  });
}

// ---------- Dashboard ----------
let salesChart, feesChart, originalData = [], sortDirection = {};
function initDashboard() {
  $("#applyFilterBtn").addEventListener('click', (e)=>{ e.preventDefault(); refreshDashboard(); });
  $("#resetFilterBtn").addEventListener('click', (e)=>{ e.preventDefault(); $("#filterStartDate").value=""; $("#filterEndDate").value=""; $("#filterTimeframe").value="month"; refreshDashboard(); });
  $$(".sortable-header").forEach(h => h.addEventListener('click', ()=> sortData(h.dataset.sort)));
  $("#show50Btn").addEventListener('click', ()=> updateTable(getFilteredData().slice(-50)));
  $("#showAllBtn").addEventListener('click', ()=> updateTable(getFilteredData()));
}

async function fetchAllData() {
  const url = `${CONFIG.API_URL}?action=getData`;
  const res = await fetch(url);
  return await res.json();
}

function getFilteredData() {
  const timeframe = $("#filterTimeframe").value;
  const start = $("#filterStartDate").value;
  const end = $("#filterEndDate").value;
  let data = [...originalData];
  if (start) data = data.filter(d => d.date >= start);
  if (end) data = data.filter(d => d.date <= end);
  // Aggregate by timeframe
  if (['day','week','month','year'].includes(timeframe)) {
    const groups = {};
    data.forEach(item => {
      const dt = new Date(item.date);
      let key = item.date;
      if (timeframe === 'week') {
        const s = new Date(dt); s.setDate(dt.getDate() - dt.getDay());
        key = `${s.getFullYear()}-W${String(getWeekNumber(dt)).padStart(2,'0')}`;
      } else if (timeframe === 'month') {
        key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      } else if (timeframe === 'year') {
        key = `${dt.getFullYear()}`;
      }
      if (!groups[key]) groups[key] = {key, sold:0, revenue:0, expense:0, balance:0, pipeFee:0, shareFee:0, otherFee:0, saveFee:0, count:0, date:key};
      groups[key].sold += item.sold;
      groups[key].revenue += item.revenue;
      const exp = item.pipeFee + item.shareFee + item.otherFee + item.saveFee;
      groups[key].expense += exp;
      groups[key].balance += item.balance;
      groups[key].pipeFee += item.pipeFee;
      groups[key].shareFee += item.shareFee;
      groups[key].otherFee += item.otherFee;
      groups[key].saveFee += item.saveFee;
      groups[key].count += 1;
    });
    data = Object.values(groups).sort((a,b)=> a.key.localeCompare(b.key));
  }
  return data;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}

function calcMetrics(data) {
  const totalSold = data.reduce((s,i)=>s+i.sold,0);
  const totalRevenue = data.reduce((s,i)=>s+i.revenue,0);
  const totalExpense = data.reduce((s,i)=>s+(i.pipeFee+i.shareFee+i.otherFee+i.saveFee || i.expense || 0),0);
  const totalProfit = totalRevenue - totalExpense;
  const profitMargin = totalRevenue > 0 ? (totalProfit/totalRevenue*100) : 0;

  const n = data.length || 1;
  const avgSold = totalSold / n;
  const avgRevenue = totalRevenue / n;
  const avgProfit = totalProfit / n;

  let growth = 0;
  if (data.length >= 2) {
    const first = data[0].revenue;
    const last = data[data.length-1].revenue;
    growth = first > 0 ? ((last-first)/first*100) : 0;
  }
  return { totalSold, totalRevenue, totalExpense, totalProfit, profitMargin, avgSold, avgRevenue, avgProfit, growth };
}

function refreshDashboard() {
  showLoading(true);
  fetchAllData().then(arr => {
    // Ensure types
    originalData = arr.map(r => ({
      date: r.date,
      sold: Number(r.sold)||0,
      pending: Number(r.pending)||0,
      cleared: Number(r.cleared)||0,
      revenue: Number(r.revenue)||0,
      pipeFee: Number(r.pipeFee)||0,
      shareFee: Number(r.shareFee)||0,
      otherFee: Number(r.otherFee)||0,
      saveFee: Number(r.saveFee)||0,
      expense: Number(r.expense)|| (Number(r.pipeFee)+Number(r.shareFee)+Number(r.otherFee)+Number(r.saveFee)),
      balance: Number(r.balance)||0
    }));
    const filtered = getFilteredData();
    const m = calcMetrics(filtered);

    $("#totalSold").textContent = fmtTHB(m.totalSold);
    $("#totalRevenue").textContent = fmtTHB(m.totalRevenue);
    $("#totalExpense").textContent = fmtTHB(m.totalExpense);
    $("#totalProfit").textContent = fmtTHB(m.totalProfit);
    $("#profitMargin").textContent = `${m.profitMargin.toFixed(2)}%`;
    $("#avgSold").textContent = fmtTHB(m.avgSold.toFixed(1));
    $("#avgRevenue").textContent = fmtTHB(m.avgRevenue.toFixed(0));
    $("#avgProfit").textContent = fmtTHB(m.avgProfit.toFixed(0));
    $("#growthRate").textContent = `${m.growth.toFixed(2)}%`;

    updateCharts(filtered);
    updateTable(filtered.slice(-50));
  }).catch(err => {
    alert("ดึงข้อมูลไม่สำเร็จ: " + err.message);
  }).finally(()=> showLoading(false));
}

function updateCharts(data) {
  const labels = data.map(d=>d.date);
  const soldArr = data.map(d=>d.sold);
  const revenueArr = data.map(d=>d.revenue);
  const expenseArr = data.map(d=> (d.expense ?? (d.pipeFee+d.shareFee+d.otherFee+d.saveFee)));
  const balanceArr = data.map(d=>d.balance);

  // Sales Chart (mixed)
  if (salesChart) salesChart.destroy();
  salesChart = new Chart(document.getElementById('salesChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type:'line', label: 'Sold', data: soldArr, borderWidth: 2, fill: false },
        { type:'bar', label: 'Revenue', data: revenueArr, borderWidth: 1 },
        { type:'bar', label: 'Expense', data: expenseArr, borderWidth: 1 },
        { type:'line', label: 'Balance', data: balanceArr, borderWidth: 2, fill: false }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, scales: { y: { beginAtZero:true } } }
  });

  // Fees Breakdown
  const feeTotal = {
    'Pipe Fee': data.reduce((s,i)=>s+i.pipeFee,0),
    'Share Fee': data.reduce((s,i)=>s+i.shareFee,0),
    'Other Fee': data.reduce((s,i)=>s+i.otherFee,0),
    'Save Fee': data.reduce((s,i)=>s+i.saveFee,0)
  };
  if (feesChart) feesChart.destroy();
  feesChart = new Chart(document.getElementById('feesChart').getContext('2d'), {
    type:'doughnut',
    data: { labels: Object.keys(feeTotal), datasets: [{ data: Object.values(feeTotal) }]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right' } } }
  });
}

function updateTable(data) {
  const tbody = $("#dataTable");
  tbody.innerHTML = "";
  data.forEach(item => {
    const tr = document.createElement('tr');
    const exp = item.expense ?? (item.pipeFee+item.shareFee+item.otherFee+item.saveFee);
    tr.innerHTML = `
      <td>${new Date(item.date).toLocaleDateString('th-TH')}</td>
      <td>${fmtTHB(item.sold)}</td>
      <td>${fmtTHB(item.revenue)}</td>
      <td>${fmtTHB(exp)}</td>
      <td>${fmtTHB(item.balance)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function sortData(key) {
  sortDirection[key] = sortDirection[key] === 'asc' ? 'desc' : 'asc';
  const sorted = getFilteredData().sort((a,b)=>{
    let av = key==='date' ? new Date(a.date) : a[key];
    let bv = key==='date' ? new Date(b.date) : b[key];
    if (av<bv) return sortDirection[key]==='asc' ? -1 : 1;
    if (av>bv) return sortDirection[key]==='asc' ? 1 : -1;
    return 0;
  });
  updateTable(sorted.slice(-50));
}

// ---------- Backup ----------
function initBackup() {
  $("#downloadCSV").addEventListener('click', ()=> downloadBackup('csv'));
  $("#downloadJSON").addEventListener('click', ()=> downloadBackup('json'));
}

async function downloadBackup(type='csv') {
  try {
    const url = `${CONFIG.API_URL}?action=backup&type=${type}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('ดาวน์โหลดไม่สำเร็จ');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const now = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.download = `SSKratomYMT-backup-${now}.${type}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    alert('เกิดข้อผิดพลาดในการสำรองข้อมูล: ' + e.message);
  }

// ========== Global Config ==========
const API_URL = "https://script.google.com/macros/s/AKfycbwWEfiRR7yq30r8z0xXrbjPA9pjd88-y6t0IdD5Kq2KTzjPO_QyOTK4odEu0e65vUSf/exec"; // ใส่ URL จาก Deploy ของ Apps Script

// Utility: fetch with error handling
async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error("HTTP error " + res.status);
    return await res.json();
  } catch (err) {
    console.error("Fetch error:", err);
    alert("❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือลองใหม่");
    return null;
  }
}

// บันทึกข้อมูล
async function saveData(data) {
  const res = await safeFetch(API_URL, {
    method: "POST",
    body: JSON.stringify(data)
  });
  if (res && res.success) {
    alert("✅ บันทึกข้อมูลสำเร็จ");
  }
}

// โหลดข้อมูลล่าสุด
async function loadData(filter = "daily") {
  const res = await safeFetch(`${API_URL}?action=getData`);
  if (res) {
    renderTable(res, filter);
    renderCharts(res, filter);
  }
}

}
