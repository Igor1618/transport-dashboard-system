const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// Справочник IMEI
const IMEI_MAP = {
  "в165тк43": "350544508508895",
  "в188то43": "350544508509653",
  "в840то43": "350544508511014",
  "в486тк43": "350544508512863",
  "в869тк43": "350544508515841",
  "в990тк43": "350544508515965",
  "в798то43": "350544508519033",
  "в299те43": "352625697870143",
  "в823хо43": "354018117900591",
  "в560се43": "354018117915953",
  "в825хк43": "354018119401655",
  "в340хе43": "4AG029109",
  "в821хе43": "4AG029110",
  "в761хе43": "4AG029111",
  "м202уа196": "4GI006532",
  "а263то43": "4HD008618",
  "а780тх43": "4HG009450",
  "в612тс43": "4HK011217",
  "с597рх43": "4IG013132",
  "а557хм43": "4LH019188",
  "в667се43": "4MC020859",
  "а368тр43": "4MF021440",
  "а743то43": "4MF021442",
  "в179хе43": "4MH022067",
  "в183хо43": "4NE023880",
  "с838се43": "4OF026779",
  "в474рр43": "4OF026781",
  "а901тх43": "4OH027108",
  "м183нв716": "SIGNAL8620635",
  "в361хх43": "SIGNAL8624784",
  "м196нв716": "SIGNAL8625700",
  "в399тк43": "SIGNAL8628274",
  "м401уо196": "SIGNAL8628563",
  "х469тн43": "SIGNAL8629009",
  "м200уа196": "SIGNAL8630146",
  "в827тн43": "SIGNAL8630784",
  "х295те43": "SIGNAL8633487",
  "а421тр43": "SIGNAL8635649",
  "х376тр43": "SIGNAL8636204",
  "в502тс43": "SIGNAL8636621",
  "е645св43": "SIGNAL8636788",
  "в232хо43": "SIGNAL8639261",
  "в262се43": "SIGNAL8660593",
  "в132тн43": "SIGNAL8661640",
  "в327се43": "SIGNAL8662243",
  "в361тн43": "SIGNAL8664508",
  "в532св43": "SIGNAL8667056",
  "в502се43": "SIGNAL8669175",
  "в732хо43": "SIGNAL8669489",
  "а541тх43": "SIGNAL8669530",
  "в770тм43": "SIGNAL8680435",
  "в083тм43": "SIGNAL8684446",
  "в626тм43": "SIGNAL8684546",
  "м174уа196": "SIGNAL8687755"
};

// Нормализация номера машины
// Нормализация номера машины
function normalizeVehicle(v) {
  const lat2cyr = {"A":"а","B":"в","C":"с","E":"е","H":"н","K":"к","M":"м","O":"о","P":"р","T":"т","X":"х","Y":"у"};
  let s = String(v).toLowerCase().replace(/[\s\/]/g, "");
  s = s.replace(/0(\d{2,3})$/, "$1");
  return s.split("").map(c => lat2cyr[c.toUpperCase()] || c).join("");
}

// Список водителей
router.post("/save", async (req, res) => {
  const { driver_name, vehicle_number, date_from, date_to, mileage, fuel_quantity, fuel_amount, total_expenses, driver_accruals, driver_payments, rf_periods, user_name, vehicle_type, season, rate_per_km,
    rf_mileage, rf_rate, rf_days, rf_daily_rate, rf_fuel_start, rf_fuel_end, fuel_rf, wb_totals, bonus_enabled, bonus_rate, wb_rate, wb_trips, wb_trips_data, fuel_by_source, wb_gps_mileage, wb_days, gps_mileage, extra_works, expenses, payments, comment } = req.body;
  
  try {
    const numResult = await pool.query(`SELECT COALESCE(MAX(CAST(number AS INTEGER)), 0) + 1 as next FROM driver_reports WHERE number ~ '^[0-9]+$'`);
    const number = String(numResult.rows[0].next).padStart(9, "0");
    
    const expense_categories = JSON.stringify({ rf_mileage, rf_rate, rf_days, rf_daily_rate, rf_fuel_start, rf_fuel_end, fuel_rf, wb_totals, bonus_enabled, bonus_rate, wb_rate, wb_trips, wb_trips_data, fuel_by_source, wb_gps_mileage, wb_days, gps_mileage, extra_works, expenses, payments, comment });
    
    await pool.query(`
      INSERT INTO driver_reports (id, number, driver_name, vehicle_number, date_from, date_to, mileage, fuel_quantity, fuel_amount, total_expenses, driver_accruals, driver_payments, rf_periods, vehicle_type, season, rate_per_km, expense_categories, created_by, updated_by, synced_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17, NOW())
    `, [number, driver_name, vehicle_number, date_from, date_to, mileage || 0, fuel_quantity || 0, fuel_amount || 0, total_expenses || 0, driver_accruals || 0, driver_payments || 0, JSON.stringify(rf_periods || []), vehicle_type || null, season || null, rate_per_km || null, expense_categories, user_name || null]);
    
    res.json({ success: true, number });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: String(err) });
  }
});

router.post("/update", async (req, res) => {
  console.log("[UPDATE] Body:", JSON.stringify(req.body, null, 2));
  const { id, user_name, driver_name, vehicle_number, date_from, date_to, mileage, fuel_quantity, fuel_amount, total_expenses, driver_accruals, driver_payments, rf_periods, vehicle_type, season, rate_per_km, fuel_start, fuel_end,
    rf_mileage, rf_rate, rf_days, rf_daily_rate, rf_fuel_start, rf_fuel_end, fuel_rf, wb_totals, bonus_enabled, bonus_rate, wb_rate, wb_trips, wb_trips_data, fuel_by_source, wb_gps_mileage, wb_days, gps_mileage, extra_works, expenses, payments, comment } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }
  
  try {
    const expense_categories = JSON.stringify({ rf_mileage, rf_rate, rf_days, rf_daily_rate, rf_fuel_start, rf_fuel_end, fuel_rf, wb_totals, bonus_enabled, bonus_rate, wb_rate, wb_trips, wb_trips_data, fuel_by_source, wb_gps_mileage, wb_days, gps_mileage, extra_works, expenses, payments, comment });
    
    await pool.query(`
      UPDATE driver_reports SET
        driver_name = COALESCE($2, driver_name),
        vehicle_number = COALESCE($3, vehicle_number),
        date_from = COALESCE($4, date_from),
        date_to = COALESCE($5, date_to),
        mileage = COALESCE($6, mileage),
        fuel_quantity = COALESCE($7, fuel_quantity),
        fuel_amount = COALESCE($8, fuel_amount),
        total_expenses = COALESCE($9, total_expenses),
        driver_accruals = COALESCE($10, driver_accruals),
        driver_payments = COALESCE($11, driver_payments),
        rf_periods = COALESCE($12, rf_periods),
        vehicle_type = COALESCE($13, vehicle_type),
        season = COALESCE($14, season),
        rate_per_km = COALESCE($15, rate_per_km),
        expense_categories = $16,
        updated_by = COALESCE($17, updated_by),
        updated_at = NOW()
      WHERE id = $1
    `, [id, driver_name, vehicle_number, date_from, date_to, mileage, fuel_quantity, fuel_amount, total_expenses, driver_accruals, driver_payments, rf_periods ? JSON.stringify(rf_periods) : null, vehicle_type || null, season || null, rate_per_km || null, expense_categories, user_name || null]);
    
    res.json({ success: true });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: String(err) });
  }
});
router.get("/drivers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT driver_name as name, 
             MAX(vehicle_number) as last_vehicle
      FROM driver_reports 
      WHERE driver_name IS NOT NULL AND driver_name != ''
      GROUP BY driver_name
      ORDER BY driver_name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Список машин
router.get("/vehicles", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT normalize_vehicle_number(vehicle_number) as number
      FROM driver_reports 
      WHERE vehicle_number IS NOT NULL AND vehicle_number != ''
      ORDER BY 1
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Пробег из телематики
router.get("/telematics/mileage", async (req, res) => {
  const { vehicle, from, to } = req.query;
  if (!vehicle || !from || !to) {
    return res.status(400).json({ error: "Missing params: vehicle, from, to" });
  }
  
  try {
    console.log("[mileage] vehicle=", vehicle, "from=", from, "to=", to);
  const normalized = normalizeVehicle(vehicle);
    const imei = IMEI_MAP[normalized];
    
    if (!imei) {
      return res.json({ mileage: null, error: "IMEI not found for " + normalized });
    }
    
    const fetch = require("node-fetch");
    const auth = Buffer.from("btl43api:p5318").toString("base64");
    // Конвертируем MSK → UTC (всё время в московском часовом поясе)
    function mskToUtc(dateStr, isEnd = false) {
      if (!dateStr.includes("T")) {
        // Только дата — добавляем время (00:00 или 23:59) в MSK
        const time = isEnd ? "T23:59:59+03:00" : "T00:00:00+03:00";
        const d = new Date(dateStr + time);
        return d.toISOString().slice(0, 19) + "Z";
      }
      // Дата со временем — считаем что это MSK
      const d = new Date(dateStr + ":00+03:00");
      return d.toISOString().slice(0, 19) + "Z";
    }
    const fromTime = mskToUtc(from, false);
    const toTime = mskToUtc(to, true);
    const url = `http://lserver43.ru:8091/do.calc.vars?imei=${imei}&vars=Distance&from=${fromTime}&to=${toTime}`;
    
    const response = await fetch(url, {
      headers: { "Authorization": "Basic " + auth }
    });
    const data = await response.json();
    
    if (data.result?.values?.[0]?.vars?.[0]?.varValue) {
      const val = data.result.values[0].vars[0].varValue;
      if (val === "-") return res.json({ mileage: 0, imei });
      const mileage = parseFloat(String(val).replace(",", "."));
      return res.json({ mileage: Math.round(mileage), imei });
    }
    
    res.json({ mileage: null, imei });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Рейсы WB за период
router.get("/trips", async (req, res) => {
  const { vehicle, from, to } = req.query;
  try {
    const result = await pool.query(`
      SELECT COUNT(*)::int as count, 
             COALESCE(SUM(trip_amount), 0)::numeric as total_amount,
             COALESCE(SUM(distance_km), 0)::int as total_distance
      FROM trips 
      WHERE normalize_vehicle_number(vehicle_number) = normalize_vehicle_number($1)
        AND loading_date >= $2 AND loading_date <= $3
    `, [vehicle, from, to]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Сохранить отчёт



// Топливо за период
router.get("/fuel", async (req, res) => {
  const { vehicle, from, to } = req.query;
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(quantity), 0)::numeric as total_liters,
        COALESCE(SUM(amount), 0)::numeric as total_amount,
        COUNT(*)::int as transactions
      FROM fuel_transactions 
      WHERE LOWER(REPLACE(vehicle_number, ' ', '')) LIKE LOWER($1)
        AND transaction_date >= $2 AND transaction_date <= $3
    `, ['%' + vehicle + '%', from, to]);
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Загрузка топливных данных
router.post("/fuel/import", async (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions)) {
    return res.status(400).json({ error: "transactions array required" });
  }
  
  let imported = 0;
  for (const t of transactions) {
    try {
      await pool.query(`
        INSERT INTO fuel_transactions (source, card_number, vehicle_number, driver_name, transaction_date, transaction_time, fuel_type, quantity, price_per_liter, amount, station_name, raw_data)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT DO NOTHING
      `, [t.source, t.card_number, t.vehicle_number, t.driver_name, t.transaction_date, t.transaction_time, t.fuel_type, t.quantity, t.price_per_liter, t.amount, t.station_name, JSON.stringify(t.raw_data || {})]);
      imported++;
    } catch (e) { }
  }
  
  res.json({ imported, total: transactions.length });
});

// Машины водителя за период (из рейсов)
router.get("/driver-vehicles", async (req, res) => {
  const { driver, from, to } = req.query;
  if (!driver) return res.status(400).json({ error: "driver required" });
  
  try {
    // Ищем в trips по водителю за период
    const result = await pool.query(`
      SELECT normalize_vehicle_number(vehicle_number) as number, COUNT(*) as trips, MAX(vehicle_number) as vehicle_number
      FROM trips 
      WHERE driver_name ILIKE $1
        AND ($2::date IS NULL OR loading_date >= $2)
        AND ($3::date IS NULL OR loading_date <= $3)
      GROUP BY norm
      ORDER BY trips DESC
    `, [driver, from || null, to || null]);
    
    // Также проверяем в driver_reports
    const reportsResult = await pool.query(`
      SELECT DISTINCT vehicle_number
      FROM driver_reports 
      WHERE driver_name ILIKE $1
        AND ($2::date IS NULL OR date_from >= $2)
        AND ($3::date IS NULL OR date_to <= $3)
    `, [driver, from || null, to || null]);
    
    // Объединяем
    const vehicles = new Map();
    result.rows.forEach(r => vehicles.set(r.vehicle_number, { number: r.vehicle_number, trips: parseInt(r.trips) }));
    reportsResult.rows.forEach(r => {
      if (!vehicles.has(r.vehicle_number)) {
        vehicles.set(r.vehicle_number, { number: r.vehicle_number, trips: 0 });
      }
    });
    
    res.json(Array.from(vehicles.values()));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Детальный список рейсов с ставками водителю
router.get("/trips-detail", async (req, res) => {
  const { driver, vehicle, from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from/to required" });
  
  try {
    let whereClause = "WHERE t.loading_date >= $1 AND t.loading_date <= $2";
    const params = [from, to];
    let paramIdx = 3;
    
    if (driver) {
      whereClause += ` AND t.driver_name ILIKE $${paramIdx}`;
      params.push("%" + driver + "%");
      paramIdx++;
    }
    if (vehicle) {
      whereClause += ` AND normalize_vehicle_number(t.vehicle_number) = normalize_vehicle_number($${paramIdx})`;
      params.push(vehicle);
    }
    
    const result = await pool.query(`
      SELECT 
        t.loading_date,
        t.vehicle_number,
        t.route_name,
        t.distance_km,
        t.trip_amount as wb_amount,
        COALESCE(rr.rate_per_trip, 0) as driver_rate
      FROM trips t
      LEFT JOIN route_rates rr ON rr.route_name = t.route_name AND rr.is_active = true
      ${whereClause}
      ORDER BY t.loading_date
    `, params);
    
    // Считаем итоги
    const trips = result.rows;
    const totalDriverRate = trips.reduce((sum, t) => sum + parseFloat(t.driver_rate || 0), 0);
    const totalDistance = trips.reduce((sum, t) => sum + parseInt(t.distance_km || 0), 0);
    const totalWbAmount = trips.reduce((sum, t) => sum + parseFloat(t.wb_amount || 0), 0);
    
    res.json({
      trips,
      totals: {
        count: trips.length,
        driver_rate: totalDriverRate,
        distance_km: totalDistance,
        wb_amount: totalWbAmount
      }
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Заявки РФ Транспорт за период
router.get("/contracts-rf", async (req, res) => {
  const { driver, vehicle, from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from/to required" });
  
  try {
    let whereClause = "WHERE c.date >= $1 AND c.date <= $2";
    const params = [from, to];
    let paramIdx = 3;
    
    if (driver) {
      whereClause += ` AND c.driver_name ILIKE $${paramIdx}`;
      params.push("%" + driver + "%");
      paramIdx++;
    }
    if (vehicle) {
      whereClause += ` AND normalize_vehicle_number(c.vehicle_number) = normalize_vehicle_number($${paramIdx})`;
      params.push(vehicle);
    }
    
    const result = await pool.query(`
      SELECT 
        c.number,
        c.date,
        c.vehicle_number,
        c.route,
        c.amount,
        c.loading_date,
        c.unloading_date
      FROM contracts c
      ${whereClause}
      ORDER BY c.date
    `, params);
    
    const contracts = result.rows;
    const totalAmount = contracts.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    
    res.json({
      contracts,
      totals: {
        count: contracts.length,
        amount: totalAmount
      }
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GPS пробег по конкретным датам
router.post("/telematics/mileage-by-dates", async (req, res) => {
  const { vehicle, dates } = req.body;
  if (!vehicle || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ error: "vehicle and dates[] required" });
  }
  
  try {
    // Нормализуем номер
    const lat2cyr = {"A":"а","B":"в","C":"с","E":"е","H":"н","K":"к","M":"м","O":"о","P":"р","T":"т","X":"х","Y":"у"};
    const normalized = String(vehicle).toLowerCase().replace(/[\s\/]/g, "")
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
    if (!imei) return res.json({ total: 0, error: "IMEI not found" });
    
    const fetch = require("node-fetch");
    const auth = Buffer.from("btl43api:p5318").toString("base64");
    
    let totalMileage = 0;
    const uniqueDates = [...new Set(dates)];
    
    // Группируем последовательные даты в диапазоны для оптимизации
    for (const date of uniqueDates) {
      const fromDate = new Date(date + "T00:00:00+03:00"); const toDate = new Date(date + "T23:59:59+03:00"); const url = `http://lserver43.ru:8091/do.calc.vars?imei=${imei}&vars=Distance&from=${fromDate.toISOString().slice(0,19)}Z&to=${toDate.toISOString().slice(0,19)}Z`;
      try {
        const response = await fetch(url, { headers: { "Authorization": "Basic " + auth }, timeout: 5000 });
        const data = await response.json();
        if (data.result?.values?.[0]?.vars?.[0]?.varValue) {
          const val = data.result.values[0].vars[0].varValue;
          if (val !== "-") totalMileage += parseFloat(String(val).replace(",", "."));
        }
      } catch (e) { /* skip */ }
    }
    
    res.json({ total: Math.round(totalMileage), dates_count: uniqueDates.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Водители на машине за период
router.get("/vehicle-drivers", async (req, res) => {
  const { vehicle, from, to } = req.query;
  if (!vehicle) return res.status(400).json({ error: "vehicle required" });
  
  try {
    // Из trips (WB)
    const tripsResult = await pool.query(`
      SELECT driver_name, MIN(loading_date) as first_date, MAX(loading_date) as last_date, COUNT(*) as trips
      FROM trips 
      WHERE normalize_vehicle_number(vehicle_number) = normalize_vehicle_number($1)
        AND ($2::date IS NULL OR loading_date >= $2)
        AND ($3::date IS NULL OR loading_date <= $3)
        AND driver_name IS NOT NULL AND driver_name != ''
      GROUP BY driver_name
    `, [vehicle, from || null, to || null]);
    
    // Из contracts (РФ)
    const contractsResult = await pool.query(`
      SELECT driver_name, MIN(date) as first_date, MAX(date) as last_date, COUNT(*) as contracts
      FROM contracts 
      WHERE normalize_vehicle_number(vehicle_number) = normalize_vehicle_number($1)
        AND ($2::date IS NULL OR date >= $2)
        AND ($3::date IS NULL OR date <= $3)
        AND driver_name IS NOT NULL AND driver_name != ''
      GROUP BY driver_name
    `, [vehicle, from || null, to || null]);
    
    // Объединяем
    const driversMap = new Map();
    
    tripsResult.rows.forEach(r => {
      driversMap.set(r.driver_name, {
        name: r.driver_name,
        first_date: r.first_date,
        last_date: r.last_date,
        wb_trips: parseInt(r.trips),
        rf_contracts: 0
      });
    });
    
    contractsResult.rows.forEach(r => {
      if (driversMap.has(r.driver_name)) {
        const existing = driversMap.get(r.driver_name);
        existing.rf_contracts = parseInt(r.contracts);
        if (r.first_date < existing.first_date) existing.first_date = r.first_date;
        if (r.last_date > existing.last_date) existing.last_date = r.last_date;
      } else {
        driversMap.set(r.driver_name, {
          name: r.driver_name,
          first_date: r.first_date,
          last_date: r.last_date,
          wb_trips: 0,
          rf_contracts: parseInt(r.contracts)
        });
      }
    });
    
    res.json(Array.from(driversMap.values()).sort((a, b) => b.wb_trips + b.rf_contracts - a.wb_trips - a.rf_contracts));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Исправленный API для рейсов WB с нормальными датами
router.get("/trips-detail-v2", async (req, res) => {
  const { driver, vehicle, from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from/to required" });
  
  try {
    let whereClause = "WHERE t.loading_date >= $1 AND t.loading_date <= $2";
    const params = [from, to];
    let paramIdx = 3;
    
    if (driver) {
      whereClause += ` AND t.driver_name ILIKE $${paramIdx}`;
      params.push("%" + driver + "%");
      paramIdx++;
    }
    if (vehicle) {
      whereClause += ` AND normalize_vehicle_number(t.vehicle_number) = normalize_vehicle_number($${paramIdx})`;
      params.push(vehicle);
    }
    
    const result = await pool.query(`
      SELECT 
        TO_CHAR(t.loading_date, 'YYYY-MM-DD') as loading_date,
        TO_CHAR(t.loading_time, 'HH24:MI') as loading_time,
        TO_CHAR(t.unloading_date, 'YYYY-MM-DD') as unloading_date,
        TO_CHAR(t.unloading_time, 'HH24:MI') as unloading_time,
        t.vehicle_number,
        t.route_name,
        t.distance_km,
        t.trip_amount as wb_amount,
        COALESCE(rr.rate_per_trip, 0) as driver_rate
      FROM trips t
      LEFT JOIN route_rates rr ON rr.route_name = t.route_name AND rr.is_active = true
      ${whereClause}
      ORDER BY t.loading_date
    `, params);
    
    const trips = result.rows;
    const totalDriverRate = trips.reduce((sum, t) => sum + parseFloat(t.driver_rate || 0), 0);
    const totalDistance = trips.reduce((sum, t) => sum + parseInt(t.distance_km || 0), 0);
    
    res.json({
      trips,
      totals: { count: trips.length, driver_rate: totalDriverRate, distance_km: totalDistance }
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Заявки РФ с километражем по каждой (из GPS)
router.get("/contracts-rf-v2", async (req, res) => {
  const { driver, vehicle, from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from/to required" });
  
  try {
    let whereClause = "WHERE c.date >= $1 AND c.date <= $2";
    const params = [from, to];
    let paramIdx = 3;
    
    if (driver) {
      whereClause += ` AND c.driver_name ILIKE $${paramIdx}`;
      params.push("%" + driver + "%");
      paramIdx++;
    }
    if (vehicle) {
      whereClause += ` AND normalize_vehicle_number(c.vehicle_number) = normalize_vehicle_number($${paramIdx})`;
      params.push(vehicle);
    }
    
    const result = await pool.query(`
      SELECT 
        c.number,
        TO_CHAR(c.date, 'YYYY-MM-DD') as date,
        c.vehicle_number,
        c.route,
        c.amount,
        c.loading_date,
        c.unloading_date
      FROM contracts c
      ${whereClause}
      ORDER BY c.date
    `, params);
    
    const contracts = result.rows;
    const totalAmount = contracts.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    
    // Собираем уникальные даты для GPS запроса
    const dates = [...new Set(contracts.map(c => c.date))];
    
    res.json({
      contracts,
      dates,
      totals: { count: contracts.length, amount: totalAmount }
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Топливо с группировкой по компаниям

// Топливо с группировкой по компаниям
router.get("/fuel/detail", async (req, res) => {
  const { vehicle, from, to } = req.query;
  if (!vehicle || !from || !to) {
    return res.status(400).json({ error: "vehicle, from, to required" });
  }
  
  try {
    const veh = "%" + vehicle + "%";
    
    const bySource = await pool.query(`
      SELECT 
        source,
        SUM(quantity)::numeric as liters,
        SUM(amount)::numeric as amount,
        COUNT(*)::int as count
      FROM fuel_transactions 
      WHERE LOWER(REPLACE(vehicle_number, ' ', '')) LIKE LOWER($1)
        AND transaction_date >= $2 AND transaction_date <= $3
      GROUP BY source
      ORDER BY amount DESC
    `, [veh, from, to]);
    
    const total = await pool.query(`
      SELECT 
        COALESCE(SUM(quantity), 0)::numeric as liters,
        COALESCE(SUM(amount), 0)::numeric as amount,
        COUNT(*)::int as count
      FROM fuel_transactions 
      WHERE LOWER(REPLACE(vehicle_number, ' ', '')) LIKE LOWER($1)
        AND transaction_date >= $2 AND transaction_date <= $3
    `, [veh, from, to]);
    
    res.json({
      by_source: bySource.rows,
      total: total.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});


// Обновление существующего отчёта



// Подсказка водителей по машине и датам
router.get("/driver-suggestions", async (req, res) => {
  const { vehicle, from, to } = req.query;
  if (!vehicle || !from || !to) {
    return res.json({ drivers: [] });
  }
  try {
    const result = await pool.query(`
      SELECT DISTINCT driver_name, COUNT(*) as trips
      FROM trips 
      WHERE normalize_vehicle_number(vehicle_number) = normalize_vehicle_number($1)
        AND loading_date >= $2 AND loading_date <= $3
        AND driver_name IS NOT NULL AND driver_name != ''
      GROUP BY driver_name
      ORDER BY trips DESC
      LIMIT 5
    `, [vehicle, from, to]);
    res.json({ drivers: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Подсказка машин по водителю
router.get("/vehicle-suggestions", async (req, res) => {
  const { driver, from, to } = req.query;
  if (!driver) {
    return res.json({ vehicles: [] });
  }
  try {
    const result = await pool.query(`
      SELECT MAX(vehicle_number) as vehicle_number, SUM(cnt) as trips FROM (
        SELECT normalize_vehicle_number(vehicle_number) as norm, MAX(vehicle_number) as vehicle_number, COUNT(*) as cnt
        FROM trips 
        WHERE driver_name ILIKE $1
          AND ($2::date IS NULL OR loading_date >= $2)
          AND ($3::date IS NULL OR loading_date <= $3)
          AND vehicle_number IS NOT NULL AND vehicle_number != ''
        GROUP BY norm
        UNION ALL
        SELECT normalize_vehicle_number(vehicle_number) as norm, MAX(vehicle_number) as vehicle_number, COUNT(*) as cnt
        FROM contracts 
        WHERE driver_name ILIKE $1
          AND ($2::date IS NULL OR date >= $2)
          AND ($3::date IS NULL OR date <= $3)
          AND vehicle_number IS NOT NULL AND vehicle_number != ''
        GROUP BY norm
      ) combined
      GROUP BY norm
      ORDER BY trips DESC
      LIMIT 5
    `, ['%' + driver + '%', from || null, to || null]);
    res.json({ vehicles: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});


// Детальные транзакции топлива
router.get("/fuel/transactions", async (req, res) => {
  const { vehicle, from, to } = req.query;
  if (!vehicle || !from || !to) {
    return res.status(400).json({ error: "vehicle, from, to required" });
  }
  
  try {
    const veh = "%" + vehicle + "%";
    
    const result = await pool.query(`
      SELECT 
        transaction_date as date,
        source,
        quantity as liters,
        amount,
        card_number
      FROM fuel_transactions 
      WHERE LOWER(REPLACE(vehicle_number, ' ', '')) LIKE LOWER($1)
        AND transaction_date >= $2 AND transaction_date <= $3
      ORDER BY transaction_date
    `, [veh, from, to]);
    
    res.json({ transactions: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});


// Удаление отчёта
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({ error: "id is required" });
  }
  
  try {
    await pool.query(`DELETE FROM driver_reports WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
module.exports.IMEI_MAP = IMEI_MAP;

// === ТАРИФЫ WB ===

// GET /reports/tariffs/rates - список тарифов
router.get("/tariffs/rates", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, route_name, rate_per_trip, is_active FROM route_rates ORDER BY route_name");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /reports/tariffs/create - создать тариф
router.post("/tariffs/create", async (req, res) => {
  try {
    const { route_name, rate_per_trip, is_active } = req.body;
    const result = await pool.query(
      "INSERT INTO route_rates (route_name, rate_per_trip, is_active) VALUES ($1, $2, $3) RETURNING *",
      [route_name, rate_per_trip || 0, is_active !== false]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /reports/tariffs/:id - обновить тариф
router.patch("/tariffs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { route_name, rate_per_trip, is_active } = req.body;
    const sets = [];
    const values = [];
    let idx = 1;
    if (route_name !== undefined) { sets.push(`route_name = $${idx++}`); values.push(route_name); }
    if (rate_per_trip !== undefined) { sets.push(`rate_per_trip = $${idx++}`); values.push(rate_per_trip); }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); values.push(is_active); }
    if (sets.length === 0) return res.json({});
    values.push(id);
    const result = await pool.query(`UPDATE route_rates SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, values);
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /reports/tariffs/:id - удалить тариф
router.delete("/tariffs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM route_rates WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Уровень топлива в баке на момент времени
router.get("/telematics/fuel-level", async (req, res) => {
  const { vehicle, datetime } = req.query;
  if (!vehicle || !datetime) {
    return res.status(400).json({ error: "Missing params: vehicle, datetime" });
  }
  
  try {
    const normalized = normalizeVehicle(vehicle);
    const imei = IMEI_MAP[normalized];
    
    if (!imei) {
      return res.json({ level: null, error: "IMEI not found", hasSensor: false });
    }
    
    // Конвертируем MSK → UTC (datetime в московском времени)
    // Запрашиваем на короткий период (1 минута) чтобы получить уровень на момент
    const fromDate = new Date(datetime + ":00+03:00"); // MSK
    const toDate = new Date(fromDate.getTime() + 60000); // +1 минута
    const fromUtc = fromDate.toISOString().slice(0, 19) + "Z";
    const toUtc = toDate.toISOString().slice(0, 19) + "Z";
    
    const fetch = require("node-fetch");
    const auth = Buffer.from("btl43api:p5318").toString("base64");
    const url = `http://lserver43.ru:8091/do.calc.vars?imei=${imei}&vars=FuelLevel&from=${fromUtc}&to=${toUtc}`;
    
    const response = await fetch(url, {
      headers: { "Authorization": "Basic " + auth }
    });
    const data = await response.json();
    
    if (data.result?.values?.[0]?.vars?.[0]?.varValue) {
      const val = data.result.values[0].vars[0].varValue;
      if (val === "-" || val === "Undefined") {
        return res.json({ level: null, hasSensor: false, message: "Датчик топлива не установлен" });
      }
      const level = parseFloat(String(val).replace(",", "."));
      // Если уровень <= 0 — считаем что датчика нет
      if (level <= 0) {
        return res.json({ level: null, hasSensor: false, message: "Датчик топлива не установлен" });
      }
      return res.json({ level: Math.round(level), hasSensor: true, imei });
    }
    
    res.json({ level: null, hasSensor: false, message: "Нет данных" });
  } catch (err) {
    res.status(500).json({ error: String(err), hasSensor: false });
  }
});
