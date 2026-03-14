"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Truck, User, Save, Loader2, Zap, Plus, Trash2, RefreshCw, Fuel, X as XIcon } from "lucide-react";

import type { Driver, Vehicle, WbTrip, RfContract, FuelBySource, Expense, Payment, ExtraWork, WorkType, ValidationResult, DriverSuggestion, VehicleSuggestion, RfPeriod, Relocation, WbPenalty, SalaryData, GpsCoverage, FuelTransaction, VehicleData, GpsDayMileage, Deduction, Fine, TariffRate, FuelTotals, FuelPeriod, WbTotals } from './types/report';
import { normPlate } from './utils/report-helpers';
import { useFuelCards } from './hooks/useFuelCards';
import { FuelCardModals } from './components/FuelCardModals';
import { DriverReportSection } from './components/DriverReportSection';
import { TotalsSummary } from './components/TotalsSummary';
import { SimpleListBlock } from './components/SimpleListBlock';
import { RelocationsBlock } from './components/RelocationsBlock';
import { PaymentsBlock } from './components/PaymentsBlock';
import { WbTripsSection } from './components/WbTripsSection';
import { RfContractsSection } from './components/RfContractsSection';
import { FuelSection } from './components/FuelSection';

export default function NewReportPage() {
  const params = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const reportId = params?.id ? decodeURIComponent(params.id as string) : undefined;
  const isEditMode = reportId && reportId !== 'new';
  const [fullReportId, setFullReportId] = useState<string | undefined>(reportId);
  const [reportLoaded, setReportLoaded] = useState(false); // Флаг: отчёт загружен из БД, блокируем авто-расчёты
  const reportLoadedRef = useRef(false);
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<{status: string, checks: Array<{param: string, value: number, status: string, message: string, details?: string}>} | null>(null);
  const [reportStatus, setReportStatus] = useState<string>('draft');
  const [validating, setValidating] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [crossWarnings, setCrossWarnings] = useState<any[]>([]);
  const [crossDismissed, setCrossDismissed] = useState(false);
  const [pageLoading, setPageLoading] = useState(!!isEditMode);
  const [notFound, setNotFound] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  // Block all mutations for deleted reports
  const guardDeleted = (fn: Function) => (...args: any[]) => { if (isDeleted) return; return fn(...args); };
  
  const [driverSearch, setDriverSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  // normPlate moved to ./utils/report-helpers.ts
  const [showDriverList, setShowDriverList] = useState(false);
  const [showVehicleList, setShowVehicleList] = useState(false);
  const [driverVehicles, setDriverVehicles] = useState<Vehicle[]>([]);
  
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("00:00");
  const [timeTo, setTimeTo] = useState("23:59");

  // Fuel cards — isolated hook (prevents dark screen if cards API fails)
  const fuelCards = useFuelCards(vehicleNumber);
  const { vehicleCards, showCardModal, cardSearchQ, cardSearchResults, cardSearching, cardTxModal, cardTransactions } = fuelCards;
  const { setShowCardModal, setCardSearchQ, setCardTxModal } = fuelCards;
  
  // Подсказки водителей/машин
  const [driverSuggestions, setDriverSuggestions] = useState<{driver_name: string; trips: number; source?: string}[]>([]);
  const [vehicleSuggestions, setVehicleSuggestions] = useState<{vehicle_number: string; trips: number}[]>([]);
  
  const [wbTrips, setWbTrips] = useState<WbTrip[]>([]);
  const [wbTotals, setWbTotals] = useState({count: 0, driver_rate: 0});
  const [wbGpsMileage, setWbGpsMileage] = useState(0);
  const [wbDays, setWbDays] = useState(0);
  
  const [rfContracts, setRfContracts] = useState<RfContract[]>([]);
  const [rfPeriods, setRfPeriods] = useState<{from: string; to: string; mileage: number}[]>([{from: "", to: "", mileage: 0}]);
  const [rfDateFrom, setRfDateFrom] = useState("");
  const [rfDateTo, setRfDateTo] = useState("");
  
  // Порожний перегон
  const [relocations, setRelocations] = useState<{from: string; to: string; mileage: number; date: string}[]>([]);
  
  // Штрафы WB
  const [wbPenalties, setWbPenalties] = useState<{wb_trip_number: string; loading_date: string; route_name: string; has_penalty: boolean; penalty_pending: boolean; penalty_amount: number}[]>([]);
  
  // Popup прочий пробег
  const [showOtherMileage, setShowOtherMileage] = useState(false);
  
  // Выплаты из ведомостей
  const [salaryData, setSalaryData] = useState<{payments: {full_name: string; amount: number; register_number: string; register_date: string; tl_number: number; payment_purpose: string}[]; total: number}>({ payments: [], total: 0 });
  const [rfGpsMileage, setRfGpsMileage] = useState(0);
  const [rfGpsLoading, setRfGpsLoading] = useState(false);
  const [rfRatePerKm, setRfRatePerKm] = useState(7.0);
  
  const [gpsMileage, setGpsMileage] = useState(0);
  // GPS coverage
  const [gpsRecovery, setGpsRecovery] = useState<any>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [gpsCoverage, setGpsCoverage] = useState<{total_days:number;covered_days:number;coverage_pct:number;days:{date:string;points:number;km:number;status:string}[]}|null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [gpsByDay, setGpsByDay] = useState<{date: string; km: number}[]>([]);
  
  // Топливо
  const [fuelBySource, setFuelBySource] = useState<FuelBySource[]>([]);
  const [fuelTotal, setFuelTotal] = useState({ liters: 0, amount: 0, count: 0 });
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelTransactions, setFuelTransactions] = useState<{date: string; time?: string; source: string; liters: number; amount: number; card_number?: string}[]>([]);
  const [showFuelDetails, setShowFuelDetails] = useState(false);
  // Топливо по периодам
  const [fuelWb, setFuelWb] = useState({ liters: 0, amount: 0 });
  const [fuelRf, setFuelRf] = useState({ liters: 0, amount: 0 });
  // Исключённые простои (индексы рейсов после которых простой)
  const [excludedIdles, setExcludedIdles] = useState<Set<number>>(new Set());
  // Данные машины (тип, карты, нормы)
  const [vehicleData, setVehicleData] = useState<{id?: number; vehicle_type?: string; fuel_cards?: Record<string, string>; fuel_norm_winter?: number; fuel_norm_summer?: number; fuel_norm_autumn?: number}>({});
  const [editingCards, setEditingCards] = useState(false);
  
  // Остатки топлива в баке (общие)
  const [fuelStartTank, setFuelStartTank] = useState<number | "">(""); // Остаток на начало
  const [fuelEndTank, setFuelEndTank] = useState<number | "">(""); // Остаток на конец
  // Остатки топлива для периода РФ
  const [rfFuelStartTank, setRfFuelStartTank] = useState<number | "">(""); // Остаток на начало РФ
  const [rfFuelEndTank, setRfFuelEndTank] = useState<number | "">(""); // Остаток на конец РФ
  const [hasFuelSensor, setHasFuelSensor] = useState(false); // Есть датчик топлива
  const [sensorLoading, setSensorLoading] = useState(false);
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | "">("");
  
  // Выдано (вычитается)
  const [payments, setPayments] = useState<Payment[]>([]);
  
  // Доп. работы
  const [extraWorks, setExtraWorks] = useState<ExtraWork[]>([]);
  const [newWorkName, setNewWorkName] = useState("");
  const [newWorkCount, setNewWorkCount] = useState<number | "">(1);
  const [newWorkRate, setNewWorkRate] = useState<number | "">(0);
  
  // Удержания
  const [deductions, setDeductions] = useState<{name: string, amount: number}[]>([]);
  
  // Штрафы
  const [fines, setFines] = useState<{name: string, amount: number}[]>([]);
  
  // Справочники
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [compTypes, setCompTypes] = useState<WorkType[]>([]);
  const [workSearch, setWorkSearch] = useState("");
  const [compSearch, setCompSearch] = useState("");
  
  // Добавление нового типа в справочник
  const addNewWorkType = async (name: string, category: string, rate: number) => {
    const res = await fetch("/api/reports/work-types", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, default_rate: rate })
    });
    const data = await res.json();
    if (data.type) {
      if (category === "extra_work") {
        setWorkTypes([...workTypes, data.type]);
      } else {
        setCompTypes([...compTypes, data.type]);
      }
    }
    return data.type;
  };
  
  // Суточные РФ
  const [rfDailyRate, setRfDailyRate] = useState(1000);
  const [rfDays, setRfDays] = useState(0);
  
  // Премия за выполнение требований ТК
  const [bonusEnabled, setBonusEnabled] = useState(true);
  const [bonusRate, setBonusRate] = useState(1); // ₽/км
  
  // Комментарий
  const [comment, setComment] = useState("");
  
  // Тип машины и авто-расчёт ставки
  const [vehicleModel, setVehicleModel] = useState("");
  const [autoRate, setAutoRate] = useState<number | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("");
  const [tariffRates, setTariffRates] = useState<{fuel_consumption: number; rate: number}[]>([]);

  const [ownVehicleNums, setOwnVehicleNums] = useState<Set<string>>(new Set());
  const isHiredVehicle = vehicleNumber && ownVehicleNums.size > 0 && !ownVehicleNums.has(vehicleNumber.replace(/\s/g, '').replace(/0(\d{2})$/, '$1').toUpperCase());

  useEffect(() => {
    fetch("/api/reports/drivers").then(r => r.json()).then(setDrivers).catch(() => {});
    fetch("/api/reports/vehicles").then(r => r.json()).then(setAllVehicles).catch(() => {});
    fetch("/rest/v1/vehicles?select=normalized_number&status=neq.archived").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setOwnVehicleNums(new Set(data.map((v: any) => (v.normalized_number || '').toUpperCase())));
    }).catch(() => {});
    fetch("/api/reports/work-types?category=extra_work").then(r => r.json()).then(d => setWorkTypes(d.types || [])).catch(() => {});
    fetch("/api/reports/work-types?category=compensation").then(r => r.json()).then(d => setCompTypes(d.types || [])).catch(() => {});
    fetch("/api/reports/tariffs/vehicle-types").then(r => r.json()).then(d => setVehicleTypes(d.types || [])).catch(() => {});
    // Определяем сезон автоматически
    const month = new Date().getMonth() + 1;
    if (month >= 11 || month <= 2) setSelectedSeason("Зима");
    else if (month >= 6 && month <= 8) setSelectedSeason("Лето");
    else setSelectedSeason("Межсезон");
    
    // Загрузка существующего отчёта в режиме редактирования
    if (isEditMode && reportId) {
      console.log('[LOAD] START - reportId:', reportId);
      // Try by UUID prefix first, then by number
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(reportId || '');
      const url = isUUID
        ? `/rest/v1/driver_reports?or=(id.eq.${reportId},id.like.${reportId}*)`
        : `/rest/v1/driver_reports?or=(number.eq.${reportId},number.eq.${String(reportId).padStart(9,'0')},id.like.*${String(reportId).padStart(9,'0')}*)`;
      fetch(url)
        .then(r => r.json())
        .then(async (data) => {
          if (!data?.[0]) {
            setNotFound(true);
            setPageLoading(false);
            return;
          }
          {
            const r = data[0];
            if (r.status === 'deleted') {
              setIsDeleted(true);
            }
            setFullReportId(r.id); // Сохраняем полный UUID
            setDriverName(r.driver_name || ""); setDriverSearch(r.driver_name || "");
            setVehicleNumber(r.vehicle_number || ""); setVehicleSearch(r.vehicle_number || "");
            if (r.status) setReportStatus(r.status);
            // Конвертируем даты в формат datetime-local (добавляем время)
            // Preserve time from expense_categories if available, else use defaults
            // Use time_from/time_to from DB, fallback to expense_categories, then defaults
            const tf = r.time_from ? r.time_from.slice(0, 5) : '00:00';
            const tt = r.time_to ? r.time_to.slice(0, 5) : '23:59';
            setTimeFrom(tf); setTimeTo(tt);
            const dfrom = r.date_from ? `${r.date_from}T${tf}` : "";
            const dto = r.date_to ? `${r.date_to}T${tt}` : "";
            setDateFrom(dfrom); setDateTo(dto);
            setRfDateFrom(dfrom); setRfDateTo(dto);
            setRfGpsMileage(r.mileage || 0);
            // For approved reports: use total_mileage and wb_mileage as fallbacks
            if (r.status === 'approved') {
              if (r.total_mileage && !r.mileage) setGpsMileage(Number(r.total_mileage) || 0);
              if (r.wb_mileage) setWbGpsMileage(Number(r.wb_mileage) || 0);
              if (r.total_mileage) setRfGpsMileage(Number(r.total_mileage) || 0);
            }
            setFuelTotal({ liters: r.fuel_quantity || 0, amount: r.fuel_amount || 0, count: 0 });
            setFuelStartTank(r.fuel_start || ""); setFuelEndTank(r.fuel_end || "");
            // Загрузка сохранённых периодов РФ и типа машины
            reportLoadedRef.current = true; // Mark loaded before setting state to prevent useEffect race
            if (r.rf_periods && Array.isArray(r.rf_periods) && r.rf_periods.length > 0) {
              setRfPeriods(r.rf_periods);
              // Пересчитываем общий пробег из периодов (если rf_mileage не сохранён)
              const totalFromPeriods = r.rf_periods.reduce((sum: number, p: any) => sum + (Number(p.mileage) || 0), 0);
              console.log('[LOAD] rf_periods total mileage:', totalFromPeriods);
              if (totalFromPeriods > 0) setRfGpsMileage(totalFromPeriods);
            }
            if (r.vehicle_type) setSelectedVehicleType(r.vehicle_type);
            if (r.season) setSelectedSeason(r.season);
            if (r.rate_per_km) setRfRatePerKm(Number(r.rate_per_km));
            // Детали из expense_categories
            const details = r.expense_categories;
            console.log('[LOAD] r.mileage:', r.mileage, 'r.rate_per_km:', r.rate_per_km);
            console.log('[LOAD] details:', details);
            if (details && typeof details === 'object' && !Array.isArray(details)) {
              console.log('[LOAD] rf_mileage:', details.rf_mileage, 'rf_rate:', details.rf_rate);
              if (details.rf_rate) setRfRatePerKm(details.rf_rate);
              if (details.rf_mileage) setRfGpsMileage(details.rf_mileage);
              if (details.rf_days != null) { setRfDays(Number(details.rf_days)); setRfDaysManual(true); }
              if (details.rf_daily_rate != null) setRfDailyRate(Number(details.rf_daily_rate));
              // Fallback: if rf_days not saved but rf_periods exist, calculate
              if (details.rf_days == null && r.rf_periods && Array.isArray(r.rf_periods) && r.rf_periods.length > 0) {
                const validPeriods = r.rf_periods.filter((p: any) => p.from && p.to);
                if (validPeriods.length > 0) {
                  const firstFrom = new Date(validPeriods[0].from.slice(0, 10) + 'T00:00:00');
                  const lastTo = new Date(validPeriods[validPeriods.length - 1].to.slice(0, 10) + 'T00:00:00');
                  const calcDays = Math.round((lastTo.getTime() - firstFrom.getTime()) / 86400000) + 1;
                  if (calcDays > 0) { setRfDays(calcDays); setRfDaysManual(true); }
                }
              }
              if (details.gps_coverage_snapshot) setGpsCoverage(details.gps_coverage_snapshot);
              if (details.rf_fuel_start) setRfFuelStartTank(details.rf_fuel_start);
              if (details.rf_fuel_end) setRfFuelEndTank(details.rf_fuel_end);
              if (details.fuel_rf) setFuelRf(details.fuel_rf);
              if (details.wb_totals) setWbTotals(details.wb_totals);
              if (details.bonus_enabled !== undefined) setBonusEnabled(details.bonus_enabled);
              if (details.bonus_rate) setBonusRate(details.bonus_rate);
              if (details.extra_works) setExtraWorks(details.extra_works);
              if (details.expenses) setExpenses(details.expenses);
              if (details.deductions) setDeductions(details.deductions);
              if (details.fines) setFines(details.fines);
              if (details.relocations) setRelocations(details.relocations);
              if (details.wb_penalties) setWbPenalties(details.wb_penalties);
              if (details.excluded_idle_trips) setExcludedIdles(new Set(details.excluded_idle_trips));
              if (details.payments) setPayments(details.payments);
              if (details.comment) setComment(details.comment);
              // Восстановление WB рейсов
              if (details.wb_trips_data && Array.isArray(details.wb_trips_data) && details.wb_trips_data.length > 0) {
                setWbTrips(details.wb_trips_data);
                console.log('[LOAD] wb_trips_data:', details.wb_trips_data.length, 'trips');
              } else if (r.driver_name && r.date_from && r.date_to) {
                // No saved WB data — auto-fetch from API
                console.log('[LOAD] No wb_trips_data, fetching from API...');
                try {
                  const bp = new URLSearchParams({ driver: r.driver_name, from: r.date_from, to: r.date_to });
                  if (r.vehicle_number) bp.append("vehicle", r.vehicle_number);
                  const wbR = await fetch(`/api/reports/trips-detail-v2?${bp}`);
                  const wbD = await wbR.json();
                  if (wbD.trips && wbD.trips.length > 0) {
                    const sorted = [...wbD.trips].sort((a: any, b: any) => new Date(`${a.loading_date}T${a.loading_time || '00:00'}`).getTime() - new Date(`${b.loading_date}T${b.loading_time || '00:00'}`).getTime());
                    setWbTrips(sorted);
                    setWbTotals({ count: sorted.length, driver_rate: sorted.reduce((s: number, t: any) => s + parseFloat(t.driver_rate || 0), 0) });
                    console.log('[LOAD] Fetched', sorted.length, 'WB trips from API');
                  }
                } catch (e) { console.warn('[LOAD] WB fetch error:', e); }
              } else if (r.status === 'approved' && r.wb_mileage) {
                // Approved report with no WB data saved and no live data - show stored totals
                const wbRate = Number(details.wb_totals?.driver_rate) || Number(r.driver_accruals) || 0;
                if (wbRate > 0) setWbTotals({ count: details.wb_totals?.count || 0, driver_rate: wbRate });
              }
              // Восстановление заявок РФ
              if (details.rf_contracts_data && Array.isArray(details.rf_contracts_data) && details.rf_contracts_data.length > 0) {
                setRfContracts(details.rf_contracts_data);
                console.log('[LOAD] rf_contracts_data:', details.rf_contracts_data.length, 'contracts');
              } else if (r.vehicle_number && r.date_from && r.date_to) {
                // No saved RF data — auto-fetch from API using loading_date filter
                console.log('[LOAD] No rf_contracts_data, fetching from API...');
                try {
                  const tf2 = r.time_from ? r.time_from.slice(0,5) : '00:00';
                  const tt2 = r.time_to ? r.time_to.slice(0,5) : '23:59';
                  const rfFrom = r.date_from + 'T' + tf2;
                  const rfTo = r.date_to + 'T' + tt2;
                  const rfBp = new URLSearchParams({ vehicle: r.vehicle_number, from: rfFrom, to: rfTo });
                  if (r.driver_name) rfBp.append('driver', r.driver_name);
                  const rfR = await fetch(`/api/reports/contracts-rf-v2?${rfBp}`);
                  const rfD = await rfR.json();
                  if (rfD.contracts && rfD.contracts.length > 0) {
                    setRfContracts(rfD.contracts);
                    console.log('[LOAD] Fetched', rfD.contracts.length, 'RF contracts from API');
                  }
                } catch (e) { console.warn('[LOAD] RF fetch error:', e); }
              }
              // Восстановление топлива по источникам
              if (details.fuel_by_source && Array.isArray(details.fuel_by_source)) {
                setFuelBySource(details.fuel_by_source);
                console.log('[LOAD] fuel_by_source:', details.fuel_by_source.length, 'sources');
              }
              // Восстановление GPS/WB данных
              if (details.wb_gps_mileage) setWbGpsMileage(details.wb_gps_mileage);
              if (details.wb_days) setWbDays(details.wb_days);
              if (details.gps_mileage) setGpsMileage(details.gps_mileage);
            }
            // Загружаем данные машины для норм и типа
            if (r.vehicle_number) {
              try {
                const vRes = await fetch(`/api/vehicles/by-number?number=${encodeURIComponent(r.vehicle_number)}`);
                const vData = await vRes.json();
                if (vData) {
                  setVehicleData(vData);
                  // vehicle_type из vehicles (если не сохранён в отчёте)
                  if (!r.vehicle_type && vData.vehicle_type) setSelectedVehicleType(vData.vehicle_type);
                }
              } catch (e) { console.error("VehicleData load error:", e); }
            }
          }
        })
        .catch(console.error)
        .finally(() => { setPageLoading(false); setReportLoaded(true); });
    }
  }, [isEditMode, reportId]);

  // Cross-check warnings
  useEffect(() => {
    if (!vehicleNumber || !driverName || !dateFrom || !dateTo) return;
    const from = dateFrom.split('T')[0];
    const to = dateTo.split('T')[0];
    const params = new URLSearchParams({ vehicle: vehicleNumber, driver: driverName, from, to });
    if (fullReportId && fullReportId !== 'new') params.set('report_id', fullReportId);
    fetch(`/api/reports/cross-check?${params}`, {
      headers: { 'x-user-role': (typeof window !== 'undefined' && localStorage.getItem('userRole')) || 'director' }
    })
      .then(r => r.json())
      .then(d => { if (d.warnings?.length > 0) { setCrossWarnings(d.warnings); setCrossDismissed(false); } else setCrossWarnings([]); })
      .catch(() => {});
  }, [vehicleNumber, driverName, fullReportId, dateFrom, dateTo]);
  
  // Расчёт дней командировки РФ (все дни в периоде)
  // Автоподсчёт дней НЕ перезаписывает если уже загружено из отчёта
  const [rfDaysManual, setRfDaysManual] = useState(false); // Флаг: дни заданы вручную/из БД
  useEffect(() => {
    if (rfDaysManual || reportLoaded || reportLoadedRef.current) return; // Не перезаписываем если уже установлено или отчёт загружен
    if (rfDateFrom && rfDateTo) {
      // Считаем по датам без времени: 16.01—31.01 = 16 дней
      const from = new Date(rfDateFrom.slice(0, 10) + 'T00:00:00');
      const to = new Date(rfDateTo.slice(0, 10) + 'T00:00:00');
      const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      setRfDays(diffDays > 0 ? diffDays : 0);
    } else if (rfContracts.length > 0) {
      // Fallback: по датам погрузки/выгрузки если период не задан
      const allDates = rfContracts.flatMap(c => [c.loading_date, c.unloading_date, c.date].filter(Boolean)).map(d => d!.slice(0,10)).sort();
      const from = new Date(allDates[0] + 'T00:00:00');
      const to = new Date(allDates[allDates.length - 1] + 'T00:00:00');
      const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      setRfDays(diffDays > 0 ? diffDays : 0);
    }
    // NOTE: no else{setRfDays(0)} — не обнуляем если уже загружено из отчёта
  }, [rfDateFrom, rfDateTo, rfContracts, rfDaysManual]);
  
  // Загрузка тарифов при выборе типа машины и сезона
  useEffect(() => {
    if (selectedVehicleType && selectedSeason) {
      fetch(`/api/reports/tariffs/rates?vehicle_type=${encodeURIComponent(selectedVehicleType)}&season=${encodeURIComponent(selectedSeason)}`)
        .then(r => r.json())
        .then(d => setTariffRates(d.rates || []))
        .catch(() => setTariffRates([]));
    }
  }, [selectedVehicleType, selectedSeason]);
  
  // Авто-расчёт ставки по расходу топлива (перемещено после объявления fuelUsed)
  
  // Загрузка модели машины
  useEffect(() => {
    if (vehicleNumber) {
      const digits = vehicleNumber.match(/\d{3}/);
      if (digits) {
        fetch(`/api/vehicles/list?search=${digits[0]}`)
          .then(r => r.json())
          .then(data => {
            if (data.vehicles?.[0]?.model) {
              setVehicleModel(data.vehicles[0].model);
            }
          })
          .catch(() => {});
      }
    }
  }, [vehicleNumber]);

  const filteredDrivers = drivers.filter(d => d.name.toLowerCase().includes(driverSearch.toLowerCase())).slice(0, 15);
  const filteredVehicles = allVehicles.filter(v => v.number.toLowerCase().replace(/\s/g,'').includes(vehicleSearch.toLowerCase().replace(/\s/g,''))).slice(0, 15);

  const selectDriver = (name: string) => { setDriverName(name); setDriverSearch(name); setShowDriverList(false); };
  const selectVehicle = async (number: string) => {
    setVehicleNumber(number);
    setVehicleSearch(number);
    setShowVehicleList(false);
    // Загружаем данные машины (тип, карты)
    try {
      const res = await fetch(`/api/vehicles/by-number?number=${encodeURIComponent(number)}`);
      const data = await res.json();
      setVehicleData(data);
      if (data.vehicle_type) setSelectedVehicleType(data.vehicle_type);
    } catch (e) {
      // Fallback к allVehicles
      const vehicle = allVehicles.find(v => v.number === number);
      if (vehicle?.vehicle_type) setSelectedVehicleType(vehicle.vehicle_type);
    }
  };

  useEffect(() => {
    if (!driverName) { setDriverVehicles([]); return; }
    const fetchVehicles = async () => {
      try {
        const params = new URLSearchParams({ driver: driverName });
        if (dateFrom) params.append("from", dateFrom);
        if (dateTo) params.append("to", dateTo);
        const res = await fetch(`/api/reports/driver-vehicles?${params}`);
        const data = await res.json();
        // Дедупликация по номеру (нормализация кириллица/латиница)
        const unique = (Array.isArray(data) ? data : []).filter((v: Vehicle, i: number, arr: Vehicle[]) => 
          arr.findIndex((a: Vehicle) => a.number.replace(/\s/g,'').toUpperCase() === v.number.replace(/\s/g,'').toUpperCase()) === i);
        setDriverVehicles(unique);
        if (data.length === 1) {
          setVehicleNumber(data[0].number); setVehicleSearch(data[0].number);
          // Автоподстановка типа
          const v = allVehicles.find(av => av.number === data[0].number);
          if (v?.vehicle_type) setSelectedVehicleType(v.vehicle_type);
        }
        else if (data.length > 1 && !vehicleNumber) {
          const best = data.reduce((a: Vehicle, b: Vehicle) => (b.trips || 0) > (a.trips || 0) ? b : a);
          setVehicleNumber(best.number); setVehicleSearch(best.number);
          // Автоподстановка типа
          const v = allVehicles.find(av => av.number === best.number);
          if (v?.vehicle_type) setSelectedVehicleType(v.vehicle_type);
        }
      } catch (e) { setDriverVehicles([]); }
    };
    fetchVehicles();
  }, [driverName, dateFrom, dateTo]);

  // Загрузка подсказок водителей по машине
  useEffect(() => {
    if (vehicleNumber && dateFrom && dateTo && !driverName) {
      fetch(`/api/reports/driver-suggestions?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`)
        .then(r => r.json())
        .then(data => {
          const drivers = data.drivers || [];
          setDriverSuggestions(drivers);
          // Автоподстановка если один водитель
          if (drivers.length === 1 && !driverName) {
            setDriverName(drivers[0].driver_name);
          }
        })
        .catch(() => setDriverSuggestions([]));
    } else {
      setDriverSuggestions([]);
    }
  }, [vehicleNumber, dateFrom, dateTo, driverName]);
  
  // Загрузка подсказок машин по водителю
  useEffect(() => {
    if (driverName && !vehicleNumber) {
      const params = new URLSearchParams({ driver: driverName });
      if (dateFrom) params.append("from", dateFrom.split('T')[0]);
      if (dateTo) params.append("to", dateTo.split('T')[0]);
      fetch(`/api/reports/vehicle-suggestions?${params}`)
        .then(r => r.json())
        .then(data => setVehicleSuggestions(data.vehicles || []))
        .catch(() => setVehicleSuggestions([]));
    } else {
      setVehicleSuggestions([]);
    }
  }, [driverName, vehicleNumber, dateFrom, dateTo]);


  // Расчёт общего простоя WB (с учётом исключений)
  const totalIdleData = useMemo(() => {
    let totalIdleHours = 0;
    let paidHours = 0;
    let totalIdleAmount = 0;
    for (let i = 1; i < wbTrips.length; i++) {
      if (excludedIdles.has(i)) continue; // Пропускаем исключённые
      const prev = wbTrips[i-1];
      const curr = wbTrips[i];
      if (prev.unloading_date && prev.unloading_time && curr.loading_date && curr.loading_time) {
        const prevEnd = new Date(`${prev.unloading_date}T${prev.unloading_time}`);
        const currStart = new Date(`${curr.loading_date}T${curr.loading_time}`);
        const idleHours = Math.round((currStart.getTime() - prevEnd.getTime()) / 3600000);
        if (idleHours > 8) {
          totalIdleHours += idleHours;
          const paid = idleHours - 8;
          paidHours += paid;
          totalIdleAmount += paid * 100;
        }
      }
    }
    return { hours: totalIdleHours, paidHours, amount: totalIdleAmount };
  }, [wbTrips, excludedIdles]);

  const getUniqueDays = (trips: WbTrip[]): string[] => {
    const days = new Set<string>();
    trips.forEach(t => {
      const start = new Date(t.loading_date);
      const end = new Date(t.unloading_date || t.loading_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.add(d.toISOString().slice(0, 10));
      }
    });
    return Array.from(days).sort();
  };

  const loadRfGps = async () => {
    if (!vehicleNumber) return;
    setRfGpsLoading(true);
    
    // Загружаем данные машины (для норм)
    try {
      const vRes = await fetch(`/api/vehicles/by-number?number=${encodeURIComponent(vehicleNumber)}`);
      const vData = await vRes.json();
      console.log('[loadRfGps] vehicleData:', vData);
      setVehicleData(vData);
      if (vData.vehicle_type) setSelectedVehicleType(vData.vehicle_type);
    } catch (e) { console.error('[loadRfGps] vehicleData error:', e); }
    
    let totalMileage = 0;
    let totalFuelLiters = 0;
    let totalFuelAmount = 0;
    const newPeriods = [...rfPeriods];
    
    for (let i = 0; i < rfPeriods.length; i++) {
      const p = rfPeriods[i];
      if (!p.from || !p.to) continue;
      // Передаём полное datetime (для пробега и топлива)
      const fromParam = p.from; // "2026-01-13T02:15" или "2026-01-13"
      const toParam = p.to;
      const fromDate = p.from; // Полный datetime для топлива тоже!
      const toDate = p.to;
      
      // Загружаем пробег (с временем!)
      try {
        const res = await fetch(`/api/reports/telematics/mileage?vehicle=${encodeURIComponent(vehicleNumber)}&from=${fromParam}&to=${toParam}`);
        const data = await res.json();
        const mileage = data.mileage || 0;
        newPeriods[i] = { ...p, mileage };
        totalMileage += mileage;
      } catch (e) {
        console.error('[loadRfGps] mileage error:', e);
        newPeriods[i] = { ...p, mileage: 0 };
      }
      
      // Загружаем топливо за этот период (отдельный try-catch)
      try {
        const fuelUrl = `/api/reports/fuel/detail?vehicle=${encodeURIComponent(vehicleNumber)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
        console.log('[loadRfGps] fuel URL:', fuelUrl);
        const fuelRes = await fetch(fuelUrl);
        const fuelData = await fuelRes.json();
        console.log('[loadRfGps] fuelData:', fuelData);
        if (!fuelData.error) {
          const periodLiters = Number(fuelData.total?.liters) || 0;
          const periodAmount = Number(fuelData.total?.amount) || 0;
          console.log('[loadRfGps] period fuel:', periodLiters, 'L', periodAmount, '₽');
          totalFuelLiters += periodLiters;
          totalFuelAmount += periodAmount;
        }
      } catch (e) {
        console.error('[loadRfGps] fuel error:', e);
      }
    }
    
    setRfPeriods(newPeriods);
    setRfGpsMileage(totalMileage);
    console.log('[loadRfGps] TOTAL fuelRf:', totalFuelLiters, 'L', totalFuelAmount, '₽');
    setFuelRf({ liters: totalFuelLiters, amount: totalFuelAmount });
    // Обновляем rfDateFrom/rfDateTo для совместимости
    if (rfPeriods[0]?.from) setRfDateFrom(rfPeriods[0].from);
    if (rfPeriods[rfPeriods.length - 1]?.to) setRfDateTo(rfPeriods[rfPeriods.length - 1].to);
    
    // Загружаем уровень топлива в баке (начало и конец периода)
    const firstPeriod = rfPeriods[0];
    const lastPeriod = rfPeriods[rfPeriods.length - 1];
    if (firstPeriod?.from && lastPeriod?.to) {
      try {
        const [startRes, endRes] = await Promise.all([
          fetch(`/api/reports/telematics/fuel-level?vehicle=${encodeURIComponent(vehicleNumber)}&datetime=${firstPeriod.from}`),
          fetch(`/api/reports/telematics/fuel-level?vehicle=${encodeURIComponent(vehicleNumber)}&datetime=${lastPeriod.to}`)
        ]);
        const startData = await startRes.json();
        const endData = await endRes.json();
        console.log('[loadRfGps] FuelLevel start:', startData, 'end:', endData);
        
        // Не перезаписываем если уже заполнено вручную
        if (startData.hasSensor && startData.level >= 0 && !rfFuelStartTank) {
          setRfFuelStartTank(startData.level);
        }
        if (!startData.hasSensor && !rfFuelStartTank) {
          setHasFuelSensor(false);
        }
        if (endData.hasSensor && endData.level >= 0 && !rfFuelEndTank) {
          setRfFuelEndTank(endData.level);
        }
        // Устанавливаем также общие остатки в баке
        if (startData.hasSensor && startData.level >= 0 && !fuelStartTank) {
          setFuelStartTank(startData.level);
        }
        if (endData.hasSensor && endData.level >= 0 && !fuelEndTank) {
          setFuelEndTank(endData.level);
        }
        setHasFuelSensor(startData.hasSensor || endData.hasSensor);
      } catch (e) {
        console.error('[loadRfGps] FuelLevel error:', e);
        setHasFuelSensor(false);
      }
    }
    
    setRfGpsLoading(false);
  };

  const loadFuel = async () => {
    if (isDeleted) return;
    if (!vehicleNumber || !dateFrom || !dateTo) return;
    setFuelLoading(true);
    try {
      const [detailRes, transRes] = await Promise.all([
        fetch(`/api/reports/fuel/detail?vehicle=${encodeURIComponent(vehicleNumber)}&from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`),
        fetch(`/api/reports/fuel/transactions?vehicle=${encodeURIComponent(vehicleNumber)}&from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`)
      ]);
      const detailData = await detailRes.json();
      const transData = await transRes.json();
      setFuelBySource(detailData.by_source || []);
      setFuelTotal(detailData.total || { liters: 0, amount: 0, count: 0 });
      setFuelTransactions(transData.transactions || []);
      
      // Если нет отдельных периодов РФ — используем общее топливо как РФ
      if (rfPeriods.length === 0 && detailData.total) {
        setFuelRf({ liters: Number(detailData.total.liters) || 0, amount: Number(detailData.total.amount) || 0 });
      }
    } catch (e) { 
      setFuelBySource([]); 
      setFuelTotal({ liters: 0, amount: 0, count: 0 }); 
      setFuelTransactions([]);
    }
    // Auto-update DB if editing existing report
      if (isEditMode && fullReportId && detailData.total) {
        try {
          await fetch('/api/reports/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: fullReportId,
              fuel_quantity: Number(detailData.total.liters) || 0,
              fuel_amount: Number(detailData.total.amount) || 0,
              user_name: user?.full_name || 'auto',
            })
          });
        } catch (e) { console.warn('[fuel] auto-save error:', e); }
      }
    setFuelLoading(false);
  };

  const handleAutoFill = async () => {
    if (!driverName || !dateFrom || !dateTo) { alert("Выберите водителя и даты"); return; }
    
    setAutoLoading(true);
    setWbTrips([]); setWbTotals({count: 0, driver_rate: 0}); setWbGpsMileage(0); setWbDays(0);
    setRfContracts([]);
    // NOTE: Не сбрасываем rfGpsMileage и rfPeriods — они берутся из сохранённого отчёта
    // setRfGpsMileage(0); setRfDateFrom(""); setRfDateTo("");
    setGpsMileage(0);
    setFuelBySource([]); setFuelTotal({ liters: 0, amount: 0, count: 0 });
    
    try {
      const baseParams = new URLSearchParams({ driver: driverName, from: dateFrom, to: dateTo });
      if (vehicleNumber) baseParams.append("vehicle", vehicleNumber);
      
      // WB
      const wbRes = await fetch(`/api/reports/trips-detail-v2?${baseParams}`);
      let wbData = await wbRes.json();
      // Vehicle fallback: if no trips with vehicle, retry by driver only
      if ((!wbData.trips || wbData.trips.length === 0) && vehicleNumber && driverName) {
        const fallbackParams = new URLSearchParams({ driver: driverName, from: dateFrom, to: dateTo });
        const wbRes2 = await fetch(`/api/reports/trips-detail-v2?${fallbackParams}`);
        const wbData2 = await wbRes2.json();
        if (wbData2.trips?.length > 0) {
          console.log('[WB] Vehicle fallback: found', wbData2.trips.length, 'trips by driver only');
          wbData = wbData2;
        }
      }
      
      if (wbData.trips) {
        // Сортировка по дате+времени погрузки для правильного расчёта простоев
        const sortedTrips = [...wbData.trips].sort((a: WbTrip, b: WbTrip) => {
          const dateA = new Date(`${a.loading_date}T${a.loading_time || '00:00'}`);
          const dateB = new Date(`${b.loading_date}T${b.loading_time || '00:00'}`);
          return dateA.getTime() - dateB.getTime();
        });
        setWbTrips(sortedTrips);
        setWbTotals({
          count: sortedTrips.length,
          driver_rate: sortedTrips.reduce((s: number, t: WbTrip) => s + parseFloat(String(t.driver_rate || 0)), 0)
        });
        
        if (vehicleNumber) {
          const uniqueDays = getUniqueDays(wbData.trips);
          setWbDays(uniqueDays.length);
          if (uniqueDays.length > 0) {
            const wbGpsRes = await fetch("/api/reports/telematics/mileage-by-dates", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vehicle: vehicleNumber, dates: uniqueDays })
            });
            const wbGpsData = await wbGpsRes.json();
            setWbGpsMileage(wbGpsData.total || 0);
          }
        }
      }
      
      // РФ
      const rfRes = await fetch(`/api/reports/contracts-rf-v2?${baseParams}`);
      const rfData = await rfRes.json();
      if (rfData.contracts && rfData.contracts.length > 0) {
        setRfContracts(rfData.contracts);
      }
      
      if (vehicleNumber) {
        // Общий GPS
        const mileageRes = await fetch(`/api/reports/telematics/mileage?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`);
        const mileageData = await mileageRes.json();
        if (mileageData.mileage) setGpsMileage(mileageData.mileage);
        
        // GPS по дням
        const gpsByDayRes = await fetch(`/api/reports/telematics/mileage-by-day?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`);
        const gpsByDayData = await gpsByDayRes.json();
        setGpsByDay(gpsByDayData.days || []);
        
        // Топливо
        const fuelRes = await fetch(`/api/reports/fuel/detail?vehicle=${encodeURIComponent(vehicleNumber)}&from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`);
        const fuelData = await fuelRes.json();
        setFuelBySource(fuelData.by_source || []);
        setFuelTotal(fuelData.total || { liters: 0, amount: 0, count: 0 });
        
        // Остатки в баке по датчику
        try {
          const [startFuelRes, endFuelRes] = await Promise.all([
            fetch(`/api/reports/telematics/fuel-level?vehicle=${encodeURIComponent(vehicleNumber)}&datetime=${dateFrom}`),
            fetch(`/api/reports/telematics/fuel-level?vehicle=${encodeURIComponent(vehicleNumber)}&datetime=${dateTo}`)
          ]);
          const startFuel = await startFuelRes.json();
          const endFuel = await endFuelRes.json();
          console.log('[autoFill] FuelLevel start:', startFuel, 'end:', endFuel);
          if (startFuel.hasSensor && startFuel.level >= 0 && !fuelStartTank) {
            setFuelStartTank(startFuel.level);
          }
          if (endFuel.hasSensor && endFuel.level >= 0 && !fuelEndTank) {
            setFuelEndTank(endFuel.level);
          }
          setHasFuelSensor(startFuel.hasSensor || endFuel.hasSensor);
        } catch (e) { console.error('[autoFill] FuelLevel error:', e); }
      }
    } catch (err) { console.error(err); }
    
    // Загрузка штрафов WB
    try {
      const penRes = await fetch(`/api/trips/penalties?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`);
      const penData = await penRes.json();
      setWbPenalties(penData.penalties || []);
    } catch (e) { console.error('[penalties]', e); }
    
    
        // GPS coverage — загружается из snapshot, обновляется по кнопке
    
        // GPS recovery data
        if (vehicleNumber && dateFrom && dateTo) {
          try {
            const recRes = await fetch(`/api/gps/recovery?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`);
            if (recRes.ok) { const recData = await recRes.json(); setGpsRecovery(recData); }
          } catch(e) { console.error('[gps-recovery]', e); }
        }
    // Загрузка выплат из ведомостей
    if (driverName) {
      try {
        const salUrl = isEditMode && fullReportId
          ? `/api/salary/by-report/${fullReportId}`
          : `/api/salary/registers/by-driver?driver=${encodeURIComponent(driverName)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}${fullReportId ? '&report_id='+fullReportId : ''}`;
        const salRes = await fetch(salUrl);
        const salData = await salRes.json();
        if (salData.payments?.length === 0 && isEditMode && fullReportId) {
          // Fallback — поиск по имени
          const sal2 = await fetch(`/api/salary/registers/by-driver?driver=${encodeURIComponent(driverName)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}${fullReportId ? '&report_id='+fullReportId : ''}`);
          const sal2Data = await sal2.json();
          setSalaryData({ payments: sal2Data?.payments || [], total: sal2Data?.total || 0 });
        } else {
          setSalaryData({ payments: salData?.payments || [], total: salData?.total || 0 });
        }
      } catch (e) { console.error('[salary]', e); }
    }
    
    setAutoLoading(false);
  };

  const addExpense = () => {
    if (!newExpenseName || !newExpenseAmount) return;
    setExpenses([...expenses, { name: newExpenseName, amount: Number(newExpenseAmount) }]);
    setNewExpenseName(""); setNewExpenseAmount("");
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0); // Компенсация (+)
  const totalPayments = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0); // Выдано (-)
  const totalExtraWorks = extraWorks.reduce((sum, w) => sum + ((Number(w.count) || 0) * (Number(w.rate) || 0)), 0); // Доп. работы (+)
  // RF начисления: ТОЛЬКО если есть периоды с реальными датами from/to

  // Fuel card functions from useFuelCards hook
  const { searchFuelCards, bindFuelCard, unbindFuelCard, loadCardTransactions, loadVehicleCards } = fuelCards;

  const hasRfPeriods = rfPeriods.some(p => p.from && p.to);
  // Без периодов — нет РФ данных (даже если rf_mileage/rf_days сохранены в БД)
  const hasRfData = hasRfPeriods || (gpsMileage > 0 && wbGpsMileage > 0 && gpsMileage > wbGpsMileage);
  // Пробег РФ: только если есть периоды с датами
  const effectiveRfMileage = hasRfData ? (rfGpsMileage || 0) : (gpsMileage > 0 && wbGpsMileage > 0 ? Math.max(gpsMileage - wbGpsMileage, 0) : 0);
  const rfDriverPay = hasRfData ? Math.round(effectiveRfMileage * (rfRatePerKm || 0)) : 0;
  const rfDailyPay = (hasRfData || rfDaysManual) ? (rfDays || 0) * (rfDailyRate || 0) : 0; // Суточные РФ (+)
  const rfBonus = hasRfData && bonusEnabled ? Math.round(effectiveRfMileage * (bonusRate || 0)) : 0; // Премия ТК (+)
  const totalDeductions = deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0); // Удержания (−)
  const totalFines = fines.reduce((sum, f) => sum + (Number(f.amount) || 0), 0); // Штрафы (−)
  const relocationMileage = relocations.reduce((sum, r) => sum + (Number(r.mileage) || 0), 0);
  const relocationPay = Math.round(relocationMileage * (rfRatePerKm || 0)); // Порожний по тарифу РФ
  const totalDriverPay = (Number(wbTotals.driver_rate) || 0) + rfDriverPay + rfDailyPay + rfBonus + (totalIdleData.amount || 0) + relocationPay;
  const totalToPay = totalDriverPay + totalExpenses + totalExtraWorks - totalPayments - totalDeductions - totalFines;
  
  // Средний расход топлива (с учётом остатков в баке)
  const fuelUsed = fuelTotal.liters + (Number(fuelStartTank) || 0) - (Number(fuelEndTank) || 0);
  // ОБЩИЙ расход: всё топливо / полный GPS пробег
  const avgFuelConsumptionTotal = gpsMileage > 0 && fuelTotal.liters > 0 ? (fuelTotal.liters / gpsMileage * 100).toFixed(2) : gpsMileage === 0 && fuelTotal.liters > 0 ? "—" : "0";
  // Расход РФ: топливо РФ / пробег РФ
  const fuelUsedRf = fuelRf.liters || 0;
  const avgFuelConsumption = effectiveRfMileage > 0 && fuelUsedRf > 0 ? (fuelUsedRf / effectiveRfMileage * 100).toFixed(2) : "0";
  // Расход WB: топливо WB / пробег WB
  const fuelUsedWb = fuelWb.liters;
  const avgFuelConsumptionWb = wbGpsMileage > 0 && fuelUsedWb > 0 ? (fuelUsedWb / wbGpsMileage * 100).toFixed(2) : "0";
  const earnPerKm = effectiveRfMileage > 0 && !isNaN(totalToPay) ? (totalToPay / effectiveRfMileage).toFixed(2) : "0";
  
  // Расчёт топлива по периодам WB и РФ (только если есть транзакции)
  useEffect(() => {
    if (fuelTransactions.length === 0) { setFuelWb({ liters: 0, amount: 0 }); return; } // НЕ сбрасываем fuelRf — оно может быть загружено из loadRfGps
    
    // Даты WB рейсов
    const wbDates = new Set(wbTrips.map(t => t.loading_date?.slice(0, 10)));
    
    // Даты РФ периодов
    const rfDatesSet = new Set<string>();
    rfPeriods.forEach(p => {
      if (p.from && p.to) {
        const start = new Date(p.from);
        const end = new Date(p.to);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          rfDatesSet.add(d.toISOString().slice(0, 10));
        }
      }
    });
    
    // Суммируем топливо по периодам (с учётом времени если есть)
    let wbL = 0, wbA = 0, rfL = 0, rfA = 0;
    fuelTransactions.forEach(t => {
      const date = t.date?.slice(0, 10);
      const liters = Number(t.liters) || 0;
      const amount = Number(t.amount) || 0;
      if (wbDates.has(date)) { wbL += liters; wbA += amount; }
      
      // РФ: проверяем каждый период с учётом времени
      let inRf = false;
      for (const p of rfPeriods) {
        if (!p.from || !p.to) continue;
        const pFrom = new Date(p.from);
        const pTo = new Date(p.to);
        // Если у транзакции есть время — сравниваем datetime
        let txDt: Date;
        if (t.time) {
          txDt = new Date(date + 'T' + t.time);
        } else {
          txDt = new Date(date + 'T12:00:00'); // Если времени нет — считаем полдень
        }
        if (txDt >= pFrom && txDt <= pTo) { inRf = true; break; }
      }
      // Fallback: если периоды без времени — по дате
      if (!inRf && rfDatesSet.has(date)) {
        const hasTimeInPeriods = rfPeriods.some(p => p.from?.includes('T') || p.from?.includes(':'));
        if (!hasTimeInPeriods) inRf = true;
      }
      if (inRf) { rfL += liters; rfA += amount; }
    });
    console.log('[fuelCalc] rfDates:', Array.from(rfDatesSet).slice(0, 5), 'rfL:', rfL, 'rfA:', rfA);
    setFuelWb({ liters: wbL, amount: wbA });
    setFuelRf({ liters: rfL, amount: rfA });
  }, [fuelTransactions, wbTrips, rfPeriods]);
  
  // Авто-расчёт ставки по расходу топлива из таблицы тарифов (с учётом остатков)
  useEffect(() => {
    const rfFuelUsedCalc = fuelRf.liters + (Number(rfFuelStartTank) || 0) - (Number(rfFuelEndTank) || 0);
    // Не ставим авто-тариф если:
    // - нет данных по топливу (liters=0 и нет остатков)
    // - расход отрицательный (бак прибыл, а заправки не загружены)
    // - нет пробега
    const hasFuelInfo = fuelRf.liters > 0 || (Number(rfFuelStartTank) > 0 && Number(rfFuelEndTank) > 0);
    if (selectedVehicleType && selectedSeason && rfFuelUsedCalc > 0 && effectiveRfMileage > 0 && hasFuelInfo) {
      const consumption = rfFuelUsedCalc / effectiveRfMileage * 100;
      console.log('[autoRate] consumption:', consumption, 'type:', selectedVehicleType, 'season:', selectedSeason, 'fuel:', rfFuelUsedCalc);
      fetch(`/api/tariffs/calculate?vehicle_type=${encodeURIComponent(selectedVehicleType)}&season=${encodeURIComponent(selectedSeason)}&consumption=${consumption}`)
        .then(r => r.json())
        .then(data => {
          console.log('[autoRate] response:', data);
          if (data.rate) {
            setAutoRate(data.rate);
            // Автоставка только если отчёт НЕ загружен из БД (новый отчёт)
            if (!reportLoaded && params.id === 'new') {
              setRfRatePerKm(data.rate);
            }
          }
        })
        .catch((e) => console.error('[autoRate] error:', e));
    } else if (rfFuelUsedCalc < 0 && effectiveRfMileage > 0) {
      console.warn('[autoRate] Расход отрицательный:', rfFuelUsedCalc, '— заправки не загружены? Авто-тариф не применяется.');
      setAutoRate(null);
    }
  }, [selectedVehicleType, selectedSeason, fuelRf.liters, rfGpsMileage, rfFuelStartTank, rfFuelEndTank]);
  
  // Определение сезона
  const getSeason = () => {
    const month = new Date().getMonth() + 1;
    if (month >= 11 || month <= 2) return "Зима";
    if (month >= 6 && month <= 8) return "Лето";
    return "Межсезон";
  };
  
  // Текст отчёта для водителя
  const reportText = `Водитель: ${driverName}
Период: ${dateFrom} - ${dateTo}
Т/С: ${vehicleNumber}
Пробег: ${gpsMileage.toLocaleString("ru-RU")} км${effectiveRfMileage > 0 ? ` | ВБ: ${Math.max(0, gpsMileage - effectiveRfMileage).toLocaleString("ru-RU")} км | РФ: ${effectiveRfMileage.toLocaleString("ru-RU")} км` : ''}
Расход: *${avgFuelConsumptionTotal}* л/100км${Number(avgFuelConsumptionWb) > 0 ? ` | ВБ: ${avgFuelConsumptionWb}` : ''}${Number(avgFuelConsumption) > 0 ? ` | РФ: ${avgFuelConsumption}` : ''}
Вид тарифа: ${getSeason()}
Тариф: *${rfRatePerKm}* ₽/км
-------------
*Начислено:*
${rfDriverPay > 0 ? `Начисление за км: ${rfDriverPay.toLocaleString("ru-RU")} ₽\n` : ""}${rfBonus > 0 ? `Премия ТК (${effectiveRfMileage}×${bonusRate}): ${rfBonus.toLocaleString("ru-RU")} ₽\n` : ""}${rfDailyPay > 0 ? `Суточные (${rfDays} дн × ${rfDailyRate}): ${rfDailyPay.toLocaleString("ru-RU")} ₽\n` : ""}${wbTotals.driver_rate > 0 ? `WB рейсы: ${wbTotals.driver_rate.toLocaleString("ru-RU")} ₽\n` : ""}${totalIdleData.amount > 0 ? `Простой (${totalIdleData.paidHours} ч.): ${totalIdleData.amount.toLocaleString("ru-RU")} ₽\n` : ""}${wbPenalties.length > 0 ? `🚨 Штрафы WB (инфо):\n${wbPenalties.map(p => `  #${p.wb_trip_number} ${p.loading_date?.slice(0,10)}: ${(Number(p.penalty_amount)||0).toLocaleString("ru-RU")} ₽${p.penalty_pending ? ' (на рассм.)' : ''}`).join("\n")}\n  Итого: ${wbPenalties.reduce((s,p)=>s+(Number(p.penalty_amount)||0),0).toLocaleString("ru-RU")} ₽\n` : ""}${relocations.length > 0 ? `🚛 Порожний перегон:\n${relocations.map(r => `  ${r.from} → ${r.to}: ${r.mileage} км (${r.date})`).join("\n")}\n  Итого: ${relocationMileage} км × ${rfRatePerKm} = ${relocationPay.toLocaleString("ru-RU")} ₽\n` : ""}${extraWorks.map(w => `${w.name} (${w.count}×${w.rate}): ${(w.count*w.rate).toLocaleString("ru-RU")} ₽`).join("\n")}${extraWorks.length > 0 ? "\n" : ""}${expenses.map(e => `${e.name}: +${e.amount.toLocaleString("ru-RU")} ₽`).join("\n")}${expenses.length > 0 ? "\n" : ""}${deductions.map(d => `💸 Удержание "${d.name}": -${d.amount.toLocaleString("ru-RU")} ₽`).join("\n")}${deductions.length > 0 ? "\n" : ""}${fines.map(f => `⚠️ Штраф "${f.name}": -${f.amount.toLocaleString("ru-RU")} ₽`).join("\n")}${fines.length > 0 ? "\n" : ""}${payments.map(p => `${p.type === "advance" ? "Аванс" : p.type === "daily" ? "Суточные выданные" : p.description || "Выдано"}: -${p.amount.toLocaleString("ru-RU")} ₽`).join("\n")}${payments.length > 0 ? "\n" : ""}-------------
*Всего начислено: ${totalToPay.toLocaleString("ru-RU")} ₽*
*Заработок за км: ${earnPerKm} ₽/км*
${comment ? `Комментарий: ${comment}` : ""}`;
  
  // Загрузка выплат из зарплатных ведомостей
  const loadSalaryPayments = async () => {
    if (!driverName) return;
    try {
      // Определяем период (от первого до последнего дня отчёта)
      const fromDate = dateFrom?.split('T')[0] || rfPeriods[0]?.from?.split('T')[0];
      const toDate = dateTo?.split('T')[0] || rfPeriods[rfPeriods.length-1]?.to?.split('T')[0];
      
      const url = `/api/salary/by-name?name=${encodeURIComponent(driverName)}${fromDate ? `&from=${fromDate}` : ''}${toDate ? `&to=${toDate}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.payments && data.payments.length > 0) {
        // Добавляем каждую выплату из ведомости
        const newPayments = data.payments.map((p: any) => ({
          date: p.register_date?.split('T')[0] || '',
          amount: Number(p.amount),
          type: 'salary',
          description: `Реестр №${p.register_number}${p.payment_purpose ? ' — ' + p.payment_purpose : ''}`
        }));
        setPayments([...payments, ...newPayments]);
        alert(`Загружено ${data.payments.length} выплат на сумму ${data.total.toLocaleString()} ₽`);
      } else {
        alert('Выплат по ведомостям не найдено за этот период');
      }
    } catch (e) {
      console.error('loadSalaryPayments error:', e);
      alert('Ошибка загрузки');
    }
  };
  
  // Функции добавления
  const addExtraWork = async () => {
    const name = workSearch;
    if (name && newWorkCount && newWorkRate) {
      // Если нет в справочнике — добавляем
      if (!workTypes.find(t => t.name === name)) {
        await addNewWorkType(name, "extra_work", Number(newWorkRate));
      }
      setExtraWorks([...extraWorks, { name, count: Number(newWorkCount), rate: Number(newWorkRate) }]);
      setNewWorkCount(1); setWorkSearch("");
    }
  };
  const addExpenseItem = async () => {
    const name = compSearch;
    if (name && newExpenseAmount) {
      // Если нет в справочнике — добавляем
      if (!compTypes.find(t => t.name === name)) {
        await addNewWorkType(name, "compensation", Number(newExpenseAmount));
      }
      setExpenses([...expenses, { name, amount: Number(newExpenseAmount) }]);
      setCompSearch(""); setNewExpenseAmount("");
    }
  };

  const handleValidate = async (rid?: string) => {
    const id = rid || reportId;
    if (!id) { alert("Сначала сохраните отчёт"); return; }
    setValidating(true);
    try {
      const res = await fetch(`/api/validation/check-report?reportId=${id}`);
      const data = await res.json();
      if (!res.ok || !data.checks) {
        setValidationResult({ status: 'error', checks: [{ param: 'api', value: 0, status: 'error', message: data.error || 'Ошибка проверки' }] });
      } else {
        setValidationResult(data);
      }
    } catch (e) {
      setValidationResult({ status: 'error', checks: [{ param: 'api', value: 0, status: 'error', message: 'Сервер недоступен' }] });
    }
    setValidating(false);
  };

  const handleSave = async () => {
    if (isDeleted) { alert("Удалённый отчёт нельзя сохранить. Сначала восстановите."); return; }
    if (!driverName || !dateFrom || !dateTo) { alert("Заполните поля"); return; }
    // Проверка дублей
    if (vehicleNumber && dateFrom && dateTo) {
      try {
        const overlapRes = await fetch(`/api/reports/check-overlap?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}${isEditMode && fullReportId ? '&exclude_id=' + fullReportId : ''}`);
        const overlapData = await overlapRes.json();
        if (overlapData.overlaps?.length > 0) {
          const list = overlapData.overlaps.map((o: any) => `#${o.number} (${o.driver_name}, ${o.date_from} — ${o.date_to})`).join('\n');
          if (!confirm(`⚠️ Найдены отчёты за пересекающийся период:\n${list}\n\nСохранить всё равно?`)) return;
        }
      } catch (e) { /* ignore overlap check errors */ }
    }
    setLoading(true);
    try {
      const url = isEditMode ? "/api/reports/update" : "/api/reports/save";
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEditMode ? fullReportId : undefined, // Для update (полный UUID)
          user_name: user?.full_name || 'Неизвестно',
          driver_name: driverName, 
          vehicle_number: vehicleNumber,
          date_from: dateFrom, 
          date_to: dateTo, 
          time_from: timeFrom,
          time_to: timeTo,
          mileage: gpsMileage || (wbGpsMileage + effectiveRfMileage) || effectiveRfMileage,
          total_mileage: gpsMileage || (wbGpsMileage + effectiveRfMileage) || 0,
          wb_mileage: wbGpsMileage,
          fuel_quantity: fuelTotal.liters || 0, 
          fuel_amount: fuelTotal.amount || 0,
          fuel_start: fuelStartTank || 0,
          fuel_end: fuelEndTank || 0,
          total_expenses: totalExpenses + totalExtraWorks, // Компенсация + доп.работы
          driver_accruals: totalToPay, // Итого к выплате
          driver_payments: totalPayments, // Выдано
          // Периоды РФ и тип машины
          rf_periods: rfPeriods.filter(p => p.from && p.to),
          vehicle_type: selectedVehicleType,
          season: selectedSeason,
          rate_per_km: rfRatePerKm,
          // Доп. данные для отчёта
          rf_mileage: rfGpsMileage,
          date_from_with_time: dateFrom,
          date_to_with_time: dateTo,
          rf_rate: rfRatePerKm,
          rf_days: rfDays,
          rf_daily_rate: rfDailyRate,
          rf_fuel_start: rfFuelStartTank || 0,
          rf_fuel_end: rfFuelEndTank || 0,
          fuel_rf: fuelRf,
          wb_totals: wbTotals,
          bonus_enabled: bonusEnabled,
          bonus_rate: bonusRate,
          wb_rate: Number(wbTotals.driver_rate) || 0,
          wb_trips: wbTotals.count,
          wb_trips_data: wbTrips, // Массив рейсов WB для восстановления
          gps_coverage_snapshot: gpsCoverage, // GPS coverage snapshot
          fuel_by_source: fuelBySource, // Топливо по источникам
          rf_contracts_data: rfContracts, // Заявки РФ для восстановления
          wb_gps_mileage: wbGpsMileage,
          wb_days: wbDays,
          gps_mileage: gpsMileage,
          extra_works: extraWorks,
          expenses: expenses,
          payments: payments,
          deductions: deductions,
          fines: fines,
          relocations: relocations,
          wb_penalties: wbPenalties,
          excluded_idle_trips: Array.from(excludedIdles), // Excluded idles
          comment: comment
        })
      });
      const data = await res.json();
      if (data.success) {
        // Полная очистка формы
        setDriverName(""); setDriverSearch(""); setVehicleNumber(""); setVehicleSearch("");
        setDateFrom(""); setDateTo(""); setDriverVehicles([]);
        setWbTrips([]); setWbTotals({count: 0, driver_rate: 0}); setWbGpsMileage(0); setWbDays(0);
        setRfContracts([]); setRfGpsMileage(0); setRfDateFrom(""); setRfDateTo("");
        setGpsMileage(0); setFuelBySource([]); setFuelTotal({ liters: 0, amount: 0, count: 0 }); 
        setExpenses([]); setExtraWorks([]); setPayments([]);
        setFuelStartTank(""); setFuelEndTank("");
        setRfDays(0); setRfDaysManual(false); setReportLoaded(false); setRfDailyRate(1000); setBonusEnabled(false);
        setComment("");
        // Редирект на список отчётов
        alert(`Отчёт #${data.number || data.id || 'OK'} сохранён!`);
        window.location.href = `/reports`;
      } else { alert("Ошибка: " + data.error); }
    } catch (err) { alert("Ошибка"); }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (isDeleted) return;
    if (!isEditMode || !reportId) return;
    if (!confirm("Удалить отчёт? Он будет скрыт из списка (можно восстановить).")) return;
    try {
      const res = await fetch(`/api/reports/delete/${fullReportId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { alert("Отчёт удалён"); window.location.href = "/reports"; }
      else alert("Ошибка: " + data.error);
    } catch (e) { alert("Ошибка удаления"); }
  };

  const handleRestore = async () => {
    if (!fullReportId) return;
    try {
      const res = await fetch(`/api/reports/${fullReportId}/restore`, { method: "POST" });
      const data = await res.json();
      if (data.success) { setReportStatus("draft"); alert("Отчёт восстановлен"); }
      else alert("Ошибка: " + data.error);
    } catch (e) { alert("Ошибка восстановления"); }
  };

  if (pageLoading) {
    return <div className="p-4 md:p-6 max-w-6xl mx-auto flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }


  if (notFound) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Отчёт не найден</h1>
        <p className="text-slate-400 mb-4">ID: {reportId}</p>
        <Link href="/reports" className="text-blue-400 hover:underline">Вернуться к списку</Link>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <Link href="/reports" className="flex items-center gap-2 text-slate-400 hover:text-white min-h-[44px]"><ArrowLeft className="w-4 h-4" /> Назад</Link>
        {isDeleted && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-4 py-2 text-red-400 text-sm font-medium">
            Удалённый отчёт (только чтение)
          </div>
        )}
        <div className="flex items-center gap-2">
          {isEditMode && reportStatus === 'deleted' && (
            <button onClick={handleRestore} className="text-green-400 hover:text-green-300 hover:bg-green-900/30 px-3 py-2 rounded flex items-center gap-1 min-h-[44px]">
              ♻️ Восстановить
            </button>
          )}
          {isEditMode && reportStatus !== 'deleted' && (
            <>
              <button onClick={async () => {
                if (!confirm("Пересчитать топливо и пробег из первичных данных?")) return;
                try {
                  const res = await fetch(`/api/reports/${fullReportId}/recalc`, { method: "POST" });
                  const data = await res.json();
                  if (data.changes) {
                    const msgs = [];
                    if (data.changes.fuel) msgs.push("топливо");
                    if (data.changes.wb) msgs.push("WB пробег");
                    if (data.changes.rf) msgs.push("RF пробег");
                    if (data.changes.total) msgs.push("общий пробег");
                    if (data.changes.expenses) msgs.push("категории");
                    alert(msgs.length > 0 ? `Обновлено: ${msgs.join(", ")}` : "Изменений нет");
                    window.location.reload();
                  }
                } catch (e: any) { alert("Ошибка: " + e.message); }
              }} className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/30 px-3 py-2 rounded flex items-center gap-1 min-h-[44px]">
                <RefreshCw className="w-4 h-4" /> Пересчитать
              </button>
              <button onClick={handleDelete} className="text-red-400 hover:text-red-300 hover:bg-red-900/30 px-3 py-2 rounded flex items-center gap-1 min-h-[44px]">
                <Trash2 className="w-4 h-4" /> Удалить
              </button>
            </>
          )}
        </div>
      </div>

      {reportStatus === 'deleted' && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-red-400 font-semibold">🗑️ Отчёт удалён</span>
          <button onClick={handleRestore} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">♻️ Восстановить</button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">{isEditMode ? `Отчёт #${reportId}` : 'Новый отчёт'}</h1>
        {isEditMode && (
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            reportStatus === 'paid' ? 'bg-green-500/20 text-green-400' :
            reportStatus === 'approved' ? 'bg-blue-500/20 text-blue-400' :
            reportStatus === 'review' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {reportStatus === 'paid' ? '💰 Оплачен' :
             reportStatus === 'approved' ? '✅ Утверждён' :
             reportStatus === 'review' ? '👁 На проверке' :
             '📝 Черновик'}
          </span>
        )}
        {isHiredVehicle && (
          <span className="px-2 py-1 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400">🔵 Наёмный транспорт</span>
        )}
      </div>
        {/* Форма */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
          <div className="relative">
            <label className="block text-slate-400 text-sm mb-1"><User className="w-4 h-4 inline mr-1" /> Водитель</label>
            <input type="text" value={driverSearch}
              onChange={e => { setDriverSearch(e.target.value); setShowDriverList(true); if (!e.target.value) { setDriverName(""); setDriverVehicles([]); } }}
              onFocus={() => setShowDriverList(true)} onBlur={() => setTimeout(() => setShowDriverList(false), 200)}
              placeholder="Имя..." className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600" />
            {showDriverList && driverSearch && filteredDrivers.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg max-h-48 overflow-y-auto">
                {filteredDrivers.map(d => <button key={d.name} onClick={() => selectDriver(d.name)} className="w-full text-left px-3 py-2 hover:bg-slate-600 text-white text-sm">{d.name}</button>)}
              </div>
            )}
          </div>

          {driverName && driverVehicles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {driverVehicles.map(v => (
                <button key={v.number} onClick={() => selectVehicle(v.number)}
                  className={`px-2 py-1 rounded text-xs ${v.number === vehicleNumber ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'}`}>
                  {v.number}
                </button>
              ))}
            </div>
          )}
          
          {/* Подсказка водителей по машине */}
          {!driverName && vehicleNumber && driverSuggestions.length > 0 && (
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-2">
              <div className="text-xs text-cyan-400 mb-1">💡 Водители на {vehicleNumber} в этот период:</div>
              <div className="flex flex-wrap gap-2">
                {driverSuggestions.map(d => (
                  <button key={d.driver_name} onClick={() => { setDriverName(d.driver_name); setDriverSearch(d.driver_name); }}
                    className="px-2 py-1 rounded text-xs bg-cyan-600/30 text-cyan-300 hover:bg-cyan-600/50">
                    {d.driver_name} ({d.source || `${d.trips} рейсов`})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Подсказка машин по водителю */}
          {driverName && !vehicleNumber && vehicleSuggestions.length > 0 && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-2">
              <div className="text-xs text-purple-400 mb-1">🚛 Машины {driverName.split(' ')[0]} в этот период:</div>
              <div className="flex flex-wrap gap-2">
                {vehicleSuggestions.map((v: any) => (
                  <button key={v.vehicle_number} onClick={() => setVehicleNumber(v.vehicle_number)}
                    className="px-2 py-1 rounded text-xs bg-purple-600/30 text-purple-300 hover:bg-purple-600/50">
                    {v.vehicle_number} ({v.trips} рейсов)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">С</label>
              <input type="datetime-local" value={dateFrom} onChange={e => { setDateFrom(e.target.value); if (e.target.value.includes("T")) setTimeFrom(e.target.value.slice(11, 16)); }} className="w-full bg-slate-700 text-white rounded-lg px-2 py-1.5 border border-slate-600 text-xs" />
            </div>
            <div>
              <label className="text-xs text-slate-500">По</label>
              <input type="datetime-local" value={dateTo} onChange={e => { setDateTo(e.target.value); if (e.target.value.includes("T")) setTimeTo(e.target.value.slice(11, 16)); }} className="w-full bg-slate-700 text-white rounded-lg px-2 py-1.5 border border-slate-600 text-xs" />
            </div>
          </div>

          <div className="relative">
            <div className="flex gap-2 items-center">
              <input type="text" value={vehicleSearch}
                onChange={e => { const nv = normPlate(e.target.value); setVehicleSearch(nv); setShowVehicleList(true); if (!e.target.value) setVehicleNumber(""); }}
                onFocus={() => setShowVehicleList(true)} 
                onBlur={() => {
                  setTimeout(() => setShowVehicleList(false), 200);
                  // Автонормализация при потере фокуса
                  if (vehicleSearch && !vehicleNumber) {
                    const norm = vehicleSearch.replace(/\s/g,'').toUpperCase()
                      .replace(/A/g,'А').replace(/B/g,'В').replace(/C/g,'С').replace(/E/g,'Е')
                      .replace(/H/g,'Н').replace(/K/g,'К').replace(/M/g,'М').replace(/O/g,'О')
                      .replace(/P/g,'Р').replace(/T/g,'Т').replace(/X/g,'Х').replace(/Y/g,'У')
                      .replace(/0(\d{2})$/, '$1');
                    const match = allVehicles.find(v => v.number === norm);
                    if (match) { setVehicleNumber(match.number); setVehicleSearch(match.number); }
                    else {
                      // Fuzzy: без региона
                      const stripped = norm.replace(/\d{2,3}$/, '');
                      const fuzzy = allVehicles.filter(v => v.number.replace(/\d{2,3}$/, '') === stripped);
                      if (fuzzy.length === 1) { setVehicleNumber(fuzzy[0].number); setVehicleSearch(fuzzy[0].number); }
                    }
                  }
                }}
                placeholder="Номер машины..." className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600" />
              {vehicleNumber && (
                <a href={`/vehicles?search=${encodeURIComponent(vehicleNumber)}`} target="_blank" rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 text-xl shrink-0" title="Карточка ТС">🚛</a>
              )}
            </div>
            {showVehicleList && vehicleSearch && filteredVehicles.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg max-h-48 overflow-y-auto">
                {filteredVehicles.map(v => <button key={v.number} onClick={() => selectVehicle(v.number)} className="w-full text-left px-3 py-2 hover:bg-slate-600 text-white text-sm">{v.number}</button>)}
              </div>
            )}
          </div>

          <button onClick={handleAutoFill} disabled={autoLoading || !driverName || !dateFrom || !dateTo}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-3 sm:py-2 rounded-lg w-full justify-center min-h-[44px] text-base sm:text-sm">
            {autoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />} Загрузить
          </button>
        </div>

        {/* Cross-trip warnings */}
        {crossWarnings.length > 0 && !crossDismissed && (
          <div className="bg-orange-900/30 border border-orange-500/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-300 font-semibold text-sm">
                <span>⚠️</span>
                <span>Обнаружены перекрёстные данные за период</span>
              </div>
              <button onClick={() => setCrossDismissed(true)} className="text-orange-400/60 hover:text-orange-300 text-xs flex items-center gap-1">
                <XIcon size={12} /> Скрыть
              </button>
            </div>
            {crossWarnings.map((w, wi) => (
              <div key={wi} className="bg-orange-950/40 rounded-lg p-3 text-sm space-y-1.5">
                <div className="text-orange-200 font-medium text-xs">{w.type === 1 ? "🚛" : w.type === 2 ? "👤" : "🔄"} {w.title}</div>
                {w.items?.map((item: any, ii: number) => (
                  <div key={ii} className="flex items-center gap-2 text-orange-300/80 text-xs pl-4">
                    <span className="font-medium">{item.name || item.vehicle}</span>
                    {item.km > 0 && <span className="text-orange-400">— {item.km.toLocaleString("ru")} км</span>}
                    {item.score !== undefined && <span className={`text-xs px-1.5 py-0.5 rounded ${item.score >= 70 ? 'bg-green-900/50 text-green-400' : item.score >= 40 ? 'bg-yellow-900/50 text-yellow-400' : 'bg-slate-800 text-slate-400'}`}>{item.score}/100 {item.verdict}</span>}
                    {item.date_from && <span className="text-orange-400/60">{new Date(item.date_from).toLocaleDateString("ru", {day:"2-digit",month:"2-digit"})}–{new Date(item.date_to).toLocaleDateString("ru", {day:"2-digit",month:"2-digit"})}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Сводка GPS */}
        {gpsMileage > 0 && (
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-500/30">
            <div className="text-center mb-3">
              <span className="text-slate-400 text-xs sm:text-sm">Общий GPS за период</span>
              <div className="text-2xl sm:text-3xl font-bold text-white">{gpsMileage.toLocaleString()} км</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><span className="text-purple-400 font-bold">{wbGpsMileage.toLocaleString()}</span><div className="text-slate-500 text-xs">WB</div></div>
              <div><span className="text-orange-400 font-bold">{effectiveRfMileage.toLocaleString()}</span><div className="text-slate-500 text-xs">РФ</div></div>
              {(() => {
                const wbDates = new Set(wbTrips.flatMap(t => {
                  const dates: string[] = [];
                  const start = new Date(t.loading_date);
                  const end = new Date(t.unloading_date || t.loading_date);
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dates.push(d.toISOString().slice(0, 10));
                  return dates;
                }));
                const rfDates = new Set<string>();
                rfPeriods.forEach(p => {
                  if (p.from && p.to) {
                    const start = new Date(p.from); const end = new Date(p.to);
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) rfDates.add(d.toISOString().slice(0, 10));
                  }
                });
                const otherDays = gpsByDay.filter(d => !wbDates.has(d.date) && !rfDates.has(d.date) && d.km > 10);
                return (
                  <div className="relative">
                    <div className="text-center cursor-pointer group" onClick={() => setShowOtherMileage(!showOtherMileage)}>
                      <span className="text-yellow-400 font-bold">{Math.max(0, gpsMileage - wbGpsMileage - effectiveRfMileage).toLocaleString()}</span>
                      <div className="text-slate-500 text-xs group-hover:text-yellow-400">Прочее ℹ️</div>
                    </div>
                    {showOtherMileage && otherDays.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 right-0 bg-slate-800 border border-yellow-500/50 rounded-lg shadow-2xl p-3 min-w-[220px] max-h-[320px] overflow-y-auto">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-yellow-400 font-semibold text-sm">Прочий пробег</span>
                          <button onClick={(e) => { e.stopPropagation(); setShowOtherMileage(false); }} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
                        </div>
                        <table className="w-full text-xs">
                          <thead><tr className="text-slate-500"><th className="text-left pb-1">Дата</th><th className="text-right pb-1">Км</th></tr></thead>
                          <tbody>
                            {otherDays.map((d: any) => (
                              <tr key={d.date} className="border-t border-slate-700/50">
                                <td className="py-1 text-slate-300">{d.date.slice(5, 10).split('-').reverse().join('.')}</td>
                                <td className="py-1 text-right text-yellow-400 font-medium">{Math.round(d.km)} км</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-600 font-bold">
                              <td className="py-1 text-white">ИТОГО</td>
                              <td className="py-1 text-right text-yellow-400">{otherDays.reduce((s: number, d: any) => s + Math.round(d.km), 0).toLocaleString()} км</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}


        {/* 📡 Покрытие GPS */}
        {vehicleNumber && dateFrom && dateTo && (
          <div className="bg-slate-800 rounded-xl p-4 border border-cyan-500/30">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-cyan-400">📡 Покрытие GPS</h2>
              <span className={`text-sm font-bold ${(gpsCoverage?.coverage_pct ?? 0) >= 80 ? 'text-green-400' : (gpsCoverage?.coverage_pct ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {gpsCoverage ? `${gpsCoverage?.covered_days ?? 0}/${gpsCoverage?.total_days ?? 0} дней (${gpsCoverage?.coverage_pct ?? 0}%)` : "—"}
              </span>
              <button onClick={async () => {
                setGpsLoading(true);
                try {
                  const covRes = await fetch(`/api/reports/gps-coverage?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`);
                  if (covRes.ok) { const covData = await covRes.json(); setGpsCoverage(covData); }
                } catch(e) { console.error('[gps-coverage]', e); }
                setGpsLoading(false);
              }} className="ml-2 px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-blue-400 rounded border border-slate-600" disabled={gpsLoading}>
                {gpsLoading ? '⏳ Обновляем…' : '🔄 Обновить GPS'}
              </button>
              {gpsCoverage && (gpsCoverage as any).loaded_at && <span className="text-xs text-slate-500 ml-2">Обновлено: {new Date((gpsCoverage as any).loaded_at).toLocaleString('ru-RU')}</span>}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <div key={d} className="text-slate-500 font-medium pb-1">{d}</div>)}
              {(() => {
                if (!gpsCoverage || !gpsCoverage.days?.length) return null;
                const firstDate = new Date(gpsCoverage.days[0].date);
                const dow = (firstDate.getDay() + 6) % 7;
                const cells: any[] = [];
                for (let i = 0; i < dow; i++) cells.push(<div key={`e${i}`} />);
                (gpsCoverage?.days || []).forEach(d => {
                  const day = new Date(d.date).getDate();
                  const isRecovered = d.status !== 'ok' && gpsRecovery?.recoveries?.some((r: any) => d.date >= (r.gap_start||'').slice(0,10) && d.date <= (r.gap_end||'').slice(0,10) && r.is_confirmed);
                  const bg = d.status === 'ok' ? 'bg-green-500/30 text-green-300' : isRecovered ? 'bg-blue-500/30 text-blue-300' : d.status === 'partial' ? 'bg-yellow-500/30 text-yellow-300' : 'bg-red-500/20 text-red-400';
                  cells.push(
                    <div key={d.date} className={`rounded p-1 ${bg} cursor-default`} title={`${d.date}: ${d.points} точек, ${d.km} км`}>
                      {day}
                    </div>
                  );
                });
                return cells;
              })()}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-slate-500">
              <span>🟢 GPS</span><span>🟡 Частично</span><span>🔴 Нет GPS</span><span>🔵 Восстановлен</span>
            </div>
          </div>
        )}


        {/* Восстановление пробега */}
        {gpsCoverage && (gpsCoverage?.total_days ?? 0) > 0 && (gpsCoverage?.coverage_pct ?? 0) < 90 && (
          <div className="bg-slate-800 rounded-xl p-4 border border-orange-500/30">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold text-orange-400">🔧 Восстановление пробега</h2>
              {!gpsRecovery?.recoveries?.length && (
                <button onClick={async () => {
                  setRecoveryLoading(true);
                  try {
                    const r = await fetch('/api/gps/recover-mileage', {
                      method: 'POST',
                      headers: { 'x-user-role': localStorage.getItem('userRole') || 'director', 'Content-Type': 'application/json' },
                      body: JSON.stringify({ vehicle: vehicleNumber, from: dateFrom?.split('T')[0], to: dateTo?.split('T')[0], dry_run: false })
                    });
                    const d = await r.json();
                    if (d.total_recovered_km > 0) {
                      alert('Найдено ' + (d.details?.length || 0) + ' дырок, восстановлено ~' + d.total_recovered_km + ' км');
                      const r2 = await fetch('/api/gps/recovery?vehicle=' + encodeURIComponent(vehicleNumber) + '&from=' + dateFrom?.split('T')[0] + '&to=' + dateTo?.split('T')[0]);
                      if (r2.ok) setGpsRecovery(await r2.json());
                    } else { alert('Рейсы WB за период дырок не найдены'); }
                  } catch(e: any) { alert('Ошибка: ' + e.message); }
                  setRecoveryLoading(false);
                }} className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs text-white" disabled={recoveryLoading}>
                  {recoveryLoading ? 'Поиск...' : 'Найти рейсы в дырках'}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-2">
              GPS отсутствовал {(gpsCoverage?.total_days ?? 0) - (gpsCoverage?.covered_days ?? 0)} дней. Пробег можно восстановить из рейсов WB.
            </p>
            {gpsRecovery?.recoveries?.length > 0 && (
              <div className="space-y-2">
                {gpsRecovery.recoveries.map((r: any) => (
                  <div key={r.id} className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-white font-medium">
                        {(r.gap_start||'').slice(5,10).split('-').reverse().join('.')} — {(r.gap_end||'').slice(5,10).split('-').reverse().join('.')}
                      </span>
                      <span className="text-orange-300 font-bold">{parseFloat(r.recovered_km).toLocaleString()} км</span>
                    </div>
                    <div className="text-xs text-slate-400 mb-1">
                      {r.source === 'auto_wb' ? 'WB рейсы' : r.source === 'manual' ? 'Ручной' : r.source}
                    </div>
                    <div className="flex gap-2">
                      {r.is_confirmed ? (
                        <span className="text-green-400 text-xs">Подтверждён</span>
                      ) : (
                        <>
                          <button onClick={async () => {
                            await fetch('/api/gps/recovery/' + r.id + '/confirm', { method: 'POST', headers: { 'x-user-role': localStorage.getItem('userRole') || 'director' } });
                            const r2 = await fetch('/api/gps/recovery?vehicle=' + encodeURIComponent(vehicleNumber) + '&from=' + dateFrom?.split('T')[0] + '&to=' + dateTo?.split('T')[0]);
                            if (r2.ok) setGpsRecovery(await r2.json());
                          }} className="px-2 py-0.5 bg-green-600 hover:bg-green-700 rounded text-xs text-white">Подтвердить</button>
                          <button onClick={async () => {
                            if (!confirm('Удалить?')) return;
                            await fetch('/api/gps/recovery/' + r.id + '/reject', { method: 'POST', headers: { 'x-user-role': localStorage.getItem('userRole') || 'director' } });
                            const r2 = await fetch('/api/gps/recovery?vehicle=' + encodeURIComponent(vehicleNumber) + '&from=' + dateFrom?.split('T')[0] + '&to=' + dateTo?.split('T')[0]);
                            if (r2.ok) setGpsRecovery(await r2.json());
                          }} className="px-2 py-0.5 bg-red-600/50 hover:bg-red-600 rounded text-xs text-white">Отклонить</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-slate-600 text-sm">
                  <span className="text-slate-400">Итого восстановлено:</span>
                  <span className="text-orange-300 font-bold">{gpsRecovery.total_km?.toLocaleString()} км (подтв: {gpsRecovery.confirmed_km?.toLocaleString()} км)</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WB */}
        <WbTripsSection
          wbTrips={wbTrips}
          wbTotals={wbTotals}
          wbGpsMileage={wbGpsMileage}
          wbDays={wbDays}
          excludedIdles={excludedIdles}
          setExcludedIdles={setExcludedIdles}
          totalIdleData={totalIdleData}
          fuelUsedWb={fuelUsedWb}
          avgFuelConsumptionWb={avgFuelConsumptionWb}
          vehicleCards={fuelCards.vehicleCards}
          loadCardTransactions={fuelCards.loadCardTransactions}
          unbindFuelCard={fuelCards.unbindFuelCard}
          setShowCardModal={fuelCards.setShowCardModal}
        />

        {/* РФ */}
        <RfContractsSection
          rfContracts={rfContracts}
          rfPeriods={rfPeriods}
          setRfPeriods={setRfPeriods}
          setRfDateFrom={setRfDateFrom}
          setRfDateTo={setRfDateTo}
          loadRfGps={loadRfGps}
          rfGpsLoading={rfGpsLoading}
          vehicleNumber={vehicleNumber}
          effectiveRfMileage={effectiveRfMileage}
          selectedVehicleType={selectedVehicleType}
          setSelectedVehicleType={setSelectedVehicleType}
          vehicleTypes={vehicleTypes}
          selectedSeason={selectedSeason}
          setSelectedSeason={setSelectedSeason}
          rfRatePerKm={rfRatePerKm}
          setRfRatePerKm={setRfRatePerKm}
          autoRate={autoRate}
          tariffRates={tariffRates}
          avgFuelConsumption={avgFuelConsumption}
          hasRfPeriods={hasRfPeriods}
          rfDriverPay={rfDriverPay}
          fuelRf={fuelRf}
          rfFuelStartTank={rfFuelStartTank}
          setRfFuelStartTank={setRfFuelStartTank}
          rfFuelEndTank={rfFuelEndTank}
          setRfFuelEndTank={setRfFuelEndTank}
          hasFuelSensor={hasFuelSensor}
          vehicleData={vehicleData}
        />

        {/* Топливо */}
        <FuelSection
          loadFuel={loadFuel}
          fuelLoading={fuelLoading}
          vehicleNumber={vehicleNumber}
          dateFrom={dateFrom}
          dateTo={dateTo}
          fuelBySource={fuelBySource}
          vehicleData={vehicleData}
          setVehicleData={setVehicleData}
          fuelTransactions={fuelTransactions}
          editingCards={editingCards}
          setEditingCards={setEditingCards}
          fuelTotal={fuelTotal}
          gpsMileage={gpsMileage}
          wbGpsMileage={wbGpsMileage}
          effectiveRfMileage={effectiveRfMileage}
          fuelWb={fuelWb}
          fuelRf={fuelRf}
          selectedSeason={selectedSeason}
          wbTrips={wbTrips}
          hasFuelSensor={hasFuelSensor}
          sensorLoading={sensorLoading}
          fuelStartTank={fuelStartTank}
          setFuelStartTank={setFuelStartTank}
          fuelEndTank={fuelEndTank}
          setFuelEndTank={setFuelEndTank}
          fuelUsed={fuelUsed}
          showFuelDetails={showFuelDetails}
          setShowFuelDetails={setShowFuelDetails}
          avgFuelConsumptionTotal={avgFuelConsumptionTotal}
          autoRate={autoRate}
          vehicleModel={vehicleModel}
        />

        {/* Суточные РФ */}
        <div className="bg-slate-800 rounded-xl p-4 border border-yellow-500/30">
          <h2 className="font-semibold text-yellow-400 mb-2">Суточные РФ</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <input type="number" value={rfDays} onChange={e => { setRfDays(Number(e.target.value) || 0); setRfDaysManual(true); }} className="w-16 bg-slate-700 text-white rounded px-2 py-2 sm:py-1 border border-slate-600 text-sm text-center" />
              <span className="text-slate-400">дн ×</span>
              <input type="number" value={rfDailyRate} onChange={e => setRfDailyRate(Number(e.target.value) || 0)} className="w-20 bg-slate-700 text-white rounded px-2 py-2 sm:py-1 border border-slate-600 text-sm text-center" />
              <span className="text-slate-400">₽</span>
            </div>
            <span className="text-yellow-400 font-bold text-lg">+{rfDailyPay.toLocaleString()} ₽</span>
          </div>
        </div>

        {/* Премия ТК */}
        {effectiveRfMileage > 0 && (
          <div className={`bg-slate-800 rounded-xl p-4 border ${bonusEnabled ? 'border-emerald-500/30' : 'border-slate-600'}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                  <input type="checkbox" checked={bonusEnabled} onChange={e => setBonusEnabled(e.target.checked)} className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500" />
                  <span className={`font-semibold ${bonusEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>🏆 Премия ТК</span>
                </label>
                {bonusEnabled && (
                  <div className="flex items-center gap-1 text-sm text-slate-400">
                    <span>{effectiveRfMileage.toLocaleString()} км ×</span>
                    <input type="number" step="0.1" value={bonusRate} onChange={e => setBonusRate(parseFloat(e.target.value) || 0)} className="w-14 bg-slate-700 text-white rounded px-2 py-1.5 sm:py-0.5 border border-slate-600 text-center text-xs" />
                    <span>₽</span>
                  </div>
                )}
              </div>
              <span className={`font-bold text-lg ${bonusEnabled ? 'text-emerald-400' : 'text-slate-500 line-through'}`}>+{rfBonus.toLocaleString()} ₽</span>
            </div>
            {!bonusEnabled && <p className="text-xs text-red-400 mt-2">Премия не начислена — требования ТК не выполнены</p>}
          </div>
        )}

        {/* Доп. работы */}
        <div className="bg-slate-800 rounded-xl p-4 border border-green-500/30">
          <h2 className="font-semibold text-green-400 mb-2">📦 Доп. работы</h2>
          {extraWorks.map((w, i) => (
            <div key={i} className="flex justify-between bg-slate-700/50 rounded px-3 py-1 mb-1 text-sm">
              <span>{w.name} × {w.count}</span>
              <div className="flex gap-2">
                <span className="text-green-400">+{(w.count * w.rate).toLocaleString()} ₽</span>
                <button onClick={() => setExtraWorks(extraWorks.filter((_, j) => j !== i))} className="text-slate-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <input list="work-types-list" placeholder="Название работы..." value={workSearch} 
              onChange={e => { 
                setWorkSearch(e.target.value); 
                const found = workTypes.find(t => t.name === e.target.value);
                if (found) setNewWorkRate(found.default_rate);
              }}
              className="flex-1 bg-slate-700 text-white rounded px-3 py-2 sm:py-1 border border-slate-600 text-sm" />
            <datalist id="work-types-list">
              {workTypes.map(t => <option key={t.id} value={t.name}>{t.name} ({t.default_rate}₽)</option>)}
            </datalist>
            <div className="flex gap-2">
              <input type="number" placeholder="Кол" value={newWorkCount} onChange={e => setNewWorkCount(e.target.value ? Number(e.target.value) : "")} className="w-20 sm:w-14 bg-slate-700 text-white rounded px-2 py-2 sm:py-1 border border-slate-600 text-sm text-center flex-1 sm:flex-none" />
              <input type="number" placeholder="₽" value={newWorkRate} onChange={e => setNewWorkRate(e.target.value ? Number(e.target.value) : "")} className="w-20 sm:w-16 bg-slate-700 text-white rounded px-2 py-2 sm:py-1 border border-slate-600 text-sm text-center flex-1 sm:flex-none" />
              <button onClick={addExtraWork} disabled={!workSearch} className="bg-green-600 disabled:bg-slate-600 text-white px-4 sm:px-3 py-2 sm:py-1 rounded min-h-[44px] sm:min-h-0"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">Введите новое название чтобы добавить в справочник</p>
        </div>

        {/* Компенсация расходов (+) */}
        <div className="bg-slate-800 rounded-xl p-4 border border-cyan-500/30">
          <h2 className="font-semibold text-cyan-400 mb-1">🔧 Компенсация расходов</h2>
          <p className="text-xs text-slate-400 mb-2">Возмещение водителю</p>
          {expenses.map((e, i) => (
            <div key={i} className="flex justify-between bg-slate-700/50 rounded px-3 py-1 mb-1 text-sm">
              <span>{e.name}</span>
              <div className="flex gap-2">
                <span className="text-cyan-400">+{e.amount.toLocaleString()} ₽</span>
                <button onClick={() => setExpenses(expenses.filter((_, j) => j !== i))} className="text-slate-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <input list="comp-types-list" placeholder="Название расхода..." value={compSearch}
              onChange={e => { 
                setCompSearch(e.target.value); 
                const found = compTypes.find(t => t.name === e.target.value);
                if (found) setNewExpenseAmount(found.default_rate);
              }}
              className="flex-1 bg-slate-700 text-white rounded px-3 py-2 sm:py-1 border border-slate-600 text-sm" />
            <datalist id="comp-types-list">
              {compTypes.map(t => <option key={t.id} value={t.name}>{t.name} ({t.default_rate}₽)</option>)}
            </datalist>
            <div className="flex gap-2">
              <input type="number" placeholder="₽" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value ? Number(e.target.value) : "")} className="flex-1 sm:w-20 sm:flex-none bg-slate-700 text-white rounded px-3 py-2 sm:py-1 border border-slate-600 text-sm" />
              <button onClick={addExpenseItem} disabled={!compSearch} className="bg-cyan-600 disabled:bg-slate-600 text-white px-4 sm:px-3 py-2 sm:py-1 rounded min-h-[44px] sm:min-h-0"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Выплаты из ведомостей */}
        {(salaryData.payments || []).length > 0 && (() => {
          const daily = salaryData.payments || [];
          const dailyTotal = daily.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          const unlinkPayment = async (paymentId: number) => {
            if (!fullReportId) return;
            await fetch(`/api/salary/register-link/${paymentId}?report_id=${fullReportId}`, {
              method: 'DELETE',
              headers: { 'x-user-role': localStorage.getItem('userRole') || 'director' }
            });
            setSalaryData(prev => ({
              ...prev,
              payments: prev.payments.filter((p: any) => p.id !== paymentId),
              total: prev.total - (daily.find((p: any) => p.id === paymentId)?.amount || 0)
            }));
          };
          return (
          <div className="bg-slate-800 rounded-xl p-4 border border-emerald-500/30">
            <h2 className="font-semibold text-emerald-400 mb-2">📋 Суточные из ведомостей</h2>
            <div className="space-y-1 mb-2">
              {daily.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-slate-700/50 py-1">
                  <a href={"/salary/registers/" + p.register_id} className="text-blue-400 hover:underline">Реестр №{p.register_number || p.tl_number}</a>
                  <span className="text-slate-500 ml-2">({p.register_date?.slice(0, 10)}, {p.organization === 'tl' ? 'ООО ТЛ' : p.organization === 'gp' ? 'ООО ГП' : p.organization})</span>
                  <span className="text-yellow-300 font-bold ml-2">{Number(p.amount).toLocaleString()} ₽</span>
                  <button onClick={() => unlinkPayment(p.id)} className="ml-2 text-slate-500 hover:text-red-400" title="Отвязать">✕</button>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-700">
              <span className="text-slate-400 text-sm">Итого суточные:</span>
              <span className="text-emerald-400 font-bold">{dailyTotal.toLocaleString()} ₽</span>
            </div>
            {totalToPay > 0 && (
              <div className="flex justify-between mt-1">
                <span className="text-slate-400 text-sm">Остаток к выплате:</span>
                <span className={`font-bold ${totalToPay - dailyTotal > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {(totalToPay - dailyTotal).toLocaleString()} ₽
                </span>
              </div>
            )}
          </div>);
        })()}

        {/* Штрафы WB (информационно) */}
        {wbPenalties.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4 border border-yellow-500/30">
            <h2 className="font-semibold text-yellow-400 mb-2">🚨 Штрафы WB</h2>
            <p className="text-xs text-slate-500 mb-2">Информационно — не вычитается из оплаты</p>
            <div className="space-y-1">
              {wbPenalties.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-slate-700/50 py-1">
                  <div className="flex-1">
                    <span className="text-slate-400">#{p.wb_trip_number}</span>
                    <span className="text-slate-500 ml-2">{p.loading_date?.slice(0, 10)}</span>
                    <span className="text-slate-300 ml-2 text-xs">{p.route_name?.slice(0, 40)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.penalty_pending && <span className="text-xs bg-yellow-600/30 text-yellow-400 px-1.5 py-0.5 rounded">На рассмотрении</span>}
                    {p.has_penalty && !p.penalty_pending && <span className="text-xs bg-red-600/30 text-red-400 px-1.5 py-0.5 rounded">Подтверждён</span>}
                    <span className="text-red-400 font-bold">{(Number(p.penalty_amount) || 0).toLocaleString()} ₽</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-700">
              <span className="text-slate-400 text-sm">Итого штрафов: {wbPenalties.length}</span>
              <span className="text-red-400 font-bold">{wbPenalties.reduce((s, p) => s + (Number(p.penalty_amount) || 0), 0).toLocaleString()} ₽</span>
            </div>
          </div>
        )}

        {/* Порожний перегон */}
        <RelocationsBlock
          relocations={relocations}
          setRelocations={setRelocations}
          rfRatePerKm={rfRatePerKm}
          relocationMileage={relocationMileage}
          relocationPay={relocationPay}
        />

        {/* Удержания (-) */}
        <SimpleListBlock
          title="💸 Удержания"
          subtitle="За порчу груза, недостачу и т.д."
          items={deductions}
          setItems={setDeductions}
          color="red"
          namePlaceholder="Причина удержания..."
        />

        {/* Штрафы (-) */}
        <SimpleListBlock
          title="⚠️ Штрафы"
          subtitle="ПДД, весовой контроль и т.д."
          items={fines}
          setItems={setFines}
          color="amber"
          namePlaceholder="Причина штрафа..."
        />

        {/* Выдано (-) */}
        <PaymentsBlock payments={payments} setPayments={setPayments} />

        {/* Итого */}
        <TotalsSummary
          lines={[
            { label: 'WB', amount: Number(wbTotals.driver_rate) || 0, color: 'text-purple-400', prefix: '+' },
            { label: 'Простой', amount: totalIdleData.amount, color: 'text-yellow-400', prefix: '+', detail: `${totalIdleData.paidHours} ч.` },
            { label: 'РФ', amount: rfDriverPay, color: 'text-blue-400', prefix: '+', detail: `${effectiveRfMileage.toLocaleString()}×${rfRatePerKm}` },
            { label: 'Премия ТК', amount: rfBonus, color: 'text-emerald-400', prefix: '+' },
            { label: 'Суточные', amount: rfDailyPay, color: 'text-yellow-400', prefix: '+', detail: `${rfDays}×${rfDailyRate}` },
            { label: '🚛 Порожний', amount: relocationPay, color: 'text-orange-300', prefix: '+', detail: `${relocationMileage}×${rfRatePerKm}` },
            { label: 'Доп. работы', amount: totalExtraWorks, color: 'text-green-400', prefix: '+' },
            { label: 'Компенсация', amount: totalExpenses, color: 'text-cyan-400', prefix: '+' },
            { label: '💸 Удержания', amount: totalDeductions, color: 'text-red-400', prefix: '−' },
            { label: '⚠️ Штрафы', amount: totalFines, color: 'text-red-400', prefix: '−' },
            { label: 'Выдано', amount: totalPayments, color: 'text-orange-400', prefix: '−' },
            { label: '💰 Ведомости', amount: salaryData.total, color: 'text-emerald-400', prefix: '−' },
          ]}
          totalToPay={totalToPay}
          salaryTotal={salaryData.total}
          effectiveRfMileage={effectiveRfMileage}
          earnPerKm={earnPerKm}
          loading={loading}
          validating={validating}
          isDeleted={isDeleted}
          onSave={handleSave}
          onValidate={() => handleValidate()}
          validationResult={validationResult}
        />

        <DriverReportSection
          reportText={reportText}
          comment={comment}
          setComment={setComment}
          printData={{
            driverName, vehicleNumber, dateFrom, dateTo, selectedVehicleType,
            gpsMileage, effectiveRfMileage, fuelRfLiters: fuelRf.liters,
            avgFuelConsumptionTotal: String(avgFuelConsumptionTotal),
            avgFuelConsumption: String(avgFuelConsumption),
            selectedSeason, rfRatePerKm, rfDriverPay, rfBonus,
            rfDailyPay, rfDays, rfDailyRate,
            wbDriverRate: Number(wbTotals.driver_rate) || 0,
            idleAmount: totalIdleData.amount,
            idlePaidHours: totalIdleData.paidHours,
            totalPayments, totalToPay, fuelUsedRf: fuelUsedRf
          }}
        />
      <FuelCardModals
        vehicleNumber={vehicleNumber}
        showCardModal={fuelCards.showCardModal}
        setShowCardModal={fuelCards.setShowCardModal}
        cardSearchQ={fuelCards.cardSearchQ}
        setCardSearchQ={fuelCards.setCardSearchQ}
        searchFuelCards={fuelCards.searchFuelCards}
        cardSearching={fuelCards.cardSearching}
        cardSearchResults={fuelCards.cardSearchResults}
        bindFuelCard={fuelCards.bindFuelCard}
        cardTxModal={fuelCards.cardTxModal}
        setCardTxModal={fuelCards.setCardTxModal}
        cardTransactions={fuelCards.cardTransactions}
      />
    </div>
  );
}
