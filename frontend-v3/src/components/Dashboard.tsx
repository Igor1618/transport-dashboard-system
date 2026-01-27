"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Truck, Users, FileText, Fuel } from "lucide-react";

const SUPABASE_URL = "https://pqvtvocsqhazaraknvnz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdnR2b2NzcWhemFyYWtudm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE2NjkxMDcsImV4cCI6MjA0NzI0NTEwN30.f3qnR6VfPvNjWiMfCPLiPbHr4UkPK8eDHzBxbRNJvXw";

async function fetchStats() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/vehicle_economics_combined?month=eq.${month}`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return res.json();
}

function StatCard({ title, value, subtitle, icon: Icon, trend, color }: any) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color || "text-white"}`}>{value}</p>
          {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className="p-2 bg-slate-700 rounded-lg">
          <Icon className="w-5 h-5 text-slate-400" />
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-3 text-sm ${trend > 0 ? "text-green-500" : "text-red-500"}`}>
          {trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{Math.abs(trend)}% к прошлому месяцу</span>
        </div>
      )}
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
  const { data, isLoading } = useQuery({
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
    return <div className="text-slate-400">Загрузка...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Дашборд</h1>
        <p className="text-slate-400">Общая экономика автопарка</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Выручка" 
          value={formatMoney(stats.revenue)} 
          icon={TrendingUp}
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
          value={stats.trips?.toLocaleString("ru-RU")} 
          icon={FileText}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Машин активно" 
          value={stats.vehicles} 
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
          value={(stats.mileage / 1000).toFixed(0) + " тыс км"} 
          icon={Truck}
        />
      </div>
    </div>
  );
}
