'use client';
import { useState, useEffect, useMemo } from 'react';

interface Driver {
  vehicle_id?: string;
  name: string;
  plate_number: string;
  vehicle_class: string | null;
  vehicle_type?: string;
  gps_km: number;
  rate_per_km: number;
  calculated_salary: number;
  working_days: number;
  no_gps?: boolean;
}

interface Rate {
  vehicle_class: string;
  rate_per_km: number;
}

interface ComparisonRow {
  name: string;
  plate_number: string;
  auto_salary: number;
  manual_salary: number;
  difference: number;
  diff_percent: number;
  status: 'ok' | 'warning' | 'alert';
}

const fmt = (n: number) => n.toLocaleString('ru-RU');

export default function SalaryGpsPage() {
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [mode, setMode] = useState<'auto' | 'comparison'>('auto');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [noGpsDrivers, setNoGpsDrivers] = useState<Driver[]>([]);
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [totals, setTotals] = useState({ total_salary: 0, total_km: 0, driver_count: 0 });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-role': typeof window !== 'undefined' ? localStorage.getItem('userRole') || '' : '',
    'x-user-id': typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '',
  };

  async function fetchAuto() {
    setLoading(true);
    try {
      const res = await fetch(`/api/salary/auto-calculate?period=${period}`, { headers });
      const data = await res.json();
      setDrivers(data.drivers || []);
      setNoGpsDrivers(data.no_gps_drivers || []);
      setTotals({ total_salary: data.total_salary || 0, total_km: data.total_km || 0, driver_count: data.driver_count || 0 });
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function fetchComparison() {
    setLoading(true);
    try {
      const res = await fetch(`/api/salary/comparison?period=${period}`, { headers });
      const data = await res.json();
      setComparison(data.drivers || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function fetchRates() {
    try {
      const res = await fetch('/api/salary/rates', { headers });
      setRates(await res.json());
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (mode === 'auto') fetchAuto();
    else fetchComparison();
    fetchRates();
  }, [period, mode]);

  async function updateRate(vc: string, newRate: number) {
    await fetch(`/api/salary/rates/${vc}`, {
      method: 'PATCH', headers, body: JSON.stringify({ rate_per_km: newRate })
    });
    fetchRates();
    if (mode === 'auto') fetchAuto();
    else fetchComparison();
  }

  const classLabel: Record<string, string> = { '20t': '20т', '5t': '5т', other: 'прочие' };
  const statusIcon: Record<string, string> = { ok: '🟢', warning: '🟡', alert: '🔴' };

  return (
    <div className="p-4 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold mb-4 dark:text-white">Зарплата по GPS пробегу</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
          className="border rounded px-3 py-2 dark:bg-gray-800 dark:text-white dark:border-gray-600" />
        
        <div className="flex rounded-lg overflow-hidden border dark:border-gray-600">
          <button onClick={() => setMode('auto')}
            className={`px-4 py-2 text-sm font-medium ${mode === 'auto' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 dark:text-gray-300'}`}>
            🛰️ GPS авто
          </button>
          <button onClick={() => setMode('comparison')}
            className={`px-4 py-2 text-sm font-medium ${mode === 'comparison' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 dark:text-gray-300'}`}>
            📊 Сравнение
          </button>
        </div>

        <button onClick={() => setShowRates(!showRates)}
          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-white text-sm">
          ⚙️ Ставки
        </button>
      </div>

      {/* Rates modal */}
      {showRates && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <h3 className="font-semibold mb-3 dark:text-white">Ставки ₽/км</h3>
          <div className="flex gap-4 flex-wrap">
            {rates.map(r => (
              <div key={r.vehicle_class} className="flex items-center gap-2">
                <span className="text-sm dark:text-gray-300">{classLabel[r.vehicle_class] || r.vehicle_class}:</span>
                <input type="number" defaultValue={r.rate_per_km} step="0.5" min="0"
                  className="w-20 border rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  onBlur={e => {
                    const v = parseFloat(e.target.value);
                    if (v > 0 && v !== r.rate_per_km) updateRate(r.vehicle_class, v);
                  }} />
                <span className="text-sm text-gray-500">₽/км</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totals */}
      {mode === 'auto' && !loading && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Водителей</div>
            <div className="text-2xl font-bold dark:text-white">{totals.driver_count}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Общий пробег</div>
            <div className="text-2xl font-bold dark:text-white">{fmt(Math.round(totals.total_km))} км</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">Итого начислено</div>
            <div className="text-2xl font-bold dark:text-white">{fmt(totals.total_salary)} ₽</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Загрузка...</div>
      ) : mode === 'auto' ? (
        <>
          {/* GPS Auto table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="text-left p-2 dark:text-gray-300">Водитель</th>
                  <th className="text-left p-2 dark:text-gray-300">Машина</th>
                  <th className="text-center p-2 dark:text-gray-300">Класс</th>
                  <th className="text-right p-2 dark:text-gray-300">GPS км</th>
                  <th className="text-center p-2 dark:text-gray-300">Раб. дни</th>
                  <th className="text-right p-2 dark:text-gray-300">₽/км</th>
                  <th className="text-right p-2 dark:text-gray-300">Начислено</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d, i) => (
                  <tr key={i} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-2 dark:text-white">{d.name}</td>
                    <td className="p-2 font-mono text-xs dark:text-gray-300">{d.plate_number}</td>
                    <td className="text-center p-2 dark:text-gray-300">{classLabel[d.vehicle_class || ''] || '—'}</td>
                    <td className="text-right p-2 font-mono dark:text-white">{fmt(d.gps_km)}</td>
                    <td className="text-center p-2 dark:text-gray-300">{d.working_days}</td>
                    <td className="text-right p-2 dark:text-gray-300">{d.rate_per_km}</td>
                    <td className="text-right p-2 font-bold dark:text-white">{fmt(d.calculated_salary)} ₽</td>
                  </tr>
                ))}
                {drivers.length > 0 && (
                  <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                    <td className="p-2 dark:text-white" colSpan={3}>Итого</td>
                    <td className="text-right p-2 dark:text-white">{fmt(Math.round(totals.total_km))}</td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="text-right p-2 dark:text-white">{fmt(totals.total_salary)} ₽</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* No GPS drivers */}
          {noGpsDrivers.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2 dark:text-white">⚠️ Нет данных GPS ({noGpsDrivers.length})</h3>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                <div className="flex flex-wrap gap-2">
                  {noGpsDrivers.map((d, i) => (
                    <span key={i} className="bg-white dark:bg-gray-700 px-3 py-1 rounded text-sm dark:text-gray-300">
                      {d.name} <span className="text-gray-400 text-xs">({d.plate_number})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Comparison table */
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="text-center p-2 w-10 dark:text-gray-300"></th>
                <th className="text-left p-2 dark:text-gray-300">Водитель</th>
                <th className="text-left p-2 dark:text-gray-300">Машина</th>
                <th className="text-right p-2 dark:text-gray-300">GPS авто</th>
                <th className="text-right p-2 dark:text-gray-300">Ручной</th>
                <th className="text-right p-2 dark:text-gray-300">Разница</th>
                <th className="text-right p-2 dark:text-gray-300">%</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((d, i) => (
                <tr key={i} className={`border-b dark:border-gray-700 ${
                  d.status === 'alert' ? 'bg-red-50 dark:bg-red-900/20' :
                  d.status === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                }`}>
                  <td className="text-center p-2">{statusIcon[d.status]}</td>
                  <td className="p-2 dark:text-white">{d.name}</td>
                  <td className="p-2 font-mono text-xs dark:text-gray-300">{d.plate_number}</td>
                  <td className="text-right p-2 dark:text-white">{fmt(d.auto_salary)} ₽</td>
                  <td className="text-right p-2 dark:text-white">{fmt(d.manual_salary)} ₽</td>
                  <td className={`text-right p-2 font-bold ${d.difference > 0 ? 'text-green-600' : d.difference < 0 ? 'text-red-600' : 'dark:text-gray-300'}`}>
                    {d.difference > 0 ? '+' : ''}{fmt(d.difference)} ₽
                  </td>
                  <td className={`text-right p-2 ${d.status === 'alert' ? 'text-red-600 font-bold' : d.status === 'warning' ? 'text-yellow-600' : 'dark:text-gray-300'}`}>
                    {d.diff_percent > 0 ? '+' : ''}{d.diff_percent}%
                  </td>
                </tr>
              ))}
              {comparison.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">Нет данных для сравнения</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
