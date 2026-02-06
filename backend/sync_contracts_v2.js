const axios = require("axios");
const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost", port: 5433, database: "postgres",
  user: "postgres", password: "5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms="
});

const API = "http://91.144.150.120:8180/tk/hs/TransportAPI/api/v1";
const AUTH = { username: "TransportAPI", password: "TransportAPI_SecretPass" };

async function main() {
  console.log("=== Sync loading_date/unloading_date ===");
  
  const now = new Date();
  const dateTo = now.toISOString().slice(0,10);
  const dateFrom = new Date(now - 120*24*60*60*1000).toISOString().slice(0,10);
  console.log("Period:", dateFrom, "->", dateTo);
  
  const r = await axios.get(API + "/contracts", { auth: AUTH, params: { dateFrom, dateTo }, timeout: 120000 });
  console.log("Received:", r.data.length, "contracts");
  
  let updated = 0, skipped = 0, errors = 0;
  for (const c of r.data) {
    if (!c.number) { skipped++; continue; }
    try {
      const res = await pool.query(
        "UPDATE contracts SET loading_date = $1, unloading_date = $2, updated_at = NOW() WHERE number = $3",
        [c.loading_date || null, c.unloading_date || null, c.number]
      );
      if (res.rowCount > 0) updated++;
      else skipped++;
    } catch (e) { 
      errors++;
      if (errors <= 3) console.error("Err:", c.number, e.message.slice(0, 80));
    }
  }
  
  console.log("\n✅ Updated:", updated, "| Skipped:", skipped, "| Errors:", errors);
  
  // Проверка
  const check = await pool.query("SELECT COUNT(*) as total, COUNT(loading_date) as with_loading FROM contracts");
  console.log("БД:", check.rows[0].total, "контрактов,", check.rows[0].with_loading, "с loading_date");
  
  await pool.end();
}
main().catch(e => console.error(e));
