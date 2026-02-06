"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Calendar, Plus, ChevronUp, ChevronDown, FileText } from "lucide-react";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

interface DriverReport {
  id: string;
  number: string;
  driver_name: string;
  vehicle_number: string;
  date_from: string;
  date_to: string;
  total_expenses: number;
  fuel_amount: number;
  driver_accruals: number;
  mileage: number;
  updated_by?: string;
}

// Расходы = топливо + компенсации (всё кроме зарплаты водителю)
const getTotalExpenses = (r: DriverReport) => (r.fuel_amount || 0) + (r.total_expenses || 0);

function formatMoney(value: number | null): string {
  if (!value) return "0 ₽";
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

type SortField = "number" | "driver_name" | "vehicle_number" | "date_to" | "total_expenses" | "driver_accruals" | "mileage";
type SortDir = "asc" | "desc";

export default function ReportsPage() {
  const router = useRouter();
  const now = new Date();
  const [reports, setReports] = useState<DriverReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [mode, setMode] = useState<"month" | "range">("month");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01";
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + lastDay;
  });
  const [sortField, setSortField] = useState<SortField>("date_to");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const years = [];
  for (let y = 2023; y <= now.getFullYear(); y++) years.push(y);

  useEffect(() => {
    fetchReports();
  }, [selectedYear, selectedMonth, mode, startDate, endDate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let start: string, end: string;
      if (mode === "month") {
        const year = selectedYear;
        const month = selectedMonth + 1;
        start = year + "-" + String(month).padStart(2, "0") + "-01";
        const lastDay = new Date(year, month, 0).getDate();
        end = year + "-" + String(month).padStart(2, "0") + "-" + lastDay;
      } else {
        if (!startDate || !endDate) { setReports([]); setLoading(false); return; }
        start = startDate;
        end = endDate;
      }
      const res = await fetch("/rest/v1/driver_reports?date_to=gte." + start + "&date_to=lte." + end + "&order=date_to.desc&limit=500");
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setMode("range");
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-600 ml-1">⇅</span>;
    return sortDir === "asc" ? <ChevronUp className="w-4 h-4 inline ml-1" /> : <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const filteredReports = reports
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.driver_name?.toLowerCase().includes(q) ||
        r.vehicle_number?.toLowerCase().includes(q) ||
        r.number?.toLowerCase().includes(q) ||
        String(r.total_expenses || "").includes(q) ||
        String(r.driver_accruals || "").includes(q) ||
        String(r.mileage || "").includes(q)
      );
    })
    .sort((a, b) => {
      let av: any = a[sortField];
      let bv: any = b[sortField];
      if (sortField === "date_to" || sortField === "number") {
        av = av || "";
        bv = bv || "";
      } else if (typeof av === "number" || typeof bv === "number") {
        av = av || 0;
        bv = bv || 0;
      } else {
        av = av || "";
        bv = bv || "";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const totalExpenses = filteredReports.reduce((sum, r) => sum + getTotalExpenses(r), 0);
  const totalAccruals = filteredReports.reduce((sum, r) => sum + (r.driver_accruals || 0), 0);
  const totalMileage = filteredReports.reduce((sum, r) => sum + (r.mileage || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            Отчёты водителей
          </h1>
          <p className="text-slate-400 text-sm">Отчёты из 1С за период</p>
        </div>
        <Link href="/reports/new" className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 px-3 py-2 rounded-lg font-medium transition text-sm sm:text-base sm:px-4">
          <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Создать</span> <span className="sm:hidden">Новый</span>
        </Link>
      </div>

      {/* Period Selector */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex bg-slate-900 rounded-lg p-1">
            <button onClick={() => setMode("month")} className={"px-3 py-1.5 rounded text-sm font-medium transition " + (mode === "month" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white")}>
              По месяцу
            </button>
            <button onClick={() => setMode("range")} className={"px-3 py-1.5 rounded text-sm font-medium transition " + (mode === "range" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white")}>
              По датам
            </button>
          </div>
          {mode === "range" && (
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setQuickRange(7)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">7 дней</button>
              <button onClick={() => setQuickRange(30)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">30 дней</button>
              <button onClick={() => setQuickRange(90)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">90 дней</button>
            </div>
          )}
        </div>

        {mode === "month" ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-5 h-5 text-slate-400 hidden sm:block" />
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white flex-1 sm:flex-none min-w-0">
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-5 h-5 text-slate-400 hidden sm:block" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white flex-1 sm:flex-none min-w-0" />
            <span className="text-slate-400">—</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white flex-1 sm:flex-none min-w-0" />
          </div>
        )}

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по водителю, машине, номеру, сумме..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-700/50">
          <div className="text-slate-400 text-xs sm:text-sm">Отчётов</div>
          <div className="text-xl sm:text-2xl font-bold text-white">{filteredReports.length}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-700/50">
          <div className="text-slate-400 text-xs sm:text-sm">Расходы</div>
          <div className="text-base sm:text-xl font-bold text-red-400">{formatMoney(totalExpenses)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-700/50">
          <div className="text-slate-400 text-xs sm:text-sm">Начисления</div>
          <div className="text-base sm:text-xl font-bold text-green-400">{formatMoney(totalAccruals)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-700/50">
          <div className="text-slate-400 text-xs sm:text-sm">Пробег</div>
          <div className="text-base sm:text-xl font-bold text-cyan-400">{totalMileage.toLocaleString("ru-RU")} км</div>
        </div>
      </div>

      {/* Table - Desktop */}
      <div className="hidden md:block bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("number")}>
                  НОМЕР <SortIcon field="number" />
                </th>
                <th className="text-left p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("driver_name")}>
                  ВОДИТЕЛЬ <SortIcon field="driver_name" />
                </th>
                <th className="text-left p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("vehicle_number")}>
                  МАШИНА <SortIcon field="vehicle_number" />
                </th>
                <th className="text-left p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("date_to")}>
                  ПЕРИОД <SortIcon field="date_to" />
                </th>
                <th className="text-right p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("total_expenses")}>
                  РАСХОДЫ <SortIcon field="total_expenses" />
                </th>
                <th className="text-right p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("driver_accruals")}>
                  НАЧИСЛЕНИЯ <SortIcon field="driver_accruals" />
                </th>
                <th className="text-right p-3 cursor-pointer hover:bg-slate-700/50" onClick={() => handleSort("mileage")}>
                  ПРОБЕГ <SortIcon field="mileage" />
                <th className="text-left p-3">АВТОР</th>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Загрузка...</td></tr>
              ) : filteredReports.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Нет отчётов за выбранный период</td></tr>
              ) : (
                filteredReports.map(r => (
                  <tr 
                    key={r.id} 
                    onClick={() => router.push("/reports/" + r.id)}
                    className="border-t border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition"
                  >
                    <td className="p-3 text-cyan-400 font-mono">{r.number}</td>
                    <td className="p-3 text-white">{r.driver_name || "—"}</td>
                    <td className="p-3 text-slate-300">{r.vehicle_number}</td>
                    <td className="p-3 text-slate-400">{formatDate(r.date_from)} — {formatDate(r.date_to)}</td>
                    <td className="p-3 text-right text-red-400">{formatMoney(getTotalExpenses(r))}</td>
                    <td className="p-3 text-right text-green-400">{formatMoney(r.driver_accruals)}</td>
                    <td className="p-3 text-right text-cyan-400">{r.mileage ? r.mileage.toLocaleString("ru-RU") + " км" : "0 км"}</td>
                    <td className="p-3 text-slate-500 text-xs">{r.updated_by || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Загрузка...</div>
        ) : filteredReports.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Нет отчётов за выбранный период</div>
        ) : (
          filteredReports.map(r => (
            <div
              key={r.id}
              onClick={() => router.push("/reports/" + r.id)}
              className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 cursor-pointer active:bg-slate-700/30 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-cyan-400 font-mono text-sm">{r.number}</span>
                <span className="text-slate-400 text-xs">{formatDate(r.date_from)} — {formatDate(r.date_to)}</span>
              </div>
              <div className="text-white font-medium mb-1">{r.driver_name || "—"}</div>
              <div className="text-slate-400 text-sm mb-3">{r.vehicle_number}</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-slate-500">Расходы</div>
                  <div className="text-red-400 text-sm font-medium">{formatMoney(getTotalExpenses(r))}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Начисления</div>
                  <div className="text-green-400 text-sm font-medium">{formatMoney(r.driver_accruals)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Пробег</div>
                  <div className="text-cyan-400 text-sm font-medium">{r.mileage ? r.mileage.toLocaleString("ru-RU") : "0"} км</div>
                </div>
              </div>
              {r.updated_by && <div className="text-slate-600 text-xs mt-2 text-right">{r.updated_by}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
