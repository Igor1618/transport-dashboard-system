'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

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
  debt_class: 'live' | 'risky' | 'problem' | 'legal' | 'dead';
  has_partial_payment: boolean;
};

const CLASS_LABEL: Record<string, string> = {
  all: 'Все открытые',
  live: 'Живые ожидаемые',
  risky: 'Рискованные (0–30 дн)',
  problem: 'Проблемные (30–60 дн)',
  legal: 'Юристам (60–90 дн)',
  dead: 'Сомнительные (>90 дн)',
};

const CLASS_COLOR: Record<string, string> = {
  live: 'text-emerald-300',
  risky: 'text-amber-300',
  problem: 'text-orange-300',
  legal: 'text-rose-300',
  dead: 'text-red-300',
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
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = `/api/finance/receivables?limit=300${cls !== 'all' ? `&class=${cls}` : ''}`;
    fetch(url).then(r => r.json()).then(d => setItems(d.items || [])).finally(() => setLoading(false));
  }, [cls]);

  const total = items.reduce((s, i) => s + parseFloat(i.unpaid_amount), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/finance" className="text-blue-400 hover:underline text-sm">← Где деньги</Link>
        <h1 className="text-3xl font-semibold text-slate-100 mt-2">Дебиторка</h1>
        <p className="text-slate-400 mt-1 text-sm">Открытые счета по классам реальности денег</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all','live','risky','problem','legal','dead'] as const).map(k => (
          <button
            key={k}
            onClick={() => setCls(k)}
            className={`px-3 py-1.5 rounded text-sm border ${
              cls === k
                ? 'bg-blue-700 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {CLASS_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="text-sm text-slate-400">
        {loading ? 'Загрузка...' : `Найдено ${items.length} счетов · ${fmtMoney(total)}`}
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">№ счёта</th>
              <th className="text-left px-3 py-2">Дата</th>
              <th className="text-left px-3 py-2">Срок</th>
              <th className="text-left px-3 py-2">Контрагент</th>
              <th className="text-left px-3 py-2">Юрлицо</th>
              <th className="text-right px-3 py-2">Сумма</th>
              <th className="text-right px-3 py-2">Долг</th>
              <th className="text-left px-3 py-2">Класс</th>
              <th className="text-right px-3 py-2">Просрочка</th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.invoice_uuid_1c} className="border-t border-slate-800 hover:bg-slate-800/40">
                <td className="px-3 py-2 font-mono text-slate-200">{i.invoice_number}</td>
                <td className="px-3 py-2 text-slate-400">{fmtDate(i.invoice_date)}</td>
                <td className="px-3 py-2 text-slate-400">{fmtDate(i.due_date)}</td>
                <td className="px-3 py-2 text-slate-200 max-w-xs truncate" title={i.contractor_name}>
                  <Link href={`/finance/contractors/${i.contractor_uuid_1c}`} className="text-blue-400 hover:underline">
                    {i.contractor_name || '—'}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-400 text-xs max-w-32 truncate">{i.organization_name || '—'}</td>
                <td className="px-3 py-2 text-right text-slate-300">{fmtMoney(i.amount)}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-100">{fmtMoney(i.unpaid_amount)}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs ${CLASS_COLOR[i.debt_class]}`}>{CLASS_LABEL[i.debt_class]?.split(' ')[0]}</span>
                  {i.has_partial_payment && <span className="ml-1 text-xs text-blue-400">·частично</span>}
                </td>
                <td className="px-3 py-2 text-right text-slate-400">
                  {i.overdue_days > 0 ? <span className="text-red-300">{i.overdue_days} д</span> : '—'}
                </td>
              </tr>
            ))}
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
