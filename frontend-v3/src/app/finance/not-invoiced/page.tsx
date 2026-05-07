'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Trip = {
  trip_id: string;
  trip_date: string;
  unloaded_at: string | null;
  age_days: number;
  contractor_uuid_1c: string | null;
  contractor_name: string;
  contractor_inn: string | null;
  amount: string;
  route: string | null;
  contractor_median_days: number | null;
  contractor_p90_days: number | null;
  contractor_on_time_pct: number | null;
  contractor_grade: 'A' | 'B' | 'C' | 'D' | '?';
  priority_score: string;
};

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-emerald-700/40 text-emerald-200 border-emerald-700',
  B: 'bg-blue-700/40 text-blue-200 border-blue-700',
  C: 'bg-amber-700/40 text-amber-200 border-amber-700',
  D: 'bg-red-700/40 text-red-200 border-red-700',
  '?': 'bg-slate-700/40 text-slate-300 border-slate-700',
};

const fmtMoney = (n: string | number) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!isFinite(num)) return '—';
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
};

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export default function NotInvoicedPage() {
  const [items, setItems] = useState<Trip[]>([]);
  const [byContractor, setByContractor] = useState<{ contractor_name: string; trips: number; sum_amount: string; avg_age: number; contractor_on_time_pct: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'older_30' | 'A_clients'>('all');

  useEffect(() => {
    fetch('/api/finance/not-invoiced?limit=1000')
      .then(r => r.json())
      .then(d => {
        setItems(d.items || []);
        setByContractor(d.by_contractor || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-slate-300">Загрузка...</div>;

  const filtered = items.filter(t => {
    if (filter === 'older_30') return t.age_days > 30;
    if (filter === 'A_clients') return t.contractor_grade === 'A' || t.contractor_grade === 'B';
    return true;
  });

  const totalSum = filtered.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalSumAll = items.reduce((s, t) => s + parseFloat(t.amount), 0);
  const sumOlder30 = items.filter(t => t.age_days > 30).reduce((s, t) => s + parseFloat(t.amount), 0);
  const sumGoodClients = items.filter(t => t.contractor_grade === 'A' || t.contractor_grade === 'B').reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/finance" className="text-blue-400 hover:underline text-sm">← Где деньги</Link>
        <h1 className="text-3xl font-semibold text-slate-100 mt-2">К выставлению</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Рейсы выполнены, но счёт не выставлен · приоритет = сумма × возраст × качество клиента
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded border bg-slate-900/50 border-slate-700">
          <div className="text-xs uppercase text-slate-400">Всего</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{fmtMoney(totalSumAll)}</div>
          <div className="text-xs text-slate-500 mt-1">{items.length} рейсов</div>
        </div>
        <div className="p-5 rounded border bg-red-900/20 border-red-700/50">
          <div className="text-xs uppercase text-red-300">Старше 30 дней</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{fmtMoney(sumOlder30)}</div>
          <div className="text-xs text-slate-500 mt-1">{items.filter(t => t.age_days > 30).length} рейсов · уже потеря денег</div>
        </div>
        <div className="p-5 rounded border bg-emerald-900/20 border-emerald-700/50">
          <div className="text-xs uppercase text-emerald-300">A/B клиенты</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{fmtMoney(sumGoodClients)}</div>
          <div className="text-xs text-slate-500 mt-1">{items.filter(t => t.contractor_grade === 'A' || t.contractor_grade === 'B').length} рейсов · быстро оплатят</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { k: 'all', label: 'Все' },
          { k: 'older_30', label: 'Старше 30 дней' },
          { k: 'A_clients', label: 'A/B клиенты (быстрые деньги)' },
        ].map(f => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k as 'all' | 'older_30' | 'A_clients')}
            className={`px-3 py-1.5 rounded text-sm border ${
              filter === f.k
                ? 'bg-blue-700 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto text-sm text-slate-400 self-center">
          Показано: {filtered.length} рейсов на {fmtMoney(totalSum)}
        </div>
      </div>

      {/* Aggregated by contractor */}
      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">Топ-30 клиентов по объёму невыставленного</h2>
        <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Клиент</th>
                <th className="text-right px-4 py-2">Рейсов</th>
                <th className="text-right px-4 py-2">Сумма</th>
                <th className="text-right px-4 py-2">Ср. возраст</th>
                <th className="text-right px-4 py-2">On-time</th>
              </tr>
            </thead>
            <tbody>
              {byContractor.map((b, i) => {
                const otp = b.contractor_on_time_pct;
                const grade = otp == null ? '?' : otp >= 80 ? 'A' : otp >= 50 ? 'B' : otp >= 20 ? 'C' : 'D';
                return (
                  <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-4 py-2 text-slate-200">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs border mr-2 ${GRADE_COLOR[grade]}`}>{grade}</span>
                      {b.contractor_name || '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">{b.trips}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-100">{fmtMoney(b.sum_amount)}</td>
                    <td className="px-4 py-2 text-right text-slate-400">{b.avg_age} д</td>
                    <td className="px-4 py-2 text-right text-slate-400">{otp == null ? '—' : `${otp}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* All trips ordered by priority */}
      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">Очередь рейсов (по приоритету)</h2>
        <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Дата</th>
                <th className="text-right px-3 py-2">Возраст</th>
                <th className="text-left px-3 py-2">Клиент</th>
                <th className="text-left px-3 py-2">Рейтинг</th>
                <th className="text-right px-3 py-2">Сумма</th>
                <th className="text-left px-3 py-2">Маршрут</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(t => (
                <tr key={t.trip_id} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-3 py-2 text-slate-400">{fmtDate(t.trip_date)}</td>
                  <td className={`px-3 py-2 text-right ${t.age_days > 30 ? 'text-red-300 font-semibold' : 'text-slate-300'}`}>{t.age_days} д</td>
                  <td className="px-3 py-2 text-slate-200 max-w-xs truncate" title={t.contractor_name}>{t.contractor_name || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs border ${GRADE_COLOR[t.contractor_grade]}`}>
                      {t.contractor_grade}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-100">{fmtMoney(t.amount)}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs max-w-md truncate" title={t.route || ''}>{t.route || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div className="p-3 text-xs text-slate-500 text-center border-t border-slate-800">
              Показано первые 200 из {filtered.length}. Используй фильтры чтобы сузить.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
