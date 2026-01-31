const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function run() {
  const types = [
    ["ФОТОН", 28.0, 30.0, 33.0],
    ["КамАЗ", 32.0, 35.0, 38.0],
    ["ШАКМАН", 35.0, 38.0, 42.0],
    ["ДЖАК", 26.0, 28.0, 31.0]
  ];
  
  for (const [name, summer, autumn, winter] of types) {
    await pool.query(
      "INSERT INTO vehicle_types (name, fuel_norm_summer, fuel_norm_autumn, fuel_norm_winter) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO UPDATE SET fuel_norm_summer=$2, fuel_norm_autumn=$3, fuel_norm_winter=$4",
      [name, summer, autumn, winter]
    );
  }
  
  // Проставлю типы машинам по модели
  await pool.query("UPDATE vehicles SET vehicle_type = 'ФОТОН' WHERE UPPER(model) LIKE $1", ['%FOTON%']);
  await pool.query("UPDATE vehicles SET vehicle_type = 'ШАКМАН' WHERE UPPER(model) LIKE $1", ['%SHACMAN%']);
  await pool.query("UPDATE vehicles SET vehicle_type = 'ДЖАК' WHERE UPPER(model) LIKE $1", ['%ДЖАК%']);
  await pool.query("UPDATE vehicles SET vehicle_type = 'КамАЗ' WHERE UPPER(model) LIKE $1 OR UPPER(model) LIKE $2", ['%КАМАЗ%', '%KAMAZ%']);
  
  const res = await pool.query("SELECT * FROM vehicle_types ORDER BY name");
  console.log("Типы машин:");
  res.rows.forEach(r => console.log(r.name, "- лето:", r.fuel_norm_summer, "осень:", r.fuel_norm_autumn, "зима:", r.fuel_norm_winter));
  
  const stats = await pool.query("SELECT vehicle_type, COUNT(*) as cnt FROM vehicles GROUP BY vehicle_type ORDER BY cnt DESC");
  console.log("\nМашины по типам:");
  stats.rows.forEach(r => console.log(r.vehicle_type || "(не указан)", "-", r.cnt));
  
  pool.end();
}

run().catch(console.error);
