"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  AlertTriangle,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  MapPinOff,
  Activity,
  Clock,
  Signal,
  SignalZero,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  vehicle: string;
  vehicle_type: string;
  vehicle_status: string;
  driver: string | null;
  gps_status: "moving" | "idle_short" | "idle_long" | "no_data" | "error";
  distance_24h: number;
  distance_3h: number;
  route: string;
  loading_date: string | null;
  unloading_date: string | null;
}

interface Stats {
  total: number;
  moving: number;
  idle_short: number;
  idle_long: number;
  no_data: number;
}

interface StatusResponse {
  vehicles: Vehicle[];
  stats: Stats;
  cacheAge: number;
  cacheTime: string | null;
}

interface Alert {
  type: "error" | "warning";
  vehicle: string;
  driver: string | null;
  message: string;
  category: "idle" | "gps";
}

type GpsFilter = "all" | "moving" | "idle" | "no_data";
type SortField =
  | "vehicle"
  | "vehicle_type"
  | "driver"
  | "gps_status"
  | "distance_24h"
  | "distance_3h"
  | "route"
  | "loading_date";
type SortDir = "asc" | "desc";

// ─── API fetchers ─────────────────────────────────────────────────────────────

async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch("/api/dispatch/status");
  if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
  return res.json();
}

async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch("/api/dispatch/alerts");
  if (!res.ok) throw new Error(`Alerts fetch failed: ${res.status}`);
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateDDMM(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}`;
  } catch {
    return "—";
  }
}

function truncate(str: string, max: number): string {
  if (!str) return "—";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function formatCacheAge(seconds: number, cacheTime?: string | null): string {
  if (seconds < 0 || !cacheTime) return "нет данных";
  const time = new Date(cacheTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
  if (seconds < 120) return `${Math.round(seconds)} сек назад`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин назад (${time} МСК)`;
  return `данные от ${time} МСК`;
}

const GPS_STATUS_ORDER: Record<string, number> = {
  moving: 0,
  idle_short: 1,
  idle_long: 2,
  no_data: 3,
  error: 4,
};

// ─── Status badge component ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: Vehicle["gps_status"] }) {
  const config: Record<
    Vehicle["gps_status"],
    { label: string; bg: string; text: string; dot: string }
  > = {
    moving: {
      label: "Едет",
      bg: "bg-emerald-900/60",
      text: "text-emerald-300",
      dot: "bg-emerald-400",
    },
    idle_short: {
      label: "Стоит",
      bg: "bg-yellow-900/60",
      text: "text-yellow-300",
      dot: "bg-yellow-400",
    },
    idle_long: {
      label: "Простой",
      bg: "bg-red-900/60",
      text: "text-red-300",
      dot: "bg-red-400",
    },
    no_data: {
      label: "Нет GPS",
      bg: "bg-slate-700/80",
      text: "text-slate-400",
      dot: "bg-slate-500",
    },
    error: {
      label: "Нет GPS",
      bg: "bg-slate-700/80",
      text: "text-slate-400",
      dot: "bg-slate-500",
    },
  };

  const c = config[status] ?? config.no_data;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ─── Stats card component ─────────────────────────────────────────────────────

function StatsCard({
  icon,
  label,
  value,
  bgClass,
  textClass,
  borderClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bgClass: string;
  textClass: string;
  borderClass: string;
}) {
  return (
    <div
      className={`rounded-xl border ${borderClass} ${bgClass} p-4 flex flex-col gap-1 min-w-0`}
    >
      <div className={`flex items-center gap-2 ${textClass}`}>
        {icon}
        <span className="text-sm font-medium truncate">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${textClass}`}>{value}</div>
    </div>
  );
}

// ─── Sort header component ────────────────────────────────────────────────────

function SortHeader({
  label,
  field,
  currentSort,
  currentDir,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const isActive = currentSort === field;
  return (
    <th
      className={`px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-200 transition-colors ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="w-3 h-3 text-blue-400" />
          ) : (
            <ArrowDown className="w-3 h-3 text-blue-400" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </div>
    </th>
  );
}

// ─── Alerts banner component ──────────────────────────────────────────────────

function AlertsBanner({ alerts }: { alerts: Alert[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!alerts || alerts.length === 0) return null;

  const errorCount = alerts.filter((a) => a.type === "error").length;
  const warningCount = alerts.filter((a) => a.type === "warning").length;

  const bannerBg =
    errorCount > 0
      ? "bg-red-900/40 border-red-700/60"
      : "bg-yellow-900/40 border-yellow-700/60";
  const bannerText = errorCount > 0 ? "text-red-300" : "text-yellow-300";

  return (
    <div className={`rounded-xl border ${bannerBg} overflow-hidden`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-3 ${bannerText} hover:bg-white/5 transition-colors`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            {errorCount > 0 && (
              <span className="text-red-300">
                {errorCount} {errorCount === 1 ? "ошибка" : "ошибок"}
              </span>
            )}
            {errorCount > 0 && warningCount > 0 && (
              <span className="text-slate-500 mx-1">·</span>
            )}
            {warningCount > 0 && (
              <span className="text-yellow-300">
                {warningCount}{" "}
                {warningCount === 1 ? "предупреждение" : "предупреждений"}
              </span>
            )}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-700/50 divide-y divide-slate-700/50">
          {alerts.map((alert, idx) => (
            <div
              key={`${alert.vehicle}-${idx}`}
              className="flex items-start gap-3 px-4 py-2.5 text-sm"
            >
              {alert.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <span
                  className={
                    alert.type === "error"
                      ? "text-red-300 font-medium"
                      : "text-yellow-300 font-medium"
                  }
                >
                  {alert.vehicle}
                </span>
                {alert.driver && (
                  <span className="text-slate-500 ml-1.5">
                    ({alert.driver})
                  </span>
                )}
                <span className="text-slate-400 ml-1.5">{alert.message}</span>
              </div>
              <span className="ml-auto text-xs text-slate-600 flex-shrink-0 uppercase">
                {alert.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter buttons component ─────────────────────────────────────────────────

function FilterButtons({
  active,
  onChange,
  stats,
}: {
  active: GpsFilter;
  onChange: (f: GpsFilter) => void;
  stats: Stats | undefined;
}) {
  const buttons: { key: GpsFilter; label: string; count?: number }[] = [
    { key: "all", label: "Все", count: stats?.total },
    { key: "moving", label: "Едет", count: stats?.moving },
    { key: "idle", label: "Стоит", count: (stats?.idle_short ?? 0) + (stats?.idle_long ?? 0) },
    { key: "no_data", label: "Нет GPS", count: stats?.no_data },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {buttons.map((btn) => {
        const isActive = active === btn.key;
        return (
          <button
            key={btn.key}
            onClick={() => onChange(btn.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-slate-700/60 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
            }`}
          >
            {btn.label}
            {btn.count !== undefined && (
              <span
                className={`ml-1.5 ${isActive ? "text-blue-200" : "text-slate-500"}`}
              >
                {btn.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function DispatchPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<GpsFilter>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("gps_status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ── Data fetching ──────────────────────────────────────────────────────────
  const {
    data: statusData,
    isLoading: statusLoading,
    isError: statusError,
    error: statusErr,
    refetch: refetchStatus,
    dataUpdatedAt: statusUpdatedAt,
  } = useQuery<StatusResponse>({
    queryKey: ["dispatch-status"],
    queryFn: fetchStatus,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });

  const {
    data: alertsData,
    isLoading: alertsLoading,
    isError: alertsError,
  } = useQuery<Alert[]>({
    queryKey: ["dispatch-alerts"],
    queryFn: fetchAlerts,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });

  // ── Sort handler ───────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField]
  );

  // ── Filter + sort vehicles ─────────────────────────────────────────────────
  const filteredVehicles = useMemo(() => {
    if (!statusData?.vehicles) return [];

    let list = [...statusData.vehicles];

    // Apply GPS filter
    if (filter === "moving") {
      list = list.filter((v) => v.gps_status === "moving");
    } else if (filter === "idle") {
      list = list.filter(
        (v) => v.gps_status === "idle_short" || v.gps_status === "idle_long"
      );
    } else if (filter === "no_data") {
      list = list.filter(
        (v) => v.gps_status === "no_data" || v.gps_status === "error"
      );
    }

    // Apply search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.vehicle.toLowerCase().includes(q) ||
          (v.driver && v.driver.toLowerCase().includes(q))
      );
    }

    // Apply sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "vehicle":
          cmp = a.vehicle.localeCompare(b.vehicle, "ru");
          break;
        case "vehicle_type":
          cmp = (a.vehicle_type ?? "").localeCompare(
            b.vehicle_type ?? "",
            "ru"
          );
          break;
        case "driver":
          cmp = (a.driver ?? "яяя").localeCompare(b.driver ?? "яяя", "ru");
          break;
        case "gps_status":
          cmp =
            (GPS_STATUS_ORDER[a.gps_status] ?? 99) -
            (GPS_STATUS_ORDER[b.gps_status] ?? 99);
          break;
        case "distance_24h":
          cmp = (a.distance_24h ?? 0) - (b.distance_24h ?? 0);
          break;
        case "distance_3h":
          cmp = (a.distance_3h ?? 0) - (b.distance_3h ?? 0);
          break;
        case "route":
          cmp = (a.route ?? "").localeCompare(b.route ?? "", "ru");
          break;
        case "loading_date":
          cmp = (a.loading_date ?? "").localeCompare(
            b.loading_date ?? "",
            "ru"
          );
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [statusData?.vehicles, filter, search, sortField, sortDir]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const stats = statusData?.stats;
  const cacheAge = statusData?.cacheAge ?? 0;
  const cacheTime = statusData?.cacheTime ?? null;
  const alerts = alertsData ?? [];
  const isLoading = statusLoading || alertsLoading;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6 text-blue-400" />
            <h1 className="text-lg font-bold tracking-tight">Диспетчерская</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {statusData && (
              <span className="hidden sm:inline">
                Обновлено {formatCacheAge(cacheAge, cacheTime)}
              </span>
            )}
            <button
              onClick={() => refetchStatus()}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-slate-200"
              title="Обновить"
            >
              <RefreshCw
                className={`w-4 h-4 ${statusLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Error state */}
        {statusError && (
          <div className="rounded-xl border border-red-700/60 bg-red-900/30 p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">
                Ошибка загрузки данных
              </p>
              <p className="text-xs text-red-400/70 mt-0.5">
                {(statusErr as Error)?.message ?? "Неизвестная ошибка"}
              </p>
            </div>
            <button
              onClick={() => refetchStatus()}
              className="ml-auto px-3 py-1.5 rounded-lg bg-red-800/50 text-red-300 text-sm hover:bg-red-800/80 transition-colors"
            >
              Повторить
            </button>
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard
            icon={<Activity className="w-5 h-5" />}
            label="В пути"
            value={stats?.moving ?? 0}
            bgClass="bg-emerald-950/40"
            textClass="text-emerald-400"
            borderClass="border-emerald-800/50"
          />
          <StatsCard
            icon={<Clock className="w-5 h-5" />}
            label="Стоит"
            value={stats?.idle_short ?? 0}
            bgClass="bg-yellow-950/40"
            textClass="text-yellow-400"
            borderClass="border-yellow-800/50"
          />
          <StatsCard
            icon={<Signal className="w-5 h-5" />}
            label="Простой"
            value={stats?.idle_long ?? 0}
            bgClass="bg-red-950/40"
            textClass="text-red-400"
            borderClass="border-red-800/50"
          />
          <StatsCard
            icon={<SignalZero className="w-5 h-5" />}
            label="Нет GPS"
            value={stats?.no_data ?? 0}
            bgClass="bg-slate-800/60"
            textClass="text-slate-400"
            borderClass="border-slate-700/50"
          />
        </div>

        {/* Cache age - mobile only */}
        {statusData && (
          <p className="text-xs text-slate-600 sm:hidden">
            Обновлено {formatCacheAge(cacheAge, cacheTime)}
          </p>
        )}

        {/* Alerts banner */}
        {!alertsLoading && !alertsError && alerts.length > 0 && (
          <AlertsBanner alerts={alerts} />
        )}

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <FilterButtons
            active={filter}
            onChange={setFilter}
            stats={stats}
          />
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Поиск по номеру или водителю…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-800 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && !statusData && (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-slate-800/50 rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Vehicle table */}
        {statusData && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/80">
                    <SortHeader
                      label="Машина"
                      field="vehicle"
                      currentSort={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortHeader
                      label="Тип"
                      field="vehicle_type"
                      currentSort={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortHeader
                      label="Водитель"
                      field="driver"
                      currentSort={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortHeader
                      label="Статус"
                      field="gps_status"
                      currentSort={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortHeader
                      label="24ч км"
                      field="distance_24h"
                      currentSort={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                      className="text-right"
                    />
                    <SortHeader
                      label="3ч км"
                      field="distance_3h"
                      currentSort={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                      className="text-right"
                    />
                    <SortHeader
                      label="Маршрут"
                      field="route"
                      currentSort={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortHeader
                      label="Погрузка"
                      field="loading_date"
                      currentSort={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {filteredVehicles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Truck className="w-8 h-8 opacity-30" />
                          <span>Нет машин по фильтру</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((v) => (
                      <tr
                        key={v.vehicle}
                        className="hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-3 py-3 text-sm font-medium text-slate-200 whitespace-nowrap">
                          {v.vehicle}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-400 whitespace-nowrap">
                          {v.vehicle_type ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-300 whitespace-nowrap">
                          {v.driver ?? "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <StatusBadge status={v.gps_status} />
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-300 text-right tabular-nums whitespace-nowrap">
                          {v.distance_24h != null
                            ? Math.round(v.distance_24h)
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-300 text-right tabular-nums whitespace-nowrap">
                          {v.distance_3h != null
                            ? Math.round(v.distance_3h)
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-400 max-w-[200px]">
                          <span title={v.route}>
                            {truncate(v.route, 30)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-400 whitespace-nowrap">
                          {formatDateDDMM(v.loading_date)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-slate-700/30">
              {filteredVehicles.length === 0 ? (
                <div className="px-4 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Truck className="w-8 h-8 opacity-30" />
                    <span>Нет машин по фильтру</span>
                  </div>
                </div>
              ) : (
                filteredVehicles.map((v) => (
                  <div
                    key={v.vehicle}
                    className="p-4 space-y-2.5 hover:bg-slate-700/10 transition-colors"
                  >
                    {/* Row 1: plate + status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-200 text-sm">
                        {v.vehicle}
                      </span>
                      <StatusBadge status={v.gps_status} />
                    </div>

                    {/* Row 2: type + driver */}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="bg-slate-700/60 px-2 py-0.5 rounded">
                        {v.vehicle_type ?? "—"}
                      </span>
                      <span>{v.driver ?? "Без водителя"}</span>
                    </div>

                    {/* Row 3: distances + route */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">24ч: </span>
                        <span className="text-slate-300 tabular-nums">
                          {v.distance_24h != null
                            ? Math.round(v.distance_24h)
                            : "—"}{" "}
                          км
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">3ч: </span>
                        <span className="text-slate-300 tabular-nums">
                          {v.distance_3h != null
                            ? Math.round(v.distance_3h)
                            : "—"}{" "}
                          км
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Погр: </span>
                        <span className="text-slate-300">
                          {formatDateDDMM(v.loading_date)}
                        </span>
                      </div>
                    </div>

                    {/* Row 4: route */}
                    {v.route && (
                      <div className="text-xs text-slate-500 truncate">
                        📍 {v.route}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Table footer */}
            <div className="border-t border-slate-700/50 px-4 py-2.5 bg-slate-800/60 flex items-center justify-between text-xs text-slate-500">
              <span>
                Показано {filteredVehicles.length} из {stats?.total ?? 0}
              </span>
              {statusUpdatedAt > 0 && (
                <span>
                  Данные:{" "}
                  {new Date(statusUpdatedAt).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Bottom note */}
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-700/30 bg-slate-800/30 p-4 text-xs text-slate-500">
          <MapPinOff className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-60" />
          <p>
            Карта недоступна: Locarus API не поддерживает координаты в реальном
            времени (только Distance через do.calc.vars)
          </p>
        </div>
      </main>
    </div>
  );
}
