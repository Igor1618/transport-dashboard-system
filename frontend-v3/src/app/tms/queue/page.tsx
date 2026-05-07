'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueItem {
  id: string;
  lifecycle_status: string;
  contract_number: string;
  contractor_name: string;
  vehicle_plate: string;
  driver_name?: string;
  route: string;
  loading_date_planned: string | null;
  contract_amount: string;
  payment_status: string;
  document_status?: string;
  action_type: string;
  critical_problems?: string;
  days_stale?: number | null;
  // accountant fields
  invoiced_amount?: string;
  paid_amount?: string;
  payment_due_date?: string;
  // director fields
  problem_type?: string;
  severity?: string;
  problem_description?: string;
}

interface QueueResponse {
  role: string;
  items: QueueItem[];
  count: number;
}

interface Summary {
  active_trips: string;
  need_action: string;
  overdue_payments: string;
  critical_problems: string;
  docs_pending: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  payment_overdue:   { label: 'Просрочка оплаты',   color: 'text-red-400',    bg: 'bg-red-950/40',    border: 'border-red-800' },
  overdue_payment:   { label: 'Просрочка оплаты',   color: 'text-red-400',    bg: 'bg-red-950/40',    border: 'border-red-800' },
  critical_problem:  { label: 'Критическая проблема', color: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-800' },
  assign_logist:     { label: 'Назначить логиста',  color: 'text-blue-400',   bg: 'bg-blue-950/40',   border: 'border-blue-800' },
  start_searching:   { label: 'Начать поиск',       color: 'text-cyan-400',   bg: 'bg-cyan-950/40',   border: 'border-cyan-800' },
  find_cargo:        { label: 'Найти груз',         color: 'text-cyan-400',   bg: 'bg-cyan-950/40',   border: 'border-cyan-800' },
  register_dz:       { label: 'Оформить ДЗ',        color: 'text-violet-400', bg: 'bg-violet-950/40', border: 'border-violet-800' },
  check_docs:        { label: 'Проверить документы', color: 'text-yellow-400', bg: 'bg-yellow-950/40', border: 'border-yellow-800' },
  dispatch_driver:   { label: 'Выпустить водителя', color: 'text-green-400',  bg: 'bg-green-950/40',  border: 'border-green-800' },
  track_progress:    { label: 'Контроль рейса',     color: 'text-green-400',  bg: 'bg-green-950/40',  border: 'border-green-800' },
  confirm_delivery:  { label: 'Подтвердить доставку', color: 'text-teal-400', bg: 'bg-teal-950/40',   border: 'border-teal-800' },
  issue_invoice:     { label: 'Выставить счёт',     color: 'text-purple-400', bg: 'bg-purple-950/40', border: 'border-purple-800' },
  collect_docs:      { label: 'Собрать документы',  color: 'text-yellow-400', bg: 'bg-yellow-950/40', border: 'border-yellow-800' },
  payment_due_soon:  { label: 'Скоро оплата',       color: 'text-amber-400',  bg: 'bg-amber-950/40',  border: 'border-amber-800' },
  monitor:           { label: 'Мониторинг',         color: 'text-slate-400',  bg: 'bg-slate-900/40',  border: 'border-slate-700' },
  review:            { label: 'К проверке',         color: 'text-slate-400',  bg: 'bg-slate-900/40',  border: 'border-slate-700' },
};

const ROLE_LABELS: Record<string, string> = {
  main_logist: 'Главный логист',
  logist:      'Логист',
  dispatcher:  'Диспетчер',
  accountant:  'Бухгалтер',
  director:    'Директор',
  admin:       'Администратор',
  superadmin:  'Суперадмин',
};

function fmt(val: string | undefined | null): string {
  if (!val) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n.toLocaleString('ru-RU') + ' ₽';
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ─── Queue Item Card ──────────────────────────────────────────────────────────

function QueueCard({ item }: { item: QueueItem }) {
  const cfg = ACTION_CONFIG[item.action_type] ?? ACTION_CONFIG.monitor;
  const isPast = item.payment_due_date ? new Date(item.payment_due_date) < new Date() : false;

  return (
    <Link href={`/tms/trips/${item.id}`}>
      <div className={`rounded-lg border p-4 hover:brightness-110 transition-all cursor-pointer ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>
                {cfg.label}
              </span>
              {item.critical_problems && parseInt(item.critical_problems) > 0 && (
                <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded">
                  ⚠ {item.critical_problems}
                </span>
              )}
            </div>
            <div className="font-semibold text-white text-sm">
              {item.contract_number} · {item.contractor_name}
            </div>
            <div className="text-slate-400 text-xs mt-0.5 truncate">
              {item.route || '—'}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-white font-semibold text-sm">{fmt(item.contract_amount)}</div>
            {item.payment_due_date && (
              <div className={`text-xs ${isPast ? 'text-red-400 font-semibold' : 'text-slate-400'}`}>
                до {fmtDate(item.payment_due_date)}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4 mt-2 text-xs text-slate-400">
          {item.vehicle_plate && <span>🚛 {item.vehicle_plate}</span>}
          {item.driver_name && <span>👤 {item.driver_name}</span>}
          {item.loading_date_planned && <span>📅 {fmtDate(item.loading_date_planned)}</span>}
          {item.invoiced_amount !== undefined && (
            <span>Счёт: {fmt(item.invoiced_amount)} · Оплачено: {fmt(item.paid_amount)}</span>
          )}
          {item.problem_description && (
            <span className="text-orange-400 truncate max-w-[200px]">{item.problem_description}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [qRes, sRes] = await Promise.all([
        fetch('/api/tms/queue'),
        fetch('/api/tms/queue/summary'),
      ]);
      if (!qRes.ok) throw new Error(`Queue: ${qRes.status}`);
      const [q, s] = await Promise.all([qRes.json(), sRes.json()]);
      setQueue(q);
      setSummary(s);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = queue?.items ?? [];
  const filtered = filter === 'all' ? items : items.filter(i => i.action_type === filter);
  const actionTypes = [...new Set(items.map(i => i.action_type))];
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.action_type] = (counts[i.action_type] ?? 0) + 1;

  // Group by action_type for display
  const groups: Record<string, QueueItem[]> = {};
  for (const item of filtered) {
    if (!groups[item.action_type]) groups[item.action_type] = [];
    groups[item.action_type].push(item);
  }
  const groupOrder = ['payment_overdue', 'overdue_payment', 'critical_problem', 'assign_logist',
    'issue_invoice', 'collect_docs', 'payment_due_soon', 'dispatch_driver',
    'register_dz', 'find_cargo', 'start_searching', 'check_docs',
    'confirm_delivery', 'track_progress', 'review', 'monitor'];
  const sortedGroups = Object.keys(groups).sort(
    (a, b) => (groupOrder.indexOf(a) === -1 ? 99 : groupOrder.indexOf(a))
             - (groupOrder.indexOf(b) === -1 ? 99 : groupOrder.indexOf(b))
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Очередь задач</h1>
          {queue && (
            <p className="text-slate-400 text-sm mt-0.5">
              {ROLE_LABELS[queue.role] ?? queue.role} · {queue.count} задач
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50"
          title="Обновить"
        >
          <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Summary badges */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{summary.active_trips}</div>
            <div className="text-xs text-slate-400">Активных рейсов</div>
          </div>
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{summary.overdue_payments}</div>
            <div className="text-xs text-red-300">Просрочено</div>
          </div>
          <div className="bg-orange-950/50 border border-orange-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-400">{summary.critical_problems}</div>
            <div className="text-xs text-orange-300">Критических проблем</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-slate-300">{summary.need_action}</div>
            <div className="text-xs text-slate-400">Без логиста</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {actionTypes.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-white text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Все ({items.length})
          </button>
          {actionTypes.map(t => {
            const cfg = ACTION_CONFIG[t] ?? ACTION_CONFIG.monitor;
            return (
              <button
                key={t}
                onClick={() => setFilter(filter === t ? 'all' : t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === t ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cfg.label} ({counts[t]})
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {error && (
        <div className="bg-red-950/50 border border-red-700 rounded-lg p-4 text-red-400 text-sm">
          Ошибка: {error}
        </div>
      )}

      {!error && items.length === 0 && !loading && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-lg font-medium">Очередь пуста</div>
          <div className="text-sm mt-1">Нет задач требующих внимания</div>
        </div>
      )}

      <div className="space-y-6">
        {sortedGroups.map(actionType => (
          <div key={actionType}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${ACTION_CONFIG[actionType]?.color ?? 'text-slate-400'}`}>
                {ACTION_CONFIG[actionType]?.label ?? actionType}
              </span>
              <span className="text-slate-600 text-xs">({groups[actionType].length})</span>
            </div>
            <div className="space-y-2">
              {groups[actionType].map(item => (
                <QueueCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
