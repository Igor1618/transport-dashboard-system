"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Filter, Truck, MapPin, Clock, ChevronRight, Package, AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

interface Order {
  id: number; order_number: string; status: string; source: string; vehicle_number: string;
  origin_city: string; destination_city: string; customer_name: string;
  planned_pickup_date: string; planned_delivery_date: string;
  rate_amount: number; rate_per_km: number; eta_status: string; priority: string;
  cargo_type: string; cargo_weight_tons: number;
  waypoints_count: number; proposals_count: number; documents_count: number;
  created_at: string; has_problem: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-slate-600", SEARCHING: "bg-purple-600", FOUND: "bg-indigo-600",
  APPROVED: "bg-blue-600", DOCS: "bg-cyan-600", ASSIGNED: "bg-teal-600",
  EN_ROUTE_PICKUP: "bg-amber-600", LOADING: "bg-orange-600",
  EN_ROUTE_DELIVERY: "bg-green-600", UNLOADING: "bg-lime-600",
  COMPLETED: "bg-emerald-700", CLOSED: "bg-slate-700", CANCELLED: "bg-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "📋 Планирование", SEARCHING: "🔍 Поиск", FOUND: "✅ Найден",
  APPROVED: "👍 Утверждён", DOCS: "📄 Документы", ASSIGNED: "🚛 Назначен",
  EN_ROUTE_PICKUP: "🛣 На погрузку", LOADING: "📦 Погрузка",
  EN_ROUTE_DELIVERY: "🛣 В пути", UNLOADING: "📤 Выгрузка",
  COMPLETED: "✔️ Выполнен", CLOSED: "🔒 Закрыт", CANCELLED: "❌ Отменён",
};

const PRIORITY_LABELS: Record<string, string> = { urgent: "🔴", normal: "", low: "🔵" };

const fmt = (n: number) => n ? new Intl.NumberFormat("ru-RU").format(n) : "—";
const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" }) : "—";

export default function LogisticsOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const pageSize = 50;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (search) params.set("search", search);
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    
    try {
      const [ordersRes, statsRes] = await Promise.all([
        fetch(`/api/logistics/orders?${params}`).then(r => r.json()),
        fetch("/api/logistics/stats").then(r => r.json()),
      ]);
      setOrders(ordersRes.orders || []);
      setTotal(ordersRes.total || 0);
      setStats(statsRes);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [statusFilter, sourceFilter, search, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const statusTabs = [
    { key: "active", label: "Активные", count: stats?.active || 0 },
    { key: "all", label: "Все", count: Object.values(stats?.by_status || {}).reduce((a: any, b: any) => a + b, 0) as number },
    { key: "COMPLETED", label: "Выполненные", count: stats?.by_status?.COMPLETED || 0 },
    { key: "CANCELLED", label: "Отменённые", count: stats?.by_status?.CANCELLED || 0 },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2"><Package className="w-6 h-6 text-blue-400" /> Заявки на перевозку</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total} заявок {stats?.unread_alerts > 0 && <span className="text-red-400 ml-2">⚠️ {stats.unread_alerts} алертов</span>}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchOrders} className="p-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"><RefreshCw className="w-4 h-4" /></button>
          <Link href="/logistics/orders/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-1 text-sm font-medium"><Plus className="w-4 h-4" /> Новая заявка</Link>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {statusTabs.map(t => (
          <button key={t.key} onClick={() => { setStatusFilter(t.key); setPage(0); }}
            className={`px-3 py-1.5 rounded text-sm whitespace-nowrap transition ${statusFilter === t.key ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
            {t.label} <span className="text-xs opacity-70">({t.count})</span>
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(0); }}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-300">
            <option value="">Все источники</option>
            <option value="manual">РФ грузы</option>
            <option value="ati">ATI.su</option>
            <option value="wb">Wildberries</option>
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Поиск по номеру, городу, заказчику, машине..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Загрузка...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-slate-500">Нет заявок</div>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <Link key={o.id} href={`/logistics/orders/${o.id}`}
              className="block bg-slate-800 rounded-lg border border-slate-700/50 hover:border-slate-600 p-3 sm:p-4 transition">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                {/* Left: number + status */}
                <div className="flex items-center gap-2 min-w-[180px]">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold text-white ${STATUS_COLORS[o.status] || "bg-slate-600"}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                  <span className="font-mono text-sm text-slate-300">{o.order_number}</span>
                  {o.has_problem && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                  {PRIORITY_LABELS[o.priority] && <span>{PRIORITY_LABELS[o.priority]}</span>}
                </div>

                {/* Center: route */}
                <div className="flex-1 flex items-center gap-1 text-sm">
                  <MapPin className="w-3 h-3 text-green-400 shrink-0" />
                  <span className="text-slate-200">{o.origin_city || "?"}</span>
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-200">{o.destination_city || "?"}</span>
                  {o.cargo_type && <span className="text-slate-500 ml-1">• {o.cargo_type}</span>}
                  {o.cargo_weight_tons > 0 && <span className="text-slate-500">{o.cargo_weight_tons}т</span>}
                </div>

                {/* Right: meta */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {o.vehicle_number && (
                    <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{o.vehicle_number.toUpperCase()}</span>
                  )}
                  {o.customer_name && (
                    <span className="hidden sm:inline max-w-[120px] truncate">{o.customer_name}</span>
                  )}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(o.planned_pickup_date)}</span>
                  {o.rate_amount > 0 && (
                    <span className="text-green-400 font-medium">{fmt(o.rate_amount)} ₽</span>
                  )}
                  {o.source !== "manual" && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${o.source === "wb" ? "bg-purple-600/30 text-purple-300" : "bg-blue-600/30 text-blue-300"}`}>{o.source.toUpperCase()}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-slate-700 rounded text-sm disabled:opacity-50">← Назад</button>
          <span className="px-3 py-1 text-sm text-slate-400">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} из {total}</span>
          <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-slate-700 rounded text-sm disabled:opacity-50">Вперёд →</button>
        </div>
      )}
    </div>
  );
}
