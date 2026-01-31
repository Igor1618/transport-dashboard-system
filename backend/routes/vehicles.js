const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// Список машин с нормами
router.get("/list", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, license_plate, model, internal_number, vehicle_type,
             fuel_norm_summer, fuel_norm_autumn, fuel_norm_winter
      FROM vehicles 
      ORDER BY license_plate
    `);
    res.json({ vehicles: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Список типов машин
router.get("/types", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM vehicle_types ORDER BY name");
    res.json({ types: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Обновить машину
router.post("/update", async (req, res) => {
  const { id, vehicle_type, fuel_norm_summer, fuel_norm_autumn, fuel_norm_winter } = req.body;
  if (!id) return res.status(400).json({ error: "id required" });
  
  try {
    await pool.query(`
      UPDATE vehicles SET 
        vehicle_type = $2,
        fuel_norm_summer = $3,
        fuel_norm_autumn = $4,
        fuel_norm_winter = $5,
        updated_at = NOW()
      WHERE id = $1
    `, [id, vehicle_type || null, fuel_norm_summer || null, fuel_norm_autumn || null, fuel_norm_winter || null]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Сохранить тип машины
router.post("/types/save", async (req, res) => {
  const { id, name, fuel_norm_summer, fuel_norm_autumn, fuel_norm_winter } = req.body;
  try {
    if (id) {
      await pool.query(
        "UPDATE vehicle_types SET name=$2, fuel_norm_summer=$3, fuel_norm_autumn=$4, fuel_norm_winter=$5 WHERE id=$1",
        [id, name, fuel_norm_summer, fuel_norm_autumn, fuel_norm_winter]
      );
    } else {
      await pool.query(
        "INSERT INTO vehicle_types (name, fuel_norm_summer, fuel_norm_autumn, fuel_norm_winter) VALUES ($1,$2,$3,$4)",
        [name, fuel_norm_summer, fuel_norm_autumn, fuel_norm_winter]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Получить норму для машины (с учётом индивидуальных норм)
router.get("/norm", async (req, res) => {
  const { vehicle, season } = req.query;
  if (!vehicle) return res.status(400).json({ error: "vehicle required" });
  
  const s = season || "winter";
  const normField = s === "summer" ? "fuel_norm_summer" : s === "autumn" ? "fuel_norm_autumn" : "fuel_norm_winter";
  
  try {
    // Сначала ищем индивидуальную норму машины
    const vRes = await pool.query(
      "SELECT vehicle_type, " + normField + " as norm FROM vehicles WHERE license_plate ILIKE $1 OR id = $1 LIMIT 1",
      ["%" + vehicle.replace(/\s/g, "") + "%"]
    );
    
    if (vRes.rows[0]) {
      const v = vRes.rows[0];
      if (v.norm) {
        return res.json({ norm: parseFloat(v.norm), source: "individual", season: s });
      }
      
      // Если нет индивидуальной — берём по типу
      if (v.vehicle_type) {
        const tRes = await pool.query(
          "SELECT " + normField + " as norm FROM vehicle_types WHERE name = $1",
          [v.vehicle_type]
        );
        if (tRes.rows[0]) {
          return res.json({ norm: parseFloat(tRes.rows[0].norm), source: "type", type: v.vehicle_type, season: s });
        }
      }
    }
    
    // Дефолт
    res.json({ norm: 30, source: "default", season: s });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
