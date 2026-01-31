"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Fuel, Truck, MapPin, Wallet, Users, Package, Calendar, TrendingUp } from "lucide-react";
import { useState } from "react";

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

async function safeFetch(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function fetchVehicleData(vehicleNumber: string, startDate: string, endDate: string) {
  const monthStart = startDate.substring(0, 7) + "-01";

  const [economics, contracts, trips, reports] = await Promise.all([
    safeFetch(`/rest/v1/vehicle_economics_combined?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&month=gte.${startDate.substring(0,7)}-01&month=lte.${endDate.substring(0,7)}-01`),
    safeFetch(`/rest/v1/contracts?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&date=gte.${startDate}&date=lte.${endDate}T23:59:59&order=date.desc&limit=100`),
    safeFetch(`/rest/v1/trips?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&loading_date=gte.${startDate}&loading_date=lte.${endDate}&order=loading_date.desc&limit=200`),
    safeFetch(`/rest/v1/driver_reports_normalized?vehicle_number_normalized=eq.${encodeURIComponent(vehicleNumber)}&date_from=gte.${startDate}&date_from=lte.${endDate}&order=date_from.desc&limit=200`),
  ]);
  
  // Агрегируем economics если несколько месяцев
  const eco = economics.reduce((acc: any, e: any) => ({
    total_revenue: (acc.total_revenue || 0) + (e.total_revenue || 0),
    wb_revenue: (acc.wb_revenue || 0) + (e.wb_revenue || 0),
    trf_revenue: (acc.trf_revenue || 0) + (e.trf_revenue || 0),
    wb_trips: (acc.wb_trips || 0) + (e.wb_trips || 0),
    trf_trips: (acc.trf_trips || 0) + (e.trf_trips || 0),
    expenses: (acc.expenses || 0) + (e.expenses || 0),
    margin: (acc.margin || 0) + (e.margin || 0),
    mileage: (acc.mileage || 0) + (e.mileage || 0),
    fuel_cost: (acc.fuel_cost || 0) + (e.fuel_cost || 0),
  }), {});
  
  // Суммы из отчётов
  const reportsTotals = reports.reduce((acc: any, r: any) => ({
    expenses: (acc.expenses || 0) + (r.total_expenses || 0),
    accruals: (acc.accruals || 0) + (r.driver_accruals || 0),
    mileage: (acc.mileage || 0) + (r.mileage || 0),
  }), {});
  
  return { economics: eco, contracts, trips, reports, reportsTotals };
}

function formatMoney(n: number): string {
  if (!n) return "0 ₽";
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + "M ₽";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + "К ₽";
  return n.toLocaleString("ru-RU") + " ₽";
}

function formatDate(d: string): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ru-RU");
}

export default function VehiclePage() {
  const params = useParams();
  const vehicleNumber = decodeURIComponent(params.id as string);
  const now = new Date();
  
  const [mode, setMode] = useState<"month" | "range">("month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()}`);

  const years = [];
  for (let y = 2023; y <= now.getFullYear(); y++) years.push(y);

  // Вычисляем даты для запроса
  let qStart: string, qEnd: string;
  if (mode === "month") {
    qStart = `${selectedYear}-${String(selectedMonth+1).padStart(2,"0")}-01`;
    const lastDay = new Date(selectedYear, selectedMonth+1, 0).getDate();
    qEnd = `${selectedYear}-${String(selectedMonth+1).padStart(2,"0")}-${lastDay}`;
  } else {
    qStart = startDate;
    qEnd = endDate;
  }

  const { data, isLoading } = useQuery({
    queryKey: ["vehicle", vehicleNumber, qStart, qEnd],
    queryFn: () => fetchVehicleData(vehicleNumber, qStart, qEnd),
  });

  if (isLoading) return <div className="p-6 text-slate-400">Загрузка...</div>;

  const eco = data?.economics || {};
  const rt = data?.reportsTotals || {};
  const totalRevenue = eco.total_revenue || 0;
  const expenses = rt.expenses || eco.expenses || 0;
  const accruals = rt.accruals || 0;
  const mileage = rt.mileage || eco.mileage || 0;
  const margin = totalRevenue - expenses;

  const drivers = data?.reports 
    ? [...new Set((data.reports as any[]).map((r) => r.driver_name).filter(Boolean))] as string[]
    : [];
  const wbDrivers = data?.trips
    ? [...new Set((data.trips as any[]).map((t) => t.driver_name).filter(Boolean))] as string[]
    : [];
  const allDrivers = [...new Set([...drivers, ...wbDrivers])] as string[];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Link href="/vehicles" className="flex items-center gap-2 text-slate-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Назад к списку
      </Link>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-400" />
            {vehicleNumber}
          </h1>
          <p className="text-slate-400">Детальная статистика машины</p>
        </div>
      </div>

      {/* Переключатель периода */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-700 rounded-lg p-1">
            <button onClick={() => setMode("month")} className={`px-3 py-1 rounded text-sm ${mode === "month" ? "bg-blue-600 text-white" : "text-slate-400"}`}>
              По месяцу
            </button>
            <button onClick={() => setMode("range")} className={`px-3 py-1 rounded text-sm ${mode === "range" ? "bg-blue-600 text-white" : "text-slate-400"}`}>
              По датам
            </button>
          </div>
          
          {mode === "month" ? (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-slate-700 text-white rounded px-2 py-1 text-sm">
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-slate-700 text-white rounded px-2 py-1 text-sm">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-700 text-white rounded px-2 py-1 text-sm" />
              <span className="text-slate-400">—</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-700 text-white rounded px-2 py-1 text-sm" />
            </div>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Общая выручка</p>
          <p className="text-xl font-bold text-blue-400">{formatMoney(totalRevenue)}</p>
          <p className="text-slate-500 text-xs">{(eco.wb_trips||0) + (eco.trf_trips||0)} рейсов</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Расходы</p>
          <p className="text-xl font-bold text-red-400">{formatMoney(expenses)}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Начисления водит.</p>
          <p className="text-xl font-bold text-green-400">{formatMoney(accruals)}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Маржа</p>
          <p className={`text-xl font-bold ${margin >= 0 ? "text-green-400" : "text-red-400"}`}>{formatMoney(margin)}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Пробег</p>
          <p className="text-xl font-bold text-cyan-400">{mileage?.toLocaleString() || 0} км</p>
        </div>
      </div>

      {/* WB + РФ блоки */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800 rounded-xl p-4 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-purple-400" />
            <span className="text-white font-medium">Wildberries</span>
          </div>
          <div className="flex justify-between">
            <div><p className="text-slate-400 text-sm">Выручка</p><p className="text-purple-400 font-bold">{formatMoney(eco.wb_revenue || 0)}</p></div>
            <div><p className="text-slate-400 text-sm">Рейсов</p><p className="text-white font-bold">{eco.wb_trips || 0}</p></div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-green-400" />
            <span className="text-white font-medium">РФ Транспорт</span>
          </div>
          <div className="flex justify-between">
            <div><p className="text-slate-400 text-sm">Выручка</p><p className="text-green-400 font-bold">{formatMoney(eco.trf_revenue || 0)}</p></div>
            <div><p className="text-slate-400 text-sm">Рейсов</p><p className="text-white font-bold">{eco.trf_trips || 0}</p></div>
          </div>
        </div>
      </div>

      {/* Водители */}
      {allDrivers.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Водители ({allDrivers.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {allDrivers.map((name, i) => (
              <span key={i} className="bg-slate-700 px-3 py-1 rounded-lg text-slate-300 text-sm">{name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Отчёты водителей */}
      {data?.reports && data.reports.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-red-400" />
            Отчёты водителей ({data.reports.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-2">Период</th>
                  <th className="text-left py-2 px-2">Водитель</th>
                  <th className="text-right py-2 px-2">Расходы</th>
                  <th className="text-right py-2 px-2">Начисления</th>
                  <th className="text-right py-2 px-2">Пробег</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-2 text-slate-300">{formatDate(r.date_from)} — {formatDate(r.date_to)}</td>
                    <td className="py-2 px-2 text-slate-300">{r.driver_name || "—"}</td>
                    <td className="py-2 px-2 text-red-400 text-right">{formatMoney(r.total_expenses)}</td>
                    <td className="py-2 px-2 text-green-400 text-right">{formatMoney(r.driver_accruals)}</td>
                    <td className="py-2 px-2 text-slate-400 text-right">{r.mileage?.toLocaleString() || 0} км</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WB Рейсы */}
      {data?.trips && data.trips.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-400" />
            Рейсы Wildberries ({data.trips.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-2">Дата</th>
                  <th className="text-left py-2 px-2">Маршрут</th>
                  <th className="text-left py-2 px-2">Водитель</th>
                  <th className="text-right py-2 px-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {data.trips.slice(0, 30).map((trip: any, i: number) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-2 text-slate-300">{formatDate(trip.loading_date)}</td>
                    <td className="py-2 px-2 text-slate-300 truncate max-w-[200px]">{trip.route_name || "-"}</td>
                    <td className="py-2 px-2 text-slate-300">{trip.driver_name || "-"}</td>
                    <td className="py-2 px-2 text-purple-400 text-right">{formatMoney(trip.trip_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.trips.length > 30 && <p className="text-slate-500 text-sm mt-2 text-center">Показано 30 из {data.trips.length}</p>}
          </div>
        </div>
      )}

      {/* РФ Заявки */}
      {data?.contracts && data.contracts.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-400" />
            Заявки РФ Транспорт ({data.contracts.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-2">Дата</th>
                  <th className="text-left py-2 px-2">Маршрут</th>
                  <th className="text-left py-2 px-2">Заказчик</th>
                  <th className="text-right py-2 px-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {data.contracts.slice(0, 30).map((c: any, i: number) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-2 text-slate-300">{formatDate(c.date)}</td>
                    <td className="py-2 px-2 text-slate-300 truncate max-w-[200px]">{c.route || "-"}</td>
                    <td className="py-2 px-2 text-slate-300">{c.contractor_name || "-"}</td>
                    <td className="py-2 px-2 text-green-400 text-right">{formatMoney(c.amount)}</td>
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
