import axios from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  Stats,
  MonthlyStats,
  Trip,
  SalaryData,
  ImportLog,
  UploadResponse,
  RouteRate,
  DriverTripDetail,
  VehicleStats,
  VehicleTripDetail,
  User,
  Role,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем интерцептор для передачи роли пользователя
api.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user && user.role) {
        config.headers['x-user-role'] = user.role;
      }
    } catch (e) {
      console.error('Error parsing user from localStorage', e);
    }
  }
  return config;
});

// Авторизация
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', credentials);
  return response.data;
};

// Получение статистики
export const getStats = async (month?: string): Promise<Stats> => {
  const params = month ? { month } : {};
  const response = await api.get<Stats>('/stats', { params });
  return response.data;
};

// Получение помесячной статистики для графиков
export const getMonthlyStats = async (months: number = 6): Promise<MonthlyStats[]> => {
  const response = await api.get<MonthlyStats[]>('/stats/monthly', { params: { months } });
  return response.data;
};

// Получение списка рейсов
export const getTrips = async (): Promise<Trip[]> => {
  const response = await api.get<Trip[]>('/trips');
  return response.data;
};

// Загрузка Excel файла
export const uploadExcel = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Получение данных по зарплатам
export const getSalary = async (month?: string): Promise<SalaryData[]> => {
  const params = month ? { month } : {};
  const response = await api.get<SalaryData[]>('/salary', { params });
  return response.data;
};

// Получение детализации рейсов водителя
export const getDriverTrips = async (driverName: string, month?: string): Promise<DriverTripDetail[]> => {
  const params = month ? { month } : {};
  const response = await api.get<DriverTripDetail[]>(`/salary/driver/${encodeURIComponent(driverName)}/trips`, { params });
  return response.data;
};

// Получение истории импорта
export const getImportHistory = async (): Promise<ImportLog[]> => {
  const response = await api.get<ImportLog[]>('/import-history');
  return response.data;
};

// Получение списка маршрутов с тарифами
export const getRoutes = async (): Promise<RouteRate[]> => {
  const response = await api.get<RouteRate[]>('/routes');
  return response.data;
};

// Обновление тарифа маршрута
export const updateRoute = async (
  id: number,
  data: { rate_per_trip?: number; is_active?: boolean }
): Promise<RouteRate> => {
  const response = await api.put<RouteRate>(`/routes/${id}`, data);
  return response.data;
};

// Создание нового маршрута с тарифом
export const createRoute = async (data: {
  route_name: string;
  rate_per_trip: number;
}): Promise<RouteRate> => {
  const response = await api.post<RouteRate>('/routes', data);
  return response.data;
};

// Удаление маршрута
export const deleteRoute = async (id: number): Promise<void> => {
  await api.delete(`/routes/${id}`);
};

// Получение статистики по автомобилям
export const getVehicleStats = async (month?: string): Promise<VehicleStats[]> => {
  const params = month ? { month } : {};
  const response = await api.get<VehicleStats[]>('/vehicles/stats', { params });
  return response.data;
};

// Получение детализации рейсов автомобиля
export const getVehicleTrips = async (vehicleNumber: string, month?: string): Promise<VehicleTripDetail[]> => {
  const params = month ? { month } : {};
  const response = await api.get<VehicleTripDetail[]>(`/vehicles/${encodeURIComponent(vehicleNumber)}/trips`, { params });
  return response.data;
};

// ========================================
// Управление пользователями
// ========================================

// Получение списка всех пользователей
export const getUsers = async (): Promise<User[]> => {
  const response = await api.get<User[]>('/users');
  return response.data;
};

// Получение списка ролей
export const getRoles = async (): Promise<Role[]> => {
  const response = await api.get<Role[]>('/users/roles');
  return response.data;
};

// Создание нового пользователя
export const createUser = async (data: {
  email: string;
  password: string;
  full_name: string;
  role_id: number;
}): Promise<{ message: string; user: User }> => {
  const response = await api.post('/users', data);
  return response.data;
};

// Обновление пользователя
export const updateUser = async (
  id: number,
  data: {
    email?: string;
    password?: string;
    full_name?: string;
    role_id?: number;
    is_active?: boolean;
  }
): Promise<{ message: string; user: User }> => {
  const response = await api.put(`/users/${id}`, data);
  return response.data;
};

// Деактивация пользователя
export const deleteUser = async (id: number): Promise<{ message: string }> => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};

export default api;
