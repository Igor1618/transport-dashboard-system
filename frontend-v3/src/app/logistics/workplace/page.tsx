"use client";
import { useState, useEffect, useCallback } from "react";
import { pVehicle } from "@/shared/utils/pluralize";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, apiFetchJson } from "@/shared/utils/apiFetch";
import { usePolling } from "@/shared/hooks/usePolling";
import dynamic from "next/dynamic";
const VehicleMap = dynamic(() => import("@/components/VehicleMap"), { ssr: false });
import {
  Truck, AlertTriangle, MapPin, Package, Plus, RefreshCw,
  ChevronDown, ChevronUp, Navigation, Clock, Gauge, X
} from "lucide-react";

interface Vehicle {
  id: number;
  license_plate: string;
  model: string;
  status: string;
  driver_name?: string;
  speed?: number;
  current_city?: string;
  last_lat?: number;
  last_lng?: number;
  last_gps_time?: string;
  active_order?: ActiveOrder | null;
}

interface ActiveOrder {
  id: number;
  from_city: string;
  to_city: string;
  cargo_name?: string;
  weight_tons?: number;
  price?: number;
  status: string;
}

interface Alert {
  id: number;
  type: string;
  title: string;
  vehicle_id: number;
  vehicle_plate?: string;
  created_at: string;
}

interface Order {
  id: number;
  vehicle_id: number;
  vehicle_plate?: string;
  from_city: string;
  to_city: string;
  cargo_name?: string;
  weight_tons?: number;
  price?: number;
  status: string;
  created_at: string;
}

const VEHICLE_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  moving:  { label: "В рейсе",    color: "bg-green-600",  dot: "🟢" },
  idle:    { label: "Свободна",   color: "bg-yellow-600", dot: "🟡" },
  repair:  { label: "На ремонте", color: "bg-red-600",    dot: "🔴" },
  no_data: { label: "Нет GPS",    color: "bg-red-600",    dot: "🔴" },
};

const ORDER_STATUS: Record<string, { label: string; badge: string }> = {
  taken:       { label: "Принят",     badge: "🔵" },
  approved:    { label: "Одобрен",    badge: "🟢" },
  in_progress: { label: "В пути",     badge: "🚛" },
  delivered:   { label: "Доставлен",  badge: "✅" },
  cancelled:   { label: "Отменён",    badge: "🔴" },
};

const ALERT_ICONS: Record<string, string> = {
  vehicle_idle: "🔴",
  no_gps: "🟡",
  maintenance_due: "🟡",
};

const fmt = (n?: number) => n ? new Intl.NumberFormat("ru-RU").format(n) : "—";
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }) : "—";

export default function LogistWorkplacePage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"vehicles" | "orders" | "alerts">("vehicles");
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [toast, setToast] = useState("");

  // Order form
  const [form, setForm] = useState({ from_city: "", to_city: "", cargo_name: "", weight_tons: "", price: "", distance_km: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [vRes, aRes, oRes] = await Promise.all([
        apiFetch("/api/logistics-wp/vehicles").then(r => r.json()),
        apiFetch("/api/logistics-wp/alerts").then(r => r.json()),
        apiFetch("/api/logistics-wp/orders").then(r => r.json()),
      ]);
      setVehicles(Array.isArray(vRes) ? vRes : vRes.vehicles || []);
      setAlerts(Array.isArray(aRes) ? aRes : aRes.alerts || []);
      setOrders(Array.isArray(oRes) ? oRes : oRes.orders || []);
    } catch (e) { console.error("Fetch error:", e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 15s (stops on 403)
  usePolling(fetchAll, 15000, [fetchAll]);

  // Update selected vehicle when data refreshes
  useEffect(() => {
    if (selected) {
      const updated = vehicles.find(v => v.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [vehicles]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const createOrder = async () => {
    if (!selected || !form.from_city || !form.to_city) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/logistics-wp/assign", {
        method: "POST",
        body: JSON.stringify({
          vehicle_id: selected.id,
          from_city: form.from_city,
          to_city: form.to_city,
          cargo_name: form.cargo_name || undefined,
          weight_tons: form.weight_tons ? parseFloat(form.weight_tons) : undefined,
          price: form.price ? parseFloat(form.price) : undefined,
          distance_km: form.distance_km ? parseInt(form.distance_km) : undefined,
        }),
      });
      if (res.ok) {
        showToast("✅ Заказ создан");
        setForm({ from_city: "", to_city: "", cargo_name: "", weight_tons: "", price: "", distance_km: "" });
        fetchAll();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`❌ Ошибка: ${err.error || res.statusText}`);
      }
    } catch (e) { showToast("❌ Ошибка сети"); }
    setSubmitting(false);
  };

  const vs = (v: Vehicle) => {
    // Use GPS data for real status, not vehicle.status (which is 'active'/'idle')
    const gpsStatus = (v as any).gps_status;
    const speed = (v as any).speed ?? 0;
    const gpsTime = (v as any).gps_time || (v as any).last_gps_time;
    if (gpsTime) {
      let raw = typeof gpsTime === 'string' ? gpsTime.replace(' ', 'T') : String(gpsTime);
      if (/[+-]\d{2}$/.test(raw)) raw += ':00'; // Safari needs +00:00 not +00
      const ts = new Date(raw).getTime();
      const ageMin = (Date.now() - ts) / 60000;
      if (isNaN(ageMin) || ageMin > 1440) return VEHICLE_STATUS.no_data;
      if (ageMin > 60) return { label: "Стоит давно", color: "bg-yellow-600", dot: "🟡" };
      if (speed > 5 || gpsStatus === 'moving') return VEHICLE_STATUS.moving;
      return { label: "Стоит", color: "bg-blue-600", dot: "🔵" };
    }
    if (gpsStatus === 'moving') return VEHICLE_STATUS.moving;
    if (v.status === 'repair') return VEHICLE_STATUS.repair;
    return VEHICLE_STATUS.no_data;
  };
  const busyVehicleIds = new Set(orders.filter(o => ["pending","approved","in_transit","taken"].includes(o.status)).map(o => o.vehicle_id));
  const isIdle = (v: Vehicle) => !busyVehicleIds.has(v.id) && vs(v).label !== 'В рейсе';
  const filteredVehicles = showFreeOnly ? vehicles.filter((v: any) => !busyVehicleIds.has(v.id)) : vehicles;
  const idleCount = vehicles.filter(isIdle).length;

  // --- Render sections ---

  const AlertSection = () => alerts.length === 0 ? null : (
    <div className="mb-4">
      <button onClick={() => setAlertsOpen(!alertsOpen)}
        className="flex items-center gap-2 w-full text-left text-sm font-semibold text-yellow-400 hover:text-yellow-300 transition">
        <AlertTriangle size={16} />
        Алерты ({alerts.length})
        {alertsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {alertsOpen && alerts.length > 0 && (
        <div className="mt-2 space-y-2">
          {alerts.map(a => (
            <div key={a.id} className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
              <span>{ALERT_ICONS[a.type] || "⚠️"}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{a.title}</div>
                {a.vehicle_plate && <div className="text-xs text-slate-400">{a.vehicle_plate}</div>}
              </div>
              <button onClick={() => {
                const v = vehicles.find(v => v.id === a.vehicle_id);
                if (v) { setSelected(v); setTab("vehicles"); }
              }} className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition">
                Открыть
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Empty alerts hidden */}
    </div>
  );

  const VehicleList = () => (
    <div className="space-y-2">
      {vehicles.map(v => {
        const s = vs(v);
        const idle = isIdle(v);
        return (
          <div key={v.id}
            onClick={() => setSelected(v)}
            className={`cursor-pointer rounded-lg px-3 py-2.5 transition border ${
              selected?.id === v.id ? "border-blue-500 bg-slate-800" :
              idle ? "border-yellow-600/40 bg-yellow-900/10 hover:bg-slate-800/80" :
              "border-slate-700/50 bg-slate-800/40 hover:bg-slate-800/80"
            }`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{s.dot}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm">{v.license_plate}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.color} text-white`}>{s.label}</span>
                  {idle && s.label !== 'В рейсе' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white animate-pulse">СВОБОДНА!</span>}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  {v.model} {v.current_city && `· ${v.current_city}`} {v.speed != null && v.speed > 0 && `· ${v.speed} км/ч`}
                </div>
              </div>
              <Truck size={16} className="text-slate-500 shrink-0" />
            </div>
          </div>
        );
      })}
      {vehicles.length === 0 && !loading && (
        <p className="text-center text-slate-500 py-8">Нет назначенных машин</p>
      )}
    </div>
  );

  const VehicleDetail = () => {
    if (!selected) return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        <div className="text-center">
          <Truck size={48} className="mx-auto mb-3 opacity-30" />
          <p>Выберите машину слева</p>
        </div>
      </div>
    );

    const s = vs(selected);
    const idle = isIdle(selected);
    const ao = selected.active_order || orders.find(o => 
      o.vehicle_id === selected.id && ['pending','approved','in_transit','taken'].includes(o.status)
    );

    return (
      <div className="space-y-4">
        {/* Vehicle info */}
        <div className="bg-slate-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold flex items-center gap-2">
              {s.dot} {selected.license_plate}
              <span className={`text-xs px-2 py-0.5 rounded ${s.color} text-white`}>{s.label}</span>
            </h3>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-400">Модель</div><div>{selected.model || "—"}</div>
            <div className="text-slate-400">Водитель</div><div>{selected.driver_name || "—"}</div>
            <div className="text-slate-400">Скорость</div><div>{selected.speed != null ? `${selected.speed} км/ч` : "—"}</div>
            <div className="text-slate-400">Город</div><div>{selected.current_city || "—"}</div>
            <div className="text-slate-400">GPS</div>
            <div>{selected.last_gps_time ? fmtDate(selected.last_gps_time) : "Нет данных"}</div>
          </div>
        </div>

        {/* Active order */}
        {ao && (
          <div className="bg-slate-800/60 rounded-xl p-4">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Package size={14} /> Активный заказ
            </h4>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-green-400" />
                <span>{ao.from_city}</span>
                <span className="text-slate-500">→</span>
                <span>{ao.to_city}</span>
              </div>
              {ao.cargo_name && <div className="text-slate-400">Груз: {ao.cargo_name} {ao.weight_tons ? `(${ao.weight_tons} т)` : ""}</div>}
              {ao.price && <div className="text-slate-400">Цена: {fmt(ao.price)} ₽</div>}
              <div className="mt-1">
                <span className="text-xs px-2 py-0.5 rounded bg-slate-700">
                  {ORDER_STATUS[ao.status]?.badge || "📋"} {ORDER_STATUS[ao.status]?.label || ao.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Create order form (idle only) */}
        {!ao && (
          <div className="bg-slate-800/60 rounded-xl p-4">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Plus size={14} /> 📦 Назначить на рейс
            </h4>
            <div className="space-y-2.5">
              <input placeholder="Откуда (город)" value={form.from_city}
                onChange={e => setForm({ ...form, from_city: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              <input placeholder="Куда (город)" value={form.to_city}
                onChange={e => setForm({ ...form, to_city: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              <input placeholder="Груз" value={form.cargo_name}
                onChange={e => setForm({ ...form, cargo_name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Вес (тонн)" type="number" value={form.weight_tons}
                  onChange={e => setForm({ ...form, weight_tons: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                <input placeholder="Цена ₽" type="number" value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <input placeholder="Расстояние (км)" type="number" value={form.distance_km}
                  onChange={e => setForm({ ...form, distance_km: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              {form.price && form.weight_tons && (
                <div className="text-xs text-slate-500">
                  ≈ {fmt(Math.round(parseFloat(form.price) / Math.max(1, parseFloat(form.weight_tons))))} ₽/т
                </div>
              )}
              <button onClick={createOrder} disabled={submitting || !form.from_city || !form.to_city}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg py-2.5 text-sm transition">
                {submitting ? "Создание..." : "Создать заказ"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const OrdersTable = () => orders.length === 0 ? null : (
    <div className="bg-slate-800/40 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <h3 className="font-semibold text-sm">📋 Мои заказы ({orders.length})</h3>
        <button onClick={fetchAll} className="text-slate-400 hover:text-white transition">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700/50">
              <th className="text-left px-4 py-2">Машина</th>
              <th className="text-left px-4 py-2">Маршрут</th>
              <th className="text-left px-4 py-2">Груз</th>
              <th className="text-right px-4 py-2">Цена</th>
              <th className="text-center px-4 py-2">Статус</th>
              <th className="text-right px-4 py-2">Дата</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const os = ORDER_STATUS[o.status] || { label: o.status, badge: "📋" };
              return (
                <tr key={o.id}
                  onClick={() => {
                    const v = vehicles.find(v => v.id === o.vehicle_id);
                    if (v) setSelected(v);
                  }}
                  className="border-b border-slate-700/30 hover:bg-slate-800/60 cursor-pointer transition">
                  <td className="px-4 py-2 font-mono text-xs">{o.vehicle_plate || `#${o.vehicle_id}`}</td>
                  <td className="px-4 py-2">
                    <span className="text-slate-300">{o.from_city}</span>
                    <span className="text-slate-500 mx-1">→</span>
                    <span className="text-slate-300">{o.to_city}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-400">{o.cargo_name || "—"} {o.weight_tons ? `(${o.weight_tons}т)` : ""}</td>
                  <td className="px-4 py-2 text-right">{fmt(o.price)} ₽</td>
                  <td className="px-4 py-2 text-center">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700">{os.badge} {os.label}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-slate-400">{fmtDate(o.created_at)}</td>
                </tr>
              );
            })}
            {/* Empty orders hidden */}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Mobile tabs
  const MobileTabs = () => (
    <div className="flex md:hidden border-b border-slate-700 mb-4">
      {([["vehicles", "Машины"], ["orders", "Заказы"], ["alerts", "Алерты"]] as const).filter(([key]) => {
          if (key === "alerts" && alerts.length === 0) return false;
          if (key === "orders" && orders.length === 0) return false;
          return true;
        }).map(([key, label]) => (
        <button key={key} onClick={() => setTab(key)}
          className={`flex-1 py-2.5 text-sm font-medium transition ${tab === key ? "text-blue-400 border-b-2 border-blue-400" : "text-slate-400"}`}>
          {label}
          {key === "alerts" && alerts.length > 0 && (
            <span className="ml-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{alerts.length}</span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto min-h-screen">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-sm shadow-lg animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            🚛 Логист: {user?.full_name || "—"}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span>{pVehicle(filteredVehicles.length)}{showFreeOnly ? ` из ${vehicles.length}` : ''}</span>
            {idleCount > 0 && (
              <>
                <span className="text-yellow-400 font-semibold">{idleCount} свободных!</span>
                <button onClick={() => setShowFreeOnly(!showFreeOnly)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition ${showFreeOnly ? 'bg-yellow-600 border-yellow-500 text-white' : 'border-slate-600 text-slate-400 hover:text-white'}`}>
                  {showFreeOnly ? '✕ Все' : 'Только свободные'}
                </button>
              </>
            )}
            {alerts.length > 0 && (
              <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">{alerts.length} алертов</span>
            )}
          </div>
        </div>
        <button onClick={() => { setLoading(true); fetchAll(); }}
          className="text-slate-400 hover:text-white transition p-2">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Mobile tabs */}
      <MobileTabs />

      {/* Map */}
      <div className="mb-4">
        <VehicleMap height="300px" />
      </div>

      {/* Desktop: 2-column layout */}
      <div className="hidden md:grid md:grid-cols-5 gap-5">
        {/* Left: vehicles + alerts */}
        <div className="col-span-2 space-y-3">
          <AlertSection />
          <VehicleList />
        </div>
        {/* Right: detail + form */}
        <div className="col-span-3">
          <VehicleDetail />
        </div>
      </div>

      {/* Mobile: tab content */}
      <div className="md:hidden">
        {tab === "vehicles" && (
          <>
            <VehicleList />
            {selected && <div className="mt-4"><VehicleDetail /></div>}
          </>
        )}
        {tab === "alerts" && <AlertSection />}
        {tab === "orders" && <OrdersTable />}
      </div>

      {/* Desktop: Orders at bottom */}
      <div className="hidden md:block mt-6">
        <OrdersTable />
      </div>
    </div>
  );
}
