const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const pool = require("../config/database");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});
const upload = multer({ storage });

// Нормализация номера: убрать пробелы/слэши, латиница→кириллица, uppercase
const normalizeVehicleNumber = (num) => {
  if (!num) return "";
  const lat2cyr = {"A":"А","B":"В","C":"С","E":"Е","H":"Н","K":"К","M":"М","O":"О","P":"Р","T":"Т","X":"Х","Y":"У",
                   "a":"а","b":"в","c":"с","e":"е","h":"н","k":"к","m":"м","o":"о","p":"р","t":"т","x":"х","y":"у"};
  return String(num).replace(/[\s\/\-\.]/g, "").split("").map(c => lat2cyr[c] || c).join("").toUpperCase();
};

// Расстояние Левенштейна для fuzzy matching
const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i-1][j] + 1,
        dp[i][j-1] + 1,
        dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
};

// Найти лучшее совпадение среди наших машин
const findBestMatch = (inputNum, ourVehicles) => {
  const normalized = normalizeVehicleNumber(inputNum);
  
  // Точное совпадение
  const exact = ourVehicles.find(v => normalizeVehicleNumber(v.license_plate) === normalized);
  if (exact) return { match: exact, confidence: 100, type: "exact" };
  
  // Fuzzy matching
  let bestMatch = null, bestDist = Infinity;
  for (const v of ourVehicles) {
    const vNorm = normalizeVehicleNumber(v.license_plate);
    const dist = levenshtein(normalized, vNorm);
    if (dist < bestDist) { bestDist = dist; bestMatch = v; }
  }
  
  // Если расстояние <= 2 символа — хорошее совпадение
  if (bestMatch && bestDist <= 2) {
    return { match: bestMatch, confidence: Math.round(100 - bestDist * 20), type: "fuzzy", distance: bestDist };
  }
  
  return { match: null, confidence: 0, type: "unknown" };
};

// Preview загрузки — показать что будет импортировано
router.post("/wb/preview", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Файл не загружен" });
    
    const workbook = xlsx.readFile(req.file.path);
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    
    // Получаем наши машины
    const vehiclesResult = await pool.query("SELECT id, license_plate FROM vehicles");
    const ourVehicles = vehiclesResult.rows;
    
    // Получаем существующие рейсы для проверки дубликатов
    const tripsResult = await pool.query("SELECT wb_trip_number FROM trips");
    const existingTrips = new Set(tripsResult.rows.map(r => String(r.wb_trip_number)));
    
    const preview = [];
    const stats = { total: 0, ours: 0, rented: 0, duplicates: 0, needsReview: 0 };
    
    for (const row of data) {
      const tripNum = String(row["№"] || "");
      const vehicleNum = String(row["Номер ТС"] || "");
      const driverName = row["ФИО Водителя"] || "";
      const routeName = row["Маршрут"] || "";
      const amount = parseFloat(row["Сумма путевого листа"]) || 0;
      const km = parseInt(row["Километраж"]) || 0;
      const loadingDate = row["Дата открытия"] || "";
      
      if (!tripNum) continue;
      stats.total++;
      
      // Проверка дубликата
      if (existingTrips.has(tripNum)) {
        preview.push({ tripNum, vehicleNum, status: "duplicate", message: "Уже загружен" });
        stats.duplicates++;
        continue;
      }
      
      // Поиск совпадения
      const matchResult = findBestMatch(vehicleNum, ourVehicles);
      const normalized = normalizeVehicleNumber(vehicleNum);
      
      let status, matchedVehicle = null, suggestions = [];
      
      if (matchResult.type === "exact") {
        status = "ok";
        matchedVehicle = matchResult.match.license_plate;
        stats.ours++;
      } else if (matchResult.type === "fuzzy" && matchResult.confidence >= 60) {
        status = "fuzzy";
        matchedVehicle = matchResult.match.license_plate;
        suggestions = [matchResult.match.license_plate];
        stats.needsReview++;
      } else {
        status = "unknown";
        // Найти топ-3 похожих
        const distances = ourVehicles.map(v => ({
          plate: v.license_plate,
          dist: levenshtein(normalized, normalizeVehicleNumber(v.license_plate))
        })).sort((a, b) => a.dist - b.dist).slice(0, 3);
        suggestions = distances.filter(d => d.dist <= 4).map(d => d.plate);
        stats.rented++;
      }
      
      preview.push({
        tripNum, vehicleNum, normalized, driverName, routeName, amount, km, loadingDate,
        status, matchedVehicle, suggestions, confidence: matchResult.confidence
      });
    }
    
    res.json({ preview, stats, filePath: req.file.path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// Подтверждение и импорт
router.post("/wb/confirm", async (req, res) => {
  const { filePath, mappings } = req.body;
  // mappings = { "исходный_номер": "наш_номер" или "rented" }
  
  try {
    const workbook = xlsx.readFile(filePath);
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    
    const parseDateTime = (str) => {
      if (!str) return { date: null, time: null };
      const parts = String(str).match(/(\d{2})[\.\-\/](\d{2})[\.\-\/](\d{4})\s*(\d{2})?:?(\d{2})?/);
      if (!parts) return { date: null, time: null };
      return {
        date: `${parts[3]}-${parts[2]}-${parts[1]}`,
        time: parts[4] && parts[5] ? `${parts[4]}:${parts[5]}` : null
      };
    };
    
    const client = await pool.connect();
    let imported = 0, skipped = 0;
    
    try {
      await client.query("BEGIN");
      
      const importLog = await client.query(
        "INSERT INTO import_log (filename, status) VALUES ($1, $2) RETURNING id",
        ["smart_import", "processing"]
      );
      const batchId = importLog.rows[0].id;
      
      for (const row of data) {
        const tripNum = String(row["№"] || "");
        const vehicleNum = String(row["Номер ТС"] || "");
        
        if (!tripNum) continue;
        
        // Проверка дубликата
        const exists = await client.query("SELECT 1 FROM trips WHERE wb_trip_number = $1", [tripNum]);
        if (exists.rows.length > 0) { 
          // Обновляем время для существующей записи
          const loadDT = parseDateTime(row["Дата открытия"]);
          const unloadDT = parseDateTime(row["Дата закрытия"]);
          if (loadDT.time || unloadDT.time) {
            await client.query(`UPDATE trips SET loading_time = COALESCE($1, loading_time), unloading_time = COALESCE($2, unloading_time) WHERE wb_trip_number = $3`, [loadDT.time, unloadDT.time, tripNum]);
            imported++;
          } else {
            skipped++;
          }
          continue;
        }
        
        // Определяем финальный номер машины
        const normalized = normalizeVehicleNumber(vehicleNum);
        let finalVehicle = mappings?.[vehicleNum] || mappings?.[normalized] || normalized;
        const isRented = finalVehicle === "rented";
        if (isRented) finalVehicle = normalized;
        
        const loadDT = parseDateTime(row["Дата открытия"]);
        const unloadDT = parseDateTime(row["Дата закрытия"]);
        
        await client.query(`
          INSERT INTO trips (wb_trip_number, loading_date, loading_time, unloading_date, unloading_time,
            vehicle_number, driver_name, route_name, trip_amount, distance_km,
            has_penalty, penalty_amount, containers_count, distribution_center, import_batch_id, is_rented)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          tripNum, loadDT.date, loadDT.time, unloadDT.date, unloadDT.time,
          finalVehicle, row["ФИО Водителя"] || "", row["Маршрут"] || "",
          parseFloat(row["Сумма путевого листа"]) || 0,
          parseInt(row["Километраж"]) || 0,
          String(row["Штраф"] || "").toLowerCase() === "да",
          parseFloat(row["Сумма штрафов"]) || 0,
          parseInt(row["Контейнеры"]) || 0,
          row["РЦ"] || "",
          batchId,
          isRented
        ]);
        imported++;
      }
      
      await client.query("UPDATE import_log SET rows_imported=$1, rows_skipped=$2, status=$3 WHERE id=$4",
        [imported, skipped, "success", batchId]);
      await client.query("COMMIT");
      
      res.json({ success: true, imported, skipped });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
