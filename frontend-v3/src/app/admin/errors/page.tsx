'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, RefreshCw, Clock, Bug } from 'lucide-react';

interface FrontendError {
  id: number; message: string; stack: string | null; url: string | null;
  line: number | null; col: number | null; user_agent: string | null;
  created_at: string;
}

interface TopError {
  message: string; cnt: string; last_seen: string; url: string | null;
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<FrontendError[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [top, setTop] = useState<TopError[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/errors?limit=50')
      .then(r => r.json())
      .then(d => {
        setErrors(d.errors || []);
        setTotals(d.totals || {});
        setTop(d.top || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const cleanup = async () => {
    if (!confirm('Удалить ошибки старше 30 дней?')) return;
    const res = await fetch('/api/errors', { method: 'DELETE' });
    const d = await res.json();
    alert(`Удалено: ${d.deleted}`);
    load();
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Bug className="w-6 h-6 text-red-400" /> Ошибки фронтенда
          </h1>
          <p className="text-slate-400 text-sm">Мониторинг JS ошибок на сайте</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white">
            <RefreshCw className="w-4 h-4" /> Обновить
          </button>
          <button onClick={cleanup} className="flex items-center gap-1 px-3 py-2 bg-red-600/30 hover:bg-red-600/50 rounded-lg text-sm text-red-400">
            <Trash2 className="w-4 h-4" /> Очистить
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> За час</div>
          <div className={`text-2xl font-bold ${(totals.last_hour || 0) > 10 ? 'text-red-400' : (totals.last_hour || 0) > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {totals.last_hour || 0}
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs">За сутки</div>
          <div className="text-2xl font-bold text-white">{totals.last_day || 0}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs">Всего</div>
          <div className="text-2xl font-bold text-white">{totals.total || 0}</div>
        </div>
      </div>

      {/* Top errors */}
      {top.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 text-white font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Топ ошибок (7 дней)
          </div>
          <div className="divide-y divide-slate-700/50">
            {top.map((e, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm truncate">{e.message}</div>
                  <div className="text-slate-500 text-xs truncate">{e.url || '—'}</div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <div className="text-red-400 font-bold">{e.cnt}×</div>
                  <div className="text-slate-500 text-xs">{fmtDate(e.last_seen)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 text-white font-semibold">
          Последние ошибки
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Загрузка...</div>
        ) : errors.length === 0 ? (
          <div className="p-8 text-center text-green-400">✅ Нет ошибок</div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {errors.map(e => (
              <div key={e.id} className="px-4 py-3 hover:bg-slate-700/30 cursor-pointer" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-red-400 text-sm font-medium truncate">{e.message}</div>
                    <div className="text-slate-500 text-xs">{e.url || '—'}{e.line ? `:${e.line}` : ''}</div>
                  </div>
                  <div className="text-slate-500 text-xs shrink-0">{fmtDate(e.created_at)}</div>
                </div>
                {expanded === e.id && e.stack && (
                  <pre className="mt-2 text-xs text-slate-400 bg-slate-900 rounded p-3 overflow-x-auto max-h-40">{e.stack}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
