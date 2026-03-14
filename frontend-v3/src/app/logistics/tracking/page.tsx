"use client";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, RefreshCw, MapPin, Navigation, Clock, Gauge, Truck } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiFetch } from "@/shared/utils/apiFetch";

const TripMap = dynamic(() => import("@/components/TripMap"), { ssr: false });

interface TrackingData {
  order: {
    id: number; from_city: string; to_city: string;
    from_lat: number; from_lon: number; to_lat: number; to_lon: number;
    status: string; distance_km: number;
    vehicle: string; model: string; driver: string;
    created_at: string; actual_load_start: string; delivered_at: string;
  };
  actual_track: { lat: number; lon: number; speed: number; t: string }[];
  progress: number;
  actual_distance_km: number;
  planned_distance_km: number;
  remaining_km: number;
  avg_speed: number;
  current_speed: number;
  eta: string | null;
  eta_hours: number;
  current_position: { lat: number; lon: number } | null;
}

interface PlannedRoute {
  route: { lat: number; lon: number }[] | null;
  distance_km: number;
  duration_hours: number;
}

const fmtTime = (iso: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
};

export default function TrackingPage() {
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [planned, setPlanned] = useState<PlannedRoute | null>(null);
  const [loading, setLoading] = useState(false);

  // Load active orders
  useEffect(() => {
    apiFetch("/api/logistics-wp/orders?status=in_transit,loading,loaded")
      .then(r => r.ok ? r.json() : [])
      .then(data => setOrders(Array.isArray(data) ? data : data.orders || []))
      .catch(() => {});
  }, []);

  const loadTracking = useCallback(async (id: number) => {
    setOrderId(id);
    setLoading(true);
    try {
      const [trackRes, routeRes] = await Promise.all([
        apiFetch(`/api/gps/trip/${id}/tracking`).then(r => r.ok ? r.json() : null),
        apiFetch(`/api/gps/trip/${id}/planned-route`).then(r => r.ok ? r.json() : null),
      ]);
      if (trackRes) setTracking(trackRes);
      if (routeRes) setPlanned(routeRes);
    } catch (e) {
      console.error("Tracking error:", e);
    }
    setLoading(false);
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!orderId) return;
    const iv = setInterval(() => loadTracking(orderId), 30000);
    return () => clearInterval(iv);
  }, [orderId, loadTracking]);

  const o = tracking?.order;
  const progressPct = tracking?.progress || 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/logistics/workplace" className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-lg font-bold">🗺️ Трекинг рейса</h1>
        {orderId && (
          <button onClick={() => loadTracking(orderId)} className="ml-auto p-1.5 rounded hover:bg-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row" style={{ height: "calc(100vh - 56px)" }}>
        {/* Left panel — order selection + info */}
        <div className="w-full lg:w-80 bg-slate-800 border-r border-slate-700 overflow-y-auto flex-shrink-0">
          {!orderId ? (
            <div className="p-4 space-y-2">
              <h3 className="text-sm text-slate-400 uppercase mb-2">Активные рейсы</h3>
              {orders.length === 0 && <p className="text-slate-500 text-sm">Нет активных рейсов</p>}
              {orders.map((ord: any) => (
                <button key={ord.id} onClick={() => loadTracking(ord.id)}
                  className="w-full text-left bg-slate-700/50 hover:bg-slate-700 rounded-lg p-3 transition-colors">
                  <div className="text-sm font-medium">{ord.from_city} → {ord.to_city}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {ord.vehicle_number || "—"} • {ord.distance_km || "?"} км
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Статус: {ord.status}
                  </div>
                </button>
              ))}
            </div>
          ) : o ? (
            <div className="p-4 space-y-4">
              <button onClick={() => { setOrderId(null); setTracking(null); setPlanned(null); }}
                className="text-xs text-blue-400 hover:text-blue-300">← Все рейсы</button>

              {/* Order info */}
              <div>
                <div className="text-lg font-bold">{o.from_city} → {o.to_city}</div>
                <div className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> {o.vehicle || "—"} {o.model && `(${o.model})`}
                </div>
                {o.driver && <div className="text-sm text-slate-400">👤 {o.driver}</div>}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Прогресс</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${progressPct >= 90 ? "bg-green-500" : progressPct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                    style={{ width: `${progressPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>{tracking?.actual_distance_km || 0} км</span>
                  <span>{tracking?.planned_distance_km || 0} км</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <StatBlock icon={<Gauge className="w-4 h-4 text-blue-400" />} label="Текущая" value={`${tracking?.current_speed || 0} км/ч`} />
                <StatBlock icon={<Navigation className="w-4 h-4 text-green-400" />} label="Средняя" value={`${tracking?.avg_speed || 0} км/ч`} />
                <StatBlock icon={<MapPin className="w-4 h-4 text-amber-400" />} label="Осталось" value={`${tracking?.remaining_km || 0} км`} />
                <StatBlock icon={<Clock className="w-4 h-4 text-purple-400" />} label="ETA" 
                  value={tracking?.eta ? fmtTime(tracking.eta) : o.delivered_at ? "Доставлен" : "—"} />
              </div>

              {tracking?.eta_hours && tracking.eta_hours > 0 && !o.delivered_at && (
                <div className="text-center text-sm text-slate-400">
                  Ещё ~{tracking.eta_hours}ч в пути
                </div>
              )}

              {/* Legend */}
              <div className="text-xs space-y-1 border-t border-slate-700 pt-3">
                <div className="text-slate-400 font-medium mb-1">Легенда карты:</div>
                <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-blue-400 inline-block" style={{ borderStyle: "dashed" }}></span> Плановый маршрут</div>
                <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-green-500 inline-block"></span> Фактический трек</div>
                <div className="flex items-center gap-2"><span className="w-3 h-1.5 bg-red-500 rounded-full inline-block"></span> Текущая позиция</div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-slate-500">Загрузка...</div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {tracking && (
            <TripMap
              actualTrack={tracking.actual_track}
              plannedRoute={planned?.route || null}
              fromLat={o?.from_lat} fromLon={o?.from_lon}
              toLat={o?.to_lat} toLon={o?.to_lon}
              currentPosition={tracking.current_position}
            />
          )}
          {!tracking && (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Выберите рейс для трекинга</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-2.5 flex items-center gap-2">
      {icon}
      <div>
        <div className="text-[10px] text-slate-400 uppercase">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
