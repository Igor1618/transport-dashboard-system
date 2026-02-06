'use client';
import { formatDate } from '@/lib/dates';

import { useState, useEffect, useMemo } from 'react';
import { FileText, Truck, Calendar, Building2, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface Contract {
  number: string;
  date: string;
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

type OrderItem = (Contract | Trip) & { source: '1C' | 'WB' };

const formatMoney = (amount: number) => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M ₽`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}К ₽`;
  return `${amount.toLocaleString('ru-RU')} ₽`;
};


// Проверка на реестр РВБ
const isRvbRegistry = (item: Contract) => {
  return item.contractor_name?.includes('РВБ') && item.route?.includes('реестру');
};

export default function TripsPage() {
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
  const [excludeRvb, setExcludeRvb] = useState(true); // По умолчанию исключаем РВБ реестры

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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
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
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-xs mb-1">Реестры РВБ (не распред.)</div>
              <div className="text-xl font-bold text-orange-400">{formatMoney(rvbStats.total)}</div>
              <div className="text-slate-500 text-xs">{rvbStats.count} шт</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeRvb}
                onChange={(e) => setExcludeRvb(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-sm">Скрыть</span>
            </label>
          </div>
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
          <button
            onClick={() => setSourceFilter('all')}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              sourceFilter === 'all'
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setSourceFilter('1C')}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              sourceFilter === '1C'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            1С
          </button>
          <button
            onClick={() => setSourceFilter('WB')}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              sourceFilter === 'WB'
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            WB
          </button>
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
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white"
                    onClick={() => toggleSort('date')}
                  >
                    <span className="flex items-center gap-1">
                      Дата
                      {sortField === 'date' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Машина</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase hidden md:table-cell">Контрагент</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase hidden lg:table-cell">Маршрут</th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase cursor-pointer hover:text-white"
                    onClick={() => toggleSort('amount')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Сумма
                      {sortField === 'amount' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {combinedData.slice(0, 100).map((item, idx) => {
                  const is1C = item.source === '1C';
                  const number = is1C ? (item as Contract).number : (item as Trip).wb_trip_number;
                  const date = is1C ? (item as Contract).date : (item as Trip).loading_date;
                  const contractor = is1C ? (item as Contract).contractor_name : 'Wildberries';
                  const route = is1C ? (item as Contract).route : (item as Trip).route_name;
                  const amount = is1C ? (item as Contract).amount : (item as Trip).trip_amount;
                  
                  return (
                    <tr key={`${item.source}-${number}-${idx}`} className="hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          is1C ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {item.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-mono text-sm">{number}</td>
                      <td className="px-4 py-3 text-slate-300">{formatDate(date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-slate-500" />
                          <span className="text-white">{item.vehicle_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 hidden md:table-cell">
                        <div className="max-w-[200px] truncate" title={contractor}>
                          {contractor}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-sm hidden lg:table-cell">
                        <div className="max-w-[300px] truncate" title={route}>
                          {route}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-green-400 font-semibold">{formatMoney(amount)}</span>
                      </td>
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
    </div>
  );
}
