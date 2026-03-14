"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetchJson } from "@/shared/utils/apiFetch";
import Link from "next/link";
import { ArrowLeft, DollarSign, Truck, Calendar, Search } from "lucide-react";

interface Registry {
  id: string; route: string; amount: number; date: string;
  vehicle_number: string; distributed_amount: number;
  distributions_count: number; remaining: number;
}

export default function RegistriesPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Registry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const rows = await apiFetchJson("/api/revenue/registries");
      setData(rows);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = data.filter(r => {
    if (showUnassignedOnly && Number(r.remaining) < 100) return false;
    if (search && !r.route?.toLowerCase().includes(search.toLowerCase()) && !r.vehicle_number?.includes(search)) return false;
    return true;
  });

  const totalRemaining = filtered.reduce((s, r) => s + Number(r.remaining || 0), 0);
  const fmt = (n: number) => Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/pnl" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-bold">Нераспределённые реестры WB</h1>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="text-slate-400 text-sm">Всего реестров</div>
            <div className="text-2xl font-bold">{data.length}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="text-red-400 text-sm">Нераспределённых</div>
            <div className="text-2xl font-bold text-red-400">{filtered.length}</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <div className="text-yellow-400 text-sm">Сумма остатков</div>
            <div className="text-2xl font-bold text-yellow-400">{fmt(totalRemaining)} ₽</div>
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по маршруту или номеру..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showUnassignedOnly} onChange={e => setShowUnassignedOnly(e.target.checked)} className="rounded" />
            Только нераспределённые
          </label>
        </div>

        {loading ? <div className="text-center py-8 text-slate-400">Загрузка...</div> : (
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Дата</th>
                  <th className="px-4 py-3 text-left">Маршрут</th>
                  <th className="px-4 py-3 text-left">Машина</th>
                  <th className="px-4 py-3 text-right">Сумма</th>
                  <th className="px-4 py-3 text-right">Распределено</th>
                  <th className="px-4 py-3 text-right">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString("ru-RU") : "—"}</td>
                    <td className="px-4 py-3 max-w-[300px] truncate" title={r.route}>{r.route || "—"}</td>
                    <td className="px-4 py-3">{r.vehicle_number || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.amount)} ₽</td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">{Number(r.distributed_amount) > 0 ? fmt(r.distributed_amount) + " ₽" : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-400 font-semibold">{fmt(r.remaining)} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
