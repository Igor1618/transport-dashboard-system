const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const pool = require("../config/database");
const fs = require("fs");
const upload = multer({ dest: "uploads/" });

router.get("/list", async (req, res) => {
  const { from, to, source, vehicle } = req.query;
  try {
    let where = "WHERE 1=1", params = [], idx = 1;
    if (from) { where += " AND transaction_date >= $" + idx++; params.push(from); }
    if (to) { where += " AND transaction_date <= $" + idx++; params.push(to); }
    if (source) { where += " AND source = $" + idx++; params.push(source); }
    if (vehicle) { where += " AND LOWER(REPLACE(vehicle_number, ' ', '')) LIKE LOWER($" + idx++ + ")"; params.push("%" + vehicle.replace(/\s/g,"") + "%"); }
    const txResult = await pool.query("SELECT * FROM fuel_transactions " + where + " ORDER BY transaction_date DESC LIMIT 500", params);
    const summaryResult = await pool.query("SELECT source, SUM(quantity)::numeric as total_liters, SUM(amount)::numeric as total_amount, COUNT(*)::int as transactions FROM fuel_transactions " + where + " GROUP BY source ORDER BY total_amount DESC", params);
    res.json({ transactions: txResult.rows, summary: summaryResult.rows });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Файл не загружен" });
    const source = req.body.source || "Unknown";
    const wb = xlsx.readFile(req.file.path, { codepage: 1251 });
    const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    let result;
    if (source === "Татнефть") result = await parseTatneftDetailed(data, source);
    else if (source === "Газпромнефть") result = await parseGazpromDetailed(data, source);
    else if (source === "ТК Движение") result = await parseTKDvizhenieDetailed(data, source);
    else result = await parseE100Detailed(data, source);
    fs.unlinkSync(req.file.path);
    res.json({ success: true, imported: result.imported, duplicates: result.duplicates || 0, errors: result.errors, errorDetails: result.errorDetails || [], duplicateDetails: result.duplicateDetails || [], total: data.length });
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

router.post("/preview", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Файл не загружен" });
    const source = req.body.source || "Unknown";
    const wb = xlsx.readFile(req.file.path, { codepage: 1251 });
    const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    let result;
    if (source === "Татнефть") result = await previewTatneft(data, source);
    else if (source === "Газпромнефть") result = await previewGazprom(data, source);
    else if (source === "ТК Движение") result = await previewTKDvizhenie(data, source);
    else result = await previewE100(data, source);
    fs.unlinkSync(req.file.path);
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, message: String(err) }); }
});

async function findVehicleByInternal(num) {
  if (!num) return null;
  const n = String(num).replace(/\D/g, "").padStart(3, "0");
  if (n.length < 2 || n.length > 3) return null;
  const r = await pool.query(
    "SELECT DISTINCT normalize_vehicle_number(vehicle_number) as number FROM driver_reports WHERE vehicle_number IS NOT NULL AND normalize_vehicle_number(vehicle_number) LIKE $1 LIMIT 1",
    ["%" + n + "%"]
  );
  return r.rows[0]?.number || null;
}

async function findVehicleByCard(cardNumber, source) {
  if (!cardNumber) return null;
  const r = await pool.query("SELECT vehicle_number FROM fuel_cards WHERE card_number = $1 AND source = $2", [cardNumber, source]);
  return r.rows[0]?.vehicle_number || null;
}

async function autoCreateCard(cardNumber, source, vehicleNumber, driverName, holder) {
  if (!cardNumber) return;
  try {
    await pool.query(
      "INSERT INTO fuel_cards (card_number, source, vehicle_number, driver_name, notes) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (source, card_number) DO UPDATE SET vehicle_number = COALESCE(fuel_cards.vehicle_number, $3)",
      [cardNumber, source, vehicleNumber, driverName, holder]
    );
  } catch (e) {}
}

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === "number") return new Date((val - 25569) * 86400000).toISOString().slice(0, 10);
  if (typeof val === "string") { 
    var m = val.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    m = val.match(/(\d{2})[.-](\d{2})[.-](\d{4})/); 
    if (m) return m[3]+"-"+m[2]+"-"+m[1]; 
  }
  return null;
}

function extractVehicleNumber(text) {
  if (!text) return null;
  var match = text.match(/([АВЕКМНОРСТУХ])\s*(\d{3})\s*([АВЕКМНОРСТУХ]{2})\s*[\/]?\s*(\d{2,3})/i);
  if (match) {
    return (match[1] + match[2] + match[3] + match[4]).toUpperCase()
      .replace(/А/g,"A").replace(/В/g,"B").replace(/Е/g,"E").replace(/К/g,"K")
      .replace(/М/g,"M").replace(/Н/g,"H").replace(/О/g,"O").replace(/Р/g,"P")
      .replace(/С/g,"C").replace(/Т/g,"T").replace(/У/g,"Y").replace(/Х/g,"X");
  }
  return null;
}

// ========== E100 ==========
async function previewE100(data, source) {
  var cardsMap = new Map();
  var totalLiters = 0, totalAmount = 0, txCount = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i]; if (!row || row.length < 10) continue;
    var quantity = parseFloat(row[1]) || 0, amount = parseFloat(row[3]) || 0;
    var driverName = String(row[10] || "").trim(), holder = String(row[9] || "").trim();
    var cardNumber = String(row[12] || "").replace(/\s*:\s*$/, "").trim();
    if (!cardNumber || quantity <= 0) continue;
    var vehicleHint = extractVehicleNumber(holder), internalHint = null;
    if (!vehicleHint) { var m = holder.match(/(\d{2,3})/); if (m) internalHint = m[1]; }
    if (!cardsMap.has(cardNumber)) cardsMap.set(cardNumber, { card_number: cardNumber, driver_name: driverName, vehicle_hint: vehicleHint, internal_hint: internalHint, holder: holder, total_liters: 0, total_amount: 0, count: 0 });
    var card = cardsMap.get(cardNumber); card.total_liters += quantity; card.total_amount += amount; card.count++;
    totalLiters += quantity; totalAmount += amount; txCount++;
  }
  var cards = Array.from(cardsMap.values());
  for (var c of cards) {
    var v = await findVehicleByCard(c.card_number, source);
    if (!v && c.vehicle_hint) v = c.vehicle_hint;
    if (!v && c.internal_hint) v = await findVehicleByInternal(c.internal_hint);
    c.vehicle_number = v; c.source = source;
    if (!c.vehicle_hint && c.internal_hint) c.vehicle_hint = "Бортовой: " + c.internal_hint;
  }
  return { success: true, source: source, cards: cards, total_transactions: txCount, total_liters: totalLiters, total_amount: totalAmount, unlinked_cards: cards.filter(function(c) { return !c.vehicle_number; }).length };
}

async function parseE100Detailed(data, source) {
  var imported = 0, errors = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i]; if (!row || row.length < 10) { errors++; continue; }
    try {
      var dateVal = row[0], quantity = parseFloat(row[1]) || 0, price = parseFloat(row[2]) || 0, amount = parseFloat(row[3]) || 0;
      var fuelType = row[6] || "ДТ", brand = row[7] || "", station = row[8] || "";
      var holder = String(row[9] || "").trim(), driverName = String(row[10] || "").trim();
      var cardNumber = String(row[12] || "").replace(/\s*:\s*$/, "").trim();
      var transactionDate = parseExcelDate(dateVal);
      if (!transactionDate || quantity <= 0) { errors++; continue; }
      var vehicleNumber = await findVehicleByCard(cardNumber, source);
      if (!vehicleNumber) vehicleNumber = extractVehicleNumber(holder);
      if (!vehicleNumber) { var m = holder.match(/(\d{2,3})/); if (m) vehicleNumber = await findVehicleByInternal(m[1]); }
      await pool.query("INSERT INTO fuel_transactions (source, card_number, vehicle_number, driver_name, transaction_date, fuel_type, quantity, price_per_liter, amount, station_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [source, cardNumber, vehicleNumber, driverName, transactionDate, fuelType, quantity, price, amount, brand + " - " + station]);
      await autoCreateCard(cardNumber, source, vehicleNumber, driverName, holder);
      imported++;
    } catch (err) { errors++; }
  }
  return { imported: imported, errors: errors };
}

// ========== ТАТНЕФТЬ ==========
async function previewTatneft(data, source) {
  var cardsMap = new Map();
  var totalLiters = 0, totalAmount = 0, txCount = 0;
  for (var i = 2; i < data.length; i++) {
    var row = data[i]; if (!row || row.length < 15) continue;
    var cardNumber = String(row[1] || "").trim(), holder = String(row[2] || "");
    var quantity = parseFloat(row[11]) || 0, amount = parseFloat(row[14]) || 0;
    if (!cardNumber || quantity <= 0) continue;
    var internalHint = null; var m = holder.match(/:\s*[А-Яа-яA-Za-z]+\/(\d+)/); if (m) internalHint = m[1];
    if (!cardsMap.has(cardNumber)) cardsMap.set(cardNumber, { card_number: cardNumber, internal_hint: internalHint, holder: holder, total_liters: 0, total_amount: 0, count: 0 });
    var card = cardsMap.get(cardNumber); card.total_liters += quantity; card.total_amount += amount; card.count++;
    totalLiters += quantity; totalAmount += amount; txCount++;
  }
  var cards = Array.from(cardsMap.values());
  for (var c of cards) {
    var v = await findVehicleByCard(c.card_number, source);
    if (!v && c.internal_hint) v = await findVehicleByInternal(c.internal_hint);
    c.vehicle_number = v; c.source = source;
    c.vehicle_hint = c.internal_hint ? "Бортовой: " + c.internal_hint : null;
  }
  return { success: true, source: source, cards: cards, total_transactions: txCount, total_liters: totalLiters, total_amount: totalAmount, unlinked_cards: cards.filter(function(c) { return !c.vehicle_number; }).length };
}

async function parseTatneftDetailed(data, source) {
  var imported = 0, errors = 0;
  for (var i = 2; i < data.length; i++) {
    var row = data[i]; if (!row || row.length < 15) { errors++; continue; }
    try {
      var dateVal = row[0], cardNumber = String(row[1] || "").trim(), holder = String(row[2] || "");
      var station = String(row[9] || ""), fuelType = String(row[10] || "ДТ");
      var quantity = parseFloat(row[11]) || 0, price = parseFloat(row[13]) || 0, amount = parseFloat(row[14]) || 0;
      var transactionDate = parseExcelDate(dateVal);
      if (!transactionDate || quantity <= 0) { errors++; continue; }
      var vehicleNumber = await findVehicleByCard(cardNumber, source);
      if (!vehicleNumber) { var m = holder.match(/:\s*[А-Яа-яA-Za-z]+\/(\d+)/); if (m) vehicleNumber = await findVehicleByInternal(m[1]); }
      await pool.query("INSERT INTO fuel_transactions (source, card_number, vehicle_number, driver_name, transaction_date, fuel_type, quantity, price_per_liter, amount, station_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [source, cardNumber, vehicleNumber, null, transactionDate, fuelType, quantity, price, amount, station]);
      await autoCreateCard(cardNumber, source, vehicleNumber, null, holder);
      imported++;
    } catch (err) { errors++; }
  }
  return { imported: imported, errors: errors };
}

// ========== ГАЗПРОМНЕФТЬ ==========
async function previewGazprom(data, source) {
  var cardsMap = new Map();
  var totalLiters = 0, totalAmount = 0, txCount = 0;
  for (var i = 11; i < data.length; i++) {
    var row = data[i]; if (!row || row.length < 19) continue;
    var cardNumber = String(row[0] || "").trim();
    var driverName = String(row[2] || "").replace(/;$/, "").trim();
    var quantity = parseFloat(row[11]) || 0, amount = parseFloat(row[18]) || 0;
    if (!cardNumber || cardNumber.length < 10 || quantity <= 0) continue;
    if (!cardsMap.has(cardNumber)) cardsMap.set(cardNumber, { card_number: cardNumber, driver_name: driverName, total_liters: 0, total_amount: 0, count: 0 });
    var card = cardsMap.get(cardNumber); card.total_liters += quantity; card.total_amount += amount; card.count++;
    if (driverName && !card.driver_name) card.driver_name = driverName;
    totalLiters += quantity; totalAmount += amount; txCount++;
  }
  var cards = Array.from(cardsMap.values());
  for (var c of cards) {
    var r = await pool.query("SELECT vehicle_number FROM fuel_cards WHERE card_number = $1 AND source = $2", [c.card_number, source]);
    c.vehicle_number = r.rows[0]?.vehicle_number || null; c.source = source;
  }
  return { success: true, source: source, cards: cards, total_transactions: txCount, total_liters: totalLiters, total_amount: totalAmount, unlinked_cards: cards.filter(function(c) { return !c.vehicle_number; }).length };
}

async function parseGazpromDetailed(data, source) {
  var imported = 0, errors = 0;
  for (var i = 11; i < data.length; i++) {
    var row = data[i]; if (!row || row.length < 19) { errors++; continue; }
    try {
      var cardNumber = String(row[0] || "").trim();
      var driverName = String(row[2] || "").replace(/;$/, "").trim();
      var dateVal = row[4], station = String(row[7] || "") + " - " + String(row[9] || "");
      var fuelType = String(row[10] || "ДТ"), quantity = parseFloat(row[11]) || 0;
      var price = parseFloat(row[14]) || 0, amount = parseFloat(row[18]) || 0;
      if (!cardNumber || cardNumber.length < 10) { errors++; continue; }
      var transactionDate = parseExcelDate(dateVal);
      if (!transactionDate || quantity <= 0) { errors++; continue; }
      var vehicleNumber = await findVehicleByCard(cardNumber, source);
      await pool.query("INSERT INTO fuel_transactions (source, card_number, vehicle_number, driver_name, transaction_date, fuel_type, quantity, price_per_liter, amount, station_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [source, cardNumber, vehicleNumber, driverName, transactionDate, fuelType, quantity, price, amount, station]);
      await autoCreateCard(cardNumber, source, vehicleNumber, driverName, null);
      imported++;
    } catch (err) { errors++; }
  }
  return { imported: imported, errors: errors };
}

// ========== ТК ДВИЖЕНИЕ ==========
async function previewTKDvizhenie(data, source) {
  var cardsMap = new Map();
  var totalLiters = 0, totalAmount = 0, txCount = 0;
  var currentCard = null;
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var first = String(row[0] || "");
    
    if (first.includes("Карта №")) {
      var cardMatch = first.match(/Карта №(\d+)/);
      currentCard = cardMatch ? cardMatch[1] : null;
      if (currentCard && !cardsMap.has(currentCard)) {
        cardsMap.set(currentCard, { card_number: currentCard, total_liters: 0, total_amount: 0, count: 0 });
      }
      continue;
    }
    
    if (row[1] !== "Дебет" || !currentCard) continue;
    
    var quantity = parseFloat(row[9]) || 0;
    var amountStr = String(row[10] || "0").replace(/\s/g, "").replace(",", ".");
    var amount = parseFloat(amountStr) || 0;
    
    if (quantity <= 0) continue;
    
    var card = cardsMap.get(currentCard);
    if (card) { card.total_liters += quantity; card.total_amount += amount; card.count++; }
    totalLiters += quantity;
    totalAmount += amount;
    txCount++;
  }
  
  var cards = Array.from(cardsMap.values());
  for (var c of cards) {
    var r = await pool.query("SELECT vehicle_number FROM fuel_cards WHERE card_number = $1 AND source = $2", [c.card_number, source]);
    c.vehicle_number = r.rows[0]?.vehicle_number || null;
    c.source = source;
  }
  
  return { success: true, source: source, cards: cards, total_transactions: txCount, total_liters: totalLiters, total_amount: totalAmount, unlinked_cards: cards.filter(function(c) { return !c.vehicle_number; }).length };
}

async function parseTKDvizhenieDetailed(data, source) {
  var imported = 0, errors = 0;
  var currentCard = null;
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var first = String(row[0] || "");
    
    if (first.includes("Карта №")) {
      var cardMatch = first.match(/Карта №(\d+)/);
      currentCard = cardMatch ? cardMatch[1] : null;
      continue;
    }
    
    if (row[1] !== "Дебет" || !currentCard) continue;
    
    try {
      var station = String(row[0] || "");
      var dateStr = String(row[2] || "");
      var fuelType = String(row[4] || "ДТ");
      var price = parseFloat(row[7]) || 0;
      var quantity = parseFloat(row[9]) || 0;
      var amountStr = String(row[10] || "0").replace(/\s/g, "").replace(",", ".");
      var amount = parseFloat(amountStr) || 0;
      
      var dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      var transactionDate = dateMatch ? dateMatch[0] : null;
      
      if (!transactionDate || quantity <= 0) { errors++; continue; }
      
      var vehicleNumber = await findVehicleByCard(currentCard, source);
      
      await pool.query("INSERT INTO fuel_transactions (source, card_number, vehicle_number, driver_name, transaction_date, fuel_type, quantity, price_per_liter, amount, station_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [source, currentCard, vehicleNumber, null, transactionDate, fuelType, quantity, price, amount, station]);
      
      imported++;
    } catch (err) { errors++; }
  }
  return { imported: imported, errors: errors };
}

module.exports = router;

// Детальные парсеры с информацией о дубликатах и ошибках

async function checkDuplicate(source, cardNumber, transactionDate, amount) {
  const r = await pool.query(
    "SELECT id FROM fuel_transactions WHERE source=$1 AND card_number=$2 AND transaction_date=$3 AND amount=$4 LIMIT 1",
    [source, cardNumber, transactionDate, amount]
  );
  return r.rows.length > 0;
}

async function parseE100Detailed(data, source) {
  var imported = 0, duplicates = 0, errors = 0;
  var errorDetails = [], duplicateDetails = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i]; 
    if (!row || row.length < 10) { 
      errors++; 
      errorDetails.push({ row: i+1, reason: "Недостаточно колонок" });
      continue; 
    }
    try {
      var dateVal = row[0], quantity = parseFloat(row[1]) || 0, price = parseFloat(row[2]) || 0, amount = parseFloat(row[3]) || 0;
      var fuelType = row[6] || "ДТ", brand = row[7] || "", station = row[8] || "";
      var holder = String(row[9] || "").trim(), driverName = String(row[10] || "").trim();
      var cardNumber = String(row[12] || "").replace(/\s*:\s*$/, "").trim();
      var transactionDate = parseExcelDate(dateVal);
      
      if (!transactionDate) { errors++; errorDetails.push({ row: i+1, reason: "Неверная дата: " + dateVal }); continue; }
      if (quantity <= 0) { errors++; errorDetails.push({ row: i+1, reason: "Количество <= 0" }); continue; }
      if (!cardNumber) { errors++; errorDetails.push({ row: i+1, reason: "Нет номера карты" }); continue; }
      
      // Проверка дубликата
      if (await checkDuplicate(source, cardNumber, transactionDate, amount)) {
        duplicates++;
        duplicateDetails.push({ row: i+1, card: cardNumber, date: transactionDate, amount: amount });
        continue;
      }
      
      var vehicleNumber = await findVehicleByCard(cardNumber, source);
      if (!vehicleNumber) vehicleNumber = extractVehicleNumber(holder);
      if (!vehicleNumber) { var m = holder.match(/(\d{2,3})/); if (m) vehicleNumber = await findVehicleByInternal(m[1]); }
      
      await pool.query("INSERT INTO fuel_transactions (source, card_number, vehicle_number, driver_name, transaction_date, fuel_type, quantity, price_per_liter, amount, station_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", 
        [source, cardNumber, vehicleNumber, driverName, transactionDate, fuelType, quantity, price, amount, brand + " - " + station]);
      await autoCreateCard(cardNumber, source, vehicleNumber, driverName, holder);
      imported++;
    } catch (err) { 
      errors++; 
      errorDetails.push({ row: i+1, reason: String(err).substring(0, 100) }); 
    }
  }
  return { imported, duplicates, errors, errorDetails: errorDetails.slice(0, 20), duplicateDetails: duplicateDetails.slice(0, 20) };
}

async function parseTatneftDetailed(data, source) {
  var imported = 0, duplicates = 0, errors = 0;
  var errorDetails = [], duplicateDetails = [];
  
  for (var i = 2; i < data.length; i++) {
    var row = data[i]; 
    if (!row || row.length < 15) { errors++; errorDetails.push({ row: i+1, reason: "Недостаточно колонок" }); continue; }
    try {
      var dateVal = row[0], cardNumber = String(row[1] || "").trim(), holder = String(row[2] || "");
      var station = String(row[9] || ""), fuelType = String(row[10] || "ДТ");
      var quantity = parseFloat(row[11]) || 0, price = parseFloat(row[13]) || 0, amount = parseFloat(row[14]) || 0;
      var transactionDate = parseExcelDate(dateVal);
      
      if (!transactionDate) { errors++; errorDetails.push({ row: i+1, reason: "Неверная дата" }); continue; }
      if (quantity <= 0) { errors++; errorDetails.push({ row: i+1, reason: "Количество <= 0" }); continue; }
      
      if (await checkDuplicate(source, cardNumber, transactionDate, amount)) {
        duplicates++;
        duplicateDetails.push({ row: i+1, card: cardNumber, date: transactionDate, amount: amount });
        continue;
      }
      
      var vehicleNumber = await findVehicleByCard(cardNumber, source);
      if (!vehicleNumber) { var m = holder.match(/:\s*[А-Яа-яA-Za-z]+\/(\d+)/); if (m) vehicleNumber = await findVehicleByInternal(m[1]); }
      
      await pool.query("INSERT INTO fuel_transactions (source, card_number, vehicle_number, driver_name, transaction_date, fuel_type, quantity, price_per_liter, amount, station_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", 
        [source, cardNumber, vehicleNumber, null, transactionDate, fuelType, quantity, price, amount, station]);
      await autoCreateCard(cardNumber, source, vehicleNumber, null, holder);
      imported++;
    } catch (err) { errors++; errorDetails.push({ row: i+1, reason: String(err).substring(0, 100) }); }
  }
  return { imported, duplicates, errors, errorDetails: errorDetails.slice(0, 20), duplicateDetails: duplicateDetails.slice(0, 20) };
}

async function parseGazpromDetailed(data, source) {
  var imported = 0, duplicates = 0, errors = 0;
  var errorDetails = [], duplicateDetails = [];
  
  for (var i = 11; i < data.length; i++) {
    var row = data[i]; 
    if (!row || row.length < 19) { errors++; errorDetails.push({ row: i+1, reason: "Недостаточно колонок" }); continue; }
    try {
      var cardNumber = String(row[0] || "").trim();
      var driverName = String(row[2] || "").replace(/;$/, "").trim();
      var dateVal = row[4], station = String(row[7] || "") + " - " + String(row[9] || "");
      var fuelType = String(row[10] || "ДТ"), quantity = parseFloat(row[11]) || 0;
      var price = parseFloat(row[14]) || 0, amount = parseFloat(row[18]) || 0;
      
      if (!cardNumber || cardNumber.length < 10) { errors++; errorDetails.push({ row: i+1, reason: "Неверный номер карты" }); continue; }
      var transactionDate = parseExcelDate(dateVal);
      if (!transactionDate) { errors++; errorDetails.push({ row: i+1, reason: "Неверная дата" }); continue; }
      if (quantity <= 0) { errors++; errorDetails.push({ row: i+1, reason: "Количество <= 0" }); continue; }
      
      if (await checkDuplicate(source, cardNumber, transactionDate, amount)) {
        duplicates++;
        duplicateDetails.push({ row: i+1, card: cardNumber, date: transactionDate, amount: amount });
        continue;
      }
      
      var vehicleNumber = await findVehicleByCard(cardNumber, source);
      await pool.query("INSERT INTO fuel_transactions (source, card_number, vehicle_number, driver_name, transaction_date, fuel_type, quantity, price_per_liter, amount, station_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", 
        [source, cardNumber, vehicleNumber, driverName, transactionDate, fuelType, quantity, price, amount, station]);
      await autoCreateCard(cardNumber, source, vehicleNumber, driverName, null);
      imported++;
    } catch (err) { errors++; errorDetails.push({ row: i+1, reason: String(err).substring(0, 100) }); }
  }
  return { imported, duplicates, errors, errorDetails: errorDetails.slice(0, 20), duplicateDetails: duplicateDetails.slice(0, 20) };
}

async function parseTKDvizhenieDetailed(data, source) {
  var imported = 0, duplicates = 0, errors = 0;
  var errorDetails = [], duplicateDetails = [];
  var currentCard = null;
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var first = String(row[0] || "");
    
    if (first.includes("Карта №")) {
      var cardMatch = first.match(/Карта №(\d+)/);
      currentCard = cardMatch ? cardMatch[1] : null;
      continue;
    }
    
    if (row[1] !== "Дебет" || !currentCard) continue;
    
    try {
      var station = String(row[0] || "");
      var dateStr = String(row[2] || "");
      var fuelType = String(row[4] || "ДТ");
      var price = parseFloat(row[7]) || 0;
      var quantity = parseFloat(row[9]) || 0;
      var amountStr = String(row[10] || "0").replace(/\s/g, "").replace(",", ".");
      var amount = parseFloat(amountStr) || 0;
      
      var dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      var transactionDate = dateMatch ? dateMatch[0] : null;
      
      if (!transactionDate) { errors++; errorDetails.push({ row: i+1, reason: "Неверная дата: " + dateStr }); continue; }
      if (quantity <= 0) { errors++; errorDetails.push({ row: i+1, reason: "Количество <= 0" }); continue; }
      
      if (await checkDuplicate(source, currentCard, transactionDate, amount)) {
        duplicates++;
        duplicateDetails.push({ row: i+1, card: currentCard, date: transactionDate, amount: amount });
        continue;
      }
      
      var vehicleNumber = await findVehicleByCard(currentCard, source);
      await pool.query("INSERT INTO fuel_transactions (source, card_number, vehicle_number, driver_name, transaction_date, fuel_type, quantity, price_per_liter, amount, station_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [source, currentCard, vehicleNumber, null, transactionDate, fuelType, quantity, price, amount, station]);
      imported++;
    } catch (err) { errors++; errorDetails.push({ row: i+1, reason: String(err).substring(0, 100) }); }
  }
  return { imported, duplicates, errors, errorDetails: errorDetails.slice(0, 20), duplicateDetails: duplicateDetails.slice(0, 20) };
}
