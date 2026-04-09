"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Truck, User, Save, Loader2, Zap, Plus, Trash2, RefreshCw, Fuel, X as XIcon } from "lucide-react";

import type { Driver, Vehicle, WbTrip, RfContract, FuelBySource, Expense, Payment, ExtraWork, WorkType, ValidationResult, DriverSuggestion, VehicleSuggestion, RfPeriod, Relocation, WbPenalty, SalaryData, GpsCoverage, FuelTransaction, VehicleData, GpsDayMileage, Deduction, Fine, TariffRate, FuelTotals, FuelPeriod, WbTotals } from './types/report';
import { normPlate } from './utils/report-helpers';
import { useFuelCards } from './hooks/useFuelCards';
import { useWbTrips } from './hooks/useWbTrips';
import { useRfContracts } from './hooks/useRfContracts';
import { useFuel } from './hooks/useFuel';
import { FuelCardModals } from './components/FuelCardModals';
import { DriverReportSection } from './components/DriverReportSection';
import { TotalsSummary } from './components/TotalsSummary';
import { SimpleListBlock } from './components/SimpleListBlock';
import { RelocationsBlock } from './components/RelocationsBlock';
import { PaymentsBlock } from './components/PaymentsBlock';
import { WbTripsSection } from './components/WbTripsSection';
import { RfContractsSection } from './components/RfContractsSection';
import { FuelSection } from './components/FuelSection';
import { GpsCoverageBlock } from './components/GpsCoverageBlock';

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

  // Hook parameters (must be declared BEFORE custom hooks to avoid TDZ)
  const [gpsMileage, setGpsMileage] = useState(0);
  const [fuelWb, setFuelWb] = useState({ liters: 0, amount: 0 });
  const [fuelRf, setFuelRf] = useState({ liters: 0, amount: 0 });
  const [bonusEnabled, setBonusEnabled] = useState(true);
  const [bonusRate, setBonusRate] = useState(1); // ₽/км

  // Подсказки водителей/машин
  const [driverSuggestions, setDriverSuggestions] = useState<{driver_name: string; trips: number; source?: string}[]>([]);
  const [vehicleSuggestions, setVehicleSuggestions] = useState<{vehicle_number: string; trips: number}[]>([]);
  // Порожний перегон
  const [relocations, setRelocations] = useState<{from: string; to: string; mileage: number; date: string}[]>([]);
  // Штрафы WB
  const [wbPenalties, setWbPenalties] = useState<{wb_trip_number: string; loading_date: string; route_name: string; has_penalty: boolean; penalty_pending: boolean; penalty_amount: number}[]>([]);
  // Popup прочий пробег
  const [showOtherMileage, setShowOtherMileage] = useState(false);
  // Выплаты из ведомостей
  const [salaryData, setSalaryData] = useState<{payments: {full_name: string; amount: number; register_number: string; register_date: string; tl_number: number; payment_purpose: string}[]; total: number}>({ payments: [], total: 0 });
  // GPS coverage
  const [gpsRecovery, setGpsRecovery] = useState<any>(null);
  const manualRecoveryKm = gpsRecovery?.confirmed_km || 0;
  const [gpsCoverage, setGpsCoverage] = useState<{total_days:number;covered_days:number;coverage_pct:number;days:{date:string;points:number;km:number;status:string}[]}|null>(null);
  const [gpsByDay, setGpsByDay] = useState<{date: string; km: number}[]>([]);
  // Топливо
  // Исключённые простои (индексы рейсов после которых простой)
  // Данные машины (тип, карты, нормы)
  const [vehicleData, setVehicleData] = useState<{id?: number; vehicle_type?: string; fuel_cards?: Record<string, string>; fuel_norm_winter?: number; fuel_norm_summer?: number; fuel_norm_autumn?: number}>({});
  // Остатки топлива в баке (общие)
  // Остатки топлива для периода РФ
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
  // Комментарий
  const [comment, setComment] = useState("");
  // Тип машины и авто-расчёт ставки
  const [vehicleModel, setVehicleModel] = useState("");
  const [ownVehicleNums, setOwnVehicleNums] = useState<Set<string>>(new Set());

  // Fuel cards — isolated hook (prevents dark screen if cards API fails)
  const fuelCards = useFuelCards(vehicleNumber);
  const fuel = useFuel(gpsMileage + manualRecoveryKm);
  const {
    fuelBySource, setFuelBySource, fuelTotal, setFuelTotal, fuelLoading,
    fuelTransactions, setFuelTransactions, showFuelDetails, setShowFuelDetails,
    editingCards, setEditingCards,
    fuelStartTank, setFuelStartTank, fuelEndTank, setFuelEndTank,
    hasFuelSensor, setHasFuelSensor, sensorLoading, setSensorLoading,
    fuelUsed, avgFuelConsumptionTotal,
    loadFuel: loadFuelHook, restoreFuelData, resetFuel,
  } = fuel;

  const loadFuel = () => loadFuelHook({
    vehicleNumber, dateFrom, dateTo,
    isDeleted, isEditMode: !!isEditMode, fullReportId,
    userName: user?.full_name, rfPeriodsLength: rfPeriods.length, setFuelRf,
  });
  const {
    wbTrips, setWbTrips, wbTotals, setWbTotals,
    wbGpsMileage, setWbGpsMileage, wbDays, setWbDays,
    excludedIdles, setExcludedIdles,
    totalIdleData, fuelUsedWb, avgFuelConsumptionWb,
    loadWbTrips, restoreWbData, resetWb, getUniqueDays,
  } = useWbTrips(fuelWb, !!isEditMode);

  const rf = useRfContracts({
    gpsMileage, wbGpsMileage, fuelRf, bonusEnabled, bonusRate,
    reportLoaded, reportLoadedRef, isNew: params.id === 'new',
    manualRecoveryKm,
  });
  const {
    rfContracts, setRfContracts, rfPeriods, setRfPeriods,
    rfDateFrom, setRfDateFrom, rfDateTo, setRfDateTo,
    rfGpsMileage, setRfGpsMileage, rfGpsLoading,
    rfRatePerKm, setRfRatePerKm, rfDaysManual, setRfDaysManual,
    rfDays, setRfDays, rfDailyRate, setRfDailyRate,
    rfFuelStartTank, setRfFuelStartTank, rfFuelEndTank, setRfFuelEndTank,
    selectedVehicleType, setSelectedVehicleType, selectedSeason, setSelectedSeason,
    autoRate, setAutoRate, tariffRates, vehicleTypes, setVehicleTypes,
    hasRfPeriods, hasRfData, effectiveRfMileage,
    rfDriverPay, rfDailyPay, rfBonus, avgFuelConsumption, fuelUsedRf,
    loadRfGps: loadRfGpsHook, restoreRfData, resetRf,
  } = rf;

  const loadRfGps = () => loadRfGpsHook(vehicleNumber, {
    setVehicleData, setFuelRf, setHasFuelSensor,
    setFuelStartTank, setFuelEndTank,
    fuelStartTank, fuelEndTank,
  });
  const { vehicleCards, showCardModal, cardSearchQ, cardSearchResults, cardSearching, cardTxModal, cardTransactions } = fuelCards;
  const { setShowCardModal, setCardSearchQ, setCardTxModal } = fuelCards;
  
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
            // For approved reports: use total_mileage and wb_mileage as fallbacks
            if (r.status === 'approved') {
              if (r.total_mileage && !r.mileage) setGpsMileage(Number(r.total_mileage) || 0);
              if (r.total_mileage) setRfGpsMileage(Number(r.total_mileage) || 0);
            }
            // Загрузка сохранённых периодов РФ и типа машины
            reportLoadedRef.current = true; // Mark loaded before setting state to prevent useEffect race
            // Детали из expense_categories
            const details = r.expense_categories;
            console.log('[LOAD] r.mileage:', r.mileage, 'r.rate_per_km:', r.rate_per_km);
            console.log('[LOAD] details:', details);
            if (details && typeof details === 'object' && !Array.isArray(details)) {
              console.log('[LOAD] rf_mileage:', details.rf_mileage, 'rf_rate:', details.rf_rate);
              if (details.gps_coverage_snapshot) setGpsCoverage(details.gps_coverage_snapshot);
              if (details.bonus_enabled !== undefined) setBonusEnabled(details.bonus_enabled);
              if (details.bonus_rate) setBonusRate(details.bonus_rate);
              if (details.extra_works) setExtraWorks(details.extra_works);
              if (details.expenses) setExpenses(details.expenses);
              if (details.deductions) setDeductions(details.deductions);
              if (details.fines) setFines(details.fines);
              if (details.relocations) setRelocations(details.relocations);
              if (details.wb_penalties) setWbPenalties(details.wb_penalties);
              if (details.payments) setPayments(details.payments);
              if (details.comment) setComment(details.comment);
              // Восстановление WB рейсов
              await restoreWbData(r, details);
              await restoreRfData(r, details);
              restoreFuelData(r, details);
              // Восстановление GPS/WB данных
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

  // GPS recovery — load whenever vehicle and dates are set (both new and edit mode)
  useEffect(() => {
    if (!vehicleNumber || !dateFrom || !dateTo) return;
    const from = dateFrom.split('T')[0];
    const to = dateTo.split('T')[0];
    fetch(`/api/gps/recovery?vehicle=${encodeURIComponent(vehicleNumber)}&from=${from}&to=${to}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setGpsRecovery(data); })
      .catch(e => console.error('[gps-recovery]', e));
  }, [vehicleNumber, dateFrom, dateTo]);

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

  const handleAutoFill = async () => {
    if (!driverName || !dateFrom || !dateTo) { alert("Выберите водителя и даты"); return; }
    
    setAutoLoading(true);
    resetWb();
    resetRf();
    // NOTE: Не сбрасываем rfGpsMileage и rfPeriods — они берутся из сохранённого отчёта
    // setRfGpsMileage(0); setRfDateFrom(""); setRfDateTo("");
    setGpsMileage(0);
    resetFuel();
    
    try {
      const baseParams = new URLSearchParams({ driver: driverName, from: dateFrom, to: dateTo });
      if (vehicleNumber) baseParams.append("vehicle", vehicleNumber);
      
      // WB
      await loadWbTrips({ driver: driverName, from: dateFrom, to: dateTo, vehicle: vehicleNumber || undefined });

      // РФ
      const rfRes = await fetch(`/api/reports/contracts-rf-v2?${baseParams}`);
      const rfData = await rfRes.json();
      if (rfData.contracts && rfData.contracts.length > 0) {
        setRfContracts(rfData.contracts);

        // Авто-заполнение РФ-периода из рейсов 1С (если период пустой)
        const isPeriodsEmpty = rfPeriods.length === 0 || rfPeriods.every(p => !p.from && !p.to);
        if (isPeriodsEmpty && vehicleNumber) {
          const allStarts = rfData.contracts.map((c: any) => new Date(c.loading_date));
          const allEnds = rfData.contracts.map((c: any) => new Date(c.unloading_date));
          const reportFromDate = new Date(dateFrom.split('T')[0] + 'T00:00:00');
          const reportToDate = new Date(dateTo.split('T')[0] + 'T23:59:00');
          // Обрезаем по границам отчёта
          const rfFromDate = new Date(Math.max(Math.min(...allStarts.map((d: Date) => d.getTime())), reportFromDate.getTime()));
          const rfToDate = new Date(Math.min(Math.max(...allEnds.map((d: Date) => d.getTime())), reportToDate.getTime()));
          const rfFromStr = rfFromDate.toISOString().slice(0, 10);
          const rfToStr = rfToDate.toISOString().slice(0, 10);

          // Загружаем GPS пробег за авто-период
          try {
            const rfMileageRes = await fetch(`/api/reports/telematics/mileage?vehicle=${encodeURIComponent(vehicleNumber)}&from=${rfFromStr}&to=${rfToStr}`);
            const rfMileageData = await rfMileageRes.json();
            const rfMil = rfMileageData.mileage || 0;
            setRfPeriods([{ from: rfFromStr, to: rfToStr, mileage: rfMil }]);
            setRfGpsMileage(rfMil);
            setRfDateFrom(rfFromStr);
            setRfDateTo(rfToStr);
            console.log('[autoFill] RF auto-period:', rfFromStr, '→', rfToStr, 'mileage:', rfMil);
          } catch (e) { console.error('[autoFill] RF auto-period error:', e); }

          // Загружаем топливо за авто-период
          try {
            const rfFuelRes = await fetch(`/api/reports/fuel/detail?vehicle=${encodeURIComponent(vehicleNumber)}&from=${rfFromStr}&to=${rfToStr}`);
            const rfFuelData = await rfFuelRes.json();
            if (!rfFuelData.error) {
              setFuelRf({ liters: Number(rfFuelData.total?.liters) || 0, amount: Number(rfFuelData.total?.amount) || 0 });
            }
          } catch (e) { console.error('[autoFill] RF fuel error:', e); }
        }
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

        // GPS recovery data — now loaded via dedicated useEffect (works in both new and edit mode)

    // Загрузка выплат из ведомостей (через новый эндпоинт salary-items)
    if (isEditMode && fullReportId) {
      try {
        const salRes = await fetch(`/api/reports/${fullReportId}/salary-items`);
        const salData = await salRes.json();
        setSalaryData({ payments: salData?.payments || [], total: salData?.total || 0 });
      } catch (e) { console.error('[salary-items]', e); }
    } else if (driverName) {
      try {
        const salUrl = `/api/salary/registers/by-driver?driver=${encodeURIComponent(driverName)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`;
        const salRes = await fetch(salUrl);
        const salData = await salRes.json();
        setSalaryData({ payments: salData?.payments || [], total: salData?.total || 0 });
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

  const totalDeductions = deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0); // Удержания (−)
  const totalFines = fines.reduce((sum, f) => sum + (Number(f.amount) || 0), 0); // Штрафы (−)
  const relocationMileage = relocations.reduce((sum, r) => sum + (Number(r.mileage) || 0), 0);
  const relocationPay = Math.round(relocationMileage * (rfRatePerKm || 0)); // Порожний по тарифу РФ
  const totalDriverPay = (Number(wbTotals.driver_rate) || 0) + rfDriverPay + rfDailyPay + rfBonus + (totalIdleData.amount || 0) + relocationPay;
  const dailyVedTotal = (salaryData?.payments || []).filter((p: any) => (p.register_type || '').toLowerCase().includes('суточн')).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const totalToPay = totalDriverPay + totalExpenses + totalExtraWorks - totalPayments - totalDeductions - totalFines - dailyVedTotal;
  
  const earnPerKm = effectiveRfMileage > 0 && !isNaN(totalToPay) ? (totalToPay / effectiveRfMileage).toFixed(2) : "0";

  // Auto-load salary-items on page open (not just on "Загрузить")
  useEffect(() => {
    const rid = fullReportId || reportId;
    if (!rid || rid === 'new') return;
    fetch('/api/reports/' + rid + '/salary-items')
      .then(r => r.json())
      .then(data => {
        if (data.payments) {
          setSalaryData({ payments: data.payments, total: data.total || 0 });
        }
      })
      .catch(e => console.error('[salary-items onload]', e));
  }, [fullReportId, reportId]);
  
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
Пробег: ${(gpsMileage + manualRecoveryKm).toLocaleString("ru-RU")} км${manualRecoveryKm > 0 ? ` (GPS: ${gpsMileage.toLocaleString("ru-RU")} + ручной: ${manualRecoveryKm.toLocaleString("ru-RU")})` : ''}${effectiveRfMileage > 0 ? ` | ВБ: ${Math.max(0, gpsMileage - effectiveRfMileage).toLocaleString("ru-RU")} км | РФ: ${effectiveRfMileage.toLocaleString("ru-RU")} км` : ''}
Расход: *${avgFuelConsumptionTotal}* л/100км${Number(avgFuelConsumptionWb) > 0 ? ` | ВБ: ${avgFuelConsumptionWb}` : ''}${Number(avgFuelConsumption) > 0 ? ` | РФ: ${avgFuelConsumption}` : ''}
Вид тарифа: ${getSeason()}
Тариф: *${rfRatePerKm}* ₽/км
-------------
*Начислено:*
${rfDriverPay > 0 ? `Начисление за км: ${rfDriverPay.toLocaleString("ru-RU")} ₽\n` : ""}${rfBonus > 0 ? `Премия ТК (${effectiveRfMileage}×${bonusRate}): ${rfBonus.toLocaleString("ru-RU")} ₽\n` : ""}${rfDailyPay > 0 ? `Суточные (${rfDays} дн × ${rfDailyRate}): ${rfDailyPay.toLocaleString("ru-RU")} ₽\n` : ""}${wbTotals.driver_rate > 0 ? `WB рейсы: ${wbTotals.driver_rate.toLocaleString("ru-RU")} ₽\n` : ""}${totalIdleData.amount > 0 ? `Простой (${totalIdleData.paidHours} ч.): ${totalIdleData.amount.toLocaleString("ru-RU")} ₽\n` : ""}${wbPenalties.length > 0 ? `🚨 Штрафы WB (инфо):\n${wbPenalties.map(p => `  #${p.wb_trip_number} ${p.loading_date?.slice(0,10)}: ${(Number(p.penalty_amount)||0).toLocaleString("ru-RU")} ₽${p.penalty_pending ? ' (на рассм.)' : ''}`).join("\n")}\n  Итого: ${wbPenalties.reduce((s,p)=>s+(Number(p.penalty_amount)||0),0).toLocaleString("ru-RU")} ₽\n` : ""}${relocations.length > 0 ? `🚛 Порожний перегон:\n${relocations.map(r => `  ${r.from} → ${r.to}: ${r.mileage} км (${r.date})`).join("\n")}\n  Итого: ${relocationMileage} км × ${rfRatePerKm} = ${relocationPay.toLocaleString("ru-RU")} ₽\n` : ""}${extraWorks.map(w => `${w.name} (${w.count}×${w.rate}): ${(w.count*w.rate).toLocaleString("ru-RU")} ₽`).join("\n")}${extraWorks.length > 0 ? "\n" : ""}${expenses.map(e => `${e.name}: +${(Number(e.amount) || 0).toLocaleString("ru-RU")} ₽`).join("\n")}${expenses.length > 0 ? "\n" : ""}${deductions.map(d => `💸 Удержание "${d.name}": -${(Number(d.amount) || 0).toLocaleString("ru-RU")} ₽`).join("\n")}${deductions.length > 0 ? "\n" : ""}${fines.map(f => `⚠️ Штраф "${f.name}": -${(Number(f.amount) || 0).toLocaleString("ru-RU")} ₽`).join("\n")}${fines.length > 0 ? "\n" : ""}${payments.map(p => `${p.type === "advance" ? "Аванс" : p.type === "daily" ? "Суточные выданные" : p.description || "Выдано"}: -${(Number(p.amount) || 0).toLocaleString("ru-RU")} ₽`).join("\n")}${payments.length > 0 ? "\n" : ""}-------------
*Всего начислено: ${totalToPay.toLocaleString("ru-RU")} ₽*
*Заработок за км: ${earnPerKm} ₽/км*
${comment ? `Комментарий: ${comment}` : ""}`;
  
  // Отвязка суточной от отчёта
  const unlinkPayment = async (paymentId: string) => {
    if (!confirm('Отвязать эту суточную от отчёта?')) return;
    try {
      const resp = await fetch('/api/reports/register-link/' + paymentId + '?report_id=' + (fullReportId || reportId), {
        method: 'DELETE'
      });
      const result = await resp.json();
      if (!resp.ok) { alert('Ошибка: ' + (result.error || resp.status)); return; }
      // Reload salaryData
      if (fullReportId) {
        const salRes = await fetch('/api/reports/' + fullReportId + '/salary-items');
        const salData = await salRes.json();
        setSalaryData({ payments: salData?.payments || [], total: salData?.total || 0 });
      } else if (driverName) {
        const salUrl = '/api/salary/registers/by-driver?driver=' + encodeURIComponent(driverName) + '&from=' + (dateFrom||'').split('T')[0] + '&to=' + (dateTo||'').split('T')[0];
        const salRes = await fetch(salUrl);
        const salData = await salRes.json();
        setSalaryData({ payments: salData?.payments || [], total: salData?.total || 0 });
      }
    } catch (e) { console.error('unlinkPayment:', e); alert('Ошибка отвязки'); }
  };

  // Загрузка выплат из зарплатных ведомостей
  const loadSalaryPayments = async () => {
    if (!driverName) return;
    try {
      // Определяем период (от первого до последнего дня отчёта)
      const fromDate = dateFrom?.split('T')[0] || (rfPeriods && rfPeriods.length > 0 ? rfPeriods[0]?.from?.split('T')[0] : undefined);
      const toDate = dateTo?.split('T')[0] || (rfPeriods && rfPeriods.length > 0 ? rfPeriods[rfPeriods.length-1]?.to?.split('T')[0] : undefined);
      
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
        alert(`Загружено ${data.payments.length} выплат на сумму ${(data.total || 0).toLocaleString()} ₽`);
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
          comment: comment,
          report_total: totalToPay,
          report_total_details: {
            wb: Number(wbTotals.driver_rate) || 0,
            idle: totalIdleData.amount || 0,
            rf: rfDriverPay || 0,
            rf_bonus: rfBonus || 0,
            daily_accrued: rfDailyPay || 0,
            extra_work: totalExtraWorks || 0,
            compensation: totalExpenses || 0,
            relocation: relocationPay || 0,
            deductions: totalDeductions || 0,
            fines: totalFines || 0,
            daily_ved: -dailyVedTotal,
            payments: -totalPayments,
            total: totalToPay
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        // Полная очистка формы
        setDriverName(""); setDriverSearch(""); setVehicleNumber(""); setVehicleSearch("");
        setDateFrom(""); setDateTo(""); setDriverVehicles([]);
        resetWb();
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
              <input type="datetime-local" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setTimeFrom(e.target.value.includes("T") ? e.target.value.slice(11, 16) : "00:00"); }} className="w-full bg-slate-700 text-white rounded-lg px-2 py-1.5 border border-slate-600 text-xs" />
            </div>
            <div>
              <label className="text-xs text-slate-500">По</label>
              <input type="datetime-local" value={dateTo} onChange={e => { setDateTo(e.target.value); setTimeTo(e.target.value.includes("T") ? e.target.value.slice(11, 16) : "23:59"); }} className="w-full bg-slate-700 text-white rounded-lg px-2 py-1.5 border border-slate-600 text-xs" />
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
              <div className="text-2xl sm:text-3xl font-bold text-white">{(gpsMileage + manualRecoveryKm).toLocaleString()} км</div>
              {manualRecoveryKm > 0 && (
                <div className="text-xs text-purple-400 mt-1">GPS: {gpsMileage.toLocaleString()} + 🟣 ручной: {manualRecoveryKm.toLocaleString()} км</div>
              )}
            </div>
            <div className={`grid ${manualRecoveryKm > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-2 text-center text-sm`}>
              <div><span className="text-purple-400 font-bold">{wbGpsMileage.toLocaleString()}</span><div className="text-slate-500 text-xs">WB</div></div>
              <div><span className="text-orange-400 font-bold">{effectiveRfMileage.toLocaleString()}</span><div className="text-slate-500 text-xs">РФ</div></div>
              {manualRecoveryKm > 0 && (
                <div><span className="text-fuchsia-400 font-bold">{manualRecoveryKm.toLocaleString()}</span><div className="text-slate-500 text-xs">🟣 Ручной</div></div>
              )}
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
        <GpsCoverageBlock
          vehicleNumber={vehicleNumber}
          dateFrom={dateFrom}
          dateTo={dateTo}
          gpsCoverage={gpsCoverage}
          setGpsCoverage={setGpsCoverage}
          gpsRecovery={gpsRecovery}
          setGpsRecovery={setGpsRecovery}
        />

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

        {/* Топливные карты — отдельный блок */}
        {(fuelCards.vehicleCards.length > 0 || true) && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-cyan-400">🔋 Топливные карты</h2>
              <button onClick={() => fuelCards.setShowCardModal(true)} className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded">+ Добавить карту</button>
            </div>
            {fuelCards.vehicleCards.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {fuelCards.vehicleCards.map((c: any, i: number) => (
                  <span key={i} className="bg-slate-700/50 px-2 py-0.5 rounded cursor-pointer hover:bg-slate-600/50 inline-flex items-center gap-1 text-xs"
                    onClick={() => fuelCards.loadCardTransactions(c.card_number, c.source)}
                    title={`${c.tx_count} запр., ${Number(c.total_liters||0).toFixed(0)} л`}>
                    🔋 {c.source} ****{c.card_number.slice(-4)} ({Number(c.total_liters||0).toFixed(0)}л)
                    <button onClick={(e: any) => {e.stopPropagation(); fuelCards.unbindFuelCard(c.card_number, c.source);}} className="ml-1 text-red-400 hover:text-red-300 text-[10px]">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Нет привязанных карт</p>
            )}
          </div>
        )}

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
          manualRecoveryKm={manualRecoveryKm}
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
                <button onClick={() => setExtraWorks(prev => prev.filter((_, j) => j !== i))} className="text-slate-500"><Trash2 className="w-3 h-3" /></button>
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

        {/* Из ведомостей — все выплаты за период (read-only) */}
        {(salaryData.payments || []).filter((p: any) => (p.register_type || '').toLowerCase().includes('суточн')).length > 0 && (() => {
          const all = salaryData.payments || [];
          const allTotal = all.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          const dailyItems = all.filter((p: any) => (p.register_type || '').toLowerCase().includes('суточн'));
          const salaryItems = all.filter((p: any) => !(p.register_type || '').toLowerCase().includes('суточн'));
          const dailyTotal = dailyItems.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          const salaryTotal = salaryItems.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          return (
          <div className="bg-slate-800 rounded-xl p-4 border border-emerald-500/30">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-emerald-400">📋 Суточные из ведомостей</h2>
              <span className="text-xs text-slate-500">{dateFrom?.slice(0,10)} — {dateTo?.slice(0,10)}</span>
            </div>
            <div className="space-y-1 mb-2">
              {dailyItems.map((p: any, i: number) => (
                <div key={p.id || i} className="flex items-center justify-between text-sm border-b border-slate-700/50 py-1.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {(() => { const d = p.register_date?.slice(0,10); const inPeriod = d >= (dateFrom?.slice(0,10)||'') && d <= (dateTo?.slice(0,10)||''); return p.linked_to_this ? (inPeriod ? <span className="text-emerald-400 text-xs" title="Привязан к отчёту">✓</span> : <span className="text-amber-400 text-xs" title="Вне периода отчёта — проверьте привязку">⚠️</span>) : null; })()}
                    <a href={"/salary/registers/" + p.register_id} className="text-blue-400 hover:underline truncate">Реестр №{p.register_number || p.tl_number}</a>
                    <span className="text-slate-500 text-xs shrink-0">{p.register_date?.slice(0, 10)}</span>
                    {p.register_type && <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${(p.register_type || '').toLowerCase().includes('суточн') ? 'bg-yellow-600/20 text-yellow-400' : 'bg-blue-600/20 text-blue-400'}`}>{p.register_type}</span>}
                    <span className="text-slate-500 text-xs shrink-0">{p.organization === 'tl' ? 'ООО ТЛ' : p.organization === 'gp' ? 'ООО ГП' : p.organization || ''}</span>
                  </div>
                  <span className="text-yellow-300 font-bold ml-2 shrink-0">{(Number(p.amount) || 0).toLocaleString()} ₽</span>
                  <button onClick={() => unlinkPayment(p.id)} className="ml-1 text-red-400 hover:text-red-300 text-xs shrink-0" title="Отвязать">×</button>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-2 pt-2 border-t border-slate-700">
              <span className="text-slate-400 text-sm">Итого суточных:</span>
              <span className="text-emerald-400 font-bold">{dailyTotal.toLocaleString()} ₽</span>
            </div>

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
            { label: '📋 Суточные (вед.)', amount: (salaryData.payments||[]).filter((p: any) => (p.register_type||'').toLowerCase().includes('суточн')).reduce((s: number, p: any) => s + Number(p.amount||0), 0), color: 'text-yellow-300' as const, prefix: '−' as const },
          ]}
          totalToPay={totalToPay}
          salaryTotal={(salaryData.payments||[]).filter((p: any) => (p.register_type||'').toLowerCase().includes('суточн')).reduce((s: number, p: any) => s + Number(p.amount||0), 0)}
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
