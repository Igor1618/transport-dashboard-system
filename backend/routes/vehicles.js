const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// Список машин с фильтрами
router.get("/list", async (req, res) => {
  const { search, type, status } = req.query;
  try {
    let query = `
      SELECT v.*, 
        (SELECT COUNT(*) FROM fuel_transactions ft WHERE ft.vehicle_number ~ SUBSTRING(v.normalized_number FROM 2 FOR 3)) as fuel_count,
        (SELECT COUNT(*) FROM driver_reports dr WHERE dr.vehicle_number ~ SUBSTRING(v.normalized_number FROM 2 FOR 3)) as report_count
      FROM vehicles v WHERE 1=1
    `;
    const params = [];
    let idx = 1;
    
    if (search) {
      query += ` AND (v.license_plate ILIKE $${idx} OR v.normalized_number ILIKE $${idx} OR v.model ILIKE $${idx} OR v.internal_number ILIKE $${idx})`;
      params.push("%" + search + "%");
      idx++;
    }
    if (type) {
      query += ` AND v.vehicle_type = $${idx}`;
      params.push(type);
      idx++;
    }
    if (status) {
      query += ` AND v.status = $${idx}`;
      params.push(status);
      idx++;
    }
    
    query += " ORDER BY v.normalized_number";
    
    const result = await pool.query(query, params);
    res.json({ vehicles: result.rows, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Типы машин
router.get("/types", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM vehicle_types ORDER BY name");
    res.json({ types: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});


// Получить машину по номеру
router.get("/by-number", async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).json({ error: "number required" });
  try {
    const result = await pool.query(
      "SELECT id, license_plate as number, vehicle_type, fuel_cards, fuel_norm_summer, fuel_norm_autumn, fuel_norm_winter FROM vehicles WHERE license_plate ILIKE $1 OR normalize_vehicle_number(license_plate) = normalize_vehicle_number($1) LIMIT 1",
      [number]
    );
    res.json(result.rows[0] || { number, vehicle_type: null, fuel_cards: {} });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
// Получить машину по ID
router.get("/list-with-activity", async (req, res) => {
  try {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().split("T")[0];
    
    const result = await pool.query(`
      SELECT v.*,
        COALESCE((
          SELECT MAX(loading_date) FROM trips t 
          WHERE normalize_vehicle_number(t.vehicle_number) = normalize_vehicle_number(v.license_plate)
        ), NULL) as last_trip_date,
        COALESCE((
          SELECT MAX(date) FROM contracts c 
          WHERE normalize_vehicle_number(c.vehicle_number) = normalize_vehicle_number(v.license_plate)
        ), NULL) as last_contract_date,
        CASE WHEN EXISTS (
          SELECT 1 FROM trips t 
          WHERE normalize_vehicle_number(t.vehicle_number) = normalize_vehicle_number(v.license_plate)
            AND t.loading_date >= $1
        ) OR EXISTS (
          SELECT 1 FROM contracts c 
          WHERE normalize_vehicle_number(c.vehicle_number) = normalize_vehicle_number(v.license_plate)
            AND c.date >= $1
        ) THEN true ELSE false END as is_active
      FROM vehicles v
      ORDER BY 
        CASE WHEN EXISTS (
          SELECT 1 FROM trips t 
          WHERE normalize_vehicle_number(t.vehicle_number) = normalize_vehicle_number(v.license_plate)
            AND t.loading_date >= $1
        ) OR EXISTS (
          SELECT 1 FROM contracts c 
          WHERE normalize_vehicle_number(c.vehicle_number) = normalize_vehicle_number(v.license_plate)
            AND c.date >= $1
        ) THEN 0 ELSE 1 END,
        v.license_plate
    `, [monthAgoStr]);
    
    res.json({ vehicles: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM vehicles WHERE id = $1 LIMIT 1", [req.params.id]);
    if (result.rows[0]) {
      res.json({ vehicle: result.rows[0] });
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Нормализация номера (латиница → кириллица)
function normalizeNumber(plate) {
  if (!plate) return null;
  const lat = "ABEKMHOPCTXY";
  const cyr = "АВЕКМНОРСТХУ";
  let n = plate.toUpperCase().replace(/[\s\/\-\.]/g, "");
  for (let i = 0; i < lat.length; i++) {
    n = n.split(lat[i]).join(cyr[i]);
  }
  return n;
}

// Создать машину
router.post("/create", async (req, res) => {
  const { license_plate, model, internal_number, vehicle_type, year, vin, brand, status } = req.body;
  if (!license_plate) return res.status(400).json({ error: "license_plate required" });
  
  try {
    const normalized = normalizeNumber(license_plate);
    const id = normalized.match(/\d{3}/)?.[0] || normalized.slice(0, 5);
    
    const result = await pool.query(`
      INSERT INTO vehicles (id, license_plate, model, internal_number, vehicle_type, year, vin, brand, status, normalized_number, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (id) DO UPDATE SET 
        license_plate = EXCLUDED.license_plate,
        model = EXCLUDED.model,
        normalized_number = EXCLUDED.normalized_number
      RETURNING *
    `, [id, license_plate, model || null, internal_number || null, vehicle_type || null, year || null, vin || null, brand || null, status || 'active', normalized]);
    
    res.json({ success: true, vehicle: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Обновить машину
router.post("/update", async (req, res) => {
  const { id, ...fields } = req.body;
  if (!id) return res.status(400).json({ error: "id required" });
  
  try {
    // Получаем старые значения для истории
    const oldRes = await pool.query("SELECT * FROM vehicles WHERE id = $1", [id]);
    const oldVehicle = oldRes.rows[0];
    
    // Нормализуем номер если изменился
    if (fields.license_plate) {
      fields.normalized_number = normalizeNumber(fields.license_plate);
    }
    
    // Формируем UPDATE
    const setClauses = [];
    const values = [id];
    let idx = 2;
    
    const allowedFields = [
      'license_plate', 'model', 'internal_number', 'vehicle_type', 'year', 'vin',
      'brand', 'status', 'current_driver', 'normalized_number',
      'sts_number', 'sts_date', 'sts_issued_by',
      'pts_number', 'pts_date', 'pts_issued_by',
      'osago_number', 'osago_expires',
      'diagnostics_number', 'diagnostics_expires',
      'tachograph_number', 'tachograph_expires',
      'fuel_norm_summer', 'fuel_norm_autumn', 'fuel_norm_winter',
      'color', 'owner', 'notes', 'photo_url'
    ];
    
    for (const [key, value] of Object.entries(fields)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${idx}`);
        values.push(value === '' ? null : value);
        
        // Записываем историю изменений
        if (oldVehicle && oldVehicle[key] !== value) {
          await pool.query(
            "INSERT INTO vehicle_history (vehicle_id, field_name, old_value, new_value) VALUES ($1, $2, $3, $4)",
            [id, key, String(oldVehicle[key] || ''), String(value || '')]
          );
        }
        idx++;
      }
    }
    
    if (setClauses.length > 0) {
      setClauses.push("updated_at = NOW()");
      await pool.query(
        `UPDATE vehicles SET ${setClauses.join(", ")} WHERE id = $1`,
        values
      );
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// История водителей машины
router.get("/:id/drivers", async (req, res) => {
  const { year } = req.query;
  try {
    const vRes = await pool.query("SELECT normalized_number FROM vehicles WHERE id = $1 LIMIT 1", [req.params.id]);
    if (!vRes.rows[0]) return res.status(404).json({ error: "Vehicle not found" });
    
    const digits = vRes.rows[0].normalized_number?.match(/\d{3}/)?.[0] || req.params.id;
    
    let query = `SELECT driver_name, date_from, date_to, mileage FROM driver_reports WHERE vehicle_number ~ $1`;
    const params = [digits];
    
    if (year) {
      query += ` AND (EXTRACT(YEAR FROM date_from) = $2 OR EXTRACT(YEAR FROM date_to) = $2)`;
      params.push(year);
    }
    query += ` ORDER BY date_from DESC`;
    
    const result = await pool.query(query, params);
    res.json({ drivers: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Статистика топлива машины
router.get("/:id/fuel", async (req, res) => {
  const { year } = req.query;
  try {
    const vRes = await pool.query("SELECT normalized_number FROM vehicles WHERE id = $1 LIMIT 1", [req.params.id]);
    if (!vRes.rows[0]) return res.status(404).json({ error: "Vehicle not found" });
    
    const digits = vRes.rows[0].normalized_number?.match(/\d{3}/)?.[0] || req.params.id;
    
    let dateFilter = "";
    const params = [digits];
    if (year) {
      dateFilter = " AND EXTRACT(YEAR FROM transaction_date) = $2";
      params.push(year);
    }
    
    const bySource = await pool.query(`
      SELECT source, SUM(quantity)::numeric as liters, SUM(amount)::numeric as amount, COUNT(*)::int as count
      FROM fuel_transactions WHERE vehicle_number ~ $1 ${dateFilter}
      GROUP BY source ORDER BY amount DESC
    `, params);
    
    const total = await pool.query(`
      SELECT COALESCE(SUM(quantity), 0)::numeric as liters, COALESCE(SUM(amount), 0)::numeric as amount, COUNT(*)::int as count
      FROM fuel_transactions WHERE vehicle_number ~ $1 ${dateFilter}
    `, params);
    
    res.json({ by_source: bySource.rows, total: total.rows[0] });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// История изменений
router.get("/:id/history", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM vehicle_history WHERE vehicle_id = $1 ORDER BY changed_at DESC LIMIT 50",
      [req.params.id]
    );
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Обслуживание
router.get("/:id/maintenance", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM vehicle_maintenance WHERE vehicle_id = $1 ORDER BY maintenance_date DESC",
      [req.params.id]
    );
    res.json({ maintenance: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/:id/maintenance", async (req, res) => {
  const { maintenance_date, maintenance_type, description, cost, mileage, performed_by } = req.body;
  try {
    await pool.query(`
      INSERT INTO vehicle_maintenance (vehicle_id, maintenance_date, maintenance_type, description, cost, mileage, performed_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [req.params.id, maintenance_date, maintenance_type, description, cost || null, mileage || null, performed_by || null]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Привязанные карты
router.get("/:id/cards", async (req, res) => {
  try {
    const vRes = await pool.query("SELECT normalized_number FROM vehicles WHERE id = $1 LIMIT 1", [req.params.id]);
    if (!vRes.rows[0]) return res.status(404).json({ error: "Vehicle not found" });
    
    const digits = vRes.rows[0].normalized_number?.match(/\d{3}/)?.[0] || req.params.id;
    
    const result = await pool.query(
      "SELECT * FROM fuel_cards WHERE vehicle_number ~ $1",
      [digits]
    );
    res.json({ cards: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;

// GPS пробег за последние N дней
router.get("/:id/gps-mileage", async (req, res) => {
  const { id } = req.params;
  const days = parseInt(req.query.days) || 7;
  
  try {
    // Получаем номер машины
    const vehicleResult = await pool.query("SELECT license_plate FROM vehicles WHERE id = $1", [id]);
    if (!vehicleResult.rows[0]) return res.status(404).json({ error: "Vehicle not found" });
    
    const plate = vehicleResult.rows[0].license_plate;
    
    // Нормализуем номер
    const lat2cyr = {"A":"а","B":"в","C":"с","E":"е","H":"н","K":"к","M":"м","O":"о","P":"р","T":"т","X":"х","Y":"у"};
    const normalized = String(plate).toLowerCase().replace(/[\s\/]/g, "")
      .replace(/0(\d{2,3})$/, "$1").split("").map(c => lat2cyr[c.toUpperCase()] || c).join("");
    
    const IMEI_MAP = {
      "в165тк43": "350544508508895", "в188то43": "350544508509653", "в840то43": "350544508511014",
      "в486тк43": "350544508512863", "в869тк43": "350544508515841", "в990тк43": "350544508515965",
      "в798то43": "350544508519033", "в299те43": "352625697870143", "в823хо43": "354018117900591",
      "в560се43": "354018117915953", "в825хк43": "354018119401655", "в340хе43": "4AG029109",
      "в821хе43": "4AG029110", "в761хе43": "4AG029111", "м202уа196": "4GI006532",
      "а263то43": "4HD008618", "а780тх43": "4HG009450", "в612тс43": "4HK011217",
      "с597рх43": "4IG013132", "а557хм43": "4LH019188", "в667се43": "4MC020859",
      "а368тр43": "4MF021440", "а743то43": "4MF021442", "в179хе43": "4MH022067",
      "в183хо43": "4NE023880", "с838се43": "4OF026779", "в474рр43": "4OF026781",
      "а901тх43": "4OH027108", "м183нв716": "SIGNAL8620635", "в361хх43": "SIGNAL8624784",
      "м196нв716": "SIGNAL8625700", "в399тк43": "SIGNAL8628274", "м401уо196": "SIGNAL8628563",
      "х469тн43": "SIGNAL8629009", "м200уа196": "SIGNAL8630146", "в827тн43": "SIGNAL8630784",
      "х295те43": "SIGNAL8633487", "а421тр43": "SIGNAL8635649", "х376тр43": "SIGNAL8636204",
      "в502тс43": "SIGNAL8636621", "е645св43": "SIGNAL8636788", "в232хо43": "SIGNAL8639261",
      "в262се43": "SIGNAL8660593", "в132тн43": "SIGNAL8661640", "в327се43": "SIGNAL8662243",
      "в361тн43": "SIGNAL8664508", "в532св43": "SIGNAL8667056", "в502се43": "SIGNAL8669175",
      "в732хо43": "SIGNAL8669489", "а541тх43": "SIGNAL8669530", "в770тм43": "SIGNAL8680435",
      "в083тм43": "SIGNAL8684446", "в626тм43": "SIGNAL8684546", "м174уа196": "SIGNAL8687755"
    };
    
    const imei = IMEI_MAP[normalized];
    if (!imei) return res.json({ days: [], total: 0, error: "GPS не подключен" });
    
    const fetch = require("node-fetch");
    const auth = Buffer.from("btl43api:p5318").toString("base64");
    
    const result = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      
      // MSK 00:00 = UTC 21:00 предыдущего дня, MSK 23:59 = UTC 20:59
      const fromDate = new Date(dateStr + "T00:00:00+03:00"); // MSK 00:00
      const toDate = new Date(dateStr + "T23:59:59+03:00"); // MSK 23:59
      const fromUtc = fromDate.toISOString().slice(0, 19) + "Z";
      const toUtc = toDate.toISOString().slice(0, 19) + "Z";
      const url = `http://lserver43.ru:8091/do.calc.vars?imei=${imei}&vars=Distance&from=${fromUtc}&to=${toUtc}`;
      try {
        const response = await fetch(url, { headers: { "Authorization": "Basic " + auth }, timeout: 5000 });
        const data = await response.json();
        let km = 0;
        if (data.result?.values?.[0]?.vars?.[0]?.varValue) {
          const val = data.result.values[0].vars[0].varValue;
          if (val !== "-") km = Math.round(parseFloat(String(val).replace(",", ".")));
        }
        result.push({ date: dateStr, km });
      } catch (e) {
        result.push({ date: dateStr, km: 0, error: true });
      }
    }
    
    const total = result.reduce((sum, d) => sum + d.km, 0);
    res.json({ days: result, total });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Список машин с признаком активности (рейсы за последний месяц)

// Последние транзакции по карте
router.get("/card/:cardNumber/transactions", async (req, res) => {
  const { cardNumber } = req.params;
  const limit = parseInt(req.query.limit) || 5;
  try {
    const result = await pool.query(`
      SELECT date, liters, amount, station_name, source
      FROM fuel_transactions
      WHERE card_number = $1
      ORDER BY date DESC
      LIMIT $2
    `, [cardNumber, limit]);
    res.json({ transactions: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Привязать карту к машине
router.post("/:id/cards/add", async (req, res) => {
  const { id } = req.params;
  const { card_number, source } = req.body;
  try {
    await pool.query(`
      INSERT INTO vehicle_cards (vehicle_id, card_number, source)
      VALUES ($1, $2, $3)
      ON CONFLICT (vehicle_id, card_number) DO NOTHING
    `, [id, card_number, source || "Неизвестно"]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Отвязать карту от машины
router.delete("/:id/cards/:cardNumber", async (req, res) => {
  const { id, cardNumber } = req.params;
  try {
    await pool.query(`DELETE FROM vehicle_cards WHERE vehicle_id = $1 AND card_number = $2`, [id, cardNumber]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
// Привязать карту к машине (обновить vehicle_number в fuel_cards)
router.post("/:id/cards/link", async (req, res) => {
  const { id } = req.params;
  const { card_number } = req.body;
  try {
    // Получаем номер машины
    const vRes = await pool.query("SELECT license_plate FROM vehicles WHERE id = $1", [id]);
    if (!vRes.rows[0]) return res.status(404).json({ error: "Vehicle not found" });
    const plate = vRes.rows[0].license_plate;
    
    await pool.query(`UPDATE fuel_cards SET vehicle_number = $1 WHERE card_number = $2`, [plate, card_number]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Отвязать карту от машины
router.post("/:id/cards/unlink", async (req, res) => {
  const { id } = req.params;
  const { card_number } = req.body;
  try {
    await pool.query(`UPDATE fuel_cards SET vehicle_number = NULL WHERE card_number = $1`, [card_number]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Все карты (для выбора)
router.get("/all-cards", async (req, res) => {
  try {
    const result = await pool.query(`SELECT card_number, source, vehicle_number FROM fuel_cards ORDER BY source, card_number`);
    res.json({ cards: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});


// Получить машину по номеру

// Обновить топливные карты
router.patch("/:id/fuel-cards", async (req, res) => {
  const { id } = req.params;
  const { fuel_cards } = req.body;
  try {
    await pool.query(
      "UPDATE vehicles SET fuel_cards = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(fuel_cards), id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Текущее состояние машины: топливо в баке + последние заправки
router.get("/:id/current-state", async (req, res) => {
  const { id } = req.params;
  
  try {
    // Получаем машину
    const vRes = await pool.query("SELECT license_plate FROM vehicles WHERE id = $1", [id]);
    if (vRes.rows.length === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    const plate = vRes.rows[0].license_plate;
    
    // Нормализуем номер для IMEI
    const IMEI_MAP = require("./reports").IMEI_MAP || {};
    const normalized = plate.toLowerCase().replace(/\s/g, "");
    const imei = IMEI_MAP[normalized];
    
    let fuelLevel = { level: null, hasSensor: false, message: "IMEI не найден" };
    
    if (imei) {
      try {
        const fetch = require("node-fetch");
        const auth = Buffer.from("btl43api:p5318").toString("base64");
        // Получаем текущее время по UTC (сервер работает в UTC)
        const now = new Date();
        const fromUtc = now.toISOString().slice(0, 19) + "Z";
        const toUtc = new Date(now.getTime() + 60000).toISOString().slice(0, 19) + "Z";
        
        const url = `http://lserver43.ru:8091/do.calc.vars?imei=${imei}&vars=FuelLevel&from=${fromUtc}&to=${toUtc}`;
        const response = await fetch(url, { headers: { "Authorization": "Basic " + auth } });
        const data = await response.json();
        
        if (data.result?.values?.[0]?.vars?.[0]?.varValue) {
          const val = data.result.values[0].vars[0].varValue;
          if (val !== "-" && val !== "Undefined") {
            const level = parseFloat(String(val).replace(",", "."));
            if (level > 0) {
              fuelLevel = { level: Math.round(level), hasSensor: true };
            } else {
              fuelLevel = { level: null, hasSensor: false, message: "Нет данных с датчика" };
            }
          }
        }
      } catch (e) {
        fuelLevel = { level: null, hasSensor: false, message: String(e) };
      }
    }
    
    // Последние транзакции (за 30 дней)
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const txRes = await pool.query(`
      SELECT transaction_date, quantity, amount, source, card_number
      FROM fuel_transactions 
      WHERE REPLACE(vehicle_number, ' ', '') ILIKE $1
        AND transaction_date >= $2 AND transaction_date <= $3
      ORDER BY transaction_date DESC
      LIMIT 5
    `, [plate.replace(/\s/g, ""), from, to]);
    
    res.json({
      fuelLevel,
      lastTransactions: txRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
