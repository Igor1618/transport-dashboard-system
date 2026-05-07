'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

type Totals = {
  invoices: number;
  sum_invoiced: string;
  sum_paid: string;
  sum_owed: string;
  open_count: number;
  overdue_count: number;
  sum_overdue: string;
};

type ByOrg = {
  org_uuid: string;
  org_name: string;
  invoices: number;
  sum_invoiced: string;
  sum_paid: string;
  sum_owed: string;
  sum_overdue: string;
};

type Debtor = {
  contractor_uuid_1c: string;
  contractor_name: string;
  inn: string | null;
  open_invoices: number;
  sum_owed: string;
  sum_overdue: string;
  earliest_due: string | null;
  max_days_overdue: number | null;
};

type Bucket = {
  bucket: 'gt_90d' | '30_90d' | 'lt_30d' | 'no_due_date' | 'soon' | 'future';
  invoices: number;
  sum_owed: string;
};

type CashflowWeek = {
  week_start: string;
  payments?: number;
  invoices?: number;
  sum_received?: string;
  sum_expected?: string;
};

const BUCKET_LABEL: Record<Bucket['bucket'], string> = {
  gt_90d: 'Просрочено > 90 дней',
  '30_90d': 'Просрочено 30-90 дней',
  lt_30d: 'Просрочено < 30 дней',
  no_due_date: 'Без срока оплаты',
  soon: 'К оплате в ближ. 14 дней',
  future: 'К оплате позже',
};

const BUCKET_COLOR: Record<Bucket['bucket'], string> = {
  gt_90d: 'bg-red-900/30 border-red-700 text-red-200',
  '30_90d': 'bg-orange-900/30 border-orange-700 text-orange-200',
  lt_30d: 'bg-amber-900/30 border-amber-700 text-amber-200',
  no_due_date: 'bg-slate-800/50 border-slate-600 text-slate-300',
  soon: 'bg-blue-900/30 border-blue-700 text-blue-200',
  future: 'bg-slate-800/50 border-slate-600 text-slate-300',
};

const fmtMoney = (n: string | number) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!isFinite(num)) return '—';
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
};

const fmtMln = (n: string | number) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!isFinite(num)) return '—';
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + ' млн ₽';
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(0) + ' тыс ₽';
  return num.toFixed(0) + ' ₽';
};

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export default function FinancePage() {
  const [overview, setOverview] = useState<{ totals: Totals; by_organization: ByOrg[] } | null>(null);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [cashflow, setCashflow] = useState<{ received_weekly: CashflowWeek[]; expected_weekly: CashflowWeek[] }>({ received_weekly: [], expected_weekly: [] });
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const orgQS = orgFilter ? `?org=${orgFilter}` : '';
        const [ovr, deb, ovd, cf] = await Promise.all([
          fetch(`/api/finance/overview`).then(r => r.json()),
          fetch(`/api/finance/debtors${orgQS}`).then(r => r.json()),
          fetch(`/api/finance/overdue${orgQS}`).then(r => r.json()),
          fetch(`/api/finance/cashflow?weeks=12${orgFilter ? `&org=${orgFilter}` : ''}`).then(r => r.json()),
        ]);
        if (cancelled) return;
        if (ovr.error) throw new Error(ovr.error);
        setOverview(ovr);
        setDebtors(deb.debtors || []);
        setBuckets(ovd.buckets || []);
        setCashflow(cf);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgFilter]);

  const t = overview?.totals;
  const orgs = useMemo(() => overview?.by_organization || [], [overview]);

  const totalOwed = useMemo(() => {
    if (!orgFilter) return t ? Number(t.sum_owed) : 0;
    const o = orgs.find(o => o.org_uuid === orgFilter);
    return o ? Number(o.sum_owed) : 0;
  }, [orgFilter, orgs, t]);

  const totalOverdue = useMemo(() => {
    if (!orgFilter) return t ? Number(t.sum_overdue) : 0;
    const o = orgs.find(o => o.org_uuid === orgFilter);
    return o ? Number(o.sum_overdue) : 0;
  }, [orgFilter, orgs, t]);

  if (loading && !overview) {
    return <div className="p-8 text-slate-300">Загрузка...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/30 border border-red-700 rounded p-4 text-red-200">
          Ошибка: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Где деньги</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Дебиторка / поступления / просрочка из 1С (auto-sync каждые 10 мин)
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); setOrgFilter(orgFilter); }}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-200 text-sm"
        >
          Обновить
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setOrgFilter(null)}
          className={`px-3 py-1.5 rounded text-sm border ${
            orgFilter === null
              ? 'bg-blue-700 border-blue-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Все юрлица
        </button>
        {orgs.map(o => (
          <button
            key={o.org_uuid}
            onClick={() => setOrgFilter(o.org_uuid)}
            className={`px-3 py-1.5 rounded text-sm border ${
              orgFilter === o.org_uuid
                ? 'bg-blue-700 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {o.org_name?.replace(/^(ООО|ИП)\s+"?/, '$1 ')?.replace(/"/g, '')}
            <span className="ml-2 text-xs opacity-70">{fmtMln(o.sum_owed)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Должны нам"
          value={fmtMoney(totalOwed)}
          subtitle={t ? `${t.open_count} открытых счетов` : ''}
          color={totalOwed > 1e7 ? 'red' : totalOwed > 1e6 ? 'amber' : 'emerald'}
        />
        <MetricCard
          title="Просрочено"
          value={fmtMoney(totalOverdue)}
          subtitle={t ? `${t.overdue_count} счетов` : ''}
          color="red"
        />
        <MetricCard
          title="Получено всего"
          value={fmtMoney(t?.sum_paid || 0)}
          subtitle="за всё время"
          color="emerald"
        />
        <MetricCard
          title="Выставлено всего"
          value={fmtMoney(t?.sum_invoiced || 0)}
          subtitle={t ? `${t.invoices} счетов` : ''}
          color="blue"
        />
      </div>

      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">Просрочка по срокам</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {buckets.map(b => (
            <div key={b.bucket} className={`p-4 rounded border ${BUCKET_COLOR[b.bucket]}`}>
              <div className="text-xs uppercase opacity-70">{BUCKET_LABEL[b.bucket]}</div>
              <div className="text-2xl font-semibold mt-1">{fmtMln(b.sum_owed)}</div>
              <div className="text-xs opacity-70 mt-0.5">{b.invoices} счетов</div>
            </div>
          ))}
          {buckets.length === 0 && (
            <div className="col-span-full text-slate-500 text-sm">Нет данных</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">Топ должников</h2>
        <div className="bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Контрагент</th>
                <th className="text-left px-4 py-2">ИНН</th>
                <th className="text-right px-4 py-2">Счетов</th>
                <th className="text-right px-4 py-2">Долг</th>
                <th className="text-right px-4 py-2">Просрочено</th>
                <th className="text-right px-4 py-2">Дней просрочки</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d, i) => (
                <tr key={d.contractor_uuid_1c || i} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-4 py-2 text-slate-200">
                    {d.contractor_uuid_1c ? (
                      <Link href={`/finance/contractors/${d.contractor_uuid_1c}`} className="text-blue-400 hover:underline">
                        {d.contractor_name || '—'}
                      </Link>
                    ) : (
                      d.contractor_name || '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-400">{d.inn || '—'}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{d.open_invoices}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-100">{fmtMoney(d.sum_owed)}</td>
                  <td className="px-4 py-2 text-right text-red-300">
                    {Number(d.sum_overdue) > 0 ? fmtMoney(d.sum_overdue) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-400">
                    {d.max_days_overdue ? `${d.max_days_overdue} д` : '—'}
                  </td>
                </tr>
              ))}
              {debtors.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Должников нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">Поступления и ожидания (12 недель)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CashflowTable
            title="Получено факт"
            color="emerald"
            rows={cashflow.received_weekly}
            valueKey="sum_received"
            countKey="payments"
            countLabel="платежей"
          />
          <CashflowTable
            title="Ожидается (по due_date)"
            color="blue"
            rows={cashflow.expected_weekly}
            valueKey="sum_expected"
            countKey="invoices"
            countLabel="счетов"
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  title, value, subtitle, color,
}: { title: string; value: string; subtitle: string; color: 'red' | 'amber' | 'emerald' | 'blue' }) {
  const colors = {
    red: 'bg-red-900/20 border-red-700/50',
    amber: 'bg-amber-900/20 border-amber-700/50',
    emerald: 'bg-emerald-900/20 border-emerald-700/50',
    blue: 'bg-blue-900/20 border-blue-700/50',
  };
  return (
    <div className={`p-5 rounded border ${colors[color]}`}>
      <div className="text-xs uppercase tracking-wide text-slate-400">{title}</div>
      <div className="text-2xl font-semibold text-slate-100 mt-1.5">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
    </div>
  );
}

function CashflowTable({
  title, color, rows, valueKey, countKey, countLabel,
}: {
  title: string;
  color: 'emerald' | 'blue';
  rows: CashflowWeek[];
  valueKey: 'sum_received' | 'sum_expected';
  countKey: 'payments' | 'invoices';
  countLabel: string;
}) {
  const max = Math.max(1, ...rows.map(r => parseFloat(String(r[valueKey] || 0))));
  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded p-4">
      <h3 className={`text-sm font-medium mb-3 ${color === 'emerald' ? 'text-emerald-300' : 'text-blue-300'}`}>
        {title}
      </h3>
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const v = parseFloat(String(r[valueKey] || 0));
          const w = (v / max) * 100;
          return (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div className="text-slate-400 w-20 text-xs">{fmtDate(r.week_start)}</div>
              <div className="flex-1 bg-slate-800 rounded h-5 relative overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${color === 'emerald' ? 'bg-emerald-700/60' : 'bg-blue-700/60'}`}
                  style={{ width: `${w}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-end pr-2 text-xs text-slate-200">
                  {fmtMln(v)}
                </div>
              </div>
              <div className="text-slate-500 text-xs w-16 text-right">{r[countKey]} {countLabel}</div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="text-slate-500 text-xs">Нет данных</div>}
      </div>
    </div>
  );
}
