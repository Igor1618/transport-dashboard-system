"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Calendar, Users, TrendingUp, AlertTriangle, Route } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

async function fetchDriversByMonth(month: string) {
  const res = await fetch(`/rest/v1/driver_economics_combined?month=eq.${month}&order=total_revenue.desc`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function fetchDriversByRange(startDate: string, endDate: string) {
  // Один запрос с диапазоном месяцев
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
  const endMonth = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`;
  
  const res = await fetch(`/rest/v1/driver_economics_combined?month=gte.${startMonth}&month=lte.${endMonth}`);
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  
  // Объединяем данные по водителям
  const driverMap: Record<string, any> = {};
  data?.forEach((d: any) => {
    const key = d.driver_name || 'unknown';
    if (!driverMap[key]) {
      driverMap[key] = { ...d };
    } else {
      driverMap[key].total_revenue = (driverMap[key].total_revenue || 0) + (d.total_revenue || 0);
      driverMap[key].trf_revenue = (driverMap[key].trf_revenue || 0) + (d.trf_revenue || 0);
      driverMap[key].wb_revenue = (driverMap[key].wb_revenue || 0) + (d.wb_revenue || 0);
      driverMap[key].wb_trips = (driverMap[key].wb_trips || 0) + (d.wb_trips || 0);
      driverMap[key].trf_trips = (driverMap[key].trf_trips || 0) + (d.trf_trips || 0);
      driverMap[key].expenses = (driverMap[key].expenses || 0) + (d.expenses || 0);
      driverMap[key].margin = (driverMap[key].margin || 0) + (d.margin || 0);
      driverMap[key].wb_penalties = (driverMap[key].wb_penalties || 0) + (d.wb_penalties || 0);
      driverMap[key].mileage = (driverMap[key].mileage || 0) + (d.mileage || 0);
    }
  });
  
  return Object.values(driverMap).sort((a: any, b: any) => (b.total_revenue || 0) - (a.total_revenue || 0));
}

function formatMoney(n: number) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "М";
  if (n >= 1000) return (n / 1000).toFixed(0) + "К";
  return n.toFixed(0);
}

function formatKm(n: number) {
  if (!n) return "0";
  if (n >= 1000) return (n / 1000).toFixed(0) + " тыс";
  return n.toFixed(0);
}

export default function DriversPage() {
  const now = new Date();
  const [mode, setMode] = useState<"month" | "range">("month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [startDate, setStartDate] = useState(() => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  
  const { user } = useAuth();
  const isAccountant = user?.role === "accountant";

  const month = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  
  const years = [];
  for (let y = 2023; y <= now.getFullYear(); y++) {
    years.push(y);
  }

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers", mode, mode === "month" ? month : `${startDate}-${endDate}`],
    queryFn: () => mode === "month" ? fetchDriversByMonth(month) : fetchDriversByRange(startDate, endDate),
  });

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setMode("range");
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const filtered = drivers.filter((d: any) => {
    if (!d.driver_name) return false;
    if (search && !d.driver_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "trf" && !d.trf_trips) return false;
    if (filter === "wb" && !d.wb_trips) return false;
    return true;
  });

  // Статистика
  const totals = filtered.reduce((acc: any, d: any) => ({
    revenue: acc.revenue + (d.total_revenue || 0),
    margin: acc.margin + (d.margin || 0),
    trips: acc.trips + (d.trf_trips || 0) + (d.wb_trips || 0),
    penalties: acc.penalties + (d.wb_penalties || 0),
    mileage: acc.mileage + (d.mileage || 0),
  }), { revenue: 0, margin: 0, trips: 0, penalties: 0, mileage: 0 });

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Водители</h1>
        <p className="text-slate-400 text-sm">Экономика по каждому водителю</p>
      </div>

      {/* Period Selector */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-4">
        {/* Mode toggle */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex bg-slate-900 rounded-lg p-1">
            <button
              onClick={() => setMode("month")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${mode === "month" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              По месяцу
            </button>
            <button
              onClick={() => setMode("range")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${mode === "range" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
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
          
          <div className="flex-1" />
          
          {/* Filter buttons */}
          <div className="flex bg-slate-900 rounded-lg p-1">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded text-sm transition ${filter === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Все
            </button>
            <button
              onClick={() => setFilter("trf")}
              className={`px-3 py-1 rounded text-sm transition ${filter === "trf" ? "bg-green-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              РФ
            </button>
            <button
              onClick={() => setFilter("wb")}
              className={`px-3 py-1 rounded text-sm transition ${filter === "wb" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              WB
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="w-5 h-5 text-slate-400" />
          
          {mode === "month" ? (
            <>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
              >
                {MONTHS.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <span className="text-slate-400 text-sm">с</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
              />
              <span className="text-slate-400 text-sm">по</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
              />
            </>
          )}
        </div>
        
        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по ФИО..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
          <div className="text-slate-400 text-xs">Водителей</div>
          <div className="text-white font-bold flex items-center justify-center gap-1">
            <Users className="w-4 h-4" />
            {filtered.length}
          </div>
        </div>
        {!isAccountant && (
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
            <div className="text-slate-400 text-xs">Выручка</div>
            <div className="text-blue-400 font-bold">{formatMoney(totals.revenue)} ₽</div>
          </div>
        )}
        {!isAccountant && (
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
            <div className="text-slate-400 text-xs">Маржа</div>
            <div className={`font-bold ${totals.margin >= 0 ? "text-green-400" : "text-red-400"}`}>{formatMoney(totals.margin)} ₽</div>
          </div>
        )}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
          <div className="text-slate-400 text-xs">Рейсов</div>
          <div className="text-white font-bold">{totals.trips}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
          <div className="text-slate-400 text-xs">Штрафы WB</div>
          <div className="text-red-400 font-bold">{formatMoney(totals.penalties)} ₽</div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-8">Загрузка...</div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="lg:hidden space-y-2">
            {filtered.map((d: any, idx: number) => (
              <Link 
                key={d.driver_name || idx}
                href={`/drivers/${encodeURIComponent(d.driver_name || '')}`}
                className="block bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 active:bg-slate-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white text-sm truncate flex-1">{d.driver_name || 'Без имени'}</span>
                  <div className="flex items-center gap-2">
                    {d.trf_trips > 0 && <span className="text-xs bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">РФ</span>}
                    {d.wb_trips > 0 && <span className="text-xs bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded">WB</span>}
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
                <div className={`grid ${isAccountant ? "grid-cols-2" : "grid-cols-4"} gap-2 text-xs`}>
                  {!isAccountant && (
                    <div>
                      <span className="text-slate-500">Выручка</span>
                      <p className="text-blue-400 font-medium">{formatMoney(d.total_revenue)}</p>
                    </div>
                  )}
                  {!isAccountant && (
                    <div>
                      <span className="text-slate-500">Маржа</span>
                      <p className={`font-medium ${d.margin >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {formatMoney(d.margin)}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Рейсов</span>
                    <p className="text-white font-medium">
                      {(d.trf_trips || 0) + (d.wb_trips || 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Штрафы</span>
                    <p className="text-red-400 font-medium">
                      {d.wb_penalties > 0 ? formatMoney(d.wb_penalties) : '—'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Водитель</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Тип</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Рейсов</th>
                    {!isAccountant && <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Выручка</th>}
                    {!isAccountant && <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Расходы</th>}
                    {!isAccountant && <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Маржа</th>}
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Штрафы</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Пробег</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filtered.map((d: any, idx: number) => (
                    <tr key={d.driver_name || idx} className="hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{d.driver_name || 'Без имени'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          {d.trf_trips > 0 && <span className="text-xs bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">РФ:{d.trf_trips}</span>}
                          {d.wb_trips > 0 && <span className="text-xs bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded">WB:{d.wb_trips}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{(d.trf_trips || 0) + (d.wb_trips || 0)}</td>
                      {!isAccountant && <td className="px-4 py-3 text-right text-blue-400">{formatMoney(d.total_revenue)}</td>}
                      {!isAccountant && <td className="px-4 py-3 text-right text-yellow-400">{formatMoney(d.expenses)}</td>}
                      {!isAccountant && (
                        <td className={`px-4 py-3 text-right font-medium ${d.margin >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {formatMoney(d.margin)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right text-red-400">
                        {d.wb_penalties > 0 ? formatMoney(d.wb_penalties) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {d.mileage > 0 ? formatKm(d.mileage) + ' км' : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/drivers/${encodeURIComponent(d.driver_name || '')}`} className="text-slate-400 hover:text-white">
                          <ChevronRight className="w-5 h-5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-400">Нет данных за выбранный период</div>
          )}
          
          <div className="mt-4 text-center text-slate-500 text-sm">
            Всего: {filtered.length} водителей
          </div>
        </>
      )}
    </div>
  );
}
