'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Row = {
  contractor_uuid_1c: string;
  contractor_name: string;
  inn: string | null;
  invoices_24m: number;
  turnover_24m: string;
  paid_24m: string;
  median_days: number | null;
  p90_days: number | null;
  on_time_pct: number | null;
  bad_debt_count: number;
  open_amount: string;
  open_overdue: string;
  open_dead: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | '?';
};

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-emerald-700/40 text-emerald-200 border-emerald-700',
  B: 'bg-blue-700/40 text-blue-200 border-blue-700',
  C: 'bg-amber-700/40 text-amber-200 border-amber-700',
  D: 'bg-orange-700/40 text-orange-200 border-orange-700',
  F: 'bg-red-700/40 text-red-200 border-red-700',
  '?': 'bg-slate-700/40 text-slate-300 border-slate-700',
};

const GRADE_RECOMMEND: Record<string, string> = {
  A: 'работать без оглядки',
  B: 'контролировать срок',
  C: 'после оплаты предыдущих',
  D: 'предоплата / лимит',
  F: 'стоп · юристам',
  '?': 'мало истории',
};

const fmtMoney = (n: string | number) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!isFinite(num)) return '—';
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
};

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'turnover' | 'risk' | 'overdue'>('turnover');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/contractors?sort=${sort}&limit=200`)
      .then(r => r.json())
      .then(d => setRows(d.contractors || []))
      .finally(() => setLoading(false));
  }, [sort]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/finance" className="text-blue-400 hover:underline text-sm">← Где деньги</Link>
        <h1 className="text-3xl font-semibold text-slate-100 mt-2">Рейтинг клиентов</h1>
        <p className="text-slate-400 mt-1 text-sm">
          A/B/C/D/F по скорости оплаты · оборот, медиана, p90, on-time, открытые долги
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { k: 'turnover', label: 'По обороту' },
          { k: 'risk',     label: 'По риску (медленные)' },
          { k: 'overdue',  label: 'По текущей просрочке' },
        ].map(o => (
          <button
            key={o.k}
            onClick={() => setSort(o.k as typeof sort)}
            className={`px-3 py-1.5 rounded text-sm border ${
              sort === o.k
                ? 'bg-blue-700 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400">Загрузка...</div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Рейтинг</th>
                <th className="text-left px-3 py-2">Клиент</th>
                <th className="text-left px-3 py-2">ИНН</th>
                <th className="text-right px-3 py-2">Оборот 24 мес</th>
                <th className="text-right px-3 py-2">Счетов</th>
                <th className="text-right px-3 py-2">Медиана</th>
                <th className="text-right px-3 py-2">p90</th>
                <th className="text-right px-3 py-2">On-time</th>
                <th className="text-right px-3 py-2">Открытый долг</th>
                <th className="text-right px-3 py-2">Просрочка</th>
                <th className="text-right px-3 py-2">&gt;90 дн</th>
                <th className="text-left px-3 py-2">Что делать</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.contractor_uuid_1c} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs border font-semibold ${GRADE_COLOR[r.grade]}`}>{r.grade}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-200 max-w-xs truncate" title={r.contractor_name}>
                    <Link href={`/finance/contractors/${r.contractor_uuid_1c}`} className="text-blue-400 hover:underline">
                      {r.contractor_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-500 font-mono text-xs">{r.inn || '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{fmtMoney(r.turnover_24m)}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{r.invoices_24m}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{r.median_days != null ? `${r.median_days} д` : '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{r.p90_days != null ? `${r.p90_days} д` : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {r.on_time_pct != null ? (
                      <span className={r.on_time_pct >= 70 ? 'text-emerald-300' : r.on_time_pct >= 30 ? 'text-amber-300' : 'text-red-300'}>
                        {r.on_time_pct}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-200 font-semibold">{fmtMoney(r.open_amount)}</td>
                  <td className="px-3 py-2 text-right text-orange-300">{parseFloat(r.open_overdue) > 0 ? fmtMoney(r.open_overdue) : '—'}</td>
                  <td className="px-3 py-2 text-right text-red-300">{parseFloat(r.open_dead) > 0 ? fmtMoney(r.open_dead) : '—'}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{GRADE_RECOMMEND[r.grade]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
