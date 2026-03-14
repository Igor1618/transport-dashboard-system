"use client";
import { useState, useCallback, useMemo, useEffect } from "react";
import { RefreshCw, Calendar, Table2, ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
import { apiFetchJson } from "@/shared/utils/apiFetch";

const fmt = (n: number) => n ? new Intl.NumberFormat("ru-RU").format(Math.round(n)) : "0";
const fmtK = (n: number) => Math.abs(n) >= 1_000_000 ? (n/1e6).toFixed(1)+'М' : Math.abs(n) >= 1_000 ? Math.round(n/1e3)+'К' : fmt(n);

interface Trip {
  id: string; driver_name: string; driver_short: string;
  date_from: string; date_to: string; route_from: string | null; route_to: string | null;
  route_full?: string; type: 'wb' | 'rf' | 'report';
  order_number: string | null; status: string; source: string; amount?: number; contractor?: string;
}

interface Vehicle { id: string; number: string; category: string; vehicle_type: string; trips: Trip[]; }
interface Stats { total_vehicles: number; active_vehicles: number; free_vehicles: number; total_trips: number; wb_trips: number; rf_trips: number; report_fallback: number; utilization_pct: number; }
interface PlanningData { month: string; vehicles: Vehicle[]; stats: Stats; }

interface AdvanceOrg { org: string; drivers: any[]; totalDaily: number; totalAdvance: number; totalPay: number; count: number; }
interface AdvanceData { month: string; cutoff_day: number; organizations: AdvanceOrg[]; totals: { drivers: number; daily: number; advance: number; total: number; }; }

function getVehicleClass(vt: string) {
  if (!vt) return '5t';
  const l = vt.toLowerCase();
  return (l.includes('sitrack') || l.includes('sitrak') || l.includes('shacman') || l.includes('54901')) ? '20t' : '5t';
}

// Color by trip type+status
const TRIP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'wb-completed':  { bg: 'bg-green-700/70', border: 'border-green-600', text: 'text-green-100' },
  'wb-in_transit':  { bg: 'bg-blue-700/70', border: 'border-blue-500', text: 'text-blue-100' },
  'wb-planned':   { bg: 'bg-yellow-700/60', border: 'border-yellow-600', text: 'text-yellow-100' },
  'rf-completed':  { bg: 'bg-green-800/60', border: 'border-green-700 border-dashed', text: 'text-green-200' },
  'rf-in_transit':  { bg: 'bg-blue-800/60', border: 'border-blue-600 border-dashed', text: 'text-blue-200' },
  'rf-planned':   { bg: 'bg-yellow-800/50', border: 'border-yellow-700 border-dashed', text: 'text-yellow-200' },
  'report-completed': { bg: 'bg-slate-700/50', border: 'border-slate-600', text: 'text-slate-300' },
};

function tripStyle(trip: Trip) {
  const key = `${trip.type}-${trip.status}`;
  return TRIP_COLORS[key] || TRIP_COLORS['report-completed'];
}

const TYPE_LABELS: Record<string, string> = { wb: 'WB', rf: 'РФ', report: '📋' };
const STATUS_LABELS: Record<string, string> = { completed: '✅ Завершён', in_transit: '🚛 В пути', planned: '📋 Запланирован' };
const STATUS_ICONS: Record<string, string> = { completed: '✅', in_transit: '🚛', planned: '📋' };

export default function PlanningPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<'calendar' | 'table' | 'advance'>('calendar');
  const [planData, setPlanData] = useState<PlanningData | null>(null);
  const [advanceData, setAdvanceData] = useState<AdvanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetchJson(`/api/planning?month=${month}`);
      setPlanData(d);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [month]);

  const fetchAdvance = useCallback(async () => {
    try {
      const res = await apiFetchJson(`/api/schedule/advance?month=${month}`);
      setAdvanceData(res);
    } catch (e) { console.error(e); }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (view === 'advance') fetchAdvance(); }, [view, fetchAdvance]);

  const prevMonth = () => { const d = new Date(month + '-15'); d.setMonth(d.getMonth() - 1); setMonth(d.toISOString().slice(0, 7)); };
  const nextMonth = () => { const d = new Date(month + '-15'); d.setMonth(d.getMonth() + 1); setMonth(d.toISOString().slice(0, 7)); };
  const monthLabel = new Date(month + '-15').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const stats = planData?.stats;
  const vehicles = planData?.vehicles || [];
  const v5t = vehicles.filter(v => v.category === '5t');
  const v20t = vehicles.filter(v => v.category === '20t');

  const [yy, mm] = month.split('-').map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const dayNames = days.map(d => ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][new Date(yy, mm - 1, d).getDay()]);

  // Filtered trips for table view
  const allTrips = useMemo(() => {
    const trips: (Trip & { vehicle: string })[] = [];
    for (const v of vehicles) {
      for (const t of v.trips) {
        if (typeFilter !== 'all' && t.type !== typeFilter) continue;
        trips.push({ ...t, vehicle: v.number });
      }
    }
    return trips.sort((a, b) => a.date_from.localeCompare(b.date_from));
  }, [vehicles, typeFilter]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">📅 Планирование</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium min-w-[140px] text-center capitalize">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700"><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setView('calendar')} className={`px-3 py-1.5 rounded text-sm ${view === 'calendar' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            <Calendar size={14} className="inline mr-1" />Календарь
          </button>
          <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded text-sm ${view === 'table' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            <Table2 size={14} className="inline mr-1" />Таблица
          </button>
          <button onClick={() => setView('advance')} className={`px-3 py-1.5 rounded text-sm ${view === 'advance' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            <DollarSign size={14} className="inline mr-1" />Аванс 25-го
          </button>
          <button onClick={fetchData} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400"><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-2 py-1 bg-slate-800 rounded">📊 Загрузка: <b className="text-white">{stats.utilization_pct}%</b></span>
          <span className="px-2 py-1 bg-slate-800 rounded">🚛 Рейсов: <b className="text-white">{stats.total_trips}</b></span>
          <span className="px-2 py-1 bg-blue-900/40 rounded">WB: <b className="text-blue-300">{stats.wb_trips}</b></span>
          <span className="px-2 py-1 bg-green-900/40 rounded">РФ: <b className="text-green-300">{stats.rf_trips}</b></span>
          {stats.report_fallback > 0 && <span className="px-2 py-1 bg-slate-700/40 rounded">📋 Отчёты: <b className="text-slate-400">{stats.report_fallback}</b></span>}
          <span className="px-2 py-1 bg-amber-900/40 rounded">Свободных: <b className="text-amber-300">{stats.free_vehicles}</b></span>
        </div>
      )}

      {/* Legend */}
      {view === 'calendar' && (
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="px-1.5 py-0.5 bg-green-700/70 rounded text-green-100">WB ✅</span>
          <span className="px-1.5 py-0.5 bg-blue-700/70 rounded text-blue-100">WB 🚛</span>
          <span className="px-1.5 py-0.5 bg-yellow-700/60 rounded text-yellow-100">WB 📋</span>
          <span className="px-1.5 py-0.5 bg-green-800/60 rounded border border-dashed border-green-700 text-green-200">РФ ✅</span>
          <span className="px-1.5 py-0.5 bg-blue-800/60 rounded border border-dashed border-blue-600 text-blue-200">РФ 🚛</span>
          <span className="px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-300">📋 Отчёт</span>
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-slate-500" size={24} /></div>}

      {/* Calendar view */}
      {!loading && view === 'calendar' && (
        <div className="overflow-x-auto">
          <table className="text-[10px] border-collapse w-full min-w-[1200px]">
            <thead className="sticky top-0 z-10 bg-slate-900">
              <tr>
                <th className="sticky left-0 bg-slate-900 z-20 px-2 py-1 text-left min-w-[110px] border-b border-slate-700">Машина</th>
                {days.map(d => {
                  const isWeekend = [0, 6].includes(new Date(yy, mm - 1, d).getDay());
                  return (
                    <th key={d} className={`px-0.5 py-1 text-center border-b border-slate-700 min-w-[28px] ${isWeekend ? 'bg-slate-800/60' : ''}`}>
                      <div className="text-slate-500">{dayNames[d-1]}</div>
                      <div>{d}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {[{ label: '5 ТОНН', items: v5t }, { label: '20 ТОНН', items: v20t }].map(group => (
                <>{/* @ts-ignore */}
                  <tr key={group.label}><td colSpan={daysInMonth + 1} className="bg-slate-800/40 px-2 py-1 font-bold text-xs text-slate-400 border-b border-slate-700">{group.label} ({group.items.length})</td></tr>
                  {group.items.map(v => (
                    <tr key={v.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="sticky left-0 bg-slate-900 z-10 px-2 py-0.5 font-mono text-[10px] whitespace-nowrap">{v.number}</td>
                      {days.map(d => {
                        const isWeekend = [0, 6].includes(new Date(yy, mm - 1, d).getDay());
                        const dateStr = `${yy}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                        const trip = v.trips.find(t => t.date_from <= dateStr && t.date_to >= dateStr);
                        
                        if (!trip) {
                          return <td key={d} className={`px-0 py-0 ${isWeekend ? 'bg-slate-800/30' : ''}`}><div className="h-5"></div></td>;
                        }

                        const style = tripStyle(trip);
                        const isStart = trip.date_from === dateStr;
                        const route = trip.route_from && trip.route_to 
                          ? `${trip.route_from}→${trip.route_to}` 
                          : trip.route_from || '';
                        const tooltip = [
                          trip.driver_name,
                          route,
                          `${trip.date_from} — ${trip.date_to}`,
                          TYPE_LABELS[trip.type] + (trip.order_number ? ` ${trip.order_number}` : ''),
                          STATUS_LABELS[trip.status] || trip.status,
                        ].filter(Boolean).join('\n');

                        return (
                          <td key={d} 
                            className={`px-0 py-0 cursor-pointer ${style.bg} border ${style.border} hover:ring-1 hover:ring-white/30`}
                            title={tooltip}
                            onClick={() => setSelectedTrip(trip)}>
                            <div className={`text-[8px] leading-tight truncate px-px ${style.text}`}>
                              {isStart ? trip.driver_short : ''}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table view */}
      {!loading && view === 'table' && (
        <div>
          <div className="flex gap-2 mb-3">
            {['all','wb','rf','report'].map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`px-3 py-1 rounded text-xs ${typeFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {f === 'all' ? 'Все' : TYPE_LABELS[f]} {f !== 'all' ? `(${allTrips.filter(t => f === 'all' || t.type === f).length})` : `(${allTrips.length})`}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="border-b border-slate-700 text-xs text-slate-400">
                  <th className="px-2 py-2 text-left">№</th>
                  <th className="px-2 py-2 text-left">Машина</th>
                  <th className="px-2 py-2 text-left">Водитель</th>
                  <th className="px-2 py-2 text-left">Маршрут</th>
                  <th className="px-2 py-2 text-center">Тип</th>
                  <th className="px-2 py-2 text-center">С</th>
                  <th className="px-2 py-2 text-center">По</th>
                  <th className="px-2 py-2 text-center">Дней</th>
                  <th className="px-2 py-2 text-center">Статус</th>
                  <th className="px-2 py-2 text-left hidden md:table-cell">Заказ</th>
                </tr>
              </thead>
              <tbody>
                {allTrips.map((t, i) => {
                  const d1 = new Date(t.date_from), d2 = new Date(t.date_to);
                  const tripDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
                  const route = t.route_from && t.route_to ? `${t.route_from} → ${t.route_to}` : t.route_full || '—';
                  const style = tripStyle(t);
                  return (
                    <tr key={`${t.id}-${i}`} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer" onClick={() => setSelectedTrip(t)}>
                      <td className="px-2 py-1.5 text-xs text-slate-500">{i + 1}</td>
                      <td className="px-2 py-1.5 text-xs font-mono">{(t as any).vehicle}</td>
                      <td className="px-2 py-1.5 text-sm">{t.driver_name}</td>
                      <td className="px-2 py-1.5 text-xs text-slate-400 max-w-[200px] truncate">{route}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.type === 'wb' ? 'bg-blue-900/50 text-blue-300' : t.type === 'rf' ? 'bg-green-900/50 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                          {TYPE_LABELS[t.type]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-center">{d1.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</td>
                      <td className="px-2 py-1.5 text-xs text-center">{d2.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</td>
                      <td className="px-2 py-1.5 text-xs text-center font-medium">{tripDays}</td>
                      <td className="px-2 py-1.5 text-xs text-center">{STATUS_ICONS[t.status] || t.status}</td>
                      <td className="px-2 py-1.5 text-xs text-slate-500 hidden md:table-cell">{t.order_number || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advance view — keep old */}
      {!loading && view === 'advance' && advanceData && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div className="text-xs text-slate-500">Водителей</div><div className="text-xl font-bold">{advanceData.totals.drivers}</div></div>
            <div><div className="text-xs text-slate-500">Суточные</div><div className="text-xl font-bold text-blue-400">{fmtK(advanceData.totals.daily)}</div></div>
            <div><div className="text-xs text-slate-500">Аванс</div><div className="text-xl font-bold text-purple-400">{fmtK(advanceData.totals.advance)}</div></div>
            <div><div className="text-xs text-slate-500">Итого к выплате</div><div className="text-xl font-bold text-green-400">{fmtK(advanceData.totals.total)}</div></div>
          </div>
          {advanceData.organizations.map(o => (
            <div key={o.org} className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="bg-slate-800/80 px-4 py-2 flex justify-between items-center border-b border-slate-700">
                <span className="font-semibold text-sm">{o.org}</span>
                <span className="text-xs text-slate-400">{o.count} водителей · {fmt(o.totalPay)}₽</span>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800">
                  <th className="px-3 py-1.5 text-left text-xs text-slate-500">ФИО</th>
                  <th className="px-3 py-1.5 text-left text-xs text-slate-500">Машина</th>
                  <th className="px-3 py-1.5 text-center text-xs text-slate-500">Тонн.</th>
                  <th className="px-3 py-1.5 text-center text-xs text-slate-500">Дней</th>
                  <th className="px-3 py-1.5 text-right text-xs text-slate-500">Суточные</th>
                  <th className="px-3 py-1.5 text-right text-xs text-slate-500">Аванс</th>
                  <th className="px-3 py-1.5 text-right text-xs text-slate-500 font-medium">Итого</th>
                </tr></thead>
                <tbody>
                  {o.drivers.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20">
                      <td className="px-3 py-1 text-sm">{d.driver_name}</td>
                      <td className="px-3 py-1 text-xs font-mono">{d.vehicle}</td>
                      <td className="px-3 py-1 text-xs text-center">{d.tonnage}</td>
                      <td className="px-3 py-1 text-xs text-center">{d.days}</td>
                      <td className="px-3 py-1 text-xs text-right">{fmt(d.daily)}</td>
                      <td className="px-3 py-1 text-xs text-right">{fmt(d.advance)}</td>
                      <td className="px-3 py-1 text-sm text-right font-medium text-green-400">{fmt(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-slate-800/50">
                  <td colSpan={4} className="px-3 py-1.5 text-xs font-bold">ИТОГО {o.org}</td>
                  <td className="px-3 py-1.5 text-xs text-right font-bold">{fmt(o.totalDaily)}</td>
                  <td className="px-3 py-1.5 text-xs text-right font-bold">{fmt(o.totalAdvance)}</td>
                  <td className="px-3 py-1.5 text-sm text-right font-bold text-green-400">{fmt(o.totalPay)}</td>
                </tr></tfoot>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Trip detail popup */}
      {selectedTrip && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTrip(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{selectedTrip.driver_name || '—'}</h3>
                <span className={`text-xs px-2 py-0.5 rounded ${selectedTrip.type === 'wb' ? 'bg-blue-900/60 text-blue-300' : selectedTrip.type === 'rf' ? 'bg-green-900/60 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                  {TYPE_LABELS[selectedTrip.type]}{selectedTrip.order_number ? ` — ${selectedTrip.order_number}` : ''}
                </span>
              </div>
              <button onClick={() => setSelectedTrip(null)} className="text-slate-500 hover:text-white text-lg">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {selectedTrip.route_from && (
                <div className="col-span-2"><span className="text-slate-500">Маршрут:</span> {selectedTrip.route_from} → {selectedTrip.route_to || '?'}</div>
              )}
              {selectedTrip.route_full && (
                <div className="col-span-2 text-xs text-slate-500">{selectedTrip.route_full}</div>
              )}
              <div><span className="text-slate-500">Период:</span> {new Date(selectedTrip.date_from).toLocaleDateString('ru-RU')} — {new Date(selectedTrip.date_to).toLocaleDateString('ru-RU')}</div>
              <div><span className="text-slate-500">Статус:</span> {STATUS_LABELS[selectedTrip.status] || selectedTrip.status}</div>
              <div><span className="text-slate-500">Источник:</span> {selectedTrip.source}</div>
              {selectedTrip.amount && <div><span className="text-slate-500">Сумма:</span> <span className="text-green-400">{fmt(Number(selectedTrip.amount))}₽</span></div>}
              {selectedTrip.contractor && <div className="col-span-2"><span className="text-slate-500">Контрагент:</span> {selectedTrip.contractor}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
