'use client';
import { formatDate } from '@/lib/dates';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FileText, Truck, Calendar, Building2, Search, Filter, ChevronDown, ChevronUp, X, Plus, Trash2, Check } from 'lucide-react';
import ContractDraftModal from '@/components/ContractDraftModal';

interface Contract {
  id: string;
  number: string;
  date: string;
  loading_date: string | null;
  unloading_date: string | null;
  contractor_name: string;
  vehicle_number: string;
  driver_name: string;
  route: string;
  amount: number;
  source: '1C';
}

interface Trip {
  wb_trip_number: string;
  loading_date: string;
  vehicle_number: string;
  driver_name: string;
  route_name: string;
  trip_amount: number;
  distance_km: number;
  source: 'WB';
}

interface RegistryItem {
  id: string;
  route: string;
  amount: number;
  date: string;
  vehicle_number: string;
  distributed_amount: number;
  distributions_count: number;
  remaining: number;
}

interface Distribution {
  id: number;
  registry_id: string;
  vehicle_number: string;
  amount: number;
  period_from: string | null;
  period_to: string | null;
  comment: string | null;
  created_at: string;
}

type OrderItem = (Contract | Trip) & { source: '1C' | 'WB' };

const formatMoney = (amount: number) => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M ₽`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}К ₽`;
  return `${amount.toLocaleString('ru-RU')} ₽`;
};

const formatMoneyFull = (amount: number) => {
  return `${Number(amount).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
};

const isRvbRegistry = (item: Contract) => {
  return item.contractor_name?.includes('РВБ') && item.route?.includes('реестру');
};

// ==================== МОДАЛЬНОЕ ОКНО РАСПРЕДЕЛЕНИЯ ====================
function DistributeModal({ registry, onClose, onSaved }: { 
  registry: RegistryItem; 
  onClose: () => void; 
  onSaved: () => void;
}) {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [vehicles, setVehicles] = useState<{ license_plate: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Новая строка
  const [newVehicle, setNewVehicle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/revenue/distributions/${encodeURIComponent(registry.id)}`).then(r => r.json()),
      fetch('/api/revenue/vehicles-list').then(r => r.json()),
    ]).then(([dist, veh]) => {
      setDistributions(dist);
      setVehicles(veh);
      setLoading(false);
    });
  }, [registry.id]);

  const distributed = distributions.reduce((s, d) => s + Number(d.amount), 0);
  const remaining = Number(registry.amount) - distributed;

  const handleAdd = async () => {
    if (!newVehicle || !newAmount) return;
    setSaving(true);
    try {
      const res = await fetch('/api/revenue/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registry_id: registry.id,
          vehicle_number: newVehicle,
          amount: parseFloat(newAmount),
          comment: newComment || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Ошибка');
        setSaving(false);
        return;
      }
      const created = await res.json();
      setDistributions([created, ...distributions]);
      setNewVehicle('');
      setNewAmount('');
      setNewComment('');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить распределение?')) return;
    await fetch(`/api/revenue/distributions/${id}`, { method: 'DELETE' });
    setDistributions(distributions.filter(d => d.id !== id));
  };

  const handleDistributeRemaining = () => {
    setNewAmount(remaining.toFixed(2));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Распределение реестра</h2>
              <p className="text-slate-400 text-sm mt-1 max-w-md truncate" title={registry.route}>{registry.route}</p>
            </div>
            <button onClick={() => { onSaved(); onClose(); }} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-slate-500 text-xs">Сумма реестра</div>
              <div className="text-white font-bold">{formatMoneyFull(registry.amount)}</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-slate-500 text-xs">Распределено</div>
              <div className="text-green-400 font-bold">{formatMoneyFull(distributed)}</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-slate-500 text-xs">Остаток</div>
              <div className={`font-bold ${remaining > 0.01 ? 'text-orange-400' : 'text-green-400'}`}>
                {formatMoneyFull(remaining)}
              </div>
            </div>
          </div>

          {/* Add form */}
          <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
            <div className="text-sm font-medium text-slate-300 mb-3">Добавить распределение</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={newVehicle}
                onChange={e => setNewVehicle(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              >
                <option value="">Выберите машину</option>
                {vehicles.map(v => (
                  <option key={v.license_plate} value={v.license_plate}>{v.license_plate}</option>
                ))}
              </select>
              <div className="relative">
                <input
                  type="number"
                  placeholder="Сумма"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
                {remaining > 0.01 && (
                  <button
                    onClick={handleDistributeRemaining}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-400 hover:text-blue-300"
                    title="Весь остаток"
                  >
                    MAX
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Комментарий"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
                <button
                  onClick={handleAdd}
                  disabled={saving || !newVehicle || !newAmount}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Existing distributions */}
          {loading ? (
            <div className="text-center py-4 text-slate-400">Загрузка...</div>
          ) : distributions.length === 0 ? (
            <div className="text-center py-4 text-slate-500">Нет распределений</div>
          ) : (
            <div className="space-y-2">
              {distributions.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Truck className="w-4 h-4 text-slate-500" />
                    <span className="text-white font-medium">{d.vehicle_number}</span>
                    <span className="text-green-400 font-semibold">{formatMoneyFull(d.amount)}</span>
                    {d.comment && <span className="text-slate-500 text-xs">({d.comment})</span>}
                  </div>
                  <button onClick={() => handleDelete(d.id)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Status */}
          {remaining <= 0.01 && distributions.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-green-400 text-sm">
              <Check className="w-4 h-4" /> Реестр полностью распределён
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== ОСНОВНАЯ СТРАНИЦА ====================
export default function TripsPage() {
  const [contractTripId, setContractTripId] = useState<number|null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [sourceFilter, setSourceFilter] = useState<'all' | '1C' | 'WB'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [excludeRvb, setExcludeRvb] = useState(true);

  // Registries tab
  const [tab, setTab] = useState<'trips' | 'registries'>('trips');
  const [registries, setRegistries] = useState<RegistryItem[]>([]);
  const [registriesLoading, setRegistriesLoading] = useState(false);
  const [distributeRegistry, setDistributeRegistry] = useState<RegistryItem | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(parseInt(year), parseInt(monthNum), 0).toISOString().split('T')[0];

        const contractsRes = await fetch(
          `/rest/v1/contracts?date=gte.${startDate}&date=lte.${endDate}&order=date.desc&limit=1000`
        );
        if (contractsRes.ok) {
          const contractsData = await contractsRes.json();
          setContracts(contractsData.map((c: any) => ({ ...c, source: '1C' as const })));
        }

        const tripsRes = await fetch(
          `/rest/v1/trips?loading_date=gte.${startDate}&loading_date=lte.${endDate}&order=loading_date.desc&limit=1000`
        );
        if (tripsRes.ok) {
          const tripsData = await tripsRes.json();
          setTrips(tripsData.map((t: any) => ({ ...t, source: 'WB' as const })));
        }
      } catch (err) {
        setError('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [month]);

  // Load registries when tab opens
  const loadRegistries = useCallback(async () => {
    setRegistriesLoading(true);
    try {
      const res = await fetch(`/api/revenue/registries?month=${month}`);
      if (res.ok) setRegistries(await res.json());
    } finally {
      setRegistriesLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (tab === 'registries') loadRegistries();
  }, [tab, month, loadRegistries]);

  // Filtered contracts (without RVB registries if needed)
  const filteredContracts = useMemo(() => {
    if (!excludeRvb) return contracts;
    return contracts.filter(c => !isRvbRegistry(c));
  }, [contracts, excludeRvb]);

  // RVB registries count
  const rvbStats = useMemo(() => {
    const rvbContracts = contracts.filter(c => isRvbRegistry(c));
    return {
      count: rvbContracts.length,
      total: rvbContracts.reduce((sum, c) => sum + (c.amount || 0), 0),
    };
  }, [contracts]);

  // Combined and filtered data
  const combinedData = useMemo(() => {
    let items: OrderItem[] = [];
    
    if (sourceFilter === 'all' || sourceFilter === '1C') {
      items = [...items, ...filteredContracts];
    }
    if (sourceFilter === 'all' || sourceFilter === 'WB') {
      items = [...items, ...trips.map(t => ({
        ...t,
        number: t.wb_trip_number,
        date: t.loading_date,
        contractor_name: 'Wildberries',
        route: t.route_name,
        amount: t.trip_amount,
      }))];
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => 
        ('number' in item && item.number?.toLowerCase().includes(q)) ||
        item.vehicle_number?.toLowerCase().includes(q) ||
        item.driver_name?.toLowerCase().includes(q) ||
        ('contractor_name' in item && item.contractor_name?.toLowerCase().includes(q)) ||
        ('route' in item && item.route?.toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => {
      const aVal = sortField === 'date' 
        ? new Date('date' in a ? a.date : a.loading_date).getTime()
        : ('amount' in a ? a.amount : a.trip_amount);
      const bVal = sortField === 'date'
        ? new Date('date' in b ? b.date : b.loading_date).getTime()
        : ('amount' in b ? b.amount : b.trip_amount);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return items;
  }, [filteredContracts, trips, sourceFilter, searchQuery, sortField, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const contractsTotal = filteredContracts.reduce((sum, c) => sum + (c.amount || 0), 0);
    const tripsTotal = trips.reduce((sum, t) => sum + (t.trip_amount || 0), 0);
    return {
      contractsCount: filteredContracts.length,
      contractsTotal,
      tripsCount: trips.length,
      tripsTotal,
      total: contractsTotal + tripsTotal,
    };
  }, [filteredContracts, trips]);

  // Registries stats
  const registryStats = useMemo(() => {
    const total = registries.reduce((s, r) => s + Number(r.amount), 0);
    const distributed = registries.reduce((s, r) => s + Number(r.distributed_amount), 0);
    const undistributed = registries.filter(r => Number(r.remaining) > 0.01);
    return { total, distributed, remaining: total - distributed, undistributedCount: undistributed.length };
  }, [registries]);

  const toggleSort = (field: 'date' | 'amount') => {
    if (sortField === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-400" />
            Заявки и рейсы
          </h1>
          <p className="text-slate-400 text-sm mt-1">Все заказы из 1С и Wildberries</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('trips')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            tab === 'trips' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
          }`}
        >
          🚚 Рейсы и заявки
        </button>
        <button
          onClick={() => setTab('registries')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            tab === 'registries' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
          }`}
        >
          📋 Реестры РВБ
          {rvbStats.count > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-orange-500/30 text-orange-300 rounded">{rvbStats.count}</span>
          )}
        </button>
      </div>

      {tab === 'trips' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-1">Заявки 1С</div>
              <div className="text-xl font-bold text-blue-400">{formatMoney(stats.contractsTotal)}</div>
              <div className="text-slate-500 text-xs">{stats.contractsCount} шт</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-1">Рейсы WB</div>
              <div className="text-xl font-bold text-purple-400">{formatMoney(stats.tripsTotal)}</div>
              <div className="text-slate-500 text-xs">{stats.tripsCount} шт</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-1">Итого</div>
              <div className="text-xl font-bold text-green-400">{formatMoney(stats.total)}</div>
              <div className="text-slate-500 text-xs">{stats.contractsCount + stats.tripsCount} заказов</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-orange-500/30">
              <div className="text-slate-400 text-xs mb-1">Реестры РВБ</div>
              <div className="text-xl font-bold text-orange-400">{formatMoney(rvbStats.total)}</div>
              <div className="text-slate-500 text-xs">{rvbStats.count} шт</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по номеру, машине, водителю, маршруту..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
              />
            </div>
            <div className="flex gap-2">
              {(['all', '1C', 'WB'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSourceFilter(f)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    sourceFilter === f
                      ? f === '1C' ? 'bg-blue-600 border-blue-500 text-white' :
                        f === 'WB' ? 'bg-purple-600 border-purple-500 text-white' :
                        'bg-slate-700 border-slate-600 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'Все' : f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12 text-slate-400">Загрузка...</div>
          ) : error ? (
            <div className="text-center py-12 text-red-400">{error}</div>
          ) : (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Источник</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Номер</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white" onClick={() => toggleSort('date')}>
                        <span className="flex items-center gap-1">Дата {sortField === 'date' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}</span>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Машина</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase hidden md:table-cell">Контрагент</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase hidden lg:table-cell">Маршрут</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white" onClick={() => toggleSort('amount')}>
                        <span className="flex items-center justify-end gap-1">Сумма {sortField === 'amount' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {combinedData.slice(0, 100).map((item, idx) => {
                      const is1C = item.source === '1C';
                      const number = is1C ? (item as Contract).number : (item as Trip).wb_trip_number;
                      const c1c = item as Contract;
                      const date = is1C ? (c1c.loading_date || c1c.date) : (item as Trip).loading_date;
                      const unloadDate = is1C ? c1c.unloading_date : null;
                      const contractor = is1C ? (item as Contract).contractor_name : 'Wildberries';
                      const route = is1C ? (item as Contract).route : (item as Trip).route_name;
                      const amount = is1C ? (item as Contract).amount : (item as Trip).trip_amount;
                      
                      return (
                        <tr key={`${item.source}-${number}-${idx}`} className="hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              is1C ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                            }`}>{item.source}</span>
                          </td>
                          <td className="px-4 py-3 text-white font-mono text-sm">{number}</td>
                          <td className="px-4 py-3 text-slate-300">
                            {formatDate(date)}
                            {unloadDate && <span className="text-slate-500"> → {formatDate(unloadDate)}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-slate-500" />
                              <span className="text-white">{item.vehicle_number}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                            <div className="max-w-[200px] truncate" title={contractor}>{contractor}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-sm hidden lg:table-cell">
                            <div className="max-w-[300px] truncate" title={route}>{route}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-green-400 font-semibold">{formatMoney(amount)}</span>
                          </td>
                          {!is1C && item.id && (
                            <td className="px-2 py-3">
                              <button
                                onClick={() => setContractTripId(item.id)}
                                title="Сформировать договор-заявку"
                                className="text-xs text-blue-400 hover:text-blue-300 border border-blue-600/50 hover:border-blue-400 rounded px-2 py-1 whitespace-nowrap"
                              >📄 Договор</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {combinedData.length === 0 && (
                <div className="text-center py-8 text-slate-400">Нет данных за выбранный период</div>
              )}
              {combinedData.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-700 text-slate-400 text-sm">
                  Показано {Math.min(100, combinedData.length)} из {combinedData.length} записей
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'registries' && (
        <>
          {/* Registry stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-1">Всего реестров</div>
              <div className="text-xl font-bold text-white">{registries.length}</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-1">Общая сумма</div>
              <div className="text-xl font-bold text-orange-400">{formatMoney(registryStats.total)}</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-xs mb-1">Распределено</div>
              <div className="text-xl font-bold text-green-400">{formatMoney(registryStats.distributed)}</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-red-500/30">
              <div className="text-slate-400 text-xs mb-1">Не распределено</div>
              <div className="text-xl font-bold text-red-400">{formatMoney(registryStats.remaining)}</div>
              <div className="text-slate-500 text-xs">{registryStats.undistributedCount} реестров</div>
            </div>
          </div>

          {/* Registries table */}
          {registriesLoading ? (
            <div className="text-center py-12 text-slate-400">Загрузка...</div>
          ) : (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Статус</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Дата</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Описание</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Сумма</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Распределено</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Остаток</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {registries.map((reg, idx) => {
                      const remaining = Number(reg.remaining);
                      const isDistributed = remaining <= 0.01;
                      return (
                        <tr key={reg.id || idx} className="hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-3">
                            {isDistributed ? (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">✅ Распределён</span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-400">⏳ Ожидает</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{formatDate(reg.date)}</td>
                          <td className="px-4 py-3">
                            <div className="max-w-[300px] truncate text-white text-sm" title={reg.route}>{reg.route}</div>
                          </td>
                          <td className="px-4 py-3 text-right text-white font-semibold">{formatMoneyFull(reg.amount)}</td>
                          <td className="px-4 py-3 text-right text-green-400">{formatMoneyFull(reg.distributed_amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={isDistributed ? 'text-slate-500' : 'text-orange-400 font-semibold'}>
                              {formatMoneyFull(remaining)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setDistributeRegistry(reg)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                isDistributed 
                                  ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' 
                                  : 'bg-blue-600 text-white hover:bg-blue-500'
                              }`}
                            >
                              {isDistributed ? 'Просмотр' : 'Распределить'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {registries.length === 0 && (
                <div className="text-center py-8 text-slate-400">Нет реестров за выбранный период</div>
              )}
            </div>
          )}
        </>
      )}

      {/* Distribute modal */}
      {distributeRegistry && (
        <DistributeModal
          registry={distributeRegistry}
          onClose={() => setDistributeRegistry(null)}
          onSaved={loadRegistries}
        />
      )}
      {contractTripId !== null && <ContractDraftModal tripId={contractTripId} onClose={() => setContractTripId(null)} />}
    </div>
  );
}
