const https = require("https");
const http = require("http");

const API_1C = {
  host: "91.144.150.120",
  port: 8180,
  auth: "TransportAPI:TransportAPI_SecretPass",
  basePath: "/tk/hs/TransportAPI/api/v1"
};

const SUPABASE = {
  host: "127.0.0.1",
  port: 8000,
  apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjA5NDU5MjAwLCJleHAiOjE5MjQ5OTIwMDB9.2vZc2vuKzNV85KPBVnCquWVJ3geuRhPIMXMPdxxNdA8"
};

async function fetch1CData(dateFrom, dateTo) {
  return new Promise((resolve, reject) => {
    const path = `${API_1C.basePath}/driver-reports?date_from=${dateFrom}&date_to=${dateTo}`;
    const options = {
      hostname: API_1C.host,
      port: API_1C.port,
      path: path,
      method: "GET",
      auth: API_1C.auth,
      timeout: 30000
    };
    
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    });
    
    req.on("error", reject);
    req.on("timeout", () => reject(new Error("Timeout")));
    req.end();
  });
}

async function upsertToSupabase(reports) {
  if (!reports.length) return { inserted: 0 };
  
  // Prepare data
  const rows = reports.map(r => ({
    id: String(r.id),
    number: r.number || "",
    date_from: r.date_from ? r.date_from.split("T")[0] : null,
    date_to: r.date_to ? r.date_to.split("T")[0] : null,
    driver_id: String(r.driver_id || ""),
    driver_name: r.driver_name || "",
    vehicle_id: String(r.vehicle_id || ""),
    vehicle_number: r.vehicle_number || "",
    fuel_quantity: r.fuel_quantity || 0,
    fuel_amount: r.fuel_amount || 0,
    fuel_start: r.fuel_start || 0,
    fuel_end: r.fuel_end || 0,
    mileage: r.mileage || 0,
    total_expenses: r.total_expenses || 0,
    driver_accruals: r.driver_accruals || 0,
    driver_payments: r.driver_payments || 0,
    expense_categories: JSON.stringify(r.expense_categories || []),
    synced_at: new Date().toISOString()
  }));
  
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(rows);
    const options = {
      hostname: SUPABASE.host,
      port: SUPABASE.port,
      path: "/rest/v1/driver_reports",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE.apikey,
        "Prefer": "resolution=merge-duplicates",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        resolve({ inserted: rows.length, status: res.statusCode });
      });
    });
    
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function syncMonth(year, month) {
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  
  console.log(`Syncing ${dateFrom} to ${dateTo}...`);
  
  try {
    const data = await fetch1CData(dateFrom, dateTo);
    console.log(`  Got ${data.length} reports from 1C`);
    
    if (data.length > 0) {
      const result = await upsertToSupabase(data);
      console.log(`  Upserted ${result.inserted} (status: ${result.status})`);
    }
    
    return data.length;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return 0;
  }
}

async function main() {
  console.log("=== Driver Reports Sync ===");
  console.log("Syncing from 2024-01 to 2026-01...\n");
  
  let total = 0;
  
  // 2024
  for (let m = 1; m <= 12; m++) {
    total += await syncMonth(2024, m);
  }
  
  // 2025
  for (let m = 1; m <= 12; m++) {
    total += await syncMonth(2025, m);
  }
  
  // 2026
  total += await syncMonth(2026, 1);
  
  console.log(`\n=== Done! Total: ${total} reports ===`);
}

main().catch(console.error);
