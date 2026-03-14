"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Search, Calendar, Users, TrendingUp, AlertTriangle, Route, Trophy, Star } from "lucide-react";
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
  const [showAll, setShowAll] = useState(false);
  const [allDrivers, setAllDrivers] = useState<any[]>([]);
  useEffect(() => {
    if (showAll) {
      fetch("/api/drivers-ext/all").then(r => r.json()).then(setAllDrivers).catch(() => {});
    }
  }, [showAll]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<"list" | "rating">("list");
  const [ratingData, setRatingData] = useState<any>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  
  const [showArchived, setShowArchived] = useState(false);
  const [driverStatuses, setDriverStatuses] = useState<Record<string, string>>({});

  const { user, effectiveRole } = useAuth();
  const isReadOnly = ["logist"].includes(effectiveRole);
  const isAccountant = user?.role === "accountant";

  const month = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  
  const years = [];
  for (let y = 2023; y <= now.getFullYear(); y++) {
    years.push(y);
  }

  // Загружаем статусы водителей
  useEffect(() => {
    fetch("/rest/v1/drivers?select=full_name,status")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          data.forEach((d: any) => { if (d.full_name) map[d.full_name] = d.status || 'active'; });
          setDriverStatuses(map);
        }
      })
      .catch(() => {});
  }, []);

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
    // Фильтр по статусу: по умолчанию active + reserve, с кнопкой показать архив
    const driverStatus = driverStatuses[d.driver_name] || 'active';
    if (!showArchived && driverStatus === 'archived') return false;
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
        <div className="flex gap-2 ml-4">
          <button onClick={() => setShowAll(false)} className={`px-3 py-1.5 rounded text-sm font-medium ${!showAll ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>За период</button>
          <button onClick={() => setShowAll(true)} className={`px-3 py-1.5 rounded text-sm font-medium ${showAll ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>Все водители ({allDrivers.length})</button>
        </div>
        <p className="text-slate-400 text-sm">Экономика по каждому водителю</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("list")} className={`px-4 py-2 rounded-lg font-medium transition-colors ${tab === "list" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"}`}>
          👤 Список
        </button>
        <button onClick={() => {
          setTab("rating");
          if (!ratingData) {
            setRatingLoading(true);
            const m = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
            fetch(`/api/drivers-ext/rating?month=${m}`).then(r => r.json()).then(d => { setRatingData(d); setRatingLoading(false); });
          }
        }} className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${tab === "rating" ? "bg-yellow-600 text-white" : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"}`}>
          🏆 Рейтинг
        </button>
      </div>

      {tab === "rating" && (
        <div className="space-y-4 mb-4">
          {ratingLoading ? (
            <div className="text-center py-8 text-slate-400">Загрузка рейтинга...</div>
          ) : ratingData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <div className="text-slate-400 text-xs">Водителей</div>
                  <div className="text-xl font-bold text-white">{ratingData.summary.total}</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <div className="text-slate-400 text-xs">Средний рейтинг</div>
                  <div className="text-xl font-bold text-blue-400">{ratingData.summary.avg_rating}/100</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-green-500/30">
                  <div className="text-slate-400 text-xs">🟢 Отличные (80+)</div>
                  <div className="text-xl font-bold text-green-400">{ratingData.summary.excellent}</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-red-500/30">
                  <div className="text-slate-400 text-xs">🔴 Низкие (&lt;60)</div>
                  <div className="text-xl font-bold text-red-400">{ratingData.summary.poor}</div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="text-left p-3 text-slate-400">#</th>
                        <th className="text-left p-3 text-slate-400">Водитель</th>
                        <th className="text-center p-3 text-slate-400">Рейтинг</th>
                        <th className="text-center p-3 text-slate-400 hidden md:table-cell">Расход</th>
                        <th className="text-center p-3 text-slate-400 hidden md:table-cell">₽/км</th>
                        <th className="text-right p-3 text-slate-400 hidden lg:table-cell">Рейсов</th>
                        <th className="text-right p-3 text-slate-400">Пробег</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ratingData.drivers.map((d: any, i: number) => (
                        <tr key={d.driver_name} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3 text-slate-500">{i + 1}</td>
                          <td className="p-3">
                            <div className="text-white font-medium">{d.driver_name}</div>
                            <div className="text-slate-500 text-xs">{d.vehicle_number}</div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-bold ${
                              d.rating >= 80 ? 'bg-green-500/20 text-green-400' :
                              d.rating >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {d.rating >= 80 ? '⭐' : d.rating >= 60 ? '✅' : '❌'} {d.rating}
                            </span>
                          </td>
                          <td className="p-3 text-center hidden md:table-cell">
                            <span className={d.consumption <= 28 ? 'text-green-400' : d.consumption <= 35 ? 'text-yellow-400' : 'text-red-400'}>
                              {d.consumption} л/100
                            </span>
                          </td>
                          <td className="p-3 text-center hidden md:table-cell text-slate-300">{d.revenue_per_km}</td>
                          <td className="p-3 text-right hidden lg:table-cell text-slate-300">{d.trip_count}</td>
                          <td className="p-3 text-right text-slate-300">{d.total_mileage.toLocaleString('ru-RU')} км</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {tab === "list" && <>
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
          
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${showArchived ? 'bg-slate-700 text-white border-slate-500' : 'bg-transparent text-slate-500 border-slate-700 hover:text-slate-300'}`}
          >
            {showArchived ? '🗂 Скрыть архив' : '📁 Показать архив'}
          </button>
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

          {showAll ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 sticky top-0"><tr>
                  <th className="p-3 text-left text-slate-300 font-medium">Водитель</th>
                  <th className="p-3 text-left text-slate-300 font-medium">Последняя машина</th>
                  <th className="p-3 text-left text-slate-300 font-medium">Последний отчёт</th>
                  <th className="p-3 text-right text-slate-300 font-medium">Отчётов</th>
                </tr></thead>
                <tbody>
                  {allDrivers.filter((d: any) => !search || d.driver_name?.toLowerCase().includes(search.toLowerCase())).map((d: any, i: number) => (
                    <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/50">
                      <td className="p-3 text-white font-medium">{d.driver_name}</td>
                      <td className="p-3 text-slate-300 font-mono">{d.last_vehicle || "—"}</td>
                      <td className="p-3 text-slate-400">{d.last_report ? new Date(d.last_report).toLocaleDateString("ru-RU") : "—"}</td>
                      <td className="p-3 text-right text-slate-400">{d.report_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 text-slate-500 text-xs border-t border-slate-700">{allDrivers.length} водителей</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Нет данных за выбранный период</div>
          ) : null}
          
          <div className="mt-4 text-center text-slate-500 text-sm">
            Всего: {filtered.length} водителей
          </div>
        </>
      )}
    </>}
    </div>
  );
}
