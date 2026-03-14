'use client';

import { useState } from 'react';
import type { FuelBySource } from '../types/report';

export function useFuel(gpsMileage: number) {
  // State
  const [fuelBySource, setFuelBySource] = useState<FuelBySource[]>([]);
  const [fuelTotal, setFuelTotal] = useState({ liters: 0, amount: 0, count: 0 });
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelTransactions, setFuelTransactions] = useState<{ date: string; time?: string; source: string; liters: number; amount: number; card_number?: string }[]>([]);
  const [showFuelDetails, setShowFuelDetails] = useState(false);
  const [editingCards, setEditingCards] = useState(false);
  const [fuelStartTank, setFuelStartTank] = useState<number | ''>('');
  const [fuelEndTank, setFuelEndTank] = useState<number | ''>('');
  const [hasFuelSensor, setHasFuelSensor] = useState(false);
  const [sensorLoading, setSensorLoading] = useState(false);

  // Computed
  const fuelUsed = fuelTotal.liters + (Number(fuelStartTank) || 0) - (Number(fuelEndTank) || 0);
  const avgFuelConsumptionTotal = gpsMileage > 0 && fuelTotal.liters > 0
    ? (fuelTotal.liters / gpsMileage * 100).toFixed(2)
    : gpsMileage === 0 && fuelTotal.liters > 0 ? "—" : "0";

  /** Load fuel data from API */
  const loadFuel = async (params: {
    vehicleNumber: string; dateFrom: string; dateTo: string;
    isDeleted?: boolean; isEditMode?: boolean; fullReportId?: string; userName?: string;
    rfPeriodsLength?: number; setFuelRf?: (v: { liters: number; amount: number }) => void;
  }) => {
    if (params.isDeleted) return;
    if (!params.vehicleNumber || !params.dateFrom || !params.dateTo) return;
    setFuelLoading(true);
    let detailData: any = null;
    try {
      const [detailRes, transRes] = await Promise.all([
        fetch(`/api/reports/fuel/detail?vehicle=${encodeURIComponent(params.vehicleNumber)}&from=${encodeURIComponent(params.dateFrom)}&to=${encodeURIComponent(params.dateTo)}`),
        fetch(`/api/reports/fuel/transactions?vehicle=${encodeURIComponent(params.vehicleNumber)}&from=${encodeURIComponent(params.dateFrom)}&to=${encodeURIComponent(params.dateTo)}`)
      ]);
      detailData = await detailRes.json();
      const transData = await transRes.json();
      setFuelBySource(detailData.by_source || []);
      setFuelTotal(detailData.total || { liters: 0, amount: 0, count: 0 });
      setFuelTransactions(transData.transactions || []);

      // If no separate RF periods - use total fuel as RF
      if ((params.rfPeriodsLength ?? 0) === 0 && detailData.total && params.setFuelRf) {
        params.setFuelRf({ liters: Number(detailData.total.liters) || 0, amount: Number(detailData.total.amount) || 0 });
      }
    } catch (e) {
      setFuelBySource([]);
      setFuelTotal({ liters: 0, amount: 0, count: 0 });
      setFuelTransactions([]);
    }
    // Auto-update DB if editing existing report
    if (params.isEditMode && params.fullReportId && detailData?.total) {
      try {
        await fetch('/api/reports/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: params.fullReportId,
            fuel_quantity: Number(detailData.total.liters) || 0,
            fuel_amount: Number(detailData.total.amount) || 0,
            user_name: params.userName || 'auto',
          })
        });
      } catch (e) { console.warn('[fuel] auto-save error:', e); }
    }
    setFuelLoading(false);
  };

  /** Restore fuel data from saved report */
  const restoreFuelData = (reportRow: any, details: any) => {
    if (reportRow) {
      setFuelTotal({ liters: reportRow.fuel_quantity || 0, amount: reportRow.fuel_amount || 0, count: 0 });
      setFuelStartTank(reportRow.fuel_start || '');
      setFuelEndTank(reportRow.fuel_end || '');
    }
    if (details) {
      if (details.fuel_by_source && Array.isArray(details.fuel_by_source)) {
        setFuelBySource(details.fuel_by_source);
        console.log('[LOAD] fuel_by_source:', details.fuel_by_source.length, 'sources');
      }
    }
  };

  const resetFuel = () => {
    setFuelBySource([]);
    setFuelTotal({ liters: 0, amount: 0, count: 0 });
  };

  return {
    fuelBySource, setFuelBySource,
    fuelTotal, setFuelTotal,
    fuelLoading,
    fuelTransactions, setFuelTransactions,
    showFuelDetails, setShowFuelDetails,
    editingCards, setEditingCards,
    fuelStartTank, setFuelStartTank,
    fuelEndTank, setFuelEndTank,
    hasFuelSensor, setHasFuelSensor,
    sensorLoading, setSensorLoading,
    fuelUsed, avgFuelConsumptionTotal,
    loadFuel, restoreFuelData, resetFuel,
  };
}
