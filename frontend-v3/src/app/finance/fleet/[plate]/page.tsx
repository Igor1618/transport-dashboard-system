'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

type Overview = {
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

type Trip = {
  id: string;
  trip_date: string;
  contractor: string;
  amount: string;
  route: string | null;
  payment_status: string;
  driver: string | null;
};

type Fuel = {
  day: string;
  tx: number;
  amount: string;
  liters: string;
  station_name: string;
  fuel_type: string;
};

const fmtMoney = (n: string | number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (typeof num !== 'number' || !isFinite(num)) return '—';
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
};

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export default function VehicleDetailPage({ params }: { params: Promise<{ plate: string }> }) {
  const { plate } = use(params);
  const decodedPlate = decodeURIComponent(plate);
  const [data, setData] = useState<{ overview: Overview; trips: Trip[]; fuel: Fuel[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'trips' | 'fuel'>('trips');

  useEffect(() => {
    fetch(`/api/finance/fleet/${encodeURIComponent(decodedPlate)}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .finally(() => setLoading(false));
  }, [decodedPlate]);

  if (loading) return <div className="p-8 text-slate-300">Загрузка...</div>;
  if (!data) return <div className="p-8 text-red-300">Нет данных</div>;

  const { overview, trips, fuel } = data;
  const profit = parseFloat(overview.profit);
  const revenue = parseFloat(overview.revenue);
  const fuelCost = parseFloat(overview.fuel_cost);
  const margin = overview.margin_pct ? parseFloat(overview.margin_pct) : null;

  // Топ контрагентов по выручке
  const byContractor: Record<string, { trips: number; sum: number }> = {};
  trips.forEach(t => {
    const c = t.contractor || '—';
    if (!byContractor[c]) byContractor[c] = { trips: 0, sum: 0 };
    byContractor[c].trips++;
    byContractor[c].sum += parseFloat(t.amount);
  });
  const topContractors = Object.entries(byContractor)
    .sort((a, b) => b[1].sum - a[1].sum).slice(0, 5);

  // Расход топлива на ₽ выручки
  const fuelPerRubKopecks = revenue > 0 ? Math.round((fuelCost / revenue) * 100) : null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/finance/fleet" className="text-blue-400 hover:underline text-sm">← Эффективность парка</Link>
        <h1 className="text-3xl font-semibold text-slate-100 mt-2">
          {overview.license_plate} <span className="text-base text-slate-400 font-normal">{overview.vehicle_name}</span>
        </h1>
      </div>

      {/* 4 главные метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded border bg-slate-900/50 border-slate-700">
          <div className="text-xs uppercase text-slate-400">Рейсов</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{overview.trips}</div>
          <div className="text-xs text-slate-500">{overview.clients} клиентов · {overview.drivers} водителей</div>
        </div>
        <div className="p-4 rounded border bg-emerald-900/20 border-emerald-700/50">
          <div className="text-xs uppercase text-emerald-300">Выручка</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{fmtMoney(revenue)}</div>
        </div>
        <div className="p-4 rounded border bg-rose-900/20 border-rose-700/50">
          <div className="text-xs uppercase text-rose-300">Топливо</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">−{fmtMoney(fuelCost)}</div>
          <div className="text-xs text-slate-500">{overview.fuel_liters} л</div>
        </div>
        <div className={`p-4 rounded border ${profit > 0 ? 'bg-emerald-900/30 border-emerald-700' : 'bg-rose-900/30 border-rose-700'}`}>
          <div className="text-xs uppercase text-slate-300">Прибыль</div>
          <div className={`text-2xl font-semibold mt-1 ${profit > 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
            {profit > 0 ? '+' : ''}{fmtMoney(profit)}
          </div>
          {margin !== null && <div className="text-xs text-slate-500">маржа {margin}%</div>}
        </div>
      </div>

      {/* Объяснение состояния */}
      <div className={`p-4 rounded border ${
        profit > 0 && margin && margin >= 50 ? 'border-emerald-700 bg-emerald-900/20' :
        profit > 0 ? 'border-blue-700 bg-blue-900/20' :
        revenue === 0 ? 'border-amber-700 bg-amber-900/20' :
        'border-rose-700 bg-rose-900/20'
      }`}>
        <div className="text-sm text-slate-200">
          {revenue === 0 && fuelCost > 0 ? (
            <><strong className="text-amber-300">⚠ Машина не делает рейсы, но топливо тратит.</strong> 0 рейсов в trips за месяц, но {fmtMoney(fuelCost)} топлива ({overview.fuel_liters} л). Возможные причины: рейсы не привязаны к машине, перегон/ремонт, WB-рейсы (отдельная подсистема).</>
          ) : profit > 0 && margin && margin >= 50 ? (
            <><strong className="text-emerald-300">✓ Отлично работает.</strong> {overview.trips} рейсов, маржа {margin}%, прибыль {fmtMoney(profit)}.</>
          ) : profit > 0 ? (
            <><strong className="text-blue-300">○ Работает, но маржа низкая.</strong> Выручка {fmtMoney(revenue)}, топливо съедает {overview.fuel_pct}% выручки.</>
          ) : (
            <><strong className="text-rose-300">⊗ В минусе.</strong> Выручка {fmtMoney(revenue)}, топливо {fmtMoney(fuelCost)}. Топливо выше выручки на {fmtMoney(Math.abs(profit))}.</>
          )}
        </div>
      </div>

      {/* Топ контрагентов */}
      {topContractors.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">Кто платит больше</h2>
          <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Контрагент</th>
                  <th className="text-right px-3 py-2">Рейсов</th>
                  <th className="text-right px-3 py-2">Выручка</th>
                  <th className="text-right px-3 py-2">% от машины</th>
                </tr>
              </thead>
              <tbody>
                {topContractors.map(([name, info]) => (
                  <tr key={name} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-200">{name}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{info.trips}</td>
                    <td className="px-3 py-2 text-right text-slate-100 font-semibold">{fmtMoney(info.sum)}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{Math.round((info.sum / revenue) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('trips')}
          className={`px-4 py-1.5 rounded text-sm border ${
            tab === 'trips' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Рейсы ({trips.length})
        </button>
        <button
          onClick={() => setTab('fuel')}
          className={`px-4 py-1.5 rounded text-sm border ${
            tab === 'fuel' ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Топливо ({fuel.length})
        </button>
      </div>

      {tab === 'trips' ? (
        <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Дата</th>
                <th className="text-left px-3 py-2">Клиент</th>
                <th className="text-left px-3 py-2">Маршрут</th>
                <th className="text-left px-3 py-2">Водитель</th>
                <th className="text-right px-3 py-2">Сумма</th>
                <th className="text-left px-3 py-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {trips.map(t => (
                <tr key={t.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-400">{fmtDate(t.trip_date)}</td>
                  <td className="px-3 py-2 text-slate-200 max-w-xs truncate">{t.contractor || '—'}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs max-w-md truncate">{t.route || '—'}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{t.driver || '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-200">{fmtMoney(t.amount)}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{t.payment_status}</td>
                </tr>
              ))}
              {trips.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Рейсов за период нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Дата</th>
                <th className="text-left px-3 py-2">АЗС</th>
                <th className="text-left px-3 py-2">Топливо</th>
                <th className="text-right px-3 py-2">Транзакций</th>
                <th className="text-right px-3 py-2">Литров</th>
                <th className="text-right px-3 py-2">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {fuel.map((f, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-400">{fmtDate(f.day)}</td>
                  <td className="px-3 py-2 text-slate-300 text-xs">{f.station_name}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{f.fuel_type}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{f.tx}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{f.liters}</td>
                  <td className="px-3 py-2 text-right text-rose-300">−{fmtMoney(f.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
