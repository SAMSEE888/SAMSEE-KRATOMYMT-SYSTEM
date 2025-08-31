// ========== SSKratomYMT Google Apps Script Backend (ฉบับแก้ไขวันที่) ==========

// --- การตั้งค่าหลัก ---
const SPREADSHEET_ID = "11vhg37MbHRm53SSEHLsCI3EBXx5_meXVvlRuqhFteaY"; // ID ของ Google Sheet
const SHEET_NAME = "SaleForm"; // ชื่อชีต (แท็บ) ที่จะบันทึกข้อมูล

// โครงสร้างคอลัมน์
const HEADERS = ["date", "sold", "pending", "cleared", "revenue", "pipeFee", "shareFee", "otherFee", "saveFee", "expense", "balance", "timestamp"];

function _sheet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
    }
    return sheet;
  } catch (e) {
    console.error("เกิดข้อผิดพลาดในการเข้าถึง Spreadsheet: " + e.message);
    throw new Error("ไม่สามารถเข้าถึง Spreadsheet ID ที่ระบุได้");
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Web App Entries ---

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
        return ContentService.createTextOutput(jsonString).setMimeType(ContentService.MimeType.JSON);
      } else {
        const csv = exportCSV();
        return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
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
    
    if (!data || !data.date) {
      throw new Error("ข้อมูลไม่ถูกต้องหรือไม่พบวันที่ (date)");
    }

    const s = _sheet();
    if (!s) throw new Error("ไม่พบชีต: " + SHEET_NAME);
    
    // --- จุดที่แก้ไข ---
    // สร้าง Date object จากสตริงวันที่ YYYY-MM-DD ที่ได้รับมา
    // โดยการแทนที่ '-' ด้วย '/' จะช่วยให้ JavaScript ตีความเป็นโซนเวลาท้องถิ่น (Local Time) แทนที่จะเป็น UTC
    // ซึ่งจะแก้ปัญหาวันที่ถูกบันทึกผิดเพี้ยนไปหนึ่งวัน
    const localDate = new Date(data.date.replace(/-/g, '/'));

    const row = [
      localDate, // ใช้วันที่ที่แปลงแล้ว
      Number(data.sold) || 0,
      Number(data.pending) || 0,
      Number(data.cleared) || 0,
      Number(data.revenue) || 0,
      Number(data.pipeFee) || 0,
      Number(data.shareFee) || 0,
      Number(data.otherFee) || 0,
      Number(data.saveFee) || 0,
      Number(data.expense) || 0,
      Number(data.balance) || 0,
      new Date() // Timestamp
    ];

    s.appendRow(row);

    return _json({ success: true, message: "บันทึกข้อมูลเรียบร้อย" });
  } catch (err) {
    console.error("doPost Error:", err.message);
    return _json({ success: false, error: err.message });
  }
}

// --- Data Functions ---

function getDataObjects() {
  const s = _sheet();
  const range = s.getDataRange();
  const values = range.getValues();

  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h).toLowerCase());
  
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const v = values[r];
    if (!v[0]) continue; // ข้ามแถวที่ไม่มีวันที่

    const obj = {};
    headers.forEach((h, i) => {
        if (h === 'date' && v[i] instanceof Date) {
            // จัดรูปแบบวันที่ให้เป็น YYYY-MM-DD โดยใช้โซนเวลาของสคริปต์
            obj[h] = Utilities.formatDate(v[i], Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (h && h !== 'timestamp') {
            obj[h] = v[i];
        }
    });
    out.push(obj);
  }
  return out;
}

function exportCSV() {
  const data = getDataObjects();
  const header = HEADERS.filter(h => h !== 'timestamp');
  const rows = [header.join(",")];
  data.forEach(d => {
    rows.push(header.map(h => d[h]).join(","));
  });
  return rows.join("\n");
}
