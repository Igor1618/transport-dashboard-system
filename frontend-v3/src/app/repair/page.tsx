"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Clock,
  CalendarDays,
  Truck,
} from "lucide-react";

interface RepairOrder {
  id: number;
  order_number: string;
  vehicle_number: string;
  repair_type: string;
  description: string;
  mechanic_name: string | null;
  estimated_total: number | null;
  actual_total: number | null;
  status: string;
  created_at: string;
}

interface Summary {
  in_progress: number;
  pending: number;
  this_month: number;
}

interface ApiResponse {
  data: RepairOrder[];
  total: number;
  pages: number;
  summary: Summary;
}

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "new", label: "Новый" },
  { value: "estimated", label: "Оценён" },
  { value: "pending_approval", label: "На согласовании" },
  { value: "approved", label: "Согласован" },
  { value: "in_progress", label: "В работе" },
  { value: "work_done", label: "Работа выполнена" },
  { value: "accepted", label: "Принят" },
  { value: "closed", label: "Закрыт" },
  { value: "cancelled", label: "Отменён" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Все типы" },
  { value: "planned_to1", label: "ТО-1" },
  { value: "planned_to2", label: "ТО-2" },
  { value: "current", label: "Текущий" },
  { value: "emergency", label: "Аварийный" },
];

const REPAIR_TYPE_LABELS: Record<string, string> = {
  planned_to1: "ТО-1",
  planned_to2: "ТО-2",
  current: "Текущий",
  emergency: "Аварийный",
};

const LOCATION_OPTIONS = [
  { value: "internal", label: "Собственная база" },
  { value: "external", label: "Внешний сервис" },
  { value: "roadside", label: "На линии" },
];

const URGENCY_OPTIONS = [
  { value: "low", label: "Низкая" },
  { value: "medium", label: "Средняя" },
  { value: "high", label: "Высокая" },
  { value: "critical", label: "Критическая" },
];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-600 text-slate-100",
  estimated: "bg-blue-600 text-blue-100",
  pending_approval: "bg-amber-600 text-amber-100",
  approved: "bg-green-600 text-green-100",
  in_progress: "bg-cyan-600 text-cyan-100",
  work_done: "bg-purple-600 text-purple-100",
  accepted: "bg-emerald-600 text-emerald-100",
  closed: "bg-green-700 text-green-100",
  cancelled: "bg-red-600 text-red-100",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  estimated: "Оценён",
  pending_approval: "На согласовании",
  approved: "Согласован",
  in_progress: "В работе",
  work_done: "Выполнен",
  accepted: "Принят",
  closed: "Закрыт",
  cancelled: "Отменён",
};

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] || "bg-slate-600 text-slate-100";
  const label = STATUS_LABELS[status] || status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function RepairsPage() {
  const router = useRouter();
  const [data, setData] = useState<RepairOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [summary, setSummary] = useState<Summary>({ in_progress: 0, pending: 0, this_month: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_number: "",
    repair_type: "current",
    location_type: "internal",
    urgency: "medium",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchRepairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (vehicleSearch.trim()) params.set("vehicle", vehicleSearch.trim());
      if (typeFilter) params.set("type", typeFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/repairs?${params.toString()}`);
      if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`);
      const json: ApiResponse = await res.json();
      setData(json.data);
      setTotal(json.total);
      setPages(json.pages);
      setSummary(json.summary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, vehicleSearch, typeFilter, page]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, vehicleSearch, typeFilter]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.vehicle_number.trim()) errors.vehicle_number = "Укажите гос. номер";
    if (!formData.description.trim()) errors.description = "Укажите описание";
    else if (formData.description.trim().length < 10) errors.description = "Минимум 10 символов";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_number: formData.vehicle_number.trim(),
          repair_type: formData.repair_type,
          location_type: formData.location_type,
          urgency: formData.urgency,
          description: formData.description.trim(),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Ошибка создания: ${res.status}`);
      }
      setShowModal(false);
      setFormData({ vehicle_number: "", repair_type: "current", location_type: "internal", urgency: "medium", description: "" });
      setFormErrors({});
      setPage(1);
      fetchRepairs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка при создании наряда");
    } finally {
      setCreating(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setFormErrors({});
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-7 h-7 text-cyan-400" />
            🔧 Ремонты
          </h1>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Новый наряд
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-900/50 rounded-lg">
                <Loader2 className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">В работе</p>
                <p className="text-2xl font-bold text-cyan-400">{summary.in_progress}</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-900/50 rounded-lg">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Ожидают</p>
                <p className="text-2xl font-bold text-amber-400">{summary.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-900/50 rounded-lg">
                <CalendarDays className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">За месяц</p>
                <p className="text-2xl font-bold text-green-400">{summary.this_month}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Статус</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Машина</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  placeholder="Поиск по номеру..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Тип ремонта</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">№</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Машина / Тип</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Описание</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Механик</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Стоимость</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                      <p className="text-slate-400">Загрузка...</p>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <Truck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400">Нарядов не найдено</p>
                    </td>
                  </tr>
                ) : (
                  data.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/repair/${order.id}`)}
                      className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-slate-300">{order.order_number}</span>
                        <div className="text-xs text-slate-500">{formatDate(order.created_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-200">{order.vehicle_number}</span>
                        <div className="text-xs text-slate-400">{REPAIR_TYPE_LABELS[order.repair_type] || order.repair_type}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-300 line-clamp-2 max-w-xs block">
                          {order.description}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{order.mechanic_name || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-slate-200">
                          {formatCurrency(order.actual_total ?? order.estimated_total)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <p className="text-sm text-slate-400">
                Показано {(page - 1) * limit + 1}–{Math.min(page * limit, total)} из {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-300 px-2">
                  {page} / {pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">Новый наряд на ремонт</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Vehicle Number */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Гос. номер ТС *</label>
                <input
                  type="text"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  placeholder="А123БВ777"
                  className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    formErrors.vehicle_number ? "border-red-500" : "border-slate-600"
                  }`}
                />
                {formErrors.vehicle_number && (
                  <p className="mt-1 text-xs text-red-400">{formErrors.vehicle_number}</p>
                )}
              </div>

              {/* Repair Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Тип ремонта</label>
                <select
                  value={formData.repair_type}
                  onChange={(e) => setFormData({ ...formData, repair_type: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="planned_to1">ТО-1 (плановое)</option>
                  <option value="planned_to2">ТО-2 (плановое)</option>
                  <option value="current">Текущий ремонт</option>
                  <option value="emergency">Аварийный ремонт</option>
                </select>
              </div>

              {/* Location Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Место ремонта</label>
                <select
                  value={formData.location_type}
                  onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {LOCATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Срочность</label>
                <select
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {URGENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Описание проблемы *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Опишите неисправность или требуемые работы (минимум 10 символов)..."
                  className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none ${
                    formErrors.description ? "border-red-500" : "border-slate-600"
                  }`}
                />
                {formErrors.description && (
                  <p className="mt-1 text-xs text-red-400">{formErrors.description}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">{formData.description.length} / мин. 10 символов</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Создать наряд
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
