"use client";
import { useState, useCallback } from "react";
import { ArrowLeft, RefreshCw, Plus, MapPin, Trash2, Edit, Bell, BellOff, Eye } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiFetch } from "@/shared/utils/apiFetch";
import { usePolling } from "@/shared/hooks/usePolling";

const GeofenceMap = dynamic(() => import("@/components/GeofenceMap"), { ssr: false });

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  warehouse: { label: "Склад", emoji: "🏭" },
  client: { label: "Клиент", emoji: "🏢" },
  gas_station: { label: "АЗС", emoji: "⛽" },
  parking: { label: "Стоянка", emoji: "🅿️" },
  restricted: { label: "Запретная зона", emoji: "⛔" },
  custom: { label: "Прочее", emoji: "📍" },
};

interface Geofence {
  id: number; name: string; description: string; lat: number; lon: number;
  radius_m: number; type: string; color: string; is_active: boolean;
  notify_on_enter: boolean; notify_on_exit: boolean;
  vehicles_inside: number; events_24h: number;
}

export default function GeofencesPage() {
  const [zones, setZones] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", lat: "", lon: "", radius_m: "500", type: "warehouse", color: "#3B82F6", notify_on_enter: true, notify_on_exit: true });
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [showMap, setShowMap] = useState(true);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/geofences");
      if (r.ok) setZones(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  usePolling(fetchZones, 30000, [fetchZones]);

  const handleSave = async () => {
    const body = { ...form, lat: parseFloat(form.lat), lon: parseFloat(form.lon), radius_m: parseInt(form.radius_m) };
    if (!body.name || isNaN(body.lat) || isNaN(body.lon)) return alert("Заполните название и координаты");
    try {
      const url = editId ? `/api/geofences/${editId}` : "/api/geofences";
      const method = editId ? "PATCH" : "POST";
      const r = await apiFetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
      if (r.ok) { setShowForm(false); setEditId(null); fetchZones(); }
    } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить геозону?")) return;
    await apiFetch(`/api/geofences/${id}`, { method: "DELETE" });
    fetchZones();
  };

  const handleEdit = (z: Geofence) => {
    setForm({ name: z.name, description: z.description || "", lat: String(z.lat), lon: String(z.lon), radius_m: String(z.radius_m), type: z.type, color: z.color, notify_on_enter: z.notify_on_enter, notify_on_exit: z.notify_on_exit });
    setEditId(z.id);
    setShowForm(true);
  };

  const viewEvents = async (id: number) => {
    setSelectedZone(id);
    try {
      const r = await apiFetch(`/api/geofences/${id}/events?limit=50`);
      if (r.ok) setEvents(await r.json());
    } catch {}
  };

  const handleMapClick = (lat: number, lon: number) => {
    if (showForm) {
      setForm(f => ({ ...f, lat: lat.toFixed(6), lon: lon.toFixed(6) }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/command" className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-lg font-bold">📍 Геозоны</h1>
        <span className="text-sm text-slate-400">{zones.length} зон</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowMap(!showMap)} className="px-3 py-1.5 text-xs bg-slate-700 rounded hover:bg-slate-600">
            {showMap ? "Список" : "Карта"}
          </button>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name:"", description:"", lat:"", lon:"", radius_m:"500", type:"warehouse", color:"#3B82F6", notify_on_enter:true, notify_on_exit:true }); }}
            className="px-3 py-1.5 text-xs bg-blue-600 rounded hover:bg-blue-500 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Добавить
          </button>
          <button onClick={fetchZones} className="p-1.5 rounded hover:bg-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        {/* Form */}
        {showForm && (
          <div className="bg-slate-800 rounded-lg p-4 mb-4 space-y-3">
            <h3 className="font-semibold">{editId ? "Редактировать" : "Новая геозона"}</h3>
            <p className="text-xs text-slate-400">💡 Кликните по карте чтобы выбрать координаты</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input placeholder="Название" value={form.name} onChange={e => setForm({...form, name:e.target.value})}
                className="bg-slate-700 rounded px-3 py-2 text-sm col-span-2" />
              <select value={form.type} onChange={e => setForm({...form, type:e.target.value})}
                className="bg-slate-700 rounded px-3 py-2 text-sm">
                {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm({...form, color:e.target.value})} className="w-8 h-8 rounded" />
                <input placeholder="Радиус (м)" value={form.radius_m} onChange={e => setForm({...form, radius_m:e.target.value})}
                  className="bg-slate-700 rounded px-3 py-2 text-sm w-full" type="number" />
              </div>
              <input placeholder="Широта" value={form.lat} onChange={e => setForm({...form, lat:e.target.value})}
                className="bg-slate-700 rounded px-3 py-2 text-sm" />
              <input placeholder="Долгота" value={form.lon} onChange={e => setForm({...form, lon:e.target.value})}
                className="bg-slate-700 rounded px-3 py-2 text-sm" />
              <input placeholder="Описание" value={form.description} onChange={e => setForm({...form, description:e.target.value})}
                className="bg-slate-700 rounded px-3 py-2 text-sm col-span-2" />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.notify_on_enter} onChange={e => setForm({...form, notify_on_enter:e.target.checked})} />
                Уведомлять о входе
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.notify_on_exit} onChange={e => setForm({...form, notify_on_exit:e.target.checked})} />
                Уведомлять о выходе
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="px-4 py-2 bg-green-600 rounded text-sm hover:bg-green-500">
                {editId ? "Сохранить" : "Создать"}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 bg-slate-700 rounded text-sm hover:bg-slate-600">
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Map */}
        {showMap && (
          <div className="bg-slate-800 rounded-lg overflow-hidden mb-4" style={{height: "400px"}}>
            <GeofenceMap zones={zones} onMapClick={handleMapClick} selectedZone={selectedZone} />
          </div>
        )}

        {/* Zone list */}
        <div className="space-y-2">
          {zones.map(z => {
            const t = TYPE_LABELS[z.type] || TYPE_LABELS.custom;
            return (
              <div key={z.id} className={`bg-slate-800 rounded-lg p-3 flex items-center gap-3 ${!z.is_active ? 'opacity-50' : ''} ${selectedZone === z.id ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: z.color}} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{t.emoji}</span>
                    <span className="font-semibold text-sm truncate">{z.name}</span>
                    <span className="text-xs text-slate-500">{t.label}</span>
                  </div>
                  <div className="text-xs text-slate-400 flex gap-3 mt-0.5">
                    <span>R: {z.radius_m}м</span>
                    <span>{z.lat.toString().substring(0,8)}, {z.lon.toString().substring(0,8)}</span>
                    {z.vehicles_inside > 0 && <span className="text-green-400">🚛 {z.vehicles_inside} внутри</span>}
                    {z.events_24h > 0 && <span className="text-blue-400">📊 {z.events_24h} событий/24ч</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {z.notify_on_enter ? <Bell className="w-3 h-3 text-green-400" /> : <BellOff className="w-3 h-3 text-slate-500" />}
                  <button onClick={() => viewEvents(z.id)} className="p-1.5 rounded hover:bg-slate-700" title="События"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => handleEdit(z)} className="p-1.5 rounded hover:bg-slate-700" title="Редактировать"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(z.id)} className="p-1.5 rounded hover:bg-slate-700 text-red-400" title="Удалить"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
          {zones.length === 0 && !loading && (
            <div className="text-center text-slate-500 py-8">Нет геозон. Нажмите "Добавить" чтобы создать первую.</div>
          )}
        </div>

        {/* Events panel */}
        {selectedZone && events.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">📋 Последние события</h3>
              <button onClick={() => { setSelectedZone(null); setEvents([]); }} className="text-xs text-slate-400">Закрыть</button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {events.map((e: any) => (
                <div key={e.id} className="flex items-center gap-2 text-xs py-1 border-b border-slate-700/30">
                  <span>{e.event_type === 'enter' ? '🟢 Вход' : '🔴 Выход'}</span>
                  <span className="font-mono">{e.license_plate || e.vehicle_id}</span>
                  <span className="text-slate-400 ml-auto">
                    {new Date(e.created_at).toLocaleString('ru-RU', {timeZone:'Europe/Moscow', day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                  </span>
                  {e.speed > 0 && <span className="text-slate-500">{Math.round(e.speed)} км/ч</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
