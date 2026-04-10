'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import type { FuelBySource, WbTrip } from '../types/report';

function getSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 11 || month <= 2) return "Зима";
  if (month >= 6 && month <= 8) return "Лето";
  return "Межсезон";
}

interface FuelTransaction {
  id?: number;
  date: string;
  time?: string;
  source: string;
  liters: number;
  amount: number;
  card_number?: string;
  station_name?: string;
}

interface FuelSectionProps {
  loadFuel: () => void;
  fuelLoading: boolean;
  vehicleNumber: string;
  dateFrom: string;
  dateTo: string;
  fuelBySource: FuelBySource[];
  vehicleData: { id?: number; fuel_cards?: Record<string, string>; fuel_norm_winter?: number; fuel_norm_summer?: number; fuel_norm_autumn?: number };
  setVehicleData: (v: any) => void;
  fuelTransactions: FuelTransaction[];
  editingCards: boolean;
  setEditingCards: (v: boolean) => void;
  fuelTotal: { liters: number; amount: number; count: number };
  gpsMileage: number;
  wbGpsMileage: number;
  effectiveRfMileage: number;
  fuelWb: { liters: number; amount: number };
  fuelRf: { liters: number; amount: number };
  selectedSeason: string;
  wbTrips: WbTrip[];
  hasFuelSensor: boolean;
  sensorLoading: boolean;
  fuelStartTank: number | '';
  setFuelStartTank: (v: number | '') => void;
  fuelEndTank: number | '';
  setFuelEndTank: (v: number | '') => void;
  fuelUsed: number;
  showFuelDetails: boolean;
  setShowFuelDetails: (v: boolean) => void;
  avgFuelConsumptionTotal: string;
  autoRate: number | null;
  vehicleModel: string;
  manualRecoveryKm?: number;
}

export function FuelSection({
  loadFuel, fuelLoading, vehicleNumber, dateFrom, dateTo,
  fuelBySource, vehicleData, setVehicleData, fuelTransactions,
  editingCards, setEditingCards, fuelTotal,
  gpsMileage, wbGpsMileage, effectiveRfMileage,
  fuelWb, fuelRf, selectedSeason, wbTrips,
  hasFuelSensor, sensorLoading,
  fuelStartTank, setFuelStartTank, fuelEndTank, setFuelEndTank,
  fuelUsed, showFuelDetails, setShowFuelDetails,
  avgFuelConsumptionTotal, autoRate, vehicleModel,
  manualRecoveryKm = 0
}: FuelSectionProps) {
  const totalMileage = gpsMileage + manualRecoveryKm;
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-cyan-500/30">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-cyan-400">⛽ Топливо</h2>
        <button onClick={loadFuel} disabled={fuelLoading || !vehicleNumber || !dateFrom || !dateTo}
          className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white px-3 py-2 sm:py-1 rounded text-sm flex items-center gap-1 min-h-[44px] sm:min-h-0">
          {fuelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Загрузить
        </button>
      </div>
      {fuelBySource.length > 0 ? (
        <>
          <div className="space-y-2 mb-3">
            {fuelBySource.map((f, i) => {
              const savedCard = vehicleData.fuel_cards?.[f.source];
              const transactionCards = [...new Set(fuelTransactions.filter(t => t.source === f.source && t.card_number).map(t => t.card_number))];
              const cardNumber = savedCard || transactionCards[0];
              return (
                <div key={i} className="flex justify-between bg-slate-700/50 rounded px-3 py-2">
                  <div>
                    <div className="text-slate-300">{f.source || "Неизвестно"}</div>
                    {transactionCards.map((cn: string) => (
                      <div key={cn} className="text-xs text-slate-500">💳 {cn}</div>
                    ))}
                    {!transactionCards.length && cardNumber && <div className="text-xs text-slate-500">💳 {cardNumber}</div>}
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

          {/* Разбивка по периодам WB и РФ — таблица */}
          {totalMileage > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="text-sm text-slate-400 mb-2">📊 Расход по периодам:</div>
              {(() => {
                const hasTankData = Number(fuelStartTank) > 0 || Number(fuelEndTank) > 0;
                const wbMileage = wbGpsMileage > 0 ? wbGpsMileage : Math.max(0, gpsMileage - effectiveRfMileage);
                const wbFuel = fuelWb.liters;
                const rfFuel = fuelRf.liters;
                // When tank data available: distribute actual consumption proportionally
                const totalFuelRefueled = fuelTotal.liters || 1;
                const wbConsumed = hasTankData && fuelUsed > 0 ? fuelUsed * (wbFuel / totalFuelRefueled) : 0;
                const rfConsumed = hasTankData && fuelUsed > 0 ? fuelUsed * (rfFuel / totalFuelRefueled) : 0;
                const wbConsumption = hasTankData
                  ? (wbMileage > 0 && wbConsumed > 0 ? (wbConsumed / wbMileage * 100) : 0)
                  : 0; // no tank = show —
                const rfConsumptionVal = hasTankData
                  ? (effectiveRfMileage > 0 && rfConsumed > 0 ? (rfConsumed / effectiveRfMileage * 100) : 0)
                  : 0;
                const totalConsumption = hasTankData
                  ? (totalMileage > 0 && fuelUsed > 0 ? (fuelUsed / totalMileage * 100) : (fuelUsed < 0 ? -1 : 0))
                  : 0; // no tank = show —
                const normKey = selectedSeason === 'Зима' ? 'fuel_norm_winter' : selectedSeason === 'Осень' ? 'fuel_norm_autumn' : 'fuel_norm_summer';
                const norm = vehicleData?.[normKey as keyof typeof vehicleData] as number || 0;
                const overThreshold = norm > 0 ? norm * 1.3 : 999;
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs">
                        <th className="text-left pb-1"></th>
                        <th className="text-right pb-1">Пробег</th>
                        <th className="text-right pb-1">Топливо</th>
                        <th className="text-right pb-1">Расход</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(wbGpsMileage > 0 || wbTrips.length > 0) && wbMileage > 0 && (
                        <tr className="border-t border-slate-700/50">
                          <td className="py-1 text-purple-400">🚛 WB</td>
                          <td className="py-1 text-right text-slate-300">{wbMileage.toLocaleString()} км</td>
                          <td className="py-1 text-right text-slate-300">{Math.round(wbFuel).toLocaleString()} л</td>
                          <td className={`py-1 text-right font-bold ${wbConsumption > overThreshold ? 'text-red-400' : wbConsumption > 0 ? 'text-purple-400' : 'text-slate-500'}`}>
                            {!hasTankData ? '—' : wbConsumption > 0 ? wbConsumption.toFixed(1) : '—'} {hasTankData && wbConsumption > overThreshold ? '⚠️' : ''}
                          </td>
                        </tr>
                      )}
                      {effectiveRfMileage > 0 && (
                        <tr className="border-t border-slate-700/50">
                          <td className="py-1 text-orange-400">📋 РФ</td>
                          <td className="py-1 text-right text-slate-300">{effectiveRfMileage.toLocaleString()} км</td>
                          <td className="py-1 text-right text-slate-300">{Math.round(rfFuel).toLocaleString()} л</td>
                          <td className={`py-1 text-right font-bold ${rfConsumptionVal > overThreshold ? 'text-red-400' : rfConsumptionVal > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                            {!hasTankData ? '—' : rfConsumptionVal > 0 ? rfConsumptionVal.toFixed(1) : '—'} {hasTankData && rfConsumptionVal > overThreshold ? '⚠️' : ''}
                          </td>
                        </tr>
                      )}
                      {manualRecoveryKm > 0 && (
                        <tr className="border-t border-slate-700/50">
                          <td className="py-1 text-fuchsia-400">🟣 Ручной</td>
                          <td className="py-1 text-right text-slate-300">{manualRecoveryKm.toLocaleString()} км</td>
                          <td className="py-1 text-right text-slate-500">—</td>
                          <td className="py-1 text-right text-slate-500">—</td>
                        </tr>
                      )}
                      <tr className="border-t border-slate-600 font-bold">
                        <td className="py-1 text-white">ИТОГО</td>
                        <td className="py-1 text-right text-white">{totalMileage.toLocaleString()} км</td>
                        <td className="py-1 text-right text-white">{hasTankData ? `${Math.round(fuelUsed)} л` : `${Math.round(fuelTotal.liters).toLocaleString()} л`}{hasTankData && <span className="text-xs text-slate-500 ml-1" title="бак нач. + заправлено − бак кон.">факт</span>}</td>
                        <td className={`py-1 text-right ${!hasTankData ? 'text-slate-500' : totalConsumption < 0 ? 'text-amber-400' : totalConsumption > overThreshold ? 'text-red-400' : totalConsumption > 50 ? 'text-yellow-400' : 'text-yellow-400'}`}>
                          {!hasTankData ? '—' : totalConsumption < 0 ? <span title="Бак вырос больше чем заправлено. Проверьте остатки.">⚠️ Проверьте</span> : totalConsumption > 0 ? totalConsumption.toFixed(1) : '—'} {hasTankData && totalConsumption > overThreshold ? '⚠️' : ''}
                        </td>
                      </tr>
                      {norm > 0 && (
                        <tr className="text-xs text-slate-500">
                          <td colSpan={3} className="pt-1">Норма ({selectedSeason}):</td>
                          <td className="pt-1 text-right">{norm} л/100км</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                );
              })()}
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
                <div className="mt-2 max-h-60 overflow-y-auto overflow-x-auto">
                  <div className="min-w-[400px]">
                    <div className="grid grid-cols-6 gap-1 text-xs text-slate-500 px-2 py-1 border-b border-slate-700 mb-1 sticky top-0 bg-slate-800">
                      <span>Дата</span><span>Источник</span><span>АЗС</span><span>Карта</span><span className="text-right">Литры</span><span className="text-right">Сумма</span>
                    </div>
                    {fuelTransactions.map((t: any) => (
                      <div key={t.id || `${t.date}-${t.time}-${t.card_number}-${t.liters}`} className="grid grid-cols-6 gap-1 bg-slate-900/50 rounded px-2 py-1 text-xs">
                        <span className="text-slate-400">{t.date}</span>
                        <span className="text-slate-500">{t.source}</span>
                        <span className="text-slate-500 truncate" title={t.station_name}>{t.station_name || '—'}</span>
                        <span className="text-slate-600 truncate" title={t.card_number}>{t.card_number || '—'}</span>
                        <span className="text-cyan-400 text-right">{Number(t.liters).toLocaleString()} л</span>
                        <span className="text-slate-300 text-right">{Number(t.amount).toLocaleString()} ₽</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {totalMileage > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <div className="text-slate-400 text-xs">Пробег</div>
                  <div className="font-semibold">{totalMileage.toLocaleString()} км</div>
                  {manualRecoveryKm > 0 && <div className="text-xs text-fuchsia-400">+{manualRecoveryKm.toLocaleString()} ручной</div>}
                </div>
                <div>
                  <div className="text-slate-400 text-xs">Расход общий</div>
                  <div className="font-semibold text-yellow-400">{avgFuelConsumptionTotal} л/100км</div>
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
  );
}
