const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// GET /api/analytics - основная аналитика
router.get("/", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Дефолт - текущий месяц
    const now = new Date();
    const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
    
    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;
    const monthStart = start.substring(0, 7) + "-01";
    const monthEnd = end.substring(0, 7) + "-01";

    // 1. Данные по машинам из view
    const vehiclesQuery = `SELECT * FROM vehicle_economics_combined WHERE month >= $1 AND month <= $2`;
    const vehiclesResult = await pool.query(vehiclesQuery, [monthStart, monthEnd]);

    // Агрегируем по машинам
    const vehicleMap = {};
    vehiclesResult.rows.forEach(v => {
      const key = v.vehicle_number;
      if (!key) return;
      if (!vehicleMap[key]) {
        vehicleMap[key] = { ...v };
      } else {
        vehicleMap[key].total_revenue = (parseFloat(vehicleMap[key].total_revenue) || 0) + (parseFloat(v.total_revenue) || 0);
        vehicleMap[key].wb_revenue = (parseFloat(vehicleMap[key].wb_revenue) || 0) + (parseFloat(v.wb_revenue) || 0);
        vehicleMap[key].trf_revenue = (parseFloat(vehicleMap[key].trf_revenue) || 0) + (parseFloat(v.trf_revenue) || 0);
        vehicleMap[key].expenses = (parseFloat(vehicleMap[key].expenses) || 0) + (parseFloat(v.expenses) || 0);
        vehicleMap[key].margin = (parseFloat(vehicleMap[key].margin) || 0) + (parseFloat(v.margin) || 0);
        vehicleMap[key].wb_trips = (parseInt(vehicleMap[key].wb_trips) || 0) + (parseInt(v.wb_trips) || 0);
        vehicleMap[key].trf_trips = (parseInt(vehicleMap[key].trf_trips) || 0) + (parseInt(v.trf_trips) || 0);
        vehicleMap[key].wb_distance = (parseFloat(vehicleMap[key].wb_distance) || 0) + (parseFloat(v.wb_distance) || 0);
      }
    });
    const vehicles = Object.values(vehicleMap);

    // 2. WB рейсы
    const wbTripsQuery = `SELECT vehicle_number, trip_amount, distance_km, penalty_amount, driver_name, route_name, loading_date FROM trips WHERE loading_date >= $1 AND loading_date <= $2`;
    const wbTripsResult = await pool.query(wbTripsQuery, [start, end]);
    const wbTrips = wbTripsResult.rows;

    // 3. РФ рейсы (без РВБ)
    const rfTripsQuery = `SELECT vehicle_number, amount, driver_name, contractor_name, route, date FROM contracts WHERE date >= $1 AND date <= $2 AND NOT (contractor_name ILIKE '%РВБ%' AND route ILIKE '%реестру%')`;
    const rfTripsResult = await pool.query(rfTripsQuery, [start, end]);
    const rfTrips = rfTripsResult.rows;

    // 4. Отчёты водителей (топливо)
    const reportsQuery = `SELECT vehicle_number, driver_name, total_expenses, fuel_amount, fuel_quantity, mileage FROM driver_reports WHERE date_to >= $1 AND date_to <= $2`;
    const reportsResult = await pool.query(reportsQuery, [start, end]);
    const driverReports = reportsResult.rows;

    // === Расчёт статистики ===
    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter(v => (parseInt(v.wb_trips) || 0) + (parseInt(v.trf_trips) || 0) > 0).length;
    const idleVehicles = totalVehicles - activeVehicles;

    const totalRevenue = vehicles.reduce((s, v) => s + (parseFloat(v.total_revenue) || 0), 0);
    const wbRevenue = vehicles.reduce((s, v) => s + (parseFloat(v.wb_revenue) || 0), 0);
    const rfRevenue = vehicles.reduce((s, v) => s + (parseFloat(v.trf_revenue) || 0), 0);
    const totalExpenses = vehicles.reduce((s, v) => s + (parseFloat(v.expenses) || 0), 0);
    const totalMargin = vehicles.reduce((s, v) => s + (parseFloat(v.margin) || 0), 0);
    const totalTrips = vehicles.reduce((s, v) => s + (parseInt(v.wb_trips) || 0) + (parseInt(v.trf_trips) || 0), 0);
    const totalDistance = vehicles.reduce((s, v) => s + (parseFloat(v.wb_distance) || 0), 0);

    const ktg = totalVehicles > 0 ? activeVehicles / totalVehicles : 0;
    const rublePerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;
    const marginPercent = totalRevenue > 0 ? totalMargin / totalRevenue : 0;

    // Driver stats
    const driverMap = {};
    wbTrips.forEach(t => {
      const name = t.driver_name || "Неизвестный";
      if (!driverMap[name]) driverMap[name] = { name, wbRevenue: 0, rfRevenue: 0, wbTrips: 0, rfTrips: 0, wbDistance: 0, penalties: 0, vehicles: new Set() };
      driverMap[name].wbRevenue += parseFloat(t.trip_amount) || 0;
      driverMap[name].wbTrips += 1;
      driverMap[name].wbDistance += parseFloat(t.distance_km) || 0;
      driverMap[name].penalties += parseFloat(t.penalty_amount) || 0;
      if (t.vehicle_number) driverMap[name].vehicles.add(t.vehicle_number);
    });
    rfTrips.forEach(t => {
      const name = t.driver_name || "Неизвестный";
      if (!driverMap[name]) driverMap[name] = { name, wbRevenue: 0, rfRevenue: 0, wbTrips: 0, rfTrips: 0, wbDistance: 0, penalties: 0, vehicles: new Set() };
      driverMap[name].rfRevenue += parseFloat(t.amount) || 0;
      driverMap[name].rfTrips += 1;
      if (t.vehicle_number) driverMap[name].vehicles.add(t.vehicle_number);
    });
    const drivers = Object.values(driverMap).map(d => ({
      name: d.name, wbRevenue: d.wbRevenue, rfRevenue: d.rfRevenue, totalRevenue: d.wbRevenue + d.rfRevenue,
      wbTrips: d.wbTrips, rfTrips: d.rfTrips, totalTrips: d.wbTrips + d.rfTrips, wbDistance: d.wbDistance,
      penalties: d.penalties, rublePerKm: d.wbDistance > 0 ? d.wbRevenue / d.wbDistance : 0, vehicleCount: d.vehicles.size
    })).filter(d => d.totalTrips > 0);

    // Route stats
    const routeMap = {};
    wbTrips.forEach(t => {
      const route = t.route_name || "Неизвестный маршрут";
      if (!routeMap[route]) routeMap[route] = { route, revenue: 0, trips: 0, distance: 0, penalties: 0 };
      routeMap[route].revenue += parseFloat(t.trip_amount) || 0;
      routeMap[route].trips += 1;
      routeMap[route].distance += parseFloat(t.distance_km) || 0;
      routeMap[route].penalties += parseFloat(t.penalty_amount) || 0;
    });
    const routes = Object.values(routeMap).map(r => ({
      ...r, avgPerTrip: r.trips > 0 ? r.revenue / r.trips : 0,
      rublePerKm: r.distance > 0 ? r.revenue / r.distance : 0,
      penaltyRate: r.revenue > 0 ? r.penalties / r.revenue : 0
    }));

    // Client stats
    const clientMap = {};
    rfTrips.forEach(t => {
      const client = t.contractor_name || "Неизвестный";
      if (!clientMap[client]) clientMap[client] = { client, revenue: 0, trips: 0 };
      clientMap[client].revenue += parseFloat(t.amount) || 0;
      clientMap[client].trips += 1;
    });
    const clients = Object.values(clientMap).map(c => ({ ...c, avgPerTrip: c.trips > 0 ? c.revenue / c.trips : 0 }));

    // Fuel stats
    const fuelMap = {};
    driverReports.forEach(r => {
      const v = r.vehicle_number;
      if (!v) return;
      if (!fuelMap[v]) fuelMap[v] = { vehicle: v, fuelAmount: 0, fuelQuantity: 0, mileage: 0, reports: 0 };
      fuelMap[v].fuelAmount += parseFloat(r.fuel_amount) || 0;
      fuelMap[v].fuelQuantity += parseFloat(r.fuel_quantity) || 0;
      fuelMap[v].mileage += parseFloat(r.mileage) || 0;
      fuelMap[v].reports += 1;
    });
    const fuelStats = Object.values(fuelMap).map(f => ({
      ...f, avgConsumption: f.mileage > 0 ? (f.fuelQuantity / f.mileage) * 100 : 0,
      avgFuelPrice: f.fuelQuantity > 0 ? f.fuelAmount / f.fuelQuantity : 0,
      costPerKm: f.mileage > 0 ? f.fuelAmount / f.mileage : 0
    })).filter(f => f.mileage > 0);

    const totalFuel = fuelStats.reduce((s, f) => s + f.fuelQuantity, 0);
    const totalFuelCost = fuelStats.reduce((s, f) => s + f.fuelAmount, 0);
    const totalMileage = fuelStats.reduce((s, f) => s + f.mileage, 0);

    res.json({
      period: { startDate: start, endDate: end },
      fleet: {
        totalVehicles, activeVehicles, idleVehicles, ktg,
        totalRevenue: Math.round(totalRevenue), wbRevenue: Math.round(wbRevenue), rfRevenue: Math.round(rfRevenue),
        totalExpenses: Math.round(totalExpenses), totalMargin: Math.round(totalMargin), marginPercent,
        totalTrips, totalDistance: Math.round(totalDistance), rublePerKm: Math.round(rublePerKm * 10) / 10,
        vehicles: vehicles.map(v => ({
          vehicle_number: v.vehicle_number, total_revenue: Math.round(parseFloat(v.total_revenue) || 0),
          wb_revenue: Math.round(parseFloat(v.wb_revenue) || 0), trf_revenue: Math.round(parseFloat(v.trf_revenue) || 0),
          expenses: Math.round(parseFloat(v.expenses) || 0), margin: Math.round(parseFloat(v.margin) || 0),
          wb_trips: parseInt(v.wb_trips) || 0, trf_trips: parseInt(v.trf_trips) || 0, wb_distance: Math.round(parseFloat(v.wb_distance) || 0)
        })).sort((a, b) => b.margin - a.margin)
      },
      drivers: drivers.sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 30),
      routes: routes.sort((a, b) => b.revenue - a.revenue).slice(0, 20),
      clients: clients.sort((a, b) => b.revenue - a.revenue).slice(0, 20),
      fuel: {
        totalFuel: Math.round(totalFuel), totalFuelCost: Math.round(totalFuelCost), totalMileage: Math.round(totalMileage),
        avgFuelConsumption: Math.round((totalMileage > 0 ? (totalFuel / totalMileage) * 100 : 0) * 10) / 10,
        avgFuelPrice: Math.round((totalFuel > 0 ? totalFuelCost / totalFuel : 0) * 10) / 10,
        vehicles: fuelStats.sort((a, b) => b.fuelAmount - a.fuelAmount).slice(0, 20)
      }
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Ошибка получения аналитики" });
  }
});

module.exports = router;
