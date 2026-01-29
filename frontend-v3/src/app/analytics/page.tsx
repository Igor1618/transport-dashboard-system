"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { 
  Truck, TrendingUp, TrendingDown, DollarSign, Route, Users, 
  Calendar, BarChart3, PieChart, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Fuel, Award, Target, Zap, Clock, MapPin
} from "lucide-react";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

// ============ FETCH FUNCTIONS ============

async function fetchFleetOverview(startMonth: string, endMonth: string) {
  const res = await fetch(`/rest/v1/vehicle_economics_combined?month=gte.${startMonth}&month=lte.${endMonth}`);
  if (!res.ok) throw new Error('API error');
  return res.json();
}

async function fetchTripsStats(startDate: string, endDate: string) {
  const [wbRes, rfRes] = await Promise.all([
    fetch(`/rest/v1/trips?loading_date=gte.${startDate}&loading_date=lte.${endDate}&select=vehicle_number,trip_amount,distance_km,penalty_amount,driver_name,route_name,loading_date`),
    fetch(`/rest/v1/contracts?date=gte.${startDate}&date=lte.${endDate}&select=vehicle_number,amount,driver_name,contractor_name,route,date`)
  ]);
  const wbTrips = wbRes.ok ? await wbRes.json() : [];
  let rfTrips = rfRes.ok ? await rfRes.json() : [];
  rfTrips = rfTrips.filter((t: any) => !(t.contractor_name?.includes('РВБ') && t.route?.includes('реестру')));
  return { wbTrips, rfTrips };
}

async function fetchDriverReportsStats(startDate: string, endDate: string) {
  const res = await fetch(`/rest/v1/driver_reports?date_to=gte.${startDate}&date_to=lte.${endDate}&select=vehicle_number,driver_name,total_expenses,fuel_amount,fuel_quantity,mileage`);
  return res.ok ? await res.json() : [];
}

async function fetchRates() {
  const res = await fetch(`/rest/v1/rates?is_active=eq.true`);
  return res.ok ? await res.json() : [];
}

// ============ UTILITY FUNCTIONS ============

function formatMoney(n: number) {
  if (!n) return "0";
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + " М";
  if (Math.abs(n) >= 1000) return Math.round(n / 1000) + " К";
  return Math.round(n).toLocaleString('ru-RU');
}

function formatMoneyFull(n: number) {
  if (!n) return "0 ₽";
  return Math.round(n).toLocaleString('ru-RU') + " ₽";
}

function formatPercent(n: number) {
  return (n * 100).toFixed(1) + "%";
}

function getStatusColor(value: number, good: number, warn: number, higherIsBetter = true) {
  if (higherIsBetter) {
    if (value >= good) return "text-green-400";
    if (value >= warn) return "text-yellow-400";
    return "text-red-400";
  } else {
    if (value <= good) return "text-green-400";
    if (value <= warn) return "text-yellow-400";
    return "text-red-400";
  }
}

function getStatusIcon(value: number, good: number, warn: number, higherIsBetter = true) {
  if (higherIsBetter) {
    if (value >= good) return "✅";
    if (value >= warn) return "⚠️";
    return "❌";
  } else {
    if (value <= good) return "✅";
    if (value <= warn) return "⚠️";
    return "❌";
  }
}

// ============ UI COMPONENTS ============

function StatCard({ title, value, subtitle, icon: Icon, color, trend, onClick }: any) {
  return (
    <div 
      className={`bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 ${onClick ? 'cursor-pointer hover:bg-slate-800/70 transition' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className={`text-2xl font-bold ${color || "text-white"} mt-1`}>{value}</p>
          {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color?.includes('green') ? 'bg-green-900/30' : color?.includes('red') ? 'bg-red-900/30' : color?.includes('blue') ? 'bg-blue-900/30' : color?.includes('purple') ? 'bg-purple-900/30' : color?.includes('cyan') ? 'bg-cyan-900/30' : color?.includes('yellow') ? 'bg-yellow-900/30' : color?.includes('orange') ? 'bg-orange-900/30' : 'bg-slate-700/50'}`}>
          <Icon className={`w-5 h-5 ${color || "text-slate-400"}`} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend).toFixed(1)}% vs прошлый период
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-slate-700 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

function RankingTable({ data, title, columns, emptyText = "Нет данных" }: any) {
  const [expanded, setExpanded] = useState(false);
  const displayData = expanded ? data : data.slice(0, 5);
  
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">{title}</h3>
        {data.length > 5 && (
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'Свернуть' : `Ещё ${data.length - 5}`}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {displayData.map((item: any, i: number) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              i < 3 ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-400'
            }`}>
              {i + 1}
            </span>
            {columns.map((col: any, ci: number) => (
              <span key={ci} className={`${ci === 0 ? 'flex-1' : ''} ${col.className || 'text-white'} ${col.mono ? 'font-mono' : ''} text-sm`}>
                {col.render ? col.render(item) : item[col.key]}
              </span>
            ))}
          </div>
        ))}
        {data.length === 0 && <p className="text-slate-500 text-center py-2">{emptyText}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color = "text-blue-400" }: any) {
  return (
    <h2 className="text-lg font-semibold text-white flex items-center gap-2 mt-8 mb-4 first:mt-0">
      <Icon className={`w-5 h-5 ${color}`} />
      {title}
    </h2>
  );
}

function DataTable({ columns, data, emptyText = "Нет данных" }: any) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-left border-b border-slate-700">
            {columns.map((col: any, i: number) => (
              <th key={i} className={`pb-2 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-4 text-center text-slate-500">{emptyText}</td></tr>
          ) : (
            data.map((row: any, ri: number) => (
              <tr key={ri}>
                {columns.map((col: any, ci: number) => (
                  <td key={ci} className={`py-2 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.className || 'text-slate-300'}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============ MAIN COMPONENT ============

export default function AnalyticsPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const years = [];
  for (let y = 2023; y <= now.getFullYear(); y++) years.push(y);

  // Calculate date range
  const startMonth = viewMode === 'month' 
    ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
    : `${selectedYear}-01-01`;
  const endMonth = viewMode === 'month'
    ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
    : `${selectedYear}-12-01`;
  const startDate = startMonth;
  const endDate = viewMode === 'month'
    ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${new Date(selectedYear, selectedMonth + 1, 0).getDate()}`
    : `${selectedYear}-12-31`;

  // ============ DATA QUERIES ============

  const { data: fleetData, isLoading: fleetLoading } = useQuery({
    queryKey: ['fleet-overview', startMonth, endMonth],
    queryFn: () => fetchFleetOverview(startMonth, endMonth),
  });

  const { data: tripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ['trips-stats', startDate, endDate],
    queryFn: () => fetchTripsStats(startDate, endDate),
  });

  const { data: reportsData } = useQuery({
    queryKey: ['reports-stats', startDate, endDate],
    queryFn: () => fetchDriverReportsStats(startDate, endDate),
  });

  const { data: ratesData } = useQuery({
    queryKey: ['rates'],
    queryFn: fetchRates,
  });

  // ============ DATA PROCESSING ============

  // Aggregate vehicle data
  const vehicles = useMemo(() => {
    const aggregated: Record<string, any> = {};
    fleetData?.forEach((v: any) => {
      const key = v.vehicle_number;
      if (!key) return;
      if (!aggregated[key]) {
        aggregated[key] = { ...v };
      } else {
        aggregated[key].total_revenue = (aggregated[key].total_revenue || 0) + (v.total_revenue || 0);
        aggregated[key].wb_revenue = (aggregated[key].wb_revenue || 0) + (v.wb_revenue || 0);
        aggregated[key].trf_revenue = (aggregated[key].trf_revenue || 0) + (v.trf_revenue || 0);
        aggregated[key].expenses = (aggregated[key].expenses || 0) + (v.expenses || 0);
        aggregated[key].margin = (aggregated[key].margin || 0) + (v.margin || 0);
        aggregated[key].wb_trips = (aggregated[key].wb_trips || 0) + (v.wb_trips || 0);
        aggregated[key].trf_trips = (aggregated[key].trf_trips || 0) + (v.trf_trips || 0);
        aggregated[key].wb_distance = (aggregated[key].wb_distance || 0) + (v.wb_distance || 0);
      }
    });
    return Object.values(aggregated);
  }, [fleetData]);

  // Aggregate driver data from trips
  const driverStats = useMemo(() => {
    const drivers: Record<string, any> = {};
    
    // WB trips
    tripsData?.wbTrips?.forEach((t: any) => {
      const name = t.driver_name || 'Неизвестный';
      if (!drivers[name]) {
        drivers[name] = { name, wbRevenue: 0, rfRevenue: 0, wbTrips: 0, rfTrips: 0, wbDistance: 0, penalties: 0, vehicles: new Set() };
      }
      drivers[name].wbRevenue += t.trip_amount || 0;
      drivers[name].wbTrips += 1;
      drivers[name].wbDistance += t.distance_km || 0;
      drivers[name].penalties += t.penalty_amount || 0;
      if (t.vehicle_number) drivers[name].vehicles.add(t.vehicle_number);
    });

    // RF trips
    tripsData?.rfTrips?.forEach((t: any) => {
      const name = t.driver_name || 'Неизвестный';
      if (!drivers[name]) {
        drivers[name] = { name, wbRevenue: 0, rfRevenue: 0, wbTrips: 0, rfTrips: 0, wbDistance: 0, penalties: 0, vehicles: new Set() };
      }
      drivers[name].rfRevenue += t.amount || 0;
      drivers[name].rfTrips += 1;
      if (t.vehicle_number) drivers[name].vehicles.add(t.vehicle_number);
    });

    // Calculate totals and convert sets
    return Object.values(drivers).map((d: any) => ({
      ...d,
      totalRevenue: d.wbRevenue + d.rfRevenue,
      totalTrips: d.wbTrips + d.rfTrips,
      avgPerTrip: (d.wbTrips + d.rfTrips) > 0 ? (d.wbRevenue + d.rfRevenue) / (d.wbTrips + d.rfTrips) : 0,
      rublePerKm: d.wbDistance > 0 ? d.wbRevenue / d.wbDistance : 0,
      vehicleCount: d.vehicles.size,
      vehicles: Array.from(d.vehicles)
    })).filter(d => d.totalTrips > 0);
  }, [tripsData]);

  // Aggregate route/client data
  const routeStats = useMemo(() => {
    const routes: Record<string, any> = {};
    
    // WB routes
    tripsData?.wbTrips?.forEach((t: any) => {
      const route = t.route_name || 'Неизвестный маршрут';
      if (!routes[route]) {
        routes[route] = { route, source: 'WB', revenue: 0, trips: 0, distance: 0, penalties: 0 };
      }
      routes[route].revenue += t.trip_amount || 0;
      routes[route].trips += 1;
      routes[route].distance += t.distance_km || 0;
      routes[route].penalties += t.penalty_amount || 0;
    });

    return Object.values(routes).map((r: any) => ({
      ...r,
      avgPerTrip: r.trips > 0 ? r.revenue / r.trips : 0,
      rublePerKm: r.distance > 0 ? r.revenue / r.distance : 0,
      penaltyRate: r.revenue > 0 ? r.penalties / r.revenue : 0
    }));
  }, [tripsData]);

  // Client stats (RF)
  const clientStats = useMemo(() => {
    const clients: Record<string, any> = {};
    
    tripsData?.rfTrips?.forEach((t: any) => {
      const client = t.contractor_name || 'Неизвестный';
      if (!clients[client]) {
        clients[client] = { client, revenue: 0, trips: 0 };
      }
      clients[client].revenue += t.amount || 0;
      clients[client].trips += 1;
    });

    return Object.values(clients).map((c: any) => ({
      ...c,
      avgPerTrip: c.trips > 0 ? c.revenue / c.trips : 0
    }));
  }, [tripsData]);

  // Fuel stats from driver reports
  const fuelStats = useMemo(() => {
    const byVehicle: Record<string, any> = {};
    
    reportsData?.forEach((r: any) => {
      const v = r.vehicle_number;
      if (!v) return;
      if (!byVehicle[v]) {
        byVehicle[v] = { vehicle: v, fuelAmount: 0, fuelQuantity: 0, mileage: 0, reports: 0 };
      }
      byVehicle[v].fuelAmount += r.fuel_amount || 0;
      byVehicle[v].fuelQuantity += r.fuel_quantity || 0;
      byVehicle[v].mileage += r.mileage || 0;
      byVehicle[v].reports += 1;
    });

    return Object.values(byVehicle).map((f: any) => ({
      ...f,
      avgConsumption: f.mileage > 0 ? (f.fuelQuantity / f.mileage) * 100 : 0, // л/100км
      avgFuelPrice: f.fuelQuantity > 0 ? f.fuelAmount / f.fuelQuantity : 0,
      costPerKm: f.mileage > 0 ? f.fuelAmount / f.mileage : 0
    })).filter(f => f.mileage > 0);
  }, [reportsData]);

  // ============ FLEET STATS ============

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter((v: any) => (v.wb_trips || 0) + (v.trf_trips || 0) > 0).length;
  const idleVehicles = totalVehicles - activeVehicles;
  
  const totalRevenue = vehicles.reduce((s: number, v: any) => s + (v.total_revenue || 0), 0);
  const wbRevenue = vehicles.reduce((s: number, v: any) => s + (v.wb_revenue || 0), 0);
  const rfRevenue = vehicles.reduce((s: number, v: any) => s + (v.trf_revenue || 0), 0);
  const totalExpenses = vehicles.reduce((s: number, v: any) => s + (v.expenses || 0), 0);
  const totalMargin = vehicles.reduce((s: number, v: any) => s + (v.margin || 0), 0);
  const totalTrips = vehicles.reduce((s: number, v: any) => s + (v.wb_trips || 0) + (v.trf_trips || 0), 0);
  const totalDistance = vehicles.reduce((s: number, v: any) => s + (v.wb_distance || 0), 0);
  
  const avgRevenuePerVehicle = totalVehicles > 0 ? totalRevenue / totalVehicles : 0;
  const ktg = totalVehicles > 0 ? activeVehicles / totalVehicles : 0;
  const rublePerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;
  const marginPercent = totalRevenue > 0 ? totalMargin / totalRevenue : 0;

  // Rankings
  const topByMargin = [...vehicles].sort((a: any, b: any) => (b.margin || 0) - (a.margin || 0));
  const bottomByMargin = [...vehicles].filter((v: any) => v.margin !== undefined).sort((a: any, b: any) => (a.margin || 0) - (b.margin || 0));
  const topByRevenue = [...vehicles].sort((a: any, b: any) => (b.total_revenue || 0) - (a.total_revenue || 0));

  // Driver rankings
  const topDriversByRevenue = [...driverStats].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const topDriversByTrips = [...driverStats].sort((a, b) => b.totalTrips - a.totalTrips);
  const topDriversByEfficiency = [...driverStats].filter(d => d.wbDistance > 1000).sort((a, b) => b.rublePerKm - a.rublePerKm);

  // Route rankings
  const topRoutesByRevenue = [...routeStats].sort((a, b) => b.revenue - a.revenue);
  const topRoutesByEfficiency = [...routeStats].filter(r => r.distance > 1000).sort((a, b) => b.rublePerKm - a.rublePerKm);
  const worstRoutesByPenalties = [...routeStats].filter(r => r.penalties > 0).sort((a, b) => b.penaltyRate - a.penaltyRate);

  // Client rankings
  const topClientsByRevenue = [...clientStats].sort((a, b) => b.revenue - a.revenue);

  // Fuel rankings
  const bestFuelEfficiency = [...fuelStats].sort((a, b) => a.avgConsumption - b.avgConsumption);
  const worstFuelEfficiency = [...fuelStats].sort((a, b) => b.avgConsumption - a.avgConsumption);

  // Total fuel stats
  const totalFuel = fuelStats.reduce((s, f) => s + f.fuelQuantity, 0);
  const totalFuelCost = fuelStats.reduce((s, f) => s + f.fuelAmount, 0);
  const totalMileage = fuelStats.reduce((s, f) => s + f.mileage, 0);
  const avgFuelConsumption = totalMileage > 0 ? (totalFuel / totalMileage) * 100 : 0;
  const avgFuelPrice = totalFuel > 0 ? totalFuelCost / totalFuel : 0;

  const isLoading = fleetLoading || tripsLoading;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-blue-400" />
          Аналитика
        </h1>
        <p className="text-slate-400 text-sm mt-1">Полный обзор показателей парка</p>
      </div>

      {/* Period Selector */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-900 rounded-lg p-1">
            <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 rounded text-sm font-medium transition ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              По месяцу
            </button>
            <button onClick={() => setViewMode('year')} className={`px-3 py-1.5 rounded text-sm font-medium transition ${viewMode === 'year' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              За год
            </button>
          </div>
          <Calendar className="w-5 h-5 text-slate-400" />
          {viewMode === 'month' && (
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm">
              {MONTHS.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
            </select>
          )}
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'fleet', label: '🚛 Парк', icon: Truck },
          { id: 'drivers', label: '👷 Водители', icon: Users },
          { id: 'routes', label: '🛣️ Маршруты', icon: Route },
          { id: 'fuel', label: '⛽ Топливо', icon: Fuel },
          { id: 'roi', label: '📈 ROI', icon: Target },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(activeSection === item.id ? null : item.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeSection === item.id || !activeSection
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Загрузка данных...</div>
      ) : (
        <>
          {/* ============ SECTION 1: FLEET OVERVIEW ============ */}
          {(!activeSection || activeSection === 'fleet') && (
            <div className="space-y-4">
              <SectionHeader icon={Truck} title="1. Обзор парка" />

              {/* Main stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="Всего машин" value={totalVehicles} subtitle={`${activeVehicles} активных`} icon={Truck} color="text-blue-400" />
                <StatCard title="КТГ" value={formatPercent(ktg)} subtitle="Коэф. тех. готовности" icon={CheckCircle} color={getStatusColor(ktg, 0.85, 0.7)} />
                <StatCard title="Активных" value={activeVehicles} icon={CheckCircle} color="text-green-400" />
                <StatCard title="Простаивают" value={idleVehicles} icon={XCircle} color={idleVehicles > 0 ? "text-red-400" : "text-green-400"} />
              </div>

              {/* Revenue stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="Выручка парка" value={formatMoney(totalRevenue) + " ₽"} subtitle={`WB: ${formatMoney(wbRevenue)} + РФ: ${formatMoney(rfRevenue)}`} icon={DollarSign} color="text-blue-400" />
                <StatCard title="Маржа" value={formatMoney(totalMargin) + " ₽"} subtitle={`${(marginPercent * 100).toFixed(1)}% от выручки`} icon={TrendingUp} color={totalMargin >= 0 ? "text-green-400" : "text-red-400"} />
                <StatCard title="Ср. выручка/машину" value={formatMoney(avgRevenuePerVehicle) + " ₽"} icon={Truck} color="text-purple-400" />
                <StatCard title="Рубль/км (WB)" value={rublePerKm.toFixed(1) + " ₽"} subtitle={`${totalDistance.toLocaleString('ru-RU')} км`} icon={Route} color="text-cyan-400" />
              </div>

              {/* Vehicle rankings */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <RankingTable 
                  data={topByMargin} 
                  title="🏆 Топ по марже" 
                  columns={[
                    { key: 'vehicle_number', mono: true },
                    { render: (v: any) => formatMoney(v.margin) + ' ₽', className: 'font-medium text-green-400' }
                  ]} 
                />
                <RankingTable 
                  data={bottomByMargin} 
                  title="⚠️ Антитоп по марже" 
                  columns={[
                    { key: 'vehicle_number', mono: true },
                    { render: (v: any) => formatMoney(v.margin) + ' ₽', className: 'font-medium text-red-400' }
                  ]} 
                />
                <RankingTable 
                  data={topByRevenue} 
                  title="💰 Топ по выручке" 
                  columns={[
                    { key: 'vehicle_number', mono: true },
                    { render: (v: any) => formatMoney(v.total_revenue) + ' ₽', className: 'font-medium text-blue-400' }
                  ]} 
                />
              </div>

              {/* Revenue breakdown */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <h3 className="text-white font-medium mb-4">Структура выручки</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-purple-400">Wildberries</span>
                      <span className="text-white">{formatMoneyFull(wbRevenue)} ({totalRevenue > 0 ? ((wbRevenue / totalRevenue) * 100).toFixed(1) : 0}%)</span>
                    </div>
                    <ProgressBar value={wbRevenue} max={totalRevenue} color="bg-purple-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-green-400">РФ Транспорт</span>
                      <span className="text-white">{formatMoneyFull(rfRevenue)} ({totalRevenue > 0 ? ((rfRevenue / totalRevenue) * 100).toFixed(1) : 0}%)</span>
                    </div>
                    <ProgressBar value={rfRevenue} max={totalRevenue} color="bg-green-500" />
                  </div>
                </div>
              </div>

              {/* KPIs table */}
              <DataTable
                columns={[
                  { header: 'Показатель', key: 'name' },
                  { header: 'Значение', key: 'value', align: 'right', className: 'text-white font-medium' },
                  { header: 'Норма', key: 'norm', align: 'right', className: 'text-slate-400' },
                  { header: '', key: 'status', align: 'center' },
                ]}
                data={[
                  { name: 'КТГ (использование парка)', value: formatPercent(ktg), norm: '≥85%', status: getStatusIcon(ktg, 0.85, 0.7) },
                  { name: 'Маржинальность', value: formatPercent(marginPercent), norm: '≥15%', status: getStatusIcon(marginPercent, 0.15, 0.1) },
                  { name: 'Рубль/км', value: rublePerKm.toFixed(1) + ' ₽', norm: '≥25 ₽', status: getStatusIcon(rublePerKm, 25, 20) },
                  { name: 'Всего рейсов', value: totalTrips.toLocaleString('ru-RU'), norm: '—', status: '📊' },
                ]}
              />
            </div>
          )}

          {/* ============ SECTION 2: DRIVER EFFICIENCY ============ */}
          {(!activeSection || activeSection === 'drivers') && (
            <div className="space-y-4">
              <SectionHeader icon={Users} title="2. Эффективность водителей" color="text-orange-400" />

              {/* Driver stats overview */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="Всего водителей" value={driverStats.length} icon={Users} color="text-orange-400" />
                <StatCard title="Выручка (все)" value={formatMoney(driverStats.reduce((s, d) => s + d.totalRevenue, 0)) + ' ₽'} icon={DollarSign} color="text-green-400" />
                <StatCard title="Ср. на водителя" value={formatMoney(driverStats.length > 0 ? driverStats.reduce((s, d) => s + d.totalRevenue, 0) / driverStats.length : 0) + ' ₽'} icon={TrendingUp} color="text-blue-400" />
                <StatCard title="Всего штрафов" value={formatMoney(driverStats.reduce((s, d) => s + d.penalties, 0)) + ' ₽'} icon={AlertTriangle} color="text-red-400" />
              </div>

              {/* Driver rankings */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <RankingTable 
                  data={topDriversByRevenue} 
                  title="💰 Топ по выручке" 
                  columns={[
                    { key: 'name' },
                    { render: (d: any) => formatMoney(d.totalRevenue) + ' ₽', className: 'font-medium text-green-400' }
                  ]} 
                />
                <RankingTable 
                  data={topDriversByTrips} 
                  title="🚛 Топ по рейсам" 
                  columns={[
                    { key: 'name' },
                    { render: (d: any) => d.totalTrips + ' рейсов', className: 'font-medium text-blue-400' }
                  ]} 
                />
                <RankingTable 
                  data={topDriversByEfficiency} 
                  title="⚡ Топ по ₽/км" 
                  columns={[
                    { key: 'name' },
                    { render: (d: any) => d.rublePerKm.toFixed(1) + ' ₽/км', className: 'font-medium text-cyan-400' }
                  ]} 
                />
              </div>

              {/* Full driver table */}
              <DataTable
                columns={[
                  { header: 'Водитель', key: 'name', className: 'text-white font-medium' },
                  { header: 'Выручка', render: (d: any) => formatMoney(d.totalRevenue) + ' ₽', align: 'right', className: 'text-green-400' },
                  { header: 'WB', render: (d: any) => formatMoney(d.wbRevenue), align: 'right' },
                  { header: 'РФ', render: (d: any) => formatMoney(d.rfRevenue), align: 'right' },
                  { header: 'Рейсов', render: (d: any) => d.totalTrips, align: 'right' },
                  { header: 'Штрафы', render: (d: any) => d.penalties > 0 ? formatMoney(d.penalties) + ' ₽' : '—', align: 'right', className: 'text-red-400' },
                  { header: '₽/км', render: (d: any) => d.rublePerKm > 0 ? d.rublePerKm.toFixed(1) : '—', align: 'right' },
                  { header: 'Машин', render: (d: any) => d.vehicleCount, align: 'right' },
                ]}
                data={topDriversByRevenue.slice(0, 15)}
              />
            </div>
          )}

          {/* ============ SECTION 3: ROUTES & CLIENTS ============ */}
          {(!activeSection || activeSection === 'routes') && (
            <div className="space-y-4">
              <SectionHeader icon={Route} title="3. Маршруты и клиенты" color="text-cyan-400" />

              {/* Route stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="Маршрутов WB" value={routeStats.length} icon={MapPin} color="text-purple-400" />
                <StatCard title="Клиентов РФ" value={clientStats.length} icon={Users} color="text-green-400" />
                <StatCard title="Штрафы WB" value={formatMoney(routeStats.reduce((s, r) => s + r.penalties, 0)) + ' ₽'} icon={AlertTriangle} color="text-red-400" />
                <StatCard title="Ср. ₽/км WB" value={(routeStats.reduce((s, r) => s + r.distance, 0) > 0 ? routeStats.reduce((s, r) => s + r.revenue, 0) / routeStats.reduce((s, r) => s + r.distance, 0) : 0).toFixed(1) + ' ₽'} icon={TrendingUp} color="text-cyan-400" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top WB routes */}
                <RankingTable 
                  data={topRoutesByRevenue.slice(0, 10)} 
                  title="🏆 Топ маршрутов WB по выручке" 
                  columns={[
                    { render: (r: any) => r.route.length > 30 ? r.route.slice(0, 30) + '...' : r.route },
                    { render: (r: any) => formatMoney(r.revenue) + ' ₽', className: 'font-medium text-green-400' }
                  ]} 
                />

                {/* Top clients */}
                <RankingTable 
                  data={topClientsByRevenue.slice(0, 10)} 
                  title="🏢 Топ клиентов РФ" 
                  columns={[
                    { render: (c: any) => c.client.length > 30 ? c.client.slice(0, 30) + '...' : c.client },
                    { render: (c: any) => formatMoney(c.revenue) + ' ₽', className: 'font-medium text-green-400' }
                  ]} 
                />
              </div>

              {/* Routes with most penalties */}
              {worstRoutesByPenalties.length > 0 && (
                <RankingTable 
                  data={worstRoutesByPenalties.slice(0, 5)} 
                  title="⚠️ Маршруты с высоким % штрафов" 
                  columns={[
                    { render: (r: any) => r.route.length > 40 ? r.route.slice(0, 40) + '...' : r.route },
                    { render: (r: any) => (r.penaltyRate * 100).toFixed(1) + '%', className: 'font-medium text-red-400' }
                  ]} 
                />
              )}

              {/* Route efficiency table */}
              <DataTable
                columns={[
                  { header: 'Маршрут', render: (r: any) => r.route.length > 50 ? r.route.slice(0, 50) + '...' : r.route, className: 'text-white' },
                  { header: 'Выручка', render: (r: any) => formatMoney(r.revenue) + ' ₽', align: 'right', className: 'text-green-400' },
                  { header: 'Рейсов', render: (r: any) => r.trips, align: 'right' },
                  { header: 'Км', render: (r: any) => r.distance.toLocaleString('ru-RU'), align: 'right' },
                  { header: '₽/км', render: (r: any) => r.rublePerKm.toFixed(1), align: 'right', className: 'text-cyan-400' },
                  { header: 'Ср/рейс', render: (r: any) => formatMoney(r.avgPerTrip), align: 'right' },
                  { header: 'Штрафы', render: (r: any) => r.penalties > 0 ? formatMoney(r.penalties) + ' ₽' : '—', align: 'right', className: 'text-red-400' },
                ]}
                data={topRoutesByRevenue.slice(0, 10)}
              />
            </div>
          )}

          {/* ============ SECTION 4: FUEL ANALYTICS ============ */}
          {(!activeSection || activeSection === 'fuel') && (
            <div className="space-y-4">
              <SectionHeader icon={Fuel} title="4. Топливная аналитика" color="text-yellow-400" />

              {/* Fuel stats overview */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="Расход топлива" value={Math.round(totalFuel).toLocaleString('ru-RU') + ' л'} icon={Fuel} color="text-yellow-400" />
                <StatCard title="Затраты на топливо" value={formatMoney(totalFuelCost) + ' ₽'} icon={DollarSign} color="text-red-400" />
                <StatCard title="Ср. расход" value={avgFuelConsumption.toFixed(1) + ' л/100км'} subtitle={avgFuelConsumption <= 35 ? 'Норма' : 'Выше нормы'} icon={Zap} color={getStatusColor(avgFuelConsumption, 35, 40, false)} />
                <StatCard title="Ср. цена литра" value={avgFuelPrice.toFixed(1) + ' ₽'} icon={TrendingUp} color="text-blue-400" />
              </div>

              {/* Fuel rankings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <RankingTable 
                  data={bestFuelEfficiency.slice(0, 8)} 
                  title="🌿 Лучшие по расходу" 
                  columns={[
                    { key: 'vehicle', mono: true },
                    { render: (f: any) => f.avgConsumption.toFixed(1) + ' л/100км', className: 'font-medium text-green-400' }
                  ]} 
                />
                <RankingTable 
                  data={worstFuelEfficiency.slice(0, 8)} 
                  title="🔥 Худшие по расходу" 
                  columns={[
                    { key: 'vehicle', mono: true },
                    { render: (f: any) => f.avgConsumption.toFixed(1) + ' л/100км', className: 'font-medium text-red-400' }
                  ]} 
                />
              </div>

              {/* Fuel costs breakdown */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <h3 className="text-white font-medium mb-4">Доля топлива в расходах</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-yellow-400">Топливо</span>
                      <span className="text-white">{formatMoneyFull(totalFuelCost)} ({totalExpenses > 0 ? ((totalFuelCost / totalExpenses) * 100).toFixed(1) : 0}% от расходов)</span>
                    </div>
                    <ProgressBar value={totalFuelCost} max={totalExpenses} color="bg-yellow-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Прочие расходы</span>
                      <span className="text-white">{formatMoneyFull(totalExpenses - totalFuelCost)}</span>
                    </div>
                    <ProgressBar value={totalExpenses - totalFuelCost} max={totalExpenses} color="bg-slate-500" />
                  </div>
                </div>
              </div>

              {/* Fuel table */}
              <DataTable
                columns={[
                  { header: 'Машина', key: 'vehicle', className: 'text-white font-mono' },
                  { header: 'Пробег', render: (f: any) => f.mileage.toLocaleString('ru-RU') + ' км', align: 'right' },
                  { header: 'Топливо', render: (f: any) => Math.round(f.fuelQuantity) + ' л', align: 'right' },
                  { header: 'Расход', render: (f: any) => f.avgConsumption.toFixed(1) + ' л/100', align: 'right', className: "text-slate-300" },
                  { header: 'Затраты', render: (f: any) => formatMoney(f.fuelAmount) + ' ₽', align: 'right', className: 'text-yellow-400' },
                  { header: '₽/км', render: (f: any) => f.costPerKm.toFixed(1), align: 'right' },
                ]}
                data={fuelStats.sort((a, b) => b.fuelAmount - a.fuelAmount).slice(0, 15)}
              />
            </div>
          )}

          {/* ============ SECTION 5: ROI ANALYSIS ============ */}
          {(!activeSection || activeSection === 'roi') && (
            <div className="space-y-4">
              <SectionHeader icon={Target} title="5. ROI и окупаемость" color="text-purple-400" />

              {/* ROI overview */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="Общая маржа" value={formatMoney(totalMargin) + ' ₽'} icon={TrendingUp} color={totalMargin >= 0 ? "text-green-400" : "text-red-400"} />
                <StatCard title="Маржинальность" value={formatPercent(marginPercent)} subtitle={marginPercent >= 0.15 ? 'Хорошо' : marginPercent >= 0.1 ? 'Средне' : 'Низко'} icon={PieChart} color={getStatusColor(marginPercent, 0.15, 0.1)} />
                <StatCard title="Ср. маржа/машину" value={formatMoney(totalVehicles > 0 ? totalMargin / totalVehicles : 0) + ' ₽'} icon={Truck} color="text-purple-400" />
                <StatCard title="Убыточных машин" value={vehicles.filter((v: any) => (v.margin || 0) < 0).length} icon={AlertTriangle} color={vehicles.filter((v: any) => (v.margin || 0) < 0).length > 0 ? "text-red-400" : "text-green-400"} />
              </div>

              {/* Profitability distribution */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <h3 className="text-white font-medium mb-4">Распределение по прибыльности</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-green-900/30 rounded-lg p-4">
                    <div className="text-3xl font-bold text-green-400">{vehicles.filter((v: any) => (v.margin || 0) > 50000).length}</div>
                    <div className="text-slate-400 text-sm mt-1">Высокодоходные<br/>(&gt;50К маржи)</div>
                  </div>
                  <div className="bg-yellow-900/30 rounded-lg p-4">
                    <div className="text-3xl font-bold text-yellow-400">{vehicles.filter((v: any) => (v.margin || 0) >= 0 && (v.margin || 0) <= 50000).length}</div>
                    <div className="text-slate-400 text-sm mt-1">Средние<br/>(0-50К маржи)</div>
                  </div>
                  <div className="bg-red-900/30 rounded-lg p-4">
                    <div className="text-3xl font-bold text-red-400">{vehicles.filter((v: any) => (v.margin || 0) < 0).length}</div>
                    <div className="text-slate-400 text-sm mt-1">Убыточные<br/>(&lt;0 маржи)</div>
                  </div>
                </div>
              </div>

              {/* Detailed ROI table */}
              <DataTable
                columns={[
                  { header: 'Машина', key: 'vehicle_number', className: 'text-white font-mono' },
                  { header: 'Выручка', render: (v: any) => formatMoney(v.total_revenue || 0) + ' ₽', align: 'right' },
                  { header: 'Расходы', render: (v: any) => formatMoney(v.expenses || 0) + ' ₽', align: 'right', className: 'text-red-400' },
                  { header: 'Маржа', render: (v: any) => formatMoney(v.margin || 0) + ' ₽', align: 'right', className: 'text-white font-medium' },
                  { header: '%', render: (v: any) => v.total_revenue > 0 ? ((v.margin || 0) / v.total_revenue * 100).toFixed(1) + '%' : '—', align: 'right' },
                  { header: 'Рейсов', render: (v: any) => (v.wb_trips || 0) + (v.trf_trips || 0), align: 'right' },
                  { header: 'Статус', render: (v: any) => {
                    const m = v.margin || 0;
                    if (m > 50000) return '🟢';
                    if (m >= 0) return '🟡';
                    return '🔴';
                  }, align: 'center' },
                ]}
                data={topByMargin.slice(0, 20)}
              />

              {/* Recommendations */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-400" />
                  Рекомендации
                </h3>
                <div className="space-y-2 text-sm">
                  {vehicles.filter((v: any) => (v.margin || 0) < 0).length > 0 && (
                    <div className="flex items-start gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Есть {vehicles.filter((v: any) => (v.margin || 0) < 0).length} убыточных машин — проанализируйте причины</span>
                    </div>
                  )}
                  {ktg < 0.85 && (
                    <div className="flex items-start gap-2 text-yellow-400">
                      <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>КТГ {formatPercent(ktg)} — {idleVehicles} машин простаивают. Найдите заказы или оптимизируйте парк.</span>
                    </div>
                  )}
                  {marginPercent < 0.15 && (
                    <div className="flex items-start gap-2 text-yellow-400">
                      <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Маржинальность {formatPercent(marginPercent)} ниже нормы 15% — проверьте тарифы и расходы</span>
                    </div>
                  )}
                  {avgFuelConsumption > 35 && (
                    <div className="flex items-start gap-2 text-yellow-400">
                      <Fuel className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Средний расход {avgFuelConsumption.toFixed(1)} л/100км выше нормы — проверьте водителей и техсостояние</span>
                    </div>
                  )}
                  {marginPercent >= 0.15 && ktg >= 0.85 && (
                    <div className="flex items-start gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Показатели в норме. Продолжайте мониторинг.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
