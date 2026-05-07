'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Truck, Clock, AlertTriangle, CheckCircle, MessageSquare,
  FileText, ChevronDown, ChevronUp, User, Calendar, DollarSign,
  Flag, Plus, X, ChevronRight, Edit3
} from 'lucide-react';
import { apiFetch } from '@/shared/utils/apiFetch';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TripDetail {
  id: string;
  contract_number_snapshot: string | null;
  contract_id: string | null;
  contractor_name_snapshot: string | null;
  contractor_inn_snapshot: string | null;
  vehicle_plate_snapshot: string | null;
  driver_name_snapshot: string | null;
  route_snapshot: string | null;
  lifecycle_status: string;
  document_status: string;
  payment_status: string;
  loading_date_planned: string | null;
  unloading_date_planned: string | null;
  loading_date_actual: string | null;
  unloading_date_actual: string | null;
  contract_amount: string | null;
  currency: string;
  carrier_type: string;
  external_driver_name: string | null;
  external_vehicle_plate: string | null;
  source: string;
  trip_type: string;
  record_scope: string;
  version: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;

  assignments: Assignment[];
  events: Event[];
  invoices: Invoice[];
  payments: Payment[];
  problems: Problem[];
  comments: Comment[];
}

interface Assignment {
  id: string;
  role: string;
  user_id: number;
  user_name: string;
  is_primary: boolean;
  assigned_at: string;
  unassigned_at: string | null;
}

interface Event {
  id: string;
  event_type: string;
  event_source: string;
  by_user_name: string | null;
  payload: Record<string, any>;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: string | null;
  match_method: string | null;
  is_manual: boolean;
  matched_by_name: string | null;
}

interface Payment {
  id: string;
  payment_date: string | null;
  amount: string | null;
  allocation_amount: string | null;
  match_method: string | null;
  is_manual: boolean;
  matched_by_name: string | null;
}

interface Problem {
  id: string;
  problem_type: string;
  severity: string;
  description: string | null;
  opened_by_name: string | null;
  opened_at: string;
  closed_at: string | null;
  resolution: string | null;
}

interface Comment {
  id: string;
  user_name: string;
  body: string;
  created_at: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const LIFECYCLE_LABELS: Record<string, { label: string; color: string }> = {
  need_load:          { label: 'Нет груза',       color: 'bg-gray-500' },
  assigned:           { label: 'Логист назначен',  color: 'bg-blue-600' },
  searching:          { label: 'Поиск груза',      color: 'bg-purple-500' },
  contracting:        { label: 'Оформление ДЗ',    color: 'bg-indigo-500' },
  ready_for_dispatch: { label: 'Готов к выезду',   color: 'bg-yellow-500' },
  in_progress:        { label: 'В рейсе',          color: 'bg-green-500' },
  delivered:          { label: 'Доставлен',        color: 'bg-teal-500' },
  docs_processing:    { label: 'Обработка доков',  color: 'bg-orange-500' },
  awaiting_payment:   { label: 'Ждём оплату',      color: 'bg-amber-500' },
  closed:             { label: 'Закрыт ✓',         color: 'bg-gray-400' },
  blocked:            { label: 'Заблокирован',     color: 'bg-red-600' },
  disputed:           { label: 'Спор',             color: 'bg-red-500' },
  cancelled:          { label: 'Отменён',          color: 'bg-gray-400' },
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'border-gray-500 text-gray-300',
  medium: 'border-yellow-500 text-yellow-300',
  high: 'border-orange-500 text-orange-300',
  critical: 'border-red-500 text-red-300',
};

const PROBLEM_LABELS: Record<string, string> = {
  docs_lost: 'Документы утеряны',
  payment_overdue: 'Просрочка оплаты',
  client_dispute: 'Спор с клиентом',
  vehicle_breakdown: 'Поломка ТС',
  driver_issue: 'Проблема с водителем',
  cargo_damage: 'Повреждение груза',
  route_delay: 'Задержка по маршруту',
  invoice_mismatch: 'Расхождение счёта',
  payment_mismatch: 'Расхождение оплаты',
  communication_lost: 'Нет связи',
  other: 'Другое',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TripCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showHistory, setShowHistory] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [statusTransitioning, setStatusTransitioning] = useState(false);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [newProblem, setNewProblem] = useState({ problem_type: 'other', severity: 'medium', description: '' });

  const fetchTrip = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/tms/trips/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTrip(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrip(); }, [id]);

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await apiFetch(`/api/tms/trips/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentText }),
      });
      setCommentText('');
      await fetchTrip();
    } finally {
      setSubmittingComment(false);
    }
  };

  const changeStatus = async (toStatus: string, reason?: string) => {
    const r = reason || prompt(`Причина перехода в "${LIFECYCLE_LABELS[toStatus]?.label}":`);
    setStatusTransitioning(true);
    try {
      const res = await apiFetch(`/api/tms/trips/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_status: toStatus, reason: r }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка смены статуса');
      } else {
        await fetchTrip();
      }
    } finally {
      setStatusTransitioning(false);
    }
  };

  const openProblem = async () => {
    const res = await apiFetch(`/api/tms/trips/${id}/problems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProblem),
    });
    if (res.ok) {
      setShowProblemForm(false);
      setNewProblem({ problem_type: 'other', severity: 'medium', description: '' });
      await fetchTrip();
    }
  };

  const closeProblem = async (pid: string) => {
    const resolution = prompt('Как решена проблема?');
    if (!resolution) return;
    await apiFetch(`/api/tms/trips/${id}/problems/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    });
    await fetchTrip();
  };

  const fmt = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const fmtDT = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const fmtAmount = (amount: string | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(amount)) + ' ₽';
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Загрузка карточки рейса...</div>;
  if (error) return <div className="p-8 text-center text-red-400">Ошибка: {error}</div>;
  if (!trip) return null;

  const ls = LIFECYCLE_LABELS[trip.lifecycle_status] || { label: trip.lifecycle_status, color: 'bg-gray-500' };
  const openProblems = trip.problems.filter(p => !p.closed_at);
  const activeAssignments = trip.assignments.filter(a => !a.unassigned_at);
  const invoicedTotal = trip.invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const paidTotal = trip.payments.reduce((s, p) => s + Number(p.allocation_amount || 0), 0);

  // Available next statuses (simplified — full matrix is backend-enforced)
  const NEXT_STATUSES: Record<string, string[]> = {
    need_load: ['assigned'],
    assigned: ['searching'],
    searching: ['contracting'],
    contracting: ['ready_for_dispatch'],
    ready_for_dispatch: ['in_progress'],
    in_progress: ['delivered'],
    delivered: ['docs_processing'],
    docs_processing: ['awaiting_payment'],
    awaiting_payment: ['closed'],
  };
  const nextStatuses = NEXT_STATUSES[trip.lifecycle_status] || [];
  const canBlock = !['closed','cancelled','blocked'].includes(trip.lifecycle_status);

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/tms/trips" className="text-gray-400 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">
                {trip.contract_number_snapshot || `Рейс`}
              </h1>
              <span className={`px-2 py-0.5 rounded text-white text-xs font-medium ${ls.color}`}>
                {ls.label}
              </span>
              {openProblems.length > 0 && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                  openProblems.some(p => p.severity === 'critical')
                    ? 'border-red-500 text-red-300 bg-red-950/30'
                    : 'border-yellow-500 text-yellow-300 bg-yellow-950/30'
                }`}>
                  ⚠ {openProblems.length} проблем
                </span>
              )}
            </div>
            <div className="text-sm text-gray-400">
              {trip.contractor_name_snapshot} · {trip.route_snapshot || 'маршрут не указан'}
            </div>
          </div>
        </div>

        {/* Status transition buttons */}
        <div className="flex items-center gap-2">
          {nextStatuses.map(ns => (
            <button
              key={ns}
              onClick={() => changeStatus(ns)}
              disabled={statusTransitioning}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50"
            >
              → {LIFECYCLE_LABELS[ns]?.label || ns}
            </button>
          ))}
          {canBlock && (
            <button
              onClick={() => changeStatus('blocked')}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-sm rounded-lg"
            >
              Блокировать
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: main info */}
        <div className="lg:col-span-2 space-y-4">

          {/* Trip details */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Детали рейса</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-gray-400">Машина:</span> <span className="text-white font-mono">{trip.vehicle_plate_snapshot || '—'}</span></div>
              <div><span className="text-gray-400">Водитель:</span> <span className="text-white">{trip.driver_name_snapshot || trip.external_driver_name || '—'}</span></div>
              <div><span className="text-gray-400">Погрузка:</span> <span className="text-white">{fmt(trip.loading_date_planned)}{trip.loading_date_actual ? ` (факт: ${fmt(trip.loading_date_actual)})` : ''}</span></div>
              <div><span className="text-gray-400">Выгрузка:</span> <span className="text-white">{fmt(trip.unloading_date_planned)}{trip.unloading_date_actual ? ` (факт: ${fmt(trip.unloading_date_actual)})` : ''}</span></div>
              <div><span className="text-gray-400">Сумма договора:</span> <span className="text-white font-medium">{fmtAmount(trip.contract_amount)}</span></div>
              <div><span className="text-gray-400">Тип перевозчика:</span> <span className="text-white">{trip.carrier_type === 'hired' ? 'Наёмный' : 'Собственный'}</span></div>
              <div><span className="text-gray-400">Источник:</span> <span className="text-white">{trip.source}</span></div>
              <div><span className="text-gray-400">Версия:</span> <span className="text-gray-400">v{trip.version}</span></div>
            </div>
          </div>

          {/* Financials */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Финансы</h2>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-gray-400 text-xs">Выставлено</div>
                <div className="text-white font-medium text-base">{fmtAmount(String(invoicedTotal))}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">Оплачено</div>
                <div className={`font-medium text-base ${paidTotal >= invoicedTotal && invoicedTotal > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                  {fmtAmount(String(paidTotal))}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">Долг</div>
                <div className={`font-medium text-base ${invoicedTotal - paidTotal > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {fmtAmount(String(Math.max(0, invoicedTotal - paidTotal)))}
                </div>
              </div>
            </div>
            {trip.invoices.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 font-medium mt-2">Счета из 1С:</div>
                {trip.invoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between text-xs bg-gray-700/50 rounded px-3 py-1.5">
                    <span className="text-gray-300">{inv.invoice_number || inv.id.slice(0, 8)} · {fmt(inv.invoice_date)}</span>
                    <span className="text-white font-medium">{fmtAmount(inv.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {trip.payments.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 font-medium mt-2">Платежи из 1С:</div>
                {trip.payments.map(pay => (
                  <div key={pay.id} className="flex items-center justify-between text-xs bg-gray-700/50 rounded px-3 py-1.5">
                    <span className="text-gray-300">{fmt(pay.payment_date)} · {pay.match_method}</span>
                    <span className="text-green-400 font-medium">{fmtAmount(pay.allocation_amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Problems */}
          {(openProblems.length > 0 || showProblemForm) && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Проблемы</h2>
                <button
                  onClick={() => setShowProblemForm(s => !s)}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <Plus size={12} /> Открыть проблему
                </button>
              </div>
              {showProblemForm && (
                <div className="space-y-2 bg-gray-700/50 rounded-lg p-3">
                  <select value={newProblem.problem_type} onChange={e => setNewProblem(p => ({ ...p, problem_type: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5">
                    {Object.entries(PROBLEM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={newProblem.severity} onChange={e => setNewProblem(p => ({ ...p, severity: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5">
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                    <option value="critical">Критический</option>
                  </select>
                  <textarea value={newProblem.description} onChange={e => setNewProblem(p => ({ ...p, description: e.target.value }))}
                    placeholder="Описание проблемы..."
                    className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 resize-none" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={openProblem} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg">Открыть</button>
                    <button onClick={() => setShowProblemForm(false)} className="px-3 py-1 text-gray-400 hover:text-white text-sm">Отмена</button>
                  </div>
                </div>
              )}
              {openProblems.map(p => (
                <div key={p.id} className={`border rounded-lg p-3 text-sm ${SEVERITY_COLORS[p.severity]}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-medium">{PROBLEM_LABELS[p.problem_type] || p.problem_type}</span>
                      {p.description && <p className="text-gray-400 text-xs mt-0.5">{p.description}</p>}
                      <p className="text-gray-500 text-xs mt-0.5">Открыл: {p.opened_by_name} · {fmtDT(p.opened_at)}</p>
                    </div>
                    <button onClick={() => closeProblem(p.id)} className="text-gray-500 hover:text-white ml-2">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comments */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
              <MessageSquare size={14} /> Комментарии ({trip.comments.length})
            </h2>
            {trip.comments.map(c => (
              <div key={c.id} className="flex gap-2 text-sm">
                <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-300 flex-shrink-0">
                  {c.user_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-white text-xs">{c.user_name}</span>
                    <span className="text-gray-500 text-xs">{fmtDT(c.created_at)}</span>
                  </div>
                  <p className="text-gray-300 text-sm mt-0.5">{c.body}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
                placeholder="Добавить комментарий..."
                className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500"
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || submittingComment}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50"
              >
                ↵
              </button>
            </div>
          </div>

          {/* History */}
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowHistory(s => !s)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-300 hover:bg-gray-700/50"
            >
              <span className="uppercase tracking-wide flex items-center gap-2">
                <Clock size={14} /> История событий ({trip.events.length})
              </span>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showHistory && (
              <div className="divide-y divide-gray-700/50">
                {trip.events.slice(0, 50).map(e => (
                  <div key={e.id} className="px-4 py-2 text-xs text-gray-400 flex items-start gap-3">
                    <span className="text-gray-500 flex-shrink-0 w-28">{fmtDT(e.created_at)}</span>
                    <span className="text-gray-300">{e.event_type}</span>
                    {e.by_user_name && <span className="text-gray-500">· {e.by_user_name}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: assignments + actions */}
        <div className="space-y-4">
          {/* Assignments */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
              <User size={13} /> Ответственные
            </h2>
            {activeAssignments.length === 0 ? (
              <p className="text-gray-500 text-xs">Нет назначенных</p>
            ) : (
              activeAssignments.map(a => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400 capitalize">{a.role.replace('_', ' ')}:</span>{' '}
                    <span className="text-white">{a.user_name}</span>
                  </div>
                  {a.is_primary && <span className="text-green-400">✓</span>}
                </div>
              ))
            )}
            <button className="text-xs text-blue-400 hover:text-blue-300 mt-2">+ Назначить</button>
          </div>

          {/* Quick actions */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Действия</h2>
            <button
              onClick={() => setShowProblemForm(s => !s)}
              className="w-full text-left text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
            >
              <AlertTriangle size={13} className="text-yellow-400" /> Открыть проблему
            </button>
            {['closed','cancelled'].includes(trip.lifecycle_status) ? null : (
              <button
                onClick={() => changeStatus('cancelled')}
                className="w-full text-left text-sm text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
              >
                <X size={13} /> Отменить рейс
              </button>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-1 text-xs text-gray-400">
            <div>Создан: {fmtDT(trip.created_at)}</div>
            <div>Обновлён: {fmtDT(trip.updated_at)}</div>
            {trip.closed_at && <div>Закрыт: {fmtDT(trip.closed_at)}</div>}
            <div className="mt-2 font-mono text-gray-600 break-all">{trip.id}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
