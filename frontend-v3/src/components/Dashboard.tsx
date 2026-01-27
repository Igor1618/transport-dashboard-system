"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Truck, FileText, Fuel, DollarSign } from "lucide-react";

async function fetchStats() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  
  const res = await fetch(`/rest/v1/vehicle_economics_combined?month=eq.${month}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-slate-400 text-xs sm:text-sm">{title}</p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 ${color || "text-white"}`}>{value}</p>
        </div>
        <div className="p-2 sm:p-3 bg-slate-700/50 rounded-lg">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
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

export function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchStats,
  });

  const stats = data?.reduce(
    (acc: any, v: any) => ({
      revenue: acc.revenue + (v.total_revenue || 0),
      expenses: acc.expenses + (v.expenses || 0),
      margin: acc.margin + (v.margin || 0),
      trips: acc.trips + (v.trf_trips || 0) + (v.wb_trips || 0),
      fuel: acc.fuel + (v.fuel_cost || 0),
      mileage: acc.mileage + (v.mileage || 0),
      vehicles: acc.vehicles + 1,
    }),
    { revenue: 0, expenses: 0, margin: 0, trips: 0, fuel: 0, mileage: 0, vehicles: 0 }
  ) || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Загрузка данных...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
        <div className="text-red-400">Ошибка загрузки: {String(error)}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Дашборд</h1>
        <p className="text-slate-400 text-sm">
          Экономика автопарка • {new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Main Stats - 2x2 on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatCard 
          title="Выручка" 
          value={formatMoney(stats.revenue)} 
          icon={DollarSign}
          color="text-blue-400"
        />
        <StatCard 
          title="Расходы" 
          value={formatMoney(stats.expenses)} 
          icon={Fuel}
          color="text-yellow-400"
        />
        <StatCard 
          title="Маржа" 
          value={formatMoney(stats.margin)} 
          icon={TrendingUp}
          color="text-green-400"
        />
        <StatCard 
          title="Рейсов" 
          value={stats.trips?.toLocaleString("ru-RU") || "0"} 
          icon={FileText}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard 
          title="Машин" 
          value={stats.vehicles || 0} 
          icon={Truck}
        />
        <StatCard 
          title="Топливо" 
          value={formatMoney(stats.fuel)} 
          icon={Fuel}
          color="text-red-400"
        />
        <StatCard 
          title="Пробег" 
          value={stats.mileage > 0 ? (stats.mileage / 1000).toFixed(0) + " тыс" : "0"} 
          icon={Truck}
        />
      </div>
    </div>
  );
}
