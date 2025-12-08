import React, { useEffect, useState } from 'react';
import { getStats } from '../services/api';
import type { Stats } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Truck, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MonthYearPicker from '../components/MonthYearPicker';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadStats();
  }, [selectedMonth]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const data = await getStats(selectedMonth);
      setStats(data);
    } catch (err: any) {
      setError('Ошибка загрузки статистики');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Компонент для отображения процента изменения
  const PercentageChange: React.FC<{ value: number }> = ({ value }) => {
    if (value === 0) return null;

    const isPositive = value > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? 'text-green-600' : 'text-red-600';
    const bgColor = isPositive ? 'bg-green-50' : 'bg-red-50';

    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded ${bgColor} ${color}`}>
        <Icon size={14} />
        <span className="text-xs font-semibold">
          {isPositive ? '+' : ''}{value.toFixed(1)}%
        </span>
      </div>
    );
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
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Дашборд</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1">Общая статистика транспортной компании</p>
          </div>

          {/* Выбор месяца */}
          <MonthYearPicker
            value={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Общая выручка без НДС - скрыто для бухгалтера */}
        {user?.role !== 'accountant' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <div className="flex items-center mb-2">
              <div className="bg-green-100 p-2 md:p-3 rounded-lg">
                <DollarSign className="text-green-600" size={20} />
              </div>
              <div className="ml-3 md:ml-4 flex-1">
                <p className="text-xs md:text-sm text-gray-600">Выручка без НДС</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">
                  {stats?.totalRevenue.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </div>
            {stats?.changes && (
              <div className="mt-2">
                <PercentageChange value={stats.changes.totalRevenue} />
              </div>
            )}
          </div>
        )}

        {/* Общая выручка с НДС - скрыто для бухгалтера */}
        {user?.role !== 'accountant' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
            <div className="flex items-center mb-2">
              <div className="bg-emerald-100 p-2 md:p-3 rounded-lg">
                <TrendingUp className="text-emerald-600" size={20} />
              </div>
              <div className="ml-3 md:ml-4 flex-1">
                <p className="text-xs md:text-sm text-gray-600">Выручка с НДС</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">
                  {stats?.totalRevenueWithVat.toLocaleString('ru-RU')} ₽
                </p>
                <p className="text-xs text-gray-500 mt-1">НДС 20%</p>
              </div>
            </div>
            {stats?.changes && (
              <div className="mt-2">
                <PercentageChange value={stats.changes.totalRevenueWithVat} />
              </div>
            )}
          </div>
        )}

        {/* Всего рейсов */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center mb-2">
            <div className="bg-blue-100 p-2 md:p-3 rounded-lg">
              <Truck className="text-blue-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4 flex-1">
              <p className="text-xs md:text-sm text-gray-600">Всего рейсов</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">{stats?.totalTrips}</p>
            </div>
          </div>
          {stats?.changes && (
            <div className="mt-2">
              <PercentageChange value={stats.changes.totalTrips} />
            </div>
          )}
        </div>

        {/* Водители */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center mb-2">
            <div className="bg-purple-100 p-2 md:p-3 rounded-lg">
              <Users className="text-purple-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4 flex-1">
              <p className="text-xs md:text-sm text-gray-600">Водителей</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">{stats?.totalDrivers}</p>
            </div>
          </div>
          {stats?.changes && (
            <div className="mt-2">
              <PercentageChange value={stats.changes.totalDrivers} />
            </div>
          )}
        </div>

        {/* Транспорт */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center mb-2">
            <div className="bg-indigo-100 p-2 md:p-3 rounded-lg">
              <Truck className="text-indigo-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4 flex-1">
              <p className="text-xs md:text-sm text-gray-600">Транспортных средств</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">{stats?.totalVehicles}</p>
            </div>
          </div>
          {stats?.changes && (
            <div className="mt-2">
              <PercentageChange value={stats.changes.totalVehicles} />
            </div>
          )}
        </div>

        {/* Штрафы */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center mb-2">
            <div className="bg-red-100 p-2 md:p-3 rounded-lg">
              <AlertCircle className="text-red-600" size={20} />
            </div>
            <div className="ml-3 md:ml-4 flex-1">
              <p className="text-xs md:text-sm text-gray-600">Штрафы</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {stats?.totalPenalties.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
          {stats?.changes && (
            <div className="mt-2">
              <PercentageChange value={stats.changes.totalPenalties} />
            </div>
          )}
        </div>
      </div>

      {/* Дополнительная информация */}
      <div className="mt-6 md:mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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
