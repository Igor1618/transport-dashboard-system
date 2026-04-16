'use client';

import { useState, useEffect, useRef } from 'react';
import type { RfContract, RfPeriod } from '../types/report';

interface SharedSetters {
  setVehicleData: (v: any) => void;
  setFuelRf: (v: { liters: number; amount: number }) => void;
  setHasFuelSensor: (v: boolean) => void;
  setFuelStartTank: (v: number | '') => void;
  setFuelEndTank: (v: number | '') => void;
  fuelStartTank: number | '';
  fuelEndTank: number | '';
}

export function useRfContracts(params: {
  gpsMileage: number;
  wbGpsMileage: number;
  fuelRf: { liters: number; amount: number };
  bonusEnabled: boolean;
  bonusRate: number;
  reportLoaded: boolean;
  reportLoadedRef: React.MutableRefObject<boolean>;
  isNew: boolean;
  manualRecoveryKm?: number;
}) {
  const { gpsMileage, wbGpsMileage, fuelRf, bonusEnabled, bonusRate, reportLoaded, reportLoadedRef, isNew, manualRecoveryKm = 0 } = params;

  // RF state
  const [rfContracts, setRfContracts] = useState<RfContract[]>([]);
  const [rfPeriods, setRfPeriods] = useState<RfPeriod[]>([{ from: "", to: "", mileage: 0 }]);
  const [rfDateFrom, setRfDateFrom] = useState("");
  const [rfDateTo, setRfDateTo] = useState("");
  const [rfGpsMileage, setRfGpsMileage] = useState(0);
  const [rfGpsLoading, setRfGpsLoading] = useState(false);
  const [rfRatePerKm, setRfRatePerKm] = useState(7.0);
  const [rfDaysManual, setRfDaysManual] = useState(false);
  const [rfDays, setRfDays] = useState(0);
  const [rfDailyRate, setRfDailyRate] = useState(1000);
  const [rfFuelStartTank, setRfFuelStartTank] = useState<number | ''>('');
  const [rfFuelEndTank, setRfFuelEndTank] = useState<number | ''>('');

  // Tariff/rate state
  const [selectedVehicleType, setSelectedVehicleType] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');
  const [autoRate, setAutoRate] = useState<number | null>(null);
  const [tariffRates, setTariffRates] = useState<{ fuel_consumption: number; rate: number }[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);

  // Computed
  const hasRfPeriods = rfPeriods.some(p => p.from && p.to);
  const hasRfData = hasRfPeriods || (rfContracts.length > 0 && gpsMileage > 0 && wbGpsMileage > 0 && gpsMileage > wbGpsMileage);
  const effectiveRfMileage = hasRfData
    ? (rfGpsMileage || 0) + manualRecoveryKm
    : (gpsMileage > 0 && wbGpsMileage > 0 ? Math.max(gpsMileage - wbGpsMileage, 0) + manualRecoveryKm : (manualRecoveryKm > 0 ? manualRecoveryKm : 0));
  const rfDriverPay = hasRfData || manualRecoveryKm > 0 ? Math.round(effectiveRfMileage * (rfRatePerKm || 0)) : 0;
  const rfDailyPay = (hasRfData || rfDaysManual) ? (rfDays || 0) * (rfDailyRate || 0) : 0;
  const rfBonus = (hasRfData || manualRecoveryKm > 0) && bonusEnabled ? Math.round(effectiveRfMileage * (bonusRate || 0)) : 0;
  const fuelUsedRf = fuelRf.liters || 0;
  const avgFuelConsumption = effectiveRfMileage > 0 && fuelUsedRf > 0
    ? (fuelUsedRf / effectiveRfMileage * 100).toFixed(2)
    : "0";

  // Effect: auto-calc rfDays from dates
  useEffect(() => {
    if (rfDaysManual || reportLoaded || reportLoadedRef.current) return;
    if (rfDateFrom && rfDateTo) {
      const from = new Date(rfDateFrom.slice(0, 10) + 'T00:00:00');
      const to = new Date(rfDateTo.slice(0, 10) + 'T00:00:00');
      const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      setRfDays(diffDays > 0 ? diffDays : 0);
    } else if (rfContracts.length > 0) {
      const allDates = rfContracts.flatMap(c => [c.loading_date, c.unloading_date, c.date].filter(Boolean)).map(d => d!.slice(0, 10)).sort();
      const from = new Date(allDates[0] + 'T00:00:00');
      const to = new Date(allDates[allDates.length - 1] + 'T00:00:00');
      const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      setRfDays(diffDays > 0 ? diffDays : 0);
    }
  }, [rfDateFrom, rfDateTo, rfContracts, rfDaysManual]);

  // Effect: load tariff rates when vehicle type + season change
  useEffect(() => {
    if (selectedVehicleType && selectedSeason) {
      fetch(`/api/reports/tariffs/rates?vehicle_type=${encodeURIComponent(selectedVehicleType)}&season=${encodeURIComponent(selectedSeason)}`)
        .then(r => r.json())
        .then(d => setTariffRates(d.rates || []))
        .catch(() => setTariffRates([]));
    }
  }, [selectedVehicleType, selectedSeason]);

  // Effect: auto-rate calculation
  useEffect(() => {
    const rfFuelUsedCalc = fuelRf.liters + (Number(rfFuelStartTank) || 0) - (Number(rfFuelEndTank) || 0);
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
            if (!reportLoaded && isNew) {
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

  /** Load RF GPS mileage + fuel for periods */
  const loadRfGps = async (vehicleNumber: string, shared: SharedSetters) => {
    if (!vehicleNumber) return;
    setRfGpsLoading(true);

    // Load vehicle data (for fuel norms)
    try {
      const vRes = await fetch(`/api/vehicles/by-number?number=${encodeURIComponent(vehicleNumber)}`);
      const vData = await vRes.json();
      console.log('[loadRfGps] vehicleData:', vData);
      shared.setVehicleData(vData);
      if (vData.vehicle_type) setSelectedVehicleType(vData.vehicle_type);
    } catch (e) { console.error('[loadRfGps] vehicleData error:', e); }

    let totalMileage = 0;
    let totalFuelLiters = 0;
    let totalFuelAmount = 0;
    const newPeriods = [...rfPeriods];

    for (let i = 0; i < rfPeriods.length; i++) {
      const p = rfPeriods[i];
      if (!p.from || !p.to) continue;
      const fromParam = p.from;
      const toParam = p.to;

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

      try {
        const fuelUrl = `/api/reports/fuel/detail?vehicle=${encodeURIComponent(vehicleNumber)}&from=${encodeURIComponent(p.from)}&to=${encodeURIComponent(p.to)}`;
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

    // Коррекция: Locarus не разделяет пробег внутри дня, поэтому RF GPS может включать WB-пробег
    // Формула: RF = min(rfFromLocarus, totalGPS - wbGPS)
    if (gpsMileage > 0 && wbGpsMileage > 0 && totalMileage > 0) {
      const rfBySubtraction = Math.max(gpsMileage - wbGpsMileage, 0);
      if (totalMileage > rfBySubtraction && rfBySubtraction > 0) {
        console.log(`[loadRfGps] Correcting RF mileage: ${totalMileage} -> ${rfBySubtraction} (total=${gpsMileage} - wb=${wbGpsMileage})`);
        totalMileage = rfBySubtraction;
        // Для одного периода - ставим скорректированное значение
        if (newPeriods.length === 1 && newPeriods[0].from) {
          newPeriods[0] = { ...newPeriods[0], mileage: rfBySubtraction };
        }
      }
    }

    setRfPeriods(newPeriods);
    setRfGpsMileage(totalMileage);
    console.log('[loadRfGps] TOTAL fuelRf:', totalFuelLiters, 'L', totalFuelAmount, '₽');
    shared.setFuelRf({ liters: totalFuelLiters, amount: totalFuelAmount });
    if (rfPeriods[0]?.from) setRfDateFrom(rfPeriods[0].from);
    if (rfPeriods[rfPeriods.length - 1]?.to) setRfDateTo(rfPeriods[rfPeriods.length - 1].to);

    // Fuel tank levels
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

        if (startData.hasSensor && startData.level >= 0 && !rfFuelStartTank) {
          setRfFuelStartTank(startData.level);
        }
        if (!startData.hasSensor && !rfFuelStartTank) {
          shared.setHasFuelSensor(false);
        }
        if (endData.hasSensor && endData.level >= 0 && !rfFuelEndTank) {
          setRfFuelEndTank(endData.level);
        }
        if (startData.hasSensor && startData.level >= 0 && !shared.fuelStartTank) {
          shared.setFuelStartTank(startData.level);
        }
        if (endData.hasSensor && endData.level >= 0 && !shared.fuelEndTank) {
          shared.setFuelEndTank(endData.level);
        }
        shared.setHasFuelSensor(startData.hasSensor || endData.hasSensor);
      } catch (e) {
        console.error('[loadRfGps] FuelLevel error:', e);
        shared.setHasFuelSensor(false);
      }
    }

    setRfGpsLoading(false);
  };

  /** Auto-fill RF period from contracts, clamped to report dates */
  const autoFillPeriodFromContracts = (contracts: any[], reportDateFrom: string, reportDateTo: string) => {
    if (!contracts.length || !reportDateFrom || !reportDateTo) return;
    const allStarts = contracts.map((c: any) => new Date(c.loading_date || c.start_date || c.date)).filter((d: Date) => !isNaN(d.getTime()));
    const allEnds = contracts.map((c: any) => new Date(c.unloading_date || c.end_date || c.date)).filter((d: Date) => !isNaN(d.getTime()));
    if (allStarts.length === 0 || allEnds.length === 0) return;
    const repFrom = new Date(reportDateFrom.split('T')[0] + 'T00:00:00');
    const repTo = new Date(reportDateTo.split('T')[0] + 'T23:59:00');
    const rfFrom = new Date(Math.max(Math.min(...allStarts.map((d: Date) => d.getTime())), repFrom.getTime()));
    const rfTo = new Date(Math.min(Math.max(...allEnds.map((d: Date) => d.getTime())), repTo.getTime()));
    const fromStr = rfFrom.toISOString().slice(0, 10);
    const toStr = rfTo.toISOString().slice(0, 10);
    setRfPeriods([{ from: fromStr, to: toStr, mileage: 0 }]);
    setRfDateFrom(fromStr);
    setRfDateTo(toStr);
    // Пересчитать суточные по авто-периоду (обрезанному по отчёту)
    // Используем только даты без времени для корректного подсчёта календарных дней
    const dayFrom = new Date(fromStr + 'T00:00:00');
    const dayTo = new Date(toStr + 'T00:00:00');
    const days = Math.round((dayTo.getTime() - dayFrom.getTime()) / 86400000) + 1;
    if (days > 0) { setRfDays(days); setRfDaysManual(true); }
    console.log('[autoFill] RF period from contracts:', fromStr, '→', toStr, 'days:', days);
    return { from: fromStr, to: toStr };
  };

  /** Restore RF data from saved report */
  const restoreRfData = async (reportRow: any, details: any, shared?: SharedSetters) => {
    // Only use total mileage as RF fallback when no RF periods are defined
    if (reportRow.mileage && (!reportRow.rf_periods || !Array.isArray(reportRow.rf_periods) || reportRow.rf_periods.length === 0)) {
      setRfGpsMileage(reportRow.mileage);
    }
    if (reportRow.rf_periods && Array.isArray(reportRow.rf_periods) && reportRow.rf_periods.length > 0) {
      setRfPeriods(reportRow.rf_periods);
      const validPeriods = reportRow.rf_periods.filter((p: any) => p.from && p.to);
      // Restore rfDateFrom/rfDateTo from saved periods
      if (validPeriods.length > 0) {
        setRfDateFrom(validPeriods[0].from);
        setRfDateTo(validPeriods[validPeriods.length - 1].to);
      }
      const totalFromPeriods = reportRow.rf_periods.reduce((sum: number, p: any) => sum + (Number(p.mileage) || 0), 0);
      console.log('[LOAD] rf_periods total mileage:', totalFromPeriods);
      if (totalFromPeriods > 0) {
        setRfGpsMileage(totalFromPeriods);
      } else if (validPeriods.length > 0 && reportRow.vehicle_number) {
        // Mileage not calculated yet - fetch GPS for RF period
        const from = validPeriods[0].from.slice(0, 10);
        const to = validPeriods[validPeriods.length - 1].to.slice(0, 10);
        try {
          const res = await fetch(`/api/reports/telematics/mileage?vehicle=${encodeURIComponent(reportRow.vehicle_number)}&from=${from}&to=${to}`);
          const data = await res.json();
          if (data.mileage != null) {
            setRfGpsMileage(data.mileage);
            setRfPeriods(prev => prev.map((p, i) => i === 0 ? {...p, mileage: data.mileage} : p));
          }
        } catch (e) { console.error('[restoreRfData] RF GPS fetch error:', e); }
      }
    }
    if (reportRow.vehicle_type) setSelectedVehicleType(reportRow.vehicle_type);
    if (reportRow.season) setSelectedSeason(reportRow.season);
    if (reportRow.rate_per_km) setRfRatePerKm(Number(reportRow.rate_per_km));

    if (details) {
      if (details.rf_rate) setRfRatePerKm(details.rf_rate);
      // Don't override fresh GPS calculation with stale rf_mileage if periods with dates exist
      const hasSavedPeriodsWithDates = reportRow.rf_periods && Array.isArray(reportRow.rf_periods)
        && reportRow.rf_periods.some((p: any) => p.from && p.to);
      if (details.rf_mileage && !hasSavedPeriodsWithDates) setRfGpsMileage(details.rf_mileage);
      if (details.rf_days != null) { setRfDays(Number(details.rf_days)); setRfDaysManual(true); }
      if (details.rf_daily_rate != null) setRfDailyRate(Number(details.rf_daily_rate));
      // Fallback: if rf_days not saved but rf_periods exist, calculate
      if (details.rf_days == null && reportRow.rf_periods && Array.isArray(reportRow.rf_periods) && reportRow.rf_periods.length > 0) {
        const validPeriods = reportRow.rf_periods.filter((p: any) => p.from && p.to);
        if (validPeriods.length > 0) {
          const firstFrom = new Date(validPeriods[0].from.slice(0, 10) + 'T00:00:00');
          const lastTo = new Date(validPeriods[validPeriods.length - 1].to.slice(0, 10) + 'T00:00:00');
          const calcDays = Math.round((lastTo.getTime() - firstFrom.getTime()) / 86400000) + 1;
          if (calcDays > 0) { setRfDays(calcDays); setRfDaysManual(true); }
        }
      }
      if (details.rf_fuel_start) setRfFuelStartTank(details.rf_fuel_start);
      if (details.rf_fuel_end) setRfFuelEndTank(details.rf_fuel_end);
      // Restore RF fuel from saved data
      if (details.fuel_rf && shared?.setFuelRf) {
        shared.setFuelRf({
          liters: Number(details.fuel_rf.liters) || 0,
          amount: Number(details.fuel_rf.amount) || 0,
        });
      }
      // RF contracts restore
      const hasSavedPeriods = reportRow.rf_periods && Array.isArray(reportRow.rf_periods) && reportRow.rf_periods.length > 0
        && reportRow.rf_periods.some((p: any) => p.from && p.to);
      if (details.rf_contracts_data && Array.isArray(details.rf_contracts_data) && details.rf_contracts_data.length > 0) {
        setRfContracts(details.rf_contracts_data);
        console.log('[LOAD] rf_contracts_data:', details.rf_contracts_data.length, 'contracts');
        // Авто-заполнение периода если не сохранён
        if (!hasSavedPeriods && reportRow.date_from && reportRow.date_to) {
          const autoFilled = autoFillPeriodFromContracts(details.rf_contracts_data, reportRow.date_from, reportRow.date_to);
          // Fetch GPS mileage for the RF period specifically (not total report mileage)
          if (autoFilled && reportRow.vehicle_number) {
            try {
              const res = await fetch(`/api/reports/telematics/mileage?vehicle=${encodeURIComponent(reportRow.vehicle_number)}&from=${autoFilled.from}&to=${autoFilled.to}`);
              const data = await res.json();
              if (data.mileage != null) setRfGpsMileage(data.mileage);
            } catch (e) { console.error('[restoreRfData] RF GPS fetch error:', e); }
          }
        }
      } else if ((reportRow.vehicle_number || reportRow.driver_name) && reportRow.date_from && reportRow.date_to) {
        console.log('[LOAD] No rf_contracts_data, fetching from API...');
        try {
          const tf2 = reportRow.time_from ? reportRow.time_from.slice(0, 5) : '00:00';
          const tt2 = reportRow.time_to ? reportRow.time_to.slice(0, 5) : '23:59';
          const rfFrom = reportRow.date_from + 'T' + tf2;
          const rfTo = reportRow.date_to + 'T' + tt2;
          const rfBp = new URLSearchParams({ from: rfFrom, to: rfTo });
        if (reportRow.vehicle_number) rfBp.append('vehicle', reportRow.vehicle_number);
          if (reportRow.driver_name) rfBp.append('driver', reportRow.driver_name);
          const rfR = await fetch(`/api/reports/contracts-rf-v2?${rfBp}`);
          const rfD = await rfR.json();
          if (rfD.contracts && rfD.contracts.length > 0) {
            setRfContracts(rfD.contracts);
            console.log('[LOAD] Fetched', rfD.contracts.length, 'RF contracts from API');
            // Авто-заполнение периода если не сохранён
            if (!hasSavedPeriods) {
              const autoFilled = autoFillPeriodFromContracts(rfD.contracts, reportRow.date_from, reportRow.date_to);
              // Fetch GPS mileage for the RF period specifically
              if (autoFilled && reportRow.vehicle_number) {
                try {
                  const gpsRes = await fetch(`/api/reports/telematics/mileage?vehicle=${encodeURIComponent(reportRow.vehicle_number)}&from=${autoFilled.from}&to=${autoFilled.to}`);
                  const gpsData = await gpsRes.json();
                  if (gpsData.mileage != null) setRfGpsMileage(gpsData.mileage);
                } catch (e) { console.error('[restoreRfData] RF GPS fetch error:', e); }
              }
              // Auto-save removed: data should only be saved explicitly via "Сохранить" button
            }
          }
        } catch (e) { console.warn('[LOAD] RF fetch error:', e); }
      }
    }
  };

  const resetRf = () => {
    setRfContracts([]);
  };

  return {
    // State
    rfContracts, setRfContracts,
    rfPeriods, setRfPeriods,
    rfDateFrom, setRfDateFrom,
    rfDateTo, setRfDateTo,
    rfGpsMileage, setRfGpsMileage,
    rfGpsLoading,
    rfRatePerKm, setRfRatePerKm,
    rfDaysManual, setRfDaysManual,
    rfDays, setRfDays,
    rfDailyRate, setRfDailyRate,
    rfFuelStartTank, setRfFuelStartTank,
    rfFuelEndTank, setRfFuelEndTank,
    selectedVehicleType, setSelectedVehicleType,
    selectedSeason, setSelectedSeason,
    autoRate, setAutoRate,
    tariffRates,
    vehicleTypes, setVehicleTypes,
    // Computed
    hasRfPeriods, hasRfData, effectiveRfMileage,
    rfDriverPay, rfDailyPay, rfBonus,
    avgFuelConsumption, fuelUsedRf,
    // Functions
    loadRfGps, restoreRfData, resetRf,
  };
}
