'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ClassItem = { debt_class: string; invoices: number; sum_unpaid: string; contractors: number };
type Classes = {
  live: ClassItem; risky: ClassItem; problem: ClassItem; legal: ClassItem; dead: ClassItem;
};

type NotInvoiced = { trips: number; sum_amount: string; older_14d: number; older_30d: number };

type ByOrg = {
  org_uuid: string; org_name: string;
  live_count: number; live_sum: string;
  risky_count: number; risky_sum: string;
  problem_count: number; problem_sum: string;
  total_owed: string;
};

type Overview = { classes: Classes; not_invoiced: NotInvoiced; by_organization: ByOrg[] };

const CLASS_META: Record<string, { label: string; sub: string; color: string; bg: string }> = {
  live:    { label: 'Живые ожидаемые', sub: 'срок ещё не наступил',           color: 'text-emerald-200', bg: 'bg-emerald-900/30 border-emerald-700' },
  risky:   { label: 'Рискованные',     sub: 'просрочка 0–30 дней',            color: 'text-amber-200',   bg: 'bg-amber-900/30 border-amber-700'    },
  problem: { label: 'Проблемные',      sub: 'просрочка 30–60 дней',           color: 'text-orange-200',  bg: 'bg-orange-900/30 border-orange-700'  },
  legal:   { label: 'Юристам',         sub: 'просрочка 60–90 дней',           color: 'text-rose-200',    bg: 'bg-rose-900/30 border-rose-700'      },
  dead:    { label: 'Сомнительные',    sub: '> 90 дней без платежей',         color: 'text-red-200',     bg: 'bg-red-900/40 border-red-700'        },
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

export default function FinancePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/finance/overview')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-slate-300">Загрузка...</div>;
  if (error)   return <div className="p-8 text-red-300">Ошибка: {error}</div>;
  if (!data)   return null;

  const { classes, not_invoiced, by_organization } = data;
  const sumLive    = parseFloat(classes.live.sum_unpaid);
  const sumRisky   = parseFloat(classes.risky.sum_unpaid);
  const sumProblem = parseFloat(classes.problem.sum_unpaid);
  const sumLegal   = parseFloat(classes.legal.sum_unpaid);
  const sumDead    = parseFloat(classes.dead.sum_unpaid);
  const sumNotInvoiced = parseFloat(not_invoiced.sum_amount);

  const sumLiveMoney = sumLive + sumRisky;        // что реально ждём
  const sumNotMoney  = sumProblem + sumLegal + sumDead; // что нельзя считать живыми деньгами

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-100">Где деньги</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Cash flow control · 5 классов реальности денег · auto-sync 1С каждые 10 мин
        </p>
      </div>

      {/* Summary banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded border bg-emerald-900/20 border-emerald-700/50">
          <div className="text-xs uppercase text-emerald-300">Живые ожидаемые деньги</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">{fmtMoney(sumLiveMoney)}</div>
          <div className="text-xs text-slate-400 mt-1">live + risky · что реально ждём</div>
        </div>
        <div className="p-5 rounded border bg-orange-900/20 border-orange-700/50">
          <div className="text-xs uppercase text-orange-300">Не считать живыми</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">{fmtMoney(sumNotMoney)}</div>
          <div className="text-xs text-slate-400 mt-1">problem + legal + dead</div>
        </div>
        <Link href="/finance/not-invoiced" className="p-5 rounded border bg-blue-900/20 border-blue-700/50 hover:bg-blue-900/40 transition">
          <div className="text-xs uppercase text-blue-300">К выставлению</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">{fmtMoney(sumNotInvoiced)}</div>
          <div className="text-xs text-slate-400 mt-1">{not_invoiced.trips} рейсов выполнено, счёт не выставлен →</div>
        </Link>
      </div>

      {/* 5 classes */}
      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">Классы реальности денег</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {(['live','risky','problem','legal','dead'] as const).map(k => {
            const c = classes[k];
            const m = CLASS_META[k];
            return (
              <Link
                key={k}
                href={`/finance/receivables?class=${k}`}
                className={`p-4 rounded border ${m.bg} hover:opacity-80 transition`}
              >
                <div className={`text-xs uppercase ${m.color} opacity-80`}>{m.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{m.sub}</div>
                <div className="text-2xl font-semibold text-slate-100 mt-2">{fmtMoney(c.sum_unpaid)}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {c.invoices} {c.invoices === 1 ? 'счёт' : c.invoices < 5 ? 'счёта' : 'счетов'} ·{' '}
                  {c.contractors} {c.contractors === 1 ? 'контрагент' : 'контрагентов'}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Earned not billed warning */}
      {not_invoiced.older_30d > 0 && (
        <div className="p-4 rounded border bg-red-900/20 border-red-700">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠</div>
            <div className="flex-1">
              <div className="text-red-200 font-semibold">Срочно: {not_invoiced.older_30d} рейсов старше 30 дней без счёта</div>
              <div className="text-slate-300 text-sm mt-1">
                Выполнено, но даже не выставили счёт. Эти деньги не в дебиторке — их вообще нет в финансовом обороте.
              </div>
              <Link href="/finance/not-invoiced" className="inline-block mt-2 text-blue-400 hover:underline text-sm">
                Открыть очередь выставления →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* By organization */}
      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">По юрлицам</h2>
        <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Юрлицо</th>
                <th className="text-right px-4 py-2">Живые</th>
                <th className="text-right px-4 py-2">Рискованные</th>
                <th className="text-right px-4 py-2">Проблемные</th>
                <th className="text-right px-4 py-2">Всего открыто</th>
              </tr>
            </thead>
            <tbody>
              {by_organization.map((o, i) => (
                <tr key={o.org_uuid || i} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-4 py-2 text-slate-200">{o.org_name || '—'}</td>
                  <td className="px-4 py-2 text-right text-emerald-200">
                    {fmtMln(o.live_sum)}<span className="text-xs text-slate-500 ml-1">/{o.live_count}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-amber-200">
                    {fmtMln(o.risky_sum)}<span className="text-xs text-slate-500 ml-1">/{o.risky_count}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-red-200">
                    {fmtMln(o.problem_sum)}<span className="text-xs text-slate-500 ml-1">/{o.problem_count}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-100">{fmtMoney(o.total_owed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick links */}
      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">Действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/finance/cashflow" className="p-4 rounded border bg-emerald-900/20 border-emerald-700/50 hover:bg-emerald-900/40">
            <div className="text-slate-100 font-medium">📅 Когда деньги</div>
            <div className="text-xs text-slate-400 mt-1">Прогноз поступлений + расходы · вероятностная модель</div>
          </Link>
          <Link href="/finance/contractors" className="p-4 rounded border bg-slate-900/50 border-slate-700 hover:bg-slate-800/50">
            <div className="text-slate-100 font-medium">Рейтинг клиентов</div>
            <div className="text-xs text-slate-400 mt-1">Кому верить · кто платит вовремя</div>
          </Link>
          <Link href="/finance/receivables?class=dead" className="p-4 rounded border bg-red-900/20 border-red-700/50 hover:bg-red-900/40">
            <div className="text-slate-100 font-medium">Сомнительные &gt; 90 дней</div>
            <div className="text-xs text-slate-400 mt-1">Не ждать · юристам / списать</div>
          </Link>
          <Link href="/finance/not-invoiced" className="p-4 rounded border bg-blue-900/20 border-blue-700/50 hover:bg-blue-900/40">
            <div className="text-slate-100 font-medium">К выставлению</div>
            <div className="text-xs text-slate-400 mt-1">{not_invoiced.trips} рейсов · приоритет</div>
          </Link>
        </div>
      </section>
    </div>
  );
}
