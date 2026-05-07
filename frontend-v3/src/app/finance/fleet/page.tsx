'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Summary = {
  active_with_activity: number;
  profitable: number;
  losing: number;
  only_consuming: number;
  earning: number;
  total_revenue: string;
  total_fuel: string;
  total_salary: string;
  total_profit: string;
};

type Vehicle = {
  vehicle_id: number;
  license_plate: string;
  vehicle_name: string;
  trips: number;
  clients: number;
  drivers: number;
  revenue: string;
  fuel_cost: string;
  fuel_liters: string;
  salary_cost: string;
  profit: string;
  margin_pct: string | null;
  fuel_pct: string | null;
};

type FleetData = {
  period_start: string;
  period_end: string;
  summary: Summary;
  vehicles: Vehicle[];
};

const fmtMoney = (n: string | number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (typeof num !== 'number' || !isFinite(num)) return '—';
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
};

export default function FleetPage() {
  const [data, setData] = useState<FleetData | null>(null);
  const [filter, setFilter] = useState<'all' | 'losing' | 'consuming' | 'top'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/finance/fleet')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) return <div className="p-8 text-slate-300">Загрузка...</div>;
  if (!data) return <div className="p-8 text-red-300">Нет данных</div>;

  const { summary, vehicles, period_start, period_end } = data;

  const filtered = vehicles.filter(v => {
    const profit = parseFloat(v.profit);
    const revenue = parseFloat(v.revenue);
    const fuel = parseFloat(v.fuel_cost);
    if (filter === 'losing') return profit < 0;
    if (filter === 'consuming') return revenue === 0 && fuel > 0;
    if (filter === 'top') return profit > 0 && v.margin_pct !== null;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/finance" className="text-blue-400 hover:underline text-sm">← Где деньги</Link>
        <h1 className="text-3xl font-semibold text-slate-100 mt-2">Эффективность парка</h1>
        <p className="text-slate-400 mt-1 text-sm">
          {period_start} → {period_end} · кто зарабатывает, кто тянет, и почему
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded border bg-emerald-900/20 border-emerald-700/50">
          <div className="text-xs uppercase text-emerald-300">В плюсе</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{summary.profitable} <span className="text-sm text-slate-500">/ {summary.active_with_activity}</span></div>
          <div className="text-xs text-slate-500 mt-0.5">прибыль {fmtMoney(parseFloat(summary.total_profit))}</div>
        </div>
        <div className="p-4 rounded border bg-rose-900/20 border-rose-700/50">
          <div className="text-xs uppercase text-rose-300">В минусе</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{summary.losing}</div>
          <div className="text-xs text-slate-500 mt-0.5">расходов больше чем выручки</div>
        </div>
        <div className="p-4 rounded border bg-amber-900/20 border-amber-700/50">
          <div className="text-xs uppercase text-amber-300">Только тратят</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{summary.only_consuming}</div>
          <div className="text-xs text-slate-500 mt-0.5">0 рейсов, есть топливо ⚠</div>
        </div>
        <div className="p-4 rounded border bg-blue-900/20 border-blue-700/50">
          <div className="text-xs uppercase text-blue-300">Выручка / Расходы</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{fmtMoney(parseFloat(summary.total_revenue))}</div>
          <div className="text-xs text-slate-500 mt-0.5">−топливо {fmtMoney(parseFloat(summary.total_fuel))} (зарплата не учтена)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { k: 'all', label: 'Все' },
          { k: 'top', label: '⭐ Зарабатывают (с маржой)' },
          { k: 'losing', label: '🔴 В минусе' },
          { k: 'consuming', label: '⚠ Только тратят (0 рейсов)' },
        ].map(f => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k as typeof filter)}
            className={`px-3 py-1.5 rounded text-sm border ${
              filter === f.k
                ? 'bg-blue-700 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto text-sm text-slate-400 self-center">{filtered.length} машин</div>
      </div>

      {/* Vehicles table */}
      <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Госномер</th>
              <th className="text-left px-3 py-2">Модель</th>
              <th className="text-right px-3 py-2">Рейсов</th>
              <th className="text-right px-3 py-2">Выручка</th>
              <th className="text-right px-3 py-2">Топливо</th>
              <th className="text-right px-3 py-2">Литры</th>
              <th className="text-right px-3 py-2">Прибыль</th>
              <th className="text-right px-3 py-2">Маржа</th>
              <th className="text-right px-3 py-2">Топл/выр</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => {
              const profit = parseFloat(v.profit);
              const revenue = parseFloat(v.revenue);
              const fuel = parseFloat(v.fuel_cost);
              const isConsuming = revenue === 0 && fuel > 0;
              const isLosing = profit < 0;
              const isProfitable = profit > 0;
              const margin = v.margin_pct ? parseFloat(v.margin_pct) : null;

              return (
                <tr
                  key={v.vehicle_id}
                  className={`border-t border-slate-800 hover:bg-slate-800/40 ${
                    isConsuming ? 'bg-amber-950/20' :
                    isLosing ? 'bg-rose-950/20' :
                    margin && margin >= 50 ? 'bg-emerald-950/10' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-slate-100">
                    <Link href={`/finance/fleet/${encodeURIComponent(v.license_plate)}`} className="text-blue-400 hover:underline">
                      {v.license_plate}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-400 text-xs max-w-xs truncate">{v.vehicle_name}</td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {v.trips}{v.clients > 0 ? <span className="text-xs text-slate-500"> ({v.clients}кл)</span> : ''}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-200">{fmtMoney(v.revenue)}</td>
                  <td className="px-3 py-2 text-right text-rose-300">−{fmtMoney(v.fuel_cost)}</td>
                  <td className="px-3 py-2 text-right text-slate-500 text-xs">{v.fuel_liters} л</td>
                  <td className={`px-3 py-2 text-right font-semibold ${
                    isProfitable ? 'text-emerald-300' : isLosing ? 'text-rose-300' : 'text-slate-300'
                  }`}>
                    {profit > 0 ? '+' : ''}{fmtMoney(v.profit)}
                  </td>
                  <td className={`px-3 py-2 text-right ${
                    margin !== null && margin >= 50 ? 'text-emerald-300' :
                    margin !== null && margin >= 20 ? 'text-amber-300' :
                    margin !== null && margin < 0 ? 'text-rose-300' :
                    'text-slate-500'
                  }`}>
                    {margin !== null ? `${margin}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400 text-xs">
                    {v.fuel_pct ? `${v.fuel_pct}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 rounded border border-slate-700 bg-slate-900/50 text-xs text-slate-400">
        <strong className="text-slate-300">Что учтено:</strong> выручка из trips (контракты × рейсы) + топливо из fuel_transactions (по license_plate).
        <br />
        <strong className="text-slate-300">Что НЕ учтено пока:</strong> зарплата водителей (driver_assignments не везде заполнены), лизинг (нет данных), ремонт, страховка, штрафы.
        <br />
        <strong className="text-amber-300">Машины «только тратят»:</strong> 0 рейсов в trips но есть топливо. Возможные причины: рейсы не привязаны к машине (vehicle_id NULL), машина в перегоне/ремонте, или WB-рейсы которые не попадают в trips.
      </div>
    </div>
  );
}
