import React, { useEffect, useState } from 'react';
import { getVehicleStats, getVehicleTrips } from '../services/api';
import type { VehicleStats, VehicleTripDetail } from '../types';
import { Truck, TrendingUp, ChevronDown, ChevronRight, Activity, Search } from 'lucide-react';
import MonthYearPicker from '../components/MonthYearPicker';

const VehiclesPage: React.FC = () => {
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [filteredVehicleStats, setFilteredVehicleStats] = useState<VehicleStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
  const [vehicleTrips, setVehicleTrips] = useState<Record<string, VehicleTripDetail[]>>({});
  const [loadingTrips, setLoadingTrips] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadVehicleStats();
  }, [selectedMonth]);

  useEffect(() => {
    filterVehicles();
  }, [searchTerm, vehicleStats]);

  const loadVehicleStats = async () => {
    try {
      setIsLoading(true);
      const data = await getVehicleStats(selectedMonth);
      setVehicleStats(data);
      setFilteredVehicleStats(data);
    } catch (err: any) {
      setError('Ошибка загрузки данных по автомобилям');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterVehicles = () => {
    if (!searchTerm) {
      setFilteredVehicleStats(vehicleStats);
      return;
    }

    const filtered = vehicleStats.filter((vehicle) =>
      vehicle.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredVehicleStats(filtered);
  };

  const toggleVehicleExpand = async (vehicleNumber: string) => {
    if (expandedVehicle === vehicleNumber) {
      setExpandedVehicle(null);
    } else {
      setExpandedVehicle(vehicleNumber);
      if (!vehicleTrips[vehicleNumber]) {
        setLoadingTrips(vehicleNumber);
        try {
          const trips = await getVehicleTrips(vehicleNumber, selectedMonth);
          setVehicleTrips({ ...vehicleTrips, [vehicleNumber]: trips });
        } catch (err) {
          console.error('Ошибка загрузки рейсов:', err);
        } finally {
          setLoadingTrips(null);
        }
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const totalRevenue = filteredVehicleStats.reduce((sum, item) => sum + (Number(item.total_revenue) || 0), 0);
  const totalRevenueWithVat = filteredVehicleStats.reduce((sum, item) => sum + (Number(item.total_revenue_with_vat) || 0), 0);
  const totalDistance = filteredVehicleStats.reduce((sum, item) => sum + (Number(item.total_distance) || 0), 0);
  const totalTrips = filteredVehicleStats.reduce((sum, item) => sum + (Number(item.trips_count) || 0), 0);
  const avgRevenuePerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;
  const avgRevenuePerKmWithVat = totalDistance > 0 ? totalRevenueWithVat / totalDistance : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Дашборд автомобилей</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">Статистика по эффективности автопарка</p>
          </div>

          {/* Выбор месяца */}
          <MonthYearPicker
            value={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>

        {/* Поиск по номеру машины */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Поиск по номеру машины..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Общая статистика */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-2 md:p-3 rounded-lg">
              <TrendingUp className="text-green-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Выручка без НДС</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {totalRevenue.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-emerald-100 p-2 md:p-3 rounded-lg">
              <TrendingUp className="text-emerald-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Выручка с НДС</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {totalRevenueWithVat.toLocaleString('ru-RU')} ₽
              </p>
              <p className="text-xs text-gray-500">НДС 20%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 md:p-3 rounded-lg">
              <Activity className="text-blue-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Всего рейсов</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {totalTrips.toLocaleString('ru-RU')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-purple-100 p-2 md:p-3 rounded-lg">
              <Truck className="text-purple-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Пробег</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {totalDistance.toLocaleString('ru-RU')} км
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-orange-100 p-2 md:p-3 rounded-lg">
              <Activity className="text-orange-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Выручка/км</p>
              <p className="text-base md:text-xl font-bold text-gray-900">
                {avgRevenuePerKm.toFixed(2)} ₽
              </p>
              <p className="text-xs md:text-sm text-emerald-600 font-medium">
                {avgRevenuePerKmWithVat.toFixed(2)} ₽ с НДС
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Таблица автомобилей */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <div className="text-xs md:text-sm text-gray-500 p-3 md:p-4 bg-gray-50 border-b">
            <p className="hidden md:block">Нажмите на строку для просмотра детализации рейсов</p>
            <p className="md:hidden">Нажмите на автомобиль для деталей</p>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Гос. номер
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Рейсов
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Км
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Без НДС
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  С НДС
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Водителей
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Раб. дней
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ₽/км без НДС
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ₽/км с НДС
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Рейсов/день
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVehicleStats.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
                    {searchTerm ? 'Автомобиль не найден' : 'Нет данных за выбранный период'}
                  </td>
                </tr>
              ) : (
                filteredVehicleStats.map((vehicle, index) => (
                  <React.Fragment key={index}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleVehicleExpand(vehicle.vehicle_number)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {expandedVehicle === vehicle.vehicle_number ? (
                          <ChevronDown className="text-gray-500" size={20} />
                        ) : (
                          <ChevronRight className="text-gray-500" size={20} />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        🚛 {vehicle.vehicle_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Number(vehicle.trips_count) || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Number(vehicle.total_distance || 0).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {Number(vehicle.total_revenue || 0).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">
                        {Number(vehicle.total_revenue_with_vat || 0).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Number(vehicle.drivers_count) || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Number(vehicle.working_days) || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                        {Number(vehicle.revenue_per_km || 0).toFixed(2)} ₽
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-medium">
                        {Number(vehicle.revenue_per_km_with_vat || 0).toFixed(2)} ₽
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-medium">
                        {Number(vehicle.trips_per_day || 0).toFixed(1)}
                      </td>
                    </tr>
                    {expandedVehicle === vehicle.vehicle_number && (
                      <tr>
                        <td colSpan={11} className="px-6 py-4 bg-gray-50">
                          {loadingTrips === vehicle.vehicle_number ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                              <span className="ml-2 text-gray-600">Загрузка рейсов...</span>
                            </div>
                          ) : vehicleTrips[vehicle.vehicle_number] && vehicleTrips[vehicle.vehicle_number].length > 0 ? (
                            <div className="space-y-2">
                              <h4 className="text-sm font-bold text-gray-700 mb-3">Детализация рейсов:</h4>
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">№ Рейса WB</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Дата</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Водитель</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Маршрут</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Км</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Без НДС</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">С НДС</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Штраф</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {vehicleTrips[vehicle.vehicle_number].map((trip) => (
                                    <tr key={trip.id} className="hover:bg-gray-100">
                                      <td className="px-4 py-2 text-gray-900">{trip.wb_trip_number}</td>
                                      <td className="px-4 py-2 text-gray-600">{formatDate(trip.loading_date)}</td>
                                      <td className="px-4 py-2 text-gray-900">{trip.driver_name}</td>
                                      <td className="px-4 py-2 text-gray-900">{trip.route_name}</td>
                                      <td className="px-4 py-2 text-gray-600">{Number(trip.distance_km || 0).toLocaleString('ru-RU')}</td>
                                      <td className="px-4 py-2 text-green-600 font-medium">{Number(trip.revenue || 0).toLocaleString('ru-RU')} ₽</td>
                                      <td className="px-4 py-2 text-emerald-600 font-medium">{Number(trip.revenue_with_vat || 0).toLocaleString('ru-RU')} ₽</td>
                                      <td className="px-4 py-2 text-red-600">
                                        {Number(trip.penalty_amount) > 0 ? `${Number(trip.penalty_amount).toLocaleString('ru-RU')} ₽` : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-center text-gray-500 py-4">Нет данных о рейсах</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Дополнительная информация */}
      {filteredVehicleStats.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 md:p-6">
          <h3 className="text-base md:text-lg font-bold text-blue-900 mb-2 md:mb-3">Метрики эффективности</h3>
          <ul className="list-disc list-inside text-blue-800 space-y-1 text-xs md:text-sm">
            <li><strong>₽/км</strong> - выручка на километр пробега (показатель рентабельности маршрутов)</li>
            <li><strong>Рейсов/день</strong> - среднее количество рейсов в день (показатель загрузки автомобиля)</li>
            <li><strong>Раб. дней</strong> - количество дней когда автомобиль был в работе</li>
            <li className="hidden md:list-item">Нажмите на строку автомобиля чтобы увидеть детализацию всех рейсов</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default VehiclesPage;
