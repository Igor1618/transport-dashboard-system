"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Filter, Search } from "lucide-react";

const SUPABASE_URL = "https://pqvtvocsqhazaraknvnz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdnR2b2NzcWhemFyYWtudm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE2NjkxMDcsImV4cCI6MjA0NzI0NTEwN30.f3qnR6VfPvNjWiMfCPLiPbHr4UkPK8eDHzBxbRNJvXw";

async function fetchVehicles(month: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/vehicle_economics_combined?month=eq.${month}&order=margin.desc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return res.json();
}

function formatMoney(n: number) {
  if (!n) return "0 ₽";
  return n.toLocaleString("ru-RU") + " ₽";
}

export default function VehiclesPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, trf, wb

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Машины</h1>
        <p className="text-slate-400">Экономика по каждой машине</p>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
        >
          <option value="all">Все</option>
          <option value="trf">Только ТРФ</option>
          <option value="wb">Только ВБ</option>
        </select>

        <input
          type="month"
          value={month.slice(0, 7)}
          onChange={(e) => setMonth(e.target.value + "-01")}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
        />
      </div>

      {isLoading ? (
        <div className="text-slate-400">Загрузка...</div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
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
                  <td className="px-4 py-3 text-right text-slate-300">
                    {v.trf_trips || 0} рейсов
                  </td>
                  <td className="px-4 py-3 text-right text-purple-400">
                    {v.wb_trips || 0} рейсов
                  </td>
                  <td className="px-4 py-3 text-right text-blue-400">
                    {formatMoney(v.total_revenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-yellow-400">
                    {formatMoney(v.expenses)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${v.margin >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {formatMoney(v.margin)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link 
                      href={`/vehicles/${encodeURIComponent(v.vehicle_number)}`}
                      className="text-slate-400 hover:text-white"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
