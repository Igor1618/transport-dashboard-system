'use client';

import { useState } from 'react';

interface GpsCoverageData {
  total_days: number;
  covered_days: number;
  coverage_pct: number;
  loaded_at?: string;
  days: { date: string; points: number; km: number; status: string }[];
}

interface GpsRecoveryData {
  recoveries?: {
    id: number;
    gap_start: string;
    gap_end: string;
    recovered_km: number;
    source: string;
    is_confirmed: boolean;
  }[];
  total_km?: number;
  confirmed_km?: number;
}

interface GpsCoverageBlockProps {
  vehicleNumber: string;
  dateFrom: string;
  dateTo: string;
  gpsCoverage: GpsCoverageData | null;
  setGpsCoverage: (v: GpsCoverageData | null) => void;
  gpsRecovery: GpsRecoveryData | null;
  setGpsRecovery: (v: GpsRecoveryData | null) => void;
}

export function GpsCoverageBlock({
  vehicleNumber, dateFrom, dateTo,
  gpsCoverage, setGpsCoverage,
  gpsRecovery, setGpsRecovery,
}: GpsCoverageBlockProps) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  if (!vehicleNumber || !dateFrom || !dateTo) return null;

  return (
    <>
      {/* 📡 Покрытие GPS */}
      <div className="bg-slate-800 rounded-xl p-4 border border-cyan-500/30">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-cyan-400">📡 Покрытие GPS</h2>
          <span className={`text-sm font-bold ${(gpsCoverage?.coverage_pct ?? 0) >= 80 ? 'text-green-400' : (gpsCoverage?.coverage_pct ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {gpsCoverage ? `${gpsCoverage?.covered_days ?? 0}/${gpsCoverage?.total_days ?? 0} дней (${gpsCoverage?.coverage_pct ?? 0}%)` : "—"}
          </span>
          <button onClick={async () => {
            setGpsLoading(true);
            try {
              const covRes = await fetch(`/api/reports/gps-coverage?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom.split('T')[0]}&to=${dateTo.split('T')[0]}`);
              if (covRes.ok) { const covData = await covRes.json(); setGpsCoverage(covData); }
            } catch(e) { console.error('[gps-coverage]', e); }
            setGpsLoading(false);
          }} className="ml-2 px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-blue-400 rounded border border-slate-600" disabled={gpsLoading}>
            {gpsLoading ? '⏳ Обновляем…' : '🔄 Обновить GPS'}
          </button>
          {gpsCoverage && (gpsCoverage as any).loaded_at && <span className="text-xs text-slate-500 ml-2">Обновлено: {new Date((gpsCoverage as any).loaded_at).toLocaleString('ru-RU')}</span>}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <div key={d} className="text-slate-500 font-medium pb-1">{d}</div>)}
          {(() => {
            if (!gpsCoverage || !gpsCoverage.days?.length) return null;
            const firstDate = new Date(gpsCoverage.days[0].date);
            const dow = (firstDate.getDay() + 6) % 7;
            const cells: any[] = [];
            for (let i = 0; i < dow; i++) cells.push(<div key={`e${i}`} />);
            (gpsCoverage?.days || []).forEach(d => {
              const day = new Date(d.date).getDate();
              const isRecovered = d.status !== 'ok' && gpsRecovery?.recoveries?.some((r: any) => d.date >= (r.gap_start||'').slice(0,10) && d.date <= (r.gap_end||'').slice(0,10) && r.is_confirmed);
              const bg = d.status === 'ok' ? 'bg-green-500/30 text-green-300' : isRecovered ? 'bg-blue-500/30 text-blue-300' : d.status === 'partial' ? 'bg-yellow-500/30 text-yellow-300' : 'bg-red-500/20 text-red-400';
              cells.push(
                <div key={d.date} className={`rounded p-1 ${bg} cursor-default`} title={`${d.date}: ${d.points} точек, ${d.km} км`}>
                  {day}
                </div>
              );
            });
            return cells;
          })()}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span>🟢 GPS</span><span>🟡 Частично</span><span>🔴 Нет GPS</span><span>🔵 Восстановлен</span>
        </div>
      </div>

      {/* Восстановление пробега */}
      {gpsCoverage && (gpsCoverage?.total_days ?? 0) > 0 && (gpsCoverage?.coverage_pct ?? 0) < 90 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-orange-500/30">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold text-orange-400">🔧 Восстановление пробега</h2>
            {!gpsRecovery?.recoveries?.length && (
              <button onClick={async () => {
                setRecoveryLoading(true);
                try {
                  const r = await fetch('/api/gps/recover-mileage', {
                    method: 'POST',
                    headers: { 'x-user-role': localStorage.getItem('userRole') || 'director', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vehicle: vehicleNumber, from: dateFrom?.split('T')[0], to: dateTo?.split('T')[0], dry_run: false })
                  });
                  const d = await r.json();
                  if (d.total_recovered_km > 0) {
                    alert('Найдено ' + (d.details?.length || 0) + ' дырок, восстановлено ~' + d.total_recovered_km + ' км');
                    const r2 = await fetch('/api/gps/recovery?vehicle=' + encodeURIComponent(vehicleNumber) + '&from=' + dateFrom?.split('T')[0] + '&to=' + dateTo?.split('T')[0]);
                    if (r2.ok) setGpsRecovery(await r2.json());
                  } else { alert('Рейсы WB за период дырок не найдены'); }
                } catch(e: any) { alert('Ошибка: ' + e.message); }
                setRecoveryLoading(false);
              }} className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs text-white" disabled={recoveryLoading}>
                {recoveryLoading ? 'Поиск...' : 'Найти рейсы в дырках'}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-2">
            GPS отсутствовал {(gpsCoverage?.total_days ?? 0) - (gpsCoverage?.covered_days ?? 0)} дней. Пробег можно восстановить из рейсов WB.
          </p>
          {gpsRecovery?.recoveries?.length > 0 && (
            <div className="space-y-2">
              {gpsRecovery.recoveries.map((r: any) => (
                <div key={r.id} className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-white font-medium">
                      {(r.gap_start||'').slice(5,10).split('-').reverse().join('.')} — {(r.gap_end||'').slice(5,10).split('-').reverse().join('.')}
                    </span>
                    <span className="text-orange-300 font-bold">{parseFloat(r.recovered_km).toLocaleString()} км</span>
                  </div>
                  <div className="text-xs text-slate-400 mb-1">
                    {r.source === 'auto_wb' ? 'WB рейсы' : r.source === 'manual' ? 'Ручной' : r.source}
                  </div>
                  <div className="flex gap-2">
                    {r.is_confirmed ? (
                      <span className="text-green-400 text-xs">Подтверждён</span>
                    ) : (
                      <>
                        <button onClick={async () => {
                          await fetch('/api/gps/recovery/' + r.id + '/confirm', { method: 'POST', headers: { 'x-user-role': localStorage.getItem('userRole') || 'director' } });
                          const r2 = await fetch('/api/gps/recovery?vehicle=' + encodeURIComponent(vehicleNumber) + '&from=' + dateFrom?.split('T')[0] + '&to=' + dateTo?.split('T')[0]);
                          if (r2.ok) setGpsRecovery(await r2.json());
                        }} className="px-2 py-0.5 bg-green-600 hover:bg-green-700 rounded text-xs text-white">Подтвердить</button>
                        <button onClick={async () => {
                          if (!confirm('Удалить?')) return;
                          await fetch('/api/gps/recovery/' + r.id + '/reject', { method: 'POST', headers: { 'x-user-role': localStorage.getItem('userRole') || 'director' } });
                          const r2 = await fetch('/api/gps/recovery?vehicle=' + encodeURIComponent(vehicleNumber) + '&from=' + dateFrom?.split('T')[0] + '&to=' + dateTo?.split('T')[0]);
                          if (r2.ok) setGpsRecovery(await r2.json());
                        }} className="px-2 py-0.5 bg-red-600/50 hover:bg-red-600 rounded text-xs text-white">Отклонить</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-slate-600 text-sm">
                <span className="text-slate-400">Итого восстановлено:</span>
                <span className="text-orange-300 font-bold">{gpsRecovery.total_km?.toLocaleString()} км (подтв: {gpsRecovery.confirmed_km?.toLocaleString()} км)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
