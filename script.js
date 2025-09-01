/* SSKratomYMT Frontend Logic (ฉบับแก้ไขสมบูรณ์) */
const CONFIG = {
  PRICE_PER_BOTTLE: 40,
  // **สำคัญ:** ใส่ URL ของ Google Sheet ของคุณที่นี่
  SHEET_URL: "https://docs.google.com/spreadsheets/d/11vhg37MbHRm53SSEHLsCI3EBXx5_meXVvlRuqhFteaY",
  // **สำคัญ:** ใส Web App URL ที่ได้จากการ Deploy สคริปต์ของคุณที่นี่
  API_URL: "https://script.google.com/macros/s/AKfycbyP2LmGwRzGKNr1zqUpoQjpkpj-0C-W4tp4XrK5T9hwf64Odeb4ElRFLI6vYsBYvMx5/exec"
};

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const fmtTHB = (n) => (n ?? 0).toLocaleString('th-TH');
const parseNum = (v) => Number(v || 0);
const showLoading = (b) => $("#loadingOverlay").style.display = b ? "flex" : "none";

/**
 * สร้างวันที่ปัจจุบันในรูปแบบ YYYY-MM-DD ตามโซนเวลาของผู้ใช้
 * @returns {string}
 */
function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---------- Tabs ----------
document.addEventListener('DOMContentLoaded', () => {
  $("#currentDate").textContent = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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
  if (id === 'dashboard-tab' && !window.dashboardLoaded) {
    refreshDashboard();
    window.dashboardLoaded = true;
  }
}

// ---------- Sales Form ----------
function initSalesForm() {
  const price = CONFIG.PRICE_PER_BOTTLE;
  const form = $("#saleForm");
  const inputs = Array.from(form.querySelectorAll('input[type="number"]'));
  const dateInput = $("#date");
  
  function calculateAll() {
    const sold = parseNum($("#sold").value);
    const pending = parseNum($("#pending").value);
    const cleared = parseNum($("#cleared").value);
    const pipeFee = parseNum($("#pipeFee").value);
    const shareFee = parseNum($("#shareFee").value);
    const otherFee = parseNum($("#otherFee").value);
    const saveFee = parseNum($("#saveFee").value);

    const revenue = (sold + cleared - pending) * price;
    const expense = pipeFee + shareFee + otherFee + saveFee;
    const balance = revenue - expense;

    $("#revenue").textContent = fmtTHB(revenue);
    $("#expense").textContent = fmtTHB(expense);
    $("#balance").textContent = fmtTHB(balance);
    
    return { revenue, expense, balance };
  }

  inputs.forEach(i => i.addEventListener('input', calculateAll));
  calculateAll();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = dateInput.value;
    if (!d) return showMsg('❌ โปรดเลือกวันที่', 'error');

    const { revenue, expense, balance } = calculateAll();
    const payload = {
      date: d,
      sold: parseNum($("#sold").value),
      pending: parseNum($("#pending").value),
      cleared: parseNum($("#cleared").value),
      revenue,
      pipeFee: parseNum($("#pipeFee").value),
      shareFee: parseNum($("#shareFee").value),
      otherFee: parseNum($("#otherFee").value),
      saveFee: parseNum($("#saveFee").value),
      expense,
      balance
    };
    
    const preview = `ยืนยันการบันทึกข้อมูล?\n----------------------------------\nวันที่: ${new Date(d.replace(/-/g, '/')).toLocaleDateString('th-TH')}\nรายรับ: ${fmtTHB(payload.revenue)} บาท\nรายจ่าย: ${fmtTHB(payload.expense)} บาท\nยอดคงเหลือ: ${fmtTHB(payload.balance)} บาท\n----------------------------------\nกด 'ตกลง' เพื่อบันทึก`;

    if (!confirm(preview)) return;

    showMsg('⏳ กำลังบันทึกข้อมูล...', 'loading');
    showLoading(true);
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      const result = await res.json();
      
      if (result.success) {
        showMsg('✅ บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
        form.reset();
        $("#date").value = todayISO();
        calculateAll();
        window.dashboardLoaded = false;
      } else {
        throw new Error(result.error || 'Unknown error from server');
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
  m.style.display = 'block';
  setTimeout(() => m.style.display = 'none', 5000);
}

// ---------- Material Calculator ----------
// [ปรับปรุง] เปลี่ยนชื่อตัวแปรและจัดรูปแบบให้อ่านง่ายขึ้น
function initMaterialCalc() {
    const leafInput = $("#leafInput");
    const waterInput = $("#waterInput");
    const yieldInput = $("#yieldInput");
    const resultContainer = $("#resultContainer");

    $("#calculateButton").addEventListener('click', (e) => {
        e.preventDefault();
        const leafAmount = parseNum(leafInput.value);
        const waterAmount = parseNum(waterInput.value);
        const desiredYield = parseNum(yieldInput.value);

        if (leafAmount < 0 || waterAmount < 0 || desiredYield < 0) return alert('⚠️ กรุณากรอกค่าที่เป็นบวกเท่านั้น!');
        if (!leafAmount && !waterAmount && !desiredYield) return alert('⚠️ กรุณากรอกค่าข้อมูลอย่างน้อยหนึ่งช่อง!');
        
        const recipes = {
            ground: { leafToWater: 20, waterToYield: 15 / 20 },
            notGround1: { leafToWater: 15.38, waterToYield: 12 / 15.38 },
            notGround2: { leafToWater: 15.87302, waterToYield: 12 / 15.87302 }
        };
        
        let results = {};

        if (leafAmount > 0) {
            results.ground = { leaf: leafAmount, water: leafAmount * recipes.ground.leafToWater, yield: leafAmount * recipes.ground.leafToWater * recipes.ground.waterToYield };
            results.notGround1 = { leaf: leafAmount, water: leafAmount * recipes.notGround1.leafToWater, yield: leafAmount * recipes.notGround1.leafToWater * recipes.notGround1.waterToYield };
            results.notGround2 = { leaf: leafAmount, water: leafAmount * recipes.notGround2.leafToWater, yield: leafAmount * recipes.notGround2.leafToWater * recipes.notGround2.waterToYield };
        } else if (waterAmount > 0) {
            results.ground = { water: waterAmount, leaf: waterAmount / recipes.ground.leafToWater, yield: waterAmount * recipes.ground.waterToYield };
            results.notGround1 = { water: waterAmount, leaf: waterAmount / recipes.notGround1.leafToWater, yield: waterAmount * recipes.notGround1.waterToYield };
            results.notGround2 = { water: waterAmount, leaf: waterAmount / recipes.notGround2.leafToWater, yield: waterAmount * recipes.notGround2.waterToYield };
        } else {
            results.ground = { yield: desiredYield, water: desiredYield / recipes.ground.waterToYield, leaf: (desiredYield / recipes.ground.waterToYield) / recipes.ground.leafToWater };
            results.notGround1 = { yield: desiredYield, water: desiredYield / recipes.notGround1.waterToYield, leaf: (desiredYield / recipes.notGround1.waterToYield) / recipes.notGround1.leafToWater };
            results.notGround2 = { yield: desiredYield, water: desiredYield / recipes.notGround2.waterToYield, leaf: (desiredYield / recipes.notGround2.waterToYield) / recipes.notGround2.leafToWater };
        }

        $("#resultGroundLeaf").textContent = results.ground.leaf.toFixed(2);
        $("#resultGroundWater").textContent = results.ground.water.toFixed(2);
        $("#resultGroundYield").textContent = results.ground.yield.toFixed(2);
        
        $("#resultNotGroundLeaf1").textContent = results.notGround1.leaf.toFixed(2);
        $("#resultNotGroundWater1").textContent = results.notGround1.water.toFixed(2);
        $("#resultNotGroundYield1").textContent = results.notGround1.yield.toFixed(2);

        $("#resultNotGroundLeaf2").textContent = results.notGround2.leaf.toFixed(2);
        $("#resultNotGroundWater2").textContent = results.notGround2.water.toFixed(2);
        $("#resultNotGroundYield2").textContent = results.notGround2.yield.toFixed(2);

        resultContainer.style.display = 'block';
    });

    $("#resetButton").addEventListener('click', (e) => {
        e.preventDefault();
        leafInput.value = "";
        waterInput.value = "";
        yieldInput.value = "";
        resultContainer.style.display = 'none';
    });
}


// ---------- Dashboard ----------
let salesChart, feesChart, originalData = [], sortState = {};
function initDashboard() {
  $("#applyFilterBtn").addEventListener('click', () => updateDashboardUI());
  $("#resetFilterBtn").addEventListener('click', () => { $("#filterStartDate").value = ""; $("#filterEndDate").value = ""; $("#filterTimeframe").value = "month"; updateDashboardUI(); });
  $$(".sortable-header").forEach(h => h.addEventListener('click', () => { sortState.key = h.dataset.sort; sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc'; updateTable(getFilteredData()); }));
  $("#show50Btn").addEventListener('click', () => updateTable(getFilteredData(), 50));
  $("#showAllBtn").addEventListener('click', () => updateTable(getFilteredData(), Infinity));
}

async function fetchAllData() {
  const url = `${CONFIG.API_URL}?action=getData`;
  const res = await fetch(url);
  if(!res.ok) throw new Error(`ไม่สามารถดึงข้อมูลได้ (Status: ${res.status})`);
  return await res.json();
}

function getFilteredData() {
  let data = [...originalData];
  const start = $("#filterStartDate").value, end = $("#filterEndDate").value;
  if (start) data = data.filter(d => d.date >= start);
  if (end) data = data.filter(d => d.date <= end);
  const timeframe = $("#filterTimeframe").value;
  if (timeframe === 'all') return data;
  const groups = {};
  data.forEach(item => {
    const dt = new Date(item.date.replace(/-/g, '/'));
    let key = item.date;
    if (timeframe === 'week') { const day = dt.getDay(); const diff = dt.getDate() - day; key = new Date(dt.setDate(diff)).toISOString().slice(0, 10); } 
    else if (timeframe === 'month') { key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; } 
    else if (timeframe === 'year') { key = `${dt.getFullYear()}`; }
    if (!groups[key]) groups[key] = { date: key, sold: 0, revenue: 0, expense: 0, balance: 0, pipeFee: 0, shareFee: 0, otherFee: 0, saveFee: 0 };
    Object.keys(groups[key]).forEach(k => { if(k !== 'date') groups[key][k] += (parseNum(item[k])); });
  });
  return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateMetrics(data) {
  const n = data.length || 1;
  const totalRevenue = data.reduce((s, i) => s + i.revenue, 0);
  const totalExpense = data.reduce((s, i) => s + i.expense, 0);
  const totalProfit = totalRevenue - totalExpense;
  return {
    totalSold: data.reduce((s, i) => s + i.sold, 0), totalRevenue, totalExpense, totalProfit,
    profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0,
    avgSold: data.reduce((s, i) => s + i.sold, 0) / n, avgRevenue: totalRevenue / n, avgProfit: totalProfit / n,
    growth: data.length < 2 ? 0 : (data[0].revenue > 0 ? ((data[data.length-1].revenue - data[0].revenue) / data[0].revenue * 100) : 0)
  };
}

function updateDashboardUI() {
    const filtered = getFilteredData();
    const m = calculateMetrics(filtered);
    Object.keys(m).forEach(key => {
        const el = $(`#${key}`);
        if(el) el.textContent = `${fmtTHB(m[key].toFixed(2))}${key.includes('Margin') || key.includes('growth') ? '%' : ''}`;
    });
    updateCharts(filtered);
    updateTable(filtered, 50);
}

async function refreshDashboard() {
  showLoading(true);
  try {
    originalData = (await fetchAllData()).map(r => ({
      ...r, sold: parseNum(r.sold), revenue: parseNum(r.revenue), 
      expense: parseNum(r.expense) || (parseNum(r.pipeFee) + parseNum(r.shareFee) + parseNum(r.otherFee) + parseNum(r.saveFee)),
      balance: parseNum(r.balance)
    }));
    updateDashboardUI();
  } catch (err) {
    alert("ดึงข้อมูลไม่สำเร็จ: " + err.message);
  } finally {
    showLoading(false);
  }
}

function updateCharts(data) {
  const labels = data.map(d => d.date);
  if (salesChart) salesChart.destroy();
  salesChart = new Chart($('#salesChart'), {
    type: 'bar',
    data: { labels, datasets: [ { type: 'line', label: 'คงเหลือ', data: data.map(d => d.balance), borderColor: '#4CAF50', tension: 0.1 }, { label: 'รายรับ', data: data.map(d => d.revenue), backgroundColor: '#2196F3' }, { label: 'รายจ่าย', data: data.map(d => d.expense), backgroundColor: '#F44336' } ] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });
  const feeData = { 'ค่าท่อม': data.reduce((s, i) => s + parseNum(i.pipeFee), 0), 'ค่าแชร์': data.reduce((s, i) => s + parseNum(i.shareFee), 0), 'ค่าใช้จ่ายอื่น': data.reduce((s, i) => s + parseNum(i.otherFee), 0), 'เก็บออม': data.reduce((s, i) => s + parseNum(i.saveFee), 0) };
  if (feesChart) feesChart.destroy();
  feesChart = new Chart($('#feesChart'), { type: 'doughnut', data: { labels: Object.keys(feeData), datasets: [{ data: Object.values(feeData) }] }, options: { responsive: true, maintainAspectRatio: false } });
}

function updateTable(data, limit = 50) {
  let dataToRender = [...data];
  if (sortState.key) {
    dataToRender.sort((a, b) => {
        let valA = a[sortState.key], valB = b[sortState.key];
        if (sortState.key === 'date') { valA = new Date(valA); valB = new Date(valB); }
        if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
    });
  } else {
    dataToRender.sort((a,b) => b.date.localeCompare(a.date));
  }
  const tbody = $("#dataTable");
  tbody.innerHTML = "";
  dataToRender.slice(0, limit).forEach(item => {
    tbody.innerHTML += `<tr><td>${new Date(item.date.replace(/-/g, '/')).toLocaleDateString('th-TH')}</td><td>${fmtTHB(item.sold)}</td><td>${fmtTHB(item.revenue)}</td><td>${fmtTHB(item.expense)}</td><td>${fmtTHB(item.balance)}</td></tr>`;
  });
}

// ---------- Backup ----------
function initBackup() {
  $("#downloadCSV").addEventListener('click', () => downloadBackup('csv'));
  $("#downloadJSON").addEventListener('click', () => downloadBackup('json'));
}

async function downloadBackup(type = 'csv') {
    showLoading(true);
    try {
        // [แก้ไข] เปลี่ยน 'action=backup' เป็น 'action=export' ให้ตรงกับ Backend
        const url = `${CONFIG.API_URL}?action=export&type=${type}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`ดาวน์โหลดไม่สำเร็จ (Status: ${res.status})`);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `SSKratomYMT-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${type}`;
        document.body.appendChild(a);
        a.click(); a.remove();
        URL.revokeObjectURL(a.href);
    } catch (e) {
        alert('เกิดข้อผิดพลาดในการสำรองข้อมูล: ' + e.message);
    } finally {
        showLoading(false);
    }
}
