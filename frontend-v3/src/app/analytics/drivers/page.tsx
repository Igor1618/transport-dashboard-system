"use client";
import { useState, useEffect, useMemo } from "react";
import { ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";

type DriverRow = { driver_name: string; vehicle_number: string; wb_trips: number; wb_revenue: number; rf_days: number; rf_revenue: number; fuel_cost: number; fuel_liters: number; mileage: number; consumption: number; penalties: number; salary: number; margin: number };
const fmt = (n: number) => n?.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) || "0";

export default function DriversRatingPage() {
  const [data, setData] = useState<DriverRow[]>([]);
  const [month, setMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });
  const [sortField, setSortField] = useState<string>("margin");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics/drivers?month=${month}`, { headers: { "x-user-role": (() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); return u.role || "director"; } catch { return "director"; } })() } }).then(r => r.json()).then(d => {
      setData((d || []).map((r: any) => ({
        ...r,
        wb_trips: Number(r.wb_trips) || 0,
        wb_revenue: Number(r.wb_revenue) || 0,
        rf_days: Number(r.rf_days) || 0,
        rf_revenue: Number(r.rf_revenue) || 0,
        fuel_cost: Number(r.fuel_cost) || 0,
        fuel_liters: Number(r.fuel_liters) || 0,
        mileage: Number(r.mileage) || 0,
        consumption: Number(r.consumption) || 0,
        penalties: Number(r.penalties) || 0,
        salary: Number(r.salary) || 0,
        margin: Number(r.margin) || 0,
      })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [month]);

  const sorted = useMemo(() => {
    return [...data].sort((a: any, b: any) => {
      const av = a[sortField] ?? 0, bv = b[sortField] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data, sortField, sortDir]);

  const totals = useMemo(() => ({
    wb_trips: data.reduce((s, d) => s + (d.wb_trips || 0), 0),
    wb_revenue: data.reduce((s, d) => s + (d.wb_revenue || 0), 0),
    rf_revenue: data.reduce((s, d) => s + (d.rf_revenue || 0), 0),
    fuel_cost: data.reduce((s, d) => s + (d.fuel_cost || 0), 0),
    penalties: data.reduce((s, d) => s + (d.penalties || 0), 0),
    salary: data.reduce((s, d) => s + (d.salary || 0), 0),
    margin: data.reduce((s, d) => s + (d.margin || 0), 0),
  }), [data]);

  const toggle = (f: string) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("desc"); }
  };

  const SH = ({ field, label }: { field: string; label: string }) => (
    <th className="p-2 text-left cursor-pointer hover:text-white select-none whitespace-nowrap" onClick={() => toggle(field)}>
      {label} {sortField === field ? (sortDir === "asc" ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />) : <ArrowUpDown className="inline w-3 h-3 opacity-30" />}
    </th>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">👷 Рейтинг водителей</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 text-slate-400 text-xs">
              <tr>
                <th className="p-2 text-left">#</th>
                <SH field="driver_name" label="Водитель" />
                <SH field="vehicle_number" label="Машина" />
                <SH field="wb_trips" label="WB рейс" />
                <SH field="wb_revenue" label="WB ₽" />
                <SH field="rf_days" label="РФ дн" />
                <SH field="rf_revenue" label="РФ ₽" />
                <SH field="fuel_cost" label="Топливо" />
                <SH field="consumption" label="л/100" />
                <SH field="penalties" label="Штрафы" />
                <SH field="salary" label="Начисл." />
                <SH field="margin" label="Маржа" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <tr key={d.driver_name} className="border-b border-slate-800 hover:bg-slate-700/30">
                  <td className="p-2 text-slate-500">{i + 1}</td>
                  <td className="p-2 font-medium max-w-[150px] truncate">{d.driver_name}</td>
                  <td className="p-2 font-mono text-xs text-cyan-400">{d.vehicle_number}</td>
                  <td className="p-2 text-center">{d.wb_trips || ''}</td>
                  <td className="p-2 text-right text-purple-400">{d.wb_revenue ? fmt(d.wb_revenue) : ''}</td>
                  <td className="p-2 text-center">{d.rf_days || ''}</td>
                  <td className="p-2 text-right text-blue-400">{d.rf_revenue ? fmt(d.rf_revenue) : ''}</td>
                  <td className="p-2 text-right text-red-400">{d.fuel_cost ? fmt(d.fuel_cost) : ''}</td>
                  <td className={`p-2 text-center ${d.consumption > 40 ? 'text-red-400 font-bold' : d.consumption > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {d.consumption > 0 ? d.consumption.toFixed(1) : ''}
                  </td>
                  <td className={`p-2 text-right ${d.penalties > 0 ? 'text-yellow-400' : ''}`}>{d.penalties ? fmt(d.penalties) : ''}</td>
                  <td className="p-2 text-right">{d.salary ? fmt(d.salary) : ''}</td>
                  <td className={`p-2 text-right font-bold ${d.margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(d.margin)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-600 font-bold">
              <tr>
                <td colSpan={3} className="p-2">ИТОГО ({sorted.length})</td>
                <td className="p-2 text-center">{totals.wb_trips}</td>
                <td className="p-2 text-right text-purple-400">{fmt(totals.wb_revenue)}</td>
                <td colSpan={1} />
                <td className="p-2 text-right text-blue-400">{fmt(totals.rf_revenue)}</td>
                <td className="p-2 text-right text-red-400">{fmt(totals.fuel_cost)}</td>
                <td />
                <td className="p-2 text-right text-yellow-400">{fmt(totals.penalties)}</td>
                <td className="p-2 text-right">{fmt(totals.salary)}</td>
                <td className={`p-2 text-right ${totals.margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(totals.margin)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
