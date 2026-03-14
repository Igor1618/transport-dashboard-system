'use client';

import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Fuel, Users, Wrench, Building2, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, ChevronLeft, ChevronRight, RefreshCw, ChevronDown } from 'lucide-react';
import ExcelExport from '@/components/ExcelExport';

interface PnlData {
  period: { from: string; to: string; label: string };
  revenue: {
    contracts_1c: { total: number; count: number };
    wb: { total: number; count: number };
    distributed: { total: number; count: number };
    total: number;
  };
  expenses: {
    salary: { total: number; count: number; percent: string };
    fuel: { total: number; count: number; percent: string };
    leasing: { total: number; count: number; percent: string };
    repair: { total: number; count: number; percent: string };
    other: { total: number; count: number; percent: string };
    total: number;
  };
  profit: { net: number; margin: number };
  warnings: {
    undistributed_registries: { total: number; count: number };
    no_leasing_data: boolean;
    no_repair_data: boolean;
  };
}

interface TrendItem {
  period: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  fuel: number;
  salary: number;
}

const formatMoney = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₽`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}К ₽`;
  return `${n.toLocaleString('ru-RU')} ₽`;
};

const formatMoneyFull = (n: number) => 
  Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

function PnlRow({ label, amount, percent, icon: Icon, color, warning }: {
  label: string; amount: number; percent?: string; icon?: any; color: string; warning?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-slate-700/30 transition-colors">
      <div className="flex items-center gap-3">
        {Icon && <Icon className={`w-4 h-4 ${color}`} />}
        <span className="text-slate-300">{label}</span>
        {warning && (
          <span className="text-xs text-yellow-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {warning}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {percent && <span className="text-slate-500 text-sm">{percent}%</span>}
        <span className={`font-semibold tabular-nums ${color}`}>{formatMoneyFull(amount)}</span>
      </div>

      
    </div>
  );
}

function TrendBar({ data, maxRevenue }: { data: TrendItem; maxRevenue: number }) {
  const revenueWidth = maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0;
  const expenseWidth = maxRevenue > 0 ? (data.expenses / maxRevenue) * 100 : 0;
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-xs w-14 text-right">{data.label}</span>
      <div className="flex-1 space-y-1">
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${revenueWidth}%` }} />
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-red-500/70 rounded-full" style={{ width: `${expenseWidth}%` }} />
        </div>
      </div>
      <div className="text-right w-20">
        <div className={`text-xs font-semibold ${data.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatMoney(data.profit)}
        </div>
        <div className="text-xs text-slate-500">{data.margin}%</div>
      </div>

      
    </div>
  );
}


// ==================== Vehicle Detail Accordion ====================
function VehicleDetailRow({ plate, period }: { plate: string; period: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/pnl/vehicle/' + encodeURIComponent(plate) + '?period=' + encodeURIComponent(period))
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [plate, period]);

  if (loading) return (
    <tr><td colSpan={7} className="p-6 text-center text-slate-500">
      <RefreshCw size={20} className="animate-spin inline mr-2" /> Загрузка детализации...
    </td></tr>
  );
  if (error) return (
    <tr><td colSpan={7} className="p-4 text-center text-red-400">❌ {error}</td></tr>
  );
  if (!data) return null;

  const d = data;
  const fmtN = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  const fmtD = (s: string) => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit' }) : '—';
  const pctChange = (cur: number, prev: number) => {
    if (!prev) return '';
    const pct = ((cur - prev) / prev * 100).toFixed(0);
    const sign = cur >= prev ? '+' : '';
    const color = cur >= prev ? 'text-green-400' : 'text-red-400';
    return `<span class="${color}">${sign}${pct}%</span>`;
  };

  return (
    <tr>
      <td colSpan={7} className="p-0">
        <div className="bg-slate-900/50 border-t border-b border-slate-600 p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-white text-base">{d.vehicle.plate}</span>
              <span className="text-slate-400 ml-2">{d.vehicle.model} • {d.vehicle.tonnage}т</span>
              {d.driver.name && <span className="text-slate-500 ml-2">• {d.driver.name}</span>}
            </div>
            <span className="text-xs text-slate-500">{d.period}</span>
          </div>

          {/* Income breakdown */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <h4 className="text-sm font-bold text-green-400 mb-2">📈 ДОХОДЫ {fmtN(d.income.total)} ₽</h4>

            {d.income.wb.count > 0 && (
              <details className="mb-2">
                <summary className="text-sm text-slate-300 cursor-pointer hover:text-white">
                  WB рейсы ({d.income.wb.count}): <span className="font-bold">{fmtN(d.income.wb.total)} ₽</span>
                  {d.income.wb.avg_per_km > 0 && <span className="text-xs text-slate-500 ml-2">ср. {d.income.wb.avg_per_km} ₽/км</span>}
                </summary>
                <div className="mt-1 ml-4 space-y-0.5 max-h-48 overflow-y-auto">
                  {d.income.wb.trips.map((t: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs text-slate-400">
                      <span>{fmtD(t.date)} {t.route}</span>
                      <span className="whitespace-nowrap ml-2">{t.km > 0 ? fmtN(t.km) + ' км' : ''} <span className="text-white">{fmtN(t.amount)} ₽</span></span>
                    </div>
                  ))}
                  <div className="text-xs text-slate-500 pt-1 border-t border-slate-700">
                    Итого WB: {d.income.wb.count} рейсов, {fmtN(d.income.wb.km)} км
                  </div>
                </div>
              </details>
            )}

            {d.income.rf.count > 0 && (
              <details className="mb-2">
                <summary className="text-sm text-slate-300 cursor-pointer hover:text-white">
                  РФ заявки ({d.income.rf.count}): <span className="font-bold">{fmtN(d.income.rf.total)} ₽</span>
                </summary>
                <div className="mt-1 ml-4 space-y-0.5 max-h-48 overflow-y-auto">
                  {d.income.rf.trips.map((t: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs text-slate-400">
                      <span>{fmtD(t.date)} {t.route}</span>
                      <span className="text-white ml-2">{fmtN(t.amount)} ₽</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {d.income.distributed > 0 && (
              <div className="text-sm text-slate-400">
                Реестры (распределённые): <span className="font-bold text-white">{fmtN(d.income.distributed)} ₽</span>
              </div>
            )}
          </div>

          {/* Expenses breakdown */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <h4 className="text-sm font-bold text-red-400 mb-2">📉 РАСХОДЫ {fmtN(d.expenses.total)} ₽</h4>

            {/* Fuel */}
            <details className="mb-2">
              <summary className="text-sm text-slate-300 cursor-pointer hover:text-white">
                ⛽ Топливо: <span className="font-bold text-orange-400">{fmtN(d.expenses.fuel.total_amount)} ₽</span>
                {d.expenses.fuel.consumption_per_100km > 0 && (
                  <span className="text-xs text-slate-500 ml-2">{d.expenses.fuel.consumption_per_100km} л/100км • {d.expenses.fuel.cost_per_km} ₽/км</span>
                )}
              </summary>
              <div className="mt-1 ml-4 space-y-0.5">
                {d.expenses.fuel.by_company.map((c: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs text-slate-400">
                    <span>{c.name}</span>
                    <span>{c.liters} л <span className="text-white">{fmtN(c.amount)} ₽</span></span>
                  </div>
                ))}
                <div className="text-xs text-slate-500 pt-1 border-t border-slate-700">
                  Всего: {d.expenses.fuel.total_liters} л, ср. цена {d.expenses.fuel.avg_price_per_liter} ₽/л
                </div>
              </div>
            </details>

            {/* Salary */}
            <details className="mb-2">
              <summary className="text-sm text-slate-300 cursor-pointer hover:text-white">
                👨‍✈️ ЗП водителя: <span className="font-bold text-blue-400">{fmtN(d.expenses.salary.total)} ₽</span>
                {d.expenses.salary.mileage_km > 0 && (
                  <span className="text-xs text-slate-500 ml-2">факт {(d.expenses.salary.total / d.expenses.salary.mileage_km).toFixed(1)} ₽/км</span>
                )}
              </summary>
              <div className="mt-1 ml-4 text-xs text-slate-400 space-y-0.5">
                <div>Пробег: {fmtN(d.expenses.salary.mileage_km)} км</div>
                <div>Ставка: {d.expenses.salary.rate_per_km} ₽/км ({d.vehicle.tonnage}т)</div>
                <div>Начислено по ставке: {fmtN(d.expenses.salary.base)} ₽</div>
                {d.expenses.salary.adjustments !== 0 && (
                  <div className={d.expenses.salary.adjustments > 0 ? "text-yellow-400" : "text-green-400"}>
                    Корректировки: {d.expenses.salary.adjustments > 0 ? '+' : ''}{fmtN(d.expenses.salary.adjustments)} ₽
                  </div>
                )}
              </div>
            </details>

            {/* Repair */}
            {d.expenses.repair.total > 0 ? (
              <details className="mb-2">
                <summary className="text-sm text-slate-300 cursor-pointer hover:text-white">
                  🔧 Ремонт: <span className="font-bold text-red-400">{fmtN(d.expenses.repair.total)} ₽</span>
                </summary>
                <div className="mt-1 ml-4 space-y-0.5">
                  {d.expenses.repair.items.map((r: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs text-slate-400">
                      <span>{fmtD(r.date)} {r.description}</span>
                      <span className="text-white ml-2">{fmtN(r.total)} ₽</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : (
              <div className="text-sm text-slate-500 mb-1">🔧 Ремонт: — ₽</div>
            )}

            {/* Leasing */}
            <div className="text-sm text-slate-500">📋 Лизинг: {d.expenses.leasing.total > 0 ? <span className="text-white font-bold">{fmtN(d.expenses.leasing.total)} ₽</span> : '— ₽'}</div>
          </div>

          {/* Summary */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <h4 className="text-sm font-bold text-white mb-2">📊 ИТОГО</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Прибыль</span>
                <div className={`font-bold text-base ${d.summary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtN(d.summary.profit)} ₽
                </div>
              </div>
              <div>
                <span className="text-slate-500">Маржа</span>
                <div className="font-bold text-base text-white">{d.summary.margin}%</div>
              </div>
              <div>
                <span className="text-slate-500">Пробег</span>
                <div className="font-bold text-white">{fmtN(d.summary.total_km)} км</div>
              </div>
              <div>
                <span className="text-slate-500">Рейсов</span>
                <div className="font-bold text-white">{d.summary.trips_count}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mt-2">
              <div>
                <span className="text-slate-500">₽/км доход</span>
                <div className="text-green-400 font-medium">{d.summary.income_per_km}</div>
              </div>
              <div>
                <span className="text-slate-500">₽/км расход</span>
                <div className="text-red-400 font-medium">{d.summary.expense_per_km}</div>
              </div>
              <div>
                <span className="text-slate-500">₽/км прибыль</span>
                <div className={`font-medium ${d.summary.profit_per_km >= 0 ? 'text-green-400' : 'text-red-400'}`}>{d.summary.profit_per_km}</div>
              </div>
            </div>
            {d.summary.working_days > 0 && (
              <div className="text-xs text-slate-500 mt-1">
                В работе {d.summary.working_days} дн., простой {d.summary.idle_days} дн.
              </div>
            )}
          </div>

          {/* Previous period comparison */}
          {d.prev_period && d.prev_period.income > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-3 text-xs">
              <h4 className="text-sm font-bold text-slate-400 mb-1">📈 vs предыдущий месяц</h4>
              <div className="flex flex-wrap gap-4 text-slate-400">
                <span>Доход: <span className={d.income.total >= d.prev_period.income ? 'text-green-400' : 'text-red-400'}>
                  {d.prev_period.income > 0 ? ((d.income.total - d.prev_period.income) / d.prev_period.income * 100).toFixed(0) : '—'}%
                </span></span>
                <span>Расходы: <span className={d.expenses.total <= d.prev_period.expenses ? 'text-green-400' : 'text-red-400'}>
                  {d.prev_period.expenses > 0 ? ((d.expenses.total - d.prev_period.expenses) / d.prev_period.expenses * 100).toFixed(0) : '—'}%
                </span></span>
                <span>Маржа: <span className={d.summary.margin >= d.prev_period.margin ? 'text-green-400' : 'text-red-400'}>
                  {d.prev_period.margin.toFixed(1)}% → {d.summary.margin}%
                </span></span>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}


export default function PnlPage() {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [data, setData] = useState<PnlData | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [byVehicle, setByVehicle] = useState<any[]>([]);
  const [showVehicles, setShowVehicles] = useState(false);
  const [expandedPlate, setExpandedPlate] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<PnlData | null>(null);

  const periodParam = useMemo(() => {
    if (periodType === 'month') return period;
    if (periodType === 'year') return period.split('-')[0];
    // Quarter
    const [y, m] = period.split('-').map(Number);
    const q = Math.ceil(m / 3);
    return `${y}-Q${q}`;
  }, [period, periodType]);

  const prevPeriodParam = useMemo(() => {
    if (periodType === 'year') return `${parseInt(period.split('-')[0]) - 1}`;
    if (periodType === 'quarter') {
      const [y, m] = period.split('-').map(Number);
      const q = Math.ceil(m / 3);
      if (q === 1) return `${y - 1}-Q4`;
      return `${y}-Q${q - 1}`;
    }
    // month
    const [y, m] = period.split('-').map(Number);
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, '0')}`;
  }, [period, periodType]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/pnl?period=${periodParam}`).then(r => r.json()).then(d => d.error ? null : d).catch(() => null),
      fetch(`/api/pnl?period=${prevPeriodParam}`).then(r => r.json()).then(d => d.error ? null : d).catch(() => null),
      fetch('/api/pnl/trend?months=6').then(r => r.json()).catch(() => []),
    ]).then(([pnl, prev, trendData]) => {
      setData(pnl);
      setCompareData(prev);
      setTrend(Array.isArray(trendData) ? trendData : []);
      setLoading(false);
    });
  }, [periodParam, prevPeriodParam]);

  // Load by-vehicle P&L
  useEffect(() => {
    fetch('/api/pnl/by-vehicle?period=' + encodeURIComponent(periodParam))
      .then(r => r.ok ? r.json() : [])
      .then(d => setByVehicle(d))
      .catch(() => {});
  }, [periodParam]);

  const changeArrow = (current: number, prev: number | undefined) => {
    if (!prev || prev === 0) return null;
    const pct = ((current - prev) / Math.abs(prev)) * 100;
    if (Math.abs(pct) < 0.5) return <span className="text-slate-500 text-xs flex items-center gap-0.5"><Minus className="w-3 h-3" /> 0%</span>;
    return pct > 0 
      ? <span className="text-green-400 text-xs flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> +{pct.toFixed(0)}%</span>
      : <span className="text-red-400 text-xs flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" /> {pct.toFixed(0)}%</span>;
  };

  const navigatePeriod = (dir: -1 | 1) => {
    const [y, m] = period.split('-').map(Number);
    const newMonth = m + dir;
    if (newMonth < 1) setPeriod(`${y - 1}-12`);
    else if (newMonth > 12) setPeriod(`${y + 1}-01`);
    else setPeriod(`${y}-${String(newMonth).padStart(2, '0')}`);
  };

  if (loading) return <div className="p-6 text-center text-slate-400 py-20">Загрузка P&L...</div>;
  if (!data) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">📈 P&L — Прибыли и убытки</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            {(['month', 'quarter', 'year'] as const).map(t => (
              <button key={t} onClick={() => setPeriodType(t)} className={`px-3 py-1 rounded text-sm transition-colors ${periodType === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {t === 'month' ? 'Месяц' : t === 'quarter' ? 'Квартал' : 'Год'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigatePeriod(-1)} className="p-1.5 text-slate-400 hover:text-white"><ChevronLeft className="w-4 h-4" /></button>
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
            <button onClick={() => navigatePeriod(1)} className="p-1.5 text-slate-400 hover:text-white"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
      <div className="text-center text-slate-400 py-20">Нет данных за выбранный период</div>
    </div>
  );

  const maxRevenue = Math.max(...trend.map(t => t.revenue), 1);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            📈 P&L — Прибыли и убытки
          </h1>
          <p className="text-slate-400 text-sm mt-1">Финансовый отчёт ООО «Транспортная Логистика»</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            {(['month', 'quarter', 'year'] as const).map(t => (
              <button
                key={t}
                onClick={() => setPeriodType(t)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  periodType === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'month' ? 'Месяц' : t === 'quarter' ? 'Квартал' : 'Год'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigatePeriod(-1)} className="p-1.5 text-slate-400 hover:text-white">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
            <button onClick={() => navigatePeriod(1)} className="p-1.5 text-slate-400 hover:text-white">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <ExcelExport type="fuel" label="📥 Excel" period={periodParam} />
        </div>
      </div>

      {/* Warnings */}
      {(data.warnings.undistributed_registries.count > 0 || data.warnings.no_leasing_data || data.warnings.no_repair_data) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-2">
            <AlertTriangle className="w-4 h-4" /> Данные неполные
          </div>
          <div className="space-y-1 text-sm text-yellow-300/70">
            {data.warnings.undistributed_registries.count > 0 && (
              <div>🔴 <a href="/revenue/registries" className="underline hover:text-yellow-300">{data.warnings.undistributed_registries.count} нераспределённых реестров</a> на {formatMoneyFull(data.warnings.undistributed_registries.total)}</div>
            )}
            {data.warnings.no_leasing_data && <div>🟡 Нет данных по лизингу</div>}
            {data.warnings.no_repair_data && <div>🟡 Нет данных по ремонту</div>}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Выручка</div>
          <div className="text-xl font-bold text-green-400">{formatMoney(data.revenue.total)}</div>
          <div>{changeArrow(data.revenue.total, compareData?.revenue.total)}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Расходы</div>
          <div className="text-xl font-bold text-red-400">{formatMoney(data.expenses.total)}</div>
          <div>{changeArrow(data.expenses.total, compareData?.expenses.total)}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Чистая прибыль</div>
          <div className={`text-xl font-bold ${data.profit.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatMoney(data.profit.net)}
          </div>
          <div>{changeArrow(data.profit.net, compareData?.profit.net)}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Маржа</div>
          <div className={`text-xl font-bold ${data.profit.margin >= 20 ? 'text-green-400' : data.profit.margin >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.profit.margin}%
          </div>
          <div>{changeArrow(data.profit.margin, compareData?.profit.margin)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue block */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" /> ДОХОДЫ
            </span>
            <span className="text-green-400 font-bold">{formatMoneyFull(data.revenue.total)}</span>
          </div>
          <PnlRow label="Выручка 1С (РФ)" amount={data.revenue.contracts_1c.total} color="text-blue-400" icon={Building2} />
          <PnlRow label="Выручка WB" amount={data.revenue.wb.total} color="text-purple-400" icon={Building2} />
          <PnlRow 
            label="Распределённые реестры" 
            amount={data.revenue.distributed.total} 
            color="text-orange-400" 
            icon={DollarSign}
            warning={data.warnings.undistributed_registries.count > 0 
              ? `${data.warnings.undistributed_registries.count} не распределено` 
              : undefined
            }
          />
        </div>

        {/* Expenses block */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" /> РАСХОДЫ
            </span>
            <span className="text-red-400 font-bold">{formatMoneyFull(data.expenses.total)}</span>
          </div>
          <PnlRow label="ФОТ водителей" amount={data.expenses.salary.total} percent={data.expenses.salary.percent} color="text-blue-400" icon={Users} />
          <PnlRow label="Топливо" amount={data.expenses.fuel.total} percent={data.expenses.fuel.percent} color="text-orange-400" icon={Fuel} />
          <PnlRow 
            label="Лизинг" 
            amount={data.expenses.leasing.total} 
            percent={data.expenses.leasing.percent} 
            color="text-cyan-400" 
            icon={Building2}
            warning={data.warnings.no_leasing_data ? 'нет данных' : undefined}
          />
          <PnlRow 
            label="Ремонт" 
            amount={data.expenses.repair.total} 
            percent={data.expenses.repair.percent} 
            color="text-yellow-400" 
            icon={Wrench}
            warning={data.warnings.no_repair_data ? 'нет данных' : undefined}
          />
        </div>
      </div>

      {/* Profit summary */}
      <div className={`rounded-xl p-6 mb-6 border ${
        data.profit.net >= 0 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-sm">Чистая прибыль</div>
            <div className={`text-3xl font-bold ${data.profit.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatMoneyFull(data.profit.net)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-400 text-sm">Маржинальность</div>
            <div className={`text-3xl font-bold ${data.profit.margin >= 20 ? 'text-green-400' : data.profit.margin >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
              {data.profit.margin}%
            </div>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      {trend.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-white font-semibold mb-4">📊 Тренд (6 месяцев)</h3>
          <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm inline-block" /> Выручка</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500/70 rounded-sm inline-block" /> Расходы</span>
          </div>
          <div className="space-y-3">
            {trend.map((item, i) => (
              <TrendBar key={i} data={item} maxRevenue={maxRevenue} />
            ))}
          </div>
        </div>
      )}

      {/* By Vehicle */}
      <div className="mt-6">
        <button onClick={() => setShowVehicles(!showVehicles)}
          className="w-full text-left bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-lg">🚛 По машинам ({byVehicle.filter(v => v.revenue > 0 || v.total_expenses > 0).length})</span>
            <span className="text-slate-400">{showVehicles ? "▲" : "▼"}</span>
          </div>
        </button>
        {showVehicles && byVehicle.length > 0 && (
          <div className="mt-2 bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left p-3">Машина</th>
                  <th className="text-right p-3">Доход</th>
                  <th className="text-right p-3">Топливо</th>
                  <th className="text-right p-3">ЗП</th>
                  <th className="text-right p-3">Ремонт</th>
                  <th className="text-right p-3">Прибыль</th>
                  <th className="text-right p-3">Маржа</th>
                </tr>
              </thead>
              <tbody>
                {byVehicle.filter(v => v.revenue > 0 || v.total_expenses > 0).map((v, i) => (
                  <><tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedPlate(expandedPlate === v.plate ? null : v.plate)}>
                    <td className="p-3">
                      <div className="font-mono text-xs">{v.plate}</div>
                      <div className="text-xs text-slate-500">{v.model}</div>
                    </td>
                    <td className="p-3 text-right text-green-400">{v.revenue > 0 ? v.revenue.toLocaleString("ru-RU") : "—"}</td>
                    <td className="p-3 text-right text-orange-400">{v.fuel_cost > 0 ? v.fuel_cost.toLocaleString("ru-RU") : "—"}</td>
                    <td className="p-3 text-right text-blue-400">{v.salary_cost > 0 ? v.salary_cost.toLocaleString("ru-RU") : "—"}</td>
                    <td className="p-3 text-right text-red-400">{v.repair_cost > 0 ? v.repair_cost.toLocaleString("ru-RU") : "—"}</td>
                    <td className={`p-3 text-right font-medium ${v.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {v.profit !== 0 ? v.profit.toLocaleString("ru-RU") : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        v.margin_pct > 20 ? "bg-green-900/50 text-green-400" :
                        v.margin_pct > 10 ? "bg-yellow-900/50 text-yellow-400" :
                        v.margin_pct > 0 ? "bg-red-900/50 text-red-400" : "text-slate-500"
                      }`}>{v.margin_pct > 0 ? v.margin_pct + "%" : "—"}</span>
                      <ChevronDown size={14} className={`inline ml-1 transition-transform ${expandedPlate === v.plate ? 'rotate-180' : ''}`} />
                    </td>
                  </tr>
                  {expandedPlate === v.plate && <VehicleDetailRow plate={v.plate} period={periodParam} />}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
