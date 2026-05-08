'use client';

import { useEffect, useState, useMemo } from 'react';
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
  court_amount: string;
  court_count: number;
  claim_received_amount: string;
  write_off_amount: string;
  base_grade: 'A' | 'B' | 'C' | 'D' | 'F' | '?';
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | '?';
};

type SummaryRow = { grade: string; contractors: number; turnover_24m: string; open_debt: string };

const GRADE_META: Record<string, { label: string; emoji: string; bg: string; textCol: string; recommend: string }> = {
  A: { label: 'Умничка',       emoji: '⭐⭐', bg: 'bg-emerald-700/40 border-emerald-600 text-emerald-100', textCol: 'text-emerald-300', recommend: 'работать без оглядки' },
  B: { label: 'Норм',          emoji: '⭐',   bg: 'bg-blue-700/40 border-blue-600 text-blue-100',          textCol: 'text-blue-300',    recommend: 'контролировать срок' },
  C: { label: 'Так себе',      emoji: '〜',  bg: 'bg-amber-700/40 border-amber-600 text-amber-100',        textCol: 'text-amber-300',   recommend: 'после оплаты предыдущего' },
  D: { label: 'Плохо',         emoji: '⚠',   bg: 'bg-orange-700/40 border-orange-600 text-orange-100',     textCol: 'text-orange-300',  recommend: 'предоплата / лимит' },
  F: { label: 'Полное гавно',  emoji: '🚫',  bg: 'bg-red-800/50 border-red-700 text-red-100',              textCol: 'text-red-300',     recommend: 'СТОП · юристам' },
  '?': { label: 'Мало истории', emoji: '?',  bg: 'bg-slate-700/40 border-slate-600 text-slate-200',        textCol: 'text-slate-400',   recommend: 'смотреть отдельно' },
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
  if (!isFinite(num) || num === 0) return '—';
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + ' млн';
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(0) + ' тыс';
  return num.toFixed(0) + ' ₽';
};

type SortKey = 'turnover' | 'risk' | 'overdue' | 'court' | 'open';

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('turnover');
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showOnlyOpen, setShowOnlyOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/contractors?sort=${sort}&limit=1000`)
      .then(r => r.json())
      .then(d => {
        setRows(d.contractors || []);
        setSummary(d.summary || []);
      })
      .finally(() => setLoading(false));
  }, [sort]);

  const filtered = useMemo(() => {
    let list = rows;
    if (gradeFilter) list = list.filter(r => r.grade === gradeFilter);
    if (showOnlyOpen) list = list.filter(r => parseFloat(r.open_amount) > 0);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.contractor_name || '').toLowerCase().includes(s) ||
        (r.inn || '').includes(s)
      );
    }
    return list;
  }, [rows, gradeFilter, showOnlyOpen, search]);

  const totalShown = filtered.length;
  const totalDebtShown = filtered.reduce((s, r) => s + parseFloat(r.open_amount), 0);

  const summaryMap: Record<string, SummaryRow> = {};
  summary.forEach(s => { summaryMap[s.grade] = s; });

  return (
    <div className="p-6 space-y-4">
      <div>
        <Link href="/finance" className="text-blue-400 hover:underline text-sm">← Где деньги</Link>
        <h1 className="text-3xl font-semibold text-slate-100 mt-2">Рейтинг клиентов</h1>
        <p className="text-slate-400 mt-1 text-sm">A/B/C/D/F · с учётом on-time, СУД-дел и сомнительной задолженности</p>
      </div>

      {/* Grade summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <button
          onClick={() => setGradeFilter(null)}
          className={`p-3 rounded border text-left ${gradeFilter === null ? 'bg-blue-700 border-blue-500' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}
        >
          <div className="text-xs text-slate-300">Все</div>
          <div className="text-lg font-semibold text-slate-100">{rows.length}</div>
        </button>
        {(['A','B','C','D','F','?'] as const).map(g => {
          const meta = GRADE_META[g];
          const s = summaryMap[g];
          if (!s) return null;
          return (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`p-3 rounded border text-left ${
                gradeFilter === g ? 'ring-2 ring-blue-400 ' + meta.bg : meta.bg + ' hover:opacity-90'
              }`}
            >
              <div className="text-xs flex items-center gap-1">
                <span className="text-base">{meta.emoji}</span>
                <span className={meta.textCol}>{g} — {meta.label}</span>
              </div>
              <div className="text-lg font-semibold text-slate-100 mt-1">{s.contractors}</div>
              <div className="text-[10px] opacity-70">оборот {fmtMln(s.turnover_24m)} · долг {fmtMln(s.open_debt)}</div>
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск: контрагент / ИНН"
          className="flex-1 min-w-64 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 text-sm placeholder:text-slate-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-300 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded cursor-pointer">
          <input type="checkbox" checked={showOnlyOpen} onChange={e => setShowOnlyOpen(e.target.checked)} />
          Только с открытым долгом
        </label>
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
          className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 text-sm">
          <option value="turnover">Сорт: оборот ↓</option>
          <option value="risk">Сорт: риск (медленные)</option>
          <option value="overdue">Сорт: просрочка ↓</option>
          <option value="court">Сорт: СУД-дела ↓</option>
        </select>
        <button onClick={() => { setGradeFilter(null); setSearch(''); setShowOnlyOpen(false); }}
          className="px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs hover:bg-slate-600">Сброс</button>
        <div className="text-sm text-slate-400 ml-auto">
          {loading ? 'Загрузка...' : `${totalShown} · долгов на ${fmtMoney(totalDebtShown)}`}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded overflow-x-auto">
        <table className="w-full text-sm min-w-[1300px]">
          <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
            <tr>
              <th className="text-left px-2 py-2">Класс</th>
              <th className="text-left px-2 py-2">Клиент</th>
              <th className="text-left px-2 py-2">ИНН</th>
              <th className="text-right px-2 py-2">Оборот 24м</th>
              <th className="text-right px-2 py-2">Счетов</th>
              <th className="text-right px-2 py-2">Медиана</th>
              <th className="text-right px-2 py-2">p90</th>
              <th className="text-right px-2 py-2">On-time</th>
              <th className="text-right px-2 py-2">Открыт. долг</th>
              <th className="text-right px-2 py-2">Просроч.</th>
              <th className="text-right px-2 py-2">⚖ СУД</th>
              <th className="text-left px-2 py-2">Что делать</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const meta = GRADE_META[r.grade];
              const downgraded = r.grade !== r.base_grade;
              return (
                <tr key={r.contractor_uuid_1c} className={`border-t border-slate-800 hover:bg-slate-800/40 ${
                  r.grade === 'F' ? 'bg-red-950/20' : r.grade === 'D' ? 'bg-orange-950/15' : r.grade === 'A' ? 'bg-emerald-950/10' : ''
                }`}>
                  <td className="px-2 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs border font-semibold ${meta.bg}`}>{meta.emoji} {r.grade}</span>
                    {downgraded && <span className="ml-1 text-[10px] text-red-300" title={`понижен с ${r.base_grade} из-за СУД`}>↓</span>}
                  </td>
                  <td className="px-2 py-2 text-slate-100 max-w-xs truncate" title={r.contractor_name}>
                    <Link href={`/finance/contractors/${r.contractor_uuid_1c}`} className="text-blue-400 hover:underline">{r.contractor_name}</Link>
                  </td>
                  <td className="px-2 py-2 text-slate-500 font-mono text-xs">{r.inn || '—'}</td>
                  <td className="px-2 py-2 text-right text-slate-300">{fmtMoney(r.turnover_24m)}</td>
                  <td className="px-2 py-2 text-right text-slate-400">{r.invoices_24m}</td>
                  <td className="px-2 py-2 text-right text-slate-300">{r.median_days != null ? `${r.median_days}д` : '—'}</td>
                  <td className="px-2 py-2 text-right text-slate-400">{r.p90_days != null ? `${r.p90_days}д` : '—'}</td>
                  <td className="px-2 py-2 text-right">
                    {r.on_time_pct != null ? (
                      <span className={r.on_time_pct >= 70 ? 'text-emerald-300' : r.on_time_pct >= 30 ? 'text-amber-300' : 'text-red-300'}>
                        {r.on_time_pct}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-200 font-semibold">{parseFloat(r.open_amount) > 0 ? fmtMoney(r.open_amount) : '—'}</td>
                  <td className="px-2 py-2 text-right text-orange-300">{parseFloat(r.open_overdue) > 0 ? fmtMoney(r.open_overdue) : '—'}</td>
                  <td className="px-2 py-2 text-right text-red-300">
                    {parseFloat(r.court_amount) > 0 ? (
                      <>{fmtMoney(r.court_amount)} <span className="text-xs text-slate-500">/{r.court_count}</span></>
                    ) : '—'}
                  </td>
                  <td className="px-2 py-2 text-slate-400 text-xs">{meta.recommend}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 rounded border border-slate-700 bg-slate-900/50 text-xs text-slate-400">
        <strong className="text-slate-300">Логика рейтинга:</strong> базовый класс по on-time-pct (% оплат до due_date за 24 мес).
        <span className="text-red-300"> Понижение в F</span> если СУД-дела &gt; 100к или сомнительный долг &gt;90д &gt; 300к.
        <span className="text-amber-300"> Понижение на 2 ступени</span> (A→C, B→D) если есть любое СУД-дело или write_off.
        Иконка <span className="text-red-300">↓</span> показывает что класс был понижен из-за судебной истории.
      </div>
    </div>
  );
}
