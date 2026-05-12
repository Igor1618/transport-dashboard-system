'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, RefreshCw, Truck, Search, Download,
  TrendingUp, TrendingDown, AlertTriangle, ArrowUp, ArrowDown, FileText, X
} from 'lucide-react';

// ===== Drill-down modal =====
type DrillSection = 'trips' | 'fuel' | 'reports' | 'costs';
interface DrillState {
  section: DrillSection;
  plate: string;
  vehicleId: string;
  month: string;
}

function DrillModal({
  state, onClose,
}: {
  state: DrillState;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const url = `/api/pnl/vehicle-drill?section=${state.section}&plate=${encodeURIComponent(state.plate)}&vehicle_id=${encodeURIComponent(state.vehicleId)}&month=${state.month}`;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e.message || e)); setLoading(false); });
  }, [state]);

  const titleMap: Record<DrillSection, string> = {
    trips:   `Рейсы и пробег — ${state.plate} · ${state.month}`,
    fuel:    `Топливные транзакции — ${state.plate} · ${state.month}`,
    reports: `Отчёты водителя — ${state.plate} · ${state.month}`,
    costs:   `Постоянные расходы — ${state.plate} · ${state.month}`,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-xl max-w-5xl w-full mt-10 mb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">{titleMap[state.section]}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-4">
          {loading && <div className="flex items-center gap-2 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin" /> Загрузка…</div>}
          {error && <div className="text-red-400">Ошибка: {error}</div>}
          {data && <DrillBody data={data} section={state.section} plate={state.plate} />}
        </div>
      </div>
    </div>
  );
}

function DrillBody({ data, section, plate }: { data: any; section: DrillSection; plate: string }) {
  const fmt0 = (n: number | null | undefined) => n == null ? '—' : Math.round(n).toLocaleString('ru-RU');
  const fmt1 = (n: number | null | undefined) => n == null ? '—' : (Math.round(n * 10) / 10).toLocaleString('ru-RU');
  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('ru-RU') : '—';

  if (section === 'trips') {
    return (
      <>
        {/* Сводка */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Stat label="Рейсов" value={String(data.total)} />
          <Stat label="Сумма пробега" value={`${fmt0(data.total_km)} км`} />
          <Stat label="Сумма выручки" value={`${fmt0(data.total_revenue)} ₽`} />
        </div>

        {/* Data integrity warning */}
        {data.data_integrity_warning && (
          <div className="mb-4 bg-red-950/40 border border-red-700 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-200 text-sm">{data.data_integrity_warning}</p>
                <p className="text-red-300/70 text-xs mt-1">
                  Под одним vehicle_id найдены рейсы разных номеров — pnl-calculator неверно ассоциировал
                  чужие рейсы. Считай только строки с нужным номером ({plate}).
                </p>
                <div className="mt-2 text-xs">
                  {data.plates_under_id.map((p: any) => (
                    <span key={p.plate} className={`inline-block mr-2 px-2 py-0.5 rounded ${p.plate === plate ? 'bg-emerald-900/50 text-emerald-200' : 'bg-red-900/50 text-red-200'}`}>
                      {p.plate}: {p.trips} рейсов
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <table className="w-full text-xs">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>
              <th className="text-left py-2">Дата</th>
              <th className="text-left py-2">Источник</th>
              <th className="text-left py-2">Номер</th>
              <th className="text-left py-2">Маршрут</th>
              <th className="text-right py-2">Км</th>
              <th className="text-right py-2">План.км</th>
              <th className="text-right py-2">₽ выручка</th>
              <th className="text-right py-2">Качество</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t: any, i: number) => (
              <tr key={i} className={`border-b border-slate-800/50 ${t.vehicle_plate !== plate ? 'bg-red-950/20' : ''}`}>
                <td className="py-1.5 text-slate-300">{fmtDate(t.departure)}</td>
                <td className="py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.source === 'wb' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
                    {t.source}
                  </span>
                </td>
                <td className={`py-1.5 font-mono ${t.vehicle_plate !== plate ? 'text-red-300 font-semibold' : 'text-slate-200'}`}>
                  {t.vehicle_plate || '—'}
                  {t.vehicle_plate !== plate && <span className="ml-1 text-[10px] text-red-400">⚠ другой номер</span>}
                </td>
                <td className="py-1.5 text-slate-400 truncate max-w-md" title={t.route}>{t.route || '—'}</td>
                <td className="py-1.5 text-right text-slate-300 font-mono">{fmt0(t.actual_km)}</td>
                <td className="py-1.5 text-right text-slate-500 font-mono">{fmt0(t.billed_km)}</td>
                <td className="py-1.5 text-right text-emerald-300 font-mono">{fmt0(t.gross)}</td>
                <td className="py-1.5 text-right text-[10px] text-slate-500">{t.quality || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  if (section === 'fuel') {
    return (
      <>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <Stat label="Транзакций" value={String(data.total_transactions)} />
          <Stat label="Литров" value={`${fmt1(data.total_liters)} л`} />
          <Stat label="Сумма" value={`${fmt0(data.total_amount)} ₽`} />
          <Stat label="Ср. цена" value={data.avg_price_per_liter ? `${fmt1(data.avg_price_per_liter)} ₽/л` : '—'} />
        </div>

        {data.by_card?.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">По картам</h3>
            <div className="grid grid-cols-2 gap-2">
              {data.by_card.map((c: any) => (
                <div key={c.card} className="bg-slate-800/50 rounded p-2 text-xs">
                  <div className="font-mono text-slate-200">{c.card}</div>
                  <div className="text-slate-400 mt-1">{fmt1(c.liters)} л · {fmt0(c.amount)} ₽ · {c.transactions} транз.</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.by_station?.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Топ заправок</h3>
            <table className="w-full text-xs">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr><th className="text-left py-1">АЗС</th><th className="text-right py-1">Транз.</th><th className="text-right py-1">Литры</th><th className="text-right py-1">Сумма</th></tr>
              </thead>
              <tbody>
                {data.by_station.map((s: any) => (
                  <tr key={s.station} className="border-b border-slate-800/50">
                    <td className="py-1 text-slate-300 truncate max-w-md">{s.station}</td>
                    <td className="py-1 text-right text-slate-400">{s.transactions}</td>
                    <td className="py-1 text-right text-slate-300 font-mono">{fmt1(s.liters)}</td>
                    <td className="py-1 text-right text-slate-300 font-mono">{fmt0(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Все транзакции ({data.items.length})</h3>
        <table className="w-full text-xs">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>
              <th className="text-left py-1">Дата</th>
              <th className="text-left py-1">Карта</th>
              <th className="text-left py-1">АЗС</th>
              <th className="text-left py-1">Тип</th>
              <th className="text-right py-1">Литры</th>
              <th className="text-right py-1">₽/л</th>
              <th className="text-right py-1">Сумма</th>
              <th className="text-left py-1">Источник</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t: any) => (
              <tr key={t.id} className={`border-b border-slate-800/50 ${t.is_return ? 'bg-yellow-950/20' : ''}`}>
                <td className="py-1 text-slate-300">{fmtDate(t.date)}</td>
                <td className="py-1 font-mono text-slate-400">{t.card || '—'}</td>
                <td className="py-1 text-slate-400 truncate max-w-xs" title={t.station}>{t.station || '—'}</td>
                <td className="py-1 text-slate-500">{t.fuel_type || '—'}</td>
                <td className={`py-1 text-right font-mono ${t.is_return ? 'text-yellow-400' : 'text-slate-300'}`}>{fmt1(t.liters)}{t.is_return ? ' (возврат)' : ''}</td>
                <td className="py-1 text-right text-slate-500 font-mono">{t.price_per_liter ? fmt1(t.price_per_liter) : '—'}</td>
                <td className={`py-1 text-right font-mono ${t.is_return ? 'text-yellow-400' : 'text-slate-200'}`}>{fmt0(t.amount)}</td>
                <td className="py-1 text-[10px] text-slate-500">{t.source || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  if (section === 'reports') {
    return (
      <>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Stat label="Отчётов" value={String(data.total)} />
          <Stat label="Сумма ЗП" value={`${fmt0(data.total_salary)} ₽`} />
          <Stat label="Σ пробег в отчётах" value={`${fmt0(data.total_mileage_in_reports)} км`} />
        </div>
        {data.items.length === 0 && (
          <p className="text-orange-300 text-sm">За этот месяц нет отчётов водителя по этой машине. Создать через раздел «Отчёты».</p>
        )}
        <table className="w-full text-xs">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>
              <th className="text-left py-1">Период</th>
              <th className="text-left py-1">Дней</th>
              <th className="text-left py-1">Водитель</th>
              <th className="text-right py-1">Пробег</th>
              <th className="text-right py-1">ЗП</th>
              <th className="text-right py-1">Расходы</th>
              <th className="text-left py-1">Статус</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((r: any) => (
              <tr key={r.id} className="border-b border-slate-800/50">
                <td className="py-1 text-slate-300">{fmtDate(r.date_from)} → {fmtDate(r.date_to)}</td>
                <td className="py-1 text-slate-400">{r.span_days}д</td>
                <td className="py-1 text-slate-200">{r.driver || '—'}</td>
                <td className="py-1 text-right text-slate-300 font-mono">{fmt0(r.mileage)}</td>
                <td className="py-1 text-right text-emerald-300 font-mono">{fmt0(r.salary)}</td>
                <td className="py-1 text-right text-slate-400 font-mono">{fmt0(r.expenses)}</td>
                <td className="py-1 text-[10px] text-slate-500">{r.status || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  if (section === 'costs') {
    return (
      <>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Stat label="Записей" value={String(data.total)} />
          <Stat label="Итого / мес" value={`${fmt0(data.total_monthly)} ₽`} />
        </div>
        {data.items.length === 0 && (
          <p className="text-slate-400 text-sm">У этой машины нет записей в vehicle_fixed_costs за этот период.</p>
        )}
        <table className="w-full text-xs">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>
              <th className="text-left py-1">Тип</th>
              <th className="text-right py-1">₽/мес</th>
              <th className="text-right py-1">₽/год</th>
              <th className="text-left py-1">С даты</th>
              <th className="text-left py-1">До даты</th>
              <th className="text-left py-1">Заметки</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((c: any) => (
              <tr key={c.id} className="border-b border-slate-800/50">
                <td className="py-1 text-slate-300 font-medium">{c.cost_type}</td>
                <td className="py-1 text-right text-slate-200 font-mono">{fmt0(c.monthly_amount)}</td>
                <td className="py-1 text-right text-slate-500 font-mono">{c.annual_amount ? fmt0(c.annual_amount) : '—'}</td>
                <td className="py-1 text-slate-400">{fmtDate(c.start_date)}</td>
                <td className="py-1 text-slate-400">{fmtDate(c.end_date)}</td>
                <td className="py-1 text-slate-400 truncate max-w-xs">{c.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 rounded p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-base font-semibold text-slate-100 mt-0.5">{value}</div>
    </div>
  );
}

const fmtM = (n: number | null) => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toLocaleString('ru-RU');
};
const fmtN = (n: number | null) => n === null ? '—' : Math.round(n).toLocaleString('ru-RU');

interface Vehicle {
  vehicle_id: string;
  plate: string;
  type: string;
  is_active: boolean;
  status_note: string | null;
  active_days: number;
  utilization_pct: number;
  revenue: { wb_gross: number; rf_gross: number; total_gross: number };
  trips: { wb: number; rf: number; total: number };
  km: number;
  rub_per_km: number | null;
  fuel: { liters: number; rub: number; l_per_100: number | null };
  zp: { rub: number; per_km: number | null };
  costs: { leasing: number; overhead_alloc: number; repair: number; total: number };
  margin: number;
  margin_pct: number | null;
}

type SortKey = 'plate' | 'revenue' | 'km' | 'fuel_l100' | 'zp' | 'leasing' | 'margin' | 'margin_pct' | 'utilization';

export default function VehiclesV3Page() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // FIX: месяц теперь читается из URL и обновляется при изменении ?month=
  // Раньше useState(() => ...) брал searchParams ОДИН раз при mount
  // и игнорировал последующие изменения URL — переход с /pnl
  // (decision-center) с ?month=2026-03 не открывал март.
  const monthFromUrl = searchParams.get('month');
  const defaultMonth = (() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const monthKey = monthFromUrl && /^\d{4}-\d{2}$/.test(monthFromUrl) ? monthFromUrl : defaultMonth;
  const setMonthKey = useCallback((next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('month', next);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('margin');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [drill, setDrill] = useState<DrillState | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pnl/vehicles-detailed-v3?month=${monthKey}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [monthKey]);

  // Средняя ЗП по парку (для прогноза машин без отчёта)
  const avgSalary = useMemo(() => {
    const vs: Vehicle[] = data?.vehicles || [];
    const withZp = vs.filter(v => v.zp.rub > 0);
    if (withZp.length === 0) return null;
    return withZp.reduce((s, v) => s + v.zp.rub, 0) / withZp.length;
  }, [data]);

  // Сколько машин без отчёта при наличии выручки — для banner'а сверху
  const missingZpCount = useMemo(() => {
    const vs: Vehicle[] = data?.vehicles || [];
    return vs.filter(v => v.zp.rub === 0 && v.revenue.total_gross > 0).length;
  }, [data]);

  const navigateMonth = (dir: -1 | 1) => {
    const [y, m] = monthKey.split('-').map(Number);
    const nm = m + dir;
    if (nm < 1) setMonthKey(`${y - 1}-12`);
    else if (nm > 12) setMonthKey(`${y + 1}-01`);
    else setMonthKey(`${y}-${String(nm).padStart(2, '0')}`);
  };

  const types = data?.vehicles ? [...new Set(data.vehicles.map((v: Vehicle) => v.type).filter(Boolean))].sort() : [];

  const filtered: Vehicle[] = (data?.vehicles || []).filter((v: Vehicle) => {
    if (typeFilter !== 'all' && v.type !== typeFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (v.plate || '').toLowerCase().includes(s) ||
      (v.type || '').toLowerCase().includes(s)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const aV = sortValue(a, sortBy);
    const bV = sortValue(b, sortBy);
    if (aV === null && bV === null) return 0;
    if (aV === null) return 1;
    if (bV === null) return -1;
    return (aV > bV ? 1 : -1) * dir;
  });

  const setSort = (k: SortKey) => {
    if (sortBy === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(k); setSortDir('desc'); }
  };

  const downloadCsv = () => {
    if (!data) return;
    const headers = [
      'Машина','Тип','Статус','Дней','Утил%','WB-рейс','РФ-рейс',
      'WB выр(gross)','РФ выр(gross)','Итого выр',
      'Км','₽/км','Топл л','Топл ₽','Л/100',
      'ЗП ₽','ЗП/км','Лизинг','Накладные','Ремонт',
      'Расходы итого','Маржа ₽','Маржа %',
    ];
    const rows = sorted.map(v => [
      v.plate || '', v.type || '', v.status_note || '', v.active_days, v.utilization_pct,
      v.trips.wb, v.trips.rf, v.revenue.wb_gross, v.revenue.rf_gross, v.revenue.total_gross,
      v.km, v.rub_per_km ?? '', v.fuel.liters, v.fuel.rub, v.fuel.l_per_100 ?? '',
      v.zp.rub, v.zp.per_km ?? '', v.costs.leasing, v.costs.overhead_alloc, v.costs.repair,
      v.costs.total, v.margin, v.margin_pct ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicles-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center py-20">
      <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mr-2" />
      <span className="text-slate-400">Загрузка...</span>
    </div>
  );
  if (!data) return <div className="p-6 text-red-400">Ошибка</div>;

  const s = data.summary;
  const totalCosts = s.total_costs;

  return (
    <div className="p-4 max-w-[1800px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-400" /> P&L по машинам — детально
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Источники: canonical_trips_v3, vehicle_period_metrics, driver_reports, vehicle_fixed_costs, company_overhead.
            Накладные распределены равномерно: <strong>{fmtN(data.overhead_per_vehicle)} ₽</strong> на каждую активную ({data.active_vehicles}).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigateMonth(-1)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input type="month" value={monthKey} onChange={e => setMonthKey(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm" />
          <button onClick={() => navigateMonth(1)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={downloadCsv}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm flex items-center gap-1">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
          <div className="text-xs text-slate-400">Машин в таблице</div>
          <div className="text-2xl font-bold text-white">{data.count}</div>
          <div className="text-xs text-slate-500">{data.active_vehicles} с рейсами</div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-blue-500/40 p-3">
          <div className="text-xs text-slate-400">Выручка с НДС</div>
          <div className="text-2xl font-bold text-blue-400">{fmtM(s.total_revenue_gross)}</div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-orange-500/40 p-3">
          <div className="text-xs text-slate-400">Расходы</div>
          <div className="text-2xl font-bold text-orange-400">{fmtM(totalCosts)}</div>
        </div>
        <div className={`bg-slate-800 rounded-xl border p-3 ${s.total_margin >= 0 ? 'border-green-500/40' : 'border-red-500/40'}`}>
          <div className="text-xs text-slate-400">Маржа</div>
          <div className={`text-2xl font-bold ${s.total_margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {s.total_margin >= 0 ? '+' : ''}{fmtM(s.total_margin)}
          </div>
          <div className="text-xs text-slate-500">
            {s.total_revenue_gross > 0 ? `${(s.total_margin / s.total_revenue_gross * 100).toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl border border-yellow-500/40 p-3">
          <div className="text-xs text-yellow-300">⚠ Не учтено</div>
          <div className="text-xs text-slate-300">Ремонт по факту 0 (заявки не закрываются)</div>
          <div className="text-xs text-slate-300 mt-1">Реальная маржа ниже на ~5-10%</div>
        </div>
      </div>

      {/* Salary missing banner */}
      {missingZpCount > 0 && avgSalary && (
        <div className="bg-orange-950/30 border border-orange-700/60 rounded-lg p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-orange-200 text-sm">
              {missingZpCount} {missingZpCount === 1 ? 'машина' : 'машин'} без отчёта водителя за этот месяц
            </p>
            <p className="text-orange-300/70 text-xs mt-0.5">
              Колонка ЗП у них помечена «нет отчёта» оранжевым. Прогноз — средняя ЗП по парку (~{fmtN(avgSalary)} ₽).
              Реальная маржа этих машин ниже показанной — нужно провести отчёты через раздел «Отчёты».
            </p>
          </div>
          <a
            href="/reports"
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-orange-700 hover:bg-orange-600 border border-orange-600 rounded text-xs whitespace-nowrap text-white"
          >
            <FileText className="w-3.5 h-3.5" />
            Открыть отчёты
          </a>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск: номер машины / тип"
            className="w-full pl-8 pr-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded text-sm text-white px-2 py-1.5">
          <option value="all">Все типы</option>
          {types.map(t => <option key={String(t)} value={String(t)}>{String(t)}</option>)}
        </select>
        <div className="text-xs text-slate-400 ml-auto">Показано: {sorted.length}</div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-900 sticky top-0 text-slate-400">
            <tr>
              <Th label="Машина" sortKey="plate" cur={sortBy} dir={sortDir} onClick={setSort} />
              <th className="text-left p-2">Тип</th>
              <Th label="Утил%" sortKey="utilization" cur={sortBy} dir={sortDir} onClick={setSort} align="right" />
              <th className="text-right p-2 text-blue-300">WB рейсов</th>
              <th className="text-right p-2 text-purple-300">РФ рейсов</th>
              <Th label="Выручка с НДС" sortKey="revenue" cur={sortBy} dir={sortDir} onClick={setSort} align="right" />
              <Th label="Км" sortKey="km" cur={sortBy} dir={sortDir} onClick={setSort} align="right" />
              <th className="text-right p-2">₽/км</th>
              <th className="text-right p-2">Топл.л</th>
              <th className="text-right p-2">Топл.₽</th>
              <Th label="Л/100" sortKey="fuel_l100" cur={sortBy} dir={sortDir} onClick={setSort} align="right" />
              <Th label="ЗП" sortKey="zp" cur={sortBy} dir={sortDir} onClick={setSort} align="right" />
              <th className="text-right p-2">ЗП/км</th>
              <Th label="Лизинг" sortKey="leasing" cur={sortBy} dir={sortDir} onClick={setSort} align="right" />
              <th className="text-right p-2">Накладные</th>
              <th className="text-right p-2 text-red-300">Ремонт</th>
              <Th label="Маржа ₽" sortKey="margin" cur={sortBy} dir={sortDir} onClick={setSort} align="right" />
              <Th label="Маржа %" sortKey="margin_pct" cur={sortBy} dir={sortDir} onClick={setSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(v => {
              const zpMissing = v.zp.rub === 0 && v.revenue.total_gross > 0;
              // drill-down — открывают МОДАЛКУ прямо на странице (не редирект)
              const urlVehicle = `/vehicles/${encodeURIComponent(v.vehicle_id)}`;
              const openTrips   = () => setDrill({ section: 'trips',   plate: v.plate, vehicleId: v.vehicle_id, month: monthKey });
              const openFuel    = () => setDrill({ section: 'fuel',    plate: v.plate, vehicleId: v.vehicle_id, month: monthKey });
              const openReports = () => setDrill({ section: 'reports', plate: v.plate, vehicleId: v.vehicle_id, month: monthKey });
              const openCosts   = () => setDrill({ section: 'costs',   plate: v.plate, vehicleId: v.vehicle_id, month: monthKey });
              const aBase = 'hover:underline decoration-dotted underline-offset-2 cursor-pointer';
              return (
              <tr
                key={v.vehicle_id}
                className={`border-t border-slate-700 hover:bg-slate-700/30 ${v.status_note ? 'bg-slate-900/50' : ''} ${zpMissing ? 'border-l-2 border-l-orange-500/70' : ''}`}
              >
                <td className="p-2">
                  <a href={urlVehicle} className={`font-mono text-white ${aBase}`} title="Карточка машины (лизинг, тип, GPS, документы)">{v.plate || '—'}</a>
                  {v.status_note && (
                    <div className="text-[10px] text-yellow-400 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> {v.status_note}
                    </div>
                  )}
                </td>
                <td className="p-2 text-slate-400 text-[11px]">{v.type || '—'}</td>
                <td className="p-2 text-right text-slate-300 font-mono">
                  {v.utilization_pct > 0 ? `${v.utilization_pct}%` : '—'}
                  <div className="text-[10px] text-slate-600">{v.active_days}д</div>
                </td>
                <td className="p-2 text-right font-mono">
                  {v.trips.wb > 0
                    ? <button onClick={openTrips} className={`text-blue-300 ${aBase}`} title="Открыть список рейсов машины — посмотреть конкретные WB-путёвки">{v.trips.wb}</button>
                    : <span className="text-slate-500">—</span>}
                </td>
                <td className="p-2 text-right font-mono">
                  {v.trips.rf > 0
                    ? <button onClick={openTrips} className={`text-purple-300 ${aBase}`} title="Открыть список рейсов машины — посмотреть конкретные РФ-договоры">{v.trips.rf}</button>
                    : <span className="text-slate-500">—</span>}
                </td>
                <td className="p-2 text-right">
                  {v.revenue.total_gross > 0 ? (
                    <>
                      <button onClick={openTrips} className={`text-white font-mono ${aBase}`} title="Список рейсов с разбивкой по WB/РФ — источник выручки">{fmtN(v.revenue.total_gross)}</button>
                      <div className="text-[10px] text-slate-500">
                        {v.revenue.wb_gross > 0 && <span>WB:{fmtM(v.revenue.wb_gross)}</span>}
                        {v.revenue.rf_gross > 0 && <> РФ:{fmtM(v.revenue.rf_gross)}</>}
                      </div>
                    </>
                  ) : <span className="text-slate-500">—</span>}
                </td>
                <td className="p-2 text-right font-mono">
                  {v.km > 0
                    ? <button onClick={openTrips} className={`text-slate-300 ${aBase}`} title="Пробег по рейсам — открыть список с км по каждому">{fmtN(v.km)}</button>
                    : <span className="text-slate-500">—</span>}
                </td>
                <td className="p-2 text-right text-slate-400 font-mono">{v.rub_per_km != null ? v.rub_per_km : '—'}</td>
                <td className="p-2 text-right font-mono">
                  {v.fuel.liters > 0
                    ? <button onClick={openFuel} className={`text-slate-300 ${aBase}`} title="Список топливных транзакций — карты, АЗС, литры, цены">{fmtN(v.fuel.liters)}</button>
                    : <span className="text-slate-500">—</span>}
                </td>
                <td className="p-2 text-right font-mono">
                  {v.fuel.rub > 0
                    ? <button onClick={openFuel} className={`text-slate-400 ${aBase}`} title="Список топливных транзакций — карты, АЗС, литры, цены">{fmtN(v.fuel.rub)}</button>
                    : <span className="text-slate-500">—</span>}
                </td>
                <td className={`p-2 text-right font-mono ${
                  v.fuel.l_per_100 == null ? 'text-slate-500' :
                  v.fuel.l_per_100 > 35 ? 'text-red-400' :
                  v.fuel.l_per_100 > 25 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {v.fuel.l_per_100 != null ? v.fuel.l_per_100 : '—'}
                </td>
                <td className="p-2 text-right font-mono">
                  {v.zp.rub > 0 ? (
                    <button
                      onClick={openReports}
                      className={`text-slate-300 ${aBase}`}
                      title="Список отчётов водителя по этой машине — даты, ЗП, пробег"
                    >
                      {fmtN(v.zp.rub)}
                    </button>
                  ) : zpMissing && avgSalary ? (
                    <a
                      href={`/reports/new?vehicle=${encodeURIComponent(v.plate)}&month=${monthKey}`}
                      className="inline-flex flex-col items-end leading-tight text-orange-400 hover:text-orange-300 hover:bg-orange-950/30 rounded px-1 py-0.5"
                      title="Отчёт водителя за этот месяц не введён. ЗП = 0 в расчёте. Прогноз — средняя ЗП по парку. Нажми чтобы создать отчёт."
                    >
                      <span className="text-[11px] uppercase tracking-tight">нет отчёта</span>
                      <span className="text-[10px] text-orange-500/80">~{fmtN(avgSalary)}</span>
                    </a>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="p-2 text-right text-slate-400 font-mono">{v.zp.per_km != null ? v.zp.per_km : '—'}</td>
                <td className="p-2 text-right font-mono">
                  {v.costs.leasing > 0
                    ? <button onClick={openCosts} className={`text-orange-300 ${aBase}`} title="Список постоянных расходов: лизинг, страховка, телематика и т.д.">{fmtN(v.costs.leasing)}</button>
                    : <span className="text-slate-500">—</span>}
                </td>
                <td className="p-2 text-right text-slate-400 font-mono" title={`Распределено равномерно: ~${fmtN(data.overhead_total)} ₽ / ${data.active_vehicles} активных машин = ${fmtN(data.overhead_per_vehicle)} ₽/мес`}>
                  {v.costs.overhead_alloc > 0 ? fmtN(v.costs.overhead_alloc) : '—'}
                </td>
                <td className="p-2 text-right font-mono" title="Фактические ремонты (repair_orders с actual_total > 0, закрытые в этом месяце)">
                  {v.costs.repair > 0
                    ? <span className="text-red-400">{fmtN(v.costs.repair)}</span>
                    : <span className="text-orange-400/70 text-[10px]">нет данных</span>}
                </td>
                <td className={`p-2 text-right font-mono font-semibold ${
                  v.margin > 0 ? 'text-green-400' : v.margin < 0 ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {v.margin >= 0 ? '+' : ''}{fmtN(v.margin)}
                </td>
                <td className={`p-2 text-right font-mono ${
                  v.margin_pct == null ? 'text-slate-500' :
                  v.margin_pct > 15 ? 'text-green-400' :
                  v.margin_pct > 0 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {v.margin_pct == null ? '—' : (v.margin_pct >= 0 ? '+' : '') + v.margin_pct + '%'}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500 text-center">
        Накладные: 1М ФОТ офиса + 1М ФОТ базы + 300К запчасти-буфер + 145К аренда ремзоны + 75К аренда офиса + 50К прочие + 24К медосмотры + 20К связь + 20К коммуналка ≈ <strong>{fmtN(data.overhead_total)}</strong> в месяц
      </div>

      {/* Drill-down модалка — открывается при клике на цифру в таблице */}
      {drill && <DrillModal state={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

function Th({ label, sortKey, cur, dir, onClick, align }: {
  label: string; sortKey: SortKey; cur: SortKey; dir: 'asc' | 'desc';
  onClick: (k: SortKey) => void; align?: 'left' | 'right';
}) {
  const active = cur === sortKey;
  return (
    <th className={`p-2 text-${align || 'left'} cursor-pointer hover:text-white select-none`}
      onClick={() => onClick(sortKey)}>
      <span className={active ? 'text-white' : ''}>
        {label}
        {active && (dir === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-0.5" /> : <ArrowDown className="w-3 h-3 inline ml-0.5" />)}
      </span>
    </th>
  );
}

function sortValue(v: Vehicle, k: SortKey): any {
  switch (k) {
    case 'plate': return v.plate || '';
    case 'revenue': return v.revenue.total_gross;
    case 'km': return v.km;
    case 'fuel_l100': return v.fuel.l_per_100;
    case 'zp': return v.zp.rub;
    case 'leasing': return v.costs.leasing;
    case 'margin': return v.margin;
    case 'margin_pct': return v.margin_pct;
    case 'utilization': return v.utilization_pct;
  }
}
