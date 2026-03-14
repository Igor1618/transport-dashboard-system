"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { TrendingUp, TrendingDown, Fuel, Wallet, Truck, FileText, CreditCard, BarChart3 } from "lucide-react";

type KpiData = { value: number; change: number };
type MonthData = { month: string; revenue_rf: number; revenue_wb: number; revenue: number; fuel: number; salary: number; expenses: number; profit: number; margin: number };
type VehicleData = { vn: string; revenue: number; revenue_rf: number; revenue_wb: number; fuel: number; salary: number; margin: number };
type SummaryData = { active_vehicles: number; unlinked_cards: number; reports_this_month: number; dispatched_vehicles: number };
type Alert = { severity: string; icon: string; text: string; link?: string; count?: number };

const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
const fmtM = (n: number) => {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "М";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + "К";
  return fmt(n);
};
const monthName = (m: string) => {
  const [y, mo] = m.split("-");
  const names = ["", "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return `${names[+mo]} ${y.slice(2)}`;
};

function KpiCard({ label, value, change, icon, color, prefix = "", suffix = "" }: { label: string; value: string; change: number; icon: React.ReactNode; color: string; prefix?: string; suffix?: string }) {
  return (
    <div className={`bg-slate-800 rounded-xl p-4 border ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-xs sm:text-sm">{label}</span>
        <div className={`p-2 rounded-lg bg-slate-700/50`}>{icon}</div>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-white">{prefix}{value}{suffix}</div>
      <div className={`text-xs mt-1 flex items-center gap-1 ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
        {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {change >= 0 ? "+" : ""}{change}% к прошл. мес.
      </div>
    </div>
  );
}

function BarChart({ data, selectedMonth, onSelect }: { data: MonthData[]; selectedMonth: string; onSelect: (m: string) => void }) {
  const max = Math.max(...data.map(d => Math.max(d.revenue, d.expenses)), 1);
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-400" /> P&L по месяцам</h2>
      <div className="flex items-end gap-1 h-48 overflow-x-auto">
        {data.map(d => {
          const rH = (d.revenue / max) * 100;
          const eH = (d.expenses / max) * 100;
          const selected = d.month === selectedMonth;
          return (
            <div key={d.month} className={`flex-1 min-w-[40px] flex flex-col items-center cursor-pointer group ${selected ? "opacity-100" : "opacity-70 hover:opacity-100"}`} onClick={() => onSelect(d.month)}>
              <div className="text-[10px] text-slate-500 mb-1">{d.margin}%</div>
              <div className="flex items-end gap-px w-full justify-center" style={{ height: "140px" }}>
                <div className="w-[45%] rounded-t transition-all bg-gradient-to-t from-blue-600 to-blue-400" style={{ height: `${rH}%` }} title={`Доходы: ${fmt(d.revenue)}`} />
                <div className="w-[45%] rounded-t transition-all bg-gradient-to-t from-red-600 to-red-400" style={{ height: `${eH}%` }} title={`Расходы: ${fmt(d.expenses)}`} />
              </div>
              <div className={`text-[10px] mt-1 ${selected ? "text-blue-400 font-bold" : "text-slate-500"}`}>{monthName(d.month)}</div>
              {selected && <div className="w-1 h-1 rounded-full bg-blue-400 mt-0.5" />}
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 justify-center text-xs text-slate-400">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500" /> Доходы</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500" /> Расходы</div>
      </div>
    </div>
  );
}

function TopVehicles({ vehicles }: { vehicles: VehicleData[] }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><Truck className="w-5 h-5 text-purple-400" /> Топ-10 машин по марже</h2>
      <div className="space-y-1">
        {vehicles.slice(0, 10).map((v, i) => {
          const maxMargin = Math.max(...vehicles.slice(0, 10).map(x => Math.abs(+x.margin)), 1);
          const w = (Math.abs(+v.margin) / maxMargin) * 100;
          const negative = +v.margin < 0;
          return (
            <div key={v.vn} className="flex items-center gap-2 text-sm group">
              <span className="text-slate-500 w-5 text-right text-xs">{i + 1}</span>
              <span className="text-white font-mono w-24 text-xs">{v.vn}</span>
              <div className="flex-1 h-5 bg-slate-700/50 rounded overflow-hidden relative">
                <div className={`h-full rounded transition-all ${negative ? "bg-red-500/70" : "bg-green-500/70"}`} style={{ width: `${w}%` }} />
                <span className={`absolute right-2 top-0 text-xs leading-5 ${negative ? "text-red-300" : "text-green-300"}`}>
                  {fmtM(+v.margin)} ₽
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<Record<string, KpiData>>({});
  const [pnl, setPnl] = useState<MonthData[]>([]);
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const { effectiveRole } = useAuth();
  const FINANCIAL_ROLES = ["admin", "superadmin", "director", "accountant", "chief_logist"];
  const showFinancials = FINANCIAL_ROLES.includes(effectiveRole || "");

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard-api/kpi").then(r => r.json()),
      fetch("/api/dashboard-api/pnl-chart").then(r => r.json()),
      fetch("/api/dashboard-api/summary").then(r => r.json()),
      fetch("/api/dashboard-api/alerts").then(r => r.json()),
    ]).then(([kpiData, pnlData, sumData, alertData]) => {
      setKpi(kpiData.kpi || {});
      setPnl(pnlData.months || []);
      setSummary(sumData);
      setAlerts(alertData.alerts || []);
      setSelectedMonth(kpiData.period || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    fetch(`/api/dashboard-api/top-vehicles?month=${selectedMonth}`).then(r => r.json()).then(d => setVehicles(d.vehicles || []));
  }, [selectedMonth]);

  const selData = useMemo(() => pnl.find(d => d.month === selectedMonth), [pnl, selectedMonth]);

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold mb-2">📊 Дашборд</h1>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {showFinancials && <KpiCard label="Выручка" value={fmtM(kpi.revenue?.value || 0) + " ₽"} change={kpi.revenue?.change || 0} icon={<TrendingUp className="w-5 h-5 text-blue-400" />} color="border-blue-500/30" />}
        {showFinancials && <KpiCard label="Прибыль" value={fmtM(kpi.profit?.value || 0) + " ₽"} change={kpi.profit?.change || 0} icon={<Wallet className="w-5 h-5 text-green-400" />} color="border-green-500/30" />}
        <KpiCard label="Утилизация" value={(kpi.utilization?.value || 0) + "%"} change={kpi.utilization?.change || 0} icon={<Truck className="w-5 h-5 text-purple-400" />} color="border-purple-500/30" />
        <KpiCard label="₽/км" value={fmt(kpi.revenue_per_km?.value || 0)} change={kpi.revenue_per_km?.change || 0} icon={<BarChart3 className="w-5 h-5 text-orange-400" />} color="border-orange-500/30" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-yellow-500/30">
          <h2 className="text-sm font-semibold text-yellow-400 mb-2">⚠️ Требует внимания</h2>
          <div className="space-y-1">
            {alerts.map((a, i) => (
              <a key={i} href={a.link || "#"} className="flex items-center gap-2 text-sm hover:bg-slate-700/50 rounded px-2 py-1 transition-colors">
                <span>{a.icon}</span>
                <span className="text-slate-300">{a.text}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* P&L chart + selected month detail */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <BarChart data={pnl} selectedMonth={selectedMonth} onSelect={setSelectedMonth} />
        </div>
        {selData && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-3">{monthName(selectedMonth)}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Выручка РФ</span><span className="text-blue-400 font-bold">{fmtM(selData.revenue_rf)} ₽</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Выручка WB</span><span className="text-purple-400 font-bold">{fmtM(selData.revenue_wb)} ₽</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-2"><span className="text-slate-400">Итого выручка</span><span className="text-white font-bold">{fmtM(selData.revenue)} ₽</span></div>
              <div className="flex justify-between"><span className="text-slate-400">🛢 Топливо</span><span className="text-red-400">-{fmtM(selData.fuel)} ₽</span></div>
              <div className="flex justify-between"><span className="text-slate-400">👷 Зарплата</span><span className="text-red-400">-{fmtM(selData.salary)} ₽</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-2"><span className="text-slate-400">Расходы</span><span className="text-red-400 font-bold">-{fmtM(selData.expenses)} ₽</span></div>
              <div className={`flex justify-between border-t border-slate-700 pt-2 text-lg ${selData.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                <span className="font-bold">Маржа</span><span className="font-bold">{fmtM(selData.profit)} ₽ ({selData.margin}%)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top vehicles */}
      <TopVehicles vehicles={vehicles} />

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
            <div className="text-2xl font-bold text-white">{summary.active_vehicles}</div>
            <div className="text-xs text-slate-400">Машин активно</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
            <div className="text-2xl font-bold text-white">{summary.dispatched_vehicles}</div>
            <div className="text-xs text-slate-400">На линии (мес.)</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
            <div className="text-2xl font-bold text-white">{summary.reports_this_month}</div>
            <div className="text-xs text-slate-400">Отчётов за месяц</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
            <div className={`text-2xl font-bold ${summary.unlinked_cards > 0 ? "text-yellow-400" : "text-green-400"}`}>{summary.unlinked_cards}</div>
            <div className="text-xs text-slate-400">Непривяз. карт</div>
          </div>
        </div>
      )}
    </div>
  );
}
