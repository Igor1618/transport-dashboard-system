"use client";
import { useState, useEffect } from "react";
import { apiFetchJson as apiFetch } from "@/shared/utils/apiFetch";

interface ATILoad {
  id: string;
  from_city: string;
  to_city: string;
  weight: number;
  volume: number;
  rate: number;
  distance_km: number;
  cargo_type: string;
  loading_date: string;
  contact: string;
  phone: string;
}

export default function ATILoadsPage() {
  const [loads, setLoads] = useState<ATILoad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"all"|"vehicle">("all");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/vehicles/list").then((r: any) => {
      if (r?.vehicles) setVehicles(r.vehicles.filter((v: any) => v.status === "active"));
    }).catch(() => {});
  }, []);

  const search = async () => {
    setLoading(true);
    setError("");
    try {
      let url = "/api/integrations/ati/loads/all";
      if (mode === "vehicle" && vehicleId) {
        url = `/api/integrations/ati/loads?vehicle_id=${vehicleId}`;
      }
      const res = await apiFetch(url);
      setLoads(res?.loads || res?.results?.flatMap((r: any) => r.loads) || []);
    } catch (e: any) {
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">🚛 ATI.su — Подбор грузов</h1>
      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-sm mb-1">Режим</label>
          <select value={mode} onChange={e => setMode(e.target.value as any)} className="border rounded px-3 py-2 bg-white dark:bg-slate-800">
            <option value="all">Все свободные ТС</option>
            <option value="vehicle">По машине</option>
          </select>
        </div>
        {mode === "vehicle" && (
          <div>
            <label className="block text-sm mb-1">Машина</label>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="border rounded px-3 py-2 bg-white dark:bg-slate-800">
              <option value="">Выберите...</option>
              {vehicles.map((v: any) => (
                <option key={v.id} value={v.id}>{v.license_plate} — {v.brand} {v.model}</option>
              ))}
            </select>
          </div>
        )}
        <button onClick={search} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Поиск..." : "🔍 Найти грузы"}
        </button>
      </div>

      {error && <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>}

      {loads.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="p-2 text-left">Откуда</th>
                <th className="p-2 text-left">Куда</th>
                <th className="p-2 text-right">Вес, т</th>
                <th className="p-2 text-right">Объём, м³</th>
                <th className="p-2 text-right">Ставка, ₽</th>
                <th className="p-2 text-right">Расстояние</th>
                <th className="p-2 text-left">Груз</th>
                <th className="p-2 text-left">Дата погрузки</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((l, i) => (
                <tr key={l.id || i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-2">{l.from_city}</td>
                  <td className="p-2">{l.to_city}</td>
                  <td className="p-2 text-right">{l.weight || "—"}</td>
                  <td className="p-2 text-right">{l.volume || "—"}</td>
                  <td className="p-2 text-right font-medium">{l.rate ? `${Number(l.rate).toLocaleString()} ₽` : "—"}</td>
                  <td className="p-2 text-right">{l.distance_km ? `${l.distance_km} км` : "—"}</td>
                  <td className="p-2">{l.cargo_type || "—"}</td>
                  <td className="p-2">{l.loading_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="text-slate-500 text-center py-8">Нажмите «Найти грузы» для поиска на ATI.su</div>
      )}
      <p className="text-xs text-slate-400">Данные из ATI.su API. Время ответа может достигать 15–25 секунд.</p>
    </div>
  );
}
