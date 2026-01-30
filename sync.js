const axios = require("axios");
const { Pool } = require("pg");

const DAYS = 7;
const pool = new Pool({
  host: "localhost", port: 5433, database: "postgres",
  user: "postgres", password: "5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms="
});

const API = "http://91.144.150.120:8180/tk/hs/TransportAPI/api/v1";
const AUTH = { username: "TransportAPI", password: "TransportAPI_SecretPass" };

async function main() {
  console.log("=== 1C Sync ===");
  const now = new Date();
  const dateTo = now.toISOString().slice(0,10);
  const dateFrom = new Date(now - DAYS*24*60*60*1000).toISOString().slice(0,10);
  console.log("Period:", dateFrom, "->", dateTo);
  
  try {
    console.log("Fetching contracts...");
    const r = await axios.get(API + "/contracts", { 
      auth: AUTH, 
      params: { dateFrom, dateTo },
      timeout: 60000 
    });
    console.log("Response:", r.status, Array.isArray(r.data) ? r.data.length + " items" : typeof r.data);
    
    if (Array.isArray(r.data)) {
      let n = 0;
      for (const c of r.data) {
        try {
          await pool.query(`INSERT INTO contracts (id, number, date, organization, contractor_name, vehicle_number, driver_name, route, amount, synced_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET
            number=EXCLUDED.number, date=EXCLUDED.date, vehicle_number=EXCLUDED.vehicle_number, driver_name=EXCLUDED.driver_name, route=EXCLUDED.route, amount=EXCLUDED.amount, synced_at=NOW()`,
            [c.id||c.guid, c.number, c.date, c.organization, c.contractor?.name, c.vehicle?.number, c.driver?.name, c.route, c.amount||0]);
          n++;
        } catch (e) {}
      }
      console.log("Synced:", n, "contracts");
    }
  } catch (e) {
    console.error("Error:", e.response?.status || e.code, e.message);
  }
  
  await pool.end();
  console.log("Done");
}
main();
