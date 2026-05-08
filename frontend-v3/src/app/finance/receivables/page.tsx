'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type ManualStatus = 'court' | 'received_claim' | 'claim_sent' | 'paid_manual' | 'write_off' | 'docs_sent' | 'promised' | 'contacted' | null;

type Item = {
  invoice_uuid_1c: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  amount: string;
  paid_amount: string;
  unpaid_amount: string;
  contractor_uuid_1c: string;
  contractor_name: string;
  contractor_inn: string | null;
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
  paid_manual:    { label: '✓ Оплачено (рукописн.)', color: 'text-emerald-200', bg: 'bg-emerald-900/40 border-emerald-700' },
  docs_sent:      { label: '📋 Доки отправили', color: 'text-blue-200',   bg: 'bg-blue-900/40 border-blue-700' },
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

function ReceivablesContent() {
  const sp = useSearchParams();
  const [cls, setCls] = useState<string>(sp.get('class') || 'all');
  const [statusFilter, setStatusFilter] = useState<string | null>(sp.get('status') || null);
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

  const filtered = statusFilter
    ? items.filter(i => (statusFilter === 'NONE' ? !i.manual_status : i.manual_status === statusFilter))
    : items;
  const total = filtered.reduce((s, i) => s + parseFloat(i.unpaid_amount), 0);

  // Status summary с сортировкой
  const statusOrder = ['court', 'received_claim', 'claim_sent', 'write_off', 'docs_sent', 'paid_manual', 'promised', 'contacted'];
  const sortedStatus = [...statusSummary].sort((a, b) => {
    const ai = a.manual_status ? statusOrder.indexOf(a.manual_status) : 999;
    const bi = b.manual_status ? statusOrder.indexOf(b.manual_status) : 999;
    return ai - bi;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/finance" className="text-blue-400 hover:underline text-sm">← Где деньги</Link>
        <h1 className="text-3xl font-semibold text-slate-100 mt-2">Дебиторка</h1>
        <p className="text-slate-400 mt-1 text-sm">Открытые счета · комментарии специалиста + авто-статусы из 1С</p>
      </div>

      {/* Class filter */}
      <div className="flex flex-wrap gap-2">
        {(['all','live','risky','legal','dead'] as const).map(k => (
          <button key={k} onClick={() => { setCls(k); setStatusFilter(null); }}
            className={`px-3 py-1.5 rounded text-sm border ${
              cls === k ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}>
            {CLASS_LABEL[k]}
          </button>
        ))}
      </div>

      {/* Status summary tiles — кликабельные фильтры */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <button
          onClick={() => setStatusFilter(null)}
          className={`p-2 rounded border text-left ${statusFilter === null ? 'bg-blue-700 border-blue-500' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}
        >
          <div className="text-xs text-slate-300">Все</div>
          <div className="text-sm font-semibold text-slate-100">{items.length}</div>
        </button>
        {sortedStatus.map(s => {
          const meta = s.manual_status ? STATUS_LABEL[s.manual_status] : { label: 'Без статуса', color: 'text-slate-400', bg: 'bg-slate-800/30 border-slate-700' };
          const filterKey = s.manual_status || 'NONE';
          return (
            <button
              key={filterKey}
              onClick={() => setStatusFilter(filterKey)}
              className={`p-2 rounded border text-left ${
                statusFilter === filterKey ? 'ring-2 ring-blue-400 ' + meta.bg : meta.bg + ' hover:opacity-90'
              }`}
            >
              <div className={`text-xs ${meta.color}`}>{meta.label}</div>
              <div className="text-sm font-semibold text-slate-100">
                {s.invoices} · {fmtMoney(s.sum_unpaid)}
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-sm text-slate-400">
        {loading ? 'Загрузка...' : `Найдено ${filtered.length} счетов · ${fmtMoney(total)}`}
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
            <tr>
              <th className="text-left px-2 py-2 w-6"></th>
              <th className="text-left px-3 py-2">№ счёта</th>
              <th className="text-left px-3 py-2">Дата</th>
              <th className="text-left px-3 py-2">Срок</th>
              <th className="text-left px-3 py-2">Контрагент</th>
              <th className="text-right px-3 py-2">Долг</th>
              <th className="text-left px-3 py-2">Класс</th>
              <th className="text-left px-3 py-2">Статус</th>
              <th className="text-left px-3 py-2">Коммент специалиста</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => {
              const meta = i.manual_status ? STATUS_LABEL[i.manual_status] : null;
              const isOpen = expanded === i.invoice_uuid_1c;
              return (
                <>
                <tr
                  key={i.invoice_uuid_1c}
                  onClick={() => setExpanded(isOpen ? null : i.invoice_uuid_1c)}
                  className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer"
                >
                  <td className="px-2 py-2 text-slate-500">{isOpen ? '▼' : '▶'}</td>
                  <td className="px-3 py-2 font-mono text-slate-200">{i.invoice_number}</td>
                  <td className="px-3 py-2 text-slate-400">{fmtDate(i.invoice_date)}</td>
                  <td className="px-3 py-2 text-slate-400">{fmtDate(i.due_date)}</td>
                  <td className="px-3 py-2 text-slate-200 max-w-xs truncate" title={i.contractor_name}>
                    <Link href={`/finance/contractors/${i.contractor_uuid_1c}`} className="text-blue-400 hover:underline" onClick={e => e.stopPropagation()}>
                      {i.contractor_name || '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-100">{fmtMoney(i.unpaid_amount)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs ${CLASS_COLOR[i.debt_class]}`}>{CLASS_LABEL[i.debt_class]?.split(' ')[0]}</span>
                  </td>
                  <td className="px-3 py-2">
                    {meta ? (
                      <span className={`px-2 py-0.5 rounded text-xs border ${meta.bg} ${meta.color}`}>{meta.label}</span>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300 max-w-md truncate" title={i.specialist_comment || ''}>
                    {i.specialist_comment ? i.specialist_comment.slice(0, 80) : '—'}
                  </td>
                </tr>
                {isOpen && i.specialist_comment && (
                  <tr className="bg-slate-950/50">
                    <td colSpan={9} className="px-4 py-3 border-t border-slate-800">
                      <div className="text-xs text-slate-400 uppercase mb-1">Полный комментарий специалиста</div>
                      <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{i.specialist_comment}</div>
                      {i.has_partial_payment && (
                        <div className="mt-2 text-xs text-amber-300">
                          ⚠ Частичная оплата: оплачено {fmtMoney(i.paid_amount)} из {fmtMoney(i.amount)}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-slate-500">
                        Возраст {i.age_days}д · просрочка {i.overdue_days}д · Юрлицо: {i.organization_name}
                      </div>
                    </td>
                  </tr>
                )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 rounded border border-slate-700 bg-slate-900/50 text-xs text-slate-400">
        <strong className="text-slate-300">Статус определяется автоматически</strong> из текста комментария специалиста по дебиторке (поле "Комментарий" на счёте в 1С).
        Например "СУД!" → ⚖ СУД, "ПРЕТЕНЗИЯ НАМ" → 📨 нам предъявили, "НЕ ОПЛАТЯТ, УДАЛИТЕ" → ✗ списать.
        Жми на строку чтобы развернуть полный комментарий.
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
