'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type InboundSummary = {
  open_invoices: number; total_open: string;
  expected_7d: string; expected_14d: string; expected_30d: string;
};

type DayDetail = {
  date: string;
  inbound: Array<{
    invoice_uuid_1c: string; invoice_number: string;
    contractor_uuid_1c: string; contractor_name: string;
    organization_name: string | null;
    unpaid_amount: string; due_date: string | null;
    age_days: number; debt_class: string;
    prob_7d: string; prob_14d: string; prob_30d: string;
    expected_date_base: string;
  }>;
  outbound: Array<{
    source_id: string; category: string;
    description: string; counterparty: string;
    amount: string; due_date: string;
  }>;
};

type DailyInbound = { day: string; invoices: number; amount_gross: string; amount_expected: string; amount_clean: string };
type DailyOutbound = { day: string; category: string; amount: string };
type OutboundCat = { category: string; items: number; total: string };

type Cashflow = {
  inbound: { summary: InboundSummary; top: DayDetail['inbound']; daily: DailyInbound[] };
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

const fmtDateLong = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' });
};

const fmtPct = (s: string | null) => {
  if (s === null) return '—';
  const num = parseFloat(s);
  return Math.round(num * 100) + '%';
};

const CAT_LABEL: Record<string, string> = {
  salary: 'Зарплата', fuel: 'Топливо', leasing: 'Лизинг', tax: 'Налоги',
};

const CLASS_LABEL: Record<string, string> = {
  live: 'живой', risky: 'риск', problem: 'проблем.', legal: 'юристам', dead: 'сомнит.',
};

function DayRow({
  date, inbAmount, outAmount, maxAmount, isWeekend, dayDetail, onToggle, isOpen,
}: {
  date: string; inbAmount: number; outAmount: number; maxAmount: number;
  isWeekend: boolean; dayDetail: DayDetail | null;
  onToggle: () => void; isOpen: boolean;
}) {
  const inWidth = (inbAmount / maxAmount) * 100;
  const outWidth = (outAmount / maxAmount) * 100;

  return (
    <>
      <div
        onClick={onToggle}
        className={`flex items-center gap-2 text-xs py-1 px-1 rounded cursor-pointer hover:bg-slate-800/50 ${isOpen ? 'bg-slate-800/30' : ''}`}
      >
        <div className="text-slate-500 w-6">{isOpen ? '▼' : '▶'}</div>
        <div className={`w-14 ${isWeekend ? 'text-amber-300' : 'text-slate-400'}`} title={isWeekend ? 'Выходной — банк не работает' : ''}>
          {fmtDate(date)}
        </div>
        <div className="flex-1 flex gap-px h-6 bg-slate-950 rounded overflow-hidden">
          <div className="flex-1 flex justify-end relative">
            {outAmount > 0 && (
              <>
                <div className="bg-rose-800/60" style={{ width: `${outWidth}%` }} />
                <span className="absolute right-1 top-0.5 text-rose-200 text-xs">−{fmtMln(outAmount)}</span>
              </>
            )}
          </div>
          <div className="w-px bg-slate-600" />
          <div className="flex-1 flex justify-start relative">
            {inbAmount > 0 && (
              <>
                <div className="bg-emerald-700/60" style={{ width: `${inWidth}%` }} />
                <span className="absolute left-1 top-0.5 text-emerald-200 text-xs">+{fmtMln(inbAmount)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="ml-8 my-2 grid grid-cols-1 lg:grid-cols-2 gap-3 border-l-2 border-slate-700 pl-3">
          {/* OUTBOUND */}
          <div>
            <div className="text-xs uppercase text-rose-300 mb-1">Расходы (планово −)</div>
            {dayDetail?.outbound?.length ? (
              <div className="bg-rose-950/30 rounded border border-rose-900/50 overflow-hidden text-xs">
                {dayDetail.outbound.map(o => (
                  <div key={o.source_id} className="flex items-center justify-between gap-2 px-2 py-1 border-b border-rose-900/30 last:border-0">
                    <div className="flex-1">
                      <div className="text-slate-200">{o.description}</div>
                      <div className="text-slate-500 text-[10px]">{CAT_LABEL[o.category]} · {o.counterparty}</div>
                    </div>
                    <div className="text-rose-200 font-semibold">−{fmtMoney(o.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-xs italic px-2">нет плановых расходов</div>
            )}
          </div>
          {/* INBOUND */}
          <div>
            <div className="text-xs uppercase text-emerald-300 mb-1">Ожидаемые поступления (+)</div>
            {!dayDetail ? (
              <div className="text-slate-500 text-xs italic px-2">загрузка...</div>
            ) : dayDetail.inbound.length ? (
              <div className="bg-emerald-950/30 rounded border border-emerald-900/50 overflow-hidden text-xs max-h-80 overflow-y-auto">
                {dayDetail.inbound.map(i => {
                  const exp = parseFloat(i.unpaid_amount) * parseFloat(i.prob_30d);
                  return (
                    <div key={i.invoice_uuid_1c} className="px-2 py-1 border-b border-emerald-900/30 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-300 text-[11px]">{i.invoice_number}</span>
                            <Link href={`/finance/contractors/${i.contractor_uuid_1c}`} className="text-blue-400 hover:underline text-xs truncate">
                              {i.contractor_name}
                            </Link>
                          </div>
                          <div className="text-slate-500 text-[10px]">
                            срок {fmtDate(i.due_date)} · {i.organization_name || '—'} · {CLASS_LABEL[i.debt_class]} · {i.age_days}д
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-slate-200">{fmtMoney(i.unpaid_amount)}</div>
                          <div className="text-emerald-300 text-[10px]">×{fmtPct(i.prob_30d)} = {fmtMoney(exp)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-slate-500 text-xs italic px-2">{isWeekend ? 'выходной — банк не работает' : 'нет ожидаемых'}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function CashflowPage() {
  const [data, setData] = useState<Cashflow | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dayCache, setDayCache] = useState<Record<string, DayDetail>>({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/cashflow?days=${days}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .finally(() => setLoading(false));
  }, [days]);

  async function toggleDay(date: string) {
    if (openDay === date) { setOpenDay(null); return; }
    setOpenDay(date);
    if (!dayCache[date]) {
      const r = await fetch(`/api/finance/cashflow/day/${date}`).then(r => r.json());
      setDayCache(c => ({ ...c, [date]: r }));
    }
  }

  if (loading && !data) return <div className="p-8 text-slate-300">Загрузка...</div>;
  if (!data) return <div className="p-8 text-red-300">Нет данных</div>;

  const inb = data.inbound.summary;
  const expectedKey: 'expected_7d' | 'expected_14d' | 'expected_30d' =
    days === 7 ? 'expected_7d' : days === 14 ? 'expected_14d' : 'expected_30d';
  const inboundExpected = parseFloat(inb[expectedKey]);
  const outboundTotal = data.outbound.summary.reduce((s, c) => s + parseFloat(c.total), 0);
  const netFlow = inboundExpected - outboundTotal;

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
          Жми на любой день — раскроется список конкретных счетов и расходов
        </p>
      </div>

      <div className="flex gap-2">
        {[7, 14, 30, 60, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded text-sm border ${days === d ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
            {d} дней
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded border bg-emerald-900/20 border-emerald-700/50">
          <div className="text-xs uppercase text-emerald-300">Ожидаем поступлений</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">{fmtMoney(inboundExpected)}</div>
          <div className="text-xs text-slate-400 mt-1">probability-weighted · max {fmtMln(inb.total_open)} если все заплатят</div>
        </div>
        <div className="p-5 rounded border bg-rose-900/20 border-rose-700/50">
          <div className="text-xs uppercase text-rose-300">Плановые расходы</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">{fmtMoney(outboundTotal)}</div>
          <div className="text-xs text-slate-400 mt-1">{data.outbound.summary.map(c => CAT_LABEL[c.category] || c.category).join(' + ')}</div>
        </div>
        <div className={`p-5 rounded border ${netFlow >= 0 ? 'bg-emerald-900/30 border-emerald-700' : 'bg-red-900/30 border-red-700'}`}>
          <div className="text-xs uppercase text-slate-300">Net cash flow</div>
          <div className={`text-3xl font-semibold mt-2 ${netFlow >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
            {netFlow >= 0 ? '+' : ''}{fmtMoney(netFlow)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{netFlow >= 0 ? 'есть запас' : '⚠ кассовый разрыв'}</div>
        </div>
      </div>

      {/* Откуда что берётся — всегда видна */}
      <div className="p-4 rounded border border-slate-700 bg-slate-900/50 text-xs text-slate-300 space-y-2">
        <div><strong className="text-slate-100">Поступления:</strong> сумма каждого открытого счёта × вероятность оплаты в указанный срок. Вероятность считается из истории контрагента (медиана и p90 дней до оплаты за 24 мес) и класса долга. Дата ожидания = max(дата счёта + медиана, due_date), сдвинутая на ближайший рабочий день (банки в выходные не работают).</div>
        <div><strong className="text-slate-100">Расходы:</strong> зарплата = средне-месячная за 3 мес ÷ 2, на 5 и 25 числа (с переносом на пн если на выходной). Топливо = среднесуточный расход по fuel_transactions за последние 30 дней.</div>
        <div className="text-slate-500"><strong>Не учтено:</strong> налоги, лизинг (нет данных в БД), платежи перевозчикам, ремонт. Реальный отток выше.</div>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">По дням <span className="text-sm text-slate-400 font-normal">(клик = детализация)</span></h2>
        <div className="bg-slate-900/50 border border-slate-700 rounded p-3 max-h-[700px] overflow-y-auto">
          {allDays.map(day => {
            const inAmount = dayMap[day].inb;
            const outAmount = Object.values(dayMap[day].out).reduce((s, v) => s + v, 0);
            const dow = new Date(day).getDay();
            const isWeekend = dow === 0 || dow === 6;
            return (
              <DayRow
                key={day}
                date={day}
                inbAmount={inAmount}
                outAmount={outAmount}
                maxAmount={maxAmount}
                isWeekend={isWeekend}
                dayDetail={dayCache[day] || null}
                onToggle={() => toggleDay(day)}
                isOpen={openDay === day}
              />
            );
          })}
          {allDays.length === 0 && <div className="text-slate-500 text-sm">Нет данных</div>}
        </div>
      </section>

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
                      <Link href={`/finance/contractors/${t.contractor_uuid_1c}`} className="text-blue-400 hover:underline">{t.contractor_name}</Link>
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
