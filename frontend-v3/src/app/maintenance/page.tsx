"use client";
import ExcelExport from "@/components/ExcelExport";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wrench, Plus, Search, X, Filter, RefreshCw, Calendar,
  Clock, ChevronDown, Truck, AlertTriangle, CheckCircle,
  Settings, Package, Edit, RotateCcw,
} from "lucide-react";
import { apiFetch } from "@/shared/utils/apiFetch";
import { pluralize, pRepair } from "@/shared/utils/pluralize";
import { useAuth } from "@/components/AuthProvider";

// ==================== Types ====================
interface Vehicle {
  id: string;
  license_plate: string;
  model?: string;
  total_mileage?: number;
}

interface Repair {
  id: string;
  vehicle_id: string;
  license_plate?: string;
  vehicle_model?: string;
  type: "breakdown" | "to1" | "to2" | "tires" | "other";
  description?: string;
  started_at: string;
  completed_at?: string;
  mechanic_name?: string;
  parts_cost?: number;
  labor_cost?: number;
  status: "in_progress" | "waiting_parts" | "completed";
}

interface ScheduleEntry {
  id: string;
  vehicle_id: string;
  license_plate?: string;
  vehicle_model?: string;
  type: "to1" | "to2" | "tires";
  interval_km: number;
  last_done_km: number;
  next_due_km: number;
  vehicle_mileage?: number;
  current_km?: number;
  status?: "overdue" | "upcoming" | "ok";
  alert_threshold_km?: number;
}

interface SparePart {
  id: string;
  name: string;
  vehicle_id?: string;
  license_plate?: string;
  maintenance_id?: string;
  quantity: number;
  price?: number;
  supplier?: string;
  eta_delivery?: string;
  status: "needed" | "ordered" | "in_stock" | "installed";
}

type Tab = "active" | "schedule" | "history" | "parts";

// ==================== Helpers ====================
const fmt = (n: number | null | undefined, d = 0) =>
  n == null || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const typeLabels: Record<string, string> = {
  breakdown: "Поломка",
  to1: "ТО-1",
  to2: "ТО-2",
  tires: "Шины",
  other: "Другое",
};

const statusBadge = (status: string) => {
  switch (status) {
    case "in_progress": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-400">🔴 В работе</span>;
    case "waiting_parts": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-400">🟡 Ждём запчасти</span>;
    case "completed": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-400">🟢 Готово</span>;
    default: return <span className="text-xs text-slate-400">{status}</span>;
  }
};

const partStatusLabels: Record<string, string> = {
  needed: "Нужна",
  ordered: "Заказана",
  in_stock: "На складе",
  installed: "Установлена",
};

const partStatusColors: Record<string, string> = {
  needed: "bg-red-900/50 text-red-400",
  ordered: "bg-yellow-900/50 text-yellow-400",
  in_stock: "bg-blue-900/50 text-blue-400",
  installed: "bg-green-900/50 text-green-400",
};

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

// ==================== Repair Modal ====================
function RepairModal({ repair, vehicles, onClose, onSave }: {
  repair: Repair | null; vehicles: Vehicle[]; onClose: () => void; onSave: () => void;
}) {
  const isEdit = !!repair;
  const [vehicleId, setVehicleId] = useState(repair?.vehicle_id || "");
  const [type, setType] = useState(repair?.type || "breakdown");
  const [description, setDescription] = useState(repair?.description || "");
  const [mechanicName, setMechanicName] = useState(repair?.mechanic_name || "");
  const [partsCost, setPartsCost] = useState(repair?.parts_cost?.toString() || "");
  const [laborCost, setLaborCost] = useState(repair?.labor_cost?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!vehicleId) { setError("Выберите ТС"); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        vehicle_id: vehicleId,
        type,
        description,
        mechanic_name: mechanicName,
        parts_cost: partsCost ? parseFloat(partsCost) : 0,
        labor_cost: laborCost ? parseFloat(laborCost) : 0,
      };
      const url = isEdit ? `/api/maintenance/${repair!.id}` : "/api/maintenance/";
      const method = isEdit ? "PATCH" : "POST";
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Ошибка сохранения"); }
      onSave();
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">{isEdit ? "📝 Редактировать ремонт" : "➕ Новый ремонт"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">


          <div>
            <label className="text-sm text-slate-400 mb-1 block">Транспортное средство</label>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none">
              <option value="">Выберите ТС...</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.license_plate} {v.model ? `(${v.model})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Тип работ</label>
            <select value={type} onChange={e => setType(e.target.value as any)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none">
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none" placeholder="Что делаем..." />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Механик</label>
            <input type="text" value={mechanicName} onChange={e => setMechanicName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="Имя механика" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Запчасти ₽</label>
              <input type="number" step="0.01" value={partsCost} onChange={e => setPartsCost(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="0" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Работа ₽</label>
              <input type="number" step="0.01" value={laborCost} onChange={e => setLaborCost(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="0" />
            </div>
          </div>
          {error && <div className="text-red-400 text-sm bg-red-900/30 p-2 rounded">{error}</div>}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            {saving ? "Сохранение..." : isEdit ? "💾 Сохранить" : "➕ Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Schedule Modal ====================
function ScheduleModal({ entry, vehicles, onClose, onSave }: {
  entry: ScheduleEntry | null; vehicles: Vehicle[]; onClose: () => void; onSave: () => void;
}) {
  const isEdit = !!entry;
  const [vehicleId, setVehicleId] = useState(entry?.vehicle_id || "");
  const [type, setType] = useState(entry?.type || "to1");
  const [intervalKm, setIntervalKm] = useState(entry?.interval_km?.toString() || "");
  const [lastDoneKm, setLastDoneKm] = useState(entry?.last_done_km?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!vehicleId) { setError("Выберите ТС"); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        vehicle_id: vehicleId,
        type,
        interval_km: parseFloat(intervalKm) || 0,
        last_done_km: parseFloat(lastDoneKm) || 0,
      };
      const url = isEdit ? `/api/maintenance/schedule/${entry!.id}` : "/api/maintenance/schedule";
      const method = isEdit ? "PATCH" : "POST";
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Ошибка"); }
      onSave();
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">{isEdit ? "📝 Редактировать расписание" : "➕ Новое расписание ТО"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Транспортное средство</label>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none">
              <option value="">Выберите ТС...</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.license_plate} {v.model ? `(${v.model})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Тип ТО</label>
            <select value={type} onChange={e => setType(e.target.value as any)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none">
              <option value="to1">ТО-1</option>
              <option value="to2">ТО-2</option>
              <option value="tires">Шины</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Интервал (км)</label>
            <input type="number" value={intervalKm} onChange={e => setIntervalKm(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="15000" />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Последнее ТО на (км)</label>
            <input type="number" value={lastDoneKm} onChange={e => setLastDoneKm(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="120000" />
          </div>
          {error && <div className="text-red-400 text-sm bg-red-900/30 p-2 rounded">{error}</div>}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            {saving ? "Сохранение..." : isEdit ? "💾 Сохранить" : "➕ Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Part Modal ====================
function PartModal({ part, vehicles, onClose, onSave }: {
  part: SparePart | null; vehicles: Vehicle[]; onClose: () => void; onSave: () => void;
}) {
  const isEdit = !!part;
  const [name, setName] = useState(part?.name || "");
  const [vehicleId, setVehicleId] = useState(part?.vehicle_id || "");
  const [maintenanceId, setMaintenanceId] = useState(part?.maintenance_id || "");
  const [quantity, setQuantity] = useState(part?.quantity?.toString() || "1");
  const [price, setPrice] = useState(part?.price?.toString() || "");
  const [supplier, setSupplier] = useState(part?.supplier || "");
  const [etaDelivery, setEtaDelivery] = useState(part?.eta_delivery?.slice(0, 10) || "");
  const [status, setStatus] = useState(part?.status || "needed");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name) { setError("Введите название"); return; }
    setSaving(true);
    setError(null);
    try {
      const body: any = {
        name, quantity: parseInt(quantity) || 1,
        price: price ? parseFloat(price) : null,
        supplier: supplier || null,
        eta_delivery: etaDelivery || null,
        status,
      };
      if (vehicleId) body.vehicle_id = vehicleId;
      if (maintenanceId) body.maintenance_id = maintenanceId;
      const url = isEdit ? `/api/maintenance/parts/${part!.id}` : "/api/maintenance/parts";
      const method = isEdit ? "PATCH" : "POST";
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Ошибка"); }
      onSave();
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">{isEdit ? "📝 Редактировать запчасть" : "➕ Новая запчасть"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Название</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="Фильтр масляный..." />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Транспортное средство</label>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none">
              <option value="">Не указано</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.license_plate} {v.model ? `(${v.model})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">ID ремонта (опционально)</label>
            <input type="text" value={maintenanceId} onChange={e => setMaintenanceId(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="UUID ремонта" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Кол-во</label>
              <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Цена ₽</label>
              <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Поставщик</label>
            <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" placeholder="Автодок, Exist..." />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Дата доставки</label>
            <input type="date" value={etaDelivery} onChange={e => setEtaDelivery(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Статус</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none">
              {Object.entries(partStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {error && <div className="text-red-400 text-sm bg-red-900/30 p-2 rounded">{error}</div>}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            {saving ? "Сохранение..." : isEdit ? "💾 Сохранить" : "➕ Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Main Page ====================
export default function MaintenancePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  useEffect(() => { apiFetch("/api/maintenance/dashboard").then(r => r.ok ? r.json() : null).then(d => d && setDashboardData(d)).catch(() => {}); }, []);

  // Active repairs
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [repairsLoading, setRepairsLoading] = useState(false);

  // Schedule
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // History
  const [history, setHistory] = useState<Repair[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyVehicleFilter, setHistoryVehicleFilter] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");

  // Parts
  const [parts, setParts] = useState<SparePart[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsStatusFilter, setPartsStatusFilter] = useState<string>("all");

  // Modals
  const [repairModal, setRepairModal] = useState<{ open: boolean; repair: Repair | null }>({ open: false, repair: null });
  const [scheduleModal, setScheduleModal] = useState<{ open: boolean; entry: ScheduleEntry | null }>({ open: false, entry: null });
  const [partModal, setPartModal] = useState<{ open: boolean; part: SparePart | null }>({ open: false, part: null });

  // Load vehicles
  useEffect(() => {
    (async () => {
      try {
        const d = await (await apiFetch("/api/maintenance/vehicles")).json();


        const list = Array.isArray(d) ? d : d.vehicles || [];
        setVehicles(list.map((v: any) => ({ id: v.id, license_plate: v.license_plate || v.plate || "", model: v.model || v.vehicle_model || "", total_mileage: v.total_mileage || v.mileage || 0 })));
      } catch {}
    })();
  }, []);

  // Load active repairs
  const loadRepairs = useCallback(async () => {
    setRepairsLoading(true);
    try {
      const d = await (await apiFetch("/api/maintenance/")).json();
      setRepairs(Array.isArray(d) ? d : d.repairs || d.data || []);
    } catch {}
    finally { setRepairsLoading(false); }
  }, []);

  // Load schedule
  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const d = await (await apiFetch("/api/maintenance/schedule")).json();
      setSchedule(Array.isArray(d) ? d : d.schedule || d.data || []);
    } catch {}
    finally { setScheduleLoading(false); }
  }, []);

  // Load history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historyVehicleFilter) params.set("vehicle_id", historyVehicleFilter);
      if (historyTypeFilter) params.set("type", historyTypeFilter);
      if (historyDateFrom) params.set("date_from", historyDateFrom);
      if (historyDateTo) params.set("date_to", historyDateTo);
      const d = await (await apiFetch(`/api/maintenance/history?${params}`)).json();
      setHistory(Array.isArray(d) ? d : d.history || d.data || []);
    } catch {}
    finally { setHistoryLoading(false); }
  }, [historyVehicleFilter, historyTypeFilter, historyDateFrom, historyDateTo]);

  // Load parts
  const loadParts = useCallback(async () => {
    setPartsLoading(true);
    try {
      const params = new URLSearchParams();
      if (partsStatusFilter !== "all") params.set("status", partsStatusFilter);
      const d = await (await apiFetch(`/api/maintenance/parts?${params}`)).json();
      setParts(Array.isArray(d) ? d : d.parts || d.data || []);
    } catch {}
    finally { setPartsLoading(false); }
  }, [partsStatusFilter]);

  useEffect(() => { loadRepairs(); }, [loadRepairs]);
  useEffect(() => { if (activeTab === "schedule" || activeTab === "active") loadSchedule(); }, [activeTab, loadSchedule]);
  useEffect(() => { if (activeTab === "history") loadHistory(); }, [activeTab, loadHistory]);
  useEffect(() => { if (activeTab === "parts") loadParts(); }, [activeTab, loadParts]);

  const activeRepairs = useMemo(() => repairs.filter(r => r.status !== "completed"), [repairs]);

  const handleComplete = async (id: string) => {
    try {
      const r = await apiFetch(`/api/maintenance/${id}/complete`, { method: "PATCH" });
      if (r.ok) loadRepairs();
    } catch {}
  };

  const handlePartStatusChange = async (partId: string, newStatus: string) => {
    try {
      const r = await apiFetch(`/api/maintenance/parts/${partId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) loadParts();
    } catch {}
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "active", label: "Сейчас чиним", icon: <Wrench size={16} />, count: activeRepairs.length },
    { key: "schedule", label: "Плановое ТО", icon: <Calendar size={16} /> },
    { key: "history", label: "История", icon: <Clock size={16} /> },
    { key: "parts", label: "Запчасти", icon: <Package size={16} /> },
  ];

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wrench size={28} className="text-orange-400" /> Механик
        </h1>
          <ExcelExport type="repairs" label="📥 Excel ремонтов" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-700 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === tab.key ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
            }`}>
            {tab.icon}
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.key ? "bg-blue-500/30 text-blue-300" : "bg-slate-700 text-slate-400"
              }`}>{tab.count}</span>
            )}
            {/* Dashboard Summary */}
        {dashboardData?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{dashboardData.stats.active_tasks}</div>
              <div className="text-xs text-slate-400">Активных задач</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{dashboardData.stats.completed_30d}</div>
              <div className="text-xs text-slate-400">Завершено за 30д</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{Number(dashboardData.stats.cost_30d || 0).toLocaleString("ru-RU")}₽</div>
              <div className="text-xs text-slate-400">Расходы за 30д</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold" style={{color: dashboardData.stats.low_stock_count > 0 ? '#f87171' : '#4ade80'}}>{dashboardData.stats.low_stock_count}</div>
              <div className="text-xs text-slate-400">Запчасти на исходе</div>
            </div>
          </div>
        )}
        {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-t" />}
          </button>
        ))}
      </div>

      {/* ==================== TAB: ACTIVE REPAIRS ==================== */}
      {activeTab === "active" && (
        <div>
          {/* Dashboard summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className="text-2xl font-bold text-white">{activeRepairs.length}</div>
              <div className="text-xs text-slate-400">В работе</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className="text-2xl font-bold text-red-400">{schedule.filter((s: any) => s.status === "overdue").length}</div>
              <div className="text-xs text-slate-400">Просрочено ТО</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className="text-2xl font-bold text-yellow-400">{schedule.filter((s: any) => s.status === "upcoming").length}</div>
              <div className="text-xs text-slate-400">ТО скоро</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className="text-2xl font-bold text-green-400">{repairs.filter((r: any) => r.status === "completed").length}</div>
              <div className="text-xs text-slate-400">Завершено (всего)</div>
            </div>
          </div>

          {/* Overdue TO alert */}
          {schedule.filter((s: any) => s.status === "overdue").length > 0 && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 mb-4">
              <div className="text-sm font-medium text-red-400 mb-2">⚠️ Просроченное ТО ({schedule.filter((s: any) => s.status === "overdue").length})</div>
              {schedule.filter((s: any) => s.status === "overdue").slice(0, 5).map((s: any) => (
                <div key={s.id} className="text-xs text-red-300/80 ml-2">├ {s.license_plate} — {s.maintenance_type || s.type} просрочено</div>
              ))}
              <button onClick={() => setActiveTab("schedule")} className="text-xs text-red-400 underline mt-1">Подробнее →</button>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-400">Активных ремонтов: <span className="text-white font-bold">{activeRepairs.length}</span></span>
            <div className="flex gap-2">
              <button onClick={loadRepairs} className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 transition">
                <RefreshCw size={16} className={repairsLoading ? "animate-spin" : ""} />
              </button>
              <button onClick={() => setRepairModal({ open: true, repair: null })}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition">
                <Plus size={16} /> Новый ремонт
              </button>
            </div>
          </div>

          {repairsLoading && activeRepairs.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
              <RefreshCw size={32} className="animate-spin mx-auto mb-3" /> Загрузка...
            </div>
          ) : activeRepairs.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Нет активных задач</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeRepairs.map(r => {
                const days = daysSince(r.started_at);
                const total = (r.parts_cost || 0) + (r.labor_cost || 0);
                return (
                  <div key={r.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <Truck size={16} className="text-blue-400" />
                          {r.license_plate || "—"}
                          {r.vehicle_model && <span className="text-xs text-slate-400 font-normal">({r.vehicle_model})</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          <span className="inline-block bg-slate-700 px-2 py-0.5 rounded mr-2">{typeLabels[r.type] || r.type}</span>
                          {statusBadge(r.status)}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <div className={`font-bold text-lg ${days > 3 ? "text-red-400" : days > 1 ? "text-yellow-400" : "text-green-400"}`}>
                          {days} дн.
                        </div>
                        <div>с {fmtDate(r.started_at)}</div>
                      </div>
                    </div>

                    {r.description && (
                      <p className="text-sm text-slate-300 mb-3 line-clamp-2">{r.description}</p>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                      {r.mechanic_name && <span>👨‍🔧 {r.mechanic_name}</span>}
                      <span className="font-mono">
                        {r.parts_cost ? `${fmt(r.parts_cost)} зч` : ""}
                        {r.parts_cost && r.labor_cost ? " + " : ""}
                        {r.labor_cost ? `${fmt(r.labor_cost)} раб` : ""}
                        {total > 0 && <span className="font-bold text-white ml-1">= {fmt(total)} ₽</span>}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => handleComplete(r.id)}
                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-green-600/20 text-green-400 hover:bg-green-600/40 transition">
                        ✅ Готова
                      </button>
                      <button onClick={() => setRepairModal({ open: true, repair: r })}
                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition">
                        📝 Редактировать
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: SCHEDULE ==================== */}
      {activeTab === "schedule" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-400">Записей в расписании: <span className="text-white font-bold">{schedule.length}</span></span>
            <div className="flex gap-2">
              <button onClick={loadSchedule} className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 transition">
                <RefreshCw size={16} className={scheduleLoading ? "animate-spin" : ""} />
              </button>
              <button onClick={() => setScheduleModal({ open: true, entry: null })}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition">
                <Plus size={16} /> Добавить
              </button>
            </div>
          </div>

          {scheduleLoading && schedule.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
              <RefreshCw size={32} className="animate-spin mx-auto mb-3" /> Загрузка...
            </div>
          ) : schedule.length === 0 ? null : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                    <th className="px-3 py-2 text-left">ТС</th>
                    <th className="px-3 py-2 text-left">Тип</th>
                    <th className="px-3 py-2 text-right">Интервал км</th>
                    <th className="px-3 py-2 text-right">Последнее км</th>
                    <th className="px-3 py-2 text-right">Следующее км</th>
                    <th className="px-3 py-2 text-right">Текущий км</th>
                    <th className="px-3 py-2 text-right">Остаток км</th>
                    <th className="px-3 py-2 text-center">Статус</th>
                    <th className="px-3 py-2 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map(s => {
                    const mileage = s.current_km ?? s.vehicle_mileage ?? 0;
                    const remaining = s.next_due_km - mileage;
                    const apiStatus = s.status || (remaining < 0 ? 'overdue' : remaining < (s.alert_threshold_km || 1000) ? 'upcoming' : 'ok');
                    const remainColor = apiStatus === 'overdue' ? "text-red-400" : apiStatus === 'upcoming' ? "text-yellow-400" : "text-green-400";
                    const remainBadge = apiStatus === 'overdue' ? "🔴" : apiStatus === 'upcoming' ? "🟡" : "🟢";
                    return (
                      <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-2 font-medium text-white">{s.license_plate || "—"} {s.vehicle_model && <span className="text-xs text-slate-400">({s.vehicle_model})</span>}</td>
                        <td className="px-3 py-2 text-slate-300">{typeLabels[s.type] || s.type}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300">{fmt(s.interval_km)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300">{fmt(s.last_done_km)}</td>
                        <td className="px-3 py-2 text-right font-mono text-white font-bold">{fmt(s.next_due_km)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300">{fmt(mileage)}</td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${remainColor}`}>{fmt(remaining)} км</td>
                        <td className="px-3 py-2 text-center">{remainBadge}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => setScheduleModal({ open: true, entry: s })}
                            className="p-1.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition">
                            <Edit size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: HISTORY ==================== */}
      {activeTab === "history" && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select value={historyVehicleFilter} onChange={e => setHistoryVehicleFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none">
              <option value="">Все ТС</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.license_plate}</option>)}
            </select>
            <select value={historyTypeFilter} onChange={e => setHistoryTypeFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:outline-none">
              <option value="">Все типы</option>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            <input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            {(historyVehicleFilter || historyTypeFilter || historyDateFrom || historyDateTo) && (
              <button onClick={() => { setHistoryVehicleFilter(""); setHistoryTypeFilter(""); setHistoryDateFrom(""); setHistoryDateTo(""); }}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><RotateCcw size={12} /> Сбросить</button>
            )}
            <button onClick={loadHistory} className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 transition ml-auto">
              <RefreshCw size={16} className={historyLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {historyLoading && history.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
              <RefreshCw size={32} className="animate-spin mx-auto mb-3" /> Загрузка...
            </div>
          ) : history.length === 0 ? null : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                    <th className="px-3 py-2 text-left">ТС</th>
                    <th className="px-3 py-2 text-left">Тип</th>
                    <th className="px-3 py-2 text-left">Описание</th>
                    <th className="px-3 py-2 text-left">Механик</th>
                    <th className="px-3 py-2 text-right">Стоимость</th>
                    <th className="px-3 py-2 text-right">Начало</th>
                    <th className="px-3 py-2 text-right">Завершено</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-3 py-2 font-medium text-white">{h.license_plate || "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{typeLabels[h.type] || h.type}</td>
                      <td className="px-3 py-2 text-slate-400 max-w-[300px] truncate">{h.description || "—"}</td>
                      <td className="px-3 py-2 text-slate-400">{h.mechanic_name || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-white">{fmt((h.parts_cost || 0) + (h.labor_cost || 0))} ₽</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{fmtDate(h.started_at)}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{fmtDate(h.completed_at || null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: PARTS ==================== */}
      {activeTab === "parts" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Запчасти:</span>
              {["all", "needed", "ordered", "in_stock", "installed"].map(s => (
                <button key={s} onClick={() => setPartsStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    partsStatusFilter === s ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"
                  }`}>
                  {s === "all" ? "Все" : partStatusLabels[s]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={loadParts} className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 transition">
                <RefreshCw size={16} className={partsLoading ? "animate-spin" : ""} />
              </button>
              <button onClick={() => setPartModal({ open: true, part: null })}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition">
                <Plus size={16} /> Добавить
              </button>
            </div>
          </div>

          {partsLoading && parts.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-12 text-center text-slate-500 border border-slate-700">
              <RefreshCw size={32} className="animate-spin mx-auto mb-3" /> Загрузка...
            </div>
          ) : parts.length === 0 ? null : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                    <th className="px-3 py-2 text-left">Название</th>
                    <th className="px-3 py-2 text-left">ТС</th>
                    <th className="px-3 py-2 text-center">Кол-во</th>
                    <th className="px-3 py-2 text-right">Цена</th>
                    <th className="px-3 py-2 text-left">Поставщик</th>
                    <th className="px-3 py-2 text-right">Доставка</th>
                    <th className="px-3 py-2 text-center">Статус</th>
                    <th className="px-3 py-2 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map(p => (
                    <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-3 py-2 font-medium text-white">{p.name}</td>
                      <td className="px-3 py-2 text-slate-300">{p.license_plate || "—"}</td>
                      <td className="px-3 py-2 text-center text-slate-300">{p.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono text-white">{p.price ? `${fmt(p.price)} ₽` : "—"}</td>
                      <td className="px-3 py-2 text-slate-400">{p.supplier || "—"}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{p.eta_delivery ? fmtDate(p.eta_delivery) : "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <select value={p.status} onChange={e => handlePartStatusChange(p.id, e.target.value)}
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${partStatusColors[p.status] || "bg-slate-700 text-slate-400"}`}>
                          {Object.entries(partStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => setPartModal({ open: true, part: p })}
                          className="p-1.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition">
                          <Edit size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {repairModal.open && (
        <RepairModal repair={repairModal.repair} vehicles={vehicles} onClose={() => setRepairModal({ open: false, repair: null })} onSave={loadRepairs} />
      )}
      {scheduleModal.open && (
        <ScheduleModal entry={scheduleModal.entry} vehicles={vehicles} onClose={() => setScheduleModal({ open: false, entry: null })} onSave={loadSchedule} />
      )}
      {partModal.open && (
        <PartModal part={partModal.part} vehicles={vehicles} onClose={() => setPartModal({ open: false, part: null })} onSave={loadParts} />
      )}
    </div>
  );
}
