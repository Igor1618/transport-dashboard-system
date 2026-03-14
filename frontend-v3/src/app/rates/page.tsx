"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Plus, Pencil, Trash2, Check, X, AlertTriangle } from "lucide-react";

interface RouteRate {
  id: number;
  route_name: string;
  rate_per_trip: number;
  is_active: boolean;
  city_from?: string;
  city_to?: string;
  tonnage?: number | null;
  tender_id?: number | null;
}

interface TariffAlert {
  id: number;
  tender_id: number;
  route_name: string;
  trips_count: number;
  first_seen_at: string;
}

const hdr = () => ({
  'Content-Type': 'application/json',
  'x-user-role': typeof window !== 'undefined' ? localStorage.getItem('userRole') || 'director' : 'director',
} as any);

async function fetchRates() {
  const res = await fetch('/api/reports/tariffs/rates', { headers: hdr() });
  if (!res.ok) throw new Error('API error');
  return res.json();
}

async function fetchAlerts() {
  const res = await fetch('/api/reports/tariff-alerts', { headers: hdr() });
  if (!res.ok) return [];
  return res.json();
}

async function createRate(rate: Partial<RouteRate>) {
  const res = await fetch('/api/reports/tariffs/create', { method: 'POST', headers: hdr(), body: JSON.stringify(rate) });
  if (!res.ok) throw new Error('Create failed');
  return res.json();
}

async function updateRate(id: number, rate: Partial<RouteRate>) {
  const res = await fetch(`/api/reports/tariffs/${id}`, { method: 'PATCH', headers: hdr(), body: JSON.stringify(rate) });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

async function deleteRate(id: number) {
  const res = await fetch(`/api/reports/tariffs/${id}`, { method: 'DELETE', headers: hdr() });
  if (!res.ok) throw new Error('Delete failed');
}

async function resolveAlert(id: number) {
  const res = await fetch(`/api/reports/tariff-alerts/${id}/resolve`, { method: 'PATCH', headers: hdr() });
  if (!res.ok) throw new Error('Resolve failed');
  return res.json();
}

function fmt(n: number) { return new Intl.NumberFormat('ru-RU').format(n) + ' ₽'; }
const TONNAGE_OPTIONS = [{ v: null, l: 'Любой' }, { v: 5, l: '5т' }, { v: 20, l: '20т' }];

export default function RatesPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Partial<RouteRate>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newFields, setNewFields] = useState<Partial<RouteRate>>({ is_active: true });
  const [search, setSearch] = useState('');
  const [showAlerts, setShowAlerts] = useState(true);

  const { effectiveRole } = useAuth();
  const isReadOnly = ["logist"].includes(effectiveRole);

  const { data: rates = [], isLoading } = useQuery({ queryKey: ['rates'], queryFn: fetchRates });
  const { data: alerts = [] } = useQuery({ queryKey: ['tariff-alerts'], queryFn: fetchAlerts, refetchInterval: 60000 });

  const createMutation = useMutation({
    mutationFn: (rate: Partial<RouteRate>) => createRate(rate),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rates'] }); queryClient.invalidateQueries({ queryKey: ['tariff-alerts'] }); setShowAdd(false); setNewFields({ is_active: true }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, rate }: { id: number; rate: Partial<RouteRate> }) => updateRate(id, rate),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rates'] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rates'] }),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tariff-alerts'] }),
  });

  const filtered = rates.filter((r: RouteRate) =>
    !search || r.route_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.city_from?.toLowerCase().includes(search.toLowerCase()) ||
    r.city_to?.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (rate: RouteRate) => { setEditingId(rate.id); setEditFields({ route_name: rate.route_name, rate_per_trip: rate.rate_per_trip, city_from: rate.city_from || '', city_to: rate.city_to || '', tonnage: rate.tonnage ?? null }); };
  const saveEdit = () => { if (editingId) updateMutation.mutate({ id: editingId, rate: editFields }); };
  const toggleActive = (rate: RouteRate) => updateMutation.mutate({ id: rate.id, rate: { is_active: !rate.is_active } });

  const InlineEdit = ({ field, type = 'text', className = '' }: { field: keyof RouteRate; type?: string; className?: string }) => (
    <input type={type} value={(editFields[field] as string) || ''} onChange={e => setEditFields(f => ({ ...f, [field]: type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
      className={`bg-slate-700 text-white px-2 py-1 rounded border border-slate-500 text-sm ${className}`} />
  );

  const tonnageLabel = (t: number | null | undefined) => t === 5 ? '5т' : t === 20 ? '20т' : '—';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Тарифы</h1>
        <p className="text-slate-400 text-sm">Тарифы водителей по маршрутам WB</p>
      </div>

      {/* Tariff alerts banner */}
      {alerts.length > 0 && showAlerts && (
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <AlertTriangle size={18} /> {alerts.length} маршрут{alerts.length > 1 ? 'а' : ''} без тарифа
            </div>
            <button onClick={() => setShowAlerts(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>
          <div className="space-y-2">
            {alerts.map((a: TariffAlert) => (
              <div key={a.id} className="flex items-center justify-between bg-slate-900/50 rounded p-2 text-sm">
                <div>
                  <span className="text-amber-300 font-mono mr-2">#{a.tender_id}</span>
                  <span className="text-slate-300">{a.route_name}</span>
                  <span className="text-slate-500 ml-2">({a.trips_count} рейсов)</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAdd(true); setNewFields({ is_active: true, tender_id: a.tender_id, route_name: a.route_name }); }}
                    className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 bg-blue-900/30 rounded">+ Добавить тариф</button>
                  <button onClick={() => resolveMutation.mutate(a.id)} className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 bg-slate-800 rounded">Закрыть</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex flex-wrap items-center gap-3">
          <input type="text" placeholder="Поиск по маршруту, городу..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm placeholder-slate-400" />
          {!isReadOnly && <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Добавить
          </button>}
        </div>

        {showAdd && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-3">
            <h3 className="text-white font-medium">Новый тариф</h3>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Название маршрута *" value={newFields.route_name || ''} onChange={e => setNewFields(f => ({ ...f, route_name: e.target.value }))}
                className="col-span-2 bg-slate-800 text-white px-3 py-2 rounded border border-slate-700 text-sm" />
              <input placeholder="Откуда (город)" value={newFields.city_from || ''} onChange={e => setNewFields(f => ({ ...f, city_from: e.target.value }))}
                className="bg-slate-800 text-white px-3 py-2 rounded border border-slate-700 text-sm" />
              <input placeholder="Куда (город)" value={newFields.city_to || ''} onChange={e => setNewFields(f => ({ ...f, city_to: e.target.value }))}
                className="bg-slate-800 text-white px-3 py-2 rounded border border-slate-700 text-sm" />
              <input type="number" placeholder="Тариф, ₽ *" value={newFields.rate_per_trip || ''} onChange={e => setNewFields(f => ({ ...f, rate_per_trip: parseFloat(e.target.value) }))}
                className="bg-slate-800 text-white px-3 py-2 rounded border border-slate-700 text-sm" />
              <select value={newFields.tonnage ?? ''} onChange={e => setNewFields(f => ({ ...f, tonnage: e.target.value ? parseInt(e.target.value) : null }))}
                className="bg-slate-800 text-white px-3 py-2 rounded border border-slate-700 text-sm">
                <option value="">Тоннаж: Любой</option>
                <option value="5">5т</option>
                <option value="20">20т</option>
              </select>
              {newFields.tender_id && <div className="col-span-2 text-xs text-slate-500">WB Direction ID: {newFields.tender_id}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => createMutation.mutate(newFields)} disabled={!newFields.route_name || !newFields.rate_per_trip}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                <Check className="w-4 h-4" /> Сохранить
              </button>
              <button onClick={() => { setShowAdd(false); setNewFields({ is_active: true }); }}
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm">
                <X className="w-4 h-4" /> Отмена
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'Всего', v: rates.length, c: 'text-white' }, { l: 'Активных', v: rates.filter((r: RouteRate) => r.is_active).length, c: 'text-green-400' },
          { l: 'Без тарифа', v: alerts.length, c: 'text-amber-400' }].map(s => (
          <div key={s.l} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <div className="text-slate-400 text-xs">{s.l}</div>
            <div className={`text-xl font-bold ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? <div className="text-center py-8 text-slate-400">Загрузка...</div> : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-3 py-3 text-left">Маршрут</th>
                <th className="px-3 py-3 text-left">Откуда</th>
                <th className="px-3 py-3 text-left">Куда</th>
                <th className="px-3 py-3 text-center">Тоннаж</th>
                <th className="px-3 py-3 text-right">Тариф</th>
                <th className="px-3 py-3 text-center">Статус</th>
                {!isReadOnly && <th className="px-3 py-3 text-right">Действия</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map((rate: RouteRate) => (
                <tr key={rate.id} className={`hover:bg-slate-700/20 ${!rate.is_active && 'opacity-50'}`}>
                  {editingId === rate.id ? (
                    <>
                      <td className="px-3 py-2"><InlineEdit field="route_name" className="w-full" /></td>
                      <td className="px-3 py-2"><InlineEdit field="city_from" className="w-24" /></td>
                      <td className="px-3 py-2"><InlineEdit field="city_to" className="w-24" /></td>
                      <td className="px-3 py-2 text-center">
                        <select value={editFields.tonnage ?? ''} onChange={e => setEditFields(f => ({ ...f, tonnage: e.target.value ? parseInt(e.target.value) : null }))}
                          className="bg-slate-700 text-white px-1 py-1 rounded border border-slate-500 text-xs">
                          <option value="">Любой</option><option value="5">5т</option><option value="20">20т</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right"><InlineEdit field="rate_per_trip" type="number" className="w-24 text-right" /></td>
                      <td className="px-3 py-2 text-center">—</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={saveEdit} className="p-1 bg-green-600 rounded text-white hover:bg-green-700"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 bg-slate-600 rounded text-white hover:bg-slate-500"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-white max-w-xs truncate">{rate.route_name}</td>
                      <td className="px-3 py-2 text-slate-300">{rate.city_from || <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2 text-slate-300">{rate.city_to || <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2 text-center">
                        {rate.tonnage ? <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs">{tonnageLabel(rate.tonnage)}</span> : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-blue-400 font-medium">{fmt(rate.rate_per_trip)}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleActive(rate)} className={`px-2 py-0.5 rounded text-xs font-medium ${rate.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                          {rate.is_active ? 'Активен' : 'Откл.'}
                        </button>
                      </td>
                      {!isReadOnly && <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => startEdit(rate)} className="p-1 bg-slate-700 rounded text-slate-400 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => confirm('Удалить тариф?') && deleteMutation.mutate(rate.id)} className="p-1 bg-red-900/30 rounded text-red-500 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-8 text-slate-500">Нет тарифов</div>}
        </div>
      )}
    </div>
  );
}
