const axios = require("axios");
const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost", port: 5433, database: "postgres",
  user: "postgres", password: "5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms="
});

const API = "http://91.144.150.120:8180/tk/hs/TransportAPI/api/v1";
const AUTH = { username: "TransportAPI", password: "TransportAPI_SecretPass" };

async function main() {
  console.log("=== Sync contracts with loading_date/unloading_date ===");
  
  // Синхронизируем за последние 90 дней
  const now = new Date();
  const dateTo = now.toISOString().slice(0,10);
  const dateFrom = new Date(now - 90*24*60*60*1000).toISOString().slice(0,10);
  console.log("Period:", dateFrom, "->", dateTo);
  
  const r = await axios.get(API + "/contracts", { auth: AUTH, params: { dateFrom, dateTo }, timeout: 120000 });
  console.log("Received:", r.data.length, "contracts");
  
  let updated = 0, errors = 0;
  for (const c of r.data) {
    try {
      await pool.query(`
        INSERT INTO contracts (id, number, date, organization, contractor_id, contractor_name, 
          vehicle_id, vehicle_number, driver_id, driver_name, responsible_logist, route,
          payment_term, payment_condition, amount, loading_date, unloading_date, synced_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW()) 
        ON CONFLICT (id) DO UPDATE SET
          number=EXCLUDED.number, date=EXCLUDED.date, organization=EXCLUDED.organization,
          contractor_name=EXCLUDED.contractor_name, vehicle_id=EXCLUDED.vehicle_id, 
          vehicle_number=EXCLUDED.vehicle_number, driver_id=EXCLUDED.driver_id,
          driver_name=EXCLUDED.driver_name, route=EXCLUDED.route, amount=EXCLUDED.amount,
          loading_date=EXCLUDED.loading_date, unloading_date=EXCLUDED.unloading_date,
          synced_at=NOW(), updated_at=NOW()`,
        [
          c.id, c.number, c.date, c.organization,
          c.contractor_id || "", c.contractor_name || "",
          c.vehicle_id || "", c.vehicle_number || "",
          c.driver_id || "", c.driver_name || "",
          c.responsible_logist || "", c.route || "",
          c.payment_term || "", c.payment_condition || "",
          c.amount || 0,
          c.loading_date || null,
          c.unloading_date || null
        ]);
      updated++;
    } catch (e) { 
      errors++; 
      if (errors <= 3) console.error("Err:", e.message.slice(0, 100)); 
    }
  }
  
  console.log("\n✅ Updated:", updated, "| Errors:", errors);
  await pool.end();
}
main().catch(e => console.error(e));
