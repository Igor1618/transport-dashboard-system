const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// Получить все тарифы
router.get("/list", async (req, res) => {
  const { vehicle_type } = req.query;
  try {
    let query = "SELECT * FROM fuel_rate_tariffs";
    const params = [];
    if (vehicle_type) {
      query += " WHERE vehicle_type = $1";
      params.push(vehicle_type);
    }
    query += " ORDER BY vehicle_type, season, fuel_consumption DESC";
    const result = await pool.query(query, params);
    res.json({ tariffs: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Получить типы машин с тарифами
router.get("/vehicle-types", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT vehicle_type FROM fuel_rate_tariffs ORDER BY vehicle_type"
    );
    res.json({ types: result.rows.map(r => r.vehicle_type) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});



// Рассчитать ставку по расходу
router.get("/calculate", async (req, res) => {
  const { vehicle_type, season, consumption } = req.query;
  if (!vehicle_type || !consumption) {
    return res.status(400).json({ error: "vehicle_type and consumption required" });
  }
  
  try {
    // Определяем сезон если не передан
    let seasonValue = season;
    if (!seasonValue) {
      const month = new Date().getMonth() + 1;
      if (month >= 6 && month <= 8) seasonValue = "Лето";
      else if (month >= 12 || month <= 2) seasonValue = "Зима";
      else seasonValue = "Межсезон";
    }
    
    const cons = parseFloat(consumption);
    
    // Получаем все тарифы для типа и сезона
    const allTariffs = await pool.query(`
      SELECT rate, fuel_consumption 
      FROM fuel_rate_tariffs 
      WHERE vehicle_type = $1 AND season = $2
      ORDER BY fuel_consumption ASC
    `, [vehicle_type, seasonValue]);
    
    if (allTariffs.rows.length === 0) {
      return res.json({ rate: null, error: "Тарифы не найдены" });
    }
    
    const tariffs = allTariffs.rows;
    const minCons = parseFloat(tariffs[0].fuel_consumption);
    const maxCons = parseFloat(tariffs[tariffs.length - 1].fuel_consumption);
    
    // Если расход НИЖЕ минимального — максимальная ставка (экономия!)
    if (cons <= minCons) {
      return res.json({ 
        rate: parseFloat(tariffs[0].rate),
        matched_consumption: minCons,
        season: seasonValue,
        note: "Расход ниже нормы - максимальная ставка"
      });
    }
    
    // Если расход ВЫШЕ максимального — минимальная ставка (перерасход)
    if (cons >= maxCons) {
      return res.json({ 
        rate: parseFloat(tariffs[tariffs.length - 1].rate),
        matched_consumption: maxCons,
        season: seasonValue,
        note: "Превышен максимальный расход"
      });
    }
    
    // Иначе находим ближайший тариф (округляем вверх)
    for (let i = 0; i < tariffs.length; i++) {
      const fc = parseFloat(tariffs[i].fuel_consumption);
      if (cons <= fc) {
        return res.json({ 
          rate: parseFloat(tariffs[i].rate),
          matched_consumption: fc,
          season: seasonValue
        });
      }
    }
    
    // Fallback
    res.json({ rate: parseFloat(tariffs[tariffs.length - 1].rate), season: seasonValue });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});


// Добавить/обновить тариф
router.post("/save", async (req, res) => {
  const { vehicle_type, season, fuel_consumption, rate } = req.body;
  if (!vehicle_type || !season || !fuel_consumption || !rate) {
    return res.status(400).json({ error: "All fields required" });
  }
  
  try {
    await pool.query(`
      INSERT INTO fuel_rate_tariffs (vehicle_type, season, fuel_consumption, rate)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (vehicle_type, season, fuel_consumption) 
      DO UPDATE SET rate = $4
    `, [vehicle_type, season, fuel_consumption, rate]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Массовая загрузка тарифов
router.post("/bulk", async (req, res) => {
  const { tariffs } = req.body; // [{vehicle_type, season, fuel_consumption, rate}, ...]
  if (!tariffs || !Array.isArray(tariffs)) {
    return res.status(400).json({ error: "tariffs array required" });
  }
  
  try {
    let inserted = 0;
    for (const t of tariffs) {
      if (t.vehicle_type && t.season && t.fuel_consumption && t.rate) {
        await pool.query(`
          INSERT INTO fuel_rate_tariffs (vehicle_type, season, fuel_consumption, rate)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (vehicle_type, season, fuel_consumption) 
          DO UPDATE SET rate = $4
        `, [t.vehicle_type, t.season, t.fuel_consumption, t.rate]);
        inserted++;
      }
    }
    res.json({ success: true, inserted });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Удалить тариф
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM fuel_rate_tariffs WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;

// Удалить тариф по параметрам
router.delete("/by-params", async (req, res) => {
  const { vehicle_type, season, fuel_consumption } = req.query;
  if (!vehicle_type || !season || !fuel_consumption) {
    return res.status(400).json({ error: "vehicle_type, season, fuel_consumption required" });
  }
  try {
    await pool.query(
      "DELETE FROM fuel_rate_tariffs WHERE vehicle_type = $1 AND season = $2 AND fuel_consumption = $3",
      [vehicle_type, season, fuel_consumption]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
