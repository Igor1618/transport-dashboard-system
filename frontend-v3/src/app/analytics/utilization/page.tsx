"use client";
import { useState, useCallback } from "react";
import { ArrowLeft, RefreshCw, Truck, UserX, Wrench, WifiOff, Package } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/shared/utils/apiFetch";
import { usePolling } from "@/shared/hooks/usePolling";

const REASON_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  no_driver: { label: "Нет водителя", icon: <UserX className="w-4 h-4" />, color: "text-red-400" },
  repair: { label: "В ремонте", icon: <Wrench className="w-4 h-4" />, color: "text-orange-400" },
  no_gps: { label: "Нет GPS", icon: <WifiOff className="w-4 h-4" />, color: "text-yellow-400" },
  no_orders: { label: "Нет заказов", icon: <Package className="w-4 h-4" />, color: "text-blue-400" },
  active: { label: "Активна", icon: <Truck className="w-4 h-4" />, color: "text-green-400" },
};

export default function UtilizationPage() {
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState(() => new Date().toISOString().substring(0, 7));
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/analytics/fleet/utilization?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [period]);

  usePolling(fetchData, 60000, [fetchData]);

  const utilization = data?.utilization || 0;
  const target = data?.target || 80;
  const vehicles = data?.vehicles || [];
  const filtered = filter ? vehicles.filter((v: any) => v.idle_reason === filter) : vehicles;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/command" className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-lg font-bold">📊 Утилизация парка</h1>
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
          className="ml-auto bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600" />
        <button onClick={fetchData} className="p-1.5 rounded hover:bg-slate-700">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-4 max-w-6xl mx-auto space-y-4">
        {/* Main gauge */}
        <div className="bg-slate-800 rounded-lg p-6 text-center">
          <div className="text-6xl font-bold mb-2">
            <span className={utilization >= target ? "text-green-400" : utilization >= 60 ? "text-amber-400" : "text-red-400"}>
              {utilization}%
            </span>
          </div>
          <div className="h-4 bg-slate-700 rounded-full max-w-md mx-auto mb-2 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${utilization >= target ? "bg-green-500" : utilization >= 60 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${utilization}%` }} />
          </div>
          <div className="text-sm text-slate-400">
            Цель: {target}% {utilization >= target ? "✅" : "🟡"}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            Работают: {data?.active_vehicles || 0} / {data?.total_vehicles || 0} машин
          </div>
        </div>

        {/* Reason breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(data?.reasons || {}).map(([key, count]) => {
            const r = REASON_LABELS[key];
            if (!r) return null;
            return (
              <button key={key} onClick={() => setFilter(filter === key ? null : key)}
                className={`bg-slate-800 rounded-lg p-3 text-left transition-colors ${filter === key ? "ring-2 ring-blue-500" : "hover:bg-slate-700"}`}>
                <div className={`flex items-center gap-2 ${r.color}`}>
                  {r.icon}
                  <span className="text-2xl font-bold">{count as number}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">{r.label}</div>
              </button>
            );
          })}
        </div>

        {/* Vehicle list */}
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-400 uppercase">
              {filter ? REASON_LABELS[filter]?.label : "Все машины"} ({filtered.length})
            </h3>
            {filter && <button onClick={() => setFilter(null)} className="text-xs text-blue-400">Сбросить</button>}
          </div>
          <div className="divide-y divide-slate-700/50 max-h-96 overflow-y-auto">
            {filtered.map((v: any) => {
              const r = REASON_LABELS[v.idle_reason] || REASON_LABELS.active;
              return (
                <div key={v.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={r.color}>{r.icon}</span>
                    <div>
                      <span className="text-sm font-mono font-semibold">{v.plate}</span>
                      {v.model && <span className="text-xs text-slate-500 ml-2">{v.model}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {v.driver_name ? (
                      <div className="text-xs text-slate-400">{v.driver_name}</div>
                    ) : (
                      <div className="text-xs text-red-400/70 italic">нет водителя</div>
                    )}
                    <div className="text-xs text-slate-500">{v.active_days} дн. активности</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
