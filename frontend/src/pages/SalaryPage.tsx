import React, { useEffect, useState } from 'react';
import { getSalary, getDriverTrips } from '../services/api';
import type { SalaryData, DriverTripDetail } from '../types';
import { DollarSign, TrendingUp, Calendar, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SalaryPage: React.FC = () => {
  const { user } = useAuth();
  const [salaryData, setSalaryData] = useState<SalaryData[]>([]);
  const [filteredSalaryData, setFilteredSalaryData] = useState<SalaryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [driverTrips, setDriverTrips] = useState<Record<string, DriverTripDetail[]>>({});
  const [loadingTrips, setLoadingTrips] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSalary();
  }, [selectedMonth]);

  useEffect(() => {
    filterSalary();
  }, [searchTerm, salaryData]);

  const loadSalary = async () => {
    try {
      setIsLoading(true);
      const data = await getSalary(selectedMonth);
      setSalaryData(data);
      setFilteredSalaryData(data);
    } catch (err: any) {
      setError('Ошибка загрузки данных о зарплатах');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterSalary = () => {
    if (!searchTerm) {
      setFilteredSalaryData(salaryData);
      return;
    }

    const filtered = salaryData.filter((item) =>
      item.driver_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSalaryData(filtered);
  };

  const toggleDriverExpand = async (driverName: string) => {
    if (expandedDriver === driverName) {
      setExpandedDriver(null);
    } else {
      setExpandedDriver(driverName);
      if (!driverTrips[driverName]) {
        setLoadingTrips(driverName);
        try {
          const trips = await getDriverTrips(driverName, selectedMonth);
          setDriverTrips({ ...driverTrips, [driverName]: trips });
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

  const totalSalary = filteredSalaryData.reduce((sum, item) => sum + Number(item.net_salary), 0);
  const totalRevenue = filteredSalaryData.reduce((sum, item) => sum + Number(item.total_revenue), 0);
  const totalPenalties = filteredSalaryData.reduce((sum, item) => sum + Number(item.total_penalties), 0);

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
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Расчет зарплат</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">Зарплаты водителей по результатам рейсов</p>
          </div>

          {/* Выбор месяца */}
          <div className="flex items-center space-x-2 md:space-x-4">
            <Calendar className="text-gray-600" size={20} />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm md:text-base"
            />
          </div>
        </div>

        {/* Поиск по ФИО водителя */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Поиск по ФИО водителя..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Общая статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Общая выручка - скрыто для бухгалтера */}
        {user?.role !== 'accountant' && (
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <div className="flex items-center">
              <div className="bg-green-100 p-2 md:p-3 rounded-lg">
                <DollarSign className="text-green-600" size={20} />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm text-gray-600">Общая выручка</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">
                  {totalRevenue.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 md:p-3 rounded-lg">
              <TrendingUp className="text-blue-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">К выплате водителям</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {totalSalary.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-red-100 p-2 md:p-3 rounded-lg">
              <DollarSign className="text-red-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm text-gray-600">Штрафы (информация)</p>
              <p className="text-lg md:text-2xl font-bold text-red-600">
                {totalPenalties.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Таблица зарплат */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="text-xs md:text-sm text-gray-500 p-3 md:p-4 bg-gray-50 border-b md:hidden">
          <p>← Прокрутите таблицу горизонтально →</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Водитель
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Рейсов
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Км
                </th>
                {user?.role !== 'accountant' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Выручка
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Штрафы
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  К выплате
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSalaryData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    {searchTerm ? 'Водитель не найден' : 'Нет данных за выбранный период'}
                  </td>
                </tr>
              ) : (
                filteredSalaryData.map((item, index) => (
                  <React.Fragment key={index}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleDriverExpand(item.driver_name)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {expandedDriver === item.driver_name ? (
                          <ChevronDown className="text-gray-500" size={20} />
                        ) : (
                          <ChevronRight className="text-gray-500" size={20} />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.driver_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.trips_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.total_distance.toLocaleString('ru-RU')}
                      </td>
                      {user?.role !== 'accountant' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.total_revenue.toLocaleString('ru-RU')} ₽
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {item.total_penalties > 0
                          ? `${item.total_penalties.toLocaleString('ru-RU')} ₽`
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                        {item.net_salary.toLocaleString('ru-RU')} ₽
                      </td>
                    </tr>
                    {expandedDriver === item.driver_name && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          {loadingTrips === item.driver_name ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                              <span className="ml-2 text-gray-600">Загрузка рейсов...</span>
                            </div>
                          ) : driverTrips[item.driver_name] && driverTrips[item.driver_name].length > 0 ? (
                            <div className="space-y-2">
                              <h4 className="text-sm font-bold text-gray-700 mb-3">Детализация рейсов:</h4>
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">№ Рейса WB</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Дата</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Маршрут</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Км</th>
                                    {user?.role !== 'accountant' && (
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Выручка</th>
                                    )}
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Тариф водителя</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Штраф</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {driverTrips[item.driver_name].map((trip) => (
                                    <tr key={trip.id} className="hover:bg-gray-100">
                                      <td className="px-4 py-2 text-gray-900">{trip.wb_trip_number}</td>
                                      <td className="px-4 py-2 text-gray-600">{formatDate(trip.loading_date)}</td>
                                      <td className="px-4 py-2 text-gray-900">{trip.route_name}</td>
                                      <td className="px-4 py-2 text-gray-600">{trip.distance_km.toLocaleString('ru-RU')}</td>
                                      {user?.role !== 'accountant' && (
                                        <td className="px-4 py-2 text-gray-900">{trip.revenue.toLocaleString('ru-RU')} ₽</td>
                                      )}
                                      <td className="px-4 py-2 text-green-600 font-medium">{trip.driver_rate.toLocaleString('ru-RU')} ₽</td>
                                      <td className="px-4 py-2 text-red-600">
                                        {trip.penalty_amount > 0 ? `${trip.penalty_amount.toLocaleString('ru-RU')} ₽` : '—'}
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
      {filteredSalaryData.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">Информация о расчете</h3>
          <ul className="list-disc list-inside text-blue-800 space-y-1">
            <li>Зарплата рассчитывается как сумма тарифов за все рейсы водителя</li>
            <li>Штрафы показаны для информации, но не вычитаются из зарплаты</li>
            <li>Нажмите на строку водителя чтобы увидеть детализацию по каждому рейсу</li>
            <li>Данные обновляются при каждой загрузке путевых листов</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SalaryPage;
