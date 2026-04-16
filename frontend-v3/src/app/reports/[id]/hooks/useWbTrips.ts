'use client';

import { useState, useMemo } from 'react';
import type { WbTrip } from '../types/report';

function getUniqueDays(trips: WbTrip[]): string[] {
  const days = new Set<string>();
  trips.forEach(t => {
    const start = new Date(t.loading_date);
    const end = new Date(t.unloading_date || t.loading_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.add(d.toISOString().slice(0, 10));
    }
  });
  return Array.from(days).sort();
}

export function useWbTrips(fuelWb: { liters: number; amount: number }, isEditMode?: boolean) {
  const [wbTrips, setWbTrips] = useState<WbTrip[]>([]);
  const [wbTotals, setWbTotals] = useState({ count: 0, driver_rate: 0 });
  const [wbGpsMileage, setWbGpsMileage] = useState(0);
  const [wbDays, setWbDays] = useState(0);
  const [excludedIdles, setExcludedIdles] = useState<Set<number>>(new Set());

  const totalIdleData = useMemo(() => {
    let totalIdleHours = 0;
    let paidHours = 0;
    let totalIdleAmount = 0;
    for (let i = 1; i < wbTrips.length; i++) {
      if (excludedIdles.has(i)) continue;
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

  const fuelUsedWb = fuelWb.liters;
  const avgFuelConsumptionWb = wbGpsMileage > 0 && fuelUsedWb > 0
    ? (fuelUsedWb / wbGpsMileage * 100).toFixed(2)
    : "0";

  /** Load WB trips from API (called from handleAutoFill) */
  const loadWbTrips = async (params: { driver: string; from: string; to: string; vehicle?: string }) => {
    if (!isEditMode) setExcludedIdles(new Set()); // Only clear excluded idles on fresh load, preserve in edit mode
    const baseParams = new URLSearchParams({ driver: params.driver, from: params.from, to: params.to });
    if (params.vehicle) baseParams.append("vehicle", params.vehicle);

    const wbRes = await fetch(`/api/reports/trips-detail-v2?${baseParams}`);
    let wbData = await wbRes.json();
    // Vehicle fallback: if no trips with vehicle, retry by driver only
    if ((!wbData.trips || wbData.trips.length === 0) && params.vehicle && params.driver) {
      const fallbackParams = new URLSearchParams({ driver: params.driver, from: params.from, to: params.to });
      const wbRes2 = await fetch(`/api/reports/trips-detail-v2?${fallbackParams}`);
      const wbData2 = await wbRes2.json();
      if (wbData2.trips?.length > 0) {
        console.log('[WB] Vehicle fallback: found', wbData2.trips.length, 'trips by driver only');
        wbData = wbData2;
      }
    }

    if (wbData.trips) {
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

      if (params.vehicle) {
        const uniqueDays = getUniqueDays(wbData.trips);
        setWbDays(uniqueDays.length);
        if (uniqueDays.length > 0) {
          const wbGpsRes = await fetch("/api/reports/telematics/mileage-by-dates", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vehicle: params.vehicle, dates: uniqueDays })
          });
          const wbGpsData = await wbGpsRes.json();
          const wbGps = wbGpsData.total || 0;
          setWbGpsMileage(wbGps);
          return { wbGpsMileage: wbGps };
        }
      }
    }
    return { wbGpsMileage: 0 };
  };

  /** Restore WB data from saved report */
  const restoreWbData = async (reportRow: any, details: any) => {
    // From report row (approved)
    if (reportRow.status === 'approved' && reportRow.wb_mileage) {
      setWbGpsMileage(Number(reportRow.wb_mileage) || 0);
    }
    // From details
    if (details) {
      if (details.wb_totals) setWbTotals(details.wb_totals);
      if (details.excluded_idle_trips) setExcludedIdles(new Set(details.excluded_idle_trips));
      if (details.wb_gps_mileage) setWbGpsMileage(details.wb_gps_mileage);
      if (details.wb_days) setWbDays(details.wb_days);

      if (details.wb_trips_data && Array.isArray(details.wb_trips_data) && details.wb_trips_data.length > 0) {
        setWbTrips(details.wb_trips_data);
        console.log('[LOAD] wb_trips_data:', details.wb_trips_data.length, 'trips');
      } else if (reportRow.driver_name && reportRow.date_from && reportRow.date_to) {
        // No saved WB data - auto-fetch from API
        console.log('[LOAD] No wb_trips_data, fetching from API...');
        try {
          const bp = new URLSearchParams({ driver: reportRow.driver_name, from: reportRow.date_from, to: reportRow.date_to });
          if (reportRow.vehicle_number) bp.append("vehicle", reportRow.vehicle_number);
          const wbR = await fetch(`/api/reports/trips-detail-v2?${bp}`);
          const wbD = await wbR.json();
          if (wbD.trips && wbD.trips.length > 0) {
            const sorted = [...wbD.trips].sort((a: any, b: any) =>
              new Date(`${a.loading_date}T${a.loading_time || '00:00'}`).getTime() - new Date(`${b.loading_date}T${b.loading_time || '00:00'}`).getTime()
            );
            setWbTrips(sorted);
            setWbTotals({ count: sorted.length, driver_rate: sorted.reduce((s: number, t: any) => s + parseFloat(t.driver_rate || 0), 0) });
            console.log('[LOAD] Fetched', sorted.length, 'WB trips from API');
          }
        } catch (e) { console.warn('[LOAD] WB fetch error:', e); }
      } else if (reportRow.status === 'approved' && reportRow.wb_mileage) {
        const wbRate = Number(details.wb_totals?.driver_rate) || Number(reportRow.driver_accruals) || 0;
        if (wbRate > 0) setWbTotals({ count: details.wb_totals?.count || 0, driver_rate: wbRate });
      }
    }
  };

  const resetWb = () => {
    setWbTrips([]);
    setWbTotals({ count: 0, driver_rate: 0 });
    setWbGpsMileage(0);
    setWbDays(0);
    setExcludedIdles(new Set());
  };

  return {
    wbTrips, setWbTrips,
    wbTotals, setWbTotals,
    wbGpsMileage, setWbGpsMileage,
    wbDays, setWbDays,
    excludedIdles, setExcludedIdles,
    totalIdleData,
    fuelUsedWb, avgFuelConsumptionWb,
    loadWbTrips, restoreWbData, resetWb,
    getUniqueDays,
  };
}
