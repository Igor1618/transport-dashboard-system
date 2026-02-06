"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Truck, User, Save, Loader2, Zap, Plus, Trash2, RefreshCw, Fuel } from "lucide-react";

interface Driver { name: string; }
interface Vehicle { number: string; trips?: number; vehicle_type?: string; }
interface WbTrip { loading_date: string; loading_time?: string; unloading_date?: string; unloading_time?: string; route_name: string; driver_rate: number; }
interface RfContract { number: string; date: string; route: string; loading_date?: string; unloading_date?: string; amount?: string; }
interface FuelBySource { source: string; liters: number; amount: number; count: number; }
interface Expense { name: string; amount: number; }
interface Payment { date: string; amount: number; type: string; description: string; }
interface ExtraWork { name: string; count: number; rate: number; }
interface WorkType { id: number; name: string; category: string; default_rate: number; }

export default function NewReportPage() {
  const params = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const reportId = params?.id as string | undefined;
  const isEditMode = reportId && reportId !== 'new';
  const [reportLoaded, setReportLoaded] = useState(false); // Флаг: отчёт загружен из БД, блокируем авто-расчёты
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pageLoading, setPageLoading] = useState(!!isEditMode);
  
  const [driverSearch, setDriverSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showDriverList, setShowDriverList] = useState(false);
  const [showVehicleList, setShowVehicleList] = useState(false);
  const [driverVehicles, setDriverVehicles] = useState<Vehicle[]>([]);
  
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  // Подсказки водителей/машин
  const [driverSuggestions, setDriverSuggestions] = useState<{driver_name: string; trips: number}[]>([]);
  const [vehicleSuggestions, setVehicleSuggestions] = useState<{vehicle_number: string; trips: number}[]>([]);
  
  const [wbTrips, setWbTrips] = useState<WbTrip[]>([]);
  const [wbTotals, setWbTotals] = useState({count: 0, driver_rate: 0});
  const [wbGpsMileage, setWbGpsMileage] = useState(0);
  const [wbDays, setWbDays] = useState(0);
  
  const [rfContracts, setRfContracts] = useState<RfContract[]>([]);
  const [rfPeriods, setRfPeriods] = useState<{from: string; to: string; mileage: number}[]>([{from: "", to: "", mileage: 0}]);
  const [rfDateFrom, setRfDateFrom] = useState("");
  const [rfDateTo, setRfDateTo] = useState("");
  const [rfGpsMileage, setRfGpsMileage] = useState(0);
  const [rfGpsLoading, setRfGpsLoading] = useState(false);
  const [rfRatePerKm, setRfRatePerKm] = useState(7.0);
  
  const [gpsMileage, setGpsMileage] = useState(0);
  const [gpsByDay, setGpsByDay] = useState<{date: string; km: number}[]>([]);
  
  // Топливо
  const [fuelBySource, setFuelBySource] = useState<FuelBySource[]>([]);
  const [fuelTotal, setFuelTotal] = useState({ liters: 0, amount: 0, count: 0 });
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelTransactions, setFuelTransactions] = useState<{date: string; source: string; liters: number; amount: number; card_number?: string}[]>([]);
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
  const [newPaymentDate, setNewPaymentDate] = useState("");
  const [newPaymentAmount, setNewPaymentAmount] = useState<number | "">("");
  const [newPaymentType, setNewPaymentType] = useState("advance");
  const [newPaymentDesc, setNewPaymentDesc] = useState("");
  
  // Доп. работы
  const [extraWorks, setExtraWorks] = useState<ExtraWork[]>([]);
  const [newWorkName, setNewWorkName] = useState("");
  const [newWorkCount, setNewWorkCount] = useState<number | "">(1);
  const [newWorkRate, setNewWorkRate] = useState<number | "">(0);
  
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

  useEffect(() => {
    fetch("/api/reports/drivers").then(r => r.json()).then(setDrivers).catch(() => {});
    fetch("/api/reports/vehicles").then(r => r.json()).then(setAllVehicles).catch(() => {});
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
      fetch(`/rest/v1/driver_reports?id=eq.${reportId}`)
        .then(r => r.json())
        .then(async (data) => {
          if (data?.[0]) {
            const r = data[0];
            setDriverName(r.driver_name || ""); setDriverSearch(r.driver_name || "");
            setVehicleNumber(r.vehicle_number || ""); setVehicleSearch(r.vehicle_number || "");
            // Конвертируем даты в формат datetime-local (добавляем время)
            const dfrom = r.date_from ? `${r.date_from}T00:00` : "";
            const dto = r.date_to ? `${r.date_to}T23:59` : "";
            setDateFrom(dfrom); setDateTo(dto);
            setRfDateFrom(dfrom); setRfDateTo(dto);
            setRfGpsMileage(r.mileage || 0);
            setFuelTotal({ liters: r.fuel_quantity || 0, amount: r.fuel_amount || 0, count: 0 });
            setFuelStartTank(r.fuel_start || ""); setFuelEndTank(r.fuel_end || "");
            // Загрузка сохранённых периодов РФ и типа машины
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
              if (details.rf_days) { setRfDays(details.rf_days); setRfDaysManual(true); }
              if (details.rf_daily_rate) setRfDailyRate(details.rf_daily_rate);
              if (details.rf_fuel_start) setRfFuelStartTank(details.rf_fuel_start);
              if (details.rf_fuel_end) setRfFuelEndTank(details.rf_fuel_end);
              if (details.fuel_rf) setFuelRf(details.fuel_rf);
              if (details.wb_totals) setWbTotals(details.wb_totals);
              if (details.bonus_enabled !== undefined) setBonusEnabled(details.bonus_enabled);
              if (details.bonus_rate) setBonusRate(details.bonus_rate);
              if (details.extra_works) setExtraWorks(details.extra_works);
              if (details.expenses) setExpenses(details.expenses);
              if (details.payments) setPayments(details.payments);
              if (details.comment) setComment(details.comment);
              // Восстановление WB рейсов
              if (details.wb_trips_data && Array.isArray(details.wb_trips_data)) {
                setWbTrips(details.wb_trips_data);
                console.log('[LOAD] wb_trips_data:', details.wb_trips_data.length, 'trips');
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
            // НЕ перезагружаем данные для существующего отчёта — используем сохранённые!
            // Загружаем только данные машины для норм (если vehicle_type не сохранён)
            if (r.vehicle_number && !r.vehicle_type) {
              try {
                const vRes = await fetch(`/api/vehicles/by-number?number=${encodeURIComponent(r.vehicle_number)}`);
                const vData = await vRes.json();
                if (vData) setVehicleData(vData);
              } catch (e) { console.error("VehicleData load error:", e); }
            }
          }
        })
        .catch(console.error)
        .finally(() => { setPageLoading(false); setReportLoaded(true); });
    }
  }, [isEditMode, reportId]);
  
  // Расчёт дней командировки РФ (все дни в периоде)
  // Автоподсчёт дней НЕ перезаписывает если уже загружено из отчёта
  const [rfDaysManual, setRfDaysManual] = useState(false); // Флаг: дни заданы вручную/из БД
  useEffect(() => {
    if (rfDaysManual || reportLoaded) return; // Не перезаписываем если уже установлено или отчёт загружен
    if (rfDateFrom && rfDateTo) {
      const from = new Date(rfDateFrom);
      const to = new Date(rfDateTo);
      const diffTime = to.getTime() - from.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 чтобы включить оба дня
      setRfDays(diffDays > 0 ? diffDays : 0);
    } else if (rfContracts.length > 0) {
      // Fallback: по датам погрузки/выгрузки если период не задан
      const allDates = rfContracts.flatMap(c => [c.loading_date, c.unloading_date, c.date].filter(Boolean)).map(d => d!.slice(0,10)).sort();
      const from = new Date(allDates[0]);
      const to = new Date(allDates[allDates.length - 1]);
      const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setRfDays(diffDays > 0 ? diffDays : 0);
    } else {
      setRfDays(0);
    }
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
        setDriverVehicles(Array.isArray(data) ? data : []);
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
        .then(data => setDriverSuggestions(data.drivers || []))
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

  const shortDate = (d: string) => { const p = d.slice(5,10).split('-'); return `${p[1]}.${p[0]}`; };

  // Расчёт общего простоя WB (с учётом исключений)
  const totalIdleData = useMemo(() => {
    let totalIdleHours = 0;
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
          totalIdleAmount += Math.max(0, idleHours - 8) * 100;
        }
      }
    }
    return { hours: totalIdleHours, amount: totalIdleAmount };
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
      // Передаём полное время если есть, иначе только дату
      const fromParam = p.from.includes('T') ? p.from.replace('T', 'T') : p.from.split('T')[0];
      const toParam = p.to.includes('T') ? p.to.replace('T', 'T') : p.to.split('T')[0];
      const fromDate = p.from.split('T')[0]; // для топлива — только дата
      const toDate = p.to.split('T')[0];
      
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
        const fuelUrl = `/api/reports/fuel/detail?vehicle=${encodeURIComponent(vehicleNumber)}&from=${fromDate}&to=${toDate}`;
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
        if (startData.hasSensor && startData.level > 0 && !rfFuelStartTank) {
          setRfFuelStartTank(startData.level);
        }
        if (!startData.hasSensor && !rfFuelStartTank) {
          setHasFuelSensor(false);
        }
        if (endData.hasSensor && endData.level > 0 && !rfFuelEndTank) {
          setRfFuelEndTank(endData.level);
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
    if (!vehicleNumber || !dateFrom || !dateTo) return;
    setFuelLoading(true);
    try {
      const [detailRes, transRes] = await Promise.all([
        fetch(`/api/reports/fuel/detail?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`),
        fetch(`/api/reports/fuel/transactions?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`)
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
    setFuelLoading(false);
  };

  const handleAutoFill = async () => {
    if (!driverName || !dateFrom || !dateTo) { alert("Выберите водителя и даты"); return; }
    
    setAutoLoading(true);
    setWbTrips([]); setWbTotals({count: 0, driver_rate: 0}); setWbGpsMileage(0); setWbDays(0);
    setRfContracts([]); setRfGpsMileage(0); setRfDateFrom(""); setRfDateTo("");
    setGpsMileage(0);
    setFuelBySource([]); setFuelTotal({ liters: 0, amount: 0, count: 0 });
    
    try {
      const baseParams = new URLSearchParams({ driver: driverName, from: dateFrom, to: dateTo });
      if (vehicleNumber) baseParams.append("vehicle", vehicleNumber);
      
      // WB
      const wbRes = await fetch(`/api/reports/trips-detail-v2?${baseParams}`);
      const wbData = await wbRes.json();
      
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
        const fuelRes = await fetch(`/api/reports/fuel/detail?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`);
        const fuelData = await fuelRes.json();
        setFuelBySource(fuelData.by_source || []);
        setFuelTotal(fuelData.total || { liters: 0, amount: 0, count: 0 });
      }
    } catch (err) { console.error(err); }
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
  const rfDriverPay = Math.round((rfGpsMileage || 0) * (rfRatePerKm || 0));
  const rfDailyPay = (rfDays || 0) * (rfDailyRate || 0); // Суточные РФ (+)
  const rfBonus = bonusEnabled ? Math.round((rfGpsMileage || 0) * (bonusRate || 0)) : 0; // Премия ТК (+)
  const totalDriverPay = (Number(wbTotals.driver_rate) || 0) + rfDriverPay + rfDailyPay + rfBonus + (totalIdleData.amount || 0);
  const totalToPay = totalDriverPay + totalExpenses + totalExtraWorks - totalPayments;
  
  // Средний расход топлива (с учётом остатков в баке)
  const fuelUsed = fuelTotal.liters + (Number(fuelStartTank) || 0) - (Number(fuelEndTank) || 0);
  // Расход для РФ считаем только по топливу за период РФ!
  const fuelUsedRf = fuelRf.liters || Number(fuelTotal.liters) || 0;
  const mileageForConsumption = rfGpsMileage > 0 ? rfGpsMileage : gpsMileage;
  const avgFuelConsumption = mileageForConsumption > 0 && fuelUsedRf > 0 ? (fuelUsedRf / mileageForConsumption * 100).toFixed(2) : "0";
  // Расход WB
  const fuelUsedWb = fuelWb.liters;
  const avgFuelConsumptionWb = wbGpsMileage > 0 && fuelUsedWb > 0 ? (fuelUsedWb / wbGpsMileage * 100).toFixed(2) : "0";
  const earnPerKm = rfGpsMileage > 0 && !isNaN(totalToPay) ? (totalToPay / rfGpsMileage).toFixed(2) : "0";
  
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
    
    // Суммируем топливо по периодам
    let wbL = 0, wbA = 0, rfL = 0, rfA = 0;
    fuelTransactions.forEach(t => {
      const date = t.date?.slice(0, 10);
      const liters = Number(t.liters) || 0;
      const amount = Number(t.amount) || 0;
      if (wbDates.has(date)) { wbL += liters; wbA += amount; }
      if (rfDatesSet.has(date)) { rfL += liters; rfA += amount; }
    });
    console.log('[fuelCalc] rfDates:', Array.from(rfDatesSet).slice(0, 5), 'rfL:', rfL, 'rfA:', rfA);
    setFuelWb({ liters: wbL, amount: wbA });
    setFuelRf({ liters: rfL, amount: rfA });
  }, [fuelTransactions, wbTrips, rfPeriods]);
  
  // Авто-расчёт ставки по расходу топлива из таблицы тарифов (с учётом остатков)
  useEffect(() => {
    const rfFuelUsedCalc = fuelRf.liters + (Number(rfFuelStartTank) || 0) - (Number(rfFuelEndTank) || 0);
    if (selectedVehicleType && selectedSeason && rfFuelUsedCalc > 0 && rfGpsMileage > 0) {
      const consumption = rfFuelUsedCalc / rfGpsMileage * 100;
      console.log('[autoRate] consumption:', consumption, 'type:', selectedVehicleType, 'season:', selectedSeason, 'fuel:', rfFuelUsedCalc);
      fetch(`/api/tariffs/calculate?vehicle_type=${encodeURIComponent(selectedVehicleType)}&season=${encodeURIComponent(selectedSeason)}&consumption=${consumption}`)
        .then(r => r.json())
        .then(data => {
          console.log('[autoRate] response:', data);
          if (data.rate) {
            setAutoRate(data.rate);
            setRfRatePerKm(data.rate); // Автоматически устанавливаем ставку
          }
        })
        .catch((e) => console.error('[autoRate] error:', e));
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
Пробег: ${rfGpsMileage.toLocaleString("ru-RU")} км
Средний расход: *${avgFuelConsumption}* л/100км
Вид тарифа: ${getSeason()}
Тариф: *${rfRatePerKm}* ₽/км
-------------
*Начислено:*
${rfDriverPay > 0 ? `Начисление за км: ${rfDriverPay.toLocaleString("ru-RU")} ₽\n` : ""}${rfBonus > 0 ? `Премия ТК (${rfGpsMileage}×${bonusRate}): ${rfBonus.toLocaleString("ru-RU")} ₽\n` : ""}${rfDailyPay > 0 ? `Суточные (${rfDays} дн × ${rfDailyRate}): ${rfDailyPay.toLocaleString("ru-RU")} ₽\n` : ""}${wbTotals.driver_rate > 0 ? `WB рейсы: ${wbTotals.driver_rate.toLocaleString("ru-RU")} ₽\n` : ""}${totalIdleData.amount > 0 ? `Простой (${totalIdleData.hours} ч.): ${totalIdleData.amount.toLocaleString("ru-RU")} ₽\n` : ""}${extraWorks.map(w => `${w.name} (${w.count}×${w.rate}): ${(w.count*w.rate).toLocaleString("ru-RU")} ₽`).join("\n")}${extraWorks.length > 0 ? "\n" : ""}${expenses.map(e => `${e.name}: +${e.amount.toLocaleString("ru-RU")} ₽`).join("\n")}${expenses.length > 0 ? "\n" : ""}${payments.map(p => `${p.type === "advance" ? "Аванс" : p.type === "daily" ? "Суточные выданные" : p.description || "Выдано"}: -${p.amount.toLocaleString("ru-RU")} ₽`).join("\n")}${payments.length > 0 ? "\n" : ""}-------------
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
          description: `Реестр №${p.register_number}`
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
  const addPayment = () => {
    if (newPaymentDate && newPaymentAmount) {
      setPayments([...payments, { date: newPaymentDate, amount: Number(newPaymentAmount), type: newPaymentType, description: newPaymentDesc }]);
      setNewPaymentDate(""); setNewPaymentAmount(""); setNewPaymentDesc("");
    }
  };
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
  const paymentTypeLabel = (t: string) => ({ daily: "Суточные", advance: "Аванс", card: "На карту", cash: "На руки", salary: "Ведомость" }[t] || t);

  const handleSave = async () => {
    if (!driverName || !dateFrom || !dateTo) { alert("Заполните поля"); return; }
    setLoading(true);
    try {
      const url = isEditMode ? "/api/reports/update" : "/api/reports/save";
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEditMode ? reportId : undefined, // Для update
          user_name: user?.full_name || 'Неизвестно',
          driver_name: driverName, 
          vehicle_number: vehicleNumber,
          date_from: dateFrom, 
          date_to: dateTo, 
          mileage: rfGpsMileage || gpsMileage,
          fuel_quantity: fuelTotal.liters || 0, 
          fuel_amount: fuelTotal.amount || 0,
          fuel_start: fuelStartTank || 0,
          fuel_end: fuelEndTank || 0,
          total_expenses: totalExpenses + totalExtraWorks, // Компенсация + доп.работы
          driver_accruals: totalToPay, // Итого к выплате
          driver_payments: totalPayments, // Выдано
          // Периоды РФ и тип машины
          rf_periods: rfPeriods,
          vehicle_type: selectedVehicleType,
          season: selectedSeason,
          rate_per_km: rfRatePerKm,
          // Доп. данные для отчёта
          rf_mileage: rfGpsMileage,
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
          fuel_by_source: fuelBySource, // Топливо по источникам
          wb_gps_mileage: wbGpsMileage,
          wb_days: wbDays,
          gps_mileage: gpsMileage,
          extra_works: extraWorks,
          expenses: expenses,
          payments: payments,
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
        alert(`Отчёт #${data.number || data.id?.slice(0,8) || 'OK'} сохранён!`);
        window.location.href = `/reports`;
      } else { alert("Ошибка: " + data.error); }
    } catch (err) { alert("Ошибка"); }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!isEditMode || !reportId) return;
    if (!confirm("Удалить отчёт? Это действие нельзя отменить.")) return;
    try {
      const res = await fetch(`/api/reports/delete/${reportId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { alert("Отчёт удалён"); window.location.href = "/reports"; }
      else alert("Ошибка: " + data.error);
    } catch (e) { alert("Ошибка удаления"); }
  };

  if (pageLoading) {
    return <div className="p-4 md:p-6 max-w-6xl mx-auto flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/reports" className="flex items-center gap-2 text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> Назад</Link>
        {isEditMode && (
          <button onClick={handleDelete} className="text-red-400 hover:text-red-300 hover:bg-red-900/30 px-3 py-1 rounded flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> Удалить
          </button>
        )}
      </div>

      <h1 className="text-2xl font-bold text-white mb-6">{isEditMode ? `Отчёт #${reportId?.slice(0,8)}` : 'Новый отчёт'}</h1>
      {saved && <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-6 text-green-400">✅ Сохранено!</div>}

      <div className="space-y-6">
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
                    {d.driver_name} ({d.trips} рейсов)
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
              <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-slate-700 text-white rounded-lg px-2 py-1.5 border border-slate-600 text-xs" />
            </div>
            <div>
              <label className="text-xs text-slate-500">По</label>
              <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-slate-700 text-white rounded-lg px-2 py-1.5 border border-slate-600 text-xs" />
            </div>
          </div>

          <div className="relative">
            <input type="text" value={vehicleSearch}
              onChange={e => { setVehicleSearch(e.target.value); setShowVehicleList(true); if (!e.target.value) setVehicleNumber(""); }}
              onFocus={() => setShowVehicleList(true)} onBlur={() => setTimeout(() => setShowVehicleList(false), 200)}
              placeholder="Номер машины..." className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600" />
            {showVehicleList && vehicleSearch && filteredVehicles.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg max-h-48 overflow-y-auto">
                {filteredVehicles.map(v => <button key={v.number} onClick={() => selectVehicle(v.number)} className="w-full text-left px-3 py-2 hover:bg-slate-600 text-white text-sm">{v.number}</button>)}
              </div>
            )}
          </div>

          <button onClick={handleAutoFill} disabled={autoLoading || !driverName || !dateFrom || !dateTo}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg w-full justify-center">
            {autoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Загрузить
          </button>
        </div>

        {/* Сводка GPS */}
        {gpsMileage > 0 && (
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-500/30">
            <div className="text-center mb-3">
              <span className="text-slate-400 text-sm">Общий GPS за период</span>
              <div className="text-3xl font-bold text-white">{gpsMileage.toLocaleString()} км</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><span className="text-purple-400 font-bold">{wbGpsMileage.toLocaleString()}</span><div className="text-slate-500 text-xs">WB</div></div>
              <div><span className="text-orange-400 font-bold">{rfGpsMileage.toLocaleString()}</span><div className="text-slate-500 text-xs">РФ</div></div>
              <div className="cursor-pointer group" onClick={() => {
                const wbDates = new Set(wbTrips.flatMap(t => {
                  const dates: string[] = [];
                  const start = new Date(t.loading_date);
                  const end = new Date(t.unloading_date || t.loading_date);
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    dates.push(d.toISOString().slice(0, 10));
                  }
                  return dates;
                }));
                const rfDates = new Set<string>();
                rfPeriods.forEach(p => {
                  if (p.from && p.to) {
                    const start = new Date(p.from);
                    const end = new Date(p.to);
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                      rfDates.add(d.toISOString().slice(0, 10));
                    }
                  }
                });
                const otherDays = gpsByDay.filter(d => !wbDates.has(d.date) && !rfDates.has(d.date) && d.km > 10);
                if (otherDays.length > 0) {
                  alert(`Порожний пробег:\n${otherDays.map(d => `${d.date.slice(5,10).split('-').reverse().join('.')}: ${Math.round(d.km)} км`).join('\n')}`);
                }
              }}>
                <span className="text-yellow-400 font-bold">{Math.max(0, gpsMileage - wbGpsMileage - rfGpsMileage).toLocaleString()}</span>
                <div className="text-slate-500 text-xs group-hover:text-yellow-400">Прочее ℹ️</div>
              </div>
            </div>
          </div>
        )}

        {/* WB */}
        <div className="bg-slate-800 rounded-xl p-4 border border-purple-500/30">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-purple-400">🚛 WB ({wbTotals.count})</h2>
            {wbGpsMileage > 0 && <span className="text-purple-400 font-bold">{wbGpsMileage.toLocaleString()} км</span>}
          </div>
          {wbTrips.length > 0 ? (
            <>
              <div className="space-y-1 mb-3 text-sm">
                {wbTrips.map((t, i) => {
                  // Расчёт простоя от предыдущего рейса
                  let idleHours = 0;
                  if (i > 0 && wbTrips[i-1].unloading_date && wbTrips[i-1].unloading_time && t.loading_date && t.loading_time) {
                    const prevEnd = new Date(`${wbTrips[i-1].unloading_date}T${wbTrips[i-1].unloading_time}`);
                    const currStart = new Date(`${t.loading_date}T${t.loading_time}`);
                    idleHours = Math.round((currStart.getTime() - prevEnd.getTime()) / 3600000);
                  }
                  // Длительность рейса
                  let tripHours = 0;
                  if (t.loading_date && t.loading_time && t.unloading_date && t.unloading_time) {
                    const start = new Date(`${t.loading_date}T${t.loading_time}`);
                    const end = new Date(`${t.unloading_date}T${t.unloading_time}`);
                    tripHours = Math.round((end.getTime() - start.getTime()) / 3600000);
                  }
                  return (
                    <div key={i}>
                      {idleHours > 8 && (
                        <div className={`text-xs rounded px-2 py-0.5 mb-1 flex justify-between items-center ${excludedIdles.has(i) ? 'bg-slate-700/50 text-slate-500 line-through' : 'bg-yellow-500/10 text-yellow-400'}`}>
                          <span>⏸️ Простой: {idleHours} ч. (+{Math.max(0, idleHours - 8) * 100} ₽){excludedIdles.has(i) && ' (исключён)'}</span>
                          <button 
                            onClick={() => {
                              const newSet = new Set(excludedIdles);
                              if (newSet.has(i)) newSet.delete(i);
                              else newSet.add(i);
                              setExcludedIdles(newSet);
                            }}
                            className={`ml-2 px-1 rounded ${excludedIdles.has(i) ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'}`}
                          >
                            {excludedIdles.has(i) ? '↩️' : '✕'}
                          </button>
                        </div>
                      )}
                      {idleHours > 0 && idleHours <= 8 && (
                        <div className="text-xs text-slate-500 px-2">↓ отдых {idleHours} ч.</div>
                      )}
                      <div className="flex justify-between bg-slate-700/50 rounded px-2 py-1">
                        <span className="text-slate-400 text-xs w-32">
                          {shortDate(t.loading_date)}{t.loading_time ? ` ${t.loading_time.slice(0,5)}` : ''}
                          →{shortDate(t.unloading_date || t.loading_date)}{t.unloading_time ? ` ${t.unloading_time.slice(0,5)}` : ''}
                          {tripHours > 0 && <span className="text-slate-500"> ({tripHours}ч)</span>}
                        </span>
                        <span className="flex-1 truncate text-slate-300 text-xs mx-2">{t.route_name}</span>
                        <span className="text-green-400">{Number(t.driver_rate).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Сводка по маршрутам */}
              <div className="bg-slate-700/30 rounded-lg p-2 mb-3 text-xs">
                <div className="text-slate-400 mb-1">📊 По маршрутам:</div>
                {Object.entries(wbTrips.reduce((acc: Record<string, number>, t) => {
                  const route = t.route_name?.split(' - ')[1] || t.route_name || 'Неизвестный';
                  acc[route] = (acc[route] || 0) + 1;
                  return acc;
                }, {})).map(([route, count]) => (
                  <div key={route} className="flex justify-between text-slate-300">
                    <span>{route}</span>
                    <span className="text-purple-400">{count} рейс{count === 1 ? '' : count < 5 ? 'а' : 'ов'}</span>
                  </div>
                ))}
                <div className="border-t border-slate-600 mt-2 pt-2 text-slate-400">
                  🕐 Работа WB: {wbTrips.length > 0 ? `${wbTrips[wbTrips.length - 1].loading_date?.slice(5, 10).split('-').reverse().join('.')} — ${wbTrips[0].unloading_date?.slice(5, 10).split('-').reverse().join('.') || wbTrips[0].loading_date?.slice(5, 10).split('-').reverse().join('.')}` : '—'}
                </div>
              </div>
              {/* Общий простой WB */}
              {totalIdleData.hours > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-yellow-400 font-medium">⏸️ Всего простой:</span>
                    <span className="text-yellow-400 font-bold">{totalIdleData.hours} ч. → +{totalIdleData.amount.toLocaleString()} ₽</span>
                  </div>
                </div>
              )}
              {/* Топливо WB */}
              {wbGpsMileage > 0 && (
                <div className="bg-purple-500/10 rounded p-2 mb-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Топливо WB:</span>
                    <span className="text-cyan-400">{fuelUsedWb > 0 ? fuelUsedWb.toFixed(0) + ' л' : '—'}</span>
                  </div>
                  {fuelUsedWb > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Расход WB:</span>
                      <span className="text-purple-400">{avgFuelConsumptionWb} л/100км</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between border-t border-slate-700 pt-2 font-bold">
                <span className="text-purple-400">{wbDays} дн. → {wbGpsMileage.toLocaleString()} км</span>
                <span className="text-green-400">{wbTotals.driver_rate.toLocaleString()} ₽</span>
              </div>
            </>
          ) : <div className="text-slate-500 text-center py-4">Нет рейсов</div>}
        </div>

        {/* РФ */}
        <div className="bg-slate-800 rounded-xl p-4 border border-orange-500/30">
          <h2 className="text-lg font-semibold text-orange-400 mb-3">📋 РФ ({rfContracts.length})</h2>
          {rfContracts.length > 0 ? (
            <>
              <div className="space-y-1 mb-3 text-xs">
                {rfContracts.map((c, i) => {
                  const ld = c.loading_date ? new Date(c.loading_date) : null;
                  const ud = c.unloading_date ? new Date(c.unloading_date) : null;
                  const fmtD = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
                  const fmtDT = (d: Date) => `${fmtD(d)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                  const dateStr = ld && ud ? `${fmtDT(ld)} → ${fmtDT(ud)}` : ld ? fmtD(ld) : c.date?.slice(0,10);
                  return (
                  <div key={i} className="bg-slate-700/50 rounded px-2 py-1">
                    <span className="text-slate-400">{dateStr}</span>
                    <span className="text-slate-300 ml-2">{c.route}</span>
                  </div>
                  );
                })}
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-orange-400 text-sm">📅 Периоды РФ:</div>
                  <button onClick={() => setRfPeriods([...rfPeriods, {from: "", to: "", mileage: 0}])}
                    className="text-xs text-orange-400 hover:text-orange-300">+ Добавить период</button>
                </div>
                {rfPeriods.map((period, idx) => (
                  <div key={idx} className="bg-slate-700/30 rounded p-2 mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-400">Период {idx + 1}</span>
                      {rfPeriods.length > 1 && (
                        <button onClick={() => setRfPeriods(rfPeriods.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 text-xs">✕</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input type="datetime-local" value={period.from} 
                        onChange={e => {
                          const newPeriods = [...rfPeriods];
                          newPeriods[idx].from = e.target.value;
                          newPeriods[idx].mileage = 0;
                          setRfPeriods(newPeriods);
                          if (idx === 0) setRfDateFrom(e.target.value);
                        }}
                        className="w-full bg-slate-600 text-white rounded px-2 py-1 text-xs border border-slate-500" />
                      <input type="datetime-local" value={period.to} 
                        onChange={e => {
                          const newPeriods = [...rfPeriods];
                          newPeriods[idx].to = e.target.value;
                          newPeriods[idx].mileage = 0;
                          setRfPeriods(newPeriods);
                          if (idx === 0) setRfDateTo(e.target.value);
                        }}
                        className="w-full bg-slate-600 text-white rounded px-2 py-1 text-xs border border-slate-500" />
                    </div>
                    {period.mileage > 0 && <div className="text-orange-400 text-sm font-bold text-center">{period.mileage.toLocaleString()} км</div>}
                  </div>
                ))}
                <button onClick={loadRfGps} disabled={!rfPeriods[0]?.from || !rfPeriods[0]?.to || rfGpsLoading || !vehicleNumber}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white px-3 py-2 rounded flex items-center justify-center gap-2">
                    {rfGpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>Загрузить пробег</span>
                  </button>
                {rfGpsMileage > 0 && <div className="text-center mt-2 text-orange-400 font-bold text-xl">Итого: {rfGpsMileage.toLocaleString()} км</div>}
              </div>
              <div className="border-t border-slate-700 pt-3 space-y-2">
                {/* Выбор ставки */}
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-2">💰 Расчёт ставки</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-slate-400 text-sm">Тип:</span>
                    {selectedVehicleType ? (
                      <span className="text-white font-medium">{selectedVehicleType}</span>
                    ) : (
                      <select value={selectedVehicleType} onChange={e => setSelectedVehicleType(e.target.value)}
                        className="bg-slate-600 text-white rounded px-2 py-1 text-xs border border-slate-500 flex-1">
                        <option value="">Выберите тип</option>
                        {vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                    <span className="text-slate-500">|</span>
                    <select value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)}
                      className="bg-slate-600 text-white rounded px-2 py-1 text-xs border border-slate-500">
                      <option value="Зима">Зима</option>
                      <option value="Межсезон">Межсезон</option>
                      <option value="Лето">Лето</option>
                    </select>
                  </div>
                  {/* Показываем расход и норму за РФ */}
                  {rfGpsMileage > 0 && (() => {
                    // Топливо за период РФ
                    const rfFuelUsed = fuelRf.liters + (Number(rfFuelStartTank) || 0) - (Number(rfFuelEndTank) || 0);
                    const rfConsumption = rfFuelUsed > 0 ? (rfFuelUsed / rfGpsMileage * 100).toFixed(2) : "—";
                    const norm = Number(selectedSeason === 'Зима' ? vehicleData.fuel_norm_winter : selectedSeason === 'Лето' ? vehicleData.fuel_norm_summer : vehicleData.fuel_norm_autumn) || 0;
                    const inNorm = rfFuelUsed > 0 && Number(rfConsumption) <= (norm || 35);
                    return (
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2 mb-2 text-xs">
                        <div className="text-orange-400 font-medium mb-1">📊 За период РФ:</div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Пробег:</span>
                          <span className="text-orange-400 font-bold">{rfGpsMileage.toLocaleString()} км</span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Заправлено:</span>
                          <span className="text-cyan-400 font-bold">{fuelRf.liters > 0 ? Math.round(fuelRf.liters).toLocaleString() + ' л' : '—'}</span>
                        </div>
                        {/* Остатки топлива в баке */}
                        <div className="bg-slate-700/50 rounded p-2 my-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-400">🛢️ Остатки в баке:</span>
                            {hasFuelSensor ? (
                              <span className="text-green-400 text-[10px]">✓ Датчик</span>
                            ) : (
                              <span className="text-yellow-400 text-[10px]">⚠️ Нет датчика — введите вручную</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-slate-500 text-[10px]">Начало периода</label>
                              <input type="number" placeholder="0" value={rfFuelStartTank} 
                                onChange={e => setRfFuelStartTank(e.target.value ? Number(e.target.value) : "")}
                                className={`w-full rounded px-2 py-1 text-xs border text-center ${hasFuelSensor && rfFuelStartTank ? 'bg-green-900/30 text-green-300 border-green-600' : 'bg-slate-600 text-white border-slate-500'}`} />
                            </div>
                            <div>
                              <label className="text-slate-500 text-[10px]">Конец периода</label>
                              <input type="number" placeholder="0" value={rfFuelEndTank} 
                                onChange={e => setRfFuelEndTank(e.target.value ? Number(e.target.value) : "")}
                                className={`w-full rounded px-2 py-1 text-xs border text-center ${hasFuelSensor && rfFuelEndTank ? 'bg-green-900/30 text-green-300 border-green-600' : 'bg-slate-600 text-white border-slate-500'}`} />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Израсходовано:</span>
                          <span className="text-cyan-400 font-bold">{rfFuelUsed > 0 ? Math.round(rfFuelUsed).toLocaleString() + ' л' : '—'}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Расход факт:</span>
                          <span className={`font-bold ${rfFuelUsed === 0 ? 'text-slate-500' : inNorm ? 'text-green-400' : 'text-red-400'}`}>
                            {rfConsumption} л/100км {rfFuelUsed > 0 && (inNorm ? '✓' : '⚠️')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Норма ({selectedSeason}):</span>
                          <span className="text-slate-300">{norm > 0 ? norm + ' л/100км' : '—'}</span>
                        </div>
                      </div>
                    );
                  })()}
                  {tariffRates.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs text-slate-500 mb-1">Ставки по расходу:</div>
                      <div className="flex flex-wrap gap-1">
                        {tariffRates.slice(0, 8).map((t, i) => (
                          <button key={i} onClick={() => setRfRatePerKm(Number(t.rate))}
                            className={`px-2 py-1 rounded text-xs ${rfRatePerKm === Number(t.rate) ? 'bg-green-600 text-white' : Number(avgFuelConsumption) <= t.fuel_consumption && Number(avgFuelConsumption) > (tariffRates[i-1]?.fuel_consumption || 0) ? 'bg-yellow-600 text-white ring-2 ring-yellow-400' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}>
                            {t.fuel_consumption}л→{t.rate}₽
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm">Ставка:</span>
                      <input type="number" step="0.1" value={rfRatePerKm} onChange={e => setRfRatePerKm(parseFloat(e.target.value) || 0)}
                        className="w-16 bg-slate-600 text-white text-center rounded px-2 py-1 text-sm border border-slate-500 font-bold" />
                      <span className="text-slate-400 text-sm">₽/км</span>
                    </div>
                    {autoRate && autoRate !== rfRatePerKm && (
                      <button onClick={() => setRfRatePerKm(autoRate)} className="text-xs text-green-400 hover:underline">
                        Авто: {autoRate}₽
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Начисления:</span><span className="text-green-400 font-bold">{rfDriverPay.toLocaleString()} ₽</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="text-slate-500 text-center py-2 mb-3">Нет заявок из 1С</div>
              {/* Периоды РФ без заявок */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-orange-400 text-sm">📅 Периоды РФ:</div>
                  <button onClick={() => setRfPeriods([...rfPeriods, {from: "", to: "", mileage: 0}])}
                    className="text-xs text-orange-400 hover:text-orange-300">+ Добавить период</button>
                </div>
                {rfPeriods.map((period, idx) => (
                  <div key={idx} className="bg-slate-700/30 rounded p-2 mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-400">Период {idx + 1}</span>
                      {rfPeriods.length > 1 && (
                        <button onClick={() => setRfPeriods(rfPeriods.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 text-xs">✕</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input type="datetime-local" value={period.from} 
                        onChange={e => {
                          const newPeriods = [...rfPeriods];
                          newPeriods[idx].from = e.target.value;
                          newPeriods[idx].mileage = 0;
                          setRfPeriods(newPeriods);
                          if (idx === 0) setRfDateFrom(e.target.value);
                        }}
                        className="w-full bg-slate-600 text-white rounded px-2 py-1 text-xs border border-slate-500" />
                      <input type="datetime-local" value={period.to} 
                        onChange={e => {
                          const newPeriods = [...rfPeriods];
                          newPeriods[idx].to = e.target.value;
                          newPeriods[idx].mileage = 0;
                          setRfPeriods(newPeriods);
                          if (idx === 0) setRfDateTo(e.target.value);
                        }}
                        className="w-full bg-slate-600 text-white rounded px-2 py-1 text-xs border border-slate-500" />
                    </div>
                    {period.mileage > 0 && <div className="text-orange-400 text-sm font-bold text-center">{period.mileage.toLocaleString()} км</div>}
                  </div>
                ))}
                <button onClick={loadRfGps} disabled={!rfPeriods[0]?.from || !rfPeriods[0]?.to || rfGpsLoading || !vehicleNumber}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white px-3 py-2 rounded flex items-center justify-center gap-2">
                    {rfGpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>Загрузить пробег</span>
                  </button>
                {rfGpsMileage > 0 && <div className="text-center mt-2 text-orange-400 font-bold text-xl">Итого: {rfGpsMileage.toLocaleString()} км</div>}
              </div>
              {/* Ставка и расчёт */}
              {rfGpsMileage > 0 && (
                <div className="border-t border-slate-700 pt-3 space-y-2">
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-2">💰 Расчёт ставки</div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-slate-400 text-sm">Сезон:</span>
                      <select value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)}
                        className="bg-slate-600 text-white rounded px-2 py-1 text-xs border border-slate-500">
                        <option value="Зима">Зима</option>
                        <option value="Межсезон">Межсезон</option>
                        <option value="Лето">Лето</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm">Ставка:</span>
                      <input type="number" step="0.1" value={rfRatePerKm} onChange={e => setRfRatePerKm(parseFloat(e.target.value) || 0)}
                        className="w-20 bg-slate-600 text-orange-400 font-bold rounded px-2 py-1 text-center border border-slate-500" />
                      <span className="text-slate-400 text-sm">₽/км</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Начисления:</span><span className="text-green-400 font-bold">{rfDriverPay.toLocaleString()} ₽</span></div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Топливо */}
        <div className="bg-slate-800 rounded-xl p-4 border border-cyan-500/30">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-cyan-400">⛽ Топливо</h2>
            <button onClick={loadFuel} disabled={fuelLoading || !vehicleNumber || !dateFrom || !dateTo}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
              {fuelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Загрузить
            </button>
          </div>
          {fuelBySource.length > 0 ? (
            <>
              <div className="space-y-2 mb-3">
                {fuelBySource.map((f, i) => {
                  // Карта из карточки ТС или из транзакций
                  const savedCard = vehicleData.fuel_cards?.[f.source];
                  const transactionCards = [...new Set(fuelTransactions.filter(t => t.source === f.source && t.card_number).map(t => t.card_number))];
                  const cardNumber = savedCard || transactionCards[0];
                  return (
                    <div key={i} className="flex justify-between bg-slate-700/50 rounded px-3 py-2">
                      <div>
                        <div className="text-slate-300">{f.source || "Неизвестно"}</div>
                        {cardNumber && <div className="text-xs text-slate-500">💳 {cardNumber}</div>}
                        {transactionCards.length > 1 && <div className="text-xs text-slate-600">+ ещё {transactionCards.length - 1} карт</div>}
                        {!cardNumber && editingCards && (
                          <input 
                            type="text" 
                            placeholder="№ карты"
                            className="mt-1 bg-slate-600 text-white text-xs rounded px-2 py-1 border border-slate-500 w-32"
                            onBlur={async (e) => {
                              if (e.target.value && vehicleData.id) {
                                const newCards = { ...vehicleData.fuel_cards, [f.source]: e.target.value };
                                await fetch(`/api/vehicles/${vehicleData.id}/fuel-cards`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ fuel_cards: newCards })
                                });
                                setVehicleData({ ...vehicleData, fuel_cards: newCards });
                              }
                            }}
                          />
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-cyan-400 font-bold">{Number(f.liters).toLocaleString()} л</div>
                        <div className="text-slate-400 text-xs">{Number(f.amount).toLocaleString()} ₽</div>
                      </div>
                    </div>
                  );
                })}
                {fuelBySource.length > 0 && !fuelBySource.every(f => vehicleData.fuel_cards?.[f.source] || fuelTransactions.some(t => t.source === f.source && t.card_number)) && (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setEditingCards(!editingCards)}
                      className="text-xs text-cyan-400 hover:text-cyan-300">
                      {editingCards ? '✓ Готово' : '✏️ Добавить номера карт'}
                    </button>
                    {vehicleData.id && (
                      <a 
                        href={`/vehicles/${vehicleData.id}?tab=fuel`}
                        target="_blank"
                        className="text-xs text-yellow-400 hover:text-yellow-300">
                        🚛 Карточка машины →
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2 font-bold">
                <span className="text-cyan-400">{Number(fuelTotal.liters).toLocaleString()} л (заправлено)</span>
                <span className="text-slate-300">{Number(fuelTotal.amount).toLocaleString()} ₽</span>
              </div>
              
              {/* Разбивка по периодам WB и РФ */}
              {(fuelWb.liters > 0 || fuelRf.liters > 0) && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div className="text-sm text-slate-400 mb-2">📊 По периодам работы:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-purple-500/10 rounded p-2">
                      <div className="text-purple-400 text-xs">🚛 WB</div>
                      <div className="font-bold text-purple-300">{Math.round(fuelWb.liters).toLocaleString()} л</div>
                      <div className="text-xs text-slate-400">{fuelWb.amount.toLocaleString()} ₽</div>
                      {wbGpsMileage > 0 && fuelWb.liters > 0 && (
                        <div className="text-xs text-purple-400 mt-1">{(fuelWb.liters / wbGpsMileage * 100).toFixed(2)} л/100км</div>
                      )}
                    </div>
                    <div className="bg-orange-500/10 rounded p-2">
                      <div className="text-orange-400 text-xs">📋 РФ</div>
                      <div className="font-bold text-orange-300">{Math.round(fuelRf.liters).toLocaleString()} л</div>
                      <div className="text-xs text-slate-400">{fuelRf.amount.toLocaleString()} ₽</div>
                      {rfGpsMileage > 0 && fuelRf.liters > 0 && (
                        <div className="text-xs text-orange-400 mt-1">{(fuelRf.liters / rfGpsMileage * 100).toFixed(2)} л/100км</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Остатки топлива в баке */}
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-400">🛢️ Остатки в баке</span>
                  {hasFuelSensor && <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded">Датчик</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">На начало (л)</label>
                    <input type="number" placeholder="0" value={fuelStartTank} 
                      onChange={e => setFuelStartTank(e.target.value ? Number(e.target.value) : "")}
                      disabled={sensorLoading}
                      className="w-full bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">На конец (л)</label>
                    <input type="number" placeholder="0" value={fuelEndTank} 
                      onChange={e => setFuelEndTank(e.target.value ? Number(e.target.value) : "")}
                      disabled={sensorLoading}
                      className="w-full bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm mt-1" />
                  </div>
                </div>
                {(fuelStartTank || fuelEndTank) && (
                  <div className="mt-2 text-xs text-slate-400">
                    Израсходовано: {fuelUsed.toLocaleString()} л ({fuelTotal.liters} заправлено {Number(fuelStartTank) > 0 ? `+ ${fuelStartTank} было` : ''} {Number(fuelEndTank) > 0 ? `- ${fuelEndTank} осталось` : ''})
                  </div>
                )}
              </div>
              
              {/* Детализация по дням */}
              {fuelTransactions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <button onClick={() => setShowFuelDetails(!showFuelDetails)} className="w-full text-left text-sm text-slate-400 hover:text-slate-300 flex justify-between items-center">
                    <span>📋 Детализация по дням ({fuelTransactions.length} записей)</span>
                    <span>{showFuelDetails ? '▲' : '▼'}</span>
                  </button>
                  {showFuelDetails && (
                    <div className="mt-2 max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-5 gap-1 text-xs text-slate-500 px-2 py-1 border-b border-slate-700 mb-1 sticky top-0 bg-slate-800">
                        <span>Дата</span><span>Источник</span><span>Карта</span><span className="text-right">Литры</span><span className="text-right">Сумма</span>
                      </div>
                      {fuelTransactions.map((t, i) => (
                        <div key={i} className="grid grid-cols-5 gap-1 bg-slate-900/50 rounded px-2 py-1 text-xs">
                          <span className="text-slate-400">{t.date}</span>
                          <span className="text-slate-500">{t.source}</span>
                          <span className="text-slate-600 truncate" title={t.card_number}>{t.card_number || '—'}</span>
                          <span className="text-cyan-400 text-right">{Number(t.liters).toLocaleString()} л</span>
                          <span className="text-slate-300 text-right">{Number(t.amount).toLocaleString()} ₽</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {gpsMileage > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <div className="text-slate-400 text-xs">Пробег</div>
                      <div className="font-semibold">{gpsMileage.toLocaleString()} км</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Расход</div>
                      <div className="font-semibold text-yellow-400">{avgFuelConsumption} л/100км</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Авто-ставка</div>
                      <div className={`font-semibold ${autoRate ? 'text-green-400' : 'text-slate-500'}`}>{autoRate ? autoRate + ' ₽/км' : '—'}</div>
                    </div>
                  </div>
                  {vehicleModel && <div className="text-center text-xs text-slate-500 mt-2">Тип: {vehicleModel} | Сезон: {getSeason()}</div>}
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-500 text-center py-4">
              {fuelTotal.count === 0 ? "Нет данных о топливе" : "Загрузите данные"}
            </div>
          )}
        </div>

        {/* Суточные РФ */}
        <div className="bg-slate-800 rounded-xl p-4 border border-yellow-500/30">
          <h2 className="font-semibold text-yellow-400 mb-2">Суточные РФ</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input type="number" value={rfDays} onChange={e => { setRfDays(Number(e.target.value) || 0); setRfDaysManual(true); }} className="w-16 bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm text-center" />
              <span className="text-slate-400">дн ×</span>
              <input type="number" value={rfDailyRate} onChange={e => setRfDailyRate(Number(e.target.value) || 0)} className="w-20 bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm text-center" />
              <span className="text-slate-400">₽</span>
            </div>
            <span className="text-yellow-400 font-bold text-lg">+{rfDailyPay.toLocaleString()} ₽</span>
          </div>
        </div>

        {/* Премия ТК */}
        {rfGpsMileage > 0 && (
          <div className={`bg-slate-800 rounded-xl p-4 border ${bonusEnabled ? 'border-emerald-500/30' : 'border-slate-600'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={bonusEnabled} onChange={e => setBonusEnabled(e.target.checked)} className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500" />
                  <span className={`font-semibold ${bonusEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>🏆 Премия ТК</span>
                </label>
                {bonusEnabled && (
                  <div className="flex items-center gap-1 text-sm text-slate-400">
                    <span>{rfGpsMileage.toLocaleString()} км ×</span>
                    <input type="number" step="0.1" value={bonusRate} onChange={e => setBonusRate(parseFloat(e.target.value) || 0)} className="w-12 bg-slate-700 text-white rounded px-1 py-0.5 border border-slate-600 text-center text-xs" />
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
          <div className="flex gap-2 mt-2">
            <input list="work-types-list" placeholder="Название работы..." value={workSearch} 
              onChange={e => { 
                setWorkSearch(e.target.value); 
                const found = workTypes.find(t => t.name === e.target.value);
                if (found) setNewWorkRate(found.default_rate);
              }}
              className="flex-1 bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm" />
            <datalist id="work-types-list">
              {workTypes.map(t => <option key={t.id} value={t.name}>{t.name} ({t.default_rate}₽)</option>)}
            </datalist>
            <input type="number" placeholder="Кол" value={newWorkCount} onChange={e => setNewWorkCount(e.target.value ? Number(e.target.value) : "")} className="w-14 bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm text-center" />
            <input type="number" placeholder="₽" value={newWorkRate} onChange={e => setNewWorkRate(e.target.value ? Number(e.target.value) : "")} className="w-16 bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm text-center" />
            <button onClick={addExtraWork} disabled={!workSearch} className="bg-green-600 disabled:bg-slate-600 text-white px-3 py-1 rounded"><Plus className="w-4 h-4" /></button>
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
          <div className="flex gap-2 mt-2">
            <input list="comp-types-list" placeholder="Название расхода..." value={compSearch}
              onChange={e => { 
                setCompSearch(e.target.value); 
                const found = compTypes.find(t => t.name === e.target.value);
                if (found) setNewExpenseAmount(found.default_rate);
              }}
              className="flex-1 bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm" />
            <datalist id="comp-types-list">
              {compTypes.map(t => <option key={t.id} value={t.name}>{t.name} ({t.default_rate}₽)</option>)}
            </datalist>
            <input type="number" placeholder="₽" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value ? Number(e.target.value) : "")} className="w-20 bg-slate-700 text-white rounded px-3 py-1 border border-slate-600 text-sm" />
            <button onClick={addExpenseItem} disabled={!compSearch} className="bg-cyan-600 disabled:bg-slate-600 text-white px-3 py-1 rounded"><Plus className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Выдано (-) */}
        <div className="bg-slate-800 rounded-xl p-4 border border-orange-500/30">
          <div className="flex justify-between items-center mb-1">
            <h2 className="font-semibold text-orange-400">💵 Выдано</h2>
            {driverName && (
              <button onClick={loadSalaryPayments} className="text-xs bg-orange-600/20 text-orange-300 px-2 py-1 rounded hover:bg-orange-600/40">
                📋 Из ведомостей
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-2">Аванс, суточные — вычитается</p>
          {payments.map((p, i) => (
            <div key={i} className="flex justify-between bg-slate-700/50 rounded px-3 py-1 mb-1 text-sm">
              <span>{paymentTypeLabel(p.type)} {p.description && `(${p.description})`}</span>
              <div className="flex gap-2">
                <span className="text-orange-400">−{p.amount.toLocaleString()} ₽</span>
                <button onClick={() => setPayments(payments.filter((_, j) => j !== i))} className="text-slate-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 mt-2">
            <input type="date" value={newPaymentDate} onChange={e => setNewPaymentDate(e.target.value)} className="bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm" />
            <select value={newPaymentType} onChange={e => setNewPaymentType(e.target.value)} className="bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm">
              <option value="advance">Аванс</option>
              <option value="daily">Суточные</option>
              <option value="card">На карту</option>
              <option value="cash">На руки</option>
            </select>
            <input placeholder="Комментарий" value={newPaymentDesc} onChange={e => setNewPaymentDesc(e.target.value)} className="flex-1 min-w-[80px] bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm" />
            <input type="number" placeholder="₽" value={newPaymentAmount} onChange={e => setNewPaymentAmount(e.target.value ? Number(e.target.value) : "")} className="w-20 bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-sm" />
            <button onClick={addPayment} className="bg-orange-600 text-white px-3 py-1 rounded"><Plus className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Итого */}
        <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 border border-green-500/30">
          <div className="space-y-1 text-sm mb-3">
            {wbTotals.driver_rate > 0 && <div className="flex justify-between"><span className="text-slate-400">WB</span><span className="text-purple-400">+{wbTotals.driver_rate.toLocaleString()} ₽</span></div>}
            {totalIdleData.amount > 0 && <div className="flex justify-between"><span className="text-slate-400">Простой ({totalIdleData.hours} ч.)</span><span className="text-yellow-400">+{totalIdleData.amount.toLocaleString()} ₽</span></div>}
            {rfDriverPay > 0 && <div className="flex justify-between"><span className="text-slate-400">РФ ({rfGpsMileage.toLocaleString()}×{rfRatePerKm})</span><span className="text-blue-400">+{rfDriverPay.toLocaleString()} ₽</span></div>}
            {rfBonus > 0 && <div className="flex justify-between"><span className="text-slate-400">Премия ТК</span><span className="text-emerald-400">+{rfBonus.toLocaleString()} ₽</span></div>}
            {rfDailyPay > 0 && <div className="flex justify-between"><span className="text-slate-400">Суточные ({rfDays}×{rfDailyRate})</span><span className="text-yellow-400">+{rfDailyPay.toLocaleString()} ₽</span></div>}
            {totalExtraWorks > 0 && <div className="flex justify-between"><span className="text-slate-400">Доп. работы</span><span className="text-green-400">+{totalExtraWorks.toLocaleString()} ₽</span></div>}
            {totalExpenses > 0 && <div className="flex justify-between"><span className="text-slate-400">Компенсация</span><span className="text-cyan-400">+{totalExpenses.toLocaleString()} ₽</span></div>}
            {totalPayments > 0 && <div className="flex justify-between"><span className="text-slate-400">Выдано</span><span className="text-orange-400">−{totalPayments.toLocaleString()} ₽</span></div>}
          </div>
          <div className="text-center border-t border-slate-700 pt-3 mb-3">
            <div className="text-slate-400 text-xs">К выплате</div>
            <div className={`text-3xl font-bold ${totalToPay >= 0 ? 'text-green-400' : 'text-red-400'}`}>{isNaN(totalToPay) ? 0 : totalToPay.toLocaleString()} ₽</div>
            {rfGpsMileage > 0 && <div className="text-slate-500 text-xs mt-1">Заработок: {earnPerKm} ₽/км</div>}
          </div>
          <button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white px-6 py-3 rounded-lg w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Сохранить
          </button>
        </div>

        {/* Текстовый отчёт для водителя */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-600">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold text-slate-300">📋 Отчёт для водителя</h2>
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard.writeText(reportText); alert("Скопировано!"); }} className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1 rounded text-sm">Копировать</button>
              <button onClick={() => {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(`
                    <html>
                    <head>
                      <title>Отчёт - ${driverName}</title>
                      <style>
                        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
                        h1 { font-size: 16px; margin-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                        th, td { border: 1px solid #000; padding: 5px; text-align: left; }
                        th { background: #f0f0f0; }
                        .total { font-weight: bold; }
                        .right { text-align: right; }
                        @media print { body { padding: 0; } }
                      </style>
                    </head>
                    <body>
                      <h1>ОТЧЁТ ВОДИТЕЛЯ</h1>
                      <table>
                        <tr><td>Водитель:</td><td><strong>${driverName}</strong></td></tr>
                        <tr><td>Период:</td><td>${dateFrom?.split('T')[0]} — ${dateTo?.split('T')[0]}</td></tr>
                        <tr><td>Т/С:</td><td>${vehicleNumber}</td></tr>
                        <tr><td>Тип:</td><td>${selectedVehicleType}</td></tr>
                      </table>
                      
                      <h2>Пробег и расход</h2>
                      <table>
                        <tr><td>Пробег РФ:</td><td class="right">${rfGpsMileage.toLocaleString()} км</td></tr>
                        <tr><td>Топливо РФ:</td><td class="right">${Math.round(fuelRf.liters).toLocaleString()} л</td></tr>
                        <tr><td>Расход факт:</td><td class="right">${avgFuelConsumption} л/100км</td></tr>
                        <tr><td>Сезон:</td><td>${selectedSeason}</td></tr>
                        <tr><td>Ставка:</td><td class="right">${rfRatePerKm} ₽/км</td></tr>
                      </table>
                      
                      <h2>Начисления</h2>
                      <table>
                        ${rfDriverPay > 0 ? `<tr><td>За км (${rfGpsMileage}×${rfRatePerKm}):</td><td class="right">${rfDriverPay.toLocaleString()} ₽</td></tr>` : ''}
                        ${rfBonus > 0 ? `<tr><td>Премия ТК:</td><td class="right">${rfBonus.toLocaleString()} ₽</td></tr>` : ''}
                        ${rfDailyPay > 0 ? `<tr><td>Суточные (${rfDays} дн × ${rfDailyRate}):</td><td class="right">${rfDailyPay.toLocaleString()} ₽</td></tr>` : ''}
                        ${wbTotals.driver_rate > 0 ? `<tr><td>WB рейсы:</td><td class="right">${wbTotals.driver_rate.toLocaleString()} ₽</td></tr>` : ''}
                        ${totalIdleData.amount > 0 ? `<tr><td>Простой (${totalIdleData.hours} ч.):</td><td class="right">${totalIdleData.amount.toLocaleString()} ₽</td></tr>` : ''}
                        <tr class="total"><td>ИТОГО начислено:</td><td class="right">${totalDriverPay.toLocaleString()} ₽</td></tr>
                      </table>
                      
                      ${totalPayments > 0 ? `
                      <h2>Выплачено</h2>
                      <table>
                        <tr><td>Выплачено:</td><td class="right">-${totalPayments.toLocaleString()} ₽</td></tr>
                      </table>
                      ` : ''}
                      
                      <h2 style="margin-top: 20px; border-top: 2px solid #000; padding-top: 10px;">
                        К ВЫПЛАТЕ: <span style="font-size: 18px;">${totalToPay.toLocaleString()} ₽</span>
                      </h2>
                      
                      <div style="margin-top: 30px;">
                        <p>Дата: _________________ Подпись: _________________</p>
                      </div>
                    </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.print();
                }
              }} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm">🖨️ Печать</button>
            </div>
          </div>
          <div className="mb-2">
            <input placeholder="Комментарий..." value={comment} onChange={e => setComment(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-1 border border-slate-600 text-sm" />
          </div>
          <pre className="bg-slate-900 text-slate-300 p-3 rounded text-xs whitespace-pre-wrap font-mono overflow-x-auto">{reportText}</pre>
        </div>
      </div>
    </div>
  );
}
