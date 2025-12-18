import React, { useEffect, useState } from 'react';
import { TrendingUp, Truck, Users, FileText, Fuel, MapPin, AlertCircle } from 'lucide-react';
import MonthYearPicker from '../components/MonthYearPicker';

// API URL for RF Transport data (PHP backend)
const RF_API_URL = '/api-rf-transport.php';

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

interface DriverReport {
  id: number;
  report_number: string;
  report_date: string;
  driver_name: string;
  vehicle_number: string;
  route_name: string;
  kilometers: number;
  fuel_consumed: number;
  salary_amount: number;
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
  const [driverReports, setDriverReports] = useState<DriverReport[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers' | 'contracts'>('vehicles');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Load all data in parallel
      const [statsRes, contractsRes, vehiclesRes, driversRes] = await Promise.all([
        fetch(`${RF_API_URL}?action=stats&month=${selectedMonth}`),
        fetch(`${RF_API_URL}?action=contracts&month=${selectedMonth}&limit=200`),
        fetch(`${RF_API_URL}?action=vehicles&month=${selectedMonth}&limit=50`),
        fetch(`${RF_API_URL}?action=drivers&month=${selectedMonth}&limit=50`),
      ]);

      // Check for errors
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
        <div className="p-4 md:p-6 overflow-x-auto">
          {activeTab === 'vehicles' && (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Машина</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рейсов</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выручка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vehicles.map((v, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{v.vehicle_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{v.trip_count}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-green-600 font-semibold">{formatMoney(v.total_revenue)}</td>
                  </tr>
                ))}
                {vehicles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Нет данных за выбранный период</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'drivers' && (
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
                {drivers.map((d, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{d.driver_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{d.report_count}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-blue-600">{formatNumber(d.total_km)} км</td>
                    <td className="px-4 py-3 whitespace-nowrap text-green-600 font-semibold">{formatMoney(d.total_salary)}</td>
                  </tr>
                ))}
                {drivers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Нет данных за выбранный период</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'contracts' && (
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
                {contracts.slice(0, 100).map((c, idx) => (
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
                {contracts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Нет данных за выбранный период</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {contracts.length > 100 && activeTab === 'contracts' && (
            <div className="mt-4 text-center text-gray-500 text-sm">
              Показано 100 из {contracts.length} договоров
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RFTransportPage;
