"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

const apiFetchJson = async (url: string) => {
  const role = localStorage.getItem("userRole") || "director";
  const userId = localStorage.getItem("userId") || "";
  const emRole = localStorage.getItem("emulateRole");
  const h: Record<string, string> = { "x-user-role": emRole || role, "x-user-id": userId };
  if (emRole) h["x-emulate-role"] = emRole;
  const r = await fetch(url, { headers: h });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) : "—";
const fmtMoney = (n: number | null | undefined) => n != null ? n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽" : "—";
const fmtDt = (s: string | null) => { if (!s) return "—"; return new Date(s).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
const fmtDate = (s: string | null) => { if (!s) return "—"; return new Date(s).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit" }); };
const fmtTime = (s: string | null) => { if (!s) return "—"; return new Date(s).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }); };
const parseDest = (r: string | null) => { if (!r) return "—"; const m = r.match(/\(([^)]+)\)\s*$/); return m ? m[1] : r; };

type Gps = { lat: number; lon: number; speed: number; heading: number; gps_time: string; address: string };
type Eta = { status?: string; emoji?: string; label?: string; color?: string; eta?: string; remaining_km?: number; destination_city?: string; delay_min?: number };
type TripWb = { type: "wb"; status: "active" | "waiting"; driver?: string; route?: string; src?: string; open_dt?: string; close_dt?: string; plan_km?: number; norm_speed?: number; shks?: number; containers?: number; total_price?: number; fine_sum?: number };
type TripRf = { type: "rf"; driver?: string; route?: string; amount?: number; loading_date?: string; unloading_date?: string; contractor?: string; order_number?: string };
type Trip = TripWb | TripRf;
type Vehicle = { id: string; license_plate: string; brand: string | null; model: string | null; vehicle_type: string | null; category: "wb" | "rf" | "free"; subStatus?: string; trip: Trip | null; gps: Gps | null; hired?: boolean; eta?: Eta | null };
type Alert = { plate: string; type: string; problem: string; gps: Gps | null; driver?: string; route_from?: string; route_to?: string; plan_km?: number; open_dt?: string; transit_hours?: number; deadline?: string; eta?: string; delay?: string; delay_min?: number; reason?: string };
type Fleet = { total: number; wb: number; wb_active: number; wb_waiting: number; wb_late: number; rf: number; rf_late: number; free: number; alerts: Alert[]; vehicles: Vehicle[] };
type MainTab = "wb" | "rf" | "free" | "planning";

function calcWbEta(trip: TripWb | null, gps: Gps | null): Eta | null {
  if (!gps?.lat || !trip || trip.status !== "active" || !trip.open_dt || !trip.plan_km) return null;
  const ns = trip.norm_speed || 50;
  const openMs = new Date(trip.open_dt).getTime();
  const ageH = (Date.now() - openMs) / 3600000;
  const transitH = trip.plan_km / ns;
  // If waysheet is older than 2x transit time, consider it completed
  if (ageH > transitH * 2.5 || ageH > 36) {
    return { emoji: "✅", label: "Завершён", color: "text-green-500", remaining_km: 0, delay_min: 0 };
  }
  const planEta = openMs + transitH * 3600000;
  const covered = Math.min(ageH * ns, trip.plan_km);
  const remain = Math.max(trip.plan_km - covered, 0);
  if (remain <= 5) {
    return { emoji: "✅", label: "Прибыл", color: "text-green-500", remaining_km: 0, delay_min: 0 };
  }
  if ((gps.speed || 0) < 3) {
    return { emoji: "⏸️", label: "Стоит", color: "text-blue-500", remaining_km: Math.round(remain) };
  }
  const spd = gps.speed > 5 ? gps.speed : ns;
  const realEta = Date.now() + (remain / spd) * 3600000;
  const delay = (realEta - planEta) / 60000;
  let emoji = "✅", label = "Успевает", color = "text-green-500";
  if (delay > 60) { const h = Math.floor(delay/60); const m = Math.round(delay%60); emoji = "🔴"; label = `~${h}ч ${m<60?m:0}мин`; color = "text-red-500"; }
  else if (delay > 30) { emoji = "⚠️"; label = "Под вопросом"; color = "text-yellow-500"; }
  return { emoji, label, color, eta: new Date(realEta).toISOString(), remaining_km: Math.round(remain), delay_min: Math.round(delay) };
}

/* ── Map Modal ── */
function MapModal({ v, onClose }: { v: Vehicle; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const g = v.gps;
  useEffect(() => {
    if (!g?.lat || !ref.current) return;
    const w = window as any;
    const init = () => { if (!w.ymaps || !ref.current) return; w.ymaps.ready(() => {
      if (mapRef.current) mapRef.current.destroy();
      const m = new w.ymaps.Map(ref.current, { center: [g.lat, g.lon], zoom: 10, controls: ["zoomControl"] });
      m.geoObjects.add(new w.ymaps.Placemark([g.lat, g.lon], { iconContent: v.license_plate, balloonContent: `<b>${v.license_plate}</b><br>${v.trip?.driver||""}<br>${g.speed} км/ч<br>${g.address||""}` }, { preset: g.speed > 5 ? "islands#greenStretchyIcon" : "islands#blueStretchyIcon" }));
      mapRef.current = m;
    }); };
    if (w.ymaps) init(); else { const s = document.createElement("script"); s.src = "https://api-maps.yandex.ru/2.1/?apikey=62e1137c-2502-43bf-8986-55c56e740837&lang=ru_RU"; s.onload = init; document.head.appendChild(s); }
    return () => { if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null; } };
  }, [g, v]);
  const eta = v.eta || (v.trip?.type === "wb" ? calcWbEta(v.trip as TripWb, g) : null);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto text-gray-900 dark:text-gray-100" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between">
          <div>
            <h2 className="text-lg font-bold">{v.license_plate} — {v.trip?.driver || "—"}</h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {v.trip?.type === "wb" ? `${(v.trip as TripWb).src} → ${parseDest((v.trip as TripWb).route||null)}` : v.trip?.type === "rf" ? `📦 ${(v.trip as TripRf).route}` : "Свободна"}
            </div>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-200">×</button>
        </div>
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 flex gap-4 flex-wrap text-sm">
          {v.trip?.type === "rf" && (() => { const t = v.trip as TripRf; return (<>
            {t.contractor && <span>🏢 {t.contractor}</span>}
            {t.amount && <span>💰 {fmtMoney(Number(t.amount))}</span>}
            <span>📅 {fmtDate(t.loading_date||null)} → {fmtDate(t.unloading_date||null)}</span>
          </>); })()}
          {eta?.remaining_km != null && <span>📍 Осталось: <b>{eta.remaining_km} км</b></span>}
          {eta?.eta && <span>ETA: <b>{fmtDt(eta.eta)}</b></span>}
          {eta?.label && <span className={eta.color?.startsWith("text-") ? eta.color : `text-${eta.color}-500`}>{eta.emoji} {eta.label}</span>}
          {g && <span>Скорость: <b>{g.speed}</b> км/ч</span>}
          {g?.address && <span className="text-gray-500 dark:text-gray-400 truncate max-w-xs">{g.address}</span>}
          {!g && <span className="text-gray-400">❓ Нет GPS</span>}
        </div>
        {g?.lat ? <div ref={ref} style={{ width: "100%", height: 400 }} /> : <div className="h-64 flex items-center justify-center text-gray-400">Нет GPS данных</div>}
      </div>
    </div>
  );
}

/* ── Vehicle Card ── */
function VCard({ v, onClick }: { v: Vehicle; onClick: () => void }) {
  const wbEta = v.trip?.type === "wb" && (v.trip as TripWb).status === "active" ? calcWbEta(v.trip as TripWb, v.gps) : null;
  const eta = v.eta || wbEta;
  const catBadge: Record<string, { l: string; c: string }> = {
    wb: { l: v.subStatus === "waiting" ? "🟡 Ждёт рейса" : "🟢 В рейсе", c: v.subStatus === "waiting" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    rf: { l: "🔵 РФ", c: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    free: { l: "⚪ Свободна", c: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
  };
  const b = catBadge[v.category];
  const etaColorCls = eta?.color?.startsWith("text-") ? eta.color : eta?.color ? `text-${eta.color}-500` : "";

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 hover:shadow-md transition cursor-pointer text-gray-900 dark:text-gray-100" onClick={onClick}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm">{v.license_plate}</span>
          {v.gps ? <span className={`text-xs ${v.gps.speed > 5 ? "text-green-500" : "text-gray-400"}`}>{v.gps.speed > 5 ? `🟢 ${v.gps.speed}` : "🔵"}</span> : <span className="text-xs text-gray-400">❓</span>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.c}`}>{b.l}</span>
      </div>
      {v.brand && <div className="text-xs text-gray-500 dark:text-gray-400">{v.brand} {v.model}</div>}
      {v.hired && <div className="text-xs text-blue-500">Наёмный</div>}

      {/* WB Active */}
      {v.trip?.type === "wb" && (v.trip as TripWb).status === "active" && (() => { const t = v.trip as TripWb; return (
        <div className="mt-2 text-xs space-y-0.5">
          <div className="font-medium">{t.driver}</div>
          <div className="text-gray-500 dark:text-gray-400">{t.src} → {parseDest(t.route||null)}</div>
          <div className="flex justify-between items-center">
            <span>{fmt(t.plan_km)} км{eta?.remaining_km != null ? ` · ост. ${eta.remaining_km} км` : ""}</span>
            {eta && <span className={etaColorCls}>{eta.emoji} {eta.label}</span>}
          </div>
          {eta?.eta && <div className="text-gray-400">ETA: {fmtDt(eta.eta)} МСК</div>}
        </div>
      ); })()}

      {/* WB Waiting */}
      {v.trip?.type === "wb" && (v.trip as TripWb).status === "waiting" && (() => { const t = v.trip as TripWb; return (
        <div className="mt-2 text-xs space-y-0.5">
          <div className="font-medium">{t.driver}</div>
          <div className="text-gray-500 dark:text-gray-400">Завершил: {t.src} → {parseDest(t.route||null)}</div>
          <div className="flex justify-between">
            <span className="text-gray-400">Закрыт {fmtDt(t.close_dt||null)}</span>
            {t.total_price && <span className="text-green-600 dark:text-green-400">{fmtMoney(Number(t.total_price))}</span>}
          </div>
        </div>
      ); })()}

      {/* RF — full card */}
      {v.trip?.type === "rf" && (() => { const t = v.trip as TripRf; return (
        <div className="mt-2 text-xs space-y-0.5">
          <div className="font-medium">{t.driver || "Водитель не назначен"}</div>
          <div className="text-gray-500 dark:text-gray-400">📦 {t.route}</div>
          {t.contractor && <div className="text-gray-400 truncate" title={t.contractor}>🏢 {t.contractor}</div>}
          <div className="flex justify-between items-center">
            <span className="text-gray-400">📅 {fmtDate(t.loading_date||null)} → {fmtDate(t.unloading_date||null)}</span>
            {t.amount && <span className="text-green-600 dark:text-green-400">{fmtMoney(Number(t.amount))}</span>}
          </div>
          {eta && (
            <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-100 dark:border-gray-700">
              <span>{eta.remaining_km != null ? `📍 ${eta.remaining_km} км${eta.destination_city ? ` до ${eta.destination_city}` : ""}` : ""}</span>
              <span className={etaColorCls}>{eta.emoji} {eta.label}</span>
            </div>
          )}
          {eta?.eta && <div className="text-gray-400">ETA: {fmtDt(eta.eta)} МСК</div>}
        </div>
      ); })()}

      {/* Free */}
      {v.category === "free" && v.gps?.address && <div className="mt-2 text-xs text-gray-400 truncate" title={v.gps.address}>📍 {v.gps.address}</div>}
    </div>
  );
}

/* ── Planning Tab ── */
function PlanningTab({ vehicles }: { vehicles: Vehicle[] }) {
  const [filter, setFilter] = useState<"all" | "wb" | "rf">("all");

  const planned = useMemo(() => {
    const inTransit = vehicles.filter(v => (v.category === "wb" && v.subStatus === "active") || v.category === "rf");
    let list = filter === "all" ? inTransit : inTransit.filter(v => v.category === filter);
    return list
      .filter(v => v.eta?.eta)
      .sort((a, b) => new Date(a.eta!.eta!).getTime() - new Date(b.eta!.eta!).getTime());
  }, [vehicles, filter]);

  // Group by day
  const groups = useMemo(() => {
    const m = new Map<string, Vehicle[]>();
    for (const v of planned) {
      const d = new Date(v.eta!.eta!).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", weekday: "short", day: "2-digit", month: "2-digit" });
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(v);
    }
    return m;
  }, [planned]);

  const noEta = useMemo(() => {
    const inTransit = vehicles.filter(v => (v.category === "wb" && v.subStatus === "active") || v.category === "rf");
    return inTransit.filter(v => !v.eta?.eta);
  }, [vehicles]);

  const fc = (f: "all"|"wb"|"rf") => `px-3 py-1 rounded text-xs font-medium ${filter === f ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className={fc("all")} onClick={() => setFilter("all")}>Все</button>
        <button className={fc("wb")} onClick={() => setFilter("wb")}>🟣 ВБ</button>
        <button className={fc("rf")} onClick={() => setFilter("rf")}>🔵 РФ</button>
        <span className="text-sm text-gray-400 ml-2">{planned.length} машин с ETA</span>
      </div>

      {Array.from(groups).map(([day, vlist]) => (
        <div key={day}>
          <h3 className="text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">📅 {day} ({vlist.length} машин)</h3>
          <div className="space-y-1">
            {vlist.map(v => {
              const etaColor = v.eta?.color?.startsWith("text-") ? v.eta.color : v.eta?.color ? `text-${v.eta.color}-500` : "";
              const destCity = v.eta?.destination_city || (v.trip?.type === "wb" ? parseDest((v.trip as TripWb).route||null) : "");
              return (
                <div key={v.id} className="flex items-center gap-3 p-2 rounded bg-gray-50 dark:bg-gray-800 text-sm">
                  <span className="font-mono font-bold w-24 shrink-0">{v.license_plate}</span>
                  <span className="w-8">{v.category === "wb" ? "🟣" : "🔵"}</span>
                  <span className="w-28 text-gray-500 dark:text-gray-400">{fmtDt(v.eta?.eta||null)} МСК</span>
                  <span className="flex-1 truncate">{destCity}</span>
                  <span className="w-20 text-right text-gray-400">{v.eta?.remaining_km != null ? `~${v.eta.remaining_km} км` : ""}</span>
                  <span className={`w-32 text-right ${etaColor}`}>{v.eta?.emoji} {v.eta?.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {noEta.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2 text-gray-400">❓ Без ETA ({noEta.length})</h3>
          <div className="space-y-1">
            {noEta.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-2 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-400">
                <span className="font-mono font-bold w-24">{v.license_plate}</span>
                <span className="w-8">{v.category === "wb" ? "🟣" : "🔵"}</span>
                <span className="flex-1">{v.trip?.driver} — {v.trip?.type === "rf" ? (v.trip as TripRf).route : (v.trip as TripWb).route}</span>
                <span>Нет GPS / данных</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {planned.length === 0 && noEta.length === 0 && <div className="p-8 text-center text-gray-400">Нет машин в рейсе</div>}
    </div>
  );
}

/* ── Alerts Table (detailed) ── */
function AlertsTable({ alerts, onMapClick }: { alerts: Alert[]; onMapClick: (a: Alert) => void }) {
  if (!alerts.length) return null;
  const typeBadge: Record<string, string> = { wb: "🟣 ВБ", rf: "🔵 РФ", free: "⚪" };
  return (
    <div className="mt-4">
      <h3 className="text-sm font-bold mb-2 text-orange-600 dark:text-orange-400">⚠️ Требуют внимания ({alerts.length})</h3>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition" onClick={() => onMapClick(a)}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-gray-900 dark:text-gray-100">{a.plate}</span>
                <span className="text-xs">{typeBadge[a.type]}</span>
                {a.driver && <span className="text-gray-600 dark:text-gray-400 text-xs">| {a.driver}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-red-600 dark:text-red-400">{a.problem}</span>
                {a.gps?.lat && <span className="text-blue-500">📍</span>}
              </div>
            </div>
            {(a.route_from || a.route_to) && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                📦 {a.route_from || "?"} → {a.route_to ? parseDest(a.route_to) : "?"}{a.plan_km ? ` | ${fmt(a.plan_km)} км` : ""}
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs mt-1">
              {a.open_dt && <span className="text-gray-500 dark:text-gray-400">📅 Погрузка: {fmtDt(a.open_dt)}</span>}
              {a.transit_hours && <span className="text-gray-500 dark:text-gray-400">🕐 Транзит: ~{a.transit_hours}ч</span>}
              {a.deadline && <span className="text-gray-500 dark:text-gray-400">⏰ Дедлайн: {a.deadline}</span>}
              {a.eta && <span className="text-gray-500 dark:text-gray-400">📍 ETA: {fmtDt(a.eta)} МСК</span>}
            </div>
            {a.reason && <div className="text-xs mt-1 text-yellow-700 dark:text-yellow-400">{a.reason}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Page ── */
export default function DispatchPage() {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<MainTab>("wb");
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const [q, setQ] = useState("");
  const [mapV, setMapV] = useState<Vehicle | null>(null);

  const load = useCallback(async () => {
    // Load fleet first — show data immediately, then load stats in background
    const today = new Date().toISOString().slice(0,10);
    try {
      const f = await apiFetchJson("/api/wb-dispatch/fleet-status");
      setFleet(f);
    } catch (e) { console.error('[dispatch/wb] fleet-status error:', e); }
    setLoading(false);
    // Stats loads independently in background — does not block render
    apiFetchJson(`/api/wb-dispatch/stats?from=${today}&to=${today}`)
      .then(s => setStats(s))
      .catch(e => console.warn('[dispatch/wb] stats (non-blocking):', e));
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => { if (!auto) return; const id = setInterval(load, 300_000); return () => clearInterval(id); }, [auto, load]);

  const list = useMemo(() => {
    if (!fleet) return [];
    let r = tab === "planning" ? [] : fleet.vehicles.filter(v => v.category === tab);
    if (q) { const lq = q.toLowerCase(); r = r.filter(v => v.license_plate.toLowerCase().includes(lq) || v.trip?.driver?.toLowerCase().includes(lq) || v.brand?.toLowerCase().includes(lq)); }
    r.sort((a, b) => { if (a.subStatus === "active" && b.subStatus !== "active") return -1; if (b.subStatus === "active" && a.subStatus !== "active") return 1; return a.license_plate.localeCompare(b.license_plate, "ru"); });
    return r;
  }, [fleet, tab, q]);

  const tc = (t: MainTab) => `px-4 py-3 font-medium text-sm transition border-b-2 whitespace-nowrap ${tab === t ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`;

  const handleAlertMap = (a: Alert) => {
    if (!a.gps?.lat || !fleet) return;
    const v = fleet.vehicles.find(v => v.license_plate === a.plate);
    if (v) setMapV(v);
  };

  return (
    <div className="p-4 max-w-[1400px] mx-auto text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">🚛 Диспетчерская</h1>
        <label className="flex items-center gap-1 text-sm cursor-pointer text-gray-600 dark:text-gray-400">
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Обновление (5м)
        </label>
      </div>

      {/* Dashboard */}
      {fleet && stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {[
            { icon: "🟢", label: "ВБ в рейсе", val: fleet.wb_active, sub: fleet.wb_late ? `🔴 ${fleet.wb_late} опозд.` : "", bg: "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20" },
            { icon: "🟡", label: "ВБ ждёт", val: fleet.wb_waiting, bg: "border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20" },
            { icon: "🔵", label: "РФ", val: fleet.rf, sub: fleet.rf_late ? `🔴 ${fleet.rf_late} опозд.` : "", bg: "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20" },
            { icon: "⚪", label: "Свободные", val: fleet.free, bg: "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40" },
            { icon: "💰", label: "Выручка WB", val: fmtMoney(stats.revenue), bg: "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20" },
            { icon: "📏", label: "Пробег WB", val: fmt(stats.total_km) + " км", bg: "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20" },
          ].map((c, i) => (
            <div key={i} className={`rounded-lg border p-3 ${c.bg}`}>
              <div className="text-lg">{c.icon}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{c.label}</div>
              <div className="text-xl font-bold mt-1">{c.val}</div>
              {c.sub && <div className="text-xs mt-0.5 text-red-500">{c.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {fleet && fleet.alerts?.length > 0 && <AlertsTable alerts={fleet.alerts} onMapClick={handleAlertMap} />}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mt-4 overflow-x-auto">
        <button className={tc("wb")} onClick={() => setTab("wb")}>🟣 ВБ ({fleet?.wb ?? 0})</button>
        <button className={tc("rf")} onClick={() => setTab("rf")}>🔵 РФ ({fleet?.rf ?? 0})</button>
        <button className={tc("free")} onClick={() => setTab("free")}>⚪ Свободные ({fleet?.free ?? 0})</button>
        <button className={tc("planning")} onClick={() => setTab("planning")}>📅 Планирование</button>
      </div>

      {/* Search (not for planning) */}
      {tab !== "planning" && (
        <div className="py-3 flex gap-2 items-center">
          <input placeholder="Поиск: номер, водитель, марка..." value={q} onChange={e => setQ(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm w-72 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400" />
          <span className="text-sm text-gray-400">{list.length} машин</span>
        </div>
      )}

      {/* Content */}
      {loading ? <div className="p-8 text-center text-gray-400">Загрузка...</div> : tab === "planning" ? (
        fleet && <PlanningTab vehicles={fleet.vehicles} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {list.map(v => <VCard key={v.id} v={v} onClick={() => setMapV(v)} />)}
          {!list.length && <div className="col-span-full p-8 text-center text-gray-400">{tab === "wb" ? "Нет машин на ВБ" : tab === "rf" ? "Нет заявок РФ" : "Все машины заняты 🎉"}</div>}
        </div>
      )}

      {mapV && <MapModal v={mapV} onClose={() => setMapV(null)} />}
    </div>
  );
}
