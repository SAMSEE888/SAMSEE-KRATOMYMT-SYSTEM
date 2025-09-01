/**
 * =================================================================
 * SSKratomYMT Google Apps Script Backend (ฉบับแก้ไขสมบูรณ์)
 * =================================================================
 */

// --- การตั้งค่าทั่วไป ---
const SPREADSHEET_ID = '11vhg37MbHRm53SSEHLsCI3EBXx5_meXVvlRuqhFteaY'; // <-- ใส่ ID ของ Google Sheet ที่นี่

const SHEET_NAME = 'SaleForm';

// --- กำหนดหัวข้อคอลัมน์ (Headers) ---
// **สำคัญ:** ลำดับต้องตรงกับคอลัมน์ใน Google Sheet ของคุณ
const HEADERS = [
  'date', 'sold', 'pending', 'cleared', 'revenue', 'pipefee', 
  'sharefee', 'otherfee', 'savefee', 'expense', 'balance', 'timestamp'
];


/**
 * =================================================================
 * ส่วนของโค้ดหลัก (ไม่ต้องแก้ไขส่วนนี้)
 * =================================================================
 */

/**
 * ฟังก์ชัน Helper สำหรับการเข้าถึงชีต
 */
function _sheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // หากสร้างชีตใหม่ ให้เพิ่มหัวคอลัมน์เข้าไปด้วย
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

/**
 * ฟังก์ชัน Helper สำหรับการตอบกลับเป็น JSON response
 */
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Web App Entries (doGet, doPost)
 */

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
        // ... (ส่วนนี้ยังไม่ได้ใช้งาน แต่เก็บไว้เผื่ออนาคต)
        return ContentService.createTextOutput(data, null, 2)
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        // ส่งออกเป็น CSV
        const csv = exportCSV(data);
        return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
      }
    }
    
    // หากไม่มี action ที่ระบุ ให้ตอบกลับว่า API ทำงานอยู่
    return ContentService.createTextOutput("SSKratomYMT API is running.")
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    return _json({ success: false, error: "Server error: " + err.message });
  }
}


function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // ตรวจสอบว่ามีข้อมูล 'date' ส่งมาหรือไม่
    if (!data || !data.date) {
      throw new Error("ข้อมูลไม่ถูกต้องหรือไม่พบข้อมูลวันที่ (date)");
    }
    
    const s = _sheet();

    // ================== ส่วนที่แก้ไขปัญหาเรื่องวันที่ ==================
    // 1. แยกส่วนประกอบของวันที่จากสตริง 'YYYY-MM-DD' ที่ส่งมา
    const dateParts = data.date.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // เดือนใน JavaScript เริ่มนับจาก 0 (ม.ค.=0)
    const day = parseInt(dateParts[2], 10);

    // 2. สร้าง Date object ขึ้นมาใหม่โดยใช้โซนเวลาท้องถิ่นของสคริปต์
    // วิธีนี้จะทำให้ได้วันที่ที่ถูกต้องตรงตามที่ผู้ใช้เลือกเสมอ
    const correctDate = new Date(year, month, day);
    // ================================================================

    // เตรียมข้อมูลสำหรับบันทึกลงแถวใหม่
    const row = [
      correctDate, // <-- ใช้ตัวแปรวันที่ที่แก้ไขแล้ว
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
      new Date() // Timestamp สำหรับการบันทึกข้อมูล ณ เวลานั้นๆ
    ];

    s.appendRow(row);

    return _json({ success: true, message: "บันทึกข้อมูลเรียบร้อย" });

  } catch (err) {
    console.error("doPost Error:", err.message);
    return _json({ success: false, error: err.message });
  }
}


/**
 * Data Functions
 */

function getDataObjects() {
  const range = _sheet().getDataRange();
  const values = range.getValues();
  const timezone = Session.getScriptTimeZone();

  if (values.length <= 1) return []; // ถ้ามีแต่หัวข้อ หรือไม่มีข้อมูลเลย

  const headers = values[0].map(h => String(h).toLowerCase().trim());
  const scriptTimeZone = Session.getScriptTimeZone();
  const out = [];

  // เริ่มจากแถวที่ 1 (ข้อมูลแถวแรก) เพราะแถวที่ 0 คือ Header
  for (let r = 1; r < values.length; r++) {
    const rowValues = values[r];
    if (rowValues.every(v => v === '')) continue; // ข้ามแถวที่ว่างเปล่า

    const obj = {};
    headers.forEach((h, i) => {
      let v = rowValues[i];
      // ตรวจสอบว่าเป็นข้อมูลวันที่หรือไม่ และแปลงให้เป็นรูปแบบ YYYY-MM-DD
      if (h === 'date' && v instanceof Date) {
        obj[h] = Utilities.formatDate(v, scriptTimeZone, 'yyyy-MM-dd');
      } else if (h === 'timestamp' && v instanceof Date) {
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
  // กรองเอา 'timestamp' ออกจากหัวข้อของ CSV
  const header = HEADERS.filter(h => h !== 'timestamp').join(",");
  const rows = data.map(d => {
    // สร้างแถวข้อมูลตามลำดับของ HEADERS (ยกเว้น timestamp)
    return HEADERS.filter(h => h !== 'timestamp').map(h_key => d[h_key] || "").join(",");
  });
  return [header, ...rows].join("\n");
}
