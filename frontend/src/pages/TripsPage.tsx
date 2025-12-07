import React, { useEffect, useState } from 'react';
import { getTrips } from '../services/api';
import type { Trip } from '../types';
import { Search, Filter } from 'lucide-react';

const TripsPage: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTrips();
  }, []);

  useEffect(() => {
    filterTrips();
  }, [searchTerm, trips]);

  const loadTrips = async () => {
    try {
      setIsLoading(true);
      const data = await getTrips();
      setTrips(data);
      setFilteredTrips(data);
    } catch (err: any) {
      setError('Ошибка загрузки рейсов');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterTrips = () => {
    if (!searchTerm) {
      setFilteredTrips(trips);
      return;
    }

    const filtered = trips.filter(
      (trip) =>
        trip.wb_trip_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.driver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.route_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTrips(filtered);
  };

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
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Рейсы</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">Список всех рейсов</p>
      </div>

      {/* Поиск */}
      <div className="mb-4 md:mb-6 flex items-center space-x-2 md:space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <button className="flex items-center px-3 md:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm md:text-base">
          <Filter size={18} className="mr-1 md:mr-2" />
          <span className="hidden sm:inline">Фильтры</span>
        </button>
      </div>

      {/* Таблица рейсов */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="text-xs md:text-sm text-gray-500 p-3 md:p-4 bg-gray-50 border-b md:hidden">
          <p>← Прокрутите таблицу горизонтально →</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  № Рейса WB
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата погрузки
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Водитель
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Машина
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Маршрут
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
                  Штраф
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    {searchTerm ? 'Рейсы не найдены' : 'Нет рейсов для отображения'}
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {trip.wb_trip_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(trip.loading_date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {trip.driver_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {trip.vehicle_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{trip.route_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {trip.distance_km}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {trip.trip_amount.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700 font-medium">
                      {trip.trip_amount_with_vat.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {trip.has_penalty ? (
                        <span className="text-red-600 font-medium">
                          {trip.penalty_amount.toLocaleString('ru-RU')} ₽
                        </span>
                      ) : (
                        <span className="text-green-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Итоги */}
      {filteredTrips.length > 0 && (
        <div className="mt-4 bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Всего рейсов</p>
              <p className="text-2xl font-bold text-gray-900">{filteredTrips.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Общая сумма</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredTrips.reduce((sum, trip) => sum + trip.trip_amount, 0).toLocaleString('ru-RU')} ₽
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Всего км</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredTrips.reduce((sum, trip) => sum + trip.distance_km, 0).toLocaleString('ru-RU')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Штрафы</p>
              <p className="text-2xl font-bold text-red-600">
                {filteredTrips.reduce((sum, trip) => sum + trip.penalty_amount, 0).toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripsPage;
