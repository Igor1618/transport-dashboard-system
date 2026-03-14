'use client';

import { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

interface Recommendation {
  type: string; icon: string; category: string;
  title: string; details: string[]; action: string;
}
interface ForecastRow {
  month: string; revenue: number; expenses: number; profit: number; type: string;
}
interface TrendInfo {
  slope: number; intercept: number; r2: number; direction: string; monthly_change: number;
}

const API = process.env.NEXT_PUBLIC_API_URL || '';
const fmt = (n: number) => n.toLocaleString('ru-RU');
const fmtM = (n: number) => (n / 1_000_000).toFixed(1) + 'M';

export default function AnalyticsPage() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [history, setHistory] = useState<ForecastRow[]>([]);
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [trends, setTrends] = useState<Record<string, TrendInfo>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [tab, setTab] = useState<'recs' | 'forecast'>('recs');

  const load = async () => {
    setLoading(true);
    try {
      const [recRes, fcRes] = await Promise.all([
        fetch(`${API}/analytics-ai/recommendations`).then(r => r.json()),
        fetch(`${API}/analytics-ai/forecast/pnl?months=6&forecast=3`).then(r => r.json()),
      ]);
      setRecs(recRes.recommendations || []);
      setHistory(fcRes.history || []);
      setForecast(fcRes.forecast || []);
      setTrends(fcRes.trends || {});
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const typeColors: Record<string, string> = {
    critical: 'border-red-500 bg-red-500/10',
    warning: 'border-yellow-500 bg-yellow-500/10',
    info: 'border-blue-500 bg-blue-500/10',
    success: 'border-green-500 bg-green-500/10',
  };

  const TrendIcon = ({ dir }: { dir: string }) => {
    if (dir === 'рост') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (dir === 'снижение') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const allData = [...history, ...forecast];
  const maxVal = Math.max(...allData.map(d => Math.max(d.revenue, d.expenses)), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" /> AI-аналитика
          </h1>
          <p className="text-slate-400 text-sm">Рекомендации и прогнозы на основе данных</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1 px-3 py-2 bg-purple-600/30 hover:bg-purple-600/50 rounded-lg text-sm text-purple-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Обновить
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('recs')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'recs' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          🎯 Рекомендации {recs.length > 0 && <span className="ml-1 bg-purple-500/30 px-1.5 rounded-full text-xs">{recs.length}</span>}
        </button>
        <button onClick={() => setTab('forecast')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'forecast' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          📈 Прогноз
        </button>
      </div>

      {loading ? (
        <div className="bg-slate-800 rounded-xl p-12 text-center">
          <Brain className="w-8 h-8 text-purple-400 animate-pulse mx-auto mb-3" />
          <div className="text-slate-400">Анализирую данные...</div>
        </div>
      ) : tab === 'recs' ? (
        /* ─── Рекомендации ─── */
        <div className="space-y-3">
          {recs.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-8 text-center text-green-400">✅ Всё в порядке — рекомендаций нет</div>
          ) : recs.map((r, i) => (
            <div key={i} className={`border-l-4 rounded-xl p-4 ${typeColors[r.type] || typeColors.info}`}>
              <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpanded(expanded === i ? null : i)}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{r.icon}</span>
                    <span className="text-slate-400 text-xs uppercase tracking-wider">{r.category}</span>
                  </div>
                  <div className="text-white font-medium">{r.title}</div>
                </div>
                {expanded === i ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </div>
              {expanded === i && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <ul className="space-y-1 mb-3">
                    {r.details.map((d, j) => (
                      <li key={j} className="text-slate-300 text-sm flex items-start gap-2">
                        <span className="text-slate-500 mt-0.5">•</span> {d}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">💡 Рекомендация:</span>
                    <span className="text-white">{r.action}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ─── Прогноз ─── */
        <div className="space-y-4">
          {/* Trend cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(trends).map(([key, t]) => {
              const labels: Record<string, string> = { revenue: 'Выручка', expenses: 'Расходы', profit: 'Прибыль' };
              return (
                <div key={key} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <div className="text-slate-400 text-xs mb-1">{labels[key]}</div>
                  <div className="flex items-center gap-2">
                    <TrendIcon dir={t.direction} />
                    <span className="text-white font-bold">
                      {t.monthly_change > 0 ? '+' : ''}{fmtM(t.monthly_change)} ₽/мес
                    </span>
                  </div>
                  <div className="text-slate-500 text-xs mt-1">
                    {t.direction} · R² {(t.r2 * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-white font-semibold">Выручка / Расходы / Прогноз</span>
            </div>
            <div className="space-y-2">
              {allData.map((d, i) => (
                <div key={i} className={`${d.type === 'forecast' ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`${d.type === 'forecast' ? 'text-purple-400' : 'text-slate-400'}`}>
                      {d.month} {d.type === 'forecast' ? '(прогноз)' : ''}
                    </span>
                    <span className="text-white">{fmtM(d.profit)} ₽</span>
                  </div>
                  <div className="flex gap-1 h-5">
                    <div className="bg-green-500/80 rounded-sm" style={{ width: `${(d.revenue / maxVal) * 100}%` }} title={`Выручка: ${fmt(d.revenue)} ₽`} />
                    <div className="bg-red-500/50 rounded-sm" style={{ width: `${(d.expenses / maxVal) * 100}%` }} title={`Расходы: ${fmt(d.expenses)} ₽`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500/80 rounded-sm inline-block" /> Выручка</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500/50 rounded-sm inline-block" /> Расходы</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-500/50 rounded-sm inline-block" /> Прогноз</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
