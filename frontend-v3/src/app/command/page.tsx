"use client";
import { useState, useCallback, useEffect } from "react";
import {
  RefreshCw, Truck, AlertTriangle, Activity,
  Wrench, ChevronRight, ChevronDown,
  WifiOff, MapPin, Users, DollarSign, Fuel, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { apiFetch, apiFetchJson } from "@/shared/utils/apiFetch";
import { usePolling } from "@/shared/hooks/usePolling";

const fmt = (n: number) => n ? new Intl.NumberFormat("ru-RU").format(Math.round(n)) : "0";
const fmtK = (n: number) => {
  if (!n) return "0";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "М";
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + "К";
  return fmt(n);
};
const shortName = (name: string) => {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[0] + " " + parts.slice(1).map(w => w[0] + ".").join("") : name;
};

interface AlertVehicle { plate: string; driver?: string | null; duration?: string; detail?: string; speed?: number; }
interface Alert { type: string; severity: string; count?: number; message: string; vehicles?: AlertVehicle[]; vehicle?: string; driver?: string; delay?: string; detail?: string; }

interface FleetVehicle {
  plate: string; license_plate?: string; category: string; driver?: string; vehicle_type?: string;
  trip?: { type?: string; driver?: string; route?: string; route_from?: string; route_to?: string; amount?: number; status?: string; };
  gps?: { lat: number; lon: number; speed: number; address?: string; gps_time?: string; };
}
interface FleetStatus { wb: number; rf: number; free: number; vehicles: FleetVehicle[]; alerts: any[]; }

interface DashData {
  fleet: {
    total: number; tonnage5t: number; tonnage20t: number;
    onLine: number; moving: number; stopped: number; repair: number;
    wbVehicles: number; rfVehicles: number; freeVehicles: number;
    driversActive: number; driversAssigned: number;
  };
  directions: {
    wb: { vehicles: number; trips: number; revenue: number; avgTrip: number };
    rf: { vehicles: number; trips: number; revenue: number; avgTrip: number };
  };
  alerts: Alert[];
  finances: {
    accrued: number; toPay: number; wbRevenue: number; rfRevenue: number;
    fuelCost: number; fuelLiters: number; prevAccrued: number; prevToPay: number; isCurrentMonth?: boolean;
  };
  staffing: { unstaffed: { plate: string }[]; total: number; staffed: number };
  gps: { moving: number; stopped: number; noData: number };
  tenders: { active: number };
  lastTrips?: Record<string, { route?: string; date?: string; src?: string }>;
  repairs: number;
}

// Expandable card detail panel
function DetailPanel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="mt-2 bg-slate-900/80 border border-slate-700/50 rounded-lg p-3 max-h-[60vh] overflow-y-auto">
      {children}
    </div>
  );
}

function VehicleRow({ v, showCategory }: { v: FleetVehicle; showCategory?: boolean }) {
  const speed = v.gps?.speed || 0;
  const statusIcon = speed > 5 ? "🟢" : v.gps ? "🔵" : "⚪";
  const cat = v.category === "wb" ? "ВБ" : v.category === "rf" ? "РФ" : "—";
  return (
    <div className="flex items-center gap-2 text-xs py-1 border-b border-slate-800/50 last:border-0">
      <span>{statusIcon}</span>
      <span className="font-mono text-slate-300 w-20 shrink-0">{v.plate}</span>
      {showCategory && <span className={`w-6 shrink-0 ${v.category === 'wb' ? 'text-purple-400' : v.category === 'rf' ? 'text-blue-400' : 'text-slate-500'}`}>{cat}</span>}
      <span className="text-slate-400 truncate flex-1">{v.driver ? shortName(v.driver) : "—"}</span>
      {(v.trip?.route || v.trip?.route_to) && <span className="text-slate-500 truncate max-w-[120px]">→ {(v.trip?.route || v.trip?.route_to || "").split(' - ').pop()?.trim()}</span>}
      {speed > 5 && <span className="text-green-400 w-12 text-right">{Math.round(speed)} км/ч</span>}
    </div>
  );
}

function StoppedRow({ v, fleet, lastTrip }: { v: FleetVehicle; fleet: FleetVehicle[]; lastTrip?: { route?: string; date?: string; src?: string } }) {
  const gpsAge = v.gps?.gps_time ? (Date.now() - new Date(v.gps.gps_time).getTime()) / 3600000 : 999;
  const freeDays = gpsAge / 24;
  const urgency = freeDays > 3 ? "text-red-400" : freeDays > 1 ? "text-amber-400" : "text-slate-400";
  const freeLabel = freeDays > 1 ? `${Math.floor(freeDays)}д` : gpsAge > 1 ? `${Math.floor(gpsAge)}ч` : "<1ч";
  const cat = v.category === "wb" ? "ВБ" : v.category === "rf" ? "РФ" : "Св.";

  // Extract last city from route
  const lastCity = lastTrip?.route
    ? (lastTrip.route.includes('→')
      ? lastTrip.route.split('→').pop()?.trim().split(/\s+/).slice(0, 2).join(' ')
      : lastTrip.route.split(' - ').pop()?.trim().replace(/^г\.\s*/, '').split(/\s+/).slice(0, 2).join(' '))
    : null;
  const lastDate = lastTrip?.date ? new Date(lastTrip.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : null;
  const lastSrc = lastTrip?.src === 'wb' ? 'ВБ' : lastTrip?.src === 'rf' ? 'РФ' : null;

  return (
    <div className="py-1.5 border-b border-slate-800/50 last:border-0">
      <div className="flex items-center gap-2 text-xs">
        <span className={`w-5 shrink-0 ${v.category === 'free' ? urgency : 'text-slate-500'}`}>{v.category === 'free' ? (freeDays > 3 ? "🔴" : freeDays > 1 ? "🟡" : "🔵") : "📦"}</span>
        <span className="font-mono text-slate-300 w-20 shrink-0">{v.plate}</span>
        <span className={`w-6 shrink-0 ${v.category === 'wb' ? 'text-purple-400' : v.category === 'rf' ? 'text-blue-400' : urgency}`}>{cat}</span>
        {v.category === 'free' && <span className={`${urgency} font-semibold w-10`}>{freeLabel}</span>}
        <span className="text-slate-400 truncate flex-1">{v.driver ? shortName(v.driver) : "—"}</span>
      </div>
      {v.category === 'free' && lastTrip && (
        <div className="text-[11px] text-slate-500 ml-7 mt-0.5">
          {lastSrc && <span className={lastSrc === 'ВБ' ? 'text-purple-500' : 'text-blue-500'}>{lastSrc}</span>}
          {lastCity && <span className="ml-1">· {lastCity}</span>}
          {lastDate && <span className="ml-1">· {lastDate}</span>}
        </div>
      )}
    </div>
  );
}

function AlertBlock({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false);
  const vehicles = alert.vehicles || [];
  const hasDetail = vehicles.length > 0 || alert.vehicle;
  const SEV: Record<string, string> = {
    critical: "border-l-red-500 bg-red-950/40",
    warning: "border-l-amber-500 bg-amber-950/30",
    info: "border-l-blue-500 bg-blue-950/30",
  };
  return (
    <div className={`border-l-4 rounded-r-lg p-3 ${SEV[alert.severity] || SEV.info}`}>
      <div className={`flex items-center justify-between ${hasDetail ? 'cursor-pointer' : ''}`} onClick={() => hasDetail && setExpanded(!expanded)}>
        <span className="text-sm font-medium">{alert.message}</span>
        {hasDetail && (expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
      </div>
      {expanded && vehicles.length > 0 && (
        <div className="mt-2 space-y-1 ml-2">
          {vehicles.map((v, i) => (
            <div key={i} className="text-xs text-slate-400 flex gap-2">
              <span className="font-mono text-slate-300">{v.plate}</span>
              {v.driver && <span>{shortName(v.driver)}</span>}
              {v.duration && <span className="text-slate-500">{v.duration}</span>}
              {v.detail && <span className="text-amber-400">{v.detail}</span>}
            </div>
          ))}
        </div>
      )}
      {expanded && alert.vehicle && !vehicles.length && (
        <div className="mt-2 ml-2 text-xs text-slate-400">
          <span className="font-mono text-slate-300">{alert.vehicle}</span>
          {alert.driver && <span className="ml-2">{shortName(alert.driver)}</span>}
          {alert.detail && <span className="ml-2 text-slate-500">{alert.detail}</span>}
          {alert.delay && <span className="ml-2 text-red-400">{alert.delay}</span>}
        </div>
      )}
    </div>
  );
}

function ExpandableStatCard({ icon, label, value, sub, color = "text-white", children }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string; children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = !!children;
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <div className={`${hasChildren ? 'cursor-pointer' : ''}`} onClick={() => hasChildren && setExpanded(!expanded)}>
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
          {hasChildren && <span className="ml-auto text-slate-600">{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</span>}
        </div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
      </div>
      {expanded && children}
    </div>
  );
}

function DirectionCard({ title, emoji, data, color }: {
  title: string; emoji: string; data: { vehicles: number; trips: number; revenue: number; avgTrip: number }; color: string;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{emoji}</span>
        <span className={`font-semibold ${color}`}>{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><div className="text-xs text-slate-500">Машин</div><div className="text-lg font-bold">{data.vehicles}</div></div>
        <div><div className="text-xs text-slate-500">Рейсов</div><div className="text-lg font-bold">{data.trips}</div></div>
        <div><div className="text-xs text-slate-500">Выручка</div><div className="text-lg font-bold text-green-400">{fmtK(data.revenue)}</div></div>
        <div><div className="text-xs text-slate-500">Ср. рейс</div><div className="text-lg font-bold">{fmtK(data.avgTrip)}</div></div>
      </div>
    </div>
  );
}

function FinCard({ label, value, prev, icon, color }: {
  label: string; value: number; prev?: number; icon: React.ReactNode; color: string;
}) {
  const diff = prev ? value - prev : 0;
  const diffPct = prev && prev > 0 ? ((diff / prev) * 100).toFixed(0) : null;
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-slate-400">{label}</span></div>
      <div className={`text-xl font-bold ${color}`}>{fmtK(value)}</div>
      {prev !== undefined && prev > 0 && (
        <div className={`text-xs mt-1 ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {diff >= 0 ? '▲' : '▼'} {diffPct}% vs пр.мес ({fmtK(prev)})
        </div>
      )}
    </div>
  );
}

export default function CommandPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [fleet, setFleet] = useState<FleetStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, fleetRes] = await Promise.all([
        apiFetch("/api/command/dashboard").then(r => r.ok ? r.json() : null),
        apiFetchJson("/api/wb-dispatch/fleet-status").catch(() => null),
      ]);
      if (dashRes) setData(dashRes);
      if (fleetRes) {
        for (const v of (fleetRes.vehicles || [])) {
          if (!v.plate && v.license_plate) v.plate = v.license_plate;
          if (!v.driver && v.trip?.driver) v.driver = v.trip.driver;
        }
        setFleet(fleetRes);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  usePolling(fetchData, 5 * 60 * 1000);

  if (loading && !data) return (
    <div className="flex items-center justify-center h-96">
      <RefreshCw className="animate-spin text-slate-500" size={32} />
    </div>
  );
  if (!data) return <div className="p-6 text-red-400">Ошибка загрузки</div>;

  const f = data.fleet;
  const fin = data.finances;
  const critCount = data.alerts.filter(a => a.severity === 'critical').length;
  const vehicles = fleet?.vehicles || [];

  // Classify vehicles
  const movingVehicles = vehicles.filter(v => (v.gps?.speed || 0) > 5);
  const stoppedVehicles = vehicles.filter(v => (v.gps?.speed || 0) <= 5);
  const wbVehicles = vehicles.filter(v => v.category === 'wb');
  const rfVehicles = vehicles.filter(v => v.category === 'rf');
  const freeVehicles = vehicles.filter(v => v.category === 'free');
  // Sort free vehicles: longest idle first
  const sortedFree = [...freeVehicles].sort((a, b) => {
    const ta = a.gps?.gps_time ? new Date(a.gps.gps_time).getTime() : 0;
    const tb = b.gps?.gps_time ? new Date(b.gps.gps_time).getTime() : 0;
    return ta - tb; // oldest GPS first = longest idle
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Activity size={24} className="text-blue-400" /> Командный центр
        </h1>
        <button onClick={fetchData} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Block 1: Fleet status — expandable cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* ПАРК */}
        <ExpandableStatCard
          icon={<Truck size={18} className="text-blue-400" />}
          label="Парк" value={f.total}
          sub={`5т: ${f.tonnage5t} · 20т: ${f.tonnage20t}`}
          color="text-blue-400"
        >
          <DetailPanel onClose={() => {}}>
            <div className="text-xs text-slate-500 mb-2 font-semibold">5 ТОНН ({f.tonnage5t})</div>
            {vehicles.filter(v => !v.vehicle_type || !['sitrack','sitrak','shacman','54901'].some(t => (v.vehicle_type||'').toLowerCase().includes(t))).map((v, i) => (
              <VehicleRow key={i} v={v} showCategory />
            ))}
            <div className="text-xs text-slate-500 mt-3 mb-2 font-semibold">20 ТОНН ({f.tonnage20t})</div>
            {vehicles.filter(v => v.vehicle_type && ['sitrack','sitrak','shacman','54901'].some(t => (v.vehicle_type||'').toLowerCase().includes(t))).map((v, i) => (
              <VehicleRow key={i} v={v} showCategory />
            ))}
          </DetailPanel>
        </ExpandableStatCard>

        {/* НА ЛИНИИ */}
        <ExpandableStatCard
          icon={<Activity size={18} className="text-green-400" />}
          label="На линии" value={f.onLine}
          sub={`WB: ${f.wbVehicles} · РФ: ${f.rfVehicles}`}
          color="text-green-400"
        >
          <DetailPanel onClose={() => {}}>
            {wbVehicles.length > 0 && <>
              <div className="text-xs text-purple-400 mb-1 font-semibold">WB ({wbVehicles.length})</div>
              {wbVehicles.map((v, i) => <VehicleRow key={i} v={v} />)}
            </>}
            {rfVehicles.length > 0 && <>
              <div className="text-xs text-blue-400 mt-2 mb-1 font-semibold">РФ ({rfVehicles.length})</div>
              {rfVehicles.map((v, i) => <VehicleRow key={i} v={v} />)}
            </>}
            {freeVehicles.length > 0 && <>
              <div className="text-xs text-slate-400 mt-2 mb-1 font-semibold">Свободные ({freeVehicles.length})</div>
              {freeVehicles.slice(0, 5).map((v, i) => <VehicleRow key={i} v={v} />)}
              {freeVehicles.length > 5 && <div className="text-xs text-slate-600 mt-1">+{freeVehicles.length - 5} ещё</div>}
            </>}
          </DetailPanel>
        </ExpandableStatCard>

        {/* СТОЯТ */}
        <ExpandableStatCard
          icon={<MapPin size={18} className="text-amber-400" />}
          label="Стоят" value={stoppedVehicles.length || f.stopped}
          sub={`Свободных: ${f.freeVehicles}`}
          color="text-amber-400"
        >
          <DetailPanel onClose={() => {}}>
            {/* Free vehicles — no active trip */}
            {sortedFree.length > 0 && <>
              <div className="text-xs text-amber-400 mb-1 font-semibold">Свободные ({sortedFree.length})</div>
              {sortedFree.map((v, i) => <StoppedRow key={i} v={v} fleet={vehicles} lastTrip={data?.lastTrips?.[v.plate || v.license_plate || ""]} />)}
            </>}
            {/* WB/RF stopped — have trip but not moving */}
            {(() => {
              const busyStopped = stoppedVehicles.filter(v => v.category !== 'free');
              if (busyStopped.length === 0) return null;
              return <>
                <div className="text-xs text-slate-400 mt-2 mb-1 font-semibold">Ждут загрузки / между рейсами ({busyStopped.length})</div>
                {busyStopped.map((v, i) => <StoppedRow key={i} v={v} fleet={vehicles} lastTrip={data?.lastTrips?.[v.plate || v.license_plate || ""]} />)}
              </>;
            })()}
          </DetailPanel>
        </ExpandableStatCard>

        {/* ВОДИТЕЛИ */}
        <ExpandableStatCard
          icon={<Users size={18} className="text-purple-400" />}
          label="Водители"
          value={`${f.driversAssigned}/${f.driversActive}`}
          sub={`Без машины: ${(f.driversActive || 0) - (f.driversAssigned || 0)}`}
          color="text-purple-400"
        >
          <DetailPanel onClose={() => {}}>
            <div className="text-xs text-slate-500 mb-1 font-semibold">Назначены ({f.driversAssigned})</div>
            {vehicles.filter(v => v.driver).sort((a, b) => (a.driver || "").localeCompare(b.driver || "")).map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-slate-800/50 last:border-0">
                <span className={(v.gps?.speed || 0) > 5 ? "text-green-400" : "text-slate-500"}>{(v.gps?.speed || 0) > 5 ? "🟢" : "📍"}</span>
                <span className="text-slate-300 truncate flex-1">{shortName(v.driver!)}</span>
                <span className="font-mono text-slate-500 w-20">{v.plate}</span>
                <span className={`w-6 ${v.category === 'wb' ? 'text-purple-400' : v.category === 'rf' ? 'text-blue-400' : 'text-slate-600'}`}>
                  {v.category === 'wb' ? 'ВБ' : v.category === 'rf' ? 'РФ' : '—'}
                </span>
              </div>
            ))}
            {(f.driversActive - f.driversAssigned) > 0 && (
              <div className="text-xs text-amber-400 mt-2 font-semibold">Без машины ({f.driversActive - f.driversAssigned})</div>
            )}
          </DetailPanel>
        </ExpandableStatCard>

        {/* РЕМОНТ */}
        <ExpandableStatCard
          icon={<Wrench size={18} className="text-red-400" />}
          label="Ремонт" value={f.repair}
          color={f.repair > 0 ? "text-red-400" : "text-slate-500"}
        >
          {f.repair > 0 ? (
            <DetailPanel onClose={() => {}}>
              <div className="text-xs text-slate-500">Подробности в разделе <Link href="/maintenance" className="text-blue-400 hover:underline">Ремонты</Link></div>
            </DetailPanel>
          ) : undefined}
        </ExpandableStatCard>
      </div>

      {/* Block 2: Directions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">🚛 Направления (текущий месяц)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DirectionCard title="Wildberries" emoji="🟣" data={data.directions.wb} color="text-purple-400" />
          <DirectionCard title="РФ Транспорт" emoji="🇷🇺" data={data.directions.rf} color="text-blue-400" />
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📊</span>
              <span className="font-semibold text-slate-300">Итого</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-slate-500">Машин</div><div className="text-lg font-bold">{f.wbVehicles + f.rfVehicles}</div></div>
              <div><div className="text-xs text-slate-500">Рейсов</div><div className="text-lg font-bold">{data.directions.wb.trips + data.directions.rf.trips}</div></div>
              <div><div className="text-xs text-slate-500">Выручка</div><div className="text-lg font-bold text-green-400">{fmtK(data.directions.wb.revenue + data.directions.rf.revenue)}</div></div>
              <div><div className="text-xs text-slate-500">Свободных</div><div className="text-lg font-bold text-amber-400">{f.freeVehicles}</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Block 3: Alerts */}
      {data.alerts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            ⚠️ Требует внимания
            {critCount > 0 && <span className="ml-2 px-2 py-0.5 bg-red-600 text-white rounded-full text-xs">{critCount}</span>}
          </h2>
          <div className="space-y-2">
            {data.alerts.map((a, i) => <AlertBlock key={i} alert={a} />)}
          </div>
        </div>
      )}

      {/* Block 4: Finances */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          💰 Финансы{fin.isCurrentMonth ? " (в процессе)" : " (текущий месяц)"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <FinCard label="Начислено ЗП" value={fin.accrued} prev={fin.isCurrentMonth ? undefined : fin.prevAccrued}
            icon={<DollarSign size={16} className="text-green-400" />} color="text-green-400" />
          <FinCard label="К выплате" value={fin.toPay} prev={fin.isCurrentMonth ? undefined : fin.prevToPay}
            icon={<TrendingUp size={16} className="text-yellow-400" />} color="text-yellow-400" />
          <FinCard label="Выручка WB" value={fin.wbRevenue}
            icon={<span className="text-sm">🟣</span>} color="text-purple-400" />
          <FinCard label="Выручка РФ" value={fin.rfRevenue || 0}
            icon={<span className="text-sm">🇷🇺</span>} color="text-blue-400" />
          <FinCard label="ГСМ" value={fin.fuelCost}
            icon={<Fuel size={16} className="text-orange-400" />} color="text-orange-400" />
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { href: '/dispatch/wb', label: '📍 Диспетчерская', desc: 'Карта и рейсы' },
          { href: '/salary/summary', label: '💰 Ведомость', desc: 'Зарплата' },
          { href: '/tenders', label: '📋 Тендеры', desc: `${data.tenders.active} активных` },
          { href: '/maintenance', label: '🔧 Ремонты', desc: `${data.repairs} активных` },
        ].map(l => (
          <Link key={l.href} href={l.href} className="bg-slate-800/40 border border-slate-700/30 rounded-lg p-3 hover:bg-slate-800/70 transition">
            <div className="text-sm font-medium">{l.label}</div>
            <div className="text-xs text-slate-500">{l.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
