'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type InboundSummary = {
  open_invoices: number;
  total_open: string;
  expected_7d: string;
  expected_14d: string;
  expected_30d: string;
};

type InboundItem = {
  invoice_uuid_1c: string;
  invoice_number: string;
  contractor_uuid_1c: string;
  contractor_name: string;
  organization_name: string | null;
  unpaid_amount: string;
  due_date: string | null;
  age_days: number;
  debt_class: string;
  prob_7d: string;
  prob_14d: string;
  prob_30d: string;
  expected_date_base: string;
};

type DailyInbound = { day: string; invoices: number; amount_gross: string; amount_expected: string; amount_clean: string };
type DailyOutbound = { day: string; category: string; amount: string };
type OutboundCat = { category: string; items: number; total: string };

type Cashflow = {
  inbound: { summary: InboundSummary; top: InboundItem[]; daily: DailyInbound[] };
  outbound: { summary: OutboundCat[]; daily: DailyOutbound[] };
  concentration: { rvb_open: string | null; total_open: string; rvb_expected_30d: string | null; total_expected_30d: string };
};

const fmtMoney = (n: string | number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (typeof num !== 'number' || !isFinite(num)) return '—';
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
};

const fmtMln = (n: string | number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (typeof num !== 'number' || !isFinite(num) || num === 0) return '—';
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + ' млн';
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(0) + ' тыс';
  return num.toFixed(0) + ' ₽';
};

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

const fmtPct = (s: string | null) => {
  if (s === null) return '—';
  const num = parseFloat(s);
  return Math.round(num * 100) + '%';
};

const CAT_LABEL: Record<string, string> = {
  salary: 'Зарплата',
  fuel: 'Топливо',
  leasing: 'Лизинг',
  tax: 'Налоги',
};

const CAT_COLOR: Record<string, string> = {
  salary: 'bg-purple-700/40 text-purple-200',
  fuel: 'bg-cyan-700/40 text-cyan-200',
  leasing: 'bg-yellow-700/40 text-yellow-200',
  tax: 'bg-rose-700/40 text-rose-200',
};

export default function CashflowPage() {
  const [data, setData] = useState<Cashflow | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/cashflow?days=${days}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading && !data) return <div className="p-8 text-slate-300">Загрузка...</div>;
  if (!data) return <div className="p-8 text-red-300">Нет данных</div>;

  const inb = data.inbound.summary;
  const expectedKey: 'expected_7d' | 'expected_14d' | 'expected_30d' =
    days === 7 ? 'expected_7d' : days === 14 ? 'expected_14d' : 'expected_30d';
  const inboundExpected = parseFloat(inb[expectedKey]);
  const outboundTotal = data.outbound.summary.reduce((s, c) => s + parseFloat(c.total), 0);
  const netFlow = inboundExpected - outboundTotal;

  // Объединить inbound + outbound по дням
  const dayMap: Record<string, { inb: number; out: Record<string, number> }> = {};
  for (const d of data.inbound.daily) {
    if (!dayMap[d.day]) dayMap[d.day] = { inb: 0, out: {} };
    dayMap[d.day].inb += parseFloat(d.amount_expected);
  }
  for (const d of data.outbound.daily) {
    if (!dayMap[d.day]) dayMap[d.day] = { inb: 0, out: {} };
    dayMap[d.day].out[d.category] = (dayMap[d.day].out[d.category] || 0) + parseFloat(d.amount);
  }
  const allDays = Object.keys(dayMap).sort();
  const maxAmount = Math.max(
    1e5,
    ...allDays.map(d => dayMap[d].inb),
    ...allDays.map(d => Object.values(dayMap[d].out).reduce((s, v) => s + v, 0))
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/finance" className="text-blue-400 hover:underline text-sm">← Где деньги</Link>
        <h1 className="text-3xl font-semibold text-slate-100 mt-2">Когда деньги</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Вероятностный прогноз поступлений + плановые расходы (зарплата, топливо)
        </p>
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        {[7, 14, 30, 60, 90].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded text-sm border ${
              days === d
                ? 'bg-blue-700 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {d} дней
          </button>
        ))}
      </div>

      {/* Three big numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded border bg-emerald-900/20 border-emerald-700/50">
          <div className="text-xs uppercase text-emerald-300">Ожидаем поступлений</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">{fmtMoney(inboundExpected)}</div>
          <div className="text-xs text-slate-400 mt-1">
            probability-weighted · max {fmtMln(inb.total_open)} если все заплатят
          </div>
        </div>
        <div className="p-5 rounded border bg-rose-900/20 border-rose-700/50">
          <div className="text-xs uppercase text-rose-300">Плановые расходы</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">{fmtMoney(outboundTotal)}</div>
          <div className="text-xs text-slate-400 mt-1">
            {data.outbound.summary.map(c => CAT_LABEL[c.category] || c.category).join(' + ')}
          </div>
        </div>
        <div className={`p-5 rounded border ${
          netFlow >= 0
            ? 'bg-emerald-900/30 border-emerald-700'
            : 'bg-red-900/30 border-red-700'
        }`}>
          <div className="text-xs uppercase text-slate-300">Net cash flow</div>
          <div className={`text-3xl font-semibold mt-2 ${netFlow >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
            {netFlow >= 0 ? '+' : ''}{fmtMoney(netFlow)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {netFlow >= 0 ? 'есть запас' : '⚠ кассовый разрыв'}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-3 rounded border border-slate-700 bg-slate-900/50 text-xs text-slate-400">
        <strong className="text-slate-300">Что учтено в расходах:</strong> зарплата (среднее за 3 мес × график 5/25), топливо (среднесуточный расход × дни).
        <strong className="text-slate-300"> Не учтено:</strong> налоги, лизинг (нет данных в БД), платежи перевозчикам, ремонт. Реальный отток выше.
      </div>

      {/* Daily chart */}
      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">По дням</h2>
        <div className="bg-slate-900/50 border border-slate-700 rounded p-4 space-y-1 max-h-[500px] overflow-y-auto">
          {allDays.map(day => {
            const inAmount = dayMap[day].inb;
            const outAmount = Object.values(dayMap[day].out).reduce((s, v) => s + v, 0);
            const inWidth = (inAmount / maxAmount) * 100;
            return (
              <div key={day} className="flex items-center gap-2 text-xs">
                <div className="text-slate-500 w-14">{fmtDate(day)}</div>
                <div className="flex-1 flex gap-px h-6 bg-slate-950 rounded overflow-hidden">
                  {/* Outbound (red, left side) */}
                  <div className="flex-1 flex justify-end relative">
                    {outAmount > 0 && (
                      <>
                        <div className="bg-rose-800/60" style={{ width: `${(outAmount / maxAmount) * 100}%` }} />
                        <span className="absolute right-1 top-0.5 text-rose-200 text-xs">−{fmtMln(outAmount)}</span>
                      </>
                    )}
                  </div>
                  <div className="w-px bg-slate-600" />
                  {/* Inbound (green, right side) */}
                  <div className="flex-1 flex justify-start relative">
                    {inAmount > 0 && (
                      <>
                        <div className="bg-emerald-700/60" style={{ width: `${inWidth}%` }} />
                        <span className="absolute left-1 top-0.5 text-emerald-200 text-xs">+{fmtMln(inAmount)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {allDays.length === 0 && <div className="text-slate-500 text-sm">Нет данных за период</div>}
        </div>
      </section>

      {/* Top expected payments */}
      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">Топ-20 ожидаемых поступлений</h2>
        <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Счёт</th>
                <th className="text-left px-3 py-2">Контрагент</th>
                <th className="text-left px-3 py-2">Срок</th>
                <th className="text-left px-3 py-2">Ожидание</th>
                <th className="text-right px-3 py-2">Сумма</th>
                <th className="text-right px-3 py-2">7д</th>
                <th className="text-right px-3 py-2">14д</th>
                <th className="text-right px-3 py-2">30д</th>
                <th className="text-right px-3 py-2">×P30</th>
              </tr>
            </thead>
            <tbody>
              {data.inbound.top.map(t => {
                const expected = parseFloat(t.unpaid_amount) * parseFloat(t.prob_30d);
                return (
                  <tr key={t.invoice_uuid_1c} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono text-slate-200">{t.invoice_number}</td>
                    <td className="px-3 py-2 text-slate-200 max-w-xs truncate">
                      <Link href={`/finance/contractors/${t.contractor_uuid_1c}`} className="text-blue-400 hover:underline">
                        {t.contractor_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{fmtDate(t.due_date)}</td>
                    <td className="px-3 py-2 text-slate-400">{fmtDate(t.expected_date_base)}</td>
                    <td className="px-3 py-2 text-right text-slate-200">{fmtMoney(t.unpaid_amount)}</td>
                    <td className="px-3 py-2 text-right text-emerald-300">{fmtPct(t.prob_7d)}</td>
                    <td className="px-3 py-2 text-right text-blue-300">{fmtPct(t.prob_14d)}</td>
                    <td className="px-3 py-2 text-right text-amber-300">{fmtPct(t.prob_30d)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-100">{fmtMoney(expected)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
