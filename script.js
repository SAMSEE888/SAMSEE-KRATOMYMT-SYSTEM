/* SSKratomYMT Frontend Logic (ปรับปรุงวันที่) */
const CONFIG = {
  PRICE_PER_BOTTLE: 40,
  SHEET_URL: "https://docs.google.com/spreadsheets/d/11vhg37MbHRm53SSEHLsCI3EBXx5_meXVvlRuqhFteaY", // <- เปลี่ยนได้
  API_URL: "https://script.google.com/macros/s/AKfycbyP2LmGwRzGKNr1zqUpoQjpkpj-0C-W4tp4XrK5T9hwf64Odeb4ElRFLI6vYsBYvMx5/exec" // <- วาง URL Web App ของ Apps Script
};

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const fmtTHB = (n) => (n ?? 0).toLocaleString('th-TH');
const parseNum = (v) => Number(v || 0);
const showLoading = (b) => $("#loadingOverlay").style.display = b ? "flex" : "none";

// --- จุดที่ปรับปรุง ---
// ฟังก์ชันนี้จะสร้างวันที่ในรูปแบบ YYYY-MM-DD ตามโซนเวลาของผู้ใช้โดยตรง
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
  $(`#${id}`).classList.add('active');
  $(`.tab-btn[data-tab="${id}"]`).classList.add('active');
  
  // โหลดข้อมูล Dashboard เมื่อผู้ใช้กดแท็บนี้เป็นครั้งแรก หรือข้อมูลยังไม่เคยโหลด
  if (id === 'dashboard-tab' && !window.dashboardLoaded) {
    refreshDashboard();
    window.dashboardLoaded = true; // ตั้งค่า flag ว่าโหลดแล้ว
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
  calculateAll(); // คำนวณค่าเริ่มต้น

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
    
    const preview = `
ยืนยันการบันทึกข้อมูล?
----------------------------------
วันที่: ${new Date(payload.date).toLocaleDateString('th-TH')}
รายรับ: ${fmtTHB(payload.revenue)} บาท
รายจ่าย: ${fmtTHB(payload.expense)} บาท
ยอดคงเหลือ: ${fmtTHB(payload.balance)} บาท
----------------------------------
กด 'ตกลง' เพื่อบันทึก
`;

    if (!confirm(preview)) return;

    showMsg('⏳ กำลังบันทึกข้อมูล...', 'loading');
    showLoading(true);
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        // 'mode: no-cors' ใช้สำหรับการทดสอบเบื้องต้น แต่ Production ควรตั้งค่า CORS ให้ถูกต้อง
        // mode: 'no-cors', 
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' } // Apps Script doPost มักจะทำงานกับ text/plain ได้ดีกว่า
      });
      
      // การ redirect ทำให้ response อ่านไม่ได้โดยตรง
      // ดังนั้นเราจะ optimistic update คือเชื่อว่าสำเร็จถ้าไม่มี error
      showMsg('✅ บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
      form.reset();
      $("#date").value = todayISO();
      calculateAll();
      
      // โหลดข้อมูล Dashboard ใหม่เบื้องหลัง
      window.dashboardLoaded = false; // บังคับให้โหลดใหม่เมื่อกดไปแท็บ Dashboard
      
    } catch (err) {
      showMsg(`❌ เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`, 'error');
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
  setTimeout(() => m.style.display = 'none', 5000); // ซ่อนข้อความอัตโนมัติใน 5 วินาที
}

// ---------- Material Calculator (ไม่มีการเปลี่ยนแปลง) ----------
function initMaterialCalc() {
    const leafInput = $("#leafInput");
    const waterInput = $("#waterInput");
    const yieldInput = $("#yieldInput");
    const resultContainer = $("#resultContainer");

    const fields = {
        Ground: { leaf: $("#resultGroundLeaf"), water: $("#resultGroundWater"), yield: $("#resultGroundYield") },
        NotGround1: { leaf: $("#resultNotGroundLeaf1"), water: $("#resultNotGroundWater1"), yield: $("#resultNotGroundYield1") },
        NotGround2: { leaf: $("#resultNotGroundLeaf2"), water: $("#resultNotGroundWater2"), yield: $("#resultNotGroundYield2") }
    };

    const ratios = {
        ground: { leafToWater: 20, waterToYield: 15 / 20 },
        notGround1: { leafToWater: 15.38, waterToYield: 12 / 15.38 },
        notGround2: { leafToWater: 15.87302, waterToYield: 12 / 15.87302 }
    };

    $("#calculateButton").addEventListener('click', (e) => {
        e.preventDefault();
        const leaf = parseFloat(leafInput.value) || 0;
        const water = parseFloat(waterInput.value) || 0;
        const desired = parseFloat(yieldInput.value) || 0;

        if (leaf < 0 || water < 0 || desired < 0) return alert('⚠️ กรุณากรอกค่าที่เป็นบวกเท่านั้น!');
        if (!leaf && !water && !desired) return alert('⚠️ กรุณากรอกค่าข้อมูลอย่างน้อยหนึ่งช่อง!');
        
        let results = {};
        if (leaf > 0) {
            results = {
                ground: { leaf, water: leaf * ratios.ground.leafToWater, yield: leaf * ratios.ground.leafToWater * ratios.ground.waterToYield },
                notGround1: { leaf, water: leaf * ratios.notGround1.leafToWater, yield: leaf * ratios.notGround1.leafToWater * ratios.notGround1.waterToYield },
                notGround2: { leaf, water: leaf * ratios.notGround2.leafToWater, yield: leaf * ratios.notGround2.leafToWater * ratios.notGround2.waterToYield }
            };
        } else if (water > 0) {
            results = {
                ground: { water, leaf: water / ratios.ground.leafToWater, yield: water * ratios.ground.waterToYield },
                notGround1: { water, leaf: water / ratios.notGround1.leafToWater, yield: water * ratios.notGround1.waterToYield },
                notGround2: { water, leaf: water / ratios.notGround2.leafToWater, yield: water * ratios.notGround2.waterToYield }
            };
        } else if (desired > 0) {
            results = {
                ground: { yield: desired, water: desired / ratios.ground.waterToYield, leaf: (desired / ratios.ground.waterToYield) / ratios.ground.leafToWater },
                notGround1: { yield: desired, water: desired / ratios.notGround1.waterToYield, leaf: (desired / ratios.notGround1.waterToYield) / ratios.notGround1.leafToWater },
                notGround2: { yield: desired, water: desired / ratios.notGround2.waterToYield, leaf: (desired / ratios.notGround2.waterToYield) / ratios.notGround2.leafToWater }
            };
        }

        fields.Ground.leaf.textContent = results.ground.leaf.toFixed(2);
        fields.Ground.water.textContent = results.ground.water.toFixed(2);
        fields.Ground.yield.textContent = results.ground.yield.toFixed(2);
        fields.NotGround1.leaf.textContent = results.notGround1.leaf.toFixed(2);
        fields.NotGround1.water.textContent = results.notGround1.water.toFixed(2);
        fields.NotGround1.yield.textContent = results.notGround1.yield.toFixed(2);
        fields.NotGround2.leaf.textContent = results.notGround2.leaf.toFixed(2);
        fields.NotGround2.water.textContent = results.notGround2.water.toFixed(2);
        fields.NotGround2.yield.textContent = results.notGround2.yield.toFixed(2);
        
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
  $("#resetFilterBtn").addEventListener('click', () => {
    $("#filterStartDate").value = "";
    $("#filterEndDate").value = "";
    $("#filterTimeframe").value = "month";
    updateDashboardUI();
  });
  $$(".sortable-header").forEach(h => h.addEventListener('click', () => {
      const key = h.dataset.sort;
      sortState.key = key;
      sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
      updateTable(getFilteredData());
  }));
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
  const timeframe = $("#filterTimeframe").value;
  const start = $("#filterStartDate").value;
  const end = $("#filterEndDate").value;
  let data = [...originalData];
  if (start) data = data.filter(d => d.date >= start);
  if (end) data = data.filter(d => d.date <= end);
  
  if (timeframe === 'all') return data;

  // Aggregate by timeframe
  const groups = {};
  data.forEach(item => {
    const dt = new Date(item.date);
    let key;
    if (timeframe === 'day') key = item.date;
    else if (timeframe === 'week') {
      const firstDay = new Date(dt.setDate(dt.getDate() - dt.getDay()));
      key = firstDay.toISOString().slice(0, 10);
    } else if (timeframe === 'month') key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    else if (timeframe === 'year') key = `${dt.getFullYear()}`;
    
    if (!groups[key]) groups[key] = { date: key, sold: 0, revenue: 0, expense: 0, balance: 0, pipeFee: 0, shareFee: 0, otherFee: 0, saveFee: 0 };
    
    // รวมค่าต่างๆ
    Object.keys(groups[key]).forEach(k => {
        if(k !== 'date') groups[key][k] += (parseNum(item[k]));
    });
  });
  return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateMetrics(data) {
  const totalRevenue = data.reduce((s, i) => s + i.revenue, 0);
  const totalExpense = data.reduce((s, i) => s + i.expense, 0);
  const totalProfit = totalRevenue - totalExpense;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;
  
  return {
    totalSold: data.reduce((s, i) => s + i.sold, 0),
    totalRevenue,
    totalExpense,
    totalProfit,
    profitMargin,
    avgSold: (data.reduce((s, i) => s + i.sold, 0) / data.length) || 0,
    avgRevenue: (totalRevenue / data.length) || 0,
    avgProfit: (totalProfit / data.length) || 0,
    growth: (() => {
      if (data.length < 2) return 0;
      const first = data[0].revenue;
      const last = data[data.length - 1].revenue;
      return first > 0 ? ((last - first) / first * 100) : 0;
    })()
  };
}

function updateDashboardUI() {
    const filtered = getFilteredData();
    const m = calculateMetrics(filtered);

    $("#totalSold").textContent = fmtTHB(m.totalSold);
    $("#totalRevenue").textContent = fmtTHB(m.totalRevenue);
    $("#totalExpense").textContent = fmtTHB(m.totalExpense);
    $("#totalProfit").textContent = fmtTHB(m.totalProfit);
    $("#profitMargin").textContent = `${m.profitMargin.toFixed(2)}%`;
    $("#avgSold").textContent = fmtTHB(m.avgSold.toFixed(2));
    $("#avgRevenue").textContent = fmtTHB(m.avgRevenue.toFixed(2));
    $("#avgProfit").textContent = fmtTHB(m.avgProfit.toFixed(2));
    $("#growthRate").textContent = `${m.growth.toFixed(2)}%`;

    updateCharts(filtered);
    updateTable(filtered, 50); // แสดง 50 รายการล่าสุดเป็นค่าเริ่มต้น
}

async function refreshDashboard() {
  showLoading(true);
  try {
    const arr = await fetchAllData();
    originalData = arr.map(r => ({
      ...r,
      sold: parseNum(r.sold),
      revenue: parseNum(r.revenue),
      expense: parseNum(r.expense) || (parseNum(r.pipeFee) + parseNum(r.shareFee) + parseNum(r.otherFee) + parseNum(r.saveFee)),
      balance: parseNum(r.balance)
    })).sort((a,b) => a.date.localeCompare(b.date));
    
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
    data: {
      labels,
      datasets: [
        { type: 'line', label: 'คงเหลือ', data: data.map(d => d.balance), borderColor: '#4CAF50', tension: 0.1, yAxisID: 'y' },
        { type: 'bar', label: 'รายรับ', data: data.map(d => d.revenue), backgroundColor: '#2196F3', yAxisID: 'y' },
        { type: 'bar', label: 'รายจ่าย', data: data.map(d => d.expense), backgroundColor: '#F44336', yAxisID: 'y' },
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  const feeData = {
    'ค่าท่อม': data.reduce((s, i) => s + i.pipeFee, 0),
    'ค่าแชร์': data.reduce((s, i) => s + i.shareFee, 0),
    'ค่าใช้จ่ายอื่น': data.reduce((s, i) => s + i.otherFee, 0),
    'เก็บออม': data.reduce((s, i) => s + i.saveFee, 0)
  };
  if (feesChart) feesChart.destroy();
  feesChart = new Chart($('#feesChart'), {
    type: 'doughnut',
    data: { labels: Object.keys(feeData), datasets: [{ data: Object.values(feeData) }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
  });
}

function updateTable(data, limit = 50) {
  let dataToRender = [...data]; // ทำสำเนาเพื่อไม่ให้กระทบข้อมูลต้นฉบับ
  
  // Sort data if sortState is set
  if (sortState.key) {
    dataToRender.sort((a, b) => {
        let valA = a[sortState.key];
        let valB = b[sortState.key];
        if (sortState.key === 'date') {
            valA = new Date(valA);
            valB = new Date(valB);
        }
        if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
    });
  } else {
    // Default sort by date descending (latest first)
    dataToRender.sort((a,b) => b.date.localeCompare(a.date));
  }

  const tbody = $("#dataTable");
  tbody.innerHTML = "";
  dataToRender.slice(0, limit).forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(item.date).toLocaleDateString('th-TH')}</td>
      <td>${fmtTHB(item.sold)}</td>
      <td>${fmtTHB(item.revenue)}</td>
      <td>${fmtTHB(item.expense)}</td>
      <td>${fmtTHB(item.balance)}</td>
    `;
    tbody.appendChild(tr);
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
        const url = `${CONFIG.API_URL}?action=backup&type=${type}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`ดาวน์โหลดไม่สำเร็จ (Status: ${res.status})`);
        
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const now = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.download = `SSKratomYMT-backup-${now}.${type}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
    } catch (e) {
        alert('เกิดข้อผิดพลาดในการสำรองข้อมูล: ' + e.message);
    } finally {
        showLoading(false);
    }
}
