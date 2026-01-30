const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const pool = require("../config/database");
const path = require("path");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });

// Список транзакций с фильтрами
router.get("/list", async (req, res) => {
  const { from, to, source, vehicle } = req.query;
  
  try {
    let where = "WHERE 1=1";
    const params = [];
    let paramIdx = 1;
    
    if (from) {
      where += ` AND transaction_date >= $${paramIdx}`;
      params.push(from);
      paramIdx++;
    }
    if (to) {
      where += ` AND transaction_date <= $${paramIdx}`;
      params.push(to);
      paramIdx++;
    }
    if (source) {
      where += ` AND source = $${paramIdx}`;
      params.push(source);
      paramIdx++;
    }
    if (vehicle) {
      where += ` AND LOWER(REPLACE(vehicle_number,  , )) LIKE LOWER($${paramIdx})`;
      params.push("%" + vehicle + "%");
      paramIdx++;
    }
    
    // Транзакции
    const txResult = await pool.query(`
      SELECT id, source, card_number, vehicle_number, driver_name, 
             transaction_date, fuel_type, quantity, price_per_liter, amount, station_name
      FROM fuel_transactions
      ${where}
      ORDER BY transaction_date DESC, id DESC
      LIMIT 500
    `, params);
    
    // Сводка по компаниям
    const summaryResult = await pool.query(`
      SELECT source,
             SUM(quantity)::numeric as total_liters,
             SUM(amount)::numeric as total_amount,
             COUNT(*)::int as transactions
      FROM fuel_transactions
      ${where}
      GROUP BY source
      ORDER BY total_amount DESC
    `, params);
    
    res.json({
      transactions: txResult.rows,
      summary: summaryResult.rows
    });
  } catch (err) {
    console.error("Fuel list error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// Загрузка файла топлива
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Файл не загружен" });
    }
    
    const source = req.body.source || "Unknown";
    const filePath = req.file.path;
    
    // Читаем Excel
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    let imported = 0;
    let errors = 0;
    
    for (const row of data) {
      try {
        // Пытаемся найти нужные поля (разные форматы от разных компаний)
        const transaction_date = parseDate(row["Дата"] || row["Date"] || row["Дата транзакции"] || row["Дата операции"]);
        const vehicle_number = row["Гос. номер"] || row["Номер ТС"] || row["Госномер"] || row["Vehicle"] || "";
        const quantity = parseFloat(row["Литры"] || row["Количество"] || row["Liters"] || row["Объем"] || 0);
        const amount = parseFloat(row["Сумма"] || row["Amount"] || row["Стоимость"] || 0);
        const price = parseFloat(row["Цена"] || row["Price"] || row["Цена за литр"] || (quantity > 0 ? amount / quantity : 0));
        const card_number = row["Карта"] || row["№ карты"] || row["Card"] || "";
        const driver_name = row["Водитель"] || row["ФИО"] || row["Driver"] || "";
        const fuel_type = row["Топливо"] || row["Вид топлива"] || row["Fuel"] || "ДТ";
        const station = row["АЗС"] || row["Станция"] || row["Station"] || "";
        
        if (!transaction_date || !vehicle_number || quantity <= 0) {
          errors++;
          continue;
        }
        
        await pool.query(`
          INSERT INTO fuel_transactions 
            (source, card_number, vehicle_number, driver_name, transaction_date, fuel_type, quantity, price_per_liter, amount, station_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [source, card_number, vehicle_number, driver_name, transaction_date, fuel_type, quantity, price, amount, station]);
        
        imported++;
      } catch (err) {
        errors++;
      }
    }
    
    // Удаляем временный файл
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      imported,
      errors,
      total: data.length,
      message: `Обработано ${data.length} строк`
    });
  } catch (err) {
    console.error("Fuel upload error:", err);
    res.status(500).json({ success: false, message: String(err) });
  }
});

function parseDate(val) {
  if (!val) return null;
  if (typeof val === "number") {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + val * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof val === "string") {
    // DD.MM.YYYY or DD-MM-YYYY
    const match = val.match(/(\d{2})[.-](\d{2})[.-](\d{4})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    // YYYY-MM-DD
    const isoMatch = val.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[0];
  }
  return null;
}

module.exports = router;
