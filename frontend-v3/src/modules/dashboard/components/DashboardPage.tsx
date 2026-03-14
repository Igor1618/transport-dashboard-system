"use client";

import React, { useState } from "react";
import { GpsSensorWidget } from "@/modules/dashboard/components/GpsSensorWidget";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Truck, FileText, Fuel, DollarSign, Calendar, Package, MapPin, AlertTriangle, Route } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const SHORT_MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function formatMonth(year: number, month: number) {
  return year + '-' + String(month + 1).padStart(2, '0') + '-01';
}

async function fetchStatsByMonth(month: string) {
  const res = await fetch('/rest/v1/vehicle_economics_combined?month=eq.' + month);
  if (!res.ok) throw new Error('API error: ' + res.status);
  return res.json();
}

async function fetchStatsByRange(startDate: string, endDate: string) {
  // Получаем первый день первого месяца и последний день последнего месяца
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
  const endMonth = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`;
  
  // Один запрос с диапазоном месяцев
  const res = await fetch(`/rest/v1/vehicle_economics_combined?month=gte.${startMonth}&month=lte.${endMonth}`);
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  
  // Объединяем данные по машинам
  const vehicleMap: Record<string, any> = {};
  data?.forEach((v: any) => {
    const key = v.vehicle_number;
    if (!key) return;
    if (!vehicleMap[key]) {
      vehicleMap[key] = { ...v };
    } else {
      vehicleMap[key].total_revenue = (vehicleMap[key].total_revenue || 0) + (v.total_revenue || 0);
      vehicleMap[key].wb_revenue = (vehicleMap[key].wb_revenue || 0) + (v.wb_revenue || 0);
      vehicleMap[key].trf_revenue = (vehicleMap[key].trf_revenue || 0) + (v.trf_revenue || 0);
      vehicleMap[key].wb_trips = (vehicleMap[key].wb_trips || 0) + (v.wb_trips || 0);
      vehicleMap[key].trf_trips = (vehicleMap[key].trf_trips || 0) + (v.trf_trips || 0);
      vehicleMap[key].expenses = (vehicleMap[key].expenses || 0) + (v.expenses || 0);
      vehicleMap[key].margin = (vehicleMap[key].margin || 0) + (v.margin || 0);
      vehicleMap[key].fuel_cost = (vehicleMap[key].fuel_cost || 0) + (v.fuel_cost || 0);
      vehicleMap[key].mileage = (vehicleMap[key].mileage || 0) + (v.mileage || 0);
      vehicleMap[key].wb_distance = (vehicleMap[key].wb_distance || 0) + (v.wb_distance || 0);
      vehicleMap[key].wb_penalties = (vehicleMap[key].wb_penalties || 0) + (v.wb_penalties || 0);
    }
  });
  
  return Object.values(vehicleMap);
}

async function fetchMultipleMonths(months: string[]) {
  const results = await Promise.all(months.map(m => fetchStatsByMonth(m)));
  return months.map((m, i) => {
    const data = results[i];
    const stats = data?.reduce(
      (acc: any, v: any) => ({
        wbRevenue: acc.wbRevenue + (v.wb_revenue || 0),
        trfRevenue: acc.trfRevenue + (v.trf_revenue || 0),
        total: acc.total + (v.total_revenue || 0),
      }),
      { wbRevenue: 0, trfRevenue: 0, total: 0 }
    ) || { wbRevenue: 0, trfRevenue: 0, total: 0 };
    
    const [year, month] = m.split('-');
    return {
      month: m,
      name: SHORT_MONTHS[parseInt(month) - 1] + " " + year.slice(2),
      wb: Math.round(stats.wbRevenue / 1000000 * 10) / 10,
      rf: Math.round(stats.trfRevenue / 1000000 * 10) / 10,
      total: Math.round(stats.total / 1000000 * 10) / 10,
    };
  });
}

function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-slate-400 text-xs sm:text-sm">{title}</p>
          <p className={"text-xl sm:text-2xl font-bold mt-1 " + (color || "text-white")}>{value}</p>
          {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className="p-2 sm:p-3 bg-slate-700/50 rounded-lg">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
        </div>
      </div>
    </div>
  );
}

function RevenueCard({ title, value, percent, icon: Icon, color, bgColor }: any) {
  return (
    <div className={"rounded-xl p-4 border " + (bgColor || "bg-slate-800/50 border-slate-700/50")}>
      <div className="flex items-center gap-3">
        <div className={"p-2 rounded-lg " + (bgColor ? "bg-white/20" : "bg-slate-700/50")}>
          <Icon className={"w-5 h-5 " + (color || "text-slate-400")} />
        </div>
        <div className="flex-1">
          <p className="text-slate-300 text-sm">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className={"text-xl font-bold " + (color || "text-white")}>{value}</p>
            {percent !== undefined && (
              <span className="text-slate-400 text-sm">({percent}%)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMoney(n: number) {
  if (!n) return "0 ₽";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + " М ₽";
  if (n >= 1000) return (n / 1000).toFixed(0) + " К ₽";
  return n.toFixed(0) + " ₽";
}

function formatKm(n: number) {
  if (!n) return "0 км";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + " млн км";
  if (n >= 1000) return (n / 1000).toFixed(0) + " тыс км";
  return n.toFixed(0) + " км";
}

const COLORS = { wb: "#a855f7", rf: "#22c55e" };

// GpsSensorWidget вынесен в modules/dashboard/components/GpsSensorWidget.tsx

export function Dashboard() {
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
  
  const month = formatMonth(selectedYear, selectedMonth);

  const years = [];
  for (let y = 2024; y <= now.getFullYear(); y++) {
    years.push(y);
  }

  // Генерируем последние 6 месяцев для графика
  const chartMonths: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(selectedYear, selectedMonth - i, 1);
    chartMonths.push(formatMonth(d.getFullYear(), d.getMonth()));
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats", mode, mode === "month" ? month : `${startDate}-${endDate}`],
    queryFn: () => mode === "month" ? fetchStatsByMonth(month) : fetchStatsByRange(startDate, endDate),
  });

  const { data: chartData } = useQuery({
    queryKey: ["dashboard-chart", chartMonths.join(",")],
    queryFn: () => fetchMultipleMonths(chartMonths),
  });

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setMode("range");
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const stats = data?.reduce(
    (acc: any, v: any) => ({
      revenue: acc.revenue + (v.total_revenue || 0),
      wbRevenue: acc.wbRevenue + (v.wb_revenue || 0),
      trfRevenue: acc.trfRevenue + (v.trf_revenue || 0),
      expenses: acc.expenses + (v.expenses || 0),
      margin: acc.margin + (v.margin || 0),
      trips: acc.trips + (v.trf_trips || 0) + (v.wb_trips || 0),
      wbTrips: acc.wbTrips + (v.wb_trips || 0),
      trfTrips: acc.trfTrips + (v.trf_trips || 0),
      fuel: acc.fuel + (v.fuel_cost || 0),
      mileage: acc.mileage + (v.mileage || 0),
      wbDistance: acc.wbDistance + (v.wb_distance || 0),
      wbPenalties: acc.wbPenalties + (v.wb_penalties || 0),
      vehicles: acc.vehicles + 1,
    }),
    { revenue: 0, wbRevenue: 0, trfRevenue: 0, expenses: 0, margin: 0, trips: 0, wbTrips: 0, trfTrips: 0, fuel: 0, mileage: 0, wbDistance: 0, wbPenalties: 0, vehicles: 0 }
  ) || {};

  const wbPercent = stats.revenue > 0 ? ((stats.wbRevenue / stats.revenue) * 100).toFixed(1) : "0";
  const trfPercent = stats.revenue > 0 ? ((stats.trfRevenue / stats.revenue) * 100).toFixed(1) : "0";

  const pieData = [
    { name: "Wildberries", value: stats.wbRevenue, color: COLORS.wb },
    { name: "РФ Транспорт", value: stats.trfRevenue, color: COLORS.rf },
  ].filter(d => d.value > 0);

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Дашборд</h1>
      </div>

      {/* Period Selector */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-4">
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
      </div>

      {/* GPS Sensor Status Widget */}
      <GpsSensorWidget />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Загрузка данных...</div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <div className="text-red-400">Ошибка загрузки: {String(error)}</div>
        </div>
      ) : (
        <>
          {/* Revenue Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <RevenueCard 
              title="Общая выручка" 
              value={formatMoney(stats.revenue)} 
              icon={DollarSign}
              color="text-blue-400"
              bgColor="bg-blue-500/10 border-blue-500/30"
            />
            <RevenueCard 
              title="Wildberries" 
              value={formatMoney(stats.wbRevenue)} 
              percent={wbPercent}
              icon={Package}
              color="text-purple-400"
              bgColor="bg-purple-500/10 border-purple-500/30"
            />
            <RevenueCard 
              title="РФ Транспорт" 
              value={formatMoney(stats.trfRevenue)} 
              percent={trfPercent}
              icon={MapPin}
              color="text-green-400"
              bgColor="bg-green-500/10 border-green-500/30"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 sm:mb-6">
            <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-white font-medium mb-4">Выручка по месяцам (млн ₽)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData || []} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value: number) => [value + ' М ₽', '']}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8' }} />
                    <Bar dataKey="wb" name="Wildberries" fill={COLORS.wb} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rf" name="РФ Транспорт" fill={COLORS.rf} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-white font-medium mb-4">Структура выручки</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => name + ' ' + (percent * 100).toFixed(0) + '%'}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: number) => formatMoney(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Main Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <StatCard title="Расходы" value={formatMoney(stats.expenses)} icon={Fuel} color="text-yellow-400" />
            <StatCard title="Маржа" value={formatMoney(stats.margin)} icon={TrendingUp} color="text-green-400" />
            <StatCard 
              title="Рейсов всего" 
              value={stats.trips?.toLocaleString("ru-RU") || "0"} 
              subtitle={"ВБ: " + stats.wbTrips + " / РФ: " + stats.trfTrips}
              icon={FileText} 
            />
            <StatCard title="Машин" value={stats.vehicles || 0} icon={Truck} />
          </div>

          {/* WB Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard title="Пробег WB" value={formatKm(stats.wbDistance)} icon={Route} color="text-purple-400" />
            <StatCard title="Штрафы WB" value={formatMoney(stats.wbPenalties)} icon={AlertTriangle} color="text-red-400" />
            <StatCard title="Топливо" value={formatMoney(stats.fuel)} icon={Fuel} color="text-orange-400" />
            <StatCard title="Пробег (отчёты)" value={formatKm(stats.mileage)} icon={Truck} />
          </div>
        </>
      )}
    </div>
  );
}
