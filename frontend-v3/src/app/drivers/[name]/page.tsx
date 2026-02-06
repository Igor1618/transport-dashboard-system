"use client";
import { formatDate, formatDateTime, formatShortDate } from "@/lib/dates";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, TrendingUp, Truck, FileText, AlertTriangle, Route, DollarSign, Fuel } from "lucide-react";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

async function fetchDriverStats(driverName: string, month: string) {
  const res = await fetch(`/rest/v1/driver_economics_combined?driver_name=eq.${encodeURIComponent(driverName)}&month=eq.${month}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0] || null;
}

async function fetchDriverTrips(driverName: string, startDate: string, endDate: string) {
  // WB рейсы
  const wbRes = await fetch(`/rest/v1/trips?driver_name=eq.${encodeURIComponent(driverName)}&loading_date=gte.${startDate}&loading_date=lte.${endDate}&order=loading_date.desc&limit=100`);
  const wbTrips = wbRes.ok ? await wbRes.json() : [];
  
  // РФ заявки (исключая РВБ)
  const trfRes = await fetch(`/rest/v1/contracts?driver_name=eq.${encodeURIComponent(driverName)}&date=gte.${startDate}&date=lte.${endDate}&order=date.desc&limit=100`);
  let trfTrips = trfRes.ok ? await trfRes.json() : [];
  // Фильтруем РВБ на клиенте
  trfTrips = trfTrips.filter((t: any) => !(t.contractor_name?.includes('РВБ') && t.route?.includes('реестру')));
  
  return { wbTrips, trfTrips };
}

async function fetchDriverReports(driverName: string, startDate: string, endDate: string) {
  const res = await fetch(`/rest/v1/driver_reports?driver_name=eq.${encodeURIComponent(driverName)}&date_to=gte.${startDate}&date_to=lte.${endDate}&order=date_to.desc&limit=50`);
  return res.ok ? await res.json() : [];
}

async function fetchDriverVehicles(driverName: string, startDate: string, endDate: string) {
  // Получаем уникальные машины водителя из contracts и trips
  const [trfRes, wbRes] = await Promise.all([
    fetch(`/rest/v1/contracts?driver_name=eq.${encodeURIComponent(driverName)}&date=gte.${startDate}&date=lte.${endDate}&select=vehicle_number`),
    fetch(`/rest/v1/trips?driver_name=eq.${encodeURIComponent(driverName)}&loading_date=gte.${startDate}&loading_date=lte.${endDate}&select=vehicle_number`)
  ]);
  
  const trfData = trfRes.ok ? await trfRes.json() : [];
  const wbData = wbRes.ok ? await wbRes.json() : [];
  
  const vehicles = new Set<string>();
  trfData.forEach((t: any) => t.vehicle_number && vehicles.add(t.vehicle_number));
  wbData.forEach((t: any) => t.vehicle_number && vehicles.add(t.vehicle_number));
  
  return Array.from(vehicles);
}

function formatMoney(n: number) {
  if (!n) return "0 ₽";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + " М ₽";
  if (n >= 1000) return Math.round(n / 1000) + " К ₽";
  return Math.round(n) + " ₽";
}


function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-700/50 rounded-lg">
          <Icon className={`w-5 h-5 ${color || "text-slate-400"}`} />
        </div>
        <div>
          <p className="text-slate-400 text-xs">{title}</p>
          <p className={`text-xl font-bold ${color || "text-white"}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function DriverDetailPage() {
  const params = useParams();
  const driverName = decodeURIComponent(params.name as string);
  
  const now = new Date();
  const [mode, setMode] = useState<"month" | "range">("month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [startDate, setStartDate] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [endDate, setEndDate] = useState(() => {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
  });

  const month = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const periodStart = mode === "month" ? month : startDate;
  const periodEnd = mode === "month" ? (() => {
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    return `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${lastDay}`;
  })() : endDate;

  const years = [];
  for (let y = 2023; y <= now.getFullYear(); y++) years.push(y);

  const { data: stats } = useQuery({
    queryKey: ["driver-stats", driverName, month],
    queryFn: () => fetchDriverStats(driverName, month),
    enabled: mode === "month",
  });

  const { data: trips } = useQuery({
    queryKey: ["driver-trips", driverName, periodStart, periodEnd],
    queryFn: () => fetchDriverTrips(driverName, periodStart, periodEnd),
  });

  const { data: reports } = useQuery({
    queryKey: ["driver-reports", driverName, periodStart, periodEnd],
    queryFn: () => fetchDriverReports(driverName, periodStart, periodEnd),
  });

  const { data: vehicles } = useQuery({
    queryKey: ["driver-vehicles", driverName, periodStart, periodEnd],
    queryFn: () => fetchDriverVehicles(driverName, periodStart, periodEnd),
  });

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setMode("range");
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Считаем статистику из рейсов если режим range
  const calcStats = mode === "range" && trips ? {
    trf_revenue: trips.trfTrips?.reduce((s: number, t: any) => s + (t.amount || 0), 0) || 0,
    trf_trips: trips.trfTrips?.length || 0,
    wb_revenue: trips.wbTrips?.reduce((s: number, t: any) => s + (t.trip_amount || 0) * (new Date(t.loading_date) >= new Date('2026-01-01') ? 1.22 : 1.2), 0) || 0,
    wb_trips: trips.wbTrips?.length || 0,
    wb_penalties: trips.wbTrips?.reduce((s: number, t: any) => s + (t.penalty_amount || 0), 0) || 0,
    wb_distance: trips.wbTrips?.reduce((s: number, t: any) => s + (t.distance_km || 0), 0) || 0,
  } : null;

  const displayStats = mode === "month" ? stats : calcStats;
  const totalRevenue = (displayStats?.trf_revenue || 0) + (displayStats?.wb_revenue || 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <Link href="/drivers" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-2">
          <ArrowLeft className="w-4 h-4" />
          Назад к списку
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-white">{driverName}</h1>
        <p className="text-slate-400 text-sm">Детальная статистика водителя</p>
      </div>

      {/* Period Selector */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex bg-slate-900 rounded-lg p-1">
            <button onClick={() => setMode("month")} className={`px-3 py-1.5 rounded text-sm font-medium transition ${mode === "month" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
              По месяцу
            </button>
            <button onClick={() => setMode("range")} className={`px-3 py-1.5 rounded text-sm font-medium transition ${mode === "range" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
              По датам
            </button>
          </div>
          {mode === "range" && (
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setQuickRange(7)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">7 дней</button>
              <button onClick={() => setQuickRange(30)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">30 дней</button>
              <button onClick={() => setQuickRange(90)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">90 дней</button>
              <button onClick={() => setQuickRange(365)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">Год</button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="w-5 h-5 text-slate-400" />
          {mode === "month" ? (
            <>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm">
                {MONTHS.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          ) : (
            <>
              <span className="text-slate-400 text-sm">с</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm" />
              <span className="text-slate-400 text-sm">по</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm" />
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard title="Общая выручка" value={formatMoney(totalRevenue)} icon={DollarSign} color="text-blue-400" />
        <StatCard title="РФ Транспорт" value={formatMoney(displayStats?.trf_revenue || 0)} icon={Truck} color="text-green-400" />
        <StatCard title="Wildberries" value={formatMoney(displayStats?.wb_revenue || 0)} icon={FileText} color="text-purple-400" />
        <StatCard title="Штрафы WB" value={formatMoney(displayStats?.wb_penalties || 0)} icon={AlertTriangle} color="text-red-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Рейсов РФ" value={displayStats?.trf_trips || 0} icon={FileText} color="text-green-400" />
        <StatCard title="Рейсов WB" value={displayStats?.wb_trips || 0} icon={FileText} color="text-purple-400" />
        <StatCard title="Пробег WB" value={(displayStats?.wb_distance || 0).toLocaleString('ru-RU') + ' км'} icon={Route} color="text-purple-400" />
        <StatCard title="Машин" value={vehicles?.length || 0} icon={Truck} />
      </div>

      {/* Vehicles */}
      {vehicles && vehicles.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-4">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5 text-slate-400" />
            Машины ({vehicles.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {vehicles.map((v: string) => (
              <Link key={v} href={`/vehicles/${encodeURIComponent(v)}`} className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-white text-sm transition">
                {v}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Trips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* WB Trips */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Рейсы Wildberries ({trips?.wbTrips?.length || 0})
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {trips?.wbTrips?.slice(0, 20).map((t: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-2 bg-slate-700/30 rounded-lg text-sm">
                <div>
                  <div className="text-white">{formatDate(t.loading_date)}</div>
                  <div className="text-slate-400 text-xs">{t.route_name || t.distribution_center || '—'}</div>
                </div>
                <div className="text-right">
                  <div className="text-purple-400 font-medium">{formatMoney(t.trip_amount * (new Date(t.loading_date) >= new Date('2026-01-01') ? 1.22 : 1.2))}</div>
                  <div className="text-slate-500 text-xs">{t.distance_km || 0} км</div>
                </div>
              </div>
            ))}
            {(!trips?.wbTrips || trips.wbTrips.length === 0) && (
              <div className="text-slate-500 text-center py-4">Нет рейсов</div>
            )}
          </div>
        </div>

        {/* TRF Trips */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-400" />
            Заявки РФ ({trips?.trfTrips?.length || 0})
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {trips?.trfTrips?.slice(0, 20).map((t: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-2 bg-slate-700/30 rounded-lg text-sm">
                <div>
                  <div className="text-white">{formatDate(t.date)}</div>
                  <div className="text-slate-400 text-xs truncate max-w-[200px]">{t.route || t.contractor_name || '—'}</div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-medium">{formatMoney(t.amount)}</div>
                  <div className="text-slate-500 text-xs">{t.vehicle_number}</div>
                </div>
              </div>
            ))}
            {(!trips?.trfTrips || trips.trfTrips.length === 0) && (
              <div className="text-slate-500 text-center py-4">Нет заявок</div>
            )}
          </div>
        </div>
      </div>

      {/* Reports */}
      {reports && reports.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mt-4">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <Fuel className="w-5 h-5 text-orange-400" />
            Отчёты водителя ({reports.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="pb-2">Период</th>
                  <th className="pb-2">Машина</th>
                  <th className="pb-2 text-right">Расходы</th>
                  <th className="pb-2 text-right">Начисления</th>
                  <th className="pb-2 text-right">Пробег</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {reports.slice(0, 10).map((r: any) => (
                  <tr key={r.id} className="text-slate-300">
                    <td className="py-2">{formatDate(r.date_from)}—{formatDate(r.date_to)}</td>
                    <td className="py-2">{r.vehicle_number}</td>
                    <td className="py-2 text-right text-red-400">{formatMoney(r.total_expenses)}</td>
                    <td className="py-2 text-right text-green-400">{formatMoney(r.driver_accruals)}</td>
                    <td className="py-2 text-right">{r.mileage?.toLocaleString('ru-RU') || 0} км</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
