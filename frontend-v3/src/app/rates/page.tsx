"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, DollarSign } from "lucide-react";

interface RouteRate {
  id: number;
  route_name: string;
  rate_per_trip: number;
  is_active: boolean;
}

async function fetchRates() {
  const res = await fetch('/rest/v1/route_rates?order=route_name.asc');
  if (!res.ok) throw new Error('API error');
  return res.json();
}

async function createRate(rate: Partial<RouteRate>) {
  const res = await fetch('/rest/v1/route_rates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(rate),
  });
  if (!res.ok) throw new Error('Create failed');
  return res.json();
}

async function updateRate(id: number, rate: Partial<RouteRate>) {
  const res = await fetch(`/rest/v1/route_rates?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(rate),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

async function deleteRate(id: number) {
  const res = await fetch(`/rest/v1/route_rates?id=eq.${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Delete failed');
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}

export default function RatesPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRoute, setEditRoute] = useState('');
  const [editRate, setEditRate] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newRoute, setNewRoute] = useState('');
  const [newRate, setNewRate] = useState('');
  const [search, setSearch] = useState('');

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ['rates'],
    queryFn: fetchRates,
  });

  const createMutation = useMutation({
    mutationFn: (rate: Partial<RouteRate>) => createRate(rate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rates'] });
      setShowAdd(false);
      setNewRoute('');
      setNewRate('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, rate }: { id: number; rate: Partial<RouteRate> }) => updateRate(id, rate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rates'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rates'] }),
  });

  const filtered = rates.filter((r: RouteRate) => 
    !search || r.route_name?.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (rate: RouteRate) => {
    setEditingId(rate.id);
    setEditRoute(rate.route_name);
    setEditRate(String(rate.rate_per_trip));
  };

  const saveEdit = () => {
    if (editingId && editRoute && editRate) {
      updateMutation.mutate({
        id: editingId,
        rate: { route_name: editRoute, rate_per_trip: parseFloat(editRate) }
      });
    }
  };

  const handleCreate = () => {
    if (newRoute && newRate) {
      createMutation.mutate({
        route_name: newRoute,
        rate_per_trip: parseFloat(newRate),
        is_active: true,
      });
    }
  };

  const toggleActive = (rate: RouteRate) => {
    updateMutation.mutate({
      id: rate.id,
      rate: { is_active: !rate.is_active }
    });
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Тарифы</h1>
        <p className="text-slate-400 text-sm">Тарифы водителей по маршрутам WB</p>
      </div>

      {/* Controls */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Поиск по маршруту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm placeholder-slate-400"
          />
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <h3 className="text-white font-medium mb-3">Новый тариф</h3>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Название маршрута"
                value={newRoute}
                onChange={(e) => setNewRoute(e.target.value)}
                className="flex-1 min-w-[200px] bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
              />
              <input
                type="number"
                placeholder="Тариф, ₽"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="w-32 bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
              />
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Сохранить
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewRoute(''); setNewRate(''); }}
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                <X className="w-4 h-4" />
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-slate-400 text-sm">Всего тарифов</div>
          <div className="text-2xl font-bold text-white">{rates.length}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-slate-400 text-sm">Активных</div>
          <div className="text-2xl font-bold text-green-400">{rates.filter((r: RouteRate) => r.is_active).length}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-slate-400 text-sm">Средний тариф</div>
          <div className="text-2xl font-bold text-blue-400">
            {rates.length > 0 ? formatMoney(rates.reduce((s: number, r: RouteRate) => s + r.rate_per_trip, 0) / rates.length) : '0 ₽'}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-slate-400 text-center py-8">Загрузка...</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            {filtered.map((rate: RouteRate) => (
              <div key={rate.id} className={`bg-slate-800/50 rounded-lg p-3 border ${rate.is_active ? 'border-slate-700/50' : 'border-red-900/50 opacity-60'}`}>
                {editingId === rate.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editRoute}
                      onChange={(e) => setEditRoute(e.target.value)}
                      className="w-full bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        className="flex-1 bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 text-sm"
                      />
                      <button onClick={saveEdit} className="p-1.5 bg-green-600 rounded text-white"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-600 rounded text-white"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">{rate.route_name}</div>
                      <div className="text-blue-400 font-bold">{formatMoney(rate.rate_per_trip)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleActive(rate)} className={`p-1.5 rounded ${rate.is_active ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                        {rate.is_active ? '✓' : '✗'}
                      </button>
                      <button onClick={() => startEdit(rate)} className="p-1.5 bg-slate-700 rounded text-slate-300 hover:text-white"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteMutation.mutate(rate.id)} className="p-1.5 bg-red-900/50 rounded text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Маршрут</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Тариф</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Статус</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filtered.map((rate: RouteRate) => (
                  <tr key={rate.id} className={`hover:bg-slate-700/30 ${!rate.is_active && 'opacity-50'}`}>
                    <td className="px-4 py-3">
                      {editingId === rate.id ? (
                        <input
                          type="text"
                          value={editRoute}
                          onChange={(e) => setEditRoute(e.target.value)}
                          className="w-full bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 text-sm"
                        />
                      ) : (
                        <span className="text-white">{rate.route_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === rate.id ? (
                        <input
                          type="number"
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                          className="w-32 bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 text-sm text-right"
                        />
                      ) : (
                        <span className="text-blue-400 font-medium">{formatMoney(rate.rate_per_trip)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(rate)}
                        className={`px-2 py-1 rounded text-xs font-medium ${rate.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}
                      >
                        {rate.is_active ? 'Активен' : 'Неактивен'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === rate.id ? (
                        <div className="flex justify-end gap-1">
                          <button onClick={saveEdit} className="p-1.5 bg-green-600 rounded text-white hover:bg-green-700"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-600 rounded text-white hover:bg-slate-500"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => startEdit(rate)} className="p-1.5 bg-slate-700 rounded text-slate-300 hover:text-white hover:bg-slate-600"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => deleteMutation.mutate(rate.id)} className="p-1.5 bg-red-900/50 rounded text-red-400 hover:text-red-300 hover:bg-red-900"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-400">Нет тарифов</div>
          )}
        </>
      )}
    </div>
  );
}
