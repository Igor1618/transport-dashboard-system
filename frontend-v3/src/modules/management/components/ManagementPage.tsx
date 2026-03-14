"use client";

import { pVehicle, pDriver } from "@/shared/utils/pluralize";

import React, { useState, useMemo, useCallback, Fragment } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  Truck,
  User,
  Users,
  CalendarDays,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Palmtree,
  Thermometer,
  Moon,
  Briefcase,
  UserMinus,
  TrendingUp,
  Hash,
  Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BoardItem {
  vehicle_id: number;
  vehicle: string;
  vehicle_type: string;
  vehicle_status: string;
  driver: string | null;
  driver_status: "active" | "vacation" | "no_driver";
  assignment_id: number | null;
  vacation: string | null;
}

interface BoardData {
  board: BoardItem[];
  freeDrivers: string[];
  totalVehicles: number;
  totalDrivers: number;
}

interface Vacation {
  id: number;
  driver_name: string;
  date_from: string;
  date_to: string;
  vacation_type: string;
  status: string;
  replacement_driver: string | null;
}

interface DashboardData {
  totalDrivers: number;
  activeVehicles: number;
  ratio: string;
  needToHire: number;
  turnover: number;
  upcomingVacations: {
    driver_name: string;
    date_from: string;
    date_to: string;
    vacation_type: string;
  }[];
  vehiclesWithoutDriver: {
    vehicle: string;
    vehicle_type: string;
  }[];
}

interface DriverInfo {
  driver_name: string;
  last_report: string | null;
  total_reports: number;
  current_vehicle: string | null;
  assignment_status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = "/api/hr";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const VACATION_TYPES = [
  { value: "vacation", label: "Отпуск" },
  { value: "sick", label: "Больничный" },
  { value: "day_off", label: "Выходной" },
  { value: "unpaid", label: "За свой счёт" },
];

const VACATION_TYPE_LABELS: Record<string, string> = {
  vacation: "Отпуск",
  sick: "Больничный",
  day_off: "Выходной",
  unpaid: "За свой счёт",
};

// ─── Shared UI ───────────────────────────────────────────────────────────────

function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} size={20} />;
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "green" | "red" | "yellow" | "blue" | "gray" | "orange";
}) {
  const map: Record<string, string> = {
    green: "bg-emerald-600/20 text-emerald-400 border-emerald-500/30",
    red: "bg-red-600/20 text-red-400 border-red-500/30",
    yellow: "bg-yellow-600/20 text-yellow-400 border-yellow-500/30",
    blue: "bg-blue-600/20 text-blue-400 border-blue-500/30",
    gray: "bg-slate-600/20 text-slate-400 border-slate-500/30",
    orange: "bg-orange-600/20 text-orange-400 border-orange-500/30",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[color]}`}
    >
      {children}
    </span>
  );
}

// ─── Tab 1: Доска (Board) ────────────────────────────────────────────────────

function BoardTab() {
  const queryClient = useQueryClient();
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<BoardData>({
    queryKey: ["board"],
    queryFn: () => apiFetch<BoardData>(`${API_BASE}/board`),
    refetchInterval: 30000,
  });

  const assignMut = useMutation({
    mutationFn: (body: { driver_name: string; vehicle_number: string }) =>
      apiFetch(`${API_BASE}/assign`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board"] });
      setSelectedCard(null);
    },
  });

  const unassignMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`${API_BASE}/unassign/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Spinner className="mr-2" /> Загрузка доски…
      </div>
    );
  if (error)
    return (
      <div className="text-red-400 py-10 text-center">
        Ошибка загрузки: {(error as Error).message}
      </div>
    );
  if (!data) return null;

  const withoutDriver = data.board.filter(
    (b) => b.driver_status === "no_driver"
  ).length;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main grid */}
      <div className="flex-1">
        {/* Summary bar */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-4 py-2">
            <Truck size={16} className="text-blue-400" />
            <span className="text-sm text-slate-300">
              {pVehicle(data.totalVehicles)}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-4 py-2">
            <Users size={16} className="text-emerald-400" />
            <span className="text-sm text-slate-300">
              {pDriver(data.totalDrivers)}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-4 py-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-sm text-slate-300">
              {withoutDriver} без водителя
            </span>
          </div>
        </div>

        {/* Vehicle cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.board.map((item) => {
            const borderColor =
              item.driver_status === "active"
                ? "border-emerald-500"
                : item.driver_status === "vacation"
                ? "border-yellow-500"
                : "border-red-500";

            const isSelected = selectedCard === item.vehicle_id;

            return (
              <div
                key={item.vehicle_id}
                className={`relative bg-slate-800 rounded-xl border-2 ${borderColor} p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-slate-900/50 ${
                  isSelected ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() =>
                  setSelectedCard(isSelected ? null : item.vehicle_id)
                }
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-white font-bold text-base">
                      {item.vehicle}
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {item.vehicle_type}
                    </p>
                  </div>
                  {item.driver_status === "active" && (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  )}
                  {item.driver_status === "vacation" && (
                    <Palmtree size={18} className="text-yellow-400" />
                  )}
                  {item.driver_status === "no_driver" && (
                    <UserMinus size={18} className="text-red-400" />
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <User size={14} className="text-slate-500" />
                  {item.driver ? (
                    <span className="text-slate-200 text-sm">{item.driver}</span>
                  ) : (
                    <span className="text-red-400 text-sm italic">
                      Нет водителя
                    </span>
                  )}
                </div>

                {item.vacation && (
                  <div className="mt-2 text-xs text-yellow-400/80">
                    🏖 {item.vacation}
                  </div>
                )}

                {/* Unassign button */}
                {item.assignment_id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Снять водителя с машины?"))
                        unassignMut.mutate(item.assignment_id!);
                    }}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                    title="Снять назначение"
                  >
                    <X size={14} />
                  </button>
                )}

                {/* Assign dropdown */}
                {isSelected && item.driver_status === "no_driver" && (
                  <div
                    className="mt-3 bg-slate-700 rounded-lg p-2 border border-slate-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs text-slate-400 mb-2">
                      Назначить водителя:
                    </p>
                    {data.freeDrivers.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">
                        Нет свободных водителей
                      </p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {data.freeDrivers.map((driver) => (
                          <button
                            key={driver}
                            onClick={() =>
                              assignMut.mutate({
                                driver_name: driver,
                                vehicle_number: item.vehicle,
                              })
                            }
                            disabled={assignMut.isPending}
                            className="w-full text-left px-3 py-1.5 rounded text-sm text-slate-200 hover:bg-slate-600 transition-colors disabled:opacity-50"
                          >
                            {driver}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isSelected &&
                  item.driver_status !== "no_driver" &&
                  data.freeDrivers.length > 0 && (
                    <div
                      className="mt-3 bg-slate-700 rounded-lg p-2 border border-slate-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-xs text-slate-400 mb-2">
                        Заменить водителя:
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {data.freeDrivers.map((driver) => (
                          <button
                            key={driver}
                            onClick={() =>
                              assignMut.mutate({
                                driver_name: driver,
                                vehicle_number: item.vehicle,
                              })
                            }
                            disabled={assignMut.isPending}
                            className="w-full text-left px-3 py-1.5 rounded text-sm text-slate-200 hover:bg-slate-600 transition-colors disabled:opacity-50"
                          >
                            {driver}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: free drivers */}
      <div className="lg:w-72 shrink-0">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 sticky top-4">
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <Users size={16} className="text-emerald-400" />
            Свободные водители
            <span className="ml-auto bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
              {data.freeDrivers.length}
            </span>
          </h3>
          {data.freeDrivers.length === 0 ? (
            <p className="text-slate-500 text-sm italic">
              Все водители назначены
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.freeDrivers.map((d) => (
                <li
                  key={d}
                  className="flex items-center gap-2 text-sm text-slate-300 bg-slate-700/50 rounded-lg px-3 py-2"
                >
                  <User size={14} className="text-slate-500" />
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Календарь (Calendar) ────────────────────────────────────────────

function CalendarTab() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [modal, setModal] = useState<{
    driver: string;
    day: number;
  } | null>(null);
  const [formDateFrom, setFormDateFrom] = useState("");
  const [formDateTo, setFormDateTo] = useState("");
  const [formType, setFormType] = useState("vacation");
  const [formComment, setFormComment] = useState("");

  const { data: drivers, isLoading: driversLoading } = useQuery<DriverInfo[]>({
    queryKey: ["drivers"],
    queryFn: () => apiFetch<DriverInfo[]>(`${API_BASE}/drivers`),
  });

  const { data: vacations, isLoading: vacationsLoading } = useQuery<
    Vacation[]
  >({
    queryKey: ["vacations", year, month],
    queryFn: () =>
      apiFetch<Vacation[]>(`${API_BASE}/vacations?year=${year}&month=${month}`),
  });

  const createVacation = useMutation({
    mutationFn: (body: {
      driver_name: string;
      date_from: string;
      date_to: string;
      vacation_type: string;
      comment: string;
    }) =>
      apiFetch(`${API_BASE}/vacations`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacations"] });
      setModal(null);
      setFormComment("");
    },
  });

  const deleteVacation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`${API_BASE}/vacations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacations"] });
    },
  });

  const totalDays = daysInMonth(year, month);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  // Build a map: driverName → day → vacation info
  const vacationMap = useMemo(() => {
    const m: Record<string, Record<number, Vacation>> = {};
    if (!vacations) return m;
    for (const v of vacations) {
      if (!m[v.driver_name]) m[v.driver_name] = {};
      const from = new Date(v.date_from);
      const to = new Date(v.date_to);
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year && d.getMonth() + 1 === month) {
          m[v.driver_name][d.getDate()] = v;
        }
      }
    }
    return m;
  }, [vacations, year, month]);

  const getCellColor = (
    driver: string,
    day: number
  ): { bg: string; type: string } => {
    const vac = vacationMap[driver]?.[day];
    if (vac) {
      switch (vac.vacation_type) {
        case "vacation":
          return { bg: "bg-blue-600/60", type: "vacation" };
        case "sick":
          return { bg: "bg-orange-600/60", type: "sick" };
        case "day_off":
          return { bg: "bg-slate-600/60", type: "day_off" };
        default:
          return { bg: "bg-blue-600/40", type: vac.vacation_type };
      }
    }
    // Weekend check
    const dow = getDayOfWeek(year, month, day);
    if (dow === 0 || dow === 6) {
      return { bg: "bg-slate-700/40", type: "weekend" };
    }
    return { bg: "bg-emerald-600/20", type: "working" };
  };

  const openModal = (driver: string, day: number) => {
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    setFormDateFrom(dateStr);
    setFormDateTo(dateStr);
    setFormType("vacation");
    setFormComment("");
    setModal({ driver, day });
  };

  const handleSubmit = () => {
    if (!modal) return;
    createVacation.mutate({
      driver_name: modal.driver,
      date_from: formDateFrom,
      date_to: formDateTo,
      vacation_type: formType,
      comment: formComment,
    });
  };

  const isLoading = driversLoading || vacationsLoading;

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Spinner className="mr-2" /> Загрузка календаря…
      </div>
    );

  const driverList = drivers || [];

  return (
    <div>
      {/* Month selector */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-white font-semibold text-lg min-w-[200px] text-center">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-800">
              <th className="sticky left-0 z-10 bg-slate-800 px-3 py-2 text-left text-xs text-slate-400 font-medium border-b border-slate-700 min-w-[160px]">
                Водитель
              </th>
              {Array.from({ length: totalDays }, (_, i) => {
                const day = i + 1;
                const dow = getDayOfWeek(year, month, day);
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <th
                    key={day}
                    className={`px-1 py-2 text-center text-xs font-medium border-b border-slate-700 min-w-[32px] ${
                      isWeekend ? "text-red-400/70" : "text-slate-400"
                    }`}
                  >
                    {day}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {driverList.map((driver) => (
              <tr
                key={driver.driver_name}
                className="hover:bg-slate-800/50 transition-colors"
              >
                <td className="sticky left-0 z-10 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 border-b border-slate-800 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-slate-500" />
                    {driver.driver_name}
                  </div>
                </td>
                {Array.from({ length: totalDays }, (_, i) => {
                  const day = i + 1;
                  const { bg, type } = getCellColor(driver.driver_name, day);
                  const vac = vacationMap[driver.driver_name]?.[day];

                  return (
                    <td
                      key={day}
                      className={`px-0 py-0 border-b border-slate-800 cursor-pointer`}
                      onClick={() => {
                        if (vac) {
                          if (confirm(`Удалить ${VACATION_TYPE_LABELS[vac.vacation_type] || vac.vacation_type} для ${driver.driver_name}?`)) {
                            deleteVacation.mutate(vac.id);
                          }
                        } else {
                          openModal(driver.driver_name, day);
                        }
                      }}
                      title={
                        vac
                          ? `${VACATION_TYPE_LABELS[vac.vacation_type] || vac.vacation_type}: ${formatDate(vac.date_from)} — ${formatDate(vac.date_to)}`
                          : type === "weekend"
                          ? "Выходной"
                          : "Рабочий день"
                      }
                    >
                      <div
                        className={`w-full h-8 ${bg} hover:opacity-80 transition-opacity flex items-center justify-center`}
                      >
                        {vac && (
                          <span className="text-[10px]">
                            {vac.vacation_type === "vacation"
                              ? "🏖"
                              : vac.vacation_type === "sick"
                              ? "🤒"
                              : vac.vacation_type === "day_off"
                              ? "😴"
                              : "📋"}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-600/30 border border-emerald-600/50" />
          Рабочий день
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-600/60 border border-blue-600/50" />
          Отпуск
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-600/60 border border-orange-600/50" />
          Больничный
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-slate-600/60 border border-slate-600/50" />
          Выходной
        </div>
      </div>

      {/* Create vacation modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold text-lg">
                Новая запись
              </h3>
              <button
                onClick={() => setModal(null)}
                className="p-1 rounded hover:bg-slate-700 text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Водитель
                </label>
                <div className="bg-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                  {modal.driver}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    С
                  </label>
                  <input
                    type="date"
                    value={formDateFrom}
                    onChange={(e) => setFormDateFrom(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    По
                  </label>
                  <input
                    type="date"
                    value={formDateTo}
                    onChange={(e) => setFormDateTo(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Тип
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {VACATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Комментарий
                </label>
                <textarea
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Необязательно"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal(null)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={createVacation.isPending}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createVacation.isPending && <Spinner />}
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Кадры (HR Dashboard) ────────────────────────────────────────────

function HRTab() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardData>(`${API_BASE}/dashboard`),
    refetchInterval: 60000,
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Spinner className="mr-2" /> Загрузка дашборда…
      </div>
    );
  if (error)
    return (
      <div className="text-red-400 py-10 text-center">
        Ошибка: {(error as Error).message}
      </div>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
            <Users size={14} />
            Водителей в штате
          </div>
          <div className="text-3xl font-bold text-white">
            {data.totalDrivers}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
            <Truck size={14} />
            Машин активных
          </div>
          <div className="text-3xl font-bold text-white">
            {data.activeVehicles}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
            <Hash size={14} />
            Коэффициент
          </div>
          <div className="text-3xl font-bold text-white">{data.ratio}</div>
          <div className="text-xs text-slate-500 mt-1">водителей / машин</div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
            <Plus size={14} />
            Нужно нанять
          </div>
          <div
            className={`text-3xl font-bold ${
              data.needToHire > 0 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {data.needToHire}
          </div>
        </div>
      </div>

      {/* Turnover */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={16} className="text-blue-400" />
          <span className="text-slate-300 text-sm font-medium">
            Текучесть кадров
          </span>
        </div>
        <div className="text-2xl font-bold text-white">{data.turnover}%</div>
      </div>

      {/* Upcoming vacations */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
          <CalendarDays size={16} className="text-blue-400" />
          <h3 className="text-white font-semibold text-sm">
            Предстоящие отпуска (14 дней)
          </h3>
          <span className="ml-auto bg-blue-600/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">
            {data.upcomingVacations.length}
          </span>
        </div>
        {data.upcomingVacations.length === 0 ? (
          <div className="px-5 py-6 text-center text-slate-500 text-sm">
            Нет предстоящих отпусков
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-750">
                  <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">
                    Водитель
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">
                    С
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">
                    По
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">
                    Тип
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingVacations.map((v, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-700/50 hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-2.5 text-sm text-slate-200">
                      {v.driver_name}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-300">
                      {formatDate(v.date_from)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-300">
                      {formatDate(v.date_to)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        color={
                          v.vacation_type === "vacation"
                            ? "blue"
                            : v.vacation_type === "sick"
                            ? "orange"
                            : "gray"
                        }
                      >
                        {VACATION_TYPE_LABELS[v.vacation_type] ||
                          v.vacation_type}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vehicles without driver */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <h3 className="text-white font-semibold text-sm">
            Машины без водителя
          </h3>
          <span className="ml-auto bg-red-600/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
            {data.vehiclesWithoutDriver.length}
          </span>
        </div>
        {data.vehiclesWithoutDriver.length === 0 ? (
          <div className="px-5 py-6 text-center text-slate-500 text-sm">
            Все машины укомплектованы 🎉
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">
                    Номер
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs text-slate-400 font-medium">
                    Тип
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.vehiclesWithoutDriver.map((v, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-700/50 hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-2.5 text-sm text-slate-200 font-medium">
                      {v.vehicle}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-400">
                      {v.vehicle_type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type TabKey = "board" | "calendar" | "hr";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "board",
    label: "Доска",
    icon: <LayoutDashboard size={16} />,
  },
  {
    key: "calendar",
    label: "Календарь",
    icon: <CalendarDays size={16} />,
  },
  {
    key: "hr",
    label: "Кадры",
    icon: <Briefcase size={16} />,
  },
];

function ManagementPageInner() {
  const [activeTab, setActiveTab] = useState<TabKey>("board");

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Truck size={22} className="text-blue-400" />
            Управление
          </h1>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "board" && <BoardTab />}
        {activeTab === "calendar" && <CalendarTab />}
        {activeTab === "hr" && <HRTab />}
      </main>
    </div>
  );
}

// ─── Provider wrapper ────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

export default function ManagementPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <ManagementPageInner />
    </QueryClientProvider>
  );
}
