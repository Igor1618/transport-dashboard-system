'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Truck, Clock, AlertTriangle, CheckCircle, XCircle,
  Search, Filter, RefreshCw, Plus, ChevronRight
} from 'lucide-react';
import { apiFetch } from '@/shared/utils/apiFetch';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trip {
  id: string;
  contract_number_snapshot: string | null;
  contractor_name_snapshot: string | null;
  vehicle_plate_snapshot: string | null;
  driver_name_snapshot: string | null;
  route_snapshot: string | null;
  lifecycle_status: string;
  document_status: string;
  payment_status: string;
  loading_date_planned: string | null;
  unloading_date_planned: string | null;
  contract_amount: string | null;
  carrier_type: string;
  open_problems: string;
  critical_problems: string;
  assignments: Array<{ role: string; user_name: string; is_primary: boolean }> | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Status configs ───────────────────────────────────────────────────────────

const LIFECYCLE_LABELS: Record<string, { label: string; color: string }> = {
  need_load:          { label: 'Нет груза',      color: 'bg-gray-500' },
  assigned:           { label: 'Назначен',        color: 'bg-blue-600' },
  searching:          { label: 'Поиск груза',     color: 'bg-purple-500' },
  contracting:        { label: 'ДЗ',              color: 'bg-indigo-500' },
  ready_for_dispatch: { label: 'Готов к выезду',  color: 'bg-yellow-500' },
  in_progress:        { label: 'В рейсе',         color: 'bg-green-500' },
  delivered:          { label: 'Доставлен',       color: 'bg-teal-500' },
  docs_processing:    { label: 'Документы',       color: 'bg-orange-500' },
  awaiting_payment:   { label: 'Ждём оплату',     color: 'bg-amber-500' },
  closed:             { label: 'Закрыт',          color: 'bg-gray-400' },
  blocked:            { label: 'Заблокирован',    color: 'bg-red-600' },
  disputed:           { label: 'Спор',            color: 'bg-red-500' },
  cancelled:          { label: 'Отменён',         color: 'bg-gray-400' },
};

const PAYMENT_LABELS: Record<string, { label: string; color: string }> = {
  not_invoiced:     { label: 'Не выставлен',  color: 'text-gray-400' },
  invoiced:         { label: 'Выставлен',     color: 'text-blue-400' },
  awaiting_payment: { label: 'Ждём оплату',   color: 'text-yellow-400' },
  partial_paid:     { label: 'Частично',      color: 'text-orange-400' },
  paid:             { label: 'Оплачен ✓',     color: 'text-green-400' },
  overdue:          { label: 'Просрочка!',    color: 'text-red-400 font-bold' },
  disputed:         { label: 'Спор',          color: 'text-red-400' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TmsTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [scope, setScope] = useState('active');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [hasProblems, setHasProblems] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Summary
  const [summary, setSummary] = useState<Record<string, string> | null>(null);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        scope,
        page: String(page),
        limit: '50',
      });
      if (status) params.set('status', status);
      if (paymentStatus) params.set('payment_status', paymentStatus);
      if (hasProblems) params.set('has_problems', 'true');
      if (search) params.set('search', search);

      const res = await apiFetch(`/api/tms/trips?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrips(data.data || []);
      setPagination(data.pagination);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [scope, status, paymentStatus, hasProblems, search, page]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiFetch('/api/tms/queue/summary');
      if (res.ok) setSummary(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const fmt = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const fmtAmount = (amount: string | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(amount)) + ' ₽';
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Рейсы TMS</h1>
          {summary && (
            <div className="flex gap-4 mt-1 text-sm">
              <span className="text-gray-400">Активных: <span className="text-white font-medium">{summary.active_trips}</span></span>
              {Number(summary.overdue_payments) > 0 && (
                <span className="text-red-400 font-medium">Просрочка: {summary.overdue_payments}</span>
              )}
              {Number(summary.critical_problems) > 0 && (
                <span className="text-red-400 font-medium">Критичных проблем: {summary.critical_problems}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTrips} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link href="/tms/trips/new" className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">
            <Plus size={14} /> Новый рейс
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Scope */}
        <select
          value={scope}
          onChange={e => { setScope(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5"
        >
          <option value="active">Активные</option>
          <option value="active,draft">Активные + черновики</option>
          <option value="historical">Исторические</option>
          <option value="archived">Архив</option>
          <option value="active,historical">Все незакрытые</option>
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5"
        >
          <option value="">Все статусы</option>
          {Object.entries(LIFECYCLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {/* Payment */}
        <select
          value={paymentStatus}
          onChange={e => { setPaymentStatus(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5"
        >
          <option value="">Оплата: любая</option>
          {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {/* Problems */}
        <button
          onClick={() => { setHasProblems(p => !p); setPage(1); }}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border ${
            hasProblems ? 'bg-red-900 border-red-600 text-red-300' : 'bg-gray-800 border-gray-600 text-gray-400'
          }`}
        >
          <AlertTriangle size={13} /> С проблемами
        </button>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Контрагент, маршрут, машина..."
            className="w-full bg-gray-800 border border-gray-600 text-white text-sm rounded-lg pl-8 pr-3 py-1.5 placeholder-gray-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-600 text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">№ / Контрагент</th>
              <th className="px-3 py-2 text-left">Маршрут</th>
              <th className="px-3 py-2 text-left">Машина / Водитель</th>
              <th className="px-3 py-2 text-left">Статус</th>
              <th className="px-3 py-2 text-left">Оплата</th>
              <th className="px-3 py-2 text-left">Даты</th>
              <th className="px-3 py-2 text-right">Сумма</th>
              <th className="px-3 py-2 text-left">Ответственные</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Загрузка...</td></tr>
            ) : trips.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Рейсы не найдены</td></tr>
            ) : trips.map(trip => {
              const ls = LIFECYCLE_LABELS[trip.lifecycle_status] || { label: trip.lifecycle_status, color: 'bg-gray-500' };
              const ps = PAYMENT_LABELS[trip.payment_status] || { label: trip.payment_status, color: 'text-gray-400' };
              const hasCritical = Number(trip.critical_problems) > 0;
              const logist = trip.assignments?.find(a => ['logist','main_logist'].includes(a.role) && a.is_primary);

              return (
                <tr key={trip.id} className={`hover:bg-gray-800/50 cursor-pointer ${hasCritical ? 'bg-red-950/20' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-white text-xs">
                      {trip.contract_number_snapshot || '—'}
                    </div>
                    <div className="text-gray-400 text-xs truncate max-w-32">
                      {trip.contractor_name_snapshot || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-gray-300 text-xs truncate max-w-40">
                      {trip.route_snapshot || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-white text-xs font-mono">
                      {trip.vehicle_plate_snapshot || '—'}
                    </div>
                    <div className="text-gray-400 text-xs truncate max-w-28">
                      {trip.driver_name_snapshot || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-white text-xs ${ls.color}`}>
                      {ls.label}
                    </span>
                    {Number(trip.open_problems) > 0 && (
                      <span className={`ml-1 text-xs ${hasCritical ? 'text-red-400' : 'text-yellow-400'}`}>
                        ⚠ {trip.open_problems}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs ${ps.color}`}>{ps.label}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    <div>{fmt(trip.loading_date_planned)}</div>
                    {trip.unloading_date_planned && (
                      <div>{fmt(trip.unloading_date_planned)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-300">
                    {fmtAmount(trip.contract_amount)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {logist ? logist.user_name.split(' ').slice(0, 2).join(' ') : <span className="text-yellow-500 text-xs">Не назначен</span>}
                  </td>
                  <td className="px-2 py-2">
                    <Link href={`/tms/trips/${trip.id}`} className="text-gray-500 hover:text-white">
                      <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Всего: {pagination.total.toLocaleString('ru-RU')}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-gray-600 disabled:opacity-40 hover:bg-gray-700"
            >
              ←
            </button>
            <span className="px-3 py-1">{page} / {pagination.pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="px-3 py-1 rounded border border-gray-600 disabled:opacity-40 hover:bg-gray-700"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
