'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw, DollarSign,
  ChevronDown, ChevronUp, X, Search, Database, Banknote, FileText, ExternalLink,
  Building2, Truck, Users, Package, Zap, Eye
} from 'lucide-react';

// ========== TYPES ==========
interface TaggedValue {
  value: number | null;
  source: string | null;
  verified: boolean;
  status: 'actual' | 'estimated' | 'unavailable' | 'blocked';
  note: string | null;
  as_of: string;
}

interface MoneyOverview {
  legal_entity: string;
  generated_at: string;
  summary: {
    receivables_total: TaggedValue;
    receivables_overdue: TaggedValue;
    payables_total: TaggedValue;
    payables_overdue: TaggedValue;
    ap_due_7d: TaggedValue;
    ar_due_7d: TaggedValue;
    cash_actual: TaggedValue;
    cash_gap: TaggedValue;
    accrual_profit: TaggedValue;
  };
  payables_breakdown: {
    hired: any | null;
    salary: any | null;
    leasing: any | null;
  };
  quality: {
    issues_open: { critical: number; warning: number; info: number };
    data_sources: any;
  };
  actions_today: Array<{ priority: string; message: string; action_type: string }>;
}

interface LegalEntity {
  code: string;
  full_name: string;
  short_name: string;
  doc_prefix: string | null;
}

// ========== HELPERS ==========
const fmtM = (n: number | null) => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toLocaleString('ru-RU');
};
const fmtMoney = (n: number | null) => n === null ? '—' : fmtM(n) + ' ₽';

// Status pill для каждой цифры
function StatusPill({ status, verified }: { status: string; verified: boolean }) {
  if (status === 'actual') return <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-300 border border-green-500/40">факт</span>;
  if (status === 'estimated') return <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">расчёт TL196</span>;
  if (status === 'blocked') return <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-400 border border-slate-600">недоступно</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-400">?</span>;
}

// ========== TILES ==========
function MoneyTile({ label, tagged, icon: Icon, color, sub, onClick }: {
  label: string;
  tagged: TaggedValue;
  icon: any;
  color: string;
  sub?: string;
  onClick?: () => void;
}) {
  const isBlocked = tagged.status === 'blocked' || tagged.value === null;
  return (
    <div onClick={onClick}
      className={`bg-slate-800 rounded-xl border p-4 ${isBlocked ? 'border-slate-700 opacity-90' : 'border-slate-600'} ${onClick ? 'cursor-pointer hover:bg-slate-700/40 transition' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-xs text-slate-400">{label}</span>
        </div>
        <StatusPill status={tagged.status} verified={tagged.verified} />
      </div>
      <div className={`text-2xl font-bold mb-1 ${isBlocked ? 'text-slate-500' : color}`}>
        {isBlocked ? 'нет данных' : fmtMoney(tagged.value)}
      </div>
      {sub && !isBlocked && <div className="text-xs text-slate-500">{sub}</div>}
      {tagged.note && (
        <div className="text-[11px] text-slate-500 mt-2 leading-tight">{tagged.note}</div>
      )}
      {onClick && !isBlocked && <div className="text-xs text-blue-400 mt-2 flex items-center gap-1"><Eye className="w-3 h-3" /> детали</div>}
    </div>
  );
}

// ========== MAIN ==========
export default function WhereMoneyPage() {
  const router = useRouter();
  const [legalEntity, setLegalEntity] = useState('all');
  const [data, setData] = useState<MoneyOverview | null>(null);
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillModal, setDrillModal] = useState<{ open: boolean; type?: 'ar' | 'ap'; status?: string; category?: string; title?: string }>({ open: false });

  useEffect(() => {
    fetch('/api/finance/legal-entities').then(r => r.json()).then(d => setEntities(d.entities || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/money-overview?legal_entity=${legalEntity}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [legalEntity]);

  if (loading) return (
    <div className="p-6 flex items-center justify-center py-20">
      <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mr-2" />
      <span className="text-slate-400">Загрузка...</span>
    </div>
  );
  if (!data) return <div className="p-6 text-red-400">Ошибка загрузки</div>;

  const { summary } = data;
  const dataSourcesAll = Object.values(data.quality.data_sources);
  const connectedCount = (dataSourcesAll as any[]).filter(s => s.connected).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" /> Где деньги
          </h1>
          <p className="text-slate-400 text-sm mt-1">Кассовый контур по юрлицам · TL196 + 1С + Банк</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={legalEntity} onChange={e => setLegalEntity(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm">
            <option value="all">Все юрлица</option>
            {entities.map(e => (
              <option key={e.code} value={e.code}>{e.short_name} — {e.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Honest data sources warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <div className="text-yellow-300 font-semibold mb-1">
              Честно: 1С-данные не подключены ({connectedCount} из 3 источников)
            </div>
            <div className="text-slate-300 text-xs leading-relaxed">
              Цифры дебиторки/кредиторки <strong>расчётные из TL196</strong> (договоры + ДЗ + ЗП-реестры). 
              Реальные оплаты, банк, акты — пока не приходят. Всё помечено как <span className="px-1 bg-yellow-500/20 text-yellow-300 rounded">расчёт TL196</span> или <span className="px-1 bg-slate-700 text-slate-400 rounded">недоступно</span>.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-xs">
              {Object.entries(data.quality.data_sources).map(([key, src]: [string, any]) => (
                <div key={key} className={`p-2 rounded border ${src.connected ? 'border-green-500/40 bg-green-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                  <div className={`font-mono text-[11px] ${src.connected ? 'text-green-300' : 'text-slate-500'}`}>
                    {src.connected ? '✓' : '✗'} {key}
                  </div>
                  {src.note && <div className="text-slate-500 text-[10px] mt-0.5">{src.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Главные KPI — 4 тайла */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyTile label="Должны НАМ" tagged={summary.receivables_total}
          icon={TrendingUp} color="text-blue-400"
          sub={summary.receivables_overdue.value ? `просрочено ${fmtMoney(summary.receivables_overdue.value)}` : undefined}
          onClick={() => setDrillModal({ open: true, type: 'ar', title: 'Дебиторка (что нам должны)' })} />

        <MoneyTile label="Просрочено НАМ" tagged={summary.receivables_overdue}
          icon={AlertTriangle} color="text-red-400"
          onClick={() => setDrillModal({ open: true, type: 'ar', status: 'overdue', title: 'Просроченная дебиторка' })} />

        <MoneyTile label="Должны МЫ" tagged={summary.payables_total}
          icon={TrendingDown} color="text-orange-400"
          sub={summary.payables_overdue.value ? `просрочено ${fmtMoney(summary.payables_overdue.value)}` : undefined}
          onClick={() => setDrillModal({ open: true, type: 'ap', category: 'hired', title: 'Кредиторка перевозчикам' })} />

        <MoneyTile label="К оплате 7 дней" tagged={summary.ap_due_7d}
          icon={Banknote} color="text-yellow-400"
          sub={summary.ar_due_7d.value ? `ожидаем ${fmtMoney(summary.ar_due_7d.value)} от клиентов` : undefined} />
      </div>

      {/* Cash row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MoneyTile label="Деньги фактически" tagged={summary.cash_actual}
          icon={DollarSign} color="text-green-400" />
        <MoneyTile label="Кассовый разрыв" tagged={summary.cash_gap}
          icon={AlertTriangle} color="text-red-400" />
        <MoneyTile label="Прибыль по начислению" tagged={summary.accrual_profit}
          icon={TrendingUp} color="text-emerald-400"
          onClick={() => router.push('/pnl')} />
      </div>

      {/* AP breakdown */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="text-white font-semibold mb-3">Кредиторка по категориям</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: 'hired',   label: 'Перевозчикам',  icon: Truck,    color: 'orange' },
            { key: 'salary',  label: 'Зарплата',      icon: Users,    color: 'purple' },
            { key: 'leasing', label: 'Лизинг',        icon: Package,  color: 'cyan' },
          ].map(({ key, label, icon: Icon, color }) => {
            const v = (data.payables_breakdown as any)[key];
            const colorCls = color === 'orange' ? 'text-orange-400 border-orange-500/30'
              : color === 'purple' ? 'text-purple-400 border-purple-500/30'
              : 'text-cyan-400 border-cyan-500/30';
            return (
              <div key={key}
                onClick={() => v && setDrillModal({ open: true, type: 'ap', category: key, title: label })}
                className={`bg-slate-900/50 rounded-lg border ${colorCls.split(' ')[1]} p-3 ${v ? 'cursor-pointer hover:bg-slate-700/30' : 'opacity-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${colorCls.split(' ')[0]}`} />
                    <span className="text-sm text-slate-300">{label}</span>
                  </div>
                  {v && <Eye className="w-3 h-3 text-slate-500" />}
                </div>
                {v ? (
                  <>
                    <div className={`text-xl font-bold ${colorCls.split(' ')[0]}`}>
                      {fmtMoney(v.total_after_penalties)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {v.count} док · просрочено {v.overdue_count} на {fmtMoney(v.overdue_gross)}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-600 text-sm">нет данных</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      {data.actions_today.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-blue-500/30 p-4">
          <h3 className="text-blue-300 font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Что сделать сегодня
          </h3>
          <div className="space-y-2">
            {data.actions_today.map((a, i) => (
              <div key={i} className={`p-3 rounded-lg flex items-start gap-3 ${
                a.priority === 'high' ? 'bg-red-500/10 border border-red-500/30' :
                a.priority === 'medium' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                'bg-slate-700/50 border border-slate-600'
              }`}>
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                  a.priority === 'high' ? 'text-red-400' : 'text-yellow-400'
                }`} />
                <div className="text-sm text-slate-200 flex-1">{a.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-slate-600 text-center">
        Обновлено: {new Date(data.generated_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
      </div>

      {/* Drill-down modal */}
      {drillModal.open && (
        <DrillModal
          legalEntity={legalEntity}
          type={drillModal.type!}
          status={drillModal.status}
          category={drillModal.category}
          title={drillModal.title || ''}
          onClose={() => setDrillModal({ open: false })}
        />
      )}
    </div>
  );
}

// ========== DRILL MODAL ==========
function DrillModal({ legalEntity, type, status, category, title, onClose }: {
  legalEntity: string;
  type: 'ar' | 'ap';
  status?: string;
  category?: string;
  title: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ legal_entity: legalEntity, limit: '300' });
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    const url = type === 'ar' ? `/api/finance/receivables?${params}` : `/api/finance/payables?${params}`;
    fetch(url).then(r => r.json()).then(d => {
      setItems((type === 'ar' ? d.receivables : d.payables) || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [legalEntity, type, status, category]);

  const filtered = items.filter((i: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (i.counterparty || '').toLowerCase().includes(s) ||
      (i.notes || '').toLowerCase().includes(s) ||
      (i.doc_number || '').toLowerCase().includes(s) ||
      (i.vehicle_plate || '').toLowerCase().includes(s)
    );
  });

  const totalGross = filtered.reduce((s: number, i: any) => s + (i.amount_gross || 0), 0);
  const totalOverdue = filtered.filter((i: any) => i.days_overdue > 0).reduce((s: number, i: any) => s + (i.amount_gross || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-auto" onClick={onClose}>
      <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-7xl w-full max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-700 flex items-center gap-3">
          <h2 className="text-white font-semibold flex-1">{title} {legalEntity !== 'all' && `· ${legalEntity}`}</h2>
          <div className="text-xs text-slate-400">
            {filtered.length} строк · {fmtMoney(totalGross)} {totalOverdue > 0 && <span className="text-red-400 ml-2">просрочено {fmtMoney(totalOverdue)}</span>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-3 border-b border-slate-700">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск: контрагент, документ, машина"
              className="w-full pl-8 pr-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-10 text-center text-slate-400"><RefreshCw className="w-5 h-5 animate-spin inline mr-2" /> Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-400">Нет данных</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-800 sticky top-0 text-slate-400">
                <tr>
                  <th className="text-left p-2">Юрлицо</th>
                  <th className="text-left p-2">Контрагент</th>
                  <th className="text-left p-2">Документ</th>
                  <th className="text-right p-2">Сумма с НДС</th>
                  <th className="text-right p-2">Без НДС</th>
                  <th className="text-left p-2">Дата</th>
                  <th className="text-left p-2">Срок</th>
                  <th className="text-right p-2">Просрочка</th>
                  <th className="text-left p-2">Машина</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="p-2 text-slate-400 font-mono">{r.legal_entity || '—'}</td>
                    <td className="p-2 text-white max-w-[200px] truncate" title={r.counterparty}>{r.counterparty || '—'}</td>
                    <td className="p-2 text-slate-400 text-[11px] max-w-[200px] truncate" title={r.doc_number || r.notes}>
                      {r.doc_number || r.notes?.slice(0, 30) || r.source_ref}
                    </td>
                    <td className="p-2 text-right text-slate-200 font-mono">{Math.round(r.amount_gross).toLocaleString('ru-RU')}</td>
                    <td className="p-2 text-right text-slate-400 font-mono">{r.amount_net ? Math.round(r.amount_net).toLocaleString('ru-RU') : '—'}</td>
                    <td className="p-2 text-slate-400 whitespace-nowrap">{r.date_accrued ? new Date(r.date_accrued).toLocaleDateString('ru-RU') : '—'}</td>
                    <td className="p-2 text-slate-400 whitespace-nowrap">{r.due_date ? new Date(r.due_date).toLocaleDateString('ru-RU') : '—'}</td>
                    <td className={`p-2 text-right font-mono ${
                      r.days_overdue > 0 ? 'text-red-400' : 'text-slate-500'
                    }`}>
                      {r.days_overdue > 0 ? `+${r.days_overdue}д` : '—'}
                    </td>
                    <td className="p-2 font-mono text-slate-400">{r.vehicle_plate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
