'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type ManualStatus = 'court' | 'received_claim' | 'claim_sent' | 'paid_manual' | 'write_off' | 'docs_sent' | 'promised' | 'contacted' | null;

type Item = {
  invoice_uuid_1c: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  amount: string;
  amount_vat: string | null;
  payment_terms_days: number | null;
  paid_amount: string;
  unpaid_amount: string;
  contractor_uuid_1c: string;
  contractor_name: string;
  contractor_inn: string | null;
  organization_uuid_1c: string;
  organization_name: string | null;
  age_days: number;
  overdue_days: number;
  debt_class: 'live' | 'risky' | 'legal' | 'dead';
  manual_status: ManualStatus;
  specialist_comment: string | null;
  has_partial_payment: boolean;
};

type StatusSummary = { manual_status: string | null; invoices: number; sum_unpaid: string };

const CLASS_LABEL: Record<string, string> = {
  all: 'Все открытые', alive: 'Живые ожидаемые (live + risky)', expired: 'Не считать живыми (legal + dead)',
  live: 'Живые ожидаемые', risky: 'Рискованные (0–14 дн)',
  legal: 'Юристам (14–90 дн)', dead: 'Сомнительные (>90 дн)',
};

const CLASS_COLOR: Record<string, string> = {
  live: 'text-emerald-300', risky: 'text-amber-300',
  legal: 'text-rose-300', dead: 'text-red-300',
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  court:          { label: '⚖ СУД',           color: 'text-red-200',     bg: 'bg-red-900/40 border-red-700' },
  received_claim: { label: '📨 ПРЕТЕНЗИЯ НАМ', color: 'text-orange-200',  bg: 'bg-orange-900/40 border-orange-700' },
  claim_sent:     { label: '📤 Наша претензия', color: 'text-amber-200',  bg: 'bg-amber-900/40 border-amber-700' },
  write_off:      { label: '✗ Списать',        color: 'text-rose-200',    bg: 'bg-rose-900/40 border-rose-700' },
  paid_manual:    { label: '✓ Оплачено',       color: 'text-emerald-200', bg: 'bg-emerald-900/40 border-emerald-700' },
  docs_sent:      { label: '📋 Доки',           color: 'text-blue-200',   bg: 'bg-blue-900/40 border-blue-700' },
  promised:       { label: '🤝 Обещали',        color: 'text-cyan-200',   bg: 'bg-cyan-900/40 border-cyan-700' },
  contacted:      { label: '📞 Звонили',        color: 'text-slate-200',  bg: 'bg-slate-700/40 border-slate-600' },
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

type SortKey = 'unpaid_desc' | 'unpaid_asc' | 'overdue_desc' | 'date_desc' | 'date_asc' | 'contractor';

function ReceivablesContent() {
  const sp = useSearchParams();
  const [cls, setCls] = useState<string>(sp.get('class') || 'all');
  const [statusFilter, setStatusFilter] = useState<string | null>(sp.get('status') || null);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('unpaid_desc');
  const [items, setItems] = useState<Item[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = `/api/finance/receivables?limit=500${cls !== 'all' ? `&class=${cls}` : ''}`;
    fetch(url).then(r => r.json()).then(d => {
      setItems(d.items || []);
      setStatusSummary(d.status_summary || []);
    }).finally(() => setLoading(false));
  }, [cls]);

  // Уникальные юрлица из текущей выборки для селектора
  const orgs = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(i => {
      if (i.organization_uuid_1c && i.organization_name) {
        map.set(i.organization_uuid_1c, i.organization_name);
      }
    });
    return Array.from(map.entries());
  }, [items]);

  // Фильтрация: статус + юрлицо + текстовый поиск
  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter) {
      list = list.filter(i => statusFilter === 'NONE' ? !i.manual_status : i.manual_status === statusFilter);
    }
    if (orgFilter) {
      list = list.filter(i => i.organization_uuid_1c === orgFilter);
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(i =>
        i.invoice_number.toLowerCase().includes(s) ||
        (i.contractor_name || '').toLowerCase().includes(s) ||
        (i.contractor_inn || '').includes(s) ||
        (i.specialist_comment || '').toLowerCase().includes(s)
      );
    }
    // Сортировка
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'unpaid_asc':   return parseFloat(a.unpaid_amount) - parseFloat(b.unpaid_amount);
        case 'overdue_desc': return b.overdue_days - a.overdue_days;
        case 'date_desc':    return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
        case 'date_asc':     return new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime();
        case 'contractor':   return (a.contractor_name || '').localeCompare(b.contractor_name || '');
        default:             return parseFloat(b.unpaid_amount) - parseFloat(a.unpaid_amount);
      }
    });
    return list;
  }, [items, statusFilter, orgFilter, search, sort]);

  const total = filtered.reduce((s, i) => s + parseFloat(i.unpaid_amount), 0);

  const statusOrder = ['court', 'received_claim', 'claim_sent', 'write_off', 'docs_sent', 'paid_manual', 'promised', 'contacted'];
  const sortedStatus = [...statusSummary].sort((a, b) => {
    const ai = a.manual_status ? statusOrder.indexOf(a.manual_status) : 999;
    const bi = b.manual_status ? statusOrder.indexOf(b.manual_status) : 999;
    return ai - bi;
  });

  const resetFilters = () => {
    setStatusFilter(null);
    setOrgFilter(null);
    setSearch('');
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <Link href="/finance" className="text-blue-400 hover:underline text-sm">← Где деньги</Link>
        <h1 className="text-3xl font-semibold text-slate-100 mt-2">Дебиторка</h1>
      </div>

      {/* Class filter */}
      <div className="flex flex-wrap gap-2">
        {(['all','live','risky','legal','dead'] as const).map(k => (
          <button key={k} onClick={() => { setCls(k); resetFilters(); }}
            className={`px-3 py-1.5 rounded text-sm border ${
              cls === k ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}>
            {CLASS_LABEL[k]}
          </button>
        ))}
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <button onClick={() => setStatusFilter(null)}
          className={`p-2 rounded border text-left ${statusFilter === null ? 'bg-blue-700 border-blue-500' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}>
          <div className="text-xs text-slate-300">Все</div>
          <div className="text-sm font-semibold text-slate-100">{items.length}</div>
        </button>
        {sortedStatus.map(s => {
          const meta = s.manual_status ? STATUS_LABEL[s.manual_status] : { label: 'Без статуса', color: 'text-slate-400', bg: 'bg-slate-800/30 border-slate-700' };
          const filterKey = s.manual_status || 'NONE';
          return (
            <button key={filterKey} onClick={() => setStatusFilter(filterKey)}
              className={`p-2 rounded border text-left ${statusFilter === filterKey ? 'ring-2 ring-blue-400 ' + meta.bg : meta.bg + ' hover:opacity-90'}`}>
              <div className={`text-xs ${meta.color}`}>{meta.label}</div>
              <div className="text-sm font-semibold text-slate-100">{s.invoices} · {fmtMoney(s.sum_unpaid)}</div>
            </button>
          );
        })}
      </div>

      {/* Search + Org + Sort */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск: № счёта / контрагент / ИНН / коммент"
          className="flex-1 min-w-64 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 text-sm placeholder:text-slate-500"
        />
        <select
          value={orgFilter || ''}
          onChange={e => setOrgFilter(e.target.value || null)}
          className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 text-sm"
        >
          <option value="">Все юрлица</option>
          {orgs.map(([uuid, name]) => (
            <option key={uuid} value={uuid}>{name}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 text-sm"
        >
          <option value="unpaid_desc">Сорт: долг ↓</option>
          <option value="unpaid_asc">Сорт: долг ↑</option>
          <option value="overdue_desc">Сорт: просрочка ↓</option>
          <option value="date_desc">Сорт: новые</option>
          <option value="date_asc">Сорт: старые</option>
          <option value="contractor">Сорт: контрагент</option>
        </select>
        <button onClick={resetFilters} className="px-3 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs hover:bg-slate-600">
          Сброс
        </button>
        <div className="text-sm text-slate-400 ml-auto">
          {loading ? 'Загрузка...' : `${filtered.length} из ${items.length} · ${fmtMoney(total)}`}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded overflow-x-auto">
        <table className="w-full text-sm min-w-[1400px]">
          <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
            <tr>
              <th className="text-left px-2 py-2 w-6"></th>
              <th className="text-left px-2 py-2">№ счёта</th>
              <th className="text-left px-2 py-2">Дата</th>
              <th className="text-left px-2 py-2">Срок</th>
              <th className="text-right px-2 py-2">Возраст</th>
              <th className="text-right px-2 py-2">Просроч.</th>
              <th className="text-left px-2 py-2">Контрагент</th>
              <th className="text-left px-2 py-2">ИНН</th>
              <th className="text-left px-2 py-2">Юрлицо</th>
              <th className="text-right px-2 py-2">Сумма</th>
              <th className="text-right px-2 py-2">Оплачено</th>
              <th className="text-right px-2 py-2">Долг</th>
              <th className="text-right px-2 py-2">НДС</th>
              <th className="text-left px-2 py-2">Класс</th>
              <th className="text-left px-2 py-2">Статус</th>
              <th className="text-left px-2 py-2">Коммент</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => {
              const meta = i.manual_status ? STATUS_LABEL[i.manual_status] : null;
              const isOpen = expanded === i.invoice_uuid_1c;
              return (
                <>
                <tr key={i.invoice_uuid_1c} onClick={() => setExpanded(isOpen ? null : i.invoice_uuid_1c)}
                    className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer">
                  <td className="px-2 py-2 text-slate-500">{isOpen ? '▼' : '▶'}</td>
                  <td className="px-2 py-2 font-mono text-slate-200">{i.invoice_number}</td>
                  <td className="px-2 py-2 text-slate-400">{fmtDate(i.invoice_date)}</td>
                  <td className="px-2 py-2 text-slate-400">{fmtDate(i.due_date)}</td>
                  <td className="px-2 py-2 text-right text-slate-400">{i.age_days}д</td>
                  <td className={`px-2 py-2 text-right ${i.overdue_days > 0 ? 'text-red-300' : 'text-slate-500'}`}>
                    {i.overdue_days > 0 ? `${i.overdue_days}д` : '—'}
                  </td>
                  <td className="px-2 py-2 text-slate-200 max-w-44 truncate" title={i.contractor_name}>
                    <Link href={`/finance/contractors/${i.contractor_uuid_1c}`} className="text-blue-400 hover:underline" onClick={e => e.stopPropagation()}>
                      {i.contractor_name || '—'}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-slate-500 font-mono text-xs">{i.contractor_inn || '—'}</td>
                  <td className="px-2 py-2 text-slate-400 text-xs max-w-32 truncate" title={i.organization_name || ''}>
                    {i.organization_name?.replace(/^(ООО|ИП)\s+"?/, '$1 ').replace(/"/g, '') || '—'}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-300">{fmtMoney(i.amount)}</td>
                  <td className="px-2 py-2 text-right text-emerald-400">
                    {parseFloat(i.paid_amount) > 0 ? fmtMoney(i.paid_amount) : '—'}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-slate-100">{fmtMoney(i.unpaid_amount)}</td>
                  <td className="px-2 py-2 text-right text-slate-500 text-xs">
                    {i.amount_vat && parseFloat(i.amount_vat) > 0 ? fmtMoney(i.amount_vat) : '—'}
                  </td>
                  <td className="px-2 py-2"><span className={`text-xs ${CLASS_COLOR[i.debt_class]}`}>{CLASS_LABEL[i.debt_class]?.split(' ')[0]}</span></td>
                  <td className="px-2 py-2">
                    {meta ? <span className={`px-2 py-0.5 rounded text-xs border ${meta.bg} ${meta.color}`}>{meta.label}</span> : <span className="text-xs text-slate-500">—</span>}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-300 max-w-md truncate" title={i.specialist_comment || ''}>
                    {i.specialist_comment ? i.specialist_comment.slice(0, 60) : '—'}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-slate-950/50">
                    <td colSpan={16} className="px-4 py-3 border-t border-slate-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="text-slate-400 uppercase mb-1">Комментарий специалиста</div>
                          <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {i.specialist_comment || <span className="italic text-slate-500">пусто</span>}
                          </div>
                        </div>
                        <div className="space-y-1 text-slate-400">
                          <div>Юрлицо: <span className="text-slate-200">{i.organization_name}</span></div>
                          <div>Контрагент: <span className="text-slate-200">{i.contractor_name}</span> · ИНН {i.contractor_inn}</div>
                          <div>Возраст {i.age_days}д · Просрочка {i.overdue_days}д · Срок оплаты {i.payment_terms_days || '—'}д</div>
                          <div>Сумма счёта: <span className="text-slate-200">{fmtMoney(i.amount)}</span> · НДС {fmtMoney(i.amount_vat)}</div>
                          {i.has_partial_payment && (
                            <div className="text-amber-300">Частичная оплата: {fmtMoney(i.paid_amount)} из {fmtMoney(i.amount)}</div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </>
              );
            })}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={16} className="px-4 py-8 text-center text-slate-500">Ничего не найдено по фильтрам</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-300">Загрузка...</div>}>
      <ReceivablesContent />
    </Suspense>
  );
}
