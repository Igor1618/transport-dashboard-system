"use client";
import { useState, useEffect } from "react";
import { apiFetchJson } from "@/shared/utils/apiFetch";

interface FuelRow {
  id: string; plate: string; tonnage: string; vehicle_type: string;
  report_km: number; gps_km: number; best_km: number;
  norm_per_100km: number; calculated_fuel: number; actual_fuel: number;
  fuel_purchased: number; discrepancy_pct: number | null; status: string;
}
interface Summary { total: number; flags: number; ok: number; no_data: number; top_flags: { plate: string; discrepancy: number }[]; }

function fmt(n: number) { return n > 0 ? Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : "—"; }

export default function FuelComparisonPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<FuelRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "flag" | "ok">("all");

  useEffect(() => {
    setLoading(true);
    apiFetchJson(`/api/fuel/comparison?month=${month}`)
      .then((d: any) => { setData(d.data || []); setSummary(d.summary || null); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month]);

  const filtered = data.filter(r => filter === "all" || r.status === filter);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">⛽ Расход топлива: GPS vs Отчёт</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white" />
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-slate-400 text-xs">Всего машин</div>
            <div className="text-2xl font-bold text-white">{summary.total}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-red-500/30">
            <div className="text-slate-400 text-xs">🔴 Флагов (&gt;15%)</div>
            <div className="text-2xl font-bold text-red-400">{summary.flags}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-slate-400 text-xs">🟢 В норме</div>
            <div className="text-2xl font-bold text-green-400">{summary.ok}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-slate-400 text-xs">Нет данных</div>
            <div className="text-2xl font-bold text-slate-500">{summary.no_data}</div>
          </div>
        </div>
      )}

      {summary && summary.flags > 0 && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold mb-2">⚠️ Топ расхождений</h3>
          <div className="flex flex-wrap gap-3">
            {summary.top_flags.map(f => (
              <span key={f.plate} className="bg-red-900/40 px-3 py-1 rounded text-sm text-red-300">
                {f.plate}: <strong>{f.discrepancy > 0 ? "+" : ""}{f.discrepancy}%</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(["all", "flag", "ok"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm ${filter === f ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
            {f === "all" ? "Все" : f === "flag" ? "🔴 Флаги" : "🟢 В норме"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">Загрузка...</div>
      ) : (
        <div className="bg-slate-800 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr className="text-slate-400 text-xs">
                <th className="px-3 py-2 text-left">Машина</th>
                <th className="px-3 py-2 text-center">Тонн</th>
                <th className="px-3 py-2 text-right">Пробег отч.</th>
                <th className="px-3 py-2 text-right">Пробег GPS</th>
                <th className="px-3 py-2 text-right">Норма л/100</th>
                <th className="px-3 py-2 text-right">Расч. расход</th>
                <th className="px-3 py-2 text-right">Факт. расход</th>
                <th className="px-3 py-2 text-right">Закупл. топл.</th>
                <th className="px-3 py-2 text-right">Расхождение</th>
                <th className="px-3 py-2 text-center">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtered.map(r => (
                <tr key={r.id} className={`hover:bg-slate-700/30 ${r.status === "flag" ? "bg-red-900/10" : ""}`}>
                  <td className="px-3 py-2 font-mono text-white">{r.plate}</td>
                  <td className="px-3 py-2 text-center text-slate-400">{r.tonnage}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{fmt(r.report_km)}</td>
                  <td className="px-3 py-2 text-right text-cyan-400">{fmt(r.gps_km)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{r.norm_per_100km}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{fmt(r.calculated_fuel)} л</td>
                  <td className="px-3 py-2 text-right text-yellow-400">{fmt(r.actual_fuel)} л</td>
                  <td className="px-3 py-2 text-right text-slate-400">{fmt(r.fuel_purchased)} л</td>
                  <td className={`px-3 py-2 text-right font-bold ${
                    r.discrepancy_pct === null ? "text-slate-600" :
                    Math.abs(r.discrepancy_pct) > 15 ? "text-red-400" :
                    Math.abs(r.discrepancy_pct) > 10 ? "text-yellow-400" : "text-green-400"
                  }`}>
                    {r.discrepancy_pct !== null ? `${r.discrepancy_pct > 0 ? "+" : ""}${r.discrepancy_pct}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.status === "flag" ? "🔴" : r.status === "ok" ? "🟢" : "⚪"}
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
