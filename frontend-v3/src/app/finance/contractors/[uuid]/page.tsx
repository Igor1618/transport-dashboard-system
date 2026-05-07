'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

type Invoice = {
  uuid_1c: string;
  number: string;
  doc_date: string;
  due_date: string | null;
  amount: string;
  paid_amount: string;
  owed_amount: string;
  status: 'paid' | 'no_due_date' | 'overdue' | 'pending';
  days_overdue: number | null;
  organization_name: string | null;
};

type Payment = {
  uuid_1c: string;
  number: string;
  doc_date: string;
  amount: string;
  invoice_uuid_1c: string | null;
  invoice_number: string | null;
};

type ContractorData = {
  contractor: { uuid_1c: string; name: string; inn: string | null; kpp: string | null };
  summary: {
    total_invoices: number;
    total_invoiced: number;
    total_paid: number;
    total_owed: number;
  };
  invoices: Invoice[];
  payments: Payment[];
};

const STATUS_LABEL: Record<Invoice['status'], string> = {
  paid: 'Оплачен',
  no_due_date: 'Без срока',
  overdue: 'Просрочен',
  pending: 'Ждёт оплаты',
};

const STATUS_COLOR: Record<Invoice['status'], string> = {
  paid: 'bg-emerald-900/30 text-emerald-300 border-emerald-700',
  no_due_date: 'bg-slate-800 text-slate-300 border-slate-600',
  overdue: 'bg-red-900/30 text-red-300 border-red-700',
  pending: 'bg-blue-900/30 text-blue-300 border-blue-700',
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

export default function ContractorPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  const [data, setData] = useState<ContractorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'invoices' | 'payments'>('invoices');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/finance/contractors/${uuid}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uuid]);

  if (loading) return <div className="p-8 text-slate-300">Загрузка...</div>;
  if (error) return <div className="p-8 text-red-300">Ошибка: {error}</div>;
  if (!data) return <div className="p-8 text-slate-400">Контрагент не найден</div>;

  const { contractor, summary, invoices, payments } = data;

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/finance" className="text-blue-400 hover:underline text-sm">← Где деньги</Link>
        <h1 className="text-2xl font-semibold text-slate-100 mt-2">{contractor.name}</h1>
        <div className="text-slate-400 text-sm mt-1">
          ИНН: {contractor.inn || '—'} {contractor.kpp ? ` · КПП: ${contractor.kpp}` : ''}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded border bg-blue-900/20 border-blue-700/50">
          <div className="text-xs uppercase text-slate-400">Выставлено</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1.5">{fmtMoney(summary.total_invoiced)}</div>
          <div className="text-xs text-slate-500 mt-1">{summary.total_invoices} счетов</div>
        </div>
        <div className="p-5 rounded border bg-emerald-900/20 border-emerald-700/50">
          <div className="text-xs uppercase text-slate-400">Оплачено</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1.5">{fmtMoney(summary.total_paid)}</div>
        </div>
        <div className="p-5 rounded border bg-red-900/20 border-red-700/50">
          <div className="text-xs uppercase text-slate-400">Должны</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1.5">{fmtMoney(summary.total_owed)}</div>
        </div>
        <div className="p-5 rounded border bg-slate-800/40 border-slate-700/50">
          <div className="text-xs uppercase text-slate-400">% оплачено</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1.5">
            {summary.total_invoiced > 0 ? Math.round((summary.total_paid / summary.total_invoiced) * 100) : 0}%
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('invoices')}
          className={`px-4 py-1.5 rounded text-sm border ${
            tab === 'invoices'
              ? 'bg-blue-700 border-blue-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Счета ({invoices.length})
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`px-4 py-1.5 rounded text-sm border ${
            tab === 'payments'
              ? 'bg-blue-700 border-blue-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Оплаты ({payments.length})
        </button>
      </div>

      {tab === 'invoices' ? (
        <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">№</th>
                <th className="text-left px-4 py-2">Дата</th>
                <th className="text-left px-4 py-2">Срок</th>
                <th className="text-left px-4 py-2">Юрлицо</th>
                <th className="text-right px-4 py-2">Сумма</th>
                <th className="text-right px-4 py-2">Оплачено</th>
                <th className="text-right px-4 py-2">Долг</th>
                <th className="text-left px-4 py-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.uuid_1c} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-4 py-2 font-mono text-slate-200">{inv.number}</td>
                  <td className="px-4 py-2 text-slate-400">{fmtDate(inv.doc_date)}</td>
                  <td className="px-4 py-2 text-slate-400">{fmtDate(inv.due_date)}</td>
                  <td className="px-4 py-2 text-slate-300 text-xs">{inv.organization_name || '—'}</td>
                  <td className="px-4 py-2 text-right text-slate-200">{fmtMoney(inv.amount)}</td>
                  <td className="px-4 py-2 text-right text-emerald-300">{fmtMoney(inv.paid_amount)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-100">{fmtMoney(inv.owed_amount)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLOR[inv.status]}`}>
                      {STATUS_LABEL[inv.status]}
                      {inv.days_overdue ? ` (${inv.days_overdue} д)` : ''}
                    </span>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Счетов нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">№ платежа</th>
                <th className="text-left px-4 py-2">Дата</th>
                <th className="text-right px-4 py-2">Сумма</th>
                <th className="text-left px-4 py-2">Привязан к счёту</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.uuid_1c} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-4 py-2 font-mono text-slate-200">{p.number}</td>
                  <td className="px-4 py-2 text-slate-400">{fmtDate(p.doc_date)}</td>
                  <td className="px-4 py-2 text-right text-slate-200">{fmtMoney(p.amount)}</td>
                  <td className="px-4 py-2 text-slate-400 font-mono">{p.invoice_number || '—'}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Платежей нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
