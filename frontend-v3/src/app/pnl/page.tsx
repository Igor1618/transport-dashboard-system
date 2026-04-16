'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus,
  ChevronLeft, ChevronRight, RefreshCw, Truck, Fuel, AlertTriangle,
  DollarSign, Activity, Shield, Zap, ExternalLink
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell, ReferenceLine
} from 'recharts';

// ========== TYPES ==========
interface MetricDelta {
  value: number;
  prev: number | null;
  delta: number | null;
}

interface DashboardData {
  month_key: string;
  prev_month_key: string;
  calculated_at: string;
  empty?: boolean;
  message?: string;
  metrics: {
    net_revenue: MetricDelta;
    gross_revenue: MetricDelta;
    trip_contribution: MetricDelta;
    fleet_contribution: MetricDelta;
    operating_profit: MetricDelta;
    fuel_cost: MetricDelta;
    driver_salary: MetricDelta;
    platon_cost: MetricDelta;
    repair_cost: MetricDelta;
    penalties: MetricDelta;
  };
  margins: {
    trip_margin_pct: number;
    fleet_margin_pct: number;
    operating_margin_pct: number;
  };
  operational: {
    active_vehicles: number;
    total_trips: number;
    total_actual_km: number;
    commercial_utilization_pct: number;
    revenue_per_truck_day: number;
    fuel_per_km: number;
    penalty_pct: number;
    wb_share_pct: number;
  };
  vehicle_classes: Record<string, number>;
  top_losers: VehicleSummary[];
  top_earners: VehicleSummary[];
  alerts: Alert[];
}

interface VehicleSummary {
  plate: string;
  type: string;
  fleet_contribution: number;
  utilization: number;
  trips: number;
}

interface Alert {
  id: number;
  severity: string;
  category: string;
  entity_name: string;
  alert_code: string;
  message: string;
  metric_value: number;
  threshold_value: number;
}

interface WaterfallStep {
  label: string;
  value: number;
  type: string;
}

interface TrendItem {
  month_key: string;
  empty?: boolean;
  gross_revenue: number;
  net_revenue: number;
  trip_contribution: number;
  fleet_contribution: number;
  operating_profit: number;
  fuel_cost: number;
  driver_salary: number;
  trip_margin_pct: number;
  fleet_margin_pct: number;
  operating_margin_pct: number;
  active_vehicles: number;
  total_trips: number;
  commercial_utilization_pct: number;
}

// ========== HELPERS ==========
const fmtM = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString('ru-RU');
};

const fmtMoney = (n: number) => fmtM(n) + ' \u20BD';

const fmtMoneyFull = (n: number) =>
  Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' \u20BD';

const shortMonth = (key: string) => {
  const months = ['', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const m = parseInt(key.split('-')[1]);
  return months[m] || key;
};

// ========== COMPONENTS ==========

function DeltaArrow({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  if (Math.abs(delta) < 1) return <span className="text-slate-500 text-xs flex items-center gap-0.5"><Minus className="w-3 h-3" /> 0%</span>;
  return delta > 0
    ? <span className="text-green-400 text-xs flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> +{delta}%</span>
    : <span className="text-red-400 text-xs flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" /> {delta}%</span>;
}

function MetricCard({ label, metric, format, icon: Icon, color, invertDelta, subtext }: {
  label: string;
  metric: MetricDelta | number;
  format?: 'money' | 'number' | 'percent' | 'km';
  icon: any;
  color: string;
  invertDelta?: boolean;
  subtext?: string;
}) {
  const isMetricDelta = typeof metric === 'object' && metric !== null && 'value' in metric;
  const value = isMetricDelta ? metric.value : metric;
  const delta = isMetricDelta ? metric.delta : null;

  const displayDelta = invertDelta && delta != null ? -delta : delta;

  let displayValue: string;
  if (format === 'money') displayValue = fmtMoney(value);
  else if (format === 'percent') displayValue = value.toFixed(1) + '%';
  else if (format === 'km') displayValue = fmtM(value) + ' km';
  else displayValue = value.toLocaleString('ru-RU');

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-slate-400 text-xs">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color}`}>{displayValue}</div>
      <div className="flex items-center gap-2 mt-1">
        <DeltaArrow delta={displayDelta} />
        {subtext && <span className="text-slate-500 text-xs">{subtext}</span>}
      </div>
    </div>
  );
}

function WaterfallChart({ steps }: { steps: WaterfallStep[] }) {
  // Build waterfall data: each bar needs invisible base + visible bar
  let running = 0;
  const data = steps.map(s => {
    if (s.type === 'total') {
      running = s.value;
      return { name: s.label, base: 0, value: s.value, fill: '#3b82f6' };
    }
    if (s.type === 'subtotal') {
      running = s.value;
      return { name: s.label, base: 0, value: s.value, fill: '#8b5cf6' };
    }
    if (s.type === 'result') {
      return { name: s.label, base: 0, value: s.value, fill: s.value >= 0 ? '#22c55e' : '#ef4444' };
    }
    // expense (negative value)
    const absVal = Math.abs(s.value);
    const base = running - absVal;
    running = base;
    return { name: s.label, base: Math.max(base, 0), value: absVal, fill: '#ef4444' };
  });

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: number) => fmtM(v)} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#f8fafc' }}
          formatter={(value: number, name: string) => {
            if (name === 'base') return [null, null];
            return [fmtMoneyFull(value), ''];
          }}
        />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TrendChart({ data }: { data: TrendItem[] }) {
  const chartData = data.filter(d => !d.empty).map(d => ({
    month: shortMonth(d.month_key),
    'Net Revenue': Math.round(d.net_revenue / 1000),
    'Trip Contr.': Math.round(d.trip_contribution / 1000),
    'Fleet Contr.': Math.round(d.fleet_contribution / 1000),
    'Op Profit': Math.round(d.operating_profit / 1000),
    'Trip %': d.trip_margin_pct,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: number) => `${v}K`} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#f8fafc' }}
          formatter={(value: number, name: string) => [`${value.toLocaleString()}K \u20BD`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Line type="monotone" dataKey="Net Revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="Trip Contr." stroke="#a855f7" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="Fleet Contr." stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="Op Profit" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function VehicleClassBar({ classes }: { classes: Record<string, number> }) {
  const total = Object.values(classes).reduce((s, v) => s + v, 0) || 1;
  const items = [
    { key: 'cash_cow', label: 'Cash Cow', color: 'bg-green-500', textColor: 'text-green-400', emoji: '\uD83D\uDFE2' },
    { key: 'low_margin', label: 'Low Margin', color: 'bg-yellow-500', textColor: 'text-yellow-400', emoji: '\uD83D\uDFE1' },
    { key: 'loss_maker', label: 'Loss Maker', color: 'bg-red-500', textColor: 'text-red-400', emoji: '\uD83D\uDD34' },
  ];

  return (
    <div>
      <div className="flex h-6 rounded-full overflow-hidden mb-3">
        {items.map(item => {
          const count = classes[item.key] || 0;
          const pct = count / total * 100;
          if (pct === 0) return null;
          return (
            <div key={item.key} className={`${item.color} flex items-center justify-center text-xs font-bold text-white`}
              style={{ width: `${pct}%` }} title={`${item.label}: ${count}`}>
              {count}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs">
        {items.map(item => (
          <span key={item.key} className={item.textColor}>
            {item.emoji} {item.label}: {classes[item.key] || 0}
          </span>
        ))}
      </div>
    </div>
  );
}

// ========== MAIN PAGE ==========
export default function PnlDashboard() {
  const router = useRouter();
  const [monthKey, setMonthKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [waterfall, setWaterfall] = useState<WaterfallStep[]>([]);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/pnl/dashboard?month=${monthKey}`).then(r => r.json()).catch(() => null),
      fetch(`/api/pnl/waterfall?month=${monthKey}`).then(r => r.json()).catch(() => ({ steps: [] })),
      fetch('/api/pnl/trend-v2?months=6').then(r => r.json()).catch(() => []),
    ]).then(([dash, wf, tr]) => {
      setData(dash);
      setWaterfall(wf?.steps || []);
      setTrend(Array.isArray(tr) ? tr : []);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, [monthKey]);

  const navigateMonth = (dir: -1 | 1) => {
    const [y, m] = monthKey.split('-').map(Number);
    const nm = m + dir;
    if (nm < 1) setMonthKey(`${y - 1}-12`);
    else if (nm > 12) setMonthKey(`${y + 1}-01`);
    else setMonthKey(`${y}-${String(nm).padStart(2, '0')}`);
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    setRecalcResult(null);
    try {
      const r = await fetch('/api/pnl/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: monthKey }),
      });
      const d = await r.json();
      if (d.success) {
        setRecalcResult(`OK: ${d.trips} trips, ${d.vehicles} vehicles, ${d.elapsed}s`);
        fetchData();
      } else {
        setRecalcResult('Error: ' + (d.error || 'unknown'));
      }
    } catch (e: any) {
      setRecalcResult('Error: ' + e.message);
    }
    setRecalculating(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mr-2" />
        <span className="text-slate-400">P&L Dashboard...</span>
      </div>
    );
  }

  if (!data || data.empty) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Header monthKey={monthKey} setMonthKey={setMonthKey} navigateMonth={navigateMonth}
          onRecalculate={handleRecalculate} recalculating={recalculating} recalcResult={recalcResult} />
        <div className="text-center py-20">
          <div className="text-slate-400 text-lg mb-4">{data?.message || 'No data for this month'}</div>
          <button onClick={handleRecalculate} disabled={recalculating}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50">
            {recalculating ? 'Calculating...' : 'Calculate P&L'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Header monthKey={monthKey} setMonthKey={setMonthKey} navigateMonth={navigateMonth}
        onRecalculate={handleRecalculate} recalculating={recalculating} recalcResult={recalcResult}
        calculatedAt={data.calculated_at} />

      {/* 7 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard label="Net Revenue" metric={data.metrics.net_revenue} format="money" icon={DollarSign} color="text-blue-400"
          subtext={`margin ${data.margins.trip_margin_pct.toFixed(0)}%`} />
        <MetricCard label="Fleet Contr." metric={data.metrics.fleet_contribution} format="money" icon={Truck} color="text-green-400"
          subtext={`${data.margins.fleet_margin_pct.toFixed(0)}%`} />
        <MetricCard label="Op. Profit" metric={data.metrics.operating_profit} format="money" icon={TrendingUp}
          color={data.metrics.operating_profit.value >= 0 ? 'text-green-400' : 'text-red-400'}
          subtext={`${data.margins.operating_margin_pct.toFixed(0)}%`} />
        <MetricCard label="Active / Total" metric={data.operational.active_vehicles} format="number" icon={Truck} color="text-purple-400"
          subtext={`${data.operational.total_trips} trips`} />
        <MetricCard label="\u20BD/truck-day" metric={data.operational.revenue_per_truck_day} format="number" icon={Activity} color="text-cyan-400" />
        <MetricCard label="Fuel \u20BD/km" metric={data.metrics.fuel_cost} format="money" icon={Fuel} color="text-orange-400" invertDelta
          subtext={`${data.operational.fuel_per_km.toFixed(1)} \u20BD/km`} />
        <MetricCard label="Penalty %" metric={data.operational.penalty_pct} format="percent" icon={Shield}
          color={data.operational.penalty_pct > 2 ? 'text-red-400' : data.operational.penalty_pct > 1 ? 'text-yellow-400' : 'text-green-400'} />
      </div>

      {/* WB concentration warning */}
      {data.operational.wb_share_pct > 80 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <div className="text-sm">
            <span className="text-yellow-400 font-medium">Concentration risk:</span>
            <span className="text-yellow-300/80 ml-2">WB = {data.operational.wb_share_pct.toFixed(0)}% revenue</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waterfall */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-blue-400" /> P&L Waterfall
          </h3>
          {waterfall.length > 0 ? <WaterfallChart steps={waterfall} /> : <div className="text-slate-500 text-center py-10">No data</div>}
        </div>

        {/* Trend */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" /> Trend (6 months)
          </h3>
          {trend.length > 0 ? <TrendChart data={trend} /> : <div className="text-slate-500 text-center py-10">No data</div>}
        </div>
      </div>

      {/* Vehicle classes + Top/Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Classification */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-white font-semibold mb-3">Fleet Classification</h3>
          <VehicleClassBar classes={data.vehicle_classes} />
          <button onClick={() => router.push(`/pnl/vehicles?month=${monthKey}`)}
            className="mt-4 w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm flex items-center justify-center gap-2">
            <Truck className="w-4 h-4" /> All Vehicles <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {/* Top earners */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Top Earners
          </h3>
          <div className="space-y-2">
            {data.top_earners.map((v, i) => (
              <div key={i} className="flex items-center justify-between text-sm cursor-pointer hover:bg-slate-700/30 rounded px-2 py-1.5"
                onClick={() => router.push(`/pnl/vehicles?month=${monthKey}&plate=${v.plate}`)}>
                <div>
                  <span className="font-mono text-xs text-white">{v.plate}</span>
                  <span className="text-slate-500 text-xs ml-2">{v.type}</span>
                </div>
                <span className="text-green-400 font-semibold">{fmtMoney(v.fleet_contribution)}</span>
              </div>
            ))}
            {data.top_earners.length === 0 && <div className="text-slate-500 text-sm text-center py-4">---</div>}
          </div>
        </div>

        {/* Top losers */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" /> Loss Makers
          </h3>
          <div className="space-y-2">
            {data.top_losers.map((v, i) => (
              <div key={i} className="flex items-center justify-between text-sm cursor-pointer hover:bg-slate-700/30 rounded px-2 py-1.5"
                onClick={() => router.push(`/pnl/vehicles?month=${monthKey}&plate=${v.plate}`)}>
                <div>
                  <span className="font-mono text-xs text-white">{v.plate}</span>
                  <span className="text-slate-500 text-xs ml-2">{v.type}</span>
                </div>
                <span className="text-red-400 font-semibold">{fmtMoney(v.fleet_contribution)}</span>
              </div>
            ))}
            {data.top_losers.length === 0 && <div className="text-slate-500 text-sm text-center py-4">---</div>}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-red-500/30 p-4">
          <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Alerts ({data.alerts.length})
          </h3>
          <div className="space-y-2">
            {data.alerts.map(a => (
              <div key={a.id} className={`px-3 py-2 rounded-lg text-sm flex items-start gap-2 ${
                a.severity === 'red' ? 'bg-red-500/10 text-red-300' : 'bg-yellow-500/10 text-yellow-300'
              }`}>
                <span>{a.severity === 'red' ? '\uD83D\uDD34' : '\uD83D\uDFE1'}</span>
                <div>
                  <span className="font-medium">{a.entity_name || a.alert_code}</span>
                  <span className="text-slate-400 ml-2">{a.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Utilization */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="text-white font-semibold mb-3">Operational Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Total km</span>
            <div className="text-xl font-bold text-white">{data.operational.total_actual_km.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-slate-400">Utilization</span>
            <div className={`text-xl font-bold ${data.operational.commercial_utilization_pct > 70 ? 'text-green-400' : data.operational.commercial_utilization_pct > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {data.operational.commercial_utilization_pct.toFixed(0)}%
            </div>
          </div>
          <div>
            <span className="text-slate-400">WB share</span>
            <div className={`text-xl font-bold ${data.operational.wb_share_pct > 80 ? 'text-yellow-400' : 'text-white'}`}>
              {data.operational.wb_share_pct.toFixed(0)}%
            </div>
          </div>
          <div>
            <span className="text-slate-400">Revenue / trip</span>
            <div className="text-xl font-bold text-white">
              {data.operational.total_trips > 0
                ? fmtMoney(Math.round(data.metrics.net_revenue.value / data.operational.total_trips))
                : '---'}
            </div>
          </div>
        </div>
      </div>

      {/* Calculated at footer */}
      <div className="text-center text-xs text-slate-600">
        Calculated: {new Date(data.calculated_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
      </div>
    </div>
  );
}

// ========== HEADER COMPONENT ==========
function Header({ monthKey, setMonthKey, navigateMonth, onRecalculate, recalculating, recalcResult, calculatedAt }: {
  monthKey: string;
  setMonthKey: (v: string) => void;
  navigateMonth: (dir: -1 | 1) => void;
  onRecalculate: () => void;
  recalculating: boolean;
  recalcResult: string | null;
  calculatedAt?: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-400" /> P&L Dashboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">Management P&L from fact tables</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={() => navigateMonth(-1)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input type="month" value={monthKey} onChange={e => setMonthKey(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm" />
          <button onClick={() => navigateMonth(1)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button onClick={onRecalculate} disabled={recalculating}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
          title="Recalculate P&L for this month">
          <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? 'Calc...' : 'Recalc'}
        </button>
        {recalcResult && (
          <span className={`text-xs ${recalcResult.startsWith('OK') ? 'text-green-400' : 'text-red-400'}`}>
            {recalcResult}
          </span>
        )}
      </div>
    </div>
  );
}
