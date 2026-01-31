const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// Список норм
router.get("/list", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM fuel_norms ORDER BY vehicle_model, season");
    res.json({ norms: result.rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Получить норму для машины по сезону
router.get("/get", async (req, res) => {
  const { vehicle, date } = req.query;
  if (!vehicle) return res.status(400).json({ error: "vehicle required" });
  
  try {
    const d = date ? new Date(date) : new Date();
    const month = d.getMonth() + 1;
    var season;
    if (month >= 5 && month <= 8) season = "summer";
    else if (month >= 9 && month <= 11) season = "autumn";
    else season = "winter";
    
    var model = "ФОТОН";
    
    var norm = await pool.query(
      "SELECT * FROM fuel_norms WHERE vehicle_model = $1 AND vehicle_number IS NULL AND season = $2 LIMIT 1",
      [model, season]
    );
    
    if (norm.rows[0]) {
      res.json({ 
        norm: parseFloat(norm.rows[0].norm_per_100km), 
        season: season, 
        model: model,
        source: "model"
      });
    } else {
      res.json({ norm: 30, season: season, model: model, source: "default" });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Сохранить/обновить норму
router.post("/save", async (req, res) => {
  const { id, vehicle_model, vehicle_number, season, norm_per_100km, notes } = req.body;
  try {
    if (id) {
      await pool.query(
        "UPDATE fuel_norms SET vehicle_model=$1, vehicle_number=$2, season=$3, norm_per_100km=$4, notes=$5 WHERE id=$6",
        [vehicle_model, vehicle_number || null, season, norm_per_100km, notes, id]
      );
    } else {
      await pool.query(
        "INSERT INTO fuel_norms (vehicle_model, vehicle_number, season, norm_per_100km, notes) VALUES ($1,$2,$3,$4,$5)",
        [vehicle_model, vehicle_number || null, season, norm_per_100km, notes]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Удалить норму
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM fuel_norms WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Расчёт расхода для отчёта (с учётом индивидуальных норм)
router.get("/calculate", async (req, res) => {
  const { vehicle, from, liters, mileage } = req.query;
  
  try {
    var fuelLiters = parseFloat(liters) || 0;
    var km = parseFloat(mileage) || 0;
    
    if (km <= 0) {
      return res.json({ consumption: 0, norm: 0, diff: 0, status: "no_mileage" });
    }
    
    var consumption = (fuelLiters / km) * 100;
    
    var d = from ? new Date(from) : new Date();
    var month = d.getMonth() + 1;
    var season;
    if (month >= 5 && month <= 8) season = "summer";
    else if (month >= 9 && month <= 11) season = "autumn";
    else season = "winter";
    
    var normField = season === "summer" ? "fuel_norm_summer" : season === "autumn" ? "fuel_norm_autumn" : "fuel_norm_winter";
    
    var normValue = 30;
    var normSource = "default";
    var vehicleType = null;
    
    // 1. Сначала ищем индивидуальную норму машины
    if (vehicle) {
      var vRes = await pool.query(
        "SELECT vehicle_type, " + normField + " as norm FROM vehicles WHERE license_plate ILIKE $1 OR id = $1 LIMIT 1",
        ["%" + vehicle.replace(/\s/g, "") + "%"]
      );
      
      if (vRes.rows[0]) {
        var v = vRes.rows[0];
        vehicleType = v.vehicle_type;
        
        if (v.norm) {
          normValue = parseFloat(v.norm);
          normSource = "individual";
        } else if (v.vehicle_type) {
          // 2. Если нет индивидуальной — берём по типу машины
          var tRes = await pool.query(
            "SELECT " + normField + " as norm FROM vehicle_types WHERE name = $1",
            [v.vehicle_type]
          );
          if (tRes.rows[0] && tRes.rows[0].norm) {
            normValue = parseFloat(tRes.rows[0].norm);
            normSource = "type";
          }
        }
      }
    }
    
    // 3. Если ничего не нашли — дефолт ФОТОН
    if (normSource === "default") {
      var defRes = await pool.query(
        "SELECT fuel_norm_winter as norm FROM vehicle_types WHERE name = 'ФОТОН' LIMIT 1"
      );
      if (defRes.rows[0]) normValue = parseFloat(defRes.rows[0].norm) || 30;
    }
    
    var diff = consumption - normValue;
    var diffPercent = normValue > 0 ? ((consumption - normValue) / normValue) * 100 : 0;
    
    var status = "ok";
    if (diff > normValue * 0.1) status = "over";
    else if (diff < -normValue * 0.1) status = "under";
    
    res.json({
      consumption: Math.round(consumption * 100) / 100,
      norm: normValue,
      diff: Math.round(diff * 100) / 100,
      diffPercent: Math.round(diffPercent * 10) / 10,
      status: status,
      season: season,
      normSource: normSource,
      vehicleType: vehicleType
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
