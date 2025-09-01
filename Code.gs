/**
 * =================================================================
 * SSKratomYMT Google Apps Script Backend (ฉบับแก้ไขสมบูรณ์)
 * =================================================================
 */

// --- การตั้งค่าทั่วไป ---
const SPREADSHEET_ID = '11vhg37MbHRm53SSEHLsCI3EBXx5_meXVvlRuqhFteaY';
const SHEET_NAME = 'SaleForm';

// --- กำหนดหัวข้อคอลัมน์ (Headers) ---
const HEADERS = [
  'date', 'sold', 'pending', 'cleared', 'revenue', 'pipefee', 
  'sharefee', 'otherfee', 'savefee', 'expense', 'balance', 'timestamp'
];

/**
 * =================================================================
 * ส่วนของโค้ดหลัก (แก้ไขแล้ว)
 * =================================================================
 */

function _sheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e.parameter.action || '';

  try {
    if (action === "getData") {
      return _json(getDataObjects());
    }

    if (action === "export") {
      const type = e.parameter.type || 'csv';
      const data = getDataObjects();

      if (type === 'json') {
        return ContentService.createTextOutput(JSON.stringify(data, null, 2))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        const csv = exportCSV(data);
        return ContentService.createTextOutput(csv)
          .setMimeType(ContentService.MimeType.CSV)
          .downloadAsFile('export.csv');
      }
    }
    
    return ContentService.createTextOutput("SSKratomYMT API is running.")
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    return _json({ success: false, error: "Server error: " + err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (!data || !data.date) {
      throw new Error("ข้อมูลไม่ถูกต้องหรือไม่พบข้อมูลวันที่ (date)");
    }
    
    const s = _sheet();

    // ================== แก้ไขปัญหาวันที่อย่างสมบูรณ์ ==================
    // 1. แยกส่วนประกอบของวันที่จากสตริง 'YYYY-MM-DD'
    const dateParts = data.date.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // เดือนใน JavaScript เริ่มนับจาก 0
    const day = parseInt(dateParts[2], 10);

    // 2. สร้าง Date object ใน timezone ของสคริปต์
    const scriptTimeZone = Session.getScriptTimeZone();
    const dateString = `${year}-${month + 1}-${day}`;
    const correctDate = new Date(dateString + 'T00:00:00'); // ตั้งเวลาเป็น 00:00:00
    
    // 3. ใช้ Utilities.formatDate เพื่อให้แน่ใจว่าวันที่ถูกต้อง
    const formattedDate = Utilities.formatDate(correctDate, scriptTimeZone, 'yyyy-MM-dd');
    
    // 4. สร้างแถวข้อมูลสำหรับบันทึก
    const row = [
      formattedDate, // ใช้วันที่ที่ฟอร์แมตแล้ว
      Number(data.sold) || 0,
      Number(data.pending) || 0,
      Number(data.cleared) || 0,
      Number(data.revenue) || 0,
      Number(data.pipefee) || 0,
      Number(data.sharefee) || 0,
      Number(data.otherfee) || 0,
      Number(data.savefee) || 0,
      Number(data.expense) || 0,
      Number(data.balance) || 0,
      new Date() // Timestamp ปัจจุบัน
    ];

    s.appendRow(row);

    return _json({ 
      success: true, 
      message: "บันทึกข้อมูลเรียบร้อย",
      recordedDate: formattedDate // ส่งคืนวันที่ที่บันทึกจริง
    });

  } catch (err) {
    console.error("doPost Error:", err.message);
    return _json({ success: false, error: err.message });
  }
}

function getDataObjects() {
  const range = _sheet().getDataRange();
  const values = range.getValues();
  const scriptTimeZone = Session.getScriptTimeZone();

  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h).toLowerCase().trim());
  const out = [];

  for (let r = 1; r < values.length; r++) {
    const rowValues = values[r];
    if (rowValues.every(v => v === '')) continue;

    const obj = {};
    headers.forEach((h, i) => {
      let v = rowValues[i];
      
      // จัดการกับคอลัมน์วันที่
      if (h === 'date') {
        if (v instanceof Date) {
          obj[h] = Utilities.formatDate(v, scriptTimeZone, 'yyyy-MM-dd');
        } else if (typeof v === 'string' && v) {
          // หากเป็นสตริง ให้ใช้ตามเดิม
          obj[h] = v;
        } else {
          obj[h] = '';
        }
      } 
      // จัดการกับ timestamp
      else if (h === 'timestamp' && v instanceof Date) {
        obj[h] = Utilities.formatDate(v, scriptTimeZone, 'yyyy-MM-dd HH:mm:ss');
      } else {
        obj[h] = v;
      }
    });
    out.push(obj);
  }
  return out;
}

function exportCSV(data) {
  const header = HEADERS.filter(h => h !== 'timestamp').join(",");
  const rows = data.map(d => {
    return HEADERS.filter(h => h !== 'timestamp')
      .map(h_key => {
        let value = d[h_key] || "";
        // จัดการกับค่าที่มี comma ในสตริง
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      })
      .join(",");
  });
  return [header, ...rows].join("\n");
}