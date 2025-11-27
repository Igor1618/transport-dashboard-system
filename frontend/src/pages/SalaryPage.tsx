import React, { useEffect, useState } from 'react';
import { getSalary } from '../services/api';
import type { SalaryData } from '../types';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';

const SalaryPage: React.FC = () => {
  const [salaryData, setSalaryData] = useState<SalaryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadSalary();
  }, [selectedMonth]);

  const loadSalary = async () => {
    try {
      setIsLoading(true);
      const data = await getSalary(selectedMonth);
      setSalaryData(data);
    } catch (err: any) {
      setError('Ошибка загрузки данных о зарплатах');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalSalary = salaryData.reduce((sum, item) => sum + item.net_salary, 0);
  const totalRevenue = salaryData.reduce((sum, item) => sum + item.total_revenue, 0);
  const totalPenalties = salaryData.reduce((sum, item) => sum + item.total_penalties, 0);

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Расчет зарплат</h1>
          <p className="text-gray-600 mt-2">Зарплаты водителей по результатам рейсов</p>
        </div>

        {/* Выбор месяца */}
        <div className="flex items-center space-x-4">
          <Calendar className="text-gray-600" size={20} />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Общая статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Общая выручка</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalRevenue.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">К выплате водителям</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalSalary.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-red-100 p-3 rounded-lg">
              <DollarSign className="text-red-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Штрафы</p>
              <p className="text-2xl font-bold text-red-600">
                {totalPenalties.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Таблица зарплат */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Водитель
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Рейсов
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Км
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Выручка
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Штрафы
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  К выплате
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {salaryData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Нет данных за выбранный период
                  </td>
                </tr>
              ) : (
                salaryData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.driver_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.trips_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.total_distance.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.total_revenue.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {item.total_penalties > 0
                        ? `${item.total_penalties.toLocaleString('ru-RU')} ₽`
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                      {item.net_salary.toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Дополнительная информация */}
      {salaryData.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">Информация о расчете</h3>
          <ul className="list-disc list-inside text-blue-800 space-y-1">
            <li>Зарплата рассчитывается на основе выручки с рейсов за выбранный период</li>
            <li>Из зарплаты вычитаются штрафы</li>
            <li>Данные обновляются при каждой загрузке путевых листов</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SalaryPage;
