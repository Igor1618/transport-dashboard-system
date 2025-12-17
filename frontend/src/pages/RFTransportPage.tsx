import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TrendingUp, Truck, Users, FileText, Fuel, MapPin } from 'lucide-react';
import MonthYearPicker from '../components/MonthYearPicker';

// Supabase client для данных 1C
const supabase = createClient(
  'http://195.26.226.37:8000',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.LGzLagUWLYU030_PrhQdahdHGhALq6agEyzf3KH3bI0'
);

interface Contract {
  number: string;
  date: string;
  contractor_name: string;
  vehicle_number: string;
  driver_name: string;
  route: string;
  amount: number;
}

interface DriverReport {
  id: string;
  driver_name: string;
  vehicle_number: string;
  mileage: number;
  fuel_amount: number;
  fuel_quantity: number;
  driver_accruals: number;
  driver_payments: number;
}

interface VehicleAggregated {
  vehicle_number: string;
  contracts_count: number;
  total_amount: number;
  mileage: number;
  fuel_amount: number;
}

interface DriverAggregated {
  driver_name: string;
  contracts_count: number;
  total_amount: number;
  accruals: number;
  payments: number;
}

const RFTransportPage: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [driverReports, setDriverReports] = useState<DriverReport[]>([]);
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

      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;

      // Load contracts
      const { data: contractsData, error: cErr } = await supabase
        .from('contracts')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (cErr) throw cErr;
      setContracts(contractsData || []);

      // Load driver reports
      const { data: reportsData, error: rErr } = await supabase
        .from('driver_reports')
        .select('*')
        .gte('date_from', startDate)
        .lte('date_to', endDate + 'T23:59:59');

      if (rErr) throw rErr;
      setDriverReports(reportsData || []);

    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Aggregations
  const totalRevenue = contracts.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalFuel = driverReports.reduce((sum, r) => sum + (r.fuel_amount || 0), 0);
  const totalMileage = driverReports.reduce((sum, r) => sum + (r.mileage || 0), 0);
  const uniqueVehicles = new Set(contracts.map(c => c.vehicle_number).filter(Boolean));
  const uniqueDrivers = new Set(contracts.map(c => c.driver_name).filter(Boolean));

  // Aggregate by vehicle
  const vehiclesAggregated: VehicleAggregated[] = React.useMemo(() => {
    const map: Record<string, VehicleAggregated> = {};

    contracts.forEach(c => {
      const key = c.vehicle_number || 'Неизвестно';
      if (!map[key]) {
        map[key] = { vehicle_number: key, contracts_count: 0, total_amount: 0, mileage: 0, fuel_amount: 0 };
      }
      map[key].contracts_count++;
      map[key].total_amount += c.amount || 0;
    });

    driverReports.forEach(r => {
      const key = r.vehicle_number || 'Неизвестно';
      if (map[key]) {
        map[key].mileage += r.mileage || 0;
        map[key].fuel_amount += r.fuel_amount || 0;
      }
    });

    return Object.values(map).sort((a, b) => b.total_amount - a.total_amount);
  }, [contracts, driverReports]);

  // Aggregate by driver
  const driversAggregated: DriverAggregated[] = React.useMemo(() => {
    const map: Record<string, DriverAggregated> = {};

    contracts.forEach(c => {
      const key = c.driver_name || 'Неизвестно';
      if (!map[key]) {
        map[key] = { driver_name: key, contracts_count: 0, total_amount: 0, accruals: 0, payments: 0 };
      }
      map[key].contracts_count++;
      map[key].total_amount += c.amount || 0;
    });

    driverReports.forEach(r => {
      const key = r.driver_name || 'Неизвестно';
      if (map[key]) {
        map[key].accruals += r.driver_accruals || 0;
        map[key].payments += r.driver_payments || 0;
      }
    });

    return Object.values(map).sort((a, b) => b.total_amount - a.total_amount);
  }, [contracts, driverReports]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num);
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
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
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
              <p className="text-lg md:text-xl font-bold text-gray-900">{formatMoney(totalRevenue)}</p>
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
              <p className="text-lg md:text-xl font-bold text-gray-900">{formatNumber(contracts.length)}</p>
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
              <p className="text-lg md:text-xl font-bold text-gray-900">{uniqueVehicles.size}</p>
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
              <p className="text-lg md:text-xl font-bold text-gray-900">{uniqueDrivers.size}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-orange-100 p-2 md:p-3 rounded-lg">
              <Fuel className="text-orange-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Топливо</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">{formatMoney(totalFuel)}</p>
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
              <p className="text-lg md:text-xl font-bold text-gray-900">{formatNumber(totalMileage)} км</p>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Договоров</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выручка</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пробег</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Топливо</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vehiclesAggregated.map((v, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{v.vehicle_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{v.contracts_count}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-green-600 font-semibold">{formatMoney(v.total_amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatNumber(v.mileage)} км</td>
                    <td className="px-4 py-3 whitespace-nowrap text-orange-600">{formatMoney(v.fuel_amount)}</td>
                  </tr>
                ))}
                {vehiclesAggregated.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Нет данных за выбранный период</td>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Договоров</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выручка</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Начисления</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выплаты</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {driversAggregated.map((d, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{d.driver_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{d.contracts_count}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-green-600 font-semibold">{formatMoney(d.total_amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-blue-600">{formatMoney(d.accruals)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-purple-600">{formatMoney(d.payments)}</td>
                  </tr>
                ))}
                {driversAggregated.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Нет данных за выбранный период</td>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Водитель</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {contracts.slice(0, 100).map((c, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{c.number}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {c.date ? new Date(c.date).toLocaleDateString('ru-RU') : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 max-w-[200px] truncate">{c.contractor_name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{c.vehicle_number || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 max-w-[150px] truncate">{c.driver_name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-green-600 font-semibold">{formatMoney(c.amount)}</td>
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
