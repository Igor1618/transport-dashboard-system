"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Wrench,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  FileText,
  Stethoscope,
  Package,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Archive,
  Ban,
  ClipboardCheck,
  Send,
  ShieldCheck,
  ThumbsDown,
  CalendarDays,
  User,
  Truck,
  Hash,
} from "lucide-react";

/* ─── Types ─── */

interface WorkItem {
  id: number;
  work_description: string;
  category: string;
  norm_hours: number;
  hourly_rate: number;
  estimated_cost: number;
  actual_hours: number | null;
  actual_cost: number | null;
  status: string;
}

interface Part {
  id: number;
  part_name: string;
  part_number: string | null;
  quantity: number;
  estimated_unit_price: number;
  actual_unit_price: number | null;
  estimated_total: number;
  actual_total: number | null;
  status: string;
}

interface Extra {
  id: number;
  description: string;
  amount: number;
  type: string;
}

interface LogEntry {
  id: number;
  action: string;
  description: string;
  user_name: string;
  created_at: string;
}

interface CostSummary {
  estimated_labor: number;
  actual_labor: number;
  estimated_parts: number;
  actual_parts: number;
  estimated_extras: number;
  actual_extras: number;
  overhead: number;
  estimated_total: number;
  actual_total: number;
}

interface RepairOrder {
  id: number;
  order_number: string;
  vehicle_number: string;
  vehicle_model: string | null;
  repair_type: string;
  location_type: string;
  urgency: string;
  status: string;
  description: string;
  diagnosis: string | null;
  mechanic_name: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  items: WorkItem[];
  parts: Part[];
  extras: Extra[];
  log: LogEntry[];
  cost_summary: CostSummary;
}

/* ─── Constants ─── */

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

const REPAIR_TYPE_LABELS: Record<string, string> = {
  planned_to1: "ТО-1",
  planned_to2: "ТО-2",
  current: "Текущий ремонт",
  emergency: "Аварийный ремонт",
};

const LOCATION_LABELS: Record<string, string> = {
  internal: "Собственная база",
  external: "Внешний сервис",
  roadside: "На линии",
};

const URGENCY_LABELS: Record<string, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
};

const URGENCY_COLORS: Record<string, string> = {
  low: "text-slate-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

const CATEGORY_OPTIONS = [
  { value: "mechanic", label: "Механические работы", rate: 1200 },
  { value: "electric", label: "Электрика", rate: 1400 },
  { value: "body", label: "Кузовные работы", rate: 1500 },
  { value: "diagnostic", label: "Диагностика", rate: 1600 },
  { value: "tire", label: "Шиномонтаж", rate: 1000 },
  { value: "paint", label: "Малярные работы", rate: 1800 },
  { value: "welding", label: "Сварочные работы", rate: 1300 },
  { value: "other", label: "Прочее", rate: 1100 },
];

const CATEGORY_RATES: Record<string, number> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.rate])
);

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.label])
);

type ActionDef = {
  label: string;
  action: string;
  icon: React.ElementType;
  color: string;
  confirm?: string;
};

const STATUS_ACTIONS: Record<string, ActionDef[]> = {
  new: [
    { label: "Составить смету", action: "estimate", icon: FileText, color: "bg-blue-600 hover:bg-blue-500" },
    { label: "Отменить", action: "cancel", icon: Ban, color: "bg-red-600 hover:bg-red-500", confirm: "Отменить наряд?" },
  ],
  estimated: [
    { label: "На согласование", action: "submit_approval", icon: Send, color: "bg-amber-600 hover:bg-amber-500" },
    { label: "Отменить", action: "cancel", icon: Ban, color: "bg-red-600 hover:bg-red-500", confirm: "Отменить наряд?" },
  ],
  pending_approval: [
    { label: "Согласовать", action: "approve", icon: ShieldCheck, color: "bg-green-600 hover:bg-green-500" },
    { label: "Отклонить", action: "reject", icon: ThumbsDown, color: "bg-red-600 hover:bg-red-500", confirm: "Отклонить наряд?" },
  ],
  approved: [
    { label: "Начать работу", action: "start", icon: Play, color: "bg-cyan-600 hover:bg-cyan-500" },
    { label: "Отменить", action: "cancel", icon: Ban, color: "bg-red-600 hover:bg-red-500", confirm: "Отменить наряд?" },
  ],
  in_progress: [
    { label: "Завершить работу", action: "complete", icon: CheckCircle2, color: "bg-purple-600 hover:bg-purple-500" },
  ],
  work_done: [
    { label: "Принять", action: "accept", icon: ClipboardCheck, color: "bg-emerald-600 hover:bg-emerald-500" },
    { label: "Вернуть в работу", action: "return", icon: RotateCcw, color: "bg-orange-600 hover:bg-orange-500" },
  ],
  accepted: [
    { label: "Закрыть", action: "close", icon: Archive, color: "bg-green-700 hover:bg-green-600" },
  ],
  closed: [],
  cancelled: [],
};

const LOG_ACTION_ICONS: Record<string, React.ElementType> = {
  created: Plus,
  estimated: FileText,
  submitted: Send,
  approved: ShieldCheck,
  rejected: ThumbsDown,
  started: Play,
  completed: CheckCircle2,
  accepted: ClipboardCheck,
  returned: RotateCcw,
  closed: Archive,
  cancelled: Ban,
  item_added: Wrench,
  part_added: Package,
  default: Clock,
};

/* ─── Helpers ─── */

function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "lg" }) {
  const colorClass = STATUS_COLORS[status] || "bg-slate-600 text-slate-100";
  const label = STATUS_LABELS[status] || status;
  const sizeClass = size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colorClass} ${sizeClass}`}>
      {label}
    </span>
  );
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─── Component ─── */

export default function RepairDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<RepairOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Add item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({
    work_description: "",
    category: "mechanic",
    norm_hours: "",
  });
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [savingItem, setSavingItem] = useState(false);

  // Add part modal
  const [showPartModal, setShowPartModal] = useState(false);
  const [partForm, setPartForm] = useState({
    part_name: "",
    quantity: "",
    estimated_unit_price: "",
  });
  const [partErrors, setPartErrors] = useState<Record<string, string>>({});
  const [savingPart, setSavingPart] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/repairs/${id}`);
      if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`);
      const json: RepairOrder = await res.json();
      setOrder(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки наряда");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  /* ─── Actions ─── */

  const handleAction = async (action: string, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActionLoading(action);
    try {
      const res = await fetch(`/api/repairs/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Ошибка: ${res.status}`);
      }
      await fetchOrder();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка выполнения действия");
    } finally {
      setActionLoading(null);
    }
  };

  /* ─── Add Work Item ─── */

  const validateItemForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!itemForm.work_description.trim()) errors.work_description = "Укажите описание работы";
    if (!itemForm.norm_hours || parseFloat(itemForm.norm_hours) <= 0) errors.norm_hours = "Укажите норма-часы";
    setItemErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddItem = async () => {
    if (!validateItemForm()) return;
    setSavingItem(true);
    try {
      const res = await fetch(`/api/repairs/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_description: itemForm.work_description.trim(),
          category: itemForm.category,
          norm_hours: parseFloat(itemForm.norm_hours),
          hourly_rate: CATEGORY_RATES[itemForm.category] || 1100,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Ошибка: ${res.status}`);
      }
      setShowItemModal(false);
      setItemForm({ work_description: "", category: "mechanic", norm_hours: "" });
      setItemErrors({});
      await fetchOrder();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка добавления работы");
    } finally {
      setSavingItem(false);
    }
  };

  /* ─── Add Part ─── */

  const validatePartForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!partForm.part_name.trim()) errors.part_name = "Укажите название запчасти";
    if (!partForm.quantity || parseInt(partForm.quantity) <= 0) errors.quantity = "Укажите количество";
    if (!partForm.estimated_unit_price || parseFloat(partForm.estimated_unit_price) <= 0) errors.estimated_unit_price = "Укажите цену";
    setPartErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddPart = async () => {
    if (!validatePartForm()) return;
    setSavingPart(true);
    try {
      const res = await fetch(`/api/repairs/${id}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_name: partForm.part_name.trim(),
          quantity: parseInt(partForm.quantity),
          estimated_unit_price: parseFloat(partForm.estimated_unit_price),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Ошибка: ${res.status}`);
      }
      setShowPartModal(false);
      setPartForm({ part_name: "", quantity: "", estimated_unit_price: "" });
      setPartErrors({});
      await fetchOrder();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка добавления запчасти");
    } finally {
      setSavingPart(false);
    }
  };

  /* ─── Render ─── */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-400">Загрузка наряда...</p>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={() => router.push("/repair")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к списку
          </button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const actions = STATUS_ACTIONS[order.status] || [];
  const canEdit = ["new", "estimated"].includes(order.status);
  const cs = order.cost_summary;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back + Error */}
        <button
          onClick={() => router.push("/repair")}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к списку
        </button>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Hash className="w-5 h-5 text-cyan-400" />
                  {order.order_number}
                </h1>
                <StatusBadge status={order.status} size="lg" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-slate-400 text-xs">Машина</p>
                    <p className="font-medium">{order.vehicle_number}</p>
                    {order.vehicle_model && <p className="text-xs text-slate-500">{order.vehicle_model}</p>}
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Тип ремонта</p>
                  <p className="font-medium">{REPAIR_TYPE_LABELS[order.repair_type] || order.repair_type}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Место</p>
                  <p className="font-medium">{LOCATION_LABELS[order.location_type] || order.location_type}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Срочность</p>
                  <p className={`font-medium ${URGENCY_COLORS[order.urgency] || "text-slate-300"}`}>
                    {URGENCY_LABELS[order.urgency] || order.urgency}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Создан: {formatDate(order.created_at)}
                </span>
                {order.started_at && (
                  <span className="flex items-center gap-1">
                    <Play className="w-3.5 h-3.5" />
                    Начат: {formatDate(order.started_at)}
                  </span>
                )}
                {order.completed_at && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Завершён: {formatDate(order.completed_at)}
                  </span>
                )}
                {order.mechanic_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {order.mechanic_name}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {actions.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.action}
                      onClick={() => handleAction(act.action, act.confirm)}
                      disabled={actionLoading !== null}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${act.color}`}
                    >
                      {actionLoading === act.action ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                      {act.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Description + Diagnosis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Описание
            </h2>
            <p className="text-slate-300 whitespace-pre-wrap">{order.description || "—"}</p>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-purple-400" />
              Диагноз
            </h2>
            <p className="text-slate-300 whitespace-pre-wrap">{order.diagnosis || "Диагностика не проведена"}</p>
          </div>
        </div>

        {/* Work Items */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6">
          <div className="flex items-center justify-between p-5 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Wrench className="w-4 h-4 text-cyan-400" />
              Работы ({order.items.length})
            </h2>
            {canEdit && (
              <button
                onClick={() => setShowItemModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-900/40 hover:bg-cyan-900/60 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить работу
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Описание работы</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Категория</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Норма-ч</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Ставка</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Оценка</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Факт. часы</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Факт. стоим.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {order.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                      Работы не добавлены
                    </td>
                  </tr>
                ) : (
                  order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-2.5 text-sm text-slate-200">{item.work_description}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-400">{CATEGORY_LABELS[item.category] || item.category}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-300 text-right">{item.norm_hours}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-300 text-right">{formatCurrency(item.hourly_rate)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-200 text-right font-medium">{formatCurrency(item.estimated_cost)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-300 text-right">{item.actual_hours ?? "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-200 text-right font-medium">{formatCurrency(item.actual_cost)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Parts */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6">
          <div className="flex items-center justify-between p-5 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" />
              Запчасти ({order.parts.length})
            </h2>
            {canEdit && (
              <button
                onClick={() => setShowPartModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-900/40 hover:bg-amber-900/60 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить запчасть
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Наименование</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Кол-во</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Цена (план)</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Сумма (план)</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Цена (факт)</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Сумма (факт)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {order.parts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                      Запчасти не добавлены
                    </td>
                  </tr>
                ) : (
                  order.parts.map((part) => (
                    <tr key={part.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-2.5 text-sm text-slate-200">
                        {part.part_name}
                        {part.part_number && (
                          <span className="text-xs text-slate-500 ml-2">#{part.part_number}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-300 text-right">{part.quantity}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-300 text-right">{formatCurrency(part.estimated_unit_price)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-200 text-right font-medium">{formatCurrency(part.estimated_total)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-300 text-right">{formatCurrency(part.actual_unit_price)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-200 text-right font-medium">{formatCurrency(part.actual_total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Summary */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6 p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Итого по стоимости
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Статья</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-400">План</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-400">Факт</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-400">Разница</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {[
                  { label: "Работы", est: cs.estimated_labor, act: cs.actual_labor },
                  { label: "Запчасти", est: cs.estimated_parts, act: cs.actual_parts },
                  { label: "Доп. расходы", est: cs.estimated_extras, act: cs.actual_extras },
                  { label: "Накладные", est: cs.overhead, act: cs.overhead },
                ].map((row) => {
                  const diff = (row.act || 0) - (row.est || 0);
                  return (
                    <tr key={row.label} className="hover:bg-slate-700/30">
                      <td className="px-4 py-2.5 text-sm text-slate-300">{row.label}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-300 text-right">{formatCurrency(row.est)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-200 text-right font-medium">{formatCurrency(row.act)}</td>
                      <td className={`px-4 py-2.5 text-sm text-right font-medium ${diff > 0 ? "text-red-400" : diff < 0 ? "text-green-400" : "text-slate-400"}`}>
                        {diff === 0 ? "—" : `${diff > 0 ? "+" : ""}${formatCurrency(diff)}`}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-600 bg-slate-700/30">
                  <td className="px-4 py-3 text-sm font-bold text-slate-100">ИТОГО</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-100 text-right">{formatCurrency(cs.estimated_total)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-100 text-right">{formatCurrency(cs.actual_total)}</td>
                  <td className={`px-4 py-3 text-sm font-bold text-right ${(cs.actual_total - cs.estimated_total) > 0 ? "text-red-400" : (cs.actual_total - cs.estimated_total) < 0 ? "text-green-400" : "text-slate-400"}`}>
                    {cs.actual_total - cs.estimated_total === 0
                      ? "—"
                      : `${cs.actual_total - cs.estimated_total > 0 ? "+" : ""}${formatCurrency(cs.actual_total - cs.estimated_total)}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Extras (if any) */}
        {order.extras.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6">
            <div className="p-5 border-b border-slate-700">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-400" />
                Дополнительные расходы ({order.extras.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Описание</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Тип</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {order.extras.map((extra) => (
                    <tr key={extra.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-2.5 text-sm text-slate-200">{extra.description}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-400">{extra.type}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-200 text-right font-medium">{formatCurrency(extra.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Log */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            История изменений
          </h2>
          {order.log.length === 0 ? (
            <p className="text-sm text-slate-500">История пуста</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700" />
              <div className="space-y-4">
                {order.log.map((entry, idx) => {
                  const IconComp = LOG_ACTION_ICONS[entry.action] || LOG_ACTION_ICONS.default;
                  return (
                    <div key={entry.id} className="relative pl-10">
                      <div className="absolute left-2 top-1 w-5 h-5 bg-slate-800 rounded-full border-2 border-slate-600 flex items-center justify-center">
                        <IconComp className="w-2.5 h-2.5 text-slate-400" />
                      </div>
                      <div className={`${idx === 0 ? "bg-slate-700/40" : ""} rounded-lg p-3`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-200">{entry.description}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {entry.user_name}
                          </span>
                          <span>{formatDateTime(entry.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Work Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowItemModal(false)} />
          <div className="relative bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">Добавить работу</h2>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Описание работы *</label>
                <textarea
                  value={itemForm.work_description}
                  onChange={(e) => setItemForm({ ...itemForm, work_description: e.target.value })}
                  rows={3}
                  placeholder="Опишите выполняемую работу..."
                  className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none ${
                    itemErrors.work_description ? "border-red-500" : "border-slate-600"
                  }`}
                />
                {itemErrors.work_description && (
                  <p className="mt-1 text-xs text-red-400">{itemErrors.work_description}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Категория</label>
                <select
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({formatCurrency(opt.rate)}/ч)
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Ставка: {formatCurrency(CATEGORY_RATES[itemForm.category] || 1100)}/час
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Норма-часы *</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={itemForm.norm_hours}
                  onChange={(e) => setItemForm({ ...itemForm, norm_hours: e.target.value })}
                  placeholder="0.0"
                  className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    itemErrors.norm_hours ? "border-red-500" : "border-slate-600"
                  }`}
                />
                {itemErrors.norm_hours && (
                  <p className="mt-1 text-xs text-red-400">{itemErrors.norm_hours}</p>
                )}
                {itemForm.norm_hours && parseFloat(itemForm.norm_hours) > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    Ориентировочная стоимость:{" "}
                    {formatCurrency(
                      parseFloat(itemForm.norm_hours) * (CATEGORY_RATES[itemForm.category] || 1100)
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
              <button
                onClick={() => setShowItemModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleAddItem}
                disabled={savingItem}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                {savingItem && <Loader2 className="w-4 h-4 animate-spin" />}
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Part Modal */}
      {showPartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPartModal(false)} />
          <div className="relative bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-slate-100">Добавить запчасть</h2>
              <button onClick={() => setShowPartModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Наименование *</label>
                <input
                  type="text"
                  value={partForm.part_name}
                  onChange={(e) => setPartForm({ ...partForm, part_name: e.target.value })}
                  placeholder="Масляный фильтр, колодки тормозные и т.д."
                  className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    partErrors.part_name ? "border-red-500" : "border-slate-600"
                  }`}
                />
                {partErrors.part_name && (
                  <p className="mt-1 text-xs text-red-400">{partErrors.part_name}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Количество *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={partForm.quantity}
                    onChange={(e) => setPartForm({ ...partForm, quantity: e.target.value })}
                    placeholder="1"
                    className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      partErrors.quantity ? "border-red-500" : "border-slate-600"
                    }`}
                  />
                  {partErrors.quantity && (
                    <p className="mt-1 text-xs text-red-400">{partErrors.quantity}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Цена за ед. (₽) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={partForm.estimated_unit_price}
                    onChange={(e) => setPartForm({ ...partForm, estimated_unit_price: e.target.value })}
                    placeholder="0.00"
                    className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      partErrors.estimated_unit_price ? "border-red-500" : "border-slate-600"
                    }`}
                  />
                  {partErrors.estimated_unit_price && (
                    <p className="mt-1 text-xs text-red-400">{partErrors.estimated_unit_price}</p>
                  )}
                </div>
              </div>
              {partForm.quantity && partForm.estimated_unit_price &&
                parseInt(partForm.quantity) > 0 && parseFloat(partForm.estimated_unit_price) > 0 && (
                  <p className="text-xs text-slate-400">
                    Итого: {formatCurrency(parseInt(partForm.quantity) * parseFloat(partForm.estimated_unit_price))}
                  </p>
                )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
              <button
                onClick={() => setShowPartModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleAddPart}
                disabled={savingPart}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                {savingPart && <Loader2 className="w-4 h-4 animate-spin" />}
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
