import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyStats } from '../types';

interface DashboardChartsProps {
  data: MonthlyStats[];
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ data }) => {
  // Форматирование чисел для подписей
  const formatCurrency = (value: number) => {
    return `${(value / 1000).toFixed(0)}к ₽`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {/* График выручки */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Выручка по месяцам</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={formatCurrency} />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString('ru-RU')} ₽`, '']}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalRevenue"
              stroke="#10b981"
              strokeWidth={2}
              name="Без НДС"
              dot={{ fill: '#10b981', r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="totalRevenueWithVat"
              stroke="#059669"
              strokeWidth={2}
              name="С НДС"
              dot={{ fill: '#059669', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* График количества рейсов */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Количество рейсов</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              formatter={(value: number) => [value, 'Рейсов']}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            <Bar dataKey="totalTrips" fill="#3b82f6" name="Рейсов" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* График штрафов */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Штрафы по месяцам</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={formatCurrency} />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString('ru-RU')} ₽`, 'Штрафы']}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            <Bar dataKey="totalPenalties" fill="#ef4444" name="Штрафы" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* График водителей и машин */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Водители и транспорт</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip labelStyle={{ color: '#000' }} />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalDrivers"
              stroke="#8b5cf6"
              strokeWidth={2}
              name="Водителей"
              dot={{ fill: '#8b5cf6', r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="totalVehicles"
              stroke="#6366f1"
              strokeWidth={2}
              name="Машин"
              dot={{ fill: '#6366f1', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DashboardCharts;
