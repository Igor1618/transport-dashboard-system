'use client';

import type { WbTrip } from '../types/report';

interface WbTripsSectionProps {
  wbTrips: WbTrip[];
  wbTotals: { count: number; driver_rate: number };
  wbGpsMileage: number;
  wbDays: number;
  excludedIdles: Set<number>;
  setExcludedIdles: (v: Set<number>) => void;
  totalIdleData: { hours: number; paidHours: number; amount: number };
  fuelUsedWb: number;
  avgFuelConsumptionWb: string;
  vehicleCards: any[];
  loadCardTransactions: (card: string, source: string) => void;
  unbindFuelCard: (card: string, source: string) => void;
  setShowCardModal: (v: boolean) => void;
}

const shortDate = (d: string) => {
  const p = d.slice(5, 10).split('-');
  return `${p[1]}.${p[0]}`;
};

export function WbTripsSection({
  wbTrips, wbTotals, wbGpsMileage, wbDays,
  excludedIdles, setExcludedIdles, totalIdleData,
  fuelUsedWb, avgFuelConsumptionWb,
  vehicleCards, loadCardTransactions, unbindFuelCard, setShowCardModal
}: WbTripsSectionProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-purple-500/30">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-purple-400">🚛 WB ({wbTotals.count})</h2>
        {wbGpsMileage > 0 && <span className="text-purple-400 font-bold">{wbGpsMileage.toLocaleString()} км</span>}
      </div>
      {wbTrips.length > 0 ? (
        <>
          <div className="space-y-1 mb-3 text-sm">
            {wbTrips.map((t, i) => {
              let idleHours = 0;
              if (i > 0 && wbTrips[i-1].unloading_date && wbTrips[i-1].unloading_time && t.loading_date && t.loading_time) {
                const prevEnd = new Date(`${wbTrips[i-1].unloading_date}T${wbTrips[i-1].unloading_time}`);
                const currStart = new Date(`${t.loading_date}T${t.loading_time}`);
                idleHours = Math.round((currStart.getTime() - prevEnd.getTime()) / 3600000);
              }
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
                      <span>⏸️ Простой: 8+{idleHours - 8} ч. (+{(idleHours - 8) * 100} ₽){excludedIdles.has(i) && ' (исключён)'}</span>
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
                  <div className="bg-slate-700/50 rounded px-2 py-1.5">
                    <div className="flex justify-between items-start">
                      <span className="text-slate-400 text-xs shrink-0">
                        {shortDate(t.loading_date)}{t.loading_time ? ` ${t.loading_time.slice(0,5)}` : ''}
                        →{shortDate(t.unloading_date || t.loading_date)}{t.unloading_time ? ` ${t.unloading_time.slice(0,5)}` : ''}
                        {tripHours > 0 && <span className="text-slate-500"> ({tripHours}ч)</span>}
                      </span>
                      <span className="text-green-400 text-sm shrink-0 ml-2">{Number(t.driver_rate).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-300 text-xs truncate mt-0.5">
                      {t.tender_id ? <span className="text-slate-500">[{t.tender_id}] </span> : null}
                      {t.route_name}
                      {t.rate_source === 'fallback' && <span className="text-yellow-500 ml-1" title="Тариф по названию маршрута (fallback)">⚠️</span>}
                      {t.rate_source === 'none' && <span className="text-red-500 ml-1" title="Тариф не найден">❌</span>}
                    </div>
                    {t.log_route && <div className="text-slate-500 text-[10px] truncate">{t.log_route}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Сводка по маршрутам */}
          <div className="bg-slate-700/30 rounded-lg p-2 mb-3 text-xs">
            <div className="text-slate-400 mb-1">📊 По маршрутам:</div>
            {Object.entries(wbTrips.reduce((acc: Record<string, number>, t) => {
              const route = (t.tender_id ? `[${t.tender_id}] ` : '') + (t.route_name?.split(' - ')[1] || t.route_name || 'Неизвестный');
              acc[route] = (acc[route] || 0) + 1;
              return acc;
            }, {})).map(([route, count]) => (
              <div key={route} className="flex justify-between text-slate-300">
                <span>{route}</span>
                <span className="text-purple-400">{count} рейс{count === 1 ? '' : count < 5 ? 'а' : 'ов'}</span>
              </div>
            ))}
            <div className="border-t border-slate-600 mt-2 pt-2 text-slate-400">
              🕐 Работа WB: {wbTrips.length > 0 ? `${wbTrips[0].loading_date?.slice(5, 10).split('-').reverse().join('.')} — ${wbTrips[wbTrips.length - 1].unloading_date?.slice(5, 10).split('-').reverse().join('.') || wbTrips[wbTrips.length - 1].loading_date?.slice(5, 10).split('-').reverse().join('.')}` : '—'}
            </div>
          </div>
          {/* Общий простой WB */}
          {totalIdleData.hours > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-2 text-xs">
              <div className="flex justify-between">
                <span className="text-yellow-400 font-medium">⏸️ Всего простой:</span>
                <span className="text-yellow-400 font-bold">{totalIdleData.paidHours} ч. → +{totalIdleData.amount.toLocaleString()} ₽</span>
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
          {/* Топливные карты */}
          {vehicleCards.length > 0 && (
            <div className="bg-slate-700/30 rounded p-2 mb-2 text-xs">
              <div className="text-slate-400 mb-1">Топливные карты:</div>
              <div className="flex flex-wrap gap-1">
                {vehicleCards.map((c: any, i: number) => (
                  <span key={i} className="bg-slate-700/50 px-2 py-0.5 rounded cursor-pointer hover:bg-slate-600/50 inline-flex items-center gap-1"
                    onClick={() => loadCardTransactions(c.card_number, c.source)}
                    title={`${c.tx_count} запр., ${Number(c.total_liters||0).toFixed(0)} л`}>
                    🔋 {c.source} ****{c.card_number.slice(-4)} ({Number(c.total_liters||0).toFixed(0)}л)
                    <button onClick={(e) => {e.stopPropagation(); unbindFuelCard(c.card_number, c.source);}} className="ml-1 text-red-400 hover:text-red-300 text-[10px]">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setShowCardModal(true)} className="text-xs text-cyan-400 hover:text-cyan-300 mb-2">+ Добавить карту</button>
          <div className="flex justify-between border-t border-slate-700 pt-2 font-bold">
            <span className="text-purple-400">{wbDays} дн. → {wbGpsMileage.toLocaleString()} км</span>
            <span className="text-green-400">{wbTotals.driver_rate.toLocaleString()} ₽</span>
          </div>
        </>
      ) : <div className="text-slate-500 text-center py-4">Нет рейсов</div>}
    </div>
  );
}
