"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  BarChart3, Clock, Users, Search, ChevronLeft, ChevronRight,
  ArrowUpDown, X, MapPin, Truck, Package, Calendar, AlertTriangle,
  CheckCircle, RefreshCw, Crosshair, Zap, Activity, Wifi, WifiOff,
  Play, Square, Settings, Filter, ChevronDown, ChevronUp, RotateCcw,
  Flame, TrendingUp, Trophy, Target,
} from "lucide-react";
import { apiFetch, apiFetchJson } from "@/shared/utils/apiFetch";
import { usePolling } from "@/shared/hooks/usePolling";
import { useAuth } from "@/components/AuthProvider";
import MultilotTab from './MultilotTab';

const OUR_INN = "6679185730";

// ==================== Types ====================
interface TenderCalc {
  fuel_per_km: number; platon_per_km: number; salary_per_km: number;
  depreciation_per_km: number; other_per_km: number; cost_per_km: number;
  cost_per_trip: number; total_cost: number; avg_fuel_norm: number;
  avg_fuel_price: number; avg_salary_per_day: number;
}

interface Tender {
  id: string; name: string; route_name: string;
  start_point: string; end_point: string; delivery_type: string;
  distance_km: number; tonnage: number; body_volume: number;
  body_type: string; loading_type: string; number_trips: number;
  number_trips_period: string; active_period: number;
  is_round_trip: boolean; current_rate: number; initial_rate: number; is_multilot?: boolean; route_rate?: number; our_bet_status?: string; supplier_bet?: any; type_label?: string;
  route_cost: number; daily_rate: number;
  leader_id: string; leader_name: string; leader_inn: string;
  participants_count: number; start_time: string; end_time: string;
  status: string; calculation: TenderCalc; our_rate_per_km: number;
  profit_per_km: number; profit_per_trip: number;
  we_are_leader: boolean; has_profit: boolean;
  additional_info?: string; min_step?: number;
  forward_rate?: number; return_rate?: number;
  supplier_bet_rate?: number | null;
  is_participating?: boolean;
  is_our_lead?: boolean;
}

interface HistoryItem {
  id: string; name: string; route_name: string;
  start_point: string; end_point: string;
  distance_km: number; tonnage: number;
  initial_rate: number; final_rate: number;
  winner_name: string; winner_inn?: string; participants_count: number;
  finished_at: string;
}

interface FinishedTender {
  id: string; name: string; start_point: string; end_point: string;
  distance_km: number; initial_rate: number; final_rate: number;
  winner_name: string; winner_inn: string; participants_count: number;
  start_time: string; end_time: string; finished_at: string;
  rate_changes: number; unique_leaders: number; last_minute_bids: number;
}

interface RateChange {
  time: string; old_rate: number; new_rate: number;
  leader: string; leader_inn: string;
  participants: number; time_left_seconds: number; drop: number;
}

interface TenderHistory {
  tender_id: string; route: string; start_point: string; end_point: string;
  distance_km: number; initial_rate: number | string; final_rate: number | string;
  total_drop: number; winner: string; winner_inn: string;
  participants: number; start_time: string; end_time: string;
  rate_changes: RateChange[]; last_minute_bids: number; total_changes: number;
}

interface AnalyticsData {
  total_finished: number; avg_drop_per_km: number;
  top_winners: { name: string; wins: number; avg_rate: number; sniper_pct: number; routes: string[] }[];
}

interface SniperStatus {
  active: boolean;
  mode?: string;
  status_text?: string;
  time_left?: number;
  min_rate?: number;
  auto_rebid?: boolean;
  we_are_leader?: boolean;
  current_rate?: number;
  bids_placed?: number;
  bids_count?: number;
  latency_ms?: number;
  last_bid_at?: string;
  error?: string;
  counter_sniper?: boolean;
  counter_window_sec?: number;
  counter_polls?: number;
  counter_fires?: number;
  config?: {
    min_rate?: number;
    step?: number;
    auto_rebid?: boolean;
    sniper_enabled?: boolean;
    counter_sniper?: boolean;
    counter_window_sec?: number;
    counter_poll_ms?: number;
    counter_fallback_sec?: number;
  };
}

type SortField = "profit_per_trip" | "current_rate" | "distance_km" | "end_time" | "participants_count" | "profit_per_km";
type SortDir = "ASC" | "DESC";
type DistanceRange = "all" | "lt170" | "170-500" | "500-1000" | "gt1000";
type MainTab = "active" | "multilots" | "finished" | "analytics";

// ==================== Helpers ====================
function timeLeft(endTime: string): string {
  if (!endTime) return "—";
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return "Завершён";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 24) return `${Math.floor(h / 24)}д ${h % 24}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м ${s}с`;
}

function isUrgent(endTime: string): boolean {
  if (!endTime) return false;
  const diff = new Date(endTime).getTime() - Date.now();
  return diff > 0 && diff < 3 * 60 * 60 * 1000;
}

const fmt = (n: number | null | undefined, d = 0) =>
  n == null || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const fmtMsk = (s: string | null) =>
  s ? new Date(s).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const fmtMskFull = (s: string | null) =>
  s ? new Date(s).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const fmtMskTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }) : "—";

function fmtTimeLeft(seconds: number): string {
  if (seconds > 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}ч ${m}м`;
  }
  if (seconds > 60) {
    const m = Math.floor(seconds / 60);
    return `${m}м`;
  }
  return `${seconds}с 🔥`;
}

function fmtDuration(start: string, end: string): string {
  if (!start || !end) return "—";
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return "—";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}д ${h % 24}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

/** Vehicle class params by tonnage */
function vehicleClass(tonnage: number) {
  if (tonnage >= 10) return { consumption: 34, salary: 14, platon: 3.5, label: "20т" };
  return { consumption: 24, salary: 10, platon: 0, label: "5т" };
}

/** Cost per km for a given tonnage + fuel price (no VAT) */
function calcCostPerKm(tonnage: number, fuelNoVat: number) {
  const vc = vehicleClass(tonnage);
  return vc.consumption * fuelNoVat / 100 + vc.salary + vc.platon;
}

/** Profit for a tender (positive = good). trips_per_day default = 2 */
function profitForTender(t: Tender, fuelNoVat: number = 58.57): number {
  const costKm = calcCostPerKm(t.tonnage || 20, fuelNoVat);
  const dist = Number(t.distance_km) || 0;
  const rate = Number(t.current_rate) || 0;
  if (!rate || !dist) return 0;
  return (rate - costKm) * dist * 2;
}

function rowColor(t: Tender) {
  const p = profitForTender(t);
  const urgent = isUrgent(t.end_time);
  let base = "";
  if (p > 0) base = "bg-green-900/20";
  else if (p < 0) base = "bg-red-900/20";
  else base = "bg-slate-800/40";

  if (urgent) base += " border-l-4 border-yellow-400";
  else if (t.we_are_leader) base += " border-l-4 border-green-500";
  else if (p > 0) base += " border-l-4 border-green-700";
  else if (p < 0) base += " border-l-4 border-red-700";
  else base += " border-l-4 border-slate-600";

  return base;
}

function statusEmoji(t: Tender) {
  if (t.we_are_leader) return "🟢";
  if (!t.current_rate) return "⚪";
  if (t.has_profit) return "🟡";
  return "🔴";
}

// ==================== CountdownTimer ====================
const CountdownTimer = ({ endTime, showMs = false }: { endTime: string; showMs?: boolean }) => {
  const [display, setDisplay] = useState('');
  const [urgency, setUrgency] = useState('normal');

  useEffect(() => {
    if (!endTime) { setDisplay('—'); return; }
    const endMs = new Date(endTime).getTime();
    const update = () => {
      const diff = endMs - Date.now();
      if (diff <= 0) { setDisplay('ЗАВЕРШЁН'); setUrgency('done'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const ms = diff % 1000;
      if (d > 0) {
        setDisplay(`${d}д ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      } else {
        const base = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        setDisplay(showMs ? `${base}.${String(ms).padStart(3,'0')}` : base);
      }
      if (diff < 10000) setUrgency('critical');
      else if (diff < 60000) setUrgency('danger');
      else if (diff < 300000) setUrgency('warning');
      else setUrgency('normal');
    };
    const interval = setInterval(update, showMs ? 50 : 1000);
    update();
    return () => clearInterval(interval);
  }, [endTime, showMs]);

  const colors: Record<string, string> = {
    normal: 'text-white',
    warning: 'text-yellow-400',
    danger: 'text-red-400',
    critical: 'text-red-500 animate-pulse',
    done: 'text-slate-500'
  };

  return <span className={`font-mono font-bold ${colors[urgency] || 'text-white'}`}>⏱ {display}</span>;
};

// ==================== SearchableDropdown ====================
function SearchableDropdown({ options, value, onChange, placeholder }: {
  options: string[]; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div className="relative">
      <div
        className="flex items-center gap-1 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm cursor-pointer min-w-[140px] hover:border-slate-500 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className={`flex-1 truncate ${value ? "text-white" : "text-slate-400"}`}>
          {value || placeholder}
        </span>
        {value ? (
          <X size={14} className="text-slate-400 hover:text-white shrink-0" onClick={e => { e.stopPropagation(); onChange(""); setSearch(""); }} />
        ) : (
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        )}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-64 max-h-60 overflow-hidden">
            <div className="p-2 border-b border-slate-700">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto max-h-48">
              <div
                className="px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-700 cursor-pointer"
                onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              >
                Все
              </div>
              {filtered.map(o => (
                <div
                  key={o}
                  className={`px-3 py-1.5 text-sm cursor-pointer truncate ${o === value ? "bg-blue-600/30 text-blue-300" : "text-white hover:bg-slate-700"}`}
                  onClick={() => { onChange(o); setOpen(false); setSearch(""); }}
                >
                  {o}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500 text-center">Ничего не найдено</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== Sniper Block (Counter-sniper only) ====================
function SniperBlock({ tenderId, costPerKm, minStep, tonnage, externalMinRate, onMinRateChange }: {
  tenderId: string; costPerKm: number; minStep: number; tonnage: number;
  externalMinRate?: number; onMinRateChange?: (v: number) => void;
}) {
  const [status, setStatus] = useState<SniperStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minRate, setMinRate] = useState("");
  const [counterWindow, setCounterWindow] = useState(1.0);
  const [counterFallback, setCounterFallback] = useState(0.3);
  const [configLoaded, setConfigLoaded] = useState(false);

  const minRateRef = useRef<HTMLInputElement>(null);
  const isMinRateEditing = () => minRateRef.current === document.activeElement;

  // Defaults by tonnage
  const defaultMinRate = tonnage >= 10 ? 70 : 55;
  const recommendedLabel = tonnage >= 10 ? "70.00 (20т)" : "55.00 (5т)";

  // Sync external min rate from calculator
  useEffect(() => {
    if (externalMinRate !== undefined && externalMinRate > 0 && !isMinRateEditing()) {
      setMinRate(String(externalMinRate));
    }
  }, [externalMinRate]);

  const loadStatus = useCallback(async () => {
    try {
      const r = await apiFetch(`/api/tenders/sniper/${tenderId}/status`);
      if (r.ok) {
        const d = await r.json();
        setStatus(d);
        if (d.config) {
          const c = d.config;
          if (!configLoaded) {
            if (!isMinRateEditing()) setMinRate(String(c.min_rate || defaultMinRate));
            setCounterWindow(c.counter_window_sec || 1.0);
            setCounterFallback(c.counter_fallback_sec || 0.3);
            setConfigLoaded(true);
          }
        } else if (!configLoaded && !minRate && !isMinRateEditing()) {
          setMinRate(String(d.min_rate || defaultMinRate));
        }
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    }
  }, [tenderId, configLoaded, defaultMinRate]);

  useEffect(() => {
    loadStatus();
    const iv = setInterval(loadStatus, 3000);
    return () => clearInterval(iv);
  }, [loadStatus]);

  const handleStart = async () => {
    const rate = parseFloat(minRate) || defaultMinRate;
    if (rate <= 0) { setError("Укажите минималку"); return; }
    setLoading(true); setError(null);
    try {
      const r = await apiFetch(`/api/tenders/sniper/${tenderId}/start`, {
        method: "POST",
        body: JSON.stringify({
          min_rate: rate, step: 0,
          auto_rebid: false, sniper_enabled: true,
          counter_sniper: true,
          counter_window_sec: counterWindow,
          counter_poll_ms: 20,
          counter_fallback_sec: counterFallback,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка запуска");
      setConfigLoaded(false);
      await loadStatus();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleStop = async () => {
    setLoading(true); setError(null);
    try {
      const r = await apiFetch(`/api/tenders/sniper/${tenderId}/stop`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка остановки");
      setStatus(null); setConfigLoaded(false);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleUpdate = async () => {
    setLoading(true); setError(null);
    try {
      const r = await apiFetch(`/api/tenders/sniper/${tenderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          min_rate: parseFloat(minRate) || defaultMinRate, step: 0,
          auto_rebid: false, sniper_enabled: true,
          counter_sniper: true,
          counter_window_sec: counterWindow,
          counter_poll_ms: 20,
          counter_fallback_sec: counterFallback,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка обновления");
      await loadStatus();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const isActive = status?.active === true;

  return (
    <div className="bg-slate-800/80 border-2 border-purple-700/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Target size={20} className={isActive ? "text-green-400" : "text-purple-400"} />
          Контр-снайпер
        </h3>
        {isActive ? (
          <span className="flex items-center gap-1.5 text-sm bg-green-900/50 text-green-400 px-3 py-1 rounded-full font-medium">
            <Activity size={14} className="animate-pulse" /> Активен
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded-full">
            <WifiOff size={12} /> Неактивен
          </span>
        )}
      </div>

      {/* Status when active */}
      {isActive && status && (
        <div className={`p-3 rounded-lg mb-4 text-sm font-mono ${
          status.mode === 'counter-firing' ? 'bg-red-900/50 text-red-400 animate-pulse' :
          status.mode === 'counter-sniping' ? 'bg-yellow-900/50 text-yellow-400' :
          status.mode === 'done' ? 'bg-green-900/50 text-green-400' :
          'bg-slate-700/50 text-slate-300'
        }`}>
          {status.status_text || status.mode || 'active'}
          {(status.counter_fires || 0) > 0 && (
            <span className="ml-2 text-xs">⚡ Контр-ударов: {status.counter_fires}</span>
          )}
        </div>
      )}

      {/* Min rate field — the ONE required field */}
      <div className="mb-4">
        <label className="text-sm text-slate-300 font-medium mb-1 block">Моя минималка</label>
        <div className="flex items-center gap-2">
          <input type="number" step="0.1" ref={minRateRef}
            value={minRate} placeholder={String(defaultMinRate)}
            onChange={e => { setMinRate(e.target.value); setError(null); }}
            className="flex-1 bg-slate-700 border-2 border-purple-600/50 text-white rounded-lg px-3 py-2.5 text-lg font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none text-center" />
          <span className="text-slate-400 text-sm">₽/км</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">💡 рекомендуем ≥ {recommendedLabel}</div>
        {minRate && costPerKm > 0 && (
          <div className={`text-xs mt-1 ${parseFloat(minRate) > costPerKm ? "text-green-400" : "text-red-400"}`}>
            {parseFloat(minRate) > costPerKm ? "✅" : "⚠️"} профит {(parseFloat(minRate) - costPerKm).toFixed(1)} ₽/км от себестоимости
          </div>
        )}
      </div>

      {error && <div className="text-red-400 text-xs bg-red-900/30 p-2 rounded mb-3">{error}</div>}

      {/* Start / Stop buttons */}
      <div className="flex gap-2 mb-4">
        {!isActive ? (
          <button onClick={handleStart} disabled={loading}
            className="flex-1 py-3 rounded-lg font-bold text-base transition bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 flex items-center justify-center gap-2">
            <Target size={18} /> {loading ? "Запуск..." : "🎯 Запустить"}
          </button>
        ) : (
          <>
            <button onClick={handleUpdate} disabled={loading}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm transition bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">
              <Settings size={14} className="inline mr-1" /> Обновить
            </button>
            <button onClick={handleStop} disabled={loading}
              className="flex-1 py-2.5 rounded-lg font-bold text-sm transition bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
              ⏹ Остановить
            </button>
          </>
        )}
      </div>

      {/* Counters when active */}
      {isActive && status && (
        <div className="flex flex-wrap gap-4 text-xs text-slate-400 mb-3">
          <span>📊 Ставок: {status.bids_count || status.bids_placed || 0}</span>
          <span>📡 Polls: {status.counter_polls || 0}</span>
          <span>⚡ Контр-ударов: {status.counter_fires || 0}</span>
          {status.we_are_leader && <span className="text-green-400 font-bold">🏆 Лидер</span>}
        </div>
      )}

      {/* Settings — collapsed by default */}
      <details className="border border-slate-700 rounded-lg">
        <summary className="px-3 py-2 text-sm text-slate-400 cursor-pointer hover:text-slate-300 select-none">
          ⚙️ Настройки
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Время реакции (сек до конца)</label>
              <input type="number" value={counterWindow} onChange={e => setCounterWindow(parseFloat(e.target.value) || 1)} step="0.1"
                className="w-full bg-slate-700 text-white rounded px-2 py-1 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Fallback (сек)</label>
              <input type="number" value={counterFallback} onChange={e => setCounterFallback(parseFloat(e.target.value) || 0.3)} step="0.1"
                className="w-full bg-slate-700 text-white rounded px-2 py-1 text-sm mt-1" />
            </div>
          </div>
          <div className="text-xs text-slate-600">Шаг ставки: авто (минимальный)</div>
        </div>
      </details>
    </div>
  );
}


// ==================== Active Tender Modal (v2) ====================
function TenderModal({ tender: initialTender, isDirector, fuelPriceNoVat = 58.57, onClose, onBidPlaced }: {
  tender: Tender; isDirector: boolean; fuelPriceNoVat?: number; onClose: () => void; onBidPlaced: () => void;
}) {
  const [t, setT] = useState<Tender>(initialTender);
  const step = t.min_step || 0.1;
  const [sniperMinRate, setSniperMinRate] = useState<number | undefined>(undefined);

  // Manual bid state
  const defaultBidRate = Number((Number(initialTender.current_rate) - step).toFixed(2));
  const [bidRate, setBidRate] = useState(defaultBidRate > 0 ? defaultBidRate : 0);
  const [bidLoading, setBidLoading] = useState(false);
  const [bidResult, setBidResult] = useState<{type:'success'|'error',text:string}|null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [modalRouteHistory, setModalRouteHistory] = useState<any[]>([]);

  // Load route history for this tender
  useEffect(() => {
    const routeId = (initialTender as any).route?.id || '';
    const s = initialTender.start_point || '';
    const e = initialTender.end_point || '';
    if (!routeId && !s) return;
    const params = routeId ? `route_id=${routeId}` : `start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`;
    apiFetchJson(`/api/tenders/route-history?${params}&limit=10`)
      .then(d => setModalRouteHistory(d?.data || []))
      .catch(() => {});
  }, [initialTender.id]);

  // Calculator state
  const tonnage = t.tonnage || 20;
  const isRound = !!t.is_round_trip;
  const rawDist = Number(t.distance_km) || 0;
  const dist = isRound ? rawDist * 2 : rawDist; // round trip = ×2
  const rate = Number(t.current_rate) || 0;

  const autoClass = tonnage >= 10 ? "20t" : "5t";
  const [vClass, setVClass] = useState<"20t"|"5t">(autoClass);
  const [fuelPrice, setFuelPrice] = useState(69); // ₽/л without VAT
  const [fuelConsumption, setFuelConsumption] = useState(tonnage >= 10 ? 34 : 24);
  const [salaryRub, setSalaryRub] = useState(() => { const tn = (initialTender.tonnage || 20); const spk = tn >= 10 ? 14 : 10; const d = Number(initialTender.distance_km) || 0; const dd = initialTender.is_round_trip ? d * 2 : d; return spk * dd; });
  const [salaryPerKm, setSalaryPerKm] = useState(tonnage >= 10 ? 14 : 10);
  const [salaryManual, setSalaryManual] = useState(false);
  const [otherExpenseRub, setOtherExpenseRub] = useState(0);
  const [targetProfit, setTargetProfit] = useState(600000);
  const platon = vClass === "20t" ? 3.5 : 0;

  // Round trip timing
  const [avgSpeed, setAvgSpeed] = useState(60); // km/h
  const [loadUnloadHours, setLoadUnloadHours] = useState(isRound ? 4 : 2);
  const travelHours = avgSpeed > 0 ? dist / avgSpeed : 0;
  const totalCircleHours = travelHours + loadUnloadHours;
  const autoCirclesPerMonth = totalCircleHours > 0 ? Math.floor(30 * 24 / totalCircleHours) : 30;
  const [circlesPerMonth, setCirclesPerMonth] = useState(autoCirclesPerMonth);

  // For non-round: trips per day × work days
  const [tripsPerDay, setTripsPerDay] = useState(Number(t.number_trips) || 2);
  const [workDays, setWorkDays] = useState(22);

  // Auto-calc salary when not manual
  useEffect(() => {
    if (!salaryManual) setSalaryRub(salaryPerKm * dist);
  }, [salaryPerKm, dist, salaryManual]);

  // Auto-calc circles when timing params change
  useEffect(() => {
    if (totalCircleHours > 0) {
      setCirclesPerMonth(Math.floor(30 * 24 / totalCircleHours));
    }
  }, [totalCircleHours]);

  // Update class defaults
  useEffect(() => {
    const c = vClass === "20t" ? { cons: 34, sal: 14 } : { cons: 24, sal: 10 };
    setFuelConsumption(c.cons);
    setSalaryPerKm(c.sal);
    setSalaryManual(false);
  }, [vClass]);

  // Fetch WB detail on open
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/tenders/${initialTender.id}/detail`);
        if (res.ok) {
          const d = await res.json();
          if (d.leader_name || d.leader_inn) {
            setT(prev => ({ ...prev, leader_name: d.leader_name || prev.leader_name, leader_inn: d.leader_inn || prev.leader_inn }));
          }
        }
      } catch {}
    })();
  }, [initialTender.id]);

  // BUG FIX #7: Polling — don't overwrite leader with empty values
  useEffect(() => {
    let prevRate = Number(t.current_rate);
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/tenders/${t.id}`);
        const data = await res.json();
        const tender = data.tender || data;
        if (tender && tender.current_rate !== undefined) {
          setT(prev => ({
            ...prev,
            current_rate: Number(tender.current_rate) || prev.current_rate,
            // BUG FIX: only update leader if new data actually has a value
            leader_name: (tender.leader_name && tender.leader_name !== "—") ? tender.leader_name : prev.leader_name,
            leader_inn: tender.leader_inn || prev.leader_inn,
            participants_count: tender.participants_count ?? prev.participants_count,
            supplier_bet_rate: tender.supplier_bet_rate !== undefined ? tender.supplier_bet_rate : prev.supplier_bet_rate,
            min_step: tender.min_step ?? prev.min_step,
            we_are_leader: tender.is_our_lead ?? prev.we_are_leader,
          }));
          const newRate = Number(tender.current_rate);
          if (newRate !== prevRate && prevRate > 0) {
            const newBid = Number((newRate - (tender.min_step || step)).toFixed(2));
            if (newBid > 0) setBidRate(newBid);
            prevRate = newRate;
          }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [t.id]);

  // Economics calculations
  const fuelPerKm = fuelConsumption * fuelPrice / 100;
  const effectiveSalaryPerKm = dist > 0 ? salaryRub / dist : salaryPerKm;
  const costPerKm = fuelPerKm + effectiveSalaryPerKm + platon;
  const costPerTrip = costPerKm * dist + otherExpenseRub;
  const incomePerTrip = rate * dist;
  const profitPerTrip = incomePerTrip - costPerTrip;

  // Monthly calc depends on round vs normal
  const monthlyMultiplier = isRound ? circlesPerMonth : tripsPerDay * workDays;
  const profitPerMonth = profitPerTrip * monthlyMultiplier;
  const incomePerMonth = incomePerTrip * monthlyMultiplier;
  const profitColor = profitPerMonth > 0
    ? (profitPerMonth < incomePerMonth * 0.05 ? "text-yellow-400" : "text-green-400")
    : "text-red-400";

  // Target profit reverse calc
  const calcTargetRate = (target: number) =>
    dist > 0 ? ((target / monthlyMultiplier) + costPerKm * dist + otherExpenseRub) / dist : 0;
  const targetRate = calcTargetRate(targetProfit);

  // Manual bid handler
  const handleBid = async () => {
    // confirm removed — bid immediately
    setBidLoading(true); setBidResult(null);
    try {
      const r = await apiFetch(`/api/tenders/${t.id}/bid`, {
        method: "POST", body: JSON.stringify({ rate: bidRate }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Ошибка");
      setBidResult({ type: 'success', text: `✅ Ставка принята! ${bidRate} ₽/км` });
      setTimeout(() => setBidResult(prev => prev?.type === 'success' ? null : prev), 5000);
      onBidPlaced();
    } catch (e: any) {
      setBidResult({ type: 'error', text: `❌ ${e.message}` });
    } finally { setBidLoading(false); setShowConfirm(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-xl border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">{statusEmoji(t)} {t.start_point} → {t.end_point}
                    {t.is_multilot && <span className="ml-2 px-2 py-0.5 bg-purple-600/30 text-purple-300 text-xs rounded-full">📋 Мультилот</span>}</h2>
            {t.route_name && <p className="text-sm text-slate-400">{t.route_name}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* ===== 1. Tender Info ===== */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
              <span className="bg-slate-700/50 px-2 py-1 rounded">{fmt(rawDist)} км{isRound ? ` 🔄 (${fmt(dist)} км круг)` : ""}</span>
              <span className="bg-slate-700/50 px-2 py-1 rounded">{tonnage}т • {t.body_type || "тент"}</span>
              <span className="bg-slate-700/50 px-2 py-1 rounded">{t.number_trips || "—"} рейс/{t.number_trips_period || "сут"}</span>
              <span className="bg-slate-700/50 px-2 py-1 rounded">{t.active_period || "—"} дн.</span>
              <BidLogAccordion tenderId={t.id} />
            </div>

            <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
              <div>
                <div className="text-xs text-slate-500">{t.is_multilot ? "Маршрутная ставка WB" : "Ставка"}</div>
                <div className="text-2xl font-bold text-blue-300">{t.is_multilot && t.route_rate ? fmt(t.route_rate, 2) : fmt(rate, 2)} <span className="text-sm text-slate-400">₽/км</span></div>
                {t.is_multilot ? <div className="text-xs text-purple-400">ℹ️ ориентир</div> : <div className="text-xs text-slate-500">Мин. шаг: {step} ₽</div>}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">{t.is_multilot ? "Участники" : "Лидер"}</div>
                {t.is_multilot ? (
                  <div className="text-sm text-purple-300 font-bold">👥 {t.participants_count || 0} участников</div>
                ) : t.is_our_lead || t.we_are_leader ? (
                  <div className="text-green-400 font-bold text-sm">🏆 Вы лидер!</div>
                ) : (
                  <div className="text-sm text-white truncate max-w-[180px]">{t.leader_name || "—"}</div>
                )}
                {t.supplier_bet_rate != null && (
                  <div className={`text-xs font-bold ${(t.is_our_lead || t.we_are_leader) ? 'text-green-400' : 'text-red-400'}`}>
                    Наша: {t.supplier_bet_rate} ₽/км
                  </div>
                )}
              </div>
            </div>

            {/* Big countdown */}
            <div className="text-center py-2">
              <div className="text-3xl font-bold"><CountdownTimer endTime={t.end_time} showMs={true} /></div>
            </div>
          </div>

          {/* ===== 2. Counter-sniper (hidden for multilots) ===== */}
          {isDirector && !t.is_multilot && (
            <SniperBlock tenderId={t.id} costPerKm={costPerKm} minStep={step}
              tonnage={tonnage} externalMinRate={sniperMinRate} onMinRateChange={setSniperMinRate} />
          )}

          {/* ===== 3. Manual Bid (hidden for multilots) ===== */}
          {isDirector && !t.is_multilot && (
            <div className="border border-blue-700/50 rounded-xl p-4 bg-blue-900/10">
              <h3 className="font-bold text-sm mb-3 text-blue-300 flex items-center gap-2">
                <Zap size={14} /> Ручная ставка
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-400">Ставка ₽/км (шаг: {step})</label>
                  <div className="flex items-center gap-1 mt-1">
                    <button onClick={() => setBidRate(prev => Number((prev - step).toFixed(2)))}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-lg font-bold text-white">▼</button>
                    <input type="number" step={0.1} value={bidRate}
                      onChange={e => { setBidRate(Number(e.target.value)); setBidResult(null); setShowConfirm(false); }}
                      className="flex-1 bg-slate-700 border-2 border-blue-600 rounded-lg px-3 py-2 text-lg font-bold text-white text-center focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    <button onClick={() => setBidRate(prev => Number((prev + step).toFixed(2)))}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-lg font-bold text-white">▲</button>
                  </div>
                </div>
                <div className="text-center text-sm">
                  <div className="text-slate-400">Рейс:</div>
                  <div className="font-bold text-lg text-white">{bidRate ? fmt(Math.round(bidRate * dist)) : "—"} ₽</div>
                </div>
              </div>
              
              {bidResult && (
                <div className={`mt-2 p-2 rounded-lg text-sm ${bidResult.type === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                  {bidResult.text}
                </div>
              )}
              <button onClick={handleBid} disabled={bidLoading || !bidRate}
                className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition">
                {bidLoading ? "Отправка..." : "⚡ Поставить ставку"}
              </button>
            </div>
          )}

          {/* ===== 4. Economics — collapsed ===== */}
          <details className="border border-slate-700 rounded-xl">
            <summary className="px-4 py-3 text-sm font-medium text-slate-300 cursor-pointer hover:text-white select-none">
              📊 Экономика рейса {isRound && "🔄"}
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-3">
              {/* Vehicle class */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Класс:</span>
                {(["5t", "20t"] as const).map(cls => (
                  <button key={cls} onClick={() => setVClass(cls)}
                    className={`px-3 py-1 rounded text-xs font-bold transition ${vClass === cls ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400"}`}>
                    {cls === "20t" ? "20т" : "5т"}
                  </button>
                ))}
              </div>

              {/* Cost breakdown */}
              <div className="bg-slate-900 rounded-lg p-3 space-y-2 text-sm">
                {/* Fuel */}
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 font-medium">Топливо</div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Цена ДТ:</span>
                    <input type="number" step="1" min="0" value={fuelPrice}
                      onChange={e => setFuelPrice(parseFloat(e.target.value) || 0)}
                      className="w-16 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white text-center" />
                    <span>₽/л</span>
                    <span className="mx-1">•</span>
                    <span>Расход:</span>
                    <input type="number" step="1" min="0" value={fuelConsumption}
                      onChange={e => setFuelConsumption(parseFloat(e.target.value) || 0)}
                      className="w-14 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white text-center" />
                    <span>л/100км</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Итого топливо:</span>
                    <span className="text-white font-medium">{fuelPerKm.toFixed(2)} ₽/км</span>
                  </div>
                </div>

                {/* Salary */}
                <div className="flex justify-between items-center text-slate-400">
                  <span>ЗП водителя</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setSalaryRub(v => Math.max(0, v - 500)); setSalaryManual(true); }}
                      className="px-1.5 py-0.5 bg-slate-700 rounded text-xs hover:bg-slate-600">−</button>
                    <input type="number" step="100" min="0" value={Math.round(salaryRub)}
                      onChange={e => { setSalaryRub(parseFloat(e.target.value) || 0); setSalaryManual(true); }}
                      className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white text-center" />
                    <span className="text-xs">₽</span>
                    <button onClick={() => { setSalaryRub(v => v + 500); setSalaryManual(true); }}
                      className="px-1.5 py-0.5 bg-slate-700 rounded text-xs hover:bg-slate-600">+</button>
                  </div>
                </div>
                <div className="text-xs text-slate-600 text-right">
                  ({salaryPerKm}₽/км × {fmt(dist)}км)
                  {salaryManual && <button onClick={() => setSalaryManual(false)} className="ml-2 text-blue-400 hover:underline">сброс</button>}
                </div>

                {/* Platon */}
                {platon > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Платон</span>
                    <span className="text-white">{platon} ₽/км</span>
                  </div>
                )}

                {/* Other */}
                <div className="flex justify-between items-center text-slate-400">
                  <span>Прочие расходы</span>
                  <div className="flex items-center gap-1">
                    <input type="number" step="100" min="0" value={otherExpenseRub}
                      onChange={e => setOtherExpenseRub(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-white text-center" />
                    <span className="text-xs">₽/рейс</span>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-2 flex justify-between font-bold">
                  <span className="text-slate-300">Себестоимость</span>
                  <span className="text-white">{costPerKm.toFixed(2)} ₽/км • {fmt(Math.round(costPerTrip))} ₽/рейс</span>
                </div>
              </div>

              {/* Round trip timing OR normal trips */}
              {isRound ? (
                <div className="bg-slate-900 rounded-lg p-3 space-y-2 text-sm">
                  <div className="text-xs text-slate-500 font-medium">🔄 Время на круг</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>В пути:</span>
                    <span className="text-white font-medium">{travelHours.toFixed(1)} ч</span>
                    <span>({fmt(dist)} км ÷</span>
                    <input type="number" step="5" min="10" value={avgSpeed}
                      onChange={e => setAvgSpeed(Math.max(10, parseFloat(e.target.value) || 60))}
                      className="w-12 bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white text-center" />
                    <span>км/ч)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Погрузка/разгрузка:</span>
                    <input type="number" step="0.5" min="0" value={loadUnloadHours}
                      onChange={e => setLoadUnloadHours(parseFloat(e.target.value) || 0)}
                      className="w-12 bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white text-center" />
                    <span>ч</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Итого на круг: <span className="text-white font-bold">{totalCircleHours.toFixed(1)} ч</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Кругов в месяц:</span>
                    <input type="number" step="1" min="1" value={circlesPerMonth}
                      onChange={e => setCirclesPerMonth(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white text-center font-bold" />
                    <span className="text-slate-600">(авто: {autoCirclesPerMonth})</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <input type="number" step="1" min="1" max="10" value={tripsPerDay}
                      onChange={e => setTripsPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white text-center" />
                    <span>рейсов/сут ×</span>
                    <input type="number" step="1" min="1" max="31" value={workDays}
                      onChange={e => setWorkDays(Math.max(1, parseInt(e.target.value) || 22))}
                      className="w-12 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white text-center" />
                    <span>рабочих дней</span>
                  </div>
                </div>
              )}

              {/* Profit summary */}
              <div className="bg-slate-900 rounded-lg p-3 space-y-1 text-sm">
                <div className="text-xs text-slate-500 mb-1">
                  По ставке {rate.toFixed(2)} ₽/км • {isRound ? `${circlesPerMonth} кругов/мес` : `${tripsPerDay} × ${workDays} дн.`}
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Выручка/мес:</span>
                  <span className="text-white">{fmt(Math.round(incomePerMonth))} ₽</span>
                </div>
                <div className={`flex justify-between font-bold text-base ${profitColor}`}>
                  <span>Профит/мес:</span>
                  <span>{profitPerMonth >= 0 ? "+" : ""}{fmt(Math.round(profitPerMonth))} ₽</span>
                </div>
              </div>

              {/* Target profit */}
              <div className="bg-slate-900 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">🎯 Целевой профит:</span>
                  <input type="number" step="50000" min="0" value={targetProfit}
                    onChange={e => setTargetProfit(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-28 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-white text-center" />
                  <span className="text-slate-500">₽/мес</span>
                </div>
                <div className="text-sm">
                  <span className="text-slate-400">⛔ Мин. ставка: </span>
                  <span className="font-bold text-white">{targetRate.toFixed(2)} ₽/км</span>
                  {rate > 0 && (
                    <span className={`ml-2 text-xs ${rate >= targetRate ? "text-green-400" : "text-red-400"}`}>
                      {rate >= targetRate ? "✅" : "❌"} {rate >= targetRate ? "запас" : "дефицит"} {Math.abs(rate - targetRate).toFixed(2)} ₽/км
                    </span>
                  )}
                </div>
                {isDirector && (
                  <button onClick={() => setSniperMinRate(parseFloat(targetRate.toFixed(1)))}
                    className="w-full mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-bold transition">
                    🎯 Установить {targetRate.toFixed(1)} ₽/км как минималку снайпера
                  </button>
                )}
              </div>
            </div>
          </details>

          {/* ===== 5. Route History ===== */}
          {modalRouteHistory.length > 0 && (
            <div className="border border-slate-700 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-bold text-white">📊 ИСТОРИЯ МАРШРУТА</h3>
              <table className="w-full text-xs">
                <thead><tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left p-1">Дата</th><th className="text-left p-1">Тип</th>
                  <th className="text-right p-1">Ставка</th><th className="text-right p-1">Уч.</th>
                  <th className="text-left p-1">Победитель</th>
                </tr></thead>
                <tbody>
                  {modalRouteHistory.map((h: any, i: number) => {
                    const isUs = h.winner_inn === '6679185730' || (h.winner_name || '').includes('ТРАНСПОРТНАЯ ЛОГИСТИКА');
                    return (
                      <tr key={i} className="border-b border-slate-800/50 text-slate-300">
                        <td className="p-1">{(h.finished_at || h.date) ? new Date(h.finished_at || h.date).toLocaleDateString('ru') : '—'}</td>
                        <td className="p-1">{h.type === 'multilot' ? '📋 Мультилот' : '📋 Тендер'}</td>
                        <td className="p-1 text-right">{(Number(h.rate || h.winning_rate) || 0) > 0 ? `${Number(h.rate || h.winning_rate)} ₽/км` : '—'}</td>
                        <td className="p-1 text-right">{Number(h.participants_count) || '—'}</td>
                        <td className={`p-1 truncate max-w-[120px] ${isUs ? 'text-green-400 font-bold' : ''}`}>
                          {isUs ? '🟢 МЫ' : h.winner_name || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(() => {
                const rates = modalRouteHistory.map((h: any) => Number(h.rate || h.winning_rate) || 0).filter((r: number) => r > 0);
                if (!rates.length) return null;
                const avg = Math.round(rates.reduce((s: number, r: number) => s + r, 0) / rates.length);
                return <div className="text-xs text-slate-400 pt-1 border-t border-slate-700">📈 Средняя: {avg}₽/км | Мин: {Math.min(...rates)} | Макс: {Math.max(...rates)}</div>;
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



// ==================== Bid Log Accordion ====================
function BidLogAccordion({ tenderId }: { tenderId: string }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<BidLogEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBidLog = useCallback(async () => {
    try {
      const r = await apiFetch(`/api/tenders/${tenderId}/bid-log`);
      if (r.ok) {
        const d = await r.json();
        setEvents(d.events || []);
      }
    } catch {}
  }, [tenderId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadBidLog().finally(() => setLoading(false));
    const iv = setInterval(loadBidLog, 5000);
    return () => clearInterval(iv);
  }, [open, loadBidLog]);

  const participants = useMemo(() => {
    const map = new Map<string, { name: string; inn: string; best_rate: number; last_time: string; our: boolean }>();
    for (const e of events) {
      if (!e.new_rate || !e.leader_name) continue;
      const key = e.leader_name;
      const existing = map.get(key);
      if (!existing || e.new_rate < existing.best_rate) {
        map.set(key, { name: e.leader_name, inn: e.leader_inn || "", best_rate: e.new_rate, last_time: e.timestamp, our: e.our_bid });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.best_rate - b.best_rate);
  }, [events]);

  const fmtTs = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 } as any);
    } catch { return ts; }
  };

  const eventIcon = (e: BidLogEvent) => {
    if (e.our_bid) return "\ud83c\udfaf";
    if (e.event_type === "tender_extended") return "\ud83d\udd04";
    if (e.event_type === "tender_finished") return "\ud83c\udfc1";
    return "\u2694\ufe0f";
  };

  const eventLabel = (e: BidLogEvent) => {
    const rate = e.new_rate?.toFixed(2) || "?";
    if (e.our_bid && e.event_type === "counter_fire") return `\u041c\u042b: ${rate} \u20bd/\u043a\u043c (\u043a\u043e\u043d\u0442\u0440, ${e.latency_ms?.toFixed(0) || "?"}ms)`;
    if (e.our_bid && e.event_type === "sniper_fire") return `\u041c\u042b: ${rate} \u20bd/\u043a\u043c (\u0441\u043d\u0430\u0439\u043f\u0435\u0440)`;
    if (e.our_bid) return `\u041c\u042b: ${rate} \u20bd/\u043a\u043c`;
    if (e.event_type === "tender_extended") return "\u041f\u0440\u043e\u0434\u043b\u0435\u043d\u0438\u0435";
    if (e.event_type === "tender_finished") return `\u0417\u0430\u0432\u0435\u0440\u0448\u0451\u043d: ${rate} \u20bd/\u043a\u043c`;
    return `${e.leader_name || "?"}: ${rate} \u20bd/\u043a\u043c`;
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 bg-slate-700/50 hover:bg-slate-600/50 px-2 py-1 rounded text-sm text-slate-300 transition-colors"
      >
        <Users size={14} />
        <span>{participants.length || "?"}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[420px] bg-slate-800 rounded-lg border border-slate-600 shadow-xl overflow-hidden" style={{ maxHeight: "60vh" }}>
          {loading && events.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">{"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..."}</div>
          ) : events.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">{"\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u0442\u0430\u0432\u043e\u043a"}</div>
          ) : (
            <>
              {/* Participants */}
              <div className="p-3 border-b border-slate-700">
                <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">{"\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438"} ({participants.length})</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {participants.map((p, i) => (
                    <div
                      key={p.name}
                      className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                        p.our ? "bg-green-900/30 text-green-300" : i === 0 ? "bg-yellow-900/20 text-yellow-300" : "text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                        <span className="text-slate-500 w-4 text-right shrink-0">{i + 1}</span>
                        {i === 0 && !p.our && <span className="shrink-0">{"\ud83c\udfc6"}</span>}
                        {p.our && <span className="shrink-0">{"\ud83c\udfaf"}</span>}
                        <span className="truncate">{p.name}</span>
                      </div>
                      <span className="font-mono ml-2 whitespace-nowrap shrink-0">{p.best_rate.toFixed(2)} {"\u20bd"}/km</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bid log */}
              <div className="p-3 overflow-y-auto" style={{ maxHeight: "30vh" }}>
                <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">{"\u041b\u043e\u0433 \u0441\u0442\u0430\u0432\u043e\u043a"} ({events.length})</div>
                <div className="space-y-0.5">
                  {[...events].reverse().map((e) => (
                    <div
                      key={e.id}
                      className={`flex items-start gap-1.5 text-xs py-0.5 ${
                        e.our_bid ? "text-green-300" : e.event_type === "tender_finished" ? "text-blue-300" : "text-slate-400"
                      }`}
                    >
                      <span className="font-mono text-slate-500 whitespace-nowrap shrink-0">{fmtTs(e.timestamp)}</span>
                      <span className="shrink-0">{eventIcon(e)}</span>
                      <span className="min-w-0 truncate">{eventLabel(e)}</span>
                      {e.time_left_seconds != null && e.time_left_seconds < 60 && (
                        <span className="text-red-400 ml-auto whitespace-nowrap shrink-0">{e.time_left_seconds.toFixed(1)}s</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Tender History Modal (finished) ====================
function TenderHistoryModal({ tenderId, tenderInfo, onClose }: {
  tenderId: string; tenderInfo: FinishedTender; onClose: () => void;
}) {
  const [history, setHistory] = useState<TenderHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await apiFetch(`/api/tenders/${tenderId}/history`);
        if (!r.ok) throw new Error("Ошибка загрузки");
        const d: TenderHistory = await r.json();
        setHistory(d);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenderId]);

  const initialRate = Number(history?.initial_rate || tenderInfo.initial_rate) || 0;
  const finalRate = Number(history?.final_rate || tenderInfo.final_rate) || 0;
  const drop = initialRate - finalRate;
  const dropPct = initialRate > 0 ? (drop / initialRate) * 100 : 0;
  const startPt = history?.start_point || tenderInfo.start_point;
  const endPt = history?.end_point || tenderInfo.end_point;
  const distKm = history?.distance_km || tenderInfo.distance_km;
  const winner = history?.winner || tenderInfo.winner_name;

  const chartData = useMemo(() => {
    if (!history?.rate_changes?.length) return [];
    return history.rate_changes.map((rc) => ({
      time: fmtMskTime(rc.time),
      rate: rc.new_rate,
      fullTime: fmtMsk(rc.time),
    }));
  }, [history]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">
              {startPt || "?"} → {endPt || "?"}
            </h2>
            <p className="text-sm text-slate-400">
              ID: {tenderId} • {fmt(distKm)} км
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <RefreshCw size={24} className="animate-spin mr-2" /> Загрузка истории...
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400">
              <AlertTriangle size={14} className="inline mr-2" />{error}
            </div>
          ) : (
            <>
              {/* 3 cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-900/30 rounded-lg p-3 text-center border border-blue-800/50">
                  <div className="text-xs text-blue-400 mb-1">Начальная ставка</div>
                  <div className="text-xl font-bold text-blue-300">{fmt(initialRate, 2)} ₽/км</div>
                </div>
                <div className="bg-green-900/30 rounded-lg p-3 text-center border border-green-800/50">
                  <div className="text-xs text-green-400 mb-1">Финальная ставка</div>
                  <div className="text-xl font-bold text-green-300">{fmt(finalRate, 2)} ₽/км</div>
                </div>
                <div className="bg-amber-900/30 rounded-lg p-3 text-center border border-amber-800/50">
                  <div className="text-xs text-amber-400 mb-1">Победитель</div>
                  <div className="text-sm font-bold text-amber-300 truncate">{winner || "—"}</div>
                  {(history?.winner_inn || tenderInfo.winner_inn) && (
                    <div className="text-xs text-slate-500 mt-0.5">ИНН: {history?.winner_inn || tenderInfo.winner_inn}</div>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">📉 Падение</div>
                  <div className="font-bold text-red-400">
                    -{fmt(drop, 2)} ₽/км
                    <span className="text-xs text-slate-500 ml-1">(-{fmt(dropPct, 1)}%)</span>
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">⏱ Длительность</div>
                  <div className="font-bold text-white">
                    {fmtDuration(history?.start_time || tenderInfo.start_time, history?.end_time || tenderInfo.end_time)}
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">📊 Изменений ставки</div>
                  <div className="font-bold text-white">{history?.total_changes ?? tenderInfo.rate_changes}</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">🎯 Ставок в последнюю мин.</div>
                  <div className={`font-bold ${(history?.last_minute_bids || 0) > 0 ? "text-red-400" : "text-white"}`}>
                    {history?.last_minute_bids ?? tenderInfo.last_minute_bids}
                    {(history?.last_minute_bids || 0) > 0 && " 🔥"}
                  </div>
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 1 && (
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-bold text-slate-300 mb-3">📈 График ставок</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => v.toFixed(1)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }}
                        labelStyle={{ color: "#94a3b8" }}
                        formatter={(value: number) => [`${value.toFixed(2)} ₽/км`, "Ставка"]}
                        labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.fullTime || label}
                      />
                      <ReferenceLine y={initialRate} stroke="#60a5fa" strokeDasharray="5 5" label={{ value: `Нач: ${initialRate}`, fill: "#60a5fa", fontSize: 11 }} />
                      <Line
                        type="stepAfter"
                        dataKey="rate"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: "#3b82f6", r: 4 }}
                        activeDot={{ r: 6, fill: "#60a5fa" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Rate changes table */}
              {history?.rate_changes && history.rate_changes.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-x-auto">
                  <h3 className="text-sm font-bold text-slate-300 p-3 border-b border-slate-700">📋 История ставок</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                        <th className="px-3 py-2 text-left">Время МСК</th>
                        <th className="px-3 py-2 text-right">Ставка ₽/км</th>
                        <th className="px-3 py-2 text-right">Изменение</th>
                        <th className="px-3 py-2 text-left">Лидер</th>
                        <th className="px-3 py-2 text-right">Осталось</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.rate_changes.map((rc, i) => {
                        const tls = rc.time_left_seconds;
                        let rowBg = "";
                        if (tls < 60) rowBg = "bg-red-900/30";
                        else if (tls < 300) rowBg = "bg-yellow-900/20";
                        return (
                          <tr key={i} className={`border-b border-slate-700/50 ${rowBg}`}>
                            <td className="px-3 py-2 text-slate-300 font-mono text-xs">{fmtMsk(rc.time)}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-white">{fmt(rc.new_rate, 2)}</td>
                            <td className="px-3 py-2 text-right font-mono text-red-400 text-xs">
                              -{fmt(rc.drop, 2)} ₽
                            </td>
                            <td className="px-3 py-2 text-left text-xs text-slate-400 truncate max-w-[200px]">
                              {rc.leader || "—"}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono text-xs ${tls < 60 ? "text-red-400 font-bold" : tls < 300 ? "text-yellow-400" : "text-slate-400"}`}>
                              {fmtTimeLeft(tls)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Sort Header Component ====================
function SortHeader({ label, field, currentField, currentDir, onSort }: {
  label: string; field: SortField; currentField: SortField; currentDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = currentField === field;
  return (
    <th
      className={`px-2 py-2 text-right cursor-pointer select-none transition-colors ${active ? "text-blue-400" : "hover:text-white"}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active ? (
          currentDir === "ASC" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ArrowUpDown size={10} className="opacity-40" />
        )}
      </span>
    </th>
  );
}

// ==================== Main Page ====================
export default function TendersPage() {
  const { user } = useAuth();
  const isDirector = ["director", "superadmin", "admin"].includes(user?.role || "");

  // Main tab
  const [activeTab, setActiveTab] = useState<MainTab>("active");

  // --- Active tab internal sub-tab ---
  const [subTab, setSubTab] = useState<"active" | "history">("active");
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Tender | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sniperList, setSniperList] = useState<any[]>([]);
  const sniperIds = new Set(sniperList.filter((s: any) => s.active).map((s: any) => String(s.tender_id)));

  // --- Filters state ---
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [distanceRange, setDistanceRange] = useState<DistanceRange>("all");
  const [minRateFilter, setMinRateFilter] = useState("");
  const [onlyRoundTrip, setOnlyRoundTrip] = useState(false);
  const [onlyProfitable, setOnlyProfitable] = useState(false);
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [onlyParticipant, setOnlyParticipant] = useState(false);
  const [onlyLeader, setOnlyLeader] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tonnageFilter, setTonnageFilter] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("open");

  // --- Sort state ---
  const [sortField, setSortField] = useState<SortField>("profit_per_trip");
  const [sortDir, setSortDir] = useState<SortDir>("DESC");

  // --- History (old internal history) state ---
  const [hPage, setHPage] = useState(1);
  const [hTotal, setHTotal] = useState(0);
  const [hPages, setHPages] = useState(0);
  const [hSearch, setHSearch] = useState("");
  const [hFilterWin, setHFilterWin] = useState<string>("all"); // all / ours / 5t / 20t / round / one
  const [hTonnage, setHTonnage] = useState<string>("all");
  const [hRoundTrip, setHRoundTrip] = useState<string>("all"); // all / round / one
  const [hDateFrom, setHDateFrom] = useState("");
  const [hDateTo, setHDateTo] = useState("");
  const [hSortBy, setHSortBy] = useState("finished_at");
  const [hSortDir, setHSortDir] = useState<"ASC" | "DESC">("DESC");
  const [tick, setTick] = useState(0);

  // --- Multilots tab state ---
  const [multilots, setMultilots] = useState<any[]>([]);
  const [multilotsLoading, setMultilotsLoading] = useState(false);
  const [finishedMultilots, setFinishedMultilots] = useState<any[]>([]);
  const [multilotAnalytics, setMultilotAnalytics] = useState<any>(null);
  const [multilotSelected, setMultilotSelected] = useState<any>(null);
  const [routeHistory, setRouteHistory] = useState<any[]>([]);
  const [multilotSubTab, setMultilotSubTab] = useState<"active"|"finished"|"analytics">("active");

  // --- Finished tab state ---
  const [finishedTenders, setFinishedTenders] = useState<FinishedTender[]>([]);
  const [finishedTotal, setFinishedTotal] = useState(0);
  const [finishedOffset, setFinishedOffset] = useState(0);
  const [finishedLoading, setFinishedLoading] = useState(false);
  const [finishedSelectedId, setFinishedSelectedId] = useState<string | null>(null);
  const [finishedSelectedInfo, setFinishedSelectedInfo] = useState<FinishedTender | null>(null);
  const FINISHED_LIMIT = 50;

  // --- Analytics tab state ---
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Fetch multilots when tab active — merge tenders list + sniper data for route_rate
  useEffect(() => {
    if (activeTab !== 'multilots') return;
    const load = async () => {
      setMultilotsLoading(true);
      try {
        const [sniperRes, fRes, aRes] = await Promise.all([
          apiFetchJson('/api/tenders/multilots').catch(() => ({data:[]})),
          apiFetchJson('/api/tenders/multilots/finished').catch(() => ({data:[]})),
          apiFetchJson('/api/tenders/multilots/analytics').catch(() => ({data:null})),
        ]);
        // Merge: take multilots from main tenders list + enrich with sniper route_rate
        const sniperMap: Record<string, any> = {};
        for (const s of (sniperRes?.data || [])) sniperMap[String(s.id)] = s;
        // Filter multilots from loaded tenders
        const fromTenders = tenders.filter(t => t.is_multilot || t.tender_type?.includes('MULTILOT'));
        const merged = fromTenders.map(t => {
          const s = sniperMap[String(t.id)];
          return { ...t, route_rate: s?.route_rate || t.route_rate || t.current_rate || null, participants_count: s?.participants_count || t.participants_count || 0, our_bet_status: s?.our_bet_status || t.our_bet_status || null, supplier_bet: s?.supplier_bet || t.supplier_bet || null, body_type_label: s?.body_type_label || t.body_type || '', number_trips: s?.number_trips || t.number_trips || 0, active_period: s?.active_period || t.active_period || 0, route: s?.route || {start_point: t.start_point, end_point: t.end_point, distance_km: t.distance_km} };
        });
        // Also add sniper-only multilots not in tenders list
        for (const s of (sniperRes?.data || [])) {
          if (!merged.find(m => String(m.id) === String(s.id))) merged.push(s);
        }
        setMultilots(merged);
        setFinishedMultilots(fRes?.data || []);
        setMultilotAnalytics(aRes?.data || null);
      } catch {}
      setMultilotsLoading(false);
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [activeTab, tenders]);

  // Load route history for selected multilot
  useEffect(() => {
    if (!multilotSelected) { setRouteHistory([]); return; }
    const s = multilotSelected.route?.start_point || multilotSelected.start_point || '';
    const e = multilotSelected.route?.end_point || multilotSelected.end_point || '';
    if (!s || !e) return;
    apiFetchJson(`/api/tenders/route-history?start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}&limit=10`)
      .then(d => setRouteHistory(d?.data || []))
      .catch(() => {});
  }, [multilotSelected?.id]);

  // Fuel price (fetched once, no VAT)
  const [fuelPriceNoVat, setFuelPriceNoVat] = useState(58.57);
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/fuel/avg-price");
        const d = await r.json();
        if (d.avg_price_no_vat) setFuelPriceNoVat(Number(d.avg_price_no_vat));
      } catch {}
    })();
  }, []);

  // --- Unique values for dropdowns ---
  const uniqueFromPoints = useMemo(() => {
    const pts = [...new Set(tenders.map(t => t.start_point).filter(Boolean))];
    return pts.sort();
  }, [tenders]);

  const uniqueToPoints = useMemo(() => {
    const pts = [...new Set(tenders.map(t => t.end_point).filter(Boolean))];
    return pts.sort();
  }, [tenders]);

  const hasActiveFilters = filterFrom || filterTo || distanceRange !== "all" || minRateFilter || onlyRoundTrip || onlyProfitable || onlyUrgent || onlyParticipant || onlyLeader || searchQuery || tonnageFilter.length > 0 || (statusFilter !== "open" && statusFilter !== "all");

  const resetFilters = () => {
    setFilterFrom("");
    setFilterTo("");
    setDistanceRange("all");
    setMinRateFilter("");
    setOnlyRoundTrip(false);
    setOnlyProfitable(false);
    setOnlyUrgent(false);
    setOnlyParticipant(false);
    setOnlyLeader(false);
    setSearchQuery('');
    setTonnageFilter([]);
    setStatusFilter("open");
  };

  const filteredAndSorted = useMemo(() => {
    let result = tenders.filter(t => {
      // Exclude multilots from active tenders tab — they have their own tab
      if (t.is_multilot || t.tender_type === 'TENDER_TYPE_MAGISTRAL_MULTILOT') return false;
      if (filterFrom && t.start_point !== filterFrom) return false;
      if (filterTo && t.end_point !== filterTo) return false;
      if (distanceRange !== "all") {
        const d = Number(t.distance_km) || 0;
        switch (distanceRange) {
          case "lt170": if (d >= 170) return false; break;
          case "170-500": if (d < 170 || d > 500) return false; break;
          case "500-1000": if (d < 500 || d > 1000) return false; break;
          case "gt1000": if (d <= 1000) return false; break;
        }
      }
      if (minRateFilter) {
        const mr = parseFloat(minRateFilter);
        if (!isNaN(mr) && (Number(t.current_rate) || 0) < mr) return false;
      }
      if (onlyRoundTrip && !t.is_round_trip) return false;
      if (onlyProfitable && profitForTender(t, fuelPriceNoVat) <= 0) return false;
      if (onlyUrgent && !isUrgent(t.end_time)) return false;
      if (onlyParticipant && !t.is_participating && !sniperIds.has(String(t.id))) return false;
      if (onlyLeader && !t.is_our_lead) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${t.id} ${t.name || ''} ${t.route_name || ''} ${t.start_point || ''} ${t.end_point || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Filter by real activity: end_time in future = active, in past = finished
      if (statusFilter === "open" && new Date(t.end_time).getTime() <= Date.now()) return false;
      if (statusFilter === "closed" && new Date(t.end_time).getTime() > Date.now()) return false;
      if (tonnageFilter.length > 0 && !tonnageFilter.includes(t.tonnage)) return false;
      return true;
    });

    result.sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case "profit_per_trip":
          va = profitForTender(a, fuelPriceNoVat); vb = profitForTender(b, fuelPriceNoVat); break;
        case "current_rate":
          va = Number(a.current_rate) || 0; vb = Number(b.current_rate) || 0; break;
        case "distance_km":
          va = Number(a.distance_km) || 0; vb = Number(b.distance_km) || 0; break;
        case "end_time":
          va = a.end_time ? new Date(a.end_time).getTime() : 0;
          vb = b.end_time ? new Date(b.end_time).getTime() : 0; break;
        case "participants_count":
          va = Number(a.participants_count) || 0; vb = Number(b.participants_count) || 0; break;
        case "profit_per_km":
          va = Number(a.profit_per_km) || 0; vb = Number(b.profit_per_km) || 0; break;
        default:
          va = 0; vb = 0;
      }
      return sortDir === "ASC" ? va - vb : vb - va;
    });

    return result;
  }, [tenders, filterFrom, filterTo, distanceRange, minRateFilter, onlyRoundTrip, onlyProfitable, onlyUrgent, onlyParticipant, onlyLeader, searchQuery, tonnageFilter, statusFilter, sortField, sortDir]);

  const handleActiveSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "ASC" ? "DESC" : "ASC");
    else { setSortField(field); setSortDir("DESC"); }
  };

  const prevTendersJson = useRef('');
  const loadActive = useCallback(async () => {
    try {
      const scrollY = window.scrollY;
      const r = await apiFetch("/api/tenders/all");
      const d = await r.json();
      const fresh = d.tenders || [];
      // BUG-7 fix v2: JSON comparison via ref to prevent unnecessary re-renders
      const freshJson = JSON.stringify(fresh.map((t: any) => [t.id, t.current_rate, t.participants_count, t.leader_name, t.is_our_lead, t.our_bet_status, t.route_rate]));
      if (freshJson !== prevTendersJson.current) {
        prevTendersJson.current = freshJson;
        setTenders(fresh);
        // Restore scroll position after React re-render
        requestAnimationFrame(() => { window.scrollTo(0, scrollY); });
      }
      setLastUpdate(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const loadHistoryItems = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(hPage), limit: "50", sort_by: hSortBy, sort_dir: hSortDir });
      if (hSearch) p.set("search", hSearch);
      if (hTonnage && hTonnage !== "all") p.set("tonnage", hTonnage);
      if (hRoundTrip === "round") p.set("round_trip", "true");
      if (hRoundTrip === "one") p.set("round_trip", "false");
      if (hFilterWin === "ours") p.set("winner_inn", "6679185730");
      if (hDateFrom) p.set("date_from", hDateFrom);
      if (hDateTo) p.set("date_to", hDateTo);
      const r = await apiFetch(`/api/tenders/history?${p}`);
      const d = await r.json();
      setHistoryItems(d.history || []);
      setHTotal(d.total || 0);
      setHPages(d.pages || 0);
    } catch (e: any) { console.error(e); }
    finally { setLoading(false); }
  }, [hPage, hSearch, hDateFrom, hDateTo, hSortBy, hSortDir, hTonnage, hRoundTrip, hFilterWin]);

  const loadStats = useCallback(async () => {
    try {
      const r = await apiFetch("/api/tenders/stats");
      setStats(await r.json());
    } catch (e) { console.error(e); }
  }, []);

  // --- Finished tenders loader ---
  const loadFinished = useCallback(async () => {
    setFinishedLoading(true);
    try {
      const r = await apiFetch(`/api/tenders/finished?limit=${FINISHED_LIMIT}&offset=${finishedOffset}`);
      const d = await r.json();
      setFinishedTenders(d.tenders || []);
      setFinishedTotal(d.total || 0);
    } catch (e: any) { console.error(e); }
    finally { setFinishedLoading(false); }
  }, [finishedOffset]);

  // --- Analytics loader ---
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const r = await apiFetch("/api/tenders/analytics");
      const d = await r.json();
      setAnalytics(d);
    } catch (e: any) { console.error(e); }
    finally { setAnalyticsLoading(false); }
  }, []);

  // BUG-7 fix v3: loadStats once, loadActive on stable interval
  const loadActiveRef = useRef(loadActive);
  loadActiveRef.current = loadActive;
  const loadStatsRef = useRef(loadStats);
  loadStatsRef.current = loadStats;
  useEffect(() => {
    loadActiveRef.current();
    loadStatsRef.current();
    const iv = setInterval(() => loadActiveRef.current(), 15000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (subTab === "history") loadHistoryItems(); }, [subTab, loadHistoryItems]);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 60000); return () => clearInterval(iv); }, []);

  // Load finished when tab switches
  const loadSnipers = useCallback(async () => {
    try {
      const d = await apiFetchJson('/api/tenders/sniper/all');
      const snipers = d?.snipers || d?.data || [];
      // Enrich with tender data from active tenders
      const enriched = (Array.isArray(snipers) ? snipers : Object.values(snipers)).map((s: any) => {
        const t = tenders.find((t: any) => String(t.id) === String(s.tender_id));
        return { ...s, tender: t || null };
      });
      setSniperList(enriched);
    } catch (e) { console.error(e); }
  }, [tenders]);

  useEffect(() => { loadSnipers(); }, [loadSnipers]);
  useEffect(() => { if (activeTab === "finished") loadFinished(); }, [activeTab, loadFinished]);
  useEffect(() => { if (activeTab === "analytics") loadAnalytics(); }, [activeTab, loadAnalytics]);

  const handleSort = (col: string) => {
    if (hSortBy === col) setHSortDir(d => d === "ASC" ? "DESC" : "ASC");
    else { setHSortBy(col); setHSortDir("DESC"); }
  };

  const distanceChips: { label: string; value: DistanceRange }[] = [
    { label: "Все", value: "all" },
    { label: "< 170", value: "lt170" },
    { label: "170–500", value: "170-500" },
    { label: "500–1000", value: "500-1000" },
    { label: "1000+", value: "gt1000" },
  ];

  const finishedPages = Math.ceil(finishedTotal / FINISHED_LIMIT);
  const finishedPage = Math.floor(finishedOffset / FINISHED_LIMIT) + 1;

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 size={28} className="text-blue-400" /> Тендеры WB
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { l: "Активные", v: tenders.filter(t => !t.is_multilot && new Date(t.end_time).getTime() > Date.now()).length, c: "text-blue-400" },
          { l: "В истории", v: stats?.total_history || 0, c: "text-slate-300" },
          { l: "Наши ставки", v: stats?.total_bids || 0, c: "text-purple-400" },
          { l: "Выиграно", v: stats?.won_tenders || 0, c: "text-green-400" },
          { l: "Ср. ставка", v: stats?.avg_final_rate ? `${fmt(stats.avg_final_rate, 1)} ₽` : "—", c: "text-amber-400" },
        ].map((s, i) => (
          <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-500 mb-1">{s.l}</div>
            <div className={`text-xl font-bold ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Main Tabs - salary-style */}
      <div className="flex gap-1 mb-6 border-b border-slate-700">
        {[
          { key: "active" as MainTab, label: "Активные", icon: <Activity size={16} />, count: tenders.filter(t => !t.is_multilot && new Date(t.end_time).getTime() > Date.now()).length },
          { key: "multilots" as MainTab, label: "📋 Мультилоты", icon: null, count: multilots.length || undefined },
          { key: "finished" as MainTab, label: "Завершённые", icon: <CheckCircle size={16} />, count: finishedTotal || undefined },
          { key: "analytics" as MainTab, label: "Аналитика", icon: <TrendingUp size={16} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? "text-blue-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.key ? "bg-blue-500/30 text-blue-300" : "bg-slate-700 text-slate-400"
              }`}>{tab.count}</span>
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* ==================== TAB: ACTIVE ==================== */}
      {activeTab === "active" && (
        <div>
          {/* Sub-tabs (Active/History) */}
          <div className="flex gap-1 mb-4 bg-slate-800 rounded-lg p-1 w-fit border border-slate-700">
            <button onClick={() => setSubTab("active")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${subTab === "active" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
              Активные {tenders.filter(t=>!t.is_multilot&&new Date(t.end_time).getTime()>Date.now()).length > 0 && <span className="ml-1 bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded-full text-xs">{tenders.filter(t=>!t.is_multilot&&new Date(t.end_time).getTime()>Date.now()).length}</span>}
            </button>
            <button onClick={() => setSubTab("history")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${subTab === "history" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
              История
            </button>
          </div>

          {/* Active sub-tab */}
          {subTab === "active" && (
            <div>
              {/* Filters bar */}
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Filter size={14} className="text-slate-400 shrink-0" />
                  <SearchableDropdown options={uniqueFromPoints} value={filterFrom} onChange={setFilterFrom} placeholder="Откуда" />
                  <SearchableDropdown options={uniqueToPoints} value={filterTo} onChange={setFilterTo} placeholder="Куда" />
                  <div className="flex items-center gap-1">
                    {distanceChips.map(ch => (
                      <button
                        key={ch.value}
                        onClick={() => setDistanceRange(ch.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          distanceRange === ch.value
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600"
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={minRateFilter}
                    onChange={e => setMinRateFilter(e.target.value)}
                    placeholder="мин ₽/км"
                    className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-slate-500"
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-slate-500 mr-1">Статус:</span>
                    {(["open", "closed", "all"] as const).map(s => (
                      <button key={s} onClick={() => setStatusFilter(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          statusFilter === s ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"
                        }`}>
                        {s === "open" ? "Активные" : s === "closed" ? "Завершённые" : "Все"}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 mr-1">Тоннаж:</span>
                    <button
                      onClick={() => setTonnageFilter([])}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        tonnageFilter.length === 0
                          ? "bg-blue-600 text-white"
                          : "bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600"
                      }`}
                    >
                      Все
                    </button>
                    {[5, 20].map(tn => (
                      <button
                        key={tn}
                        onClick={() => setTonnageFilter(prev =>
                          prev.includes(tn) ? prev.filter(v => v !== tn) : [...prev, tn]
                        )}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          tonnageFilter.includes(tn)
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600"
                        }`}
                      >
                        {tn} тн
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Поиск маршрута или номера..."
                      className="w-[250px] pl-8 pr-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-slate-500"
                    />
                    {searchQuery && (
                      <X size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-white" onClick={() => setSearchQuery('')} />
                    )}
                  </div>
                  <button
                    onClick={() => setOnlyParticipant(!onlyParticipant)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      onlyParticipant ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {onlyParticipant ? "✅ Наши ставки" : "📋 Наши ставки"}
                  </button>
                  <button
                    onClick={() => setOnlyLeader(!onlyLeader)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      onlyLeader ? "bg-green-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {onlyLeader ? "🏆 Мы лидер" : "🏆 Мы лидер"}
                  </button>
                  <button
                    onClick={() => setOnlyRoundTrip(!onlyRoundTrip)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      onlyRoundTrip ? "bg-purple-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    🔄 Туда-обратно
                  </button>
                  <button
                    onClick={() => setOnlyProfitable(!onlyProfitable)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      onlyProfitable ? "bg-green-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    <TrendingUp size={12} /> Прибыльные
                  </button>
                  <button
                    onClick={() => setOnlyUrgent(!onlyUrgent)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      onlyUrgent ? "bg-amber-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Flame size={12} /> Горящие
                  </button>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 transition-colors"
                    >
                      <RotateCcw size={12} /> Сбросить
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-300">
                    Показано <span className="font-bold text-white">{filteredAndSorted.length}</span> из <span className="font-bold text-white" title="Всего активных (не завершённых)">{tenders.filter(t => !t.is_multilot && (statusFilter !== "open" || new Date(t.end_time).getTime() > Date.now())).length}</span> тендеров
                  </span>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>🟢 Лидер</span><span className="text-green-400/60">█ Профит</span><span className="text-red-400/60">█ Убыток</span><span className="text-yellow-400">▌Горящий</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {tenders.length > 0 && <RefreshCw size={12} className="animate-spin" />}
                  {lastUpdate && lastUpdate.toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow" })}
                </div>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-3 text-red-400 text-sm">
                  <AlertTriangle size={14} className="inline mr-2" />{error}
                </div>
              )}

              {tenders.length === 0 ? (
                <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
                  <BarChart3 size={48} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-lg font-medium">Нет активных тендеров</p>
                  <p className="text-sm mt-1">Данные обновляются каждые 15 секунд</p>
                </div>
              ) : filteredAndSorted.length === 0 ? (
                <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
                  <Filter size={48} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-lg font-medium">Ничего не найдено</p>
                  <p className="text-sm mt-1">Попробуйте изменить фильтры</p>
                  <button onClick={resetFilters} className="mt-3 text-blue-400 hover:text-blue-300 text-sm">Сбросить фильтры</button>
                </div>
              ) : (
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                        <th className="px-2 py-2 w-8"></th>
                        <th className="px-2 py-2 text-left">Маршрут</th>
                        <SortHeader label="Расст." field="distance_km" currentField={sortField} currentDir={sortDir} onSort={handleActiveSort} />
                        <th className="px-2 py-2 text-right">Тонн.</th>
                        <th className="px-2 py-2 text-right">Рейсы</th>
                        <th className="px-2 py-2 text-right">Дней</th>
                        <SortHeader label="Ставка" field="current_rate" currentField={sortField} currentDir={sortDir} onSort={handleActiveSort} />
                        <SortHeader label="Уч." field="participants_count" currentField={sortField} currentDir={sortDir} onSort={handleActiveSort} />
                        <th className="px-2 py-2 text-center">Статус</th>
                        <th className="px-2 py-2 text-left max-w-[140px]">Лидер</th>
                        <SortHeader label="Осталось" field="end_time" currentField={sortField} currentDir={sortDir} onSort={handleActiveSort} />
                        <th className="px-2 py-2 text-right">Себест.</th>
                        <SortHeader label="₽/км" field="profit_per_km" currentField={sortField} currentDir={sortDir} onSort={handleActiveSort} />
                        <SortHeader label="Профит" field="profit_per_trip" currentField={sortField} currentDir={sortDir} onSort={handleActiveSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSorted.map(t => {
                        const tProfit = profitForTender(t, fuelPriceNoVat);
                        const tUrgent = isUrgent(t.end_time);
                        return (
                          <tr key={t.id} className={`${rowColor(t)} hover:bg-slate-700/50 cursor-pointer transition-all border-b border-slate-700/50`}
                            onClick={() => setSelected(t)}>
                            <td className="px-2 py-2 text-center">
                              <span className="relative">
                                {statusEmoji(t)}
                                {t.we_are_leader && (
                                  <span className="absolute -top-1 -right-3 bg-purple-600 text-white text-[9px] px-1 rounded font-bold">ЛИД</span>
                                )}
                              </span>
                            </td>
                            <td className="px-2 py-2 min-w-[280px]">
                              <div className="font-medium text-white whitespace-normal break-words">
                                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                  t.is_our_lead ? 'bg-green-400' :
                                  t.supplier_bet_rate != null ? 'bg-yellow-400' :
                                  'bg-slate-600'
                                }`} />
                                {sniperIds.has(String(t.id)) && <span className="mr-1" title="Снайпер активен">🎯</span>}{t.start_point || "?"} → {t.end_point || "?"}
                                {tUrgent && <Flame size={12} className="inline ml-1 text-amber-400" />}
                              </div>
                              <div className="text-xs text-slate-500">
                                {t.body_type} {t.is_round_trip ? "🔄" : ""}
                                {t.we_are_leader && <span className="ml-1 bg-purple-600/40 text-purple-300 text-[10px] px-1 rounded">💜 Мы лидер</span>}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-xs text-slate-300">{fmt(t.distance_km)} км</td>
                            <td className="px-2 py-2 text-right text-xs text-slate-300">{t.tonnage || "—"}</td>
                            <td className="px-2 py-2 text-right text-xs text-slate-300">{t.number_trips || "—"}</td>
                            <td className="px-2 py-2 text-right text-xs text-slate-300">{t.active_period || "—"}</td>
                            <td className="px-2 py-2 text-right font-mono font-bold text-white">{t.current_rate ? fmt(t.current_rate, 2) : "—"}</td>
                            <td className="px-2 py-2 text-center"><span className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full text-xs">{t.participants_count || 0}</span></td>
                            <td className="px-2 py-2 text-center text-sm">
                              {t.is_our_lead ? (
                                <span className="text-green-400">🏆</span>
                              ) : t.supplier_bet_rate != null ? (
                                <span className="text-yellow-400">📋</span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-xs max-w-[140px] truncate">
                              {t.is_our_lead || t.we_are_leader ? (
                                <span className="text-green-400 font-bold">🟢 МЫ</span>
                              ) : t.leader_name && t.leader_name !== '—' && t.leader_name !== 'Скрыт' ? (
                                <span className="text-red-400" title={t.leader_name}>{(t.leader_name || '').replace('ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ', 'ООО').replace('ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ', 'ИП').replace(/^ООО\s*"/, 'ООО «').replace(/"$/, '»')}</span>
                              ) : Number(t.current_rate) > 0 ? (
                                <span className="text-slate-500">Скрыт</span>
                              ) : (
                                <span className="text-slate-600">⏳ Нет ставок</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center text-xs whitespace-nowrap"><CountdownTimer endTime={t.end_time} /></td>
                            <td className="px-2 py-2 text-right font-mono text-xs text-slate-400">{fmt(t.our_rate_per_km, 2)}</td>
                            <td className="px-2 py-2 text-right font-mono text-xs font-bold">
                              {(t.profit_per_km != null && t.profit_per_km !== 0) ? (
                                t.profit_per_km > 0
                                  ? <span className="text-green-400">+{fmt(t.profit_per_km, 2)}</span>
                                  : <span className="text-red-400">{fmt(t.profit_per_km, 2)}</span>
                              ) : "—"}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-xs font-bold">
                              {tProfit !== 0 ? (
                                tProfit > 0
                                  ? <span className="text-green-400">+{fmt(Math.round(tProfit))}</span>
                                  : <span className="text-red-400">{fmt(Math.round(tProfit))}</span>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* History sub-tab */}
          {subTab === "history" && (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative min-w-[200px] flex-1 max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Поиск маршрута..." value={hSearch}
                    onChange={e => { setHSearch(e.target.value); setHPage(1); }}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                </div>
                <input type="date" value={hDateFrom} onChange={e => { setHDateFrom(e.target.value); setHPage(1); }}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                <input type="date" value={hDateTo} onChange={e => { setHDateTo(e.target.value); setHPage(1); }}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                <span className="text-slate-600">|</span>
                {[{v:"all",l:"Все"},{v:"ours",l:"🟢 Наши"}].map(f=>(
                  <button key={f.v} onClick={()=>{setHFilterWin(f.v);setHPage(1);}} className={`px-3 py-1.5 rounded text-xs ${hFilterWin===f.v?"bg-green-700 text-white":"bg-slate-800 text-slate-400 hover:text-white border border-slate-700"}`}>{f.l}</button>
                ))}
                <span className="text-slate-600">|</span>
                {[{v:"all",l:"Все"},{v:"5",l:"5т"},{v:"20",l:"20т"}].map(f=>(
                  <button key={f.v} onClick={()=>{setHTonnage(f.v);setHPage(1);}} className={`px-3 py-1.5 rounded text-xs ${hTonnage===f.v?"bg-blue-600 text-white":"bg-slate-800 text-slate-400 hover:text-white border border-slate-700"}`}>{f.l}</button>
                ))}
                <span className="text-slate-600">|</span>
                {[{v:"all",l:"Все"},{v:"round",l:"🔄 Т-О"},{v:"one",l:"➡️ В одну"}].map(f=>(
                  <button key={f.v} onClick={()=>{setHRoundTrip(f.v);setHPage(1);}} className={`px-3 py-1.5 rounded text-xs ${hRoundTrip===f.v?"bg-purple-600 text-white":"bg-slate-800 text-slate-400 hover:text-white border border-slate-700"}`}>{f.l}</button>
                ))}
                {(hSearch || hDateFrom || hDateTo || hFilterWin!=="all" || hTonnage!=="all" || hRoundTrip!=="all") && (
                  <button onClick={() => { setHSearch(""); setHDateFrom(""); setHDateTo(""); setHFilterWin("all"); setHTonnage("all"); setHRoundTrip("all"); setHPage(1); }}
                    className="text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1"><X size={12} /> Сбросить</button>
                )}
              </div>

              {loading ? (
                <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
                  <RefreshCw size={32} className="animate-spin mx-auto mb-3" /> Загрузка...
                </div>
              ) : historyItems.length === 0 ? (
                <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
                  <Calendar size={48} className="mx-auto mb-3 text-slate-600" />
                  <p>Нет данных в истории</p>
                  <p className="text-sm mt-1">Завершённые тендеры сохраняются автоматически</p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                          <th className="px-3 py-2 text-left cursor-pointer hover:text-white" onClick={() => handleSort("start_point")}>Маршрут {hSortBy === "start_point" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th className="px-3 py-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort("distance_km")}>Расст. {hSortBy === "distance_km" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th className="px-3 py-2 text-center">Тип</th>
                          <th className="px-3 py-2 text-right">Дней</th>
                          <th className="px-3 py-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort("tonnage")}>Тн {hSortBy === "tonnage" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th className="px-3 py-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort("initial_rate")}>Нач. {hSortBy === "initial_rate" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th className="px-3 py-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort("final_rate")}>Финал {hSortBy === "final_rate" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th className="px-3 py-2 text-left">Победитель</th>
                          <th className="px-3 py-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort("participants_count")}>Уч. {hSortBy === "participants_count" && <ArrowUpDown size={10} className="inline" />}</th>
                          <th className="px-3 py-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort("finished_at")}>Дата {hSortBy === "finished_at" && <ArrowUpDown size={10} className="inline" />}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyItems.map(h => {
                          const isOurs = h.winner_inn === "6679185730" || (h.winner_name || "").includes("ТРАНСПОРТНАЯ ЛОГИСТИКА");
                          const initR = Number(h.initial_rate) || 0;
                          const finR = Number(h.final_rate) || 0;
                          const drop = initR > 0 ? (initR - finR) / initR * 100 : 0;
                          const isBigDrop = drop > 20;
                          const shortWinner = (h.winner_name || "")
                            .replace("ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ", "ООО")
                            .replace("ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ", "ИП");
                          const tripType = h.tender_type === "TENDER_TYPE_MAGISTRAL_MULTILOT" ? "📋" : h.is_round_trip ? "🔄" : "➡️";
                          const tripsLabel = h.number_trips ? `${h.number_trips}р/сут` : "";
                          return (
                          <tr key={h.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${isOurs ? "bg-green-900/10" : ""}`}>
                            <td className="px-3 py-2 min-w-[200px]">
                              <div className="font-medium text-white text-xs">{h.start_point || "?"} → {h.end_point || "?"}</div>
                              {h.route_name && <div className="text-[10px] text-slate-600">{h.route_name.split("-").slice(0,1).join("")}</div>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300 text-xs">{fmt(h.distance_km)}</td>
                            <td className="px-3 py-2 text-center text-xs text-slate-400" title={h.is_round_trip ? "Туда-обратно" : "В одну сторону"}>{tripType} {tripsLabel}</td>
                            <td className="px-3 py-2 text-right text-xs text-slate-400">{h.active_period || "—"}</td>
                            <td className="px-3 py-2 text-right text-xs text-slate-400">{h.tonnage || "—"}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-500 text-xs">{fmt(h.initial_rate, 1)}</td>
                            <td className={`px-3 py-2 text-right font-mono font-bold text-xs ${isOurs ? "text-green-400" : isBigDrop ? "text-red-400" : "text-white"}`}>{fmt(h.final_rate, 2)}</td>
                            <td className={`px-3 py-2 text-left text-xs max-w-[160px] ${isOurs ? "text-green-400 font-bold" : "text-slate-300"}`} title={h.winner_name || ""}>
                              {isOurs ? "🟢 МЫ" : shortWinner || "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-slate-400">{h.participants_count || "—"}</td>
                            <td className="px-3 py-2 text-right text-xs text-slate-500 whitespace-nowrap">{h.finished_at ? new Date(h.finished_at).toLocaleString("ru",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {hPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-slate-500">Всего: {hTotal} | Стр. {hPage}/{hPages}</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setHPage(p => Math.max(1, p - 1))} disabled={hPage <= 1}
                          className="p-2 rounded-lg border border-slate-700 hover:bg-slate-700 disabled:opacity-30 text-slate-400"><ChevronLeft size={16} /></button>
                        <button onClick={() => setHPage(p => Math.min(hPages, p + 1))} disabled={hPage >= hPages}
                          className="p-2 rounded-lg border border-slate-700 hover:bg-slate-700 disabled:opacity-30 text-slate-400"><ChevronRight size={16} /></button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {selected && <TenderModal tender={selected} isDirector={isDirector} fuelPriceNoVat={fuelPriceNoVat} onClose={() => setSelected(null)} onBidPlaced={loadActive} />}
        </div>
      )}



      {/* ==================== TAB: FINISHED ==================== */}
      
      {activeTab === "multilots" && <MultilotTab apiFetchJson={apiFetchJson} tenders={tenders} />}

      {activeTab === "finished" && (
        <div>
          {finishedLoading ? (
            <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
              <RefreshCw size={32} className="animate-spin mx-auto mb-3" /> Загрузка завершённых тендеров...
            </div>
          ) : finishedTenders.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
              <CheckCircle size={48} className="mx-auto mb-3 text-slate-600" />
              <p className="text-lg font-medium">Нет завершённых тендеров</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-300">
                  Всего: <span className="font-bold text-white">{finishedTotal}</span> • Стр. {finishedPage}/{finishedPages || 1}
                </span>
              </div>
              <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                      <th className="px-3 py-2 text-left">Маршрут</th>
                      <th className="px-3 py-2 text-right">Расст.</th>
                      <th className="px-3 py-2 text-right">Нач. ставка</th>
                      <th className="px-3 py-2 text-right">Фин. ставка</th>
                      <th className="px-3 py-2 text-right">Падение</th>
                      <th className="px-3 py-2 text-left">Победитель</th>
                      <th className="px-3 py-2 text-center">Участн.</th>
                      <th className="px-3 py-2 text-center">Изм.</th>
                      <th className="px-3 py-2 text-center">Снайпер</th>
                      <th className="px-3 py-2 text-right">Дата МСК</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finishedTenders.map(ft => {
                      const dropVal = Number(ft.initial_rate) - Number(ft.final_rate);
                      const dropPct = Number(ft.initial_rate) > 0 ? (dropVal / Number(ft.initial_rate)) * 100 : 0;
                      return (
                        <tr
                          key={ft.id}
                          className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
                          onClick={() => { setFinishedSelectedId(ft.id); setFinishedSelectedInfo(ft); }}
                        >
                          <td className="px-3 py-2 min-w-[280px]">
                            <div className="font-medium text-white whitespace-normal break-words">
                              {ft.start_point || "?"} → {ft.end_point || "?"}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">{fmt(ft.distance_km)} км</td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">{fmt(ft.initial_rate, 2)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-white">{fmt(ft.final_rate, 2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            <span className="text-red-400">-{fmt(dropVal, 1)} ₽</span>
                            <span className="text-slate-500 ml-1">/ -{fmt(dropPct, 1)}%</span>
                          </td>
                          <td className="px-3 py-2 text-left text-xs max-w-[200px]" title={ft.winner_name || ""}><div className="text-slate-300 whitespace-normal leading-tight">{ft.winner_name || "—"}</div>{ft.winner_inn && <div className="text-[10px] text-slate-500">{ft.winner_inn}</div>}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full text-xs">{ft.participants_count || 0}</span>
                          </td>
                          <td className="px-3 py-2 text-center text-xs text-slate-400">{ft.rate_changes || 0}</td>
                          <td className="px-3 py-2 text-center">
                            {ft.last_minute_bids > 0 ? (
                              <span className="bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded-full text-xs font-bold">🔥 {ft.last_minute_bids}</span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-slate-500">{fmtMskFull(ft.finished_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {finishedPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-slate-500">
                    Показано {finishedOffset + 1}–{Math.min(finishedOffset + FINISHED_LIMIT, finishedTotal)} из {finishedTotal}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFinishedOffset(Math.max(0, finishedOffset - FINISHED_LIMIT))}
                      disabled={finishedOffset <= 0}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-700 disabled:opacity-30 text-slate-400 text-sm"
                    >
                      <ChevronLeft size={16} /> Назад
                    </button>
                    <span className="text-sm text-slate-400">Стр. {finishedPage}/{finishedPages}</span>
                    <button
                      onClick={() => setFinishedOffset(finishedOffset + FINISHED_LIMIT)}
                      disabled={finishedOffset + FINISHED_LIMIT >= finishedTotal}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-700 disabled:opacity-30 text-slate-400 text-sm"
                    >
                      Вперёд <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* History modal for finished tender */}
          {finishedSelectedId && finishedSelectedInfo && (
            <TenderHistoryModal
              tenderId={finishedSelectedId}
              tenderInfo={finishedSelectedInfo}
              onClose={() => { setFinishedSelectedId(null); setFinishedSelectedInfo(null); }}
            />
          )}
        </div>
      )}

      {/* ==================== TAB: ANALYTICS ==================== */}
      {activeTab === "analytics" && (
        <div>
          {analyticsLoading ? (
            <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
              <RefreshCw size={32} className="animate-spin mx-auto mb-3" /> Загрузка аналитики...
            </div>
          ) : !analytics ? (
            <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
              <TrendingUp size={48} className="mx-auto mb-3 text-slate-600" />
              <p>Нет данных аналитики</p>
            </div>
          ) : (
            <>
              {/* Cards */}
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                    <Trophy size={16} className="text-green-400" /> Завершено тендеров
                  </div>
                  <div className="text-3xl font-bold text-white">{analytics.total_finished}</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                    <TrendingUp size={16} className="text-red-400" /> Ср. падение ₽/км
                  </div>
                  <div className="text-3xl font-bold text-red-400">-{fmt(analytics.avg_drop_per_km, 2)} ₽</div>
                </div>
              </div>

              {/* Competitors table */}
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Target size={20} className="text-purple-400" /> Конкуренты
              </h3>
              <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Компания</th>
                      <th className="px-3 py-2 text-right">Побед</th>
                      <th className="px-3 py-2 text-right">Ср. ставка</th>
                      <th className="px-3 py-2 text-center">Снайпер%</th>
                      <th className="px-3 py-2 text-left">Направления</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.top_winners.map((w, i) => (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-2 text-slate-500 font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-white truncate max-w-[200px]">{w.name || "—"}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-400">{w.wins}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300">{fmt(w.avg_rate, 2)} ₽</td>
                        <td className="px-3 py-2 text-center">
                          {w.sniper_pct > 30 ? (
                            <span className="bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full text-xs font-bold">{fmt(w.sniper_pct, 0)}%</span>
                          ) : (
                            <span className="text-slate-400 text-xs">{fmt(w.sniper_pct, 0)}%</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-400 truncate max-w-[300px]">
                          {w.routes?.slice(0, 3).join(", ") || "—"}
                          {w.routes?.length > 3 && <span className="text-slate-600"> +{w.routes.length - 3}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
