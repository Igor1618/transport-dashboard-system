import React, { useEffect, useState, useMemo } from 'react';
import { TrendingUp, Truck, Users, FileText, Fuel, MapPin, AlertCircle, Search } from 'lucide-react';
import MonthYearPicker from '../components/MonthYearPicker';

// API URL for RF Transport data (Python backend)
const RF_API_URL = '/rf-api';

interface Stats {
  contracts: {
    total: number;
    vehicles: number;
    contractors: number;
    sum: number;
  };
  driver_reports: {
    total: number;
    vehicles: number;
    drivers: number;
    total_km: number;
    total_salary: number;
  };
}

interface Contract {
  id: number;
  contract_number: string;
  contract_date: string;
  contractor_name: string;
  vehicle_number: string;
  route_name: string;
  cargo_type: string;
  total_sum: number;
  status: string;
}

interface VehicleSummary {
  vehicle_number: string;
  trip_count: number;
  total_revenue: number;
}

interface DriverSummary {
  driver_name: string;
  report_count: number;
  total_km: number;
  total_salary: number;
}

const RFTransportPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers' | 'contracts'>('vehicles');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Search states
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [contractSearch, setContractSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const [statsRes, contractsRes, vehiclesRes, driversRes] = await Promise.all([
        fetch(`${RF_API_URL}/stats?month=${selectedMonth}`),
        fetch(`${RF_API_URL}/contracts?month=${selectedMonth}&limit=500`),
        fetch(`${RF_API_URL}/vehicles?month=${selectedMonth}&limit=100`),
        fetch(`${RF_API_URL}/drivers?month=${selectedMonth}&limit=100`),
      ]);

      if (!statsRes.ok) throw new Error(`Stats error: ${statsRes.status}`);
      if (!contractsRes.ok) throw new Error(`Contracts error: ${contractsRes.status}`);

      const statsData = await statsRes.json();
      const contractsData = await contractsRes.json();
      const vehiclesData = await vehiclesRes.json();
      const driversData = await driversRes.json();

      if (!statsData.ok) throw new Error(statsData.error || 'Failed to load stats');
      if (!contractsData.ok) throw new Error(contractsData.error || 'Failed to load contracts');

      setStats(statsData);
      setContracts(contractsData.data || []);
      setVehicles(vehiclesData.data || []);
      setDrivers(driversData.data || []);

    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных');
      console.error('RF Transport load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered data
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch.trim()) return vehicles;
    const search = vehicleSearch.toLowerCase();
    return vehicles.filter(v =>
      v.vehicle_number?.toLowerCase().includes(search)
    );
  }, [vehicles, vehicleSearch]);

  const filteredDrivers = useMemo(() => {
    if (!driverSearch.trim()) return drivers;
    const search = driverSearch.toLowerCase();
    return drivers.filter(d =>
      d.driver_name?.toLowerCase().includes(search)
    );
  }, [drivers, driverSearch]);

  const filteredContracts = useMemo(() => {
    if (!contractSearch.trim()) return contracts;
    const search = contractSearch.toLowerCase();
    return contracts.filter(c =>
      c.contract_number?.toLowerCase().includes(search) ||
      c.contractor_name?.toLowerCase().includes(search) ||
      c.vehicle_number?.toLowerCase().includes(search) ||
      c.route_name?.toLowerCase().includes(search)
    );
  }, [contracts, contractSearch]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num || 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Транспорт РФ</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1">Данные из 1C (договоры, отчёты водителей)</p>
          </div>
          <MonthYearPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-2 md:p-3 rounded-lg">
              <TrendingUp className="text-green-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Выручка</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">
                {formatMoney(stats?.contracts?.sum || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 md:p-3 rounded-lg">
              <FileText className="text-blue-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Договоров</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">
                {formatNumber(stats?.contracts?.total || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-purple-100 p-2 md:p-3 rounded-lg">
              <Truck className="text-purple-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Машин</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">
                {stats?.contracts?.vehicles || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-indigo-100 p-2 md:p-3 rounded-lg">
              <Users className="text-indigo-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Водителей</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">
                {stats?.driver_reports?.drivers || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-orange-100 p-2 md:p-3 rounded-lg">
              <Fuel className="text-orange-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Зарплаты</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">
                {formatMoney(stats?.driver_reports?.total_salary || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-teal-100 p-2 md:p-3 rounded-lg">
              <MapPin className="text-teal-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Пробег</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">
                {formatNumber(stats?.driver_reports?.total_km || 0)} км
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 px-4 md:px-6" aria-label="Tabs">
            {[
              { id: 'vehicles', name: 'Машины', icon: Truck },
              { id: 'drivers', name: 'Водители', icon: Users },
              { id: 'contracts', name: 'Договоры', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={18} />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6">
          {/* Search input */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              {activeTab === 'vehicles' && (
                <input
                  type="text"
                  placeholder="Поиск по номеру машины..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              )}
              {activeTab === 'drivers' && (
                <input
                  type="text"
                  placeholder="Поиск по имени водителя..."
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              )}
              {activeTab === 'contracts' && (
                <input
                  type="text"
                  placeholder="Поиск по номеру, контрагенту, машине, маршруту..."
                  value={contractSearch}
                  onChange={(e) => setContractSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'vehicles' && (
              <>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Машина</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рейсов</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выручка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredVehicles.map((v, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{v.vehicle_number}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{v.trip_count}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-green-600 font-semibold">{formatMoney(v.total_revenue)}</td>
                      </tr>
                    ))}
                    {filteredVehicles.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                          {vehicleSearch ? 'Ничего не найдено' : 'Нет данных за выбранный период'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {vehicleSearch && filteredVehicles.length > 0 && (
                  <div className="mt-2 text-sm text-gray-500">
                    Найдено: {filteredVehicles.length} из {vehicles.length}
                  </div>
                )}
              </>
            )}

            {activeTab === 'drivers' && (
              <>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Водитель</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рапортов</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пробег</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Зарплата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDrivers.map((d, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{d.driver_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{d.report_count}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-blue-600">{formatNumber(d.total_km)} км</td>
                        <td className="px-4 py-3 whitespace-nowrap text-green-600 font-semibold">{formatMoney(d.total_salary)}</td>
                      </tr>
                    ))}
                    {filteredDrivers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          {driverSearch ? 'Ничего не найдено' : 'Нет данных за выбранный период'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {driverSearch && filteredDrivers.length > 0 && (
                  <div className="mt-2 text-sm text-gray-500">
                    Найдено: {filteredDrivers.length} из {drivers.length}
                  </div>
                )}
              </>
            )}

            {activeTab === 'contracts' && (
              <>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Номер</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Контрагент</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Машина</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Маршрут</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredContracts.slice(0, 100).map((c, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{c.contract_number || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                          {c.contract_date ? new Date(c.contract_date).toLocaleDateString('ru-RU') : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 max-w-[200px] truncate">{c.contractor_name || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{c.vehicle_number || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 max-w-[150px] truncate">{c.route_name || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-green-600 font-semibold">{formatMoney(c.total_sum)}</td>
                      </tr>
                    ))}
                    {filteredContracts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          {contractSearch ? 'Ничего не найдено' : 'Нет данных за выбранный период'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {filteredContracts.length > 100 && (
                  <div className="mt-4 text-center text-gray-500 text-sm">
                    Показано 100 из {filteredContracts.length} договоров
                  </div>
                )}
                {contractSearch && filteredContracts.length > 0 && filteredContracts.length <= 100 && (
                  <div className="mt-2 text-sm text-gray-500">
                    Найдено: {filteredContracts.length} из {contracts.length}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RFTransportPage;
