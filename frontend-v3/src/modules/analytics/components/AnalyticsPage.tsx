"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Fuel,
  Truck,
  MapPin,
  AlertTriangle,
  DollarSign,
  Gauge,
  Route,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnitEconomicsRow {
  vehicle: string;
  vehicle_type: string;
  revenue: number;
  fuel_cost: number;
  salary: number;
  expenses: number;
  leasing: number;
  margin: number;
  margin_pct: number;
  mileage: number;
  cost_per_km: number;
  revenue_per_km: number;
  profit_per_km: number;
  wb_trips: number;
  rf_trips: number;
}

interface FuelRow {
  vehicle: string;
  vehicle_type: string;
  gps_mileage: number;
  fuel_fact_liters: number;
  fuel_norm_liters: number;
  overconsumption_liters: number;
  overconsumption_pct: number;
  fuel_cost: number;
  norm_rate: number;
  fact_rate: number;
}

interface UtilizationRow {
  vehicle: string;
  vehicle_type: string;
  work_days: number;
  calendar_days: number;
  utilization_pct: number;
  trips_count: number;
  total_km: number;
  revenue_per_day: number;
  revenue: number;
}

interface RouteRow {
  route: string;
  trips: number;
  total_revenue: number;
  avg_rate: number;
}

interface Recommendation {
  type: "error" | "warning" | "info" | "success";
  vehicle?: string;
  category: string;
  message: string;
  detail: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} М ₽`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} К ₽`;
  return `${sign}${Math.round(abs)} ₽`;
}

function formatNum(v: number, decimals = 0): string {
  return v.toLocaleString("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function getMonthStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return getMonthStr(d);
}

const recIcons: Record<string, string> = {
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  success: "✅",
};

const recColors: Record<string, string> = {
  error: "border-red-500/40 bg-red-500/10",
  warning: "border-yellow-500/40 bg-yellow-500/10",
  info: "border-blue-500/40 bg-blue-500/10",
  success: "border-emerald-500/40 bg-emerald-500/10",
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Components ───────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 flex items-start gap-3 border border-slate-700/50">
      <div className="p-2 rounded-lg bg-slate-700/50 text-slate-300 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 truncate">{label}</p>
        <p className="text-lg font-semibold text-white truncate">{value}</p>
        {sub && <p className="text-xs text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function MonthSelector({
  month,
  onChange,
}: {
  month: string;
  onChange: (m: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-medium text-white min-w-[140px] text-center">
        {getMonthLabel(month)}
      </span>
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
          : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700/50"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-20 text-red-400">
      <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
      <p>{message}</p>
    </div>
  );
}

// ─── Recommendations Block ───────────────────────────────────────────────────

function RecommendationsBlock({ month }: { month: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery<Recommendation[]>({
    queryKey: ["recommendations", month],
    queryFn: () =>
      fetchJson(`/api/analytics/recommendations?month=${month}`),
  });

  const count = data?.length ?? 0;
  const errorCount = data?.filter((r) => r.type === "error").length ?? 0;
  const warnCount = data?.filter((r) => r.type === "warning").length ?? 0;

  if (isLoading) return null;
  if (!data || count === 0) return null;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <span className="font-medium text-white">Рекомендации</span>
          <div className="flex gap-1.5">
            {errorCount > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 font-medium">
                {errorCount} ошиб.
              </span>
            )}
            {warnCount > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 font-medium">
                {warnCount} пред.
              </span>
            )}
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-600 text-slate-300 font-medium">
              {count}
            </span>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 max-h-[400px] overflow-y-auto">
          {data.map((rec, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border ${recColors[rec.type]}`}
            >
              <span className="text-lg shrink-0 leading-none mt-0.5">
                {recIcons[rec.type]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {rec.vehicle && (
                    <span className="text-xs font-mono px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-300">
                      {rec.vehicle}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{rec.category}</span>
                </div>
                <p className="text-sm text-white mt-0.5">{rec.message}</p>
                {rec.detail && (
                  <p className="text-xs text-slate-400 mt-1">{rec.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Экономика ──────────────────────────────────────────────────────────

function EconomicsTab({ month }: { month: string }) {
  const { data, isLoading, error } = useQuery<UnitEconomicsRow[]>({
    queryKey: ["unit-economics", month],
    queryFn: () =>
      fetchJson(`/api/analytics/unit-economics?month=${month}`),
  });

  const sorted = useMemo(
    () => (data ? [...data].sort((a, b) => b.margin - a.margin) : []),
    [data]
  );

  const totals = useMemo(() => {
    if (!data || data.length === 0)
      return { revenue: 0, margin: 0, avgMarginPct: 0, count: 0 };
    const revenue = data.reduce((s, r) => s + r.revenue, 0);
    const margin = data.reduce((s, r) => s + r.margin, 0);
    const avgMarginPct =
      data.reduce((s, r) => s + r.margin_pct, 0) / data.length;
    return { revenue, margin, avgMarginPct, count: data.length };
  }, [data]);

  const chartData = useMemo(() => {
    return sorted.slice(0, 10).map((r) => ({
      name: r.vehicle,
      margin: r.margin,
    }));
  }, [sorted]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Ошибка загрузки экономики" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Выручка"
          value={formatMoney(totals.revenue)}
        />
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Маржа"
          value={formatMoney(totals.margin)}
          sub={totals.margin >= 0 ? "прибыль" : "убыток"}
        />
        <SummaryCard
          icon={<Gauge className="w-5 h-5" />}
          label="Ср. маржинальность"
          value={formatPct(totals.avgMarginPct)}
        />
        <SummaryCard
          icon={<Truck className="w-5 h-5" />}
          label="Автопарк"
          value={`${totals.count} ед.`}
        />
      </div>

      {/* Chart */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
        <h3 className="text-sm font-medium text-slate-300 mb-4">
          Топ-10 машин по марже
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                tickFormatter={(v) => formatMoney(v)}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                width={55}
              />
              <Tooltip
                formatter={(v: number) => [formatMoney(v), "Маржа"]}
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#fff",
                }}
              />
              <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.margin >= 0 ? "#22c55e" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {[
                  "Машина",
                  "Тип",
                  "Выручка",
                  "Топливо",
                  "ЗП",
                  "Лизинг",
                  "Маржа",
                  "Маржа%",
                  "₽/км",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sorted.map((r) => (
                <tr
                  key={r.vehicle}
                  className="hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-white text-xs whitespace-nowrap">
                    {r.vehicle}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                    {r.vehicle_type}
                  </td>
                  <td className="px-3 py-2.5 text-white text-xs whitespace-nowrap">
                    {formatMoney(r.revenue)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {formatMoney(r.fuel_cost)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {formatMoney(r.salary)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {formatMoney(r.leasing)}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-medium text-xs whitespace-nowrap ${
                      r.margin < 0 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {formatMoney(r.margin)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-xs whitespace-nowrap ${
                      r.margin_pct < 0 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {formatPct(r.margin_pct)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {formatNum(r.profit_per_km, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Топливо ────────────────────────────────────────────────────────────

function FuelTab({ month }: { month: string }) {
  const { data, isLoading, error } = useQuery<FuelRow[]>({
    queryKey: ["fuel", month],
    queryFn: () => fetchJson(`/api/analytics/fuel?month=${month}`),
  });

  const sorted = useMemo(
    () =>
      data
        ? [...data].sort(
            (a, b) => b.overconsumption_pct - a.overconsumption_pct
          )
        : [],
    [data]
  );

  const totals = useMemo(() => {
    if (!data || data.length === 0)
      return { totalLiters: 0, totalOver: 0, avgRate: 0 };
    const totalLiters = data.reduce((s, r) => s + r.fuel_fact_liters, 0);
    const totalOver = data.reduce((s, r) => s + r.overconsumption_liters, 0);
    const avgRate =
      data.reduce((s, r) => s + r.fact_rate, 0) / data.length;
    return { totalLiters, totalOver, avgRate };
  }, [data]);

  const chartData = useMemo(() => {
    return sorted.slice(0, 10).map((r) => ({
      name: r.vehicle,
      pct: r.overconsumption_pct,
    }));
  }, [sorted]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Ошибка загрузки данных по топливу" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <SummaryCard
          icon={<Fuel className="w-5 h-5" />}
          label="Всего топлива"
          value={`${formatNum(totals.totalLiters)} л`}
        />
        <SummaryCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Перерасход"
          value={`${formatNum(totals.totalOver)} л`}
          sub={totals.totalOver > 0 ? "выше нормы" : "в норме"}
        />
        <SummaryCard
          icon={<Gauge className="w-5 h-5" />}
          label="Ср. факт. расход"
          value={`${formatNum(totals.avgRate, 1)} л/100км`}
        />
      </div>

      {/* Chart */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
        <h3 className="text-sm font-medium text-slate-300 mb-4">
          Топ-10 по перерасходу (%)
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                width={55}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(1)}%`, "Перерасход"]}
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#fff",
                }}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.pct > 0 ? "#ef4444" : "#22c55e"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {[
                  "Машина",
                  "Тип",
                  "Пробег",
                  "Факт, л",
                  "Норма, л",
                  "Перерасход",
                  "%",
                  "Факт расход",
                  "Норма расход",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sorted.map((r) => (
                <tr
                  key={r.vehicle}
                  className="hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-white text-xs whitespace-nowrap">
                    {r.vehicle}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                    {r.vehicle_type}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {formatNum(r.gps_mileage)} км
                  </td>
                  <td className="px-3 py-2.5 text-white text-xs whitespace-nowrap">
                    {formatNum(r.fuel_fact_liters)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {formatNum(r.fuel_norm_liters)}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-medium text-xs whitespace-nowrap ${
                      r.overconsumption_liters > 0
                        ? "text-red-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {formatNum(r.overconsumption_liters)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-xs whitespace-nowrap ${
                      r.overconsumption_pct > 0
                        ? "text-red-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {formatPct(r.overconsumption_pct)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {formatNum(r.fact_rate, 1)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {formatNum(r.norm_rate, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Загрузка ───────────────────────────────────────────────────────────

function UtilizationTab({ month }: { month: string }) {
  const { data, isLoading, error } = useQuery<UtilizationRow[]>({
    queryKey: ["utilization", month],
    queryFn: () =>
      fetchJson(`/api/analytics/utilization?month=${month}`),
  });

  const sorted = useMemo(
    () =>
      data
        ? [...data].sort((a, b) => a.utilization_pct - b.utilization_pct)
        : [],
    [data]
  );

  const totals = useMemo(() => {
    if (!data || data.length === 0)
      return { avgUtil: 0, totalWorkDays: 0, idleCount: 0 };
    const avgUtil =
      data.reduce((s, r) => s + r.utilization_pct, 0) / data.length;
    const totalWorkDays = data.reduce((s, r) => s + r.work_days, 0);
    const idleCount = data.filter((r) => r.utilization_pct === 0).length;
    return { avgUtil, totalWorkDays, idleCount };
  }, [data]);

  const chartData = useMemo(() => {
    return sorted.map((r) => ({
      name: r.vehicle,
      pct: r.utilization_pct,
    }));
  }, [sorted]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Ошибка загрузки загрузки" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <SummaryCard
          icon={<Gauge className="w-5 h-5" />}
          label="Ср. загрузка"
          value={formatPct(totals.avgUtil)}
        />
        <SummaryCard
          icon={<Truck className="w-5 h-5" />}
          label="Рабочих дней"
          value={formatNum(totals.totalWorkDays)}
          sub="суммарно по парку"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Простаивают"
          value={`${totals.idleCount} ед.`}
          sub="0% загрузки"
        />
      </div>

      {/* Chart */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
        <h3 className="text-sm font-medium text-slate-300 mb-4">
          Загрузка по машинам (%)
        </h3>
        <div style={{ height: Math.max(300, sorted.length * 28) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                width={55}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(1)}%`, "Загрузка"]}
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#fff",
                }}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.pct >= 70
                        ? "#22c55e"
                        : entry.pct >= 40
                        ? "#eab308"
                        : "#ef4444"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {[
                  "Машина",
                  "Тип",
                  "Дни (раб/кал)",
                  "Загрузка%",
                  "Рейсы",
                  "Пробег",
                  "₽/день",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sorted.map((r) => (
                <tr
                  key={r.vehicle}
                  className="hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-white text-xs whitespace-nowrap">
                    {r.vehicle}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                    {r.vehicle_type}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {r.work_days}/{r.calendar_days}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-medium text-xs whitespace-nowrap ${
                      r.utilization_pct >= 70
                        ? "text-emerald-400"
                        : r.utilization_pct >= 40
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {formatPct(r.utilization_pct)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {r.trips_count}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {formatNum(r.total_km)} км
                  </td>
                  <td className="px-3 py-2.5 text-white text-xs whitespace-nowrap">
                    {formatMoney(r.revenue_per_day)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Маршруты ───────────────────────────────────────────────────────────

function RoutesTab({ month }: { month: string }) {
  const { data, isLoading, error } = useQuery<RouteRow[]>({
    queryKey: ["routes", month],
    queryFn: () => fetchJson(`/api/analytics/routes?month=${month}`),
  });

  const sorted = useMemo(
    () =>
      data
        ? [...data].sort((a, b) => b.total_revenue - a.total_revenue)
        : [],
    [data]
  );

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Ошибка загрузки маршрутов" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Маршрут", "Рейсов", "Выручка", "Ср. ставка"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sorted.map((r, i) => (
                <tr
                  key={i}
                  className="hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-3 py-2.5 text-white text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{r.route}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {r.trips}
                  </td>
                  <td className="px-3 py-2.5 text-white font-medium text-xs whitespace-nowrap">
                    {formatMoney(r.total_revenue)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">
                    {formatMoney(r.avg_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type TabKey = "economics" | "fuel" | "utilization" | "routes" | "profitability" | "mileage";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "economics", label: "Экономика", icon: <TrendingUp className="w-4 h-4" /> },
  { key: "fuel", label: "Топливо", icon: <Fuel className="w-4 h-4" /> },
  { key: "utilization", label: "Загрузка", icon: <Truck className="w-4 h-4" /> },
  { key: "routes", label: "Маршруты", icon: <Route className="w-4 h-4" /> },
  { key: "profitability", label: "Рентабельность", icon: <TrendingUp className="w-4 h-4" /> },
  { key: "mileage", label: "Пробег", icon: <Route className="w-4 h-4" /> },
];

// ─── Tab: Рентабельность рейсов ─────────────────────────────────────────────
function ProfitabilityTab({ month }: { month: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/trips-ext/profitability?month=${month}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [month]);

  if (loading) return <div className="text-center py-8 text-slate-400">Загрузка...</div>;
  if (!data) return <div className="text-center py-8 text-red-400">Ошибка</div>;

  const s = data.summary;
  const fmt = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-700 rounded-lg p-3"><div className="text-slate-400 text-xs">Рейсов</div><div className="text-xl font-bold text-white">{s.total_trips}</div></div>
        <div className="bg-slate-700 rounded-lg p-3"><div className="text-slate-400 text-xs">Ср. маржа</div><div className={`text-xl font-bold ${s.avg_margin_pct >= 20 ? 'text-green-400' : 'text-yellow-400'}`}>{s.avg_margin_pct}%</div></div>
        <div className="bg-slate-700 rounded-lg p-3"><div className="text-slate-400 text-xs">Убыточных</div><div className="text-xl font-bold text-red-400">{s.unprofitable_count} ({s.unprofitable_pct}%)</div></div>
        <div className="bg-slate-700 rounded-lg p-3"><div className="text-slate-400 text-xs">Цена топлива</div><div className="text-xl font-bold text-orange-400">{s.avg_fuel_price} ₽/л</div></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3"><div className="text-slate-400 text-xs">Выручка</div><div className="text-lg font-bold text-green-400">{fmt(s.total_revenue)} ₽</div></div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"><div className="text-slate-400 text-xs">Себестоимость</div><div className="text-lg font-bold text-red-400">{fmt(s.total_costs)} ₽</div></div>
        <div className={`${s.total_margin >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border rounded-lg p-3`}><div className="text-slate-400 text-xs">Маржа</div><div className={`text-lg font-bold ${s.total_margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(s.total_margin)} ₽</div></div>
      </div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-3 border-b border-slate-700 text-sm font-medium text-slate-300">Топ убыточных рейсов</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50"><tr>
              <th className="text-left p-2 text-slate-400">Дата</th>
              <th className="text-left p-2 text-slate-400">Маршрут</th>
              <th className="text-left p-2 text-slate-400">Машина</th>
              <th className="text-right p-2 text-slate-400">Выручка</th>
              <th className="text-right p-2 text-slate-400">Расходы</th>
              <th className="text-right p-2 text-slate-400">Маржа</th>
            </tr></thead>
            <tbody>
              {data.trips.filter((t: any) => !t.profitable).slice(0, 20).map((t: any, i: number) => (
                <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                  <td className="p-2 text-slate-300">{new Date(t.date).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}</td>
                  <td className="p-2 text-white text-xs max-w-[200px] truncate">{t.route}</td>
                  <td className="p-2 text-slate-300">{t.vehicle}</td>
                  <td className="p-2 text-right text-green-400">{fmt(t.revenue)}</td>
                  <td className="p-2 text-right text-red-400">{fmt(t.costs.total)}</td>
                  <td className="p-2 text-right text-red-400 font-semibold">{fmt(t.margin)} ({t.margin_pct}%)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Пробег ────────────────────────────────────────────────────────────
function MileageTab({ month }: { month: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/trips-ext/empty-mileage?month=${month}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [month]);

  if (loading) return <div className="text-center py-8 text-slate-400">Загрузка...</div>;
  if (!data) return <div className="text-center py-8 text-red-400">Ошибка</div>;

  const s = data.summary;
  const fmt = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-700 rounded-lg p-3"><div className="text-slate-400 text-xs">Общий пробег</div><div className="text-xl font-bold text-white">{fmt(s.total_mileage)} км</div></div>
        <div className="bg-slate-700 rounded-lg p-3"><div className="text-slate-400 text-xs">Порожний</div><div className={`text-xl font-bold ${s.empty_pct <= 30 ? 'text-green-400' : 'text-red-400'}`}>{s.empty_pct}%</div></div>
        <div className="bg-slate-700 rounded-lg p-3"><div className="text-slate-400 text-xs">🟢 Норма</div><div className="text-xl font-bold text-green-400">{s.good_count}</div></div>
        <div className="bg-slate-700 rounded-lg p-3"><div className="text-slate-400 text-xs">🔴 Выше нормы</div><div className="text-xl font-bold text-red-400">{s.bad_count}</div></div>
      </div>

      {data.recommendations?.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="text-yellow-400 text-sm font-medium mb-2">💡 Рекомендации</div>
          {data.recommendations.map((r: string, i: number) => (
            <div key={i} className="text-yellow-300/80 text-sm">⚠️ {r}</div>
          ))}
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50"><tr>
              <th className="text-left p-2 text-slate-400">Машина</th>
              <th className="text-right p-2 text-slate-400">Общий, км</th>
              <th className="text-right p-2 text-slate-400">С грузом, км</th>
              <th className="text-right p-2 text-slate-400">Порожний, км</th>
              <th className="text-right p-2 text-slate-400">% пустого</th>
              <th className="text-center p-2 text-slate-400">Статус</th>
            </tr></thead>
            <tbody>
              {data.vehicles.filter((v: any) => v.total_mileage > 0).map((v: any, i: number) => (
                <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                  <td className="p-2 text-white font-medium">{v.vehicle_number}</td>
                  <td className="p-2 text-right text-slate-300">{fmt(v.total_mileage)}</td>
                  <td className="p-2 text-right text-green-400">{fmt(v.loaded_mileage)}</td>
                  <td className="p-2 text-right text-orange-400">{fmt(v.empty_mileage)}</td>
                  <td className="p-2 text-right">
                    <span className={`font-semibold ${v.status === 'good' ? 'text-green-400' : v.status === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {v.empty_pct}%
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    {v.status === 'good' ? '🟢' : v.status === 'warning' ? '🟡' : '🔴'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return getMonthStr(now);
  });
  const [tab, setTab] = useState<TabKey>("economics");

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-xl font-bold text-white">Аналитика</h1>
          <MonthSelector month={month} onChange={setMonth} />
        </div>

        {/* Recommendations */}
        <RecommendationsBlock month={month} />

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((t) => (
            <TabButton
              key={t.key}
              active={tab === t.key}
              label={t.label}
              icon={t.icon}
              onClick={() => setTab(t.key)}
            />
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {tab === "economics" && <EconomicsTab month={month} />}
          {tab === "fuel" && <FuelTab month={month} />}
          {tab === "utilization" && <UtilizationTab month={month} />}
          {tab === "routes" && <RoutesTab month={month} />}
          {tab === "profitability" && <ProfitabilityTab month={month} />}
          {tab === "mileage" && <MileageTab month={month} />}
        </div>
      </div>
    </div>
  );
}
