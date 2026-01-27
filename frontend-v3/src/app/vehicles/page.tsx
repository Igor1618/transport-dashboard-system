"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Filter } from "lucide-react";

async function fetchVehicles(month: string) {
  const res = await fetch(`/rest/v1/vehicle_economics_combined?month=eq.${month}&order=margin.desc`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function formatMoney(n: number) {
  if (!n) return "0 ₽";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "М";
  if (n >= 1000) return (n / 1000).toFixed(0) + "К";
  return n.toFixed(0) + " ₽";
}

export default function VehiclesPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles", month],
    queryFn: () => fetchVehicles(month),
  });

  const filtered = vehicles.filter((v: any) => {
    if (!v.vehicle_number) return false;
    if (search && !v.vehicle_number.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "trf" && !v.trf_trips) return false;
    if (filter === "wb" && !v.wb_trips) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Машины</h1>
        <p className="text-slate-400 text-sm">Экономика по каждой машине</p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border ${showFilters ? 'bg-blue-600 border-blue-600' : 'bg-slate-800 border-slate-700'}`}
          >
            <Filter className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {showFilters && (
          <div className="flex gap-2 flex-wrap">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="all">Все</option>
              <option value="trf">ТРФ</option>
              <option value="wb">ВБ</option>
            </select>
            <input
              type="month"
              value={month.slice(0, 7)}
              onChange={(e) => setMonth(e.target.value + "-01")}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-8">Загрузка...</div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="lg:hidden space-y-2">
            {filtered.map((v: any) => (
              <Link 
                key={v.vehicle_number}
                href={`/vehicles/${encodeURIComponent(v.vehicle_number)}`}
                className="block bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 active:bg-slate-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white text-sm">{v.vehicle_number}</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Выручка</span>
                    <p className="text-blue-400 font-medium">{formatMoney(v.total_revenue)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Маржа</span>
                    <p className={`font-medium ${v.margin >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatMoney(v.margin)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Рейсы</span>
                    <p className="text-white font-medium">
                      {(v.trf_trips || 0) + (v.wb_trips || 0)}
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Машина</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">ТРФ</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">ВБ</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Выручка</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Расходы</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Маржа</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filtered.map((v: any) => (
                    <tr key={v.vehicle_number} className="hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{v.vehicle_number}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{v.trf_trips || 0}</td>
                      <td className="px-4 py-3 text-right text-purple-400">{v.wb_trips || 0}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{formatMoney(v.total_revenue)}</td>
                      <td className="px-4 py-3 text-right text-yellow-400">{formatMoney(v.expenses)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${v.margin >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {formatMoney(v.margin)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/vehicles/${encodeURIComponent(v.vehicle_number)}`} className="text-slate-400 hover:text-white">
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
            Всего: {filtered.length} машин
          </div>
        </>
      )}
    </div>
  );
}
