// Типы для системы управления логистикой

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  role_display: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
}

export interface Stats {
  totalTrips: number;
  totalRevenue: number;
  totalDrivers: number;
  totalVehicles: number;
  totalPenalties: number;
  tripsThisMonth: number;
}

export interface Trip {
  id: number;
  wb_trip_number: string;
  loading_date: string;
  unloading_date: string;
  vehicle_number: string;
  driver_name: string;
  route_name: string;
  trip_amount: number;
  distance_km: number;
  has_penalty: boolean;
  penalty_amount: number;
  containers_count?: number;
  distribution_center?: string;
  created_at?: string;
}

export interface SalaryData {
  driver_name: string;
  trips_count: number;
  total_distance: number;
  total_revenue: number;
  total_penalties: number;
  gross_salary: number;
  net_salary: number;
}

export interface RouteRate {
  id: number;
  route_name: string;
  rate_per_trip: number;
  is_active: boolean;
  trips_count: number;
  drivers_count: number;
}

export interface ImportLog {
  id: number;
  filename: string;
  imported_at: string;
  rows_imported: number;
  rows_skipped: number;
  status: string;
  error_message?: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  rowsImported: number;
  rowsSkipped: number;
  skipReasons?: string[];
  totalRows?: number;
  availableColumns?: string[];
}

// Роли пользователей
export type UserRole =
  | 'director'
  | 'manager'
  | 'economist'
  | 'accountant'
  | 'mechanic'
  | 'dispatcher';

// Права доступа по ролям
export const RolePermissions: Record<UserRole, string[]> = {
  director: ['dashboard', 'trips', 'salary', 'vehicles', 'upload', 'drivers', 'analytics'],
  manager: ['dashboard', 'trips', 'salary', 'vehicles', 'upload'],
  economist: ['dashboard', 'trips', 'salary'],
  accountant: ['dashboard', 'trips', 'salary'],
  mechanic: ['dashboard', 'vehicles'],
  dispatcher: ['dashboard', 'trips', 'upload', 'vehicles'],
};
