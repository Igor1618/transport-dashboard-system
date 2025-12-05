import React, { useEffect, useState } from 'react';
import { getStats } from '../services/api';
import type { Stats } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Truck, Users, AlertCircle } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const data = await getStats();
      setStats(data);
    } catch (err: any) {
      setError('Ошибка загрузки статистики');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
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
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Дашборд</h1>
        <p className="text-gray-500 mt-1">Общая статистика транспортной компании</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Общая выручка без НДС */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="text-green-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Выручка без НДС</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.totalRevenue.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Общая выручка с НДС */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-emerald-100 p-3 rounded-lg">
                <TrendingUp className="text-emerald-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Выручка с НДС</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.totalRevenueWithVat.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">НДС 20%</p>
        </div>

        {/* Всего рейсов */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Truck className="text-blue-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Всего рейсов</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalTrips}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            В этом месяце: <span className="font-semibold">{stats?.tripsThisMonth}</span>
          </p>
        </div>

        {/* Водители */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Users className="text-purple-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Водителей</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalDrivers}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Транспорт */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-indigo-100 p-3 rounded-lg">
                <Truck className="text-indigo-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Транспортных средств</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalVehicles}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Штрафы */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertCircle className="text-red-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Штрафы</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.totalPenalties.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Дополнительная информация */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/trips"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all"
          >
            <Truck className="text-indigo-600 mr-3" size={24} />
            <div>
              <p className="font-semibold text-gray-900">Просмотр рейсов</p>
              <p className="text-sm text-gray-600">Список всех рейсов</p>
            </div>
          </a>
          <a
            href="/upload"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all"
          >
            <TrendingUp className="text-green-600 mr-3" size={24} />
            <div>
              <p className="font-semibold text-gray-900">Загрузить данные</p>
              <p className="text-sm text-gray-600">Импорт Excel файлов</p>
            </div>
          </a>
          <a
            href="/salary"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all"
          >
            <DollarSign className="text-purple-600 mr-3" size={24} />
            <div>
              <p className="font-semibold text-gray-900">Зарплаты</p>
              <p className="text-sm text-gray-600">Расчет зарплат водителей</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
