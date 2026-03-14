'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import type { RfContract, RfPeriod } from '../types/report';

interface RfContractsSectionProps {
  rfContracts: RfContract[];
  rfPeriods: RfPeriod[];
  setRfPeriods: (v: RfPeriod[]) => void;
  setRfDateFrom: (v: string) => void;
  setRfDateTo: (v: string) => void;
  loadRfGps: () => void;
  rfGpsLoading: boolean;
  vehicleNumber: string;
  effectiveRfMileage: number;
  selectedVehicleType: string;
  setSelectedVehicleType: (v: string) => void;
  vehicleTypes: string[];
  selectedSeason: string;
  setSelectedSeason: (v: string) => void;
  rfRatePerKm: number;
  setRfRatePerKm: (v: number) => void;
  autoRate: number | null;
  tariffRates: { fuel_consumption: number; rate: number }[];
  avgFuelConsumption: string;
  hasRfPeriods: boolean;
  rfDriverPay: number;
  fuelRf: { liters: number; amount: number };
  rfFuelStartTank: number | '';
  setRfFuelStartTank: (v: number | '') => void;
  rfFuelEndTank: number | '';
  setRfFuelEndTank: (v: number | '') => void;
  hasFuelSensor: boolean;
  vehicleData: { fuel_norm_winter?: number; fuel_norm_summer?: number; fuel_norm_autumn?: number };
}

function PeriodsEditor({
  rfPeriods, setRfPeriods, setRfDateFrom, setRfDateTo,
  loadRfGps, rfGpsLoading, vehicleNumber, effectiveRfMileage
}: Pick<RfContractsSectionProps, 'rfPeriods' | 'setRfPeriods' | 'setRfDateFrom' | 'setRfDateTo' | 'loadRfGps' | 'rfGpsLoading' | 'vehicleNumber' | 'effectiveRfMileage'>) {
  return (
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
      {effectiveRfMileage > 0 && <div className="text-center mt-2 text-orange-400 font-bold text-xl">Итого: {effectiveRfMileage.toLocaleString()} км</div>}
    </div>
  );
}

function FuelStatsBlock({
  effectiveRfMileage, fuelRf, rfFuelStartTank, setRfFuelStartTank,
  rfFuelEndTank, setRfFuelEndTank, hasFuelSensor, selectedSeason, vehicleData,
  showNoMileageHint
}: {
  effectiveRfMileage: number;
  fuelRf: { liters: number; amount: number };
  rfFuelStartTank: number | '';
  setRfFuelStartTank: (v: number | '') => void;
  rfFuelEndTank: number | '';
  setRfFuelEndTank: (v: number | '') => void;
  hasFuelSensor: boolean;
  selectedSeason: string;
  vehicleData: { fuel_norm_winter?: number; fuel_norm_summer?: number; fuel_norm_autumn?: number };
  showNoMileageHint?: boolean;
}) {
  const rfFuelUsed = fuelRf.liters + (Number(rfFuelStartTank) || 0) - (Number(rfFuelEndTank) || 0);
  const rfConsumption = rfFuelUsed > 0 && effectiveRfMileage > 0 ? (rfFuelUsed / effectiveRfMileage * 100).toFixed(2) : "—";
  const norm = Number(selectedSeason === 'Зима' ? vehicleData.fuel_norm_winter : selectedSeason === 'Лето' ? vehicleData.fuel_norm_summer : vehicleData.fuel_norm_autumn) || 0;
  const inNorm = rfFuelUsed > 0 && Number(rfConsumption) <= (norm || 35);

  return (
    <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2 mb-2 text-xs mt-2">
      <div className="text-orange-400 font-medium mb-1">📊 За период РФ:</div>
      <div className="flex justify-between mb-1">
        <span className="text-slate-400">Пробег:</span>
        <span className="text-orange-400 font-bold">{effectiveRfMileage > 0 ? effectiveRfMileage.toLocaleString() + ' км' : showNoMileageHint ? '— (нажмите "Загрузить пробег")' : '—'}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span className="text-slate-400">Заправлено:</span>
        <span className="text-cyan-400 font-bold">{fuelRf.liters > 0 ? Math.round(fuelRf.liters).toLocaleString() + ' л' : '—'}</span>
      </div>
      {/* Остатки топлива в баке */}
      <div className="bg-slate-700/50 rounded p-2 my-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-slate-400">🛢️ Остатки в баке{showNoMileageHint ? ' (РФ)' : ''}:</span>
          {!showNoMileageHint && (hasFuelSensor ? (
            <span className="text-green-400 text-[10px]">✓ Датчик</span>
          ) : (
            <span className="text-yellow-400 text-[10px]">⚠️ Нет датчика — введите вручную</span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-slate-500 text-[10px]">Начало периода</label>
            <input type="number" placeholder="0" value={rfFuelStartTank}
              onChange={e => setRfFuelStartTank(e.target.value ? Number(e.target.value) : "")}
              className={`w-full rounded px-2 py-1 text-xs border text-center ${!showNoMileageHint && hasFuelSensor && rfFuelStartTank ? 'bg-green-900/30 text-green-300 border-green-600' : 'bg-slate-600 text-white border-slate-500'}`} />
          </div>
          <div>
            <label className="text-slate-500 text-[10px]">Конец периода</label>
            <input type="number" placeholder="0" value={rfFuelEndTank}
              onChange={e => setRfFuelEndTank(e.target.value ? Number(e.target.value) : "")}
              className={`w-full rounded px-2 py-1 text-xs border text-center ${!showNoMileageHint && hasFuelSensor && rfFuelEndTank ? 'bg-green-900/30 text-green-300 border-green-600' : 'bg-slate-600 text-white border-slate-500'}`} />
          </div>
        </div>
      </div>
      {/* Расход - отличается между двумя ветками */}
      {showNoMileageHint ? (
        <>
          {rfFuelUsed > 0 && (
            <div className="flex justify-between mb-1">
              <span className="text-slate-400">Израсходовано:</span>
              <span className="text-cyan-400 font-bold">{Math.round(rfFuelUsed).toLocaleString()} л</span>
            </div>
          )}
          {rfFuelUsed > 0 && effectiveRfMileage > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Расход факт:</span>
              <span className={`font-bold ${inNorm ? 'text-green-400' : 'text-red-400'}`}>
                {rfConsumption} л/100км {inNorm ? '✓' : '⚠️'}
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-between mb-1">
            <span className="text-slate-400">Израсходовано:</span>
            <span className={`font-bold ${rfFuelUsed < 0 ? 'text-red-400' : 'text-cyan-400'}`}>{rfFuelUsed !== 0 ? Math.round(rfFuelUsed).toLocaleString() + ' л' : '—'}{rfFuelUsed < 0 && ' ⚠️ заправки не загружены!'}</span>
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
        </>
      )}
    </div>
  );
}

export function RfContractsSection({
  rfContracts, rfPeriods, setRfPeriods, setRfDateFrom, setRfDateTo,
  loadRfGps, rfGpsLoading, vehicleNumber, effectiveRfMileage,
  selectedVehicleType, setSelectedVehicleType, vehicleTypes,
  selectedSeason, setSelectedSeason,
  rfRatePerKm, setRfRatePerKm, autoRate, tariffRates, avgFuelConsumption,
  hasRfPeriods, rfDriverPay,
  fuelRf, rfFuelStartTank, setRfFuelStartTank, rfFuelEndTank, setRfFuelEndTank,
  hasFuelSensor, vehicleData
}: RfContractsSectionProps) {
  const periodsProps = { rfPeriods, setRfPeriods, setRfDateFrom, setRfDateTo, loadRfGps, rfGpsLoading, vehicleNumber, effectiveRfMileage };
  const fuelProps = { effectiveRfMileage, fuelRf, rfFuelStartTank, setRfFuelStartTank, rfFuelEndTank, setRfFuelEndTank, hasFuelSensor, selectedSeason, vehicleData };

  return (
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
          <PeriodsEditor {...periodsProps} />
          <div className="border-t border-slate-700 pt-3 space-y-2">
            {/* Выбор ставки */}
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-2">💰 Расчёт ставки</div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-slate-400 text-sm">Тип:</span>
                {selectedVehicleType ? (
                  <span className="text-white font-medium">{selectedVehicleType}</span>
                ) : (
                  <select value={selectedVehicleType} onChange={e => setSelectedVehicleType(e.target.value)}
                    className="bg-slate-600 text-white rounded px-2 py-1.5 text-xs border border-slate-500 flex-1 min-w-0">
                    <option value="">Выберите тип</option>
                    {vehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                <span className="text-slate-500 hidden sm:inline">|</span>
                <select value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)}
                  className="bg-slate-600 text-white rounded px-2 py-1.5 text-xs border border-slate-500">
                  <option value="Зима">Зима</option>
                  <option value="Межсезон">Межсезон</option>
                  <option value="Лето">Лето</option>
                </select>
              </div>
              {/* Показываем расход и норму за РФ */}
              {hasRfPeriods && <FuelStatsBlock {...fuelProps} />}
              {tariffRates.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-slate-500 mb-1">Ставки по расходу:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {tariffRates.slice(0, 8).map((t, i) => (
                      <button key={i} onClick={() => setRfRatePerKm(Number(t.rate))}
                        className={`px-2 py-1.5 sm:py-1 rounded text-xs min-h-[36px] sm:min-h-0 ${rfRatePerKm === Number(t.rate) ? 'bg-green-600 text-white' : Number(avgFuelConsumption) <= t.fuel_consumption && Number(avgFuelConsumption) > (tariffRates[i-1]?.fuel_consumption || 0) ? 'bg-yellow-600 text-white ring-2 ring-yellow-400' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}>
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
          <PeriodsEditor {...periodsProps} />
          {/* Ставка и расчёт */}
          {hasRfPeriods && (
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
              {/* Топливо за период РФ */}
              <FuelStatsBlock {...fuelProps} showNoMileageHint />
              <div className="flex justify-between text-sm"><span className="text-slate-400">Начисления:</span><span className="text-green-400 font-bold">{rfDriverPay.toLocaleString()} ₽</span></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
