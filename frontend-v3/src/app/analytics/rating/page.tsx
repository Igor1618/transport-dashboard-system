'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ArrowUpDown, ArrowUp, ArrowDown,
  Users, Truck, Fuel, AlertTriangle, Receipt, Award, ChevronDown
} from 'lucide-react';

// ========== TYPES ==========
interface DriverRating {
  driver_name: string;
  vehicles: string[];
  reports_count: number;
  total_km: number;
  fuel_liters: number;
  fuel_cost: number;
  fuel_per_100km: number;
  fines_count: number;
  fines_amount: number;
  expenses_amount: number;
  expenses_count: number;
  extra_works_amount: number;
  relocations_amount: number;
  total_expenses: number;
  salary: number;
  work_days: number;
  fuel_grade: string;
  fines_grade: string;
  expenses_grade: string;
  overall_grade: string;
  score: number;
}

interface VehicleRating {
  vehicle_number: string;
  vehicle_type: string;
  drivers: string[];
  reports_count: number;
  total_km: number;
  fuel_liters: number;
  fuel_cost: number;
  fuel_per_100km: number;
  fines_count: number;
  fines_amount: number;
  expenses_amount: number;
  expenses_count: number;
  extra_works_amount: number;
  total_expenses: number;
  work_days: number;
  fuel_grade: string;
  fines_grade: string;
  expenses_grade: string;
  overall_grade: string;
  score: number;
}

interface RatingResponse<T> {
  period: { start: string; end: string };
  fleet_avg_fuel: number;
  drivers?: T[];
  vehicles?: T[];
}

// ========== HELPERS ==========
const fmt = (n: number) => n?.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) || '0';

const gradeColor = (grade: string) => {
  switch (grade) {
    case 'good': return 'text-green-400';
    case 'medium': return 'text-yellow-400';
    case 'bad': return 'text-red-400';
    default: return 'text-slate-400';
  }
};

const gradeBg = (grade: string) => {
  switch (grade) {
    case 'good': return 'bg-green-500/20 border-green-500/30';
    case 'medium': return 'bg-yellow-500/20 border-yellow-500/30';
    case 'bad': return 'bg-red-500/20 border-red-500/30';
    default: return 'bg-slate-500/20 border-slate-500/30';
  }
};

const gradeEmoji = (grade: string) => {
  switch (grade) {
    case 'good': return '\uD83D\uDFE2';
    case 'medium': return '\uD83D\uDFE1';
    case 'bad': return '\uD83D\uDD34';
    default: return '\u26AA';
  }
};

const medalEmoji = (i: number) => {
  if (i === 0) return '\uD83E\uDD47';
  if (i === 1) return '\uD83E\uDD48';
  if (i === 2) return '\uD83E\uDD49';
  return '';
};

type Tab = 'drivers' | 'vehicles';
type DriverSortKey = 'score' | 'fuel_per_100km' | 'fines_count' | 'fines_amount' | 'expenses_amount' | 'total_km' | 'driver_name';
type VehicleSortKey = 'score' | 'fuel_per_100km' | 'fines_count' | 'fines_amount' | 'expenses_amount' | 'total_km' | 'vehicle_number';

// ========== EXPANDED ROW ==========
function DriverDetail({ d }: { d: DriverRating }) {
  return (
    <tr>
      <td colSpan={9} className="p-0">
        <div className="bg-slate-900/60 border-t border-b border-slate-600 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className={`rounded-lg border p-2 ${gradeBg(d.fuel_grade)}`}>
              <div className="text-slate-400 mb-1"><Fuel size={12} className="inline mr-1" />Топливо</div>
              <div className="text-white font-bold text-sm">{d.fuel_per_100km} л/100км</div>
              <div className="text-slate-400">{fmt(d.fuel_liters)} л / {fmt(d.fuel_cost)} ₽</div>
            </div>
            <div className={`rounded-lg border p-2 ${gradeBg(d.fines_grade)}`}>
              <div className="text-slate-400 mb-1"><AlertTriangle size={12} className="inline mr-1" />Штрафы</div>
              <div className="text-white font-bold text-sm">{d.fines_count} шт / {fmt(d.fines_amount)} ₽</div>
            </div>
            <div className={`rounded-lg border p-2 ${gradeBg(d.expenses_grade)}`}>
              <div className="text-slate-400 mb-1"><Receipt size={12} className="inline mr-1" />Прочие расходы</div>
              <div className="text-white font-bold text-sm">{fmt(d.expenses_amount)} ₽</div>
              {d.extra_works_amount > 0 && <div className="text-slate-400">Допработы: {fmt(d.extra_works_amount)} ₽</div>}
              {d.relocations_amount > 0 && <div className="text-slate-400">Перегоны: {fmt(d.relocations_amount)} ₽</div>}
            </div>
            <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-2">
              <div className="text-slate-400 mb-1">Итого</div>
              <div className="text-white font-bold text-sm">{fmt(d.total_expenses)} ₽ расходов</div>
              <div className="text-slate-400">Начислено: {fmt(d.salary)} ₽</div>
              <div className="text-slate-400">{d.work_days} рабочих дней</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Машины: {d.vehicles?.join(', ') || '---'} | Отчётов: {d.reports_count}
          </div>
        </div>
      </td>
    </tr>
  );
}

function VehicleDetail({ v }: { v: VehicleRating }) {
  return (
    <tr>
      <td colSpan={9} className="p-0">
        <div className="bg-slate-900/60 border-t border-b border-slate-600 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className={`rounded-lg border p-2 ${gradeBg(v.fuel_grade)}`}>
              <div className="text-slate-400 mb-1"><Fuel size={12} className="inline mr-1" />Топливо</div>
              <div className="text-white font-bold text-sm">{v.fuel_per_100km} л/100км</div>
              <div className="text-slate-400">{fmt(v.fuel_liters)} л / {fmt(v.fuel_cost)} ₽</div>
            </div>
            <div className={`rounded-lg border p-2 ${gradeBg(v.fines_grade)}`}>
              <div className="text-slate-400 mb-1"><AlertTriangle size={12} className="inline mr-1" />Штрафы</div>
              <div className="text-white font-bold text-sm">{v.fines_count} шт / {fmt(v.fines_amount)} ₽</div>
            </div>
            <div className={`rounded-lg border p-2 ${gradeBg(v.expenses_grade)}`}>
              <div className="text-slate-400 mb-1"><Receipt size={12} className="inline mr-1" />Расходы</div>
              <div className="text-white font-bold text-sm">{fmt(v.expenses_amount)} ₽</div>
              {v.extra_works_amount > 0 && <div className="text-slate-400">Допработы: {fmt(v.extra_works_amount)} ₽</div>}
            </div>
            <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-2">
              <div className="text-slate-400 mb-1">Итого</div>
              <div className="text-white font-bold text-sm">{fmt(v.total_expenses)} ₽ расходов</div>
              <div className="text-slate-400">{v.work_days} рабочих дней</div>
              <div className="text-slate-400">{v.vehicle_type || ''}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Водители: {v.drivers?.join(', ') || '---'} | Отчётов: {v.reports_count}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ========== MAIN PAGE ==========
export default function RatingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('drivers');
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');

  const [driversData, setDriversData] = useState<RatingResponse<DriverRating> | null>(null);
  const [vehiclesData, setVehiclesData] = useState<RatingResponse<VehicleRating> | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [driverSort, setDriverSort] = useState<DriverSortKey>('score');
  const [driverSortDir, setDriverSortDir] = useState<'asc' | 'desc'>('asc');
  const [vehicleSort, setVehicleSort] = useState<VehicleSortKey>('score');
  const [vehicleSortDir, setVehicleSortDir] = useState<'asc' | 'desc'>('asc');

  const periodParam = useMemo(() => {
    if (periodType === 'quarter') {
      const [y, m] = month.split('-').map(Number);
      const q = Math.ceil(m / 3);
      return `period=${y}-Q${q}`;
    }
    if (periodType === 'year') {
      return `period=${month.split('-')[0]}`;
    }
    return `month=${month}`;
  }, [month, periodType]);

  useEffect(() => {
    setLoading(true);
    setExpandedRow(null);
    const endpoint = tab === 'drivers' ? 'drivers' : 'vehicles';
    fetch(`/api/analytics/rating/${endpoint}?${periodParam}`)
      .then(r => r.json())
      .then(d => {
        if (tab === 'drivers') setDriversData(d);
        else setVehiclesData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab, periodParam]);

  const toggleDriverSort = (key: DriverSortKey) => {
    if (driverSort === key) setDriverSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setDriverSort(key); setDriverSortDir(key === 'driver_name' ? 'asc' : 'asc'); }
  };
  const toggleVehicleSort = (key: VehicleSortKey) => {
    if (vehicleSort === key) setVehicleSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setVehicleSort(key); setVehicleSortDir(key === 'vehicle_number' ? 'asc' : 'asc'); }
  };

  const sortedDrivers = useMemo(() => {
    if (!driversData?.drivers) return [];
    return [...driversData.drivers].sort((a: any, b: any) => {
      const av = a[driverSort] ?? 0, bv = b[driverSort] ?? 0;
      if (typeof av === 'string') return driverSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return driverSortDir === 'asc' ? av - bv : bv - av;
    });
  }, [driversData, driverSort, driverSortDir]);

  const sortedVehicles = useMemo(() => {
    if (!vehiclesData?.vehicles) return [];
    return [...vehiclesData.vehicles].sort((a: any, b: any) => {
      const av = a[vehicleSort] ?? 0, bv = b[vehicleSort] ?? 0;
      if (typeof av === 'string') return vehicleSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return vehicleSortDir === 'asc' ? av - bv : bv - av;
    });
  }, [vehiclesData, vehicleSort, vehicleSortDir]);

  // Summary cards
  const driverSummary = useMemo(() => {
    if (!driversData?.drivers) return null;
    const d = driversData.drivers;
    return {
      total: d.length,
      good: d.filter(x => x.overall_grade === 'good').length,
      medium: d.filter(x => x.overall_grade === 'medium').length,
      bad: d.filter(x => x.overall_grade === 'bad').length,
      avgFuel: driversData.fleet_avg_fuel,
      totalFines: d.reduce((s, x) => s + x.fines_amount, 0),
      totalExpenses: d.reduce((s, x) => s + x.expenses_amount, 0),
    };
  }, [driversData]);

  const vehicleSummary = useMemo(() => {
    if (!vehiclesData?.vehicles) return null;
    const v = vehiclesData.vehicles;
    return {
      total: v.length,
      good: v.filter(x => x.overall_grade === 'good').length,
      medium: v.filter(x => x.overall_grade === 'medium').length,
      bad: v.filter(x => x.overall_grade === 'bad').length,
      avgFuel: vehiclesData.fleet_avg_fuel,
      totalFines: v.reduce((s, x) => s + x.fines_amount, 0),
      totalExpenses: v.reduce((s, x) => s + x.expenses_amount, 0),
    };
  }, [vehiclesData]);

  const SortIcon = ({ active, dir }: { active: boolean; dir: string }) => {
    if (!active) return <ArrowUpDown className="w-3 h-3 text-slate-600 inline ml-0.5" />;
    return dir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-400 inline ml-0.5" />
      : <ArrowDown className="w-3 h-3 text-blue-400 inline ml-0.5" />;
  };

  const summary = tab === 'drivers' ? driverSummary : vehicleSummary;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/analytics')} className="text-slate-400 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-400" /> Рейтинг эффективности
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period type */}
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            {(['month', 'quarter', 'year'] as const).map(pt => (
              <button key={pt} onClick={() => setPeriodType(pt)}
                className={`px-2 py-1 rounded text-xs ${periodType === pt ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {pt === 'month' ? 'Месяц' : pt === 'quarter' ? 'Квартал' : 'Год'}
              </button>
            ))}
          </div>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700 w-fit">
        <button onClick={() => setTab('drivers')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${tab === 'drivers' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Users size={16} /> Водители
        </button>
        <button onClick={() => setTab('vehicles')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${tab === 'vehicles' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Truck size={16} /> Машины
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <span className="text-slate-400">Всего</span>
            <div className="text-lg font-bold text-white">{summary.total}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-green-500/30">
            <span className="text-green-400">{'\uD83D\uDFE2'} Хорошо</span>
            <div className="text-lg font-bold text-green-400">{summary.good}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-yellow-500/30">
            <span className="text-yellow-400">{'\uD83D\uDFE1'} Средне</span>
            <div className="text-lg font-bold text-yellow-400">{summary.medium}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-red-500/30">
            <span className="text-red-400">{'\uD83D\uDD34'} Плохо</span>
            <div className="text-lg font-bold text-red-400">{summary.bad}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <span className="text-slate-400">Ср. расход</span>
            <div className="text-lg font-bold text-orange-400">{summary.avgFuel} <span className="text-xs font-normal">л/100</span></div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <span className="text-slate-400">Штрафы</span>
            <div className="text-lg font-bold text-amber-400">{fmt(summary.totalFines)} <span className="text-xs font-normal">₽</span></div>
          </div>
        </div>
      )}

      {/* Loading / Table */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">
          <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full inline-block mr-2" />
          Загрузка рейтинга...
        </div>
      ) : tab === 'drivers' ? (
        /* ========== DRIVERS TABLE ========== */
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="p-3 text-left w-8">#</th>
                <th className="p-3 text-left cursor-pointer" onClick={() => toggleDriverSort('driver_name')}>
                  Водитель <SortIcon active={driverSort === 'driver_name'} dir={driverSortDir} />
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => toggleDriverSort('total_km')}>
                  Пробег <SortIcon active={driverSort === 'total_km'} dir={driverSortDir} />
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => toggleDriverSort('fuel_per_100km')}>
                  Топливо л/100 <SortIcon active={driverSort === 'fuel_per_100km'} dir={driverSortDir} />
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => toggleDriverSort('fines_count')}>
                  Штрафы <SortIcon active={driverSort === 'fines_count'} dir={driverSortDir} />
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => toggleDriverSort('fines_amount')}>
                  Штрафы ₽ <SortIcon active={driverSort === 'fines_amount'} dir={driverSortDir} />
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => toggleDriverSort('expenses_amount')}>
                  Расходы ₽ <SortIcon active={driverSort === 'expenses_amount'} dir={driverSortDir} />
                </th>
                <th className="p-3 text-center cursor-pointer" onClick={() => toggleDriverSort('score')}>
                  Рейтинг <SortIcon active={driverSort === 'score'} dir={driverSortDir} />
                </th>
                <th className="w-8 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sortedDrivers.map((d, i) => {
                const isExpanded = expandedRow === d.driver_name;
                return (
                  <>{/* eslint-disable-next-line react/jsx-key */}
                  <tr key={d.driver_name}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-700/20' : ''}`}
                    onClick={() => setExpandedRow(isExpanded ? null : d.driver_name)}>
                    <td className="p-3 text-slate-500 text-xs">
                      {medalEmoji(i) || (i + 1)}
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-white">{d.driver_name?.split(' ').slice(0, 2).join(' ')}</span>
                      <div className="text-xs text-slate-500">{d.vehicles?.join(', ')}</div>
                    </td>
                    <td className="p-3 text-right text-white tabular-nums">{fmt(d.total_km)}</td>
                    <td className={`p-3 text-right font-medium tabular-nums ${gradeColor(d.fuel_grade)}`}>
                      {d.fuel_per_100km > 0 ? d.fuel_per_100km.toFixed(1) : '---'}
                    </td>
                    <td className={`p-3 text-right tabular-nums ${gradeColor(d.fines_grade)}`}>
                      {d.fines_count || '---'}
                    </td>
                    <td className={`p-3 text-right tabular-nums ${d.fines_amount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {d.fines_amount > 0 ? fmt(d.fines_amount) : '---'}
                    </td>
                    <td className={`p-3 text-right tabular-nums ${gradeColor(d.expenses_grade)}`}>
                      {d.expenses_amount > 0 ? fmt(d.expenses_amount) : '---'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${gradeBg(d.overall_grade)} ${gradeColor(d.overall_grade)}`}>
                        {gradeEmoji(d.overall_grade)} {d.score}
                      </span>
                    </td>
                    <td className="p-3">
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </td>
                  </tr>
                  {isExpanded && <DriverDetail d={d} />}
                  </>
                );
              })}
              {sortedDrivers.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-slate-500">Нет данных за выбранный период</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ========== VEHICLES TABLE ========== */
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="p-3 text-left w-8">#</th>
                <th className="p-3 text-left cursor-pointer" onClick={() => toggleVehicleSort('vehicle_number')}>
                  Машина <SortIcon active={vehicleSort === 'vehicle_number'} dir={vehicleSortDir} />
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => toggleVehicleSort('total_km')}>
                  Пробег <SortIcon active={vehicleSort === 'total_km'} dir={vehicleSortDir} />
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => toggleVehicleSort('fuel_per_100km')}>
                  Топливо л/100 <SortIcon active={vehicleSort === 'fuel_per_100km'} dir={vehicleSortDir} />
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => toggleVehicleSort('fines_count')}>
                  Штрафы <SortIcon active={vehicleSort === 'fines_count'} dir={vehicleSortDir} />
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => toggleVehicleSort('fines_amount')}>
                  Штрафы ₽ <SortIcon active={vehicleSort === 'fines_amount'} dir={vehicleSortDir} />
                </th>
                <th className="p-3 text-right cursor-pointer" onClick={() => toggleVehicleSort('expenses_amount')}>
                  Расходы ₽ <SortIcon active={vehicleSort === 'expenses_amount'} dir={vehicleSortDir} />
                </th>
                <th className="p-3 text-center cursor-pointer" onClick={() => toggleVehicleSort('score')}>
                  Рейтинг <SortIcon active={vehicleSort === 'score'} dir={vehicleSortDir} />
                </th>
                <th className="w-8 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sortedVehicles.map((v, i) => {
                const isExpanded = expandedRow === v.vehicle_number;
                return (
                  <>{/* eslint-disable-next-line react/jsx-key */}
                  <tr key={v.vehicle_number}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-700/20' : ''}`}
                    onClick={() => setExpandedRow(isExpanded ? null : v.vehicle_number)}>
                    <td className="p-3 text-slate-500 text-xs">
                      {medalEmoji(i) || (i + 1)}
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-xs text-white">{v.vehicle_number}</span>
                      <div className="text-xs text-slate-500">{v.vehicle_type}</div>
                    </td>
                    <td className="p-3 text-right text-white tabular-nums">{fmt(v.total_km)}</td>
                    <td className={`p-3 text-right font-medium tabular-nums ${gradeColor(v.fuel_grade)}`}>
                      {v.fuel_per_100km > 0 ? v.fuel_per_100km.toFixed(1) : '---'}
                    </td>
                    <td className={`p-3 text-right tabular-nums ${gradeColor(v.fines_grade)}`}>
                      {v.fines_count || '---'}
                    </td>
                    <td className={`p-3 text-right tabular-nums ${v.fines_amount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {v.fines_amount > 0 ? fmt(v.fines_amount) : '---'}
                    </td>
                    <td className={`p-3 text-right tabular-nums ${gradeColor(v.expenses_grade)}`}>
                      {v.expenses_amount > 0 ? fmt(v.expenses_amount) : '---'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${gradeBg(v.overall_grade)} ${gradeColor(v.overall_grade)}`}>
                        {gradeEmoji(v.overall_grade)} {v.score}
                      </span>
                    </td>
                    <td className="p-3">
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </td>
                  </tr>
                  {isExpanded && <VehicleDetail v={v} />}
                  </>
                );
              })}
              {sortedVehicles.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-slate-500">Нет данных за выбранный период</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
