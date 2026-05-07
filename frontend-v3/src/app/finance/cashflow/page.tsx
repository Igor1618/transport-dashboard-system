'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type InboundSummary = {
  open_invoices: number; total_open: string;
  certain_7d: string | null; likely_7d: string | null; possible_7d: string | null;
  certain_14d: string | null; likely_14d: string | null; possible_14d: string | null;
  certain_30d: string | null; likely_30d: string | null; possible_30d: string | null;
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

type DailyInbound = { day: string; invoices: number; amount_total: string; amount_certain: string | null; amount_likely: string | null; amount_possible: string | null };
type DailyOutbound = { day: string; category: string; amount: string };
type OutboundCat = { category: string; items: number; total: string };

type Cashflow = {
  inbound: { summary: InboundSummary; top: DayDetail['inbound']; daily: DailyInbound[] };
  outbound: { summary: OutboundCat[]; daily: DailyOutbound[] };
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

const CONFIDENCE_LABEL = (prob: number) => {
  if (prob >= 0.80) return 'точно';
  if (prob >= 0.50) return 'скорее всего';
  if (prob >= 0.20) return 'возможно';
  return 'маловероятно';
};

const CONFIDENCE_COLOR = (prob: number) => {
  if (prob >= 0.80) return 'text-emerald-300';
  if (prob >= 0.50) return 'text-blue-300';
  if (prob >= 0.20) return 'text-amber-300';
  return 'text-rose-400';
};

const CAT_LABEL: Record<string, string> = {
  salary: 'Зарплата', fuel: 'Топливо', leasing: 'Лизинг', tax: 'Налоги',
};

const CLASS_LABEL: Record<string, string> = {
  live: 'живой', risky: 'риск', legal: 'юристам', dead: 'сомнит.',
};

function DayRow({
  date, certain, likely, possible, outAmount, maxAmount, isWeekend, dayDetail, onToggle, isOpen,
}: {
  date: string;
  certain: number; likely: number; possible: number;
  outAmount: number; maxAmount: number;
  isWeekend: boolean; dayDetail: DayDetail | null;
  onToggle: () => void; isOpen: boolean;
}) {
  const totalIn = certain + likely + possible;
  const certainW = (certain / maxAmount) * 100;
  const likelyW = (likely / maxAmount) * 100;
  const possibleW = (possible / maxAmount) * 100;
  const outW = (outAmount / maxAmount) * 100;

  return (
    <>
      <div
        onClick={onToggle}
        className={`flex items-center gap-2 text-xs py-1 px-1 rounded cursor-pointer hover:bg-slate-800/50 ${isOpen ? 'bg-slate-800/30' : ''}`}
      >
        <div className="text-slate-500 w-6">{isOpen ? '▼' : '▶'}</div>
        <div className={`w-14 ${isWeekend ? 'text-amber-300' : 'text-slate-400'}`} title={isWeekend ? 'Выходной' : ''}>
          {fmtDate(date)}
        </div>
        <div className="flex-1 flex gap-px h-6 bg-slate-950 rounded overflow-hidden">
          {/* Расходы (слева, красные) */}
          <div className="flex-1 flex justify-end relative">
            {outAmount > 0 && (
              <>
                <div className="bg-rose-800/60" style={{ width: `${outW}%` }} />
                <span className="absolute right-1 top-0.5 text-rose-200 text-xs">−{fmtMln(outAmount)}</span>
              </>
            )}
          </div>
          <div className="w-px bg-slate-600" />
          {/* Поступления — стек из 3 уверенностей */}
          <div className="flex-1 flex relative">
            {certain > 0 && <div className="bg-emerald-700/80" style={{ width: `${certainW}%` }} title="точно" />}
            {likely > 0 && <div className="bg-blue-600/70" style={{ width: `${likelyW}%` }} title="скорее всего" />}
            {possible > 0 && <div className="bg-amber-600/60" style={{ width: `${possibleW}%` }} title="возможно" />}
            {totalIn > 0 && (
              <span className="absolute left-1 top-0.5 text-slate-100 text-xs">+{fmtMln(totalIn)}</span>
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
          {/* INBOUND grouped by confidence */}
          <div>
            <div className="text-xs uppercase text-emerald-300 mb-1">Ожидаемые поступления (+)</div>
            {!dayDetail ? (
              <div className="text-slate-500 text-xs italic px-2">загрузка...</div>
            ) : dayDetail.inbound.length ? (
              <div className="bg-emerald-950/20 rounded border border-emerald-900/50 overflow-hidden text-xs max-h-80 overflow-y-auto">
                {dayDetail.inbound.map(i => {
                  const p30 = parseFloat(i.prob_30d);
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
                          <div className={`text-[10px] ${CONFIDENCE_COLOR(p30)}`}>
                            {CONFIDENCE_LABEL(p30)} · P30 {fmtPct(i.prob_30d)}
                          </div>
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
  const dKey = days === 7 ? '7d' : days === 14 ? '14d' : '30d';
  const certain  = parseFloat((inb[`certain_${dKey}` as keyof InboundSummary] as string) || '0');
  const likely   = parseFloat((inb[`likely_${dKey}` as keyof InboundSummary] as string) || '0');
  const possible = parseFloat((inb[`possible_${dKey}` as keyof InboundSummary] as string) || '0');

  const outboundTotal = data.outbound.summary.reduce((s, c) => s + parseFloat(c.total), 0);
  const netWorst  = certain - outboundTotal;            // только надёжное
  const netBase   = certain + likely - outboundTotal;   // + вероятное
  const netBest   = certain + likely + possible - outboundTotal; // + возможное

  const dayMap: Record<string, { certain: number; likely: number; possible: number; out: Record<string, number> }> = {};
  for (const d of data.inbound.daily) {
    if (!dayMap[d.day]) dayMap[d.day] = { certain: 0, likely: 0, possible: 0, out: {} };
    dayMap[d.day].certain += parseFloat(d.amount_certain || '0');
    dayMap[d.day].likely += parseFloat(d.amount_likely || '0');
    dayMap[d.day].possible += parseFloat(d.amount_possible || '0');
  }
  for (const d of data.outbound.daily) {
    if (!dayMap[d.day]) dayMap[d.day] = { certain: 0, likely: 0, possible: 0, out: {} };
    dayMap[d.day].out[d.category] = (dayMap[d.day].out[d.category] || 0) + parseFloat(d.amount);
  }
  const allDays = Object.keys(dayMap).sort();
  const maxAmount = Math.max(
    1e5,
    ...allDays.map(d => dayMap[d].certain + dayMap[d].likely + dayMap[d].possible),
    ...allDays.map(d => Object.values(dayMap[d].out).reduce((s, v) => s + v, 0))
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/finance" className="text-blue-400 hover:underline text-sm">← Где деньги</Link>
        <h1 className="text-3xl font-semibold text-slate-100 mt-2">Когда деньги</h1>
        <p className="text-slate-400 mt-1 text-sm">3 сценария: точно / скорее всего / возможно. Без вероятностного смешивания.</p>
      </div>

      <div className="flex gap-2">
        {[7, 14, 30, 60, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded text-sm border ${days === d ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
            {d} дней
          </button>
        ))}
      </div>

      {/* Inbound 3 scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-5 rounded border bg-emerald-900/30 border-emerald-600">
          <div className="text-xs uppercase text-emerald-300">Точно ждём (P ≥ 80%)</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">{fmtMoney(certain)}</div>
          <div className="text-xs text-slate-400 mt-1">пол, на котором стоим</div>
        </div>
        <div className="p-5 rounded border bg-blue-900/30 border-blue-600">
          <div className="text-xs uppercase text-blue-300">+ Скорее всего (50-80%)</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">{fmtMoney(likely)}</div>
          <div className="text-xs text-slate-400 mt-1">в зоне нормального опоздания</div>
        </div>
        <div className="p-5 rounded border bg-amber-900/30 border-amber-600">
          <div className="text-xs uppercase text-amber-300">+ Возможно (20-50%)</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">{fmtMoney(possible)}</div>
          <div className="text-xs text-slate-400 mt-1">оптимистичный сценарий</div>
        </div>
      </div>

      {/* Outbound + Net 3 scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-5 rounded border bg-rose-900/20 border-rose-700/50">
          <div className="text-xs uppercase text-rose-300">Плановые расходы</div>
          <div className="text-3xl font-semibold text-slate-100 mt-2">−{fmtMoney(outboundTotal)}</div>
          <div className="text-xs text-slate-400 mt-1">{data.outbound.summary.map(c => `${CAT_LABEL[c.category] || c.category} ${fmtMln(c.total)}`).join(' · ')}</div>
        </div>
        <div className="p-5 rounded border bg-slate-900/50 border-slate-700">
          <div className="text-xs uppercase text-slate-300 mb-2">Net cash flow за {days} дн.</div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Худший (только точно):</span>
              <span className={`font-semibold ${netWorst >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{netWorst >= 0 ? '+' : ''}{fmtMoney(netWorst)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Базовый (+ вероятное):</span>
              <span className={`font-semibold ${netBase >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{netBase >= 0 ? '+' : ''}{fmtMoney(netBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Лучший (+ возможное):</span>
              <span className={`font-semibold ${netBest >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{netBest >= 0 ? '+' : ''}{fmtMoney(netBest)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Method box */}
      <div className="p-4 rounded border border-slate-700 bg-slate-900/50 text-xs text-slate-300 space-y-2">
        <div><strong className="text-emerald-300">Точно (P ≥ 80%)</strong> — счета у клиентов в их нормальной зоне оплаты. Эти деньги придут полностью.</div>
        <div><strong className="text-blue-300">Скорее всего (50-80%)</strong> — счета между median и p90 клиента. Часто этот клиент так задерживает, ждём.</div>
        <div><strong className="text-amber-300">Возможно (20-50%)</strong> — клиент уже вышел за свою норму, но не критично. Может ещё заплатит.</div>
        <div className="text-slate-500"><strong>Не показываются:</strong> сомнительные &gt;90 дней (P ≤ 15%) — они в /finance/receivables?class=dead. Налоги, лизинг, перевозчики не учтены в расходах.</div>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-3">По дням <span className="text-sm text-slate-400 font-normal">(клик = детализация · цвета: <span className="text-emerald-300">точно</span>+<span className="text-blue-300">вероятно</span>+<span className="text-amber-300">возможно</span>)</span></h2>
        <div className="bg-slate-900/50 border border-slate-700 rounded p-3 max-h-[700px] overflow-y-auto">
          {allDays.map(day => {
            const dm = dayMap[day];
            const outAmount = Object.values(dm.out).reduce((s, v) => s + v, 0);
            const dow = new Date(day).getDay();
            const isWeekend = dow === 0 || dow === 6;
            return (
              <DayRow
                key={day}
                date={day}
                certain={dm.certain} likely={dm.likely} possible={dm.possible}
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
    </div>
  );
}
