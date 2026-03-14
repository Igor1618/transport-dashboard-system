"use client";
import { useState, useEffect } from "react";
import { X, Wrench, Clock, DollarSign, Package } from "lucide-react";
import { apiFetch } from "@/shared/utils/apiFetch";

interface RepairModalProps {
  vehicleId: string;
  plate: string;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  completed: "bg-green-500/20 text-green-400",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает", in_progress: "В работе", completed: "Завершён",
};

export default function VehicleRepairs({ vehicleId, plate, onClose }: RepairModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(`/api/vehicles/${vehicleId}/repairs`);
        if (r.ok) setData(await r.json());
      } catch {}
      setLoading(false);
    })();
  }, [vehicleId]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold">🔧 История ремонтов</h2>
            <span className="text-sm text-slate-400 font-mono">{plate}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Загрузка...</div>
        ) : !data || data.repairs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Нет записей о ремонтах</div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 p-4">
              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <Wrench className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                <div className="text-xl font-bold">{data.summary.total_repairs}</div>
                <div className="text-xs text-slate-400">Всего</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-400" />
                <div className="text-xl font-bold">{Number(data.summary.total_cost).toLocaleString('ru-RU')}₽</div>
                <div className="text-xs text-slate-400">Общая стоимость</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <Clock className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
                <div className="text-xl font-bold">{data.summary.active}</div>
                <div className="text-xs text-slate-400">Активных</div>
              </div>
            </div>

            {/* Timeline */}
            <div className="px-4 pb-4 space-y-3">
              {data.repairs.map((r: any) => (
                <div key={r.id} className="border-l-2 border-slate-600 pl-4 relative">
                  <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-slate-600" />
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{r.repair_type || r.description || 'Ремонт'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[r.status] || 'bg-slate-700'}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                        {r.scheduled_type && <span className="text-xs text-purple-400">📅 {r.scheduled_type}</span>}
                      </div>
                      {r.description && r.repair_type && (
                        <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>
                      )}
                      {r.mechanic_name && (
                        <div className="text-xs text-slate-500 mt-0.5">👤 {r.mechanic_name}</div>
                      )}
                      {r.parts_used && r.parts_used.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {r.parts_used.map((p: any) => `${p.name} x${p.quantity}`).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      {Number(r.total_cost) > 0 && (
                        <div className="text-sm font-semibold text-green-400">{Number(r.total_cost).toLocaleString('ru-RU')}₽</div>
                      )}
                      <div className="text-xs text-slate-500">
                        {new Date(r.created_at).toLocaleDateString('ru-RU', {timeZone:'Europe/Moscow', day:'2-digit',month:'2-digit',year:'2-digit'})}
                      </div>
                      {r.mileage_at_repair && (
                        <div className="text-xs text-slate-500">{Number(r.mileage_at_repair).toLocaleString()} км</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
