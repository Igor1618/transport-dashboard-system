import axios from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  Stats,
  Trip,
  SalaryData,
  ImportLog,
  UploadResponse,
  RouteRate,
  DriverTripDetail,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Авторизация
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', credentials);
  return response.data;
};

// Получение статистики
export const getStats = async (): Promise<Stats> => {
  const response = await api.get<Stats>('/stats');
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

export default api;
