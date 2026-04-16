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
          {wbTrips.some(t => t.already_in_report) && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mb-3 text-xs text-red-400">
              ⚠️ {wbTrips.filter(t => t.already_in_report).length} рейс(ов) уже в другом отчёте
            </div>
          )}
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
                          setExcludedIdles(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(i)) newSet.delete(i);
                            else newSet.add(i);
                            return newSet;
                          });
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
                      {t.rate_source === 'unclosed' ? (
                        <span className="text-yellow-500 text-xs shrink-0 ml-2" title="Рейс не завершён в WB, сумма не начисляется">⚠️ 0₽</span>
                      ) : t.rate_source === 'tonnage_override' ? (
                        <span className="text-orange-400 text-sm shrink-0 ml-2" title={`Пятитонка на маршруте *90. Тариф: ${t.original_rate?.toLocaleString()}→${Number(t.driver_rate).toLocaleString()} (маршрут ${t.override_to})`}>⚠️ {Number(t.driver_rate).toLocaleString()}</span>
                      ) : (
                        <span className="text-green-400 text-sm shrink-0 ml-2">{Number(t.driver_rate).toLocaleString()}</span>
                      )}
                    </div>
                    <div className="text-slate-300 text-xs truncate mt-0.5">
                      {t.tender_id ? <span className="text-slate-500">[{t.tender_id}] </span> : null}
                      {t.route_name}
                      {t.rate_source === 'tonnage_override' && <span className="text-orange-400 ml-1" title={`Маршрут *90→*45 (5т на маршруте 20т)`}>🔄 *90→*45</span>}
                      {t.rate_source === 'unclosed' && <span className="text-yellow-500 ml-1" title="Рейс не завершён в WB (isClosed=0, totalPrice=null)">⏳ не завершён</span>}
                      {t.rate_source === 'fallback' && <span className="text-yellow-500 ml-1" title="Тариф по названию маршрута (fallback)">⚠️</span>}
                      {t.rate_source === 'none' && <span className="text-red-500 ml-1" title="Тариф не найден">❌</span>}
                      {t.already_in_report && <span className="text-red-400 ml-1 bg-red-500/15 px-1 rounded" title={`Этот рейс уже сохранён в отчёте №${t.already_in_report}`}>📋 №{t.already_in_report}</span>}
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

          <div className="flex justify-between border-t border-slate-700 pt-2 font-bold">
            <span className="text-purple-400">{wbDays} дн. → {wbGpsMileage.toLocaleString()} км</span>
            <span className="text-green-400">{wbTotals.driver_rate.toLocaleString()} ₽</span>
          </div>
        </>
      ) : <div className="text-slate-500 text-center py-4">Нет рейсов</div>}
    </div>
  );
}
