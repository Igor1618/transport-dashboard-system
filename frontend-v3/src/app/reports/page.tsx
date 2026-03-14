"use client";
import ExcelExport from "@/components/ExcelExport";
import { formatDate, formatDateTime, formatShortDate } from "@/lib/dates";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, ChevronUp, ChevronDown, FileText, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

interface DriverReport {
  id: string; number: string; driver_name: string; vehicle_number: string;
  date_from: string; date_to: string; total_expenses: number; fuel_amount: number;
  fuel_quantity: number; driver_accruals: number; mileage: number;
  total_mileage?: number; wb_mileage?: number; updated_by?: string; status?: string;
  expense_categories?: { gps_mileage?: number; wb_gps_mileage?: number; rf_mileage?: number; fuel_rf?: { liters: number } };
  vehicle_type?: string; season?: string; rf_periods?: { mileage?: number }[];
  updated_at?: string;
}

function StatusBadge({ status }: { status?: string }) {
  const c: Record<string, { label: string; color: string }> = {
    draft: { label: '🟡 Черновик', color: 'bg-yellow-500/20 text-yellow-400' },
    review: { label: '🔵 На проверке', color: 'bg-blue-500/20 text-blue-400' },
    approved: { label: '🟢 Утверждён', color: 'bg-green-500/20 text-green-400' },
    paid: { label: '✅ Оплачен', color: 'bg-emerald-500/20 text-emerald-400' },
    deleted: { label: '🗑️ Удалён', color: 'bg-red-500/20 text-red-400' },
  };
  const s = c[status || 'draft'] || c.draft;
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

const getTotalExpenses = (r: DriverReport) => Number(r.fuel_amount || 0) + Number(r.total_expenses || 0);
function formatMoney(v: number | string | null) { const n = Number(v); return n && !isNaN(n) ? new Intl.NumberFormat("ru-RU").format(n) + " ₽" : "0 ₽"; }

function relativeTime(d: string | undefined) {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms/60000), h = Math.floor(ms/3600000), dy = Math.floor(ms/86400000);
  if (m < 1) return "только что";
  if (m < 60) return `${m}м назад`;
  if (h < 24) return `${h}ч назад`;
  if (dy === 1) return `вчера`;
  if (dy < 7) return `${dy}д назад`;
  return new Date(d).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit" });
}

const PER_PAGE = 20;
type SortField = "number" | "driver_name" | "vehicle_number" | "date_to" | "total_expenses" | "driver_accruals" | "mileage";
type SortDir = "asc" | "desc";

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<DriverReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all"); // "all" or "2026-01"
  const [sortField, setSortField] = useState<SortField>("date_to");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [ownVehicles, setOwnVehicles] = useState<Set<string>>(new Set());
  const [ownershipFilter, setOwnershipFilter] = useState<"all" | "own" | "hired">("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dateFrom, setDateFrom] = useState(searchParams?.get("from") || "");
  const [dateTo, setDateTo] = useState(searchParams?.get("to") || "");
  const [showRecalc, setShowRecalc] = useState(false);
  const [recalcMonth, setRecalcMonth] = useState("");
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcResult, setRecalcResult] = useState<any>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [searchDebounced, monthFilter, ownershipFilter, showDeleted, sortField, sortDir, dateFrom, dateTo]);

  // Sync dateFrom/dateTo to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    if (dateFrom) { if (params.get("from") !== dateFrom) { params.set("from", dateFrom); changed = true; } }
    else { if (params.has("from")) { params.delete("from"); changed = true; } }
    if (dateTo) { if (params.get("to") !== dateTo) { params.set("to", dateTo); changed = true; } }
    else { if (params.has("to")) { params.delete("to"); changed = true; } }
    if (changed) {
      const qs = params.toString();
      window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
    }
  }, [dateFrom, dateTo]);

  // Load own vehicles
  useEffect(() => {
    fetch("/rest/v1/vehicles?select=normalized_number&status=neq.archived")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOwnVehicles(new Set(data.map((v: any) => (v.normalized_number || '').toUpperCase()))); })
      .catch(() => {});
  }, []);

  const isHired = useCallback((vn: string) => {
    if (ownVehicles.size === 0) return false;
    const n = vn?.replace(/\s/g, '').replace(/0(\d{2})$/, '$1').toUpperCase() || '';
    return n !== '' && !ownVehicles.has(n);
  }, [ownVehicles]);

  // Fetch ALL reports (no date filter on API level — PostgREST)
  useEffect(() => {
    setLoading(true);
    fetch("/api/reports/list")
      .then(r => r.json())
      .then(data => setReports(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Available months from data
  const availableMonths = useMemo(() => {
    const set = new Map<string, string>();
    reports.forEach(r => {
      if (!r.date_to) return;
      const [y, m] = r.date_to.split('-');
      const key = `${y}-${m}`;
      const mi = parseInt(m) - 1;
      set.set(key, `${MONTHS[mi]} ${y}`);
    });
    return Array.from(set.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [reports]);

  // Filter + sort
  const filteredReports = useMemo(() => {
    const q = searchDebounced.toLowerCase();
    return reports
      .filter(r => {
        if (!showDeleted && r.status === 'deleted') return false;
        if (ownershipFilter === "own" && isHired(r.vehicle_number)) return false;
        if (ownershipFilter === "hired" && !isHired(r.vehicle_number)) return false;
        if (monthFilter !== "all") {
          const d = r.date_to || r.date_from || '';
          if (!d.startsWith(monthFilter)) return false;
        }
        if (dateFrom) {
          const d = r.date_from || '';
          if (d < dateFrom) return false;
        }
        if (dateTo) {
          const d = r.date_from || r.date_to || '';
          if (d > dateTo) return false;
        }
        if (q) {
          return (
            r.driver_name?.toLowerCase().includes(q) ||
            r.vehicle_number?.toLowerCase().includes(q) ||
            r.number?.toLowerCase().includes(q) ||
            String(r.total_expenses || '').includes(q) ||
            String(r.driver_accruals || '').includes(q) ||
            String(r.mileage || '').includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let av: any = a[sortField], bv: any = b[sortField];
        if (sortField === "date_to" || sortField === "number") { av = av || ""; bv = bv || ""; }
        else { av = av || 0; bv = bv || 0; }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [reports, searchDebounced, monthFilter, ownershipFilter, showDeleted, sortField, sortDir, isHired, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredReports.length / PER_PAGE);
  const pagedReports = filteredReports.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalExpenses = filteredReports.reduce((s, r) => s + getTotalExpenses(r), 0);
  const totalAccruals = filteredReports.reduce((s, r) => s + (r.driver_accruals || 0), 0);
  const totalMileage = filteredReports.reduce((s, r) => s + (r.mileage || 0), 0);

  const handleSort = (f: SortField) => { if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField(f); setSortDir("desc"); } };
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-600 ml-1">⇅</span>;
    return sortDir === "asc" ? <ChevronUp className="w-4 h-4 inline ml-1" /> : <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const ConsumptionCell = ({ r }: { r: DriverReport }) => {
    const mileage = r.total_mileage || r.mileage || 0;
    const fuel = r.fuel_quantity || 0;
    if (!mileage || !fuel) return <span className="text-slate-500">—</span>;
    const c = fuel / mileage * 100;
    if (c > 40) return <span className="text-red-400 font-bold">🔴 {c.toFixed(1)}</span>;
    if (c > 35) return <span className="text-yellow-400 font-bold">⚠️ {c.toFixed(1)}</span>;
    return <span className="text-slate-300">{c.toFixed(1)}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" /> Отчёты водителей
          </h1>
          <ExcelExport type="reports" label="📥 Excel" />
          <p className="text-slate-400 text-sm">{filteredReports.length} отчётов</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRecalc(true)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 px-3 py-2 rounded-lg font-medium transition text-sm">
            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Пересчитать</span>
          </button>
          <Link href="/reports/new" className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 px-3 py-2 rounded-lg font-medium transition text-sm sm:text-base sm:px-4">
            <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Создать</span><span className="sm:hidden">Новый</span>
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="Поиск по водителю, машине, номеру..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500" />
          </div>
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
            <button onClick={() => setOwnershipFilter("all")} className={`px-3 py-1 rounded text-sm transition ${ownershipFilter === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>Все</button>
            <button onClick={() => setOwnershipFilter("own")} className={`px-3 py-1 rounded text-sm transition ${ownershipFilter === "own" ? "bg-green-600 text-white" : "text-slate-400 hover:text-white"}`}>Свои</button>
            <button onClick={() => setOwnershipFilter("hired")} className={`px-3 py-1 rounded text-sm transition ${ownershipFilter === "hired" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"}`}>Наёмные</button>
          </div>
          <label className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer select-none">
            <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="accent-red-500" />
            🗑️
          </label>
        </div>

        {/* Month filter — year dropdown + month grid */}
        <div className="flex items-start gap-3">
          <select value={monthFilter === "all" ? "all" : monthFilter.substring(0, 4)}
            onChange={e => {
              if (e.target.value === "all") setMonthFilter("all");
              else setMonthFilter(e.target.value + "-" + String(new Date().getMonth() + 1).padStart(2, "0"));
            }}
            className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600">
            <option value="all">Все</option>
            {Array.from(new Set(availableMonths.map(([k]) => k.substring(0, 4)))).filter(y => parseInt(y) >= 2024).sort((a, b) => b.localeCompare(a)).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {monthFilter !== "all" && (
            <div className="grid grid-cols-6 gap-1">
              {["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"].map((m, i) => {
                const key = (monthFilter === "all" ? String(new Date().getFullYear()) : monthFilter.substring(0, 4)) + "-" + String(i + 1).padStart(2, "0");
                const hasData = availableMonths.some(([k]) => k === key);
                const isSelected = monthFilter === key;
                const isFuture = new Date(key + "-01") > new Date();
                return (
                  <button key={i} disabled={isFuture}
                    onClick={() => setMonthFilter(key)}
                    className={`px-2 py-1 rounded text-xs font-medium transition ${isSelected ? "bg-blue-600 text-white" : hasData ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-800 text-slate-600"} ${isFuture ? "opacity-30 cursor-not-allowed" : ""}`}>
                    {m}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-400">Период:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="bg-slate-700 text-white text-xs rounded px-2 py-1.5 border border-slate-600" />
        <span className="text-slate-500">—</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="bg-slate-700 text-white text-xs rounded px-2 py-1.5 border border-slate-600" />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-slate-400 hover:text-white px-1">✕ Сбросить</button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <div className="text-slate-400 text-xs">Отчётов</div>
          <div className="text-xl font-bold text-white">{filteredReports.length}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <div className="text-slate-400 text-xs">Расходы</div>
          <div className="text-base font-bold text-red-400">{formatMoney(totalExpenses)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <div className="text-slate-400 text-xs">Начисления</div>
          <div className="text-base font-bold text-green-400">{formatMoney(totalAccruals)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <div className="text-slate-400 text-xs">Пробег</div>
          <div className="text-base font-bold text-cyan-400">{totalMileage.toLocaleString("ru-RU")} км</div>
        </div>
      </div>

      {/* Table */}
      <div className="hidden md:block bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("number")}>№ <SortIcon field="number" /></th>
                <th className="text-left p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("driver_name")}>ВОДИТЕЛЬ <SortIcon field="driver_name" /></th>
                <th className="text-left p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("vehicle_number")}>МАШИНА <SortIcon field="vehicle_number" /></th>
                <th className="text-left p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("date_to")}>ПЕРИОД <SortIcon field="date_to" /></th>
                <th className="text-right p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("total_expenses")}>РАСХОДЫ <SortIcon field="total_expenses" /></th>
                <th className="text-right p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("driver_accruals")}>НАЧИСЛ. <SortIcon field="driver_accruals" /></th>
                <th className="text-right p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("mileage")}>ПРОБЕГ <SortIcon field="mileage" /></th>
                <th className="text-right p-3">РАСХОД</th>
                <th className="text-center p-3">СТАТУС</th>
                <th className="text-right p-3">ИЗМЕНЁН</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="p-8 text-center text-slate-400">Загрузка...</td></tr>
              ) : pagedReports.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-slate-400">Нет отчётов</td></tr>
              ) : pagedReports.map(r => {
                const isDel = r.status === 'deleted';
                const recent = Date.now() - new Date(r.updated_at || 0).getTime() < 86400000;
                return (
                  <tr key={r.id} onClick={() => router.push("/reports/" + (r.number || r.id))}
                    className={`border-t border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition ${isDel ? 'opacity-40 line-through' : ''} ${recent ? 'bg-blue-900/10' : ''}`}>
                    <td className="p-3 text-cyan-400 font-mono text-xs">{isDel ? '🗑️ ' : ''}{r.number}</td>
                    <td className="p-3 text-white">{r.driver_name || "—"}</td>
                    <td className="p-3 text-slate-300 text-xs">
                      {r.vehicle_number}
                      {isHired(r.vehicle_number) && <span className="ml-1 text-[10px] bg-cyan-500/20 text-cyan-400 px-1 py-0.5 rounded-full">наём</span>}
                    </td>
                    <td className="p-3 text-slate-400 text-xs">{formatShortDate(r.date_from)} — {formatShortDate(r.date_to)}</td>
                    <td className="p-3 text-right text-red-400 text-xs">{formatMoney(getTotalExpenses(r))}</td>
                    <td className="p-3 text-right text-green-400 text-xs">{formatMoney(r.driver_accruals)}</td>
                    <td className="p-3 text-right text-xs">{
                      (!r.total_mileage && !r.mileage) && (r.total_expenses > 0 || r.fuel_quantity > 0)
                        ? <span className="text-yellow-400" title="Пробег = 0, но есть расходы/топливо">⚠️ 0 км</span>
                        : <span className="text-cyan-400">{(r.total_mileage || r.mileage || 0).toLocaleString("ru-RU")}</span>
                    }</td>
                    <td className="p-3 text-right text-xs"><ConsumptionCell r={r} /></td>
                    <td className="p-3 text-center"><StatusBadge status={r.status} /></td>
                    <td className={`p-3 text-right text-xs ${recent ? 'text-blue-400' : 'text-slate-500'}`}>
                      {relativeTime(r.updated_at)}
                      {r.updated_by && <div className="text-slate-600 text-[10px]">{r.updated_by}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-slate-700/50 bg-slate-900/30">
            <span className="text-slate-400 text-sm">
              {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, filteredReports.length)} из {filteredReports.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 transition"><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pn: number;
                if (totalPages <= 7) pn = i + 1;
                else if (page <= 4) pn = i + 1;
                else if (page >= totalPages - 3) pn = totalPages - 6 + i;
                else pn = page - 3 + i;
                return (
                  <button key={pn} onClick={() => setPage(pn)}
                    className={`w-8 h-8 rounded text-sm transition ${page === pn ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                    {pn}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 transition"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Загрузка...</div>
        ) : pagedReports.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Нет отчётов</div>
        ) : pagedReports.map(r => (
          <div key={r.id} onClick={() => router.push("/reports/" + (r.number || r.id))}
            className={`bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 cursor-pointer active:bg-slate-700/30 transition ${r.status === 'deleted' ? 'opacity-40' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-mono text-sm">{r.number}</span>
                <StatusBadge status={r.status} />
              </div>
              <span className="text-slate-400 text-xs">{formatShortDate(r.date_from)} — {formatShortDate(r.date_to)}</span>
            </div>
            <div className="text-white font-medium mb-1">{r.driver_name || "—"}</div>
            <div className="text-slate-400 text-sm mb-3">
              {r.vehicle_number}
              {isHired(r.vehicle_number) && <span className="ml-1.5 text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full">наём</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-xs text-slate-500">Расходы</div><div className="text-red-400 text-sm font-medium">{formatMoney(getTotalExpenses(r))}</div></div>
              <div><div className="text-xs text-slate-500">Начисл.</div><div className="text-green-400 text-sm font-medium">{formatMoney(r.driver_accruals)}</div></div>
              <div><div className="text-xs text-slate-500">Пробег</div><div className="text-cyan-400 text-sm font-medium">{r.mileage ? r.mileage.toLocaleString("ru-RU") : "0"}</div></div>
            </div>
          </div>
        ))}

        {/* Mobile pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="px-4 py-2 bg-slate-700 rounded-lg disabled:opacity-30">←</button>
            <span className="text-slate-400 text-sm">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
              className="px-4 py-2 bg-slate-700 rounded-lg disabled:opacity-30">→</button>
          </div>
        )}
      </div>

      {/* Recalc Modal */}
      {showRecalc && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !recalcLoading && setShowRecalc(false)}>
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">🔄 Пересчитать период</h2>
            <p className="text-slate-400 text-sm mb-4">Пересчёт топлива, пробега и категорий расходов из первичных данных (fuel_transactions, trips).</p>
            
            <label className="block text-sm text-slate-300 mb-1">Месяц</label>
            <input type="month" value={recalcMonth} onChange={e => setRecalcMonth(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white mb-4" />
            
            {recalcResult && !recalcLoading && (
              <div className="bg-slate-900/50 rounded-lg p-3 mb-4 text-sm">
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-slate-400">Обработано:</span><span className="text-white font-medium">{recalcResult.processed}</span>
                  <span className="text-slate-400">Топливо:</span><span className="text-green-400">{recalcResult.fuel_updated} обновлено</span>
                  <span className="text-slate-400">WB пробег:</span><span className="text-green-400">{recalcResult.wb_mileage_updated} обновлено</span>
                  <span className="text-slate-400">RF пробег:</span><span className="text-green-400">{recalcResult.mileage_updated} восстановлено</span>
                  <span className="text-slate-400">Общий пробег:</span><span className="text-green-400">{recalcResult.total_mileage_updated} обновлено</span>
                  <span className="text-slate-400">Категории:</span><span className="text-green-400">{recalcResult.expenses_updated} нормализовано</span>
                </div>
                {recalcResult.errors?.length > 0 && (
                  <div className="mt-2 text-red-400">Ошибок: {recalcResult.errors.length}</div>
                )}
                {recalcResult.needs_manual_review?.length > 0 && (
                  <div className="mt-2 text-amber-400">Требуют проверки: {recalcResult.needs_manual_review.length}</div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowRecalc(false); setRecalcResult(null); }} disabled={recalcLoading}
                className="px-4 py-2 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition text-sm">Закрыть</button>
              <button onClick={async () => {
                if (!recalcMonth) return;
                setRecalcLoading(true); setRecalcResult(null);
                try {
                  const res = await fetch("/api/reports/batch-recalc", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ months: [recalcMonth] }) });
                  const data = await res.json();
                  setRecalcResult(data);
                  // Reload reports
                  const resp = await fetch("/api/driver-reports?select=*&order=date_from.desc&limit=5000");
                  if (resp.ok) { const d = await resp.json(); setReports(d); }
                } catch (e: any) { setRecalcResult({ error: e.message }); }
                setRecalcLoading(false);
              }} disabled={recalcLoading || !recalcMonth}
                className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium transition text-sm disabled:opacity-50 flex items-center gap-2">
                {recalcLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Пересчёт...</> : <>🔄 Пересчитать</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
