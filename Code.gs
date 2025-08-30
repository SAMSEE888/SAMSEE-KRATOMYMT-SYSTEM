// ========== SSKratomYMT Google Apps Script Backend (ฉบับแก้ไข) ==========

// --- การตั้งค่าหลัก ---
const SPREADSHEET_ID = "11vhg37MbHRm53SSEHLsCI3EBXx5_meXVvlRuqhFteaY"; // ID ของ Google Sheet
const SHEET_NAME = "SaleForm"; // ชื่อชีต (แท็บ) ที่จะบันทึกข้อมูล

// โครงสร้างคอลัมน์: ["date", "sold", ... "timestamp"]
const HEADERS = ["date", "sold", "pending", "cleared", "revenue", "pipeFee", "shareFee", "otherFee", "saveFee", "expense", "balance", "timestamp"];

/**
 * ฟังก์ชัน Helper สำหรับการเข้าถึงชีต
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} ชีตที่ทำงานด้วย
 */
function _sheet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      // ถ้าไม่มีชีต ให้สร้างขึ้นมาใหม่พร้อม header
      const newSheet = ss.insertSheet(SHEET_NAME);
      newSheet.appendRow(HEADERS);
      return newSheet;
    }
    return sheet;
  } catch (e) {
    console.error("เกิดข้อผิดพลาดในการเข้าถึง Spreadsheet: " + e.message);
    throw new Error("ไม่สามารถเข้าถึง Spreadsheet ID ที่ระบุได้");
  }
}

/**
 * ฟังก์ชัน Helper สำหรับการสร้าง JSON response
 * @param {Object} obj - อ็อบเจกต์ที่จะแปลงเป็น JSON
 * @returns {GoogleAppsScript.Content.TextOutput} ผลลัพธ์ในรูปแบบ JSON
 */
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// --- Web App Entries (doGet, doPost) ---

function doGet(e) {
  const action = e.parameter.action || "";

  try {
    if (action === "getData") {
      return _json(getDataObjects());
    }
    if (action === "backup") {
      const type = e.parameter.type || "csv";
      if (type === "json") {
        const data = getDataObjects();
        const jsonString = JSON.stringify(data, null, 2);
        return ContentService.createTextOutput(jsonString)
          .setMimeType(ContentService.MimeType.JSON)
          .downloadAsFile(`SSKratomYMT-backup-${new Date().toISOString()}.json`);
      } else {
        const csv = exportCSV();
        return ContentService.createTextOutput(csv)
          .setMimeType(ContentService.MimeType.CSV)
          .downloadAsFile(`SSKratomYMT-backup-${new Date().toISOString()}.csv`);
      }
    }
    return ContentService.createTextOutput("SSKratomYMT API is running.");
  } catch (err) {
    return _json({ success: false, error: "Server error: " + err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // ตรวจสอบข้อมูลสำคัญก่อนบันทึก
    if (!data || !data.date) {
      throw new Error("ข้อมูลไม่ถูกต้องหรือไม่พบวันที่ (date)");
    }

    const s = _sheet();
    if (!s) throw new Error("ไม่พบชีต: " + SHEET_NAME);

    // สร้างแถวข้อมูลตามลำดับ HEADERS
    const row = HEADERS.map(header => {
      if (header === 'timestamp') return new Date();
      if (header === 'date') return new Date(data.date);
      return data[header] !== undefined ? Number(data[header]) || 0 : 0;
    });

    s.appendRow(row);

    return _json({ success: true, message: "บันทึกข้อมูลเรียบร้อย" });
  } catch (err) {
    console.error("doPost Error:", err.message);
    return _json({ success: false, error: err.message });
  }
}


// --- Data Functions ---

/**
 * ดึงข้อมูลทั้งหมดจากชีตแล้วแปลงเป็น Array of Objects
 * @returns {Array<Object>}
 */
function getDataObjects() {
  const s = _sheet();
  const range = s.getDataRange();
  const values = range.getValues();

  // หากไม่มีข้อมูลเลย ให้ trả về array ว่าง
  if (values.length <= 1) return [];

  const headers = values[0].map(h => h.toLowerCase());
  const dateIndex = headers.indexOf('date');

  const out = [];
  // เริ่มจากแถวที่ 1 เพื่อข้าม Header
  for (let r = 1; r < values.length; r++) {
    const v = values[r];
    const obj = {};
    headers.forEach((h, i) => {
      if (h === 'date' && v[i] instanceof Date) {
        obj[h] = Utilities.formatDate(v[i], Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (h !== 'timestamp') { // ไม่ต้องแสดง timestamp ในผลลัพธ์
        obj[h] = v[i];
      }
    });
    // ข้ามแถวที่ไม่มีวันที่
    if(obj.date) {
        out.push(obj);
    }
  }
  return out;
}

/**
 * สร้างข้อมูล CSV สำหรับการดาวน์โหลด
 * @returns {string} ข้อมูลในรูปแบบ CSV
 */
function exportCSV() {
  const data = getDataObjects();
  const header = HEADERS.filter(h => h !== 'timestamp'); // ไม่เอา timestamp ไปในไฟล์ backup
  const rows = [header.join(",")];
  data.forEach(d => {
    rows.push(header.map(h => d[h]).join(","));
  });
  return rows.join("\n");
}
