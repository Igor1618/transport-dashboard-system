import React, { useEffect, useState } from 'react';
import { getRoutes, updateRoute, createRoute, deleteRoute } from '../services/api';
import type { RouteRate } from '../types';
import { DollarSign, Edit2, Save, X, Plus, Trash2, MapPin } from 'lucide-react';

const RoutesPage: React.FC = () => {
  const [routes, setRoutes] = useState<RouteRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoute, setNewRoute] = useState({ route_name: '', rate_per_trip: '' });

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      setIsLoading(true);
      const data = await getRoutes();
      setRoutes(data);
    } catch (err: any) {
      setError('Ошибка загрузки маршрутов');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (route: RouteRate) => {
    setEditingId(route.id);
    setEditValue(route.rate_per_trip.toString());
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const newRate = parseFloat(editValue);
      if (isNaN(newRate) || newRate < 0) {
        alert('Введите корректную сумму');
        return;
      }

      await updateRoute(id, { rate_per_trip: newRate });
      await loadRoutes();
      setEditingId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Ошибка обновления тарифа');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleToggleActive = async (route: RouteRate) => {
    try {
      await updateRoute(route.id, { is_active: !route.is_active });
      await loadRoutes();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Ошибка обновления статуса');
    }
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rate = parseFloat(newRoute.rate_per_trip);
      if (!newRoute.route_name.trim()) {
        alert('Введите название маршрута');
        return;
      }
      if (isNaN(rate) || rate < 0) {
        alert('Введите корректную сумму');
        return;
      }

      await createRoute({
        route_name: newRoute.route_name.trim(),
        rate_per_trip: rate,
      });
      await loadRoutes();
      setNewRoute({ route_name: '', rate_per_trip: '' });
      setShowAddForm(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Ошибка создания маршрута');
    }
  };

  const handleDelete = async (id: number, routeName: string) => {
    if (!window.confirm(`Удалить маршрут "${routeName}"?`)) {
      return;
    }

    try {
      await deleteRoute(id);
      await loadRoutes();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Ошибка удаления маршрута');
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
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Тарифы по маршрутам</h1>
          <p className="text-gray-600 mt-2">Установите стоимость рейсов для расчета зарплат водителей</p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          Добавить маршрут
        </button>
      </div>

      {/* Форма добавления */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Новый маршрут</h3>
          <form onSubmit={handleAddRoute} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название маршрута
              </label>
              <input
                type="text"
                value={newRoute.route_name}
                onChange={(e) => setNewRoute({ ...newRoute, route_name: e.target.value })}
                placeholder="Например: 38010 - Тендер Трак (Рязань Тюшевское)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тариф за рейс (₽)
              </label>
              <input
                type="number"
                step="0.01"
                value={newRoute.rate_per_trip}
                onChange={(e) => setNewRoute({ ...newRoute, rate_per_trip: e.target.value })}
                placeholder="5000.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewRoute({ route_name: '', rate_per_trip: '' });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Таблица маршрутов */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Маршрут
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тариф за рейс
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Рейсов
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Водителей
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {routes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Нет маршрутов. Добавьте первый маршрут.
                  </td>
                </tr>
              ) : (
                routes.map((route) => (
                  <tr key={route.id} className={`hover:bg-gray-50 ${!route.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <MapPin size={16} className="text-gray-400 mr-2" />
                        {route.route_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingId === route.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(route.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Save size={18} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <DollarSign size={16} className="text-green-600 mr-1" />
                          <span className="font-semibold text-gray-900">
                            {route.rate_per_trip.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {route.trips_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {route.drivers_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleToggleActive(route)}
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          route.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {route.is_active ? 'Активен' : 'Неактивен'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        {editingId !== route.id && (
                          <>
                            <button
                              onClick={() => handleStartEdit(route)}
                              className="text-indigo-600 hover:text-indigo-700"
                              title="Изменить тариф"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(route.id, route.route_name)}
                              className="text-red-600 hover:text-red-700"
                              title="Удалить"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Подсказка */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-3">💡 Как это работает</h3>
        <ul className="list-disc list-inside text-blue-800 space-y-1">
          <li>
            <strong>Тариф за рейс</strong> - сумма, которую получает водитель за один рейс по этому маршруту
          </li>
          <li>
            <strong>Зарплата</strong> = (Количество рейсов × Тариф) - Штрафы
          </li>
          <li>
            Неактивные маршруты не учитываются при расчете зарплат
          </li>
          <li>
            После загрузки Excel новые маршруты автоматически добавляются с тарифом 5000₽
          </li>
        </ul>
      </div>
    </div>
  );
};

export default RoutesPage;
