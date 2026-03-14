"use client";
import { useState, useEffect, useMemo } from "react";
import { pVehicle } from "@/shared/utils/pluralize";
import { ChevronLeft, ChevronRight, Truck, Calendar } from "lucide-react";

const STATUS_COLORS: Record<string,string> = {
  PLANNING:"#64748b",SEARCHING:"#9333ea",FOUND:"#6366f1",APPROVED:"#2563eb",DOCS:"#0891b2",ASSIGNED:"#0d9488",
  EN_ROUTE_PICKUP:"#d97706",LOADING:"#ea580c",EN_ROUTE_DELIVERY:"#16a34a",UNLOADING:"#65a30d",
  COMPLETED:"#059669",CLOSED:"#475569",CANCELLED:"#dc2626",
};

export default function PlanningBoard() {
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [daysCount, setDaysCount] = useState(7);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const dates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [startDate, daysCount]);

  useEffect(() => {
    setLoading(true);
    const from = dates[0].toISOString();
    const to = dates[dates.length - 1].toISOString();
    fetch(`/api/logistics/planning?from=${from}&to=${to}`)
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [dates]);

  const shift = (days: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    setStartDate(d);
  };

  const fmtDay = (d: Date) => d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Moscow" });
  const isToday = (d: Date) => { const t = new Date(); return d.toDateString() === t.toDateString(); };

  const getOrdersForDay = (vehicle: any, date: Date) => {
    const dayStart = new Date(date); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(date); dayEnd.setHours(23,59,59,999);
    return (vehicle.orders || []).filter((o: any) => {
      const pickup = new Date(o.planned_pickup_date);
      const delivery = new Date(o.planned_delivery_date);
      return pickup <= dayEnd && delivery >= dayStart;
    });
  };

  const vehicles = data?.vehicles || [];
  const unassigned = data?.unassigned_orders || [];

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><Calendar className="w-6 h-6 text-blue-400" /> Доска планирования</h1>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => shift(-daysCount)} className="p-1.5 rounded bg-slate-700 hover:bg-slate-600"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setStartDate(new Date())} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs">Сегодня</button>
          <button onClick={() => shift(daysCount)} className="p-1.5 rounded bg-slate-700 hover:bg-slate-600"><ChevronRight className="w-4 h-4" /></button>
          <select value={daysCount} onChange={e => setDaysCount(+e.target.value)} className="bg-slate-700 rounded px-2 py-1 text-xs text-white ml-2">
            <option value={7}>7 дней</option><option value={14}>14 дней</option><option value={30}>30 дней</option>
          </select>
        </div>
      </div>

      {loading ? <div className="text-center py-12 text-slate-500">Загрузка...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-900 z-10 text-left text-xs text-slate-400 p-2 w-[140px] border-b border-slate-700">
                  <Truck className="w-3 h-3 inline mr-1" />{pVehicle(vehicles.length)}
                </th>
                {dates.map(d => (
                  <th key={d.toISOString()} className={`text-center text-xs p-2 border-b border-slate-700 min-w-[100px] ${isToday(d) ? "bg-blue-900/20 text-blue-400" : "text-slate-400"}`}>
                    {fmtDay(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v: any) => (
                <tr key={v.vehicle_number} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="sticky left-0 bg-slate-900 z-10 p-1.5 text-xs">
                    <div className="font-mono font-bold text-white">{v.vehicle_number?.toUpperCase()}</div>
                    <div className="text-[10px] text-slate-500">{v.vehicle_type || v.model || ''}</div>
                  </td>
                  {dates.map(d => {
                    const dayOrders = getOrdersForDay(v, d);
                    return (
                      <td key={d.toISOString()} className={`p-0.5 ${isToday(d) ? "bg-blue-900/10" : ""}`}>
                        {dayOrders.length > 0 ? dayOrders.map((o: any) => (
                          <a key={o.id} href={`/logistics/orders/${o.id}`}
                            className="block rounded px-1 py-0.5 text-[10px] mb-0.5 truncate hover:opacity-80"
                            style={{ backgroundColor: (STATUS_COLORS[o.status] || '#666') + '40', borderLeft: `2px solid ${STATUS_COLORS[o.status] || '#666'}` }}
                            title={`${o.order_number}: ${o.origin_city} → ${o.destination_city}`}>
                            <div className="font-bold text-white truncate">{o.origin_city?.slice(0,3)}→{o.destination_city?.slice(0,3)}</div>
                            {o.rate_amount > 0 && <div className="text-green-300">{Math.round(o.rate_amount/1000)}K₽</div>}
                          </a>
                        )) : (
                          <div className="text-center text-slate-600 text-[10px] py-1">—</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unassigned orders */}
      {unassigned.length > 0 && (
        <div className="mt-6 bg-slate-800 rounded-lg p-4 border border-amber-500/30">
          <h3 className="text-sm font-medium text-amber-400 mb-2">📋 Без машины ({unassigned.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unassigned.map((o: any) => (
              <a key={o.id} href={`/logistics/orders/${o.id}`} className="bg-slate-700/50 rounded p-2 hover:bg-slate-700 transition text-xs">
                <span className="font-mono font-bold">{o.order_number}</span>
                <span className="text-slate-400 ml-1">{o.origin_city} → {o.destination_city}</span>
                {o.rate_amount > 0 && <span className="text-green-400 ml-1">{Math.round(o.rate_amount/1000)}K₽</span>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
