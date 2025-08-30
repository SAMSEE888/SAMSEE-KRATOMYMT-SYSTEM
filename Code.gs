// ========== SSKratomYMT Google Apps Script Backend ==========
// ตั้งค่า Spreadsheet และชีต
const SPREADSHEET_ID = "11vhg37MbHRm53SSEHLsCI3EBXx5_meXVvlRuqhFteaY"; // เปลี่ยนเป็นของคุณ
const SHEET_NAME = "SaleForm"; // ต้องตรงกับชื่อแท็บใน Google Sheets

// โครงสร้างคอลัมน์
const HEADERS = ["date","sold","pending","cleared","revenue","pipeFee","shareFee","otherFee","saveFee","expense","balance","timestamp"];

function _sheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
}

// --- Web App Entry ---
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || "";
    if (action === "getData") {
      return _json(getDataObjects());
    }
    if (action === "backup") {
      const type = (e.parameter && e.parameter.type) || "csv";
      if (type === "json") {
        const data = getDataObjects();
        return _json(data);
      } else {
        return ContentService
          .createTextOutput(exportCSV())
          .setMimeType(ContentService.MimeType.CSV);
      }
    }
    return ContentService.createTextOutput("✅ SSKratomYMT API is running.");
  } catch (err) {
    return _json({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No POST data received.");
    }
    const data = JSON.parse(e.postData.contents);
    const s = _sheet();
    if (!s) throw new Error("ไม่พบชีต: " + SHEET_NAME);

    const row = [
      data.date ? new Date(data.date) : new Date(),
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
      new Date()
    ];
    s.appendRow(row);

    return _json({ success: true, message: "บันทึกข้อมูลสำเร็จ" });
  } catch (err) {
    return _json({ success: false, error: err.message });
  }
}

// --- Utility Functions ---
function getDataObjects() {
  const s = _sheet();
  const values = s.getDataRange().getValues();
  let start = 0;
  if (values.length && String(values[0][0]).toLowerCase().includes("date")) start = 1;

  const out = [];
  for (let r = start; r < values.length; r++) {
    const v = values[r];
    out.push({
      date: v[0] ? Utilities.formatDate(new Date(v[0]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : "",
      sold: Number(v[1])||0,
      pending: Number(v[2])||0,
      cleared: Number(v[3])||0,
      revenue: Number(v[4])||0,
      pipeFee: Number(v[5])||0,
      shareFee: Number(v[6])||0,
      otherFee: Number(v[7])||0,
      saveFee: Number(v[8])||0,
      expense: Number(v[9])||0,
      balance: Number(v[10])||0
    });
  }
  return out;
}

function exportCSV() {
  const data = getDataObjects();
  const header = ["date","sold","pending","cleared","revenue","pipeFee","shareFee","otherFee","saveFee","expense","balance"];
  const rows = [header.join(",")];
  data.forEach(d => {
    rows.push([d.date,d.sold,d.pending,d.cleared,d.revenue,d.pipeFee,d.shareFee,d.otherFee,d.saveFee,d.expense,d.balance].join(","));
  });
  return rows.join("\n");
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
