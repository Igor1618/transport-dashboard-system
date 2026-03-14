// types/report.ts — Типы для страницы отчёта
// Extracted from page.tsx during refactor (14 Mar 2026)

export interface Driver {
  name: string;
}

export interface Vehicle {
  number: string;
  trips?: number;
  vehicle_type?: string;
}

export interface WbTrip {
  loading_date: string;
  loading_time?: string;
  unloading_date?: string;
  unloading_time?: string;
  route_name: string;
  driver_rate: number;
  tender_id?: number;
  rate_source?: string;
  wb_id?: number;
  log_route?: string;
}

export interface RfContract {
  number: string;
  date: string;
  route: string;
  loading_date?: string;
  unloading_date?: string;
  amount?: string;
}

export interface FuelBySource {
  source: string;
  liters: number;
  amount: number;
  count: number;
}

export interface Expense {
  name: string;
  amount: number;
}

export interface Payment {
  date: string;
  amount: number;
  type: string;
  description: string;
}

export interface ExtraWork {
  name: string;
  count: number;
  rate: number;
}

export interface WorkType {
  id: number;
  name: string;
  category: string;
  default_rate: number;
}

// --- Inline types extracted from useState ---

export interface ValidationCheck {
  param: string;
  value: number;
  status: string;
  message: string;
  details?: string;
}

export interface ValidationResult {
  status: string;
  checks: ValidationCheck[];
}

export interface DriverSuggestion {
  driver_name: string;
  trips: number;
  source?: string;
}

export interface VehicleSuggestion {
  vehicle_number: string;
  trips: number;
}

export interface RfPeriod {
  from: string;
  to: string;
  mileage: number;
}

export interface Relocation {
  from: string;
  to: string;
  mileage: number;
  date: string;
}

export interface WbPenalty {
  wb_trip_number: string;
  loading_date: string;
  route_name: string;
  has_penalty: boolean;
  penalty_pending: boolean;
  penalty_amount: number;
}

export interface SalaryPayment {
  full_name: string;
  amount: number;
  register_number: string;
  register_date: string;
  tl_number: number;
  payment_purpose: string;
}

export interface SalaryData {
  payments: SalaryPayment[];
  total: number;
}

export interface GpsDayInfo {
  date: string;
  points: number;
  km: number;
  status: string;
}

export interface GpsCoverage {
  total_days: number;
  covered_days: number;
  coverage_pct: number;
  days: GpsDayInfo[];
}

export interface FuelTransaction {
  date: string;
  time?: string;
  source: string;
  liters: number;
  amount: number;
  card_number?: string;
}

export interface VehicleData {
  id?: number;
  vehicle_type?: string;
  fuel_cards?: Record<string, string>;
  fuel_norm_winter?: number;
  fuel_norm_summer?: number;
  fuel_norm_autumn?: number;
}

export interface GpsDayMileage {
  date: string;
  km: number;
}

export interface Deduction {
  name: string;
  amount: number;
}

export interface Fine {
  name: string;
  amount: number;
}

export interface TariffRate {
  fuel_consumption: number;
  rate: number;
}

export interface FuelTotals {
  liters: number;
  amount: number;
  count: number;
}

export interface FuelPeriod {
  liters: number;
  amount: number;
}

export interface WbTotals {
  count: number;
  driver_rate: number;
}

export interface IdleData {
  hours: number;
  paidHours: number;
  amount: number;
}
