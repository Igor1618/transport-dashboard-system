'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronDown, Truck, TrendingUp, TrendingDown, ExternalLink, Fuel, FileText
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid
} from 'recharts';

// ========== TYPES ==========
interface Vehicle {
  vehicle_plate: string;
  vehicle_type: string;
  vehicle_class: string;
  gross_revenue: number;
  net_revenue: number;
  fuel_cost: number;
  driver_salary: number;
  platon_cost: number;
  repair_cost: number;
  insurance_cost: number;
  leasing_cost: number;
  penalties: number;
  trip_contribution: number;
  fleet_contribution: number;
  total_actual_km: number;
  total_billed_km: number;
  empty_pct: number;
  days_working: number;
  days_idle: number;
  commercial_utilization: number;
  revenue_per_km: number;
  cost_per_km: number;
  profit_per_km: number;
  fuel_per_km: number;
  fuel_liters_per_100km: number;
  own_trips: number;
  hired_trips: number;
}

interface FleetData {
  month_key: string;
  vehicles: Vehicle[];
  totals: {
    count: number;
    gross_revenue: number;
    net_revenue: number;
    trip_contribution: number;
    fleet_contribution: number;
    fuel_cost: number;
    driver_salary: number;
    cash_cows: number;
    loss_makers: number;
    low_margin: number;
  };
}

interface VehicleDetail {
  month_key: string;
  vehicle: { plate: string; type: string; class: string };
  summary: Record<string, number>;
  trips: TripDetail[];
  waterfall: { label: string; value: number; type: string }[];
  trend: TrendMonth[];
}

interface TripDetail {
  source: string;
  source_id: string;
  driver: string;
  route: string;
  departure: string;
  arrival: string;
  billed_km: number;
  actual_km: number;
  empty_km: number;
  days: number;
  gross_revenue: number;
  net_revenue: number;
  fuel_cost: number;
  platon_cost: number;
  contribution: number;
  contrib_per_km: number;
  quality: string;
}

interface TrendMonth {
  month_key: string;
  gross_revenue: number;
  net_revenue: number;
  trip_contribution: number;
  fleet_contribution: number;
  fuel_cost: number;
  utilization: number;
  fuel_l100: number;
  trips: number;
  vehicle_class: string;
}

// ========== HELPERS ==========
const fmtK = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};
const fmtMoney = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
const shortMonth = (key: string) => {
  const months = ['', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const m = parseInt(key.split('-')[1]);
  return months[m] || key;
};

const classColors: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  cash_cow: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Прибыльные', emoji: '\uD83D\uDFE2' },
  low_margin: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'Низкая маржа', emoji: '\uD83D\uDFE1' },
  loss_maker: { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Убыточные', emoji: '\uD83D\uDD34' },
};

type SortKey = 'fleet_contribution' | 'net_revenue' | 'fuel_liters_per_100km' | 'commercial_utilization' | 'empty_pct' | 'vehicle_plate' | 'trip_contribution';

// ========== VEHICLE DETAIL EXPANSION ==========
function VehicleExpanded({ plate, monthKey }: { plate: string; monthKey: string }) {
  const [detail, setDetail] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pnl/fleet/${encodeURIComponent(plate)}?month=${monthKey}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [plate, monthKey]);

  if (loading) return (
    <tr><td colSpan={10} className="p-6 text-center text-slate-500">
      <RefreshCw size={18} className="animate-spin inline mr-2" /> Загрузка...
    </td></tr>
  );
  if (!detail) return <tr><td colSpan={10} className="p-4 text-center text-red-400">Ошибка загрузки деталей</td></tr>;

  const s = detail.summary;

  // Waterfall chart data
  let running = 0;
  const wfData = detail.waterfall.map(step => {
    if (step.type === 'total' || step.type === 'subtotal') {
      running = step.value;
      return { name: step.label, base: 0, value: step.value, fill: step.type === 'total' ? '#3b82f6' : '#8b5cf6' };
    }
    if (step.type === 'result') {
      return { name: step.label, base: 0, value: step.value, fill: step.value >= 0 ? '#22c55e' : '#ef4444' };
    }
    const absVal = Math.abs(step.value);
    const base = running - absVal;
    running = base;
    return { name: step.label, base: Math.max(base, 0), value: absVal, fill: '#ef4444' };
  });

  // Trend chart
  const trendData = detail.trend.map(t => ({
    month: shortMonth(t.month_key),
    revenue: Math.round(t.net_revenue / 1000),
    contribution: Math.round(t.fleet_contribution / 1000),
    trips: t.trips,
  }));

  return (
    <tr>
      <td colSpan={10} className="p-0">
        <div className="bg-slate-900/60 border-t border-b border-slate-600 p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-white text-lg">{detail.vehicle.plate}</span>
              <span className="text-slate-400 ml-2">{detail.vehicle.type}</span>
              <span className={`ml-3 px-2 py-0.5 rounded text-xs font-medium ${classColors[detail.vehicle.class]?.bg} ${classColors[detail.vehicle.class]?.text}`}>
                {classColors[detail.vehicle.class]?.emoji} {classColors[detail.vehicle.class]?.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Summary metrics */}
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-white">Итоги</h4>
                {s.driver_report_id && (
                  <a href={`/reports/${encodeURIComponent(s.driver_report_id)}`}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={(e) => e.stopPropagation()}>
                    <FileText size={12} /> Отчёт водителя
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-slate-500">Выручка (без НДС)</span><div className="text-blue-400 font-bold">{fmtMoney(s.net_revenue)} ₽</div></div>
                <div><span className="text-slate-500">Маржа рейсов</span><div className="text-purple-400 font-bold">{fmtMoney(s.trip_contribution)} ₽</div></div>
                <div><span className="text-slate-500">Маржа автопарка</span><div className={`font-bold ${s.fleet_contribution >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtMoney(s.fleet_contribution)} ₽</div></div>
                <div><span className="text-slate-500">Топливо</span><div className="text-orange-400">{fmtMoney(s.fuel_cost)} ₽ ({s.fuel_liters_per_100km} л/100)</div></div>
                <div><span className="text-slate-500">ЗП водителя</span><div className="text-blue-400">{fmtMoney(s.driver_salary)} ₽</div></div>
                <div><span className="text-slate-500">Платон</span><div className="text-cyan-400">{fmtMoney(s.platon_cost)} ₽</div></div>
                {s.fines_amount > 0 && <div><span className="text-slate-500">Штрафы ГИБДД</span><div className="text-amber-400">{fmtMoney(s.fines_amount)} ₽</div></div>}
                {s.road_expenses > 0 && <div><span className="text-slate-500">Расходы в дороге</span><div className="text-amber-400">{fmtMoney(s.road_expenses)} ₽</div></div>}
                {s.extra_works_amount > 0 && <div><span className="text-slate-500">Допработы</span><div className="text-amber-400">{fmtMoney(s.extra_works_amount)} ₽</div></div>}
                {s.relocations_amount > 0 && <div><span className="text-slate-500">Перегоны</span><div className="text-amber-400">{fmtMoney(s.relocations_amount)} ₽</div></div>}
                {s.payments_amount > 0 && <div><span className="text-slate-500">Авансы/суточные</span><div className="text-amber-400">{fmtMoney(s.payments_amount)} ₽</div></div>}
                {s.deductions_amount > 0 && <div><span className="text-slate-500">Удержания</span><div className="text-emerald-400">-{fmtMoney(s.deductions_amount)} ₽</div></div>}
                <div><span className="text-slate-500">Ремонт</span><div className="text-red-400">{fmtMoney(s.repair_cost)} ₽</div></div>
                <div><span className="text-slate-500">Пробег</span><div className="text-white">{fmtMoney(s.total_actual_km)} км</div></div>
                <div><span className="text-slate-500">Загрузка</span><div className="text-white">{s.commercial_utilization?.toFixed(0)}% ({s.days_working}д / {s.days_working + s.days_idle}д)</div></div>
                <div><span className="text-slate-500">₽/км выручка</span><div className="text-green-400">{s.revenue_per_km?.toFixed(1)}</div></div>
                <div><span className="text-slate-500">₽/км расход</span><div className="text-red-400">{s.cost_per_km?.toFixed(1)}</div></div>
                <div><span className="text-slate-500">₽/км прибыль</span><div className={s.profit_per_km >= 0 ? 'text-green-400' : 'text-red-400'}>{s.profit_per_km?.toFixed(1)}</div></div>
              </div>
            </div>

            {/* Mini waterfall */}
            {wfData.length > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-3">
                <h4 className="text-sm font-bold text-white mb-2">P&L — Каскадная диаграмма</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={wfData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v: number) => fmtK(v)} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: number, name: string) => name === 'base' ? [null, null] : [`${fmtMoney(value)} ₽`, '']} />
                    <Bar dataKey="base" stackId="a" fill="transparent" />
                    <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]}>
                      {wfData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Trend */}
          {trendData.length > 1 && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <h4 className="text-sm font-bold text-white mb-2">Тренд за 6 месяцев</h4>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: number) => `${v}K`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(value: number, name: string) => [`${value}K ₽`, name]} />
                  <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="contribution" name="Маржа парка" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trips table */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <h4 className="text-sm font-bold text-white mb-2">Рейсы ({detail.trips.length})</h4>
            {detail.trips.length > 0 ? (
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700">
                      <th className="text-left p-1.5">Дата</th>
                      <th className="text-left p-1.5">Маршрут</th>
                      <th className="text-left p-1.5">Водитель</th>
                      <th className="text-right p-1.5">КМ</th>
                      <th className="text-right p-1.5">Выручка</th>
                      <th className="text-right p-1.5">Топливо</th>
                      <th className="text-right p-1.5">Маржа</th>
                      <th className="text-right p-1.5">руб/км</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.trips.map((t, i) => (
                      <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                        <td className="p-1.5 text-slate-400 whitespace-nowrap">
                          {t.departure ? new Date(t.departure).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '---'}
                        </td>
                        <td className="p-1.5 text-slate-300 truncate max-w-[200px]" title={t.route}>{t.route}</td>
                        <td className="p-1.5 text-slate-400 truncate max-w-[120px]">{t.driver?.split(' ').slice(0, 2).join(' ')}</td>
                        <td className="p-1.5 text-right text-white">{Math.round(t.actual_km)}</td>
                        <td className="p-1.5 text-right text-blue-400">{fmtMoney(t.net_revenue)}</td>
                        <td className="p-1.5 text-right text-orange-400">{fmtMoney(t.fuel_cost)}</td>
                        <td className={`p-1.5 text-right font-medium ${t.contribution >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmtMoney(t.contribution)}
                        </td>
                        <td className="p-1.5 text-right text-slate-400">{t.contrib_per_km?.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-slate-500 text-center py-3">Нет рейсов</div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ========== MAIN PAGE ==========
export default function PnlVehiclesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [monthKey, setMonthKey] = useState(() => {
    return searchParams.get('month') || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();
  });
  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('fleet_contribution');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [expandedPlate, setExpandedPlate] = useState<string | null>(
    searchParams.get('plate') || null
  );

  useEffect(() => {
    setLoading(true);
    const classParam = classFilter ? `&class=${classFilter}` : '';
    fetch(`/api/pnl/fleet?month=${monthKey}&sort=${sortKey}&order=${sortOrder}${classParam}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [monthKey, sortKey, sortOrder, classFilter]);

  const navigateMonth = (dir: -1 | 1) => {
    const [y, m] = monthKey.split('-').map(Number);
    const nm = m + dir;
    if (nm < 1) setMonthKey(`${y - 1}-12`);
    else if (nm > 12) setMonthKey(`${y + 1}-01`);
    else setMonthKey(`${y}-${String(nm).padStart(2, '0')}`);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder(key === 'vehicle_plate' ? 'asc' : 'asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-600 inline ml-0.5" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-400 inline ml-0.5" />
      : <ArrowDown className="w-3 h-3 text-blue-400 inline ml-0.5" />;
  };

  const vehicles = data?.vehicles || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/pnl')} className="text-slate-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-purple-400" /> P&L — Автопарк
            </h1>
          </div>
          {data?.totals && (
            <p className="text-slate-400 text-sm mt-1 ml-8">
              {data.totals.count} машин | Выручка: {fmtMoney(data.totals.net_revenue)} ₽ |
              Маржа парка: <span className={data.totals.fleet_contribution >= 0 ? 'text-green-400' : 'text-red-400'}>
                {fmtMoney(data.totals.fleet_contribution)} ₽
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={() => navigateMonth(-1)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input type="month" value={monthKey} onChange={e => setMonthKey(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
            <button onClick={() => navigateMonth(1)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {/* Class filter */}
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button onClick={() => setClassFilter(null)}
              className={`px-2 py-1 rounded text-xs ${!classFilter ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Все</button>
            {Object.entries(classColors).map(([key, c]) => (
              <button key={key} onClick={() => setClassFilter(classFilter === key ? null : key)}
                className={`px-2 py-1 rounded text-xs ${classFilter === key ? `${c.bg} ${c.text}` : 'text-slate-400 hover:text-white'}`}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {data?.totals && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <span className="text-slate-400">Машины</span>
            <div className="text-lg font-bold text-white">{data.totals.count}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <span className="text-slate-400">Выручка</span>
            <div className="text-lg font-bold text-blue-400">{fmtK(data.totals.net_revenue)}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <span className="text-slate-400">Маржа рейсов</span>
            <div className="text-lg font-bold text-purple-400">{fmtK(data.totals.trip_contribution)}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-green-500/30">
            <span className="text-green-400">{'\uD83D\uDFE2'} Прибыльные</span>
            <div className="text-lg font-bold text-green-400">{data.totals.cash_cows}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-yellow-500/30">
            <span className="text-yellow-400">{'\uD83D\uDFE1'} Низкая маржа</span>
            <div className="text-lg font-bold text-yellow-400">{data.totals.low_margin}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-red-500/30">
            <span className="text-red-400">{'\uD83D\uDD34'} Убыточные</span>
            <div className="text-lg font-bold text-red-400">{data.totals.loss_makers}</div>
          </div>
        </div>
      )}

      {/* Loading / Table */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin inline mr-2" /> Загрузка данных автопарка...
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left p-3 cursor-pointer" onClick={() => toggleSort('vehicle_plate')}>
                  Машина <SortIcon col="vehicle_plate" />
                </th>
                <th className="text-center p-3">Класс</th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort('net_revenue')}>
                  Выручка <SortIcon col="net_revenue" />
                </th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort('trip_contribution')}>
                  Маржа рейсов <SortIcon col="trip_contribution" />
                </th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort('fleet_contribution')}>
                  Маржа парка <SortIcon col="fleet_contribution" />
                </th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort('commercial_utilization')}>
                  Загрузка % <SortIcon col="commercial_utilization" />
                </th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort('fuel_liters_per_100km')}>
                  Л/100 <SortIcon col="fuel_liters_per_100km" />
                </th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort('empty_pct')}>
                  Порожний % <SortIcon col="empty_pct" />
                </th>
                <th className="text-right p-3">Рейсы</th>
                <th className="w-8 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => {
                const cc = classColors[v.vehicle_class] || classColors.low_margin;
                const isExpanded = expandedPlate === v.vehicle_plate;
                return (
                  <>{/* eslint-disable-next-line react/jsx-key */}
                  <tr key={v.vehicle_plate} className={`border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-700/20' : ''}`}
                    onClick={() => setExpandedPlate(isExpanded ? null : v.vehicle_plate)}>
                    <td className="p-3">
                      <span className="font-mono text-xs text-white">{v.vehicle_plate}</span>
                      <div className="text-xs text-slate-500">{v.vehicle_type}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cc.bg} ${cc.text}`}>
                        {cc.emoji}
                      </span>
                    </td>
                    <td className="p-3 text-right text-blue-400 tabular-nums">{v.net_revenue > 0 ? fmtMoney(v.net_revenue) : '---'}</td>
                    <td className="p-3 text-right text-purple-400 tabular-nums">{fmtMoney(v.trip_contribution)}</td>
                    <td className={`p-3 text-right font-medium tabular-nums ${v.fleet_contribution >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmtMoney(v.fleet_contribution)}
                    </td>
                    <td className={`p-3 text-right tabular-nums ${v.commercial_utilization > 70 ? 'text-green-400' : v.commercial_utilization > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {v.commercial_utilization.toFixed(0)}%
                    </td>
                    <td className={`p-3 text-right tabular-nums ${v.fuel_liters_per_100km > 40 ? 'text-red-400' : v.fuel_liters_per_100km > 35 ? 'text-yellow-400' : 'text-slate-300'}`}>
                      {v.fuel_liters_per_100km > 0 ? v.fuel_liters_per_100km.toFixed(1) : '---'}
                    </td>
                    <td className={`p-3 text-right tabular-nums ${v.empty_pct > 25 ? 'text-red-400' : v.empty_pct > 15 ? 'text-yellow-400' : 'text-slate-300'}`}>
                      {v.empty_pct > 0 ? v.empty_pct.toFixed(0) + '%' : '---'}
                    </td>
                    <td className="p-3 text-right text-slate-300 tabular-nums">{v.own_trips}</td>
                    <td className="p-3">
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </td>
                  </tr>
                  {isExpanded && <VehicleExpanded plate={v.vehicle_plate} monthKey={monthKey} />}
                  </>
                );
              })}
              {vehicles.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-slate-500">Машины не найдены</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
