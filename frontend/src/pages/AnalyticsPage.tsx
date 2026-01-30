import React, { useEffect, useState } from 'react';
import {
  Truck, TrendingUp, TrendingDown, DollarSign, Route, Users,
  BarChart3, AlertTriangle, CheckCircle, XCircle, Fuel, Target,
  ChevronDown, ChevronUp, Award, MapPin
} from 'lucide-react';
import MonthYearPicker from '../components/MonthYearPicker';
import api from '../services/api';

interface AnalyticsData {
  period: { startDate: string; endDate: string };
  fleet: {
    totalVehicles: number;
    activeVehicles: number;
    idleVehicles: number;
    ktg: number;
    totalRevenue: number;
    wbRevenue: number;
    rfRevenue: number;
    totalExpenses: number;
    totalMargin: number;
    marginPercent: number;
    totalTrips: number;
    totalDistance: number;
    rublePerKm: number;
    vehicles: any[];
  };
  drivers: any[];
  routes: any[];
  clients: any[];
  fuel: {
    totalFuel: number;
    totalFuelCost: number;
    totalMileage: number;
    avgFuelConsumption: number;
    avgFuelPrice: number;
    vehicles: any[];
  };
}

const formatMoney = (n: number) => {
  if (!n) return '0';
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + ' М';
  if (Math.abs(n) >= 1000) return Math.round(n / 1000) + ' К';
  return Math.round(n).toLocaleString('ru-RU');
};

const formatPercent = (n: number) => (n * 100).toFixed(1) + '%';

// Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color?: string;
}> = ({ title, value, subtitle, icon: Icon, color = 'text-blue-600' }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-sm">{title}</p>
        <p className={`text-xl font-bold ${color} mt-1`}>{value}</p>
        {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
      </div>
      <div className={`p-2 rounded-lg bg-gray-100`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
    </div>
  </div>
);

// Ranking Table Component
const RankingTable: React.FC<{
  title: string;
  data: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
}> = ({ title, data, renderItem }) => {
  const [expanded, setExpanded] = useState(false);
  const displayData = expanded ? data : data.slice(0, 5);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">{title}</h3>
        {data.length > 5 && (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'Свернуть' : `Ещё ${data.length - 5}`}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {displayData.map((item, i) => renderItem(item, i))}
        {data.length === 0 && <p className="text-gray-400 text-center py-2">Нет данных</p>}
      </div>
    </div>
  );
};

// Progress Bar Component
const ProgressBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
};

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [selectedMonth]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-${new Date(parseInt(year), parseInt(month), 0).getDate()}`;
      
      const response = await api.get('/analytics', { params: { startDate, endDate } });
      setData(response.data);
      setError('');
    } catch (err: any) {
      setError('Ошибка загрузки аналитики');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error || 'Ошибка загрузки'}
      </div>
    );
  }

  const { fleet, drivers, routes, clients, fuel } = data;
  const getStatusColor = (value: number, good: number, warn: number, higherIsBetter = true) => {
    if (higherIsBetter) {
      if (value >= good) return 'text-green-600';
      if (value >= warn) return 'text-yellow-600';
      return 'text-red-600';
    } else {
      if (value <= good) return 'text-green-600';
      if (value <= warn) return 'text-yellow-600';
      return 'text-red-600';
    }
  };

  const sections = [
    { id: 'fleet', label: '🚛 Парк', icon: Truck },
    { id: 'drivers', label: '👷 Водители', icon: Users },
    { id: 'routes', label: '🛣️ Маршруты', icon: Route },
    { id: 'fuel', label: '⛽ Топливо', icon: Fuel },
    { id: 'roi', label: '📈 ROI', icon: Target },
  ];

  return (
    <div className="animate-fade-in space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            Аналитика
          </h1>
          <p className="text-gray-500 text-sm mt-1">Полный обзор показателей парка</p>
        </div>
        <MonthYearPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Section Navigation */}
      <div className="flex flex-wrap gap-2">
        {sections.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(activeSection === item.id ? null : item.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeSection === item.id || !activeSection
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* === SECTION 1: FLEET OVERVIEW === */}
      {(!activeSection || activeSection === 'fleet') && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            1. Обзор парка
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Всего машин" value={fleet.totalVehicles} subtitle={`${fleet.activeVehicles} активных`} icon={Truck} color="text-blue-600" />
            <StatCard title="КТГ" value={formatPercent(fleet.ktg)} subtitle="Коэф. тех. готовности" icon={CheckCircle} color={getStatusColor(fleet.ktg, 0.85, 0.7)} />
            <StatCard title="Активных" value={fleet.activeVehicles} icon={CheckCircle} color="text-green-600" />
            <StatCard title="Простаивают" value={fleet.idleVehicles} icon={XCircle} color={fleet.idleVehicles > 0 ? "text-red-600" : "text-green-600"} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Выручка парка" value={formatMoney(fleet.totalRevenue) + ' ₽'} subtitle={`WB: ${formatMoney(fleet.wbRevenue)} + РФ: ${formatMoney(fleet.rfRevenue)}`} icon={DollarSign} color="text-blue-600" />
            <StatCard title="Маржа" value={formatMoney(fleet.totalMargin) + ' ₽'} subtitle={`${(fleet.marginPercent * 100).toFixed(1)}% от выручки`} icon={TrendingUp} color={fleet.totalMargin >= 0 ? "text-green-600" : "text-red-600"} />
            <StatCard title="Ср. выручка/машину" value={formatMoney(fleet.totalVehicles > 0 ? fleet.totalRevenue / fleet.totalVehicles : 0) + ' ₽'} icon={Truck} color="text-purple-600" />
            <StatCard title="Рубль/км (WB)" value={fleet.rublePerKm + ' ₽'} subtitle={`${fleet.totalDistance.toLocaleString('ru-RU')} км`} icon={Route} color="text-cyan-600" />
          </div>

          {/* Vehicle Rankings */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <RankingTable
              title="🏆 Топ по марже"
              data={fleet.vehicles.slice(0, 10)}
              renderItem={(v, i) => (
                <div key={v.vehicle_number} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 font-mono text-sm">{v.vehicle_number}</span>
                  <span className="font-medium text-green-600">{formatMoney(v.margin)} ₽</span>
                </div>
              )}
            />
            <RankingTable
              title="⚠️ Антитоп по марже"
              data={[...fleet.vehicles].sort((a, b) => a.margin - b.margin).slice(0, 10)}
              renderItem={(v, i) => (
                <div key={v.vehicle_number} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 font-mono text-sm">{v.vehicle_number}</span>
                  <span className="font-medium text-red-600">{formatMoney(v.margin)} ₽</span>
                </div>
              )}
            />
            <RankingTable
              title="💰 Топ по выручке"
              data={[...fleet.vehicles].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 10)}
              renderItem={(v, i) => (
                <div key={v.vehicle_number} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 font-mono text-sm">{v.vehicle_number}</span>
                  <span className="font-medium text-blue-600">{formatMoney(v.total_revenue)} ₽</span>
                </div>
              )}
            />
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-4">Структура выручки</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-purple-600">Wildberries</span>
                  <span>{formatMoney(fleet.wbRevenue)} ₽ ({fleet.totalRevenue > 0 ? ((fleet.wbRevenue / fleet.totalRevenue) * 100).toFixed(1) : 0}%)</span>
                </div>
                <ProgressBar value={fleet.wbRevenue} max={fleet.totalRevenue} color="bg-purple-500" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-600">РФ Транспорт</span>
                  <span>{formatMoney(fleet.rfRevenue)} ₽ ({fleet.totalRevenue > 0 ? ((fleet.rfRevenue / fleet.totalRevenue) * 100).toFixed(1) : 0}%)</span>
                </div>
                <ProgressBar value={fleet.rfRevenue} max={fleet.totalRevenue} color="bg-green-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SECTION 2: DRIVERS === */}
      {(!activeSection || activeSection === 'drivers') && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mt-6">
            <Users className="w-5 h-5 text-orange-500" />
            2. Эффективность водителей
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Всего водителей" value={drivers.length} icon={Users} color="text-orange-500" />
            <StatCard title="Выручка (все)" value={formatMoney(drivers.reduce((s, d) => s + d.totalRevenue, 0)) + ' ₽'} icon={DollarSign} color="text-green-600" />
            <StatCard title="Ср. на водителя" value={formatMoney(drivers.length > 0 ? drivers.reduce((s, d) => s + d.totalRevenue, 0) / drivers.length : 0) + ' ₽'} icon={TrendingUp} color="text-blue-600" />
            <StatCard title="Всего штрафов" value={formatMoney(drivers.reduce((s, d) => s + d.penalties, 0)) + ' ₽'} icon={AlertTriangle} color="text-red-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <RankingTable
              title="💰 Топ по выручке"
              data={drivers.slice(0, 10)}
              renderItem={(d, i) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 text-sm truncate">{d.name}</span>
                  <span className="font-medium text-green-600">{formatMoney(d.totalRevenue)} ₽</span>
                </div>
              )}
            />
            <RankingTable
              title="🚛 Топ по рейсам"
              data={[...drivers].sort((a, b) => b.totalTrips - a.totalTrips).slice(0, 10)}
              renderItem={(d, i) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 text-sm truncate">{d.name}</span>
                  <span className="font-medium text-blue-600">{d.totalTrips} рейсов</span>
                </div>
              )}
            />
            <RankingTable
              title="⚡ Топ по ₽/км"
              data={[...drivers].filter(d => d.wbDistance > 1000).sort((a, b) => b.rublePerKm - a.rublePerKm).slice(0, 10)}
              renderItem={(d, i) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-cyan-100 text-cyan-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 text-sm truncate">{d.name}</span>
                  <span className="font-medium text-cyan-600">{d.rublePerKm.toFixed(1)} ₽/км</span>
                </div>
              )}
            />
          </div>
        </div>
      )}

      {/* === SECTION 3: ROUTES === */}
      {(!activeSection || activeSection === 'routes') && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mt-6">
            <Route className="w-5 h-5 text-cyan-500" />
            3. Маршруты и клиенты
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Маршрутов WB" value={routes.length} icon={MapPin} color="text-purple-600" />
            <StatCard title="Клиентов РФ" value={clients.length} icon={Users} color="text-green-600" />
            <StatCard title="Штрафы WB" value={formatMoney(routes.reduce((s, r) => s + r.penalties, 0)) + ' ₽'} icon={AlertTriangle} color="text-red-600" />
            <StatCard title="Ср. ₽/км WB" value={(routes.reduce((s, r) => s + r.distance, 0) > 0 ? routes.reduce((s, r) => s + r.revenue, 0) / routes.reduce((s, r) => s + r.distance, 0) : 0).toFixed(1) + ' ₽'} icon={TrendingUp} color="text-cyan-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RankingTable
              title="🏆 Топ маршрутов WB"
              data={routes.slice(0, 10)}
              renderItem={(r, i) => (
                <div key={r.route} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 text-sm truncate" title={r.route}>{r.route.length > 35 ? r.route.slice(0, 35) + '...' : r.route}</span>
                  <span className="font-medium text-green-600">{formatMoney(r.revenue)} ₽</span>
                </div>
              )}
            />
            <RankingTable
              title="🏢 Топ клиентов РФ"
              data={clients.slice(0, 10)}
              renderItem={(c, i) => (
                <div key={c.client} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 text-sm truncate" title={c.client}>{c.client.length > 35 ? c.client.slice(0, 35) + '...' : c.client}</span>
                  <span className="font-medium text-green-600">{formatMoney(c.revenue)} ₽</span>
                </div>
              )}
            />
          </div>
        </div>
      )}

      {/* === SECTION 4: FUEL === */}
      {(!activeSection || activeSection === 'fuel') && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mt-6">
            <Fuel className="w-5 h-5 text-yellow-500" />
            4. Топливная аналитика
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Расход топлива" value={fuel.totalFuel.toLocaleString('ru-RU') + ' л'} icon={Fuel} color="text-yellow-500" />
            <StatCard title="Затраты на топливо" value={formatMoney(fuel.totalFuelCost) + ' ₽'} icon={DollarSign} color="text-red-600" />
            <StatCard title="Ср. расход" value={fuel.avgFuelConsumption + ' л/100км'} subtitle={fuel.avgFuelConsumption <= 35 ? 'Норма' : 'Выше нормы'} icon={TrendingDown} color={getStatusColor(fuel.avgFuelConsumption, 35, 40, false)} />
            <StatCard title="Ср. цена литра" value={fuel.avgFuelPrice + ' ₽'} icon={TrendingUp} color="text-blue-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RankingTable
              title="🌿 Лучшие по расходу"
              data={[...fuel.vehicles].sort((a, b) => a.avgConsumption - b.avgConsumption).slice(0, 8)}
              renderItem={(f, i) => (
                <div key={f.vehicle} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 font-mono text-sm">{f.vehicle}</span>
                  <span className="font-medium text-green-600">{f.avgConsumption.toFixed(1)} л/100км</span>
                </div>
              )}
            />
            <RankingTable
              title="🔥 Худшие по расходу"
              data={[...fuel.vehicles].sort((a, b) => b.avgConsumption - a.avgConsumption).slice(0, 8)}
              renderItem={(f, i) => (
                <div key={f.vehicle} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 font-mono text-sm">{f.vehicle}</span>
                  <span className="font-medium text-red-600">{f.avgConsumption.toFixed(1)} л/100км</span>
                </div>
              )}
            />
          </div>
        </div>
      )}

      {/* === SECTION 5: ROI === */}
      {(!activeSection || activeSection === 'roi') && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mt-6">
            <Target className="w-5 h-5 text-purple-500" />
            5. ROI и окупаемость
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Общая маржа" value={formatMoney(fleet.totalMargin) + ' ₽'} icon={TrendingUp} color={fleet.totalMargin >= 0 ? "text-green-600" : "text-red-600"} />
            <StatCard title="Маржинальность" value={formatPercent(fleet.marginPercent)} subtitle={fleet.marginPercent >= 0.15 ? 'Хорошо' : fleet.marginPercent >= 0.1 ? 'Средне' : 'Низко'} icon={Target} color={getStatusColor(fleet.marginPercent, 0.15, 0.1)} />
            <StatCard title="Ср. маржа/машину" value={formatMoney(fleet.totalVehicles > 0 ? fleet.totalMargin / fleet.totalVehicles : 0) + ' ₽'} icon={Truck} color="text-purple-600" />
            <StatCard title="Убыточных машин" value={fleet.vehicles.filter(v => v.margin < 0).length} icon={AlertTriangle} color={fleet.vehicles.filter(v => v.margin < 0).length > 0 ? "text-red-600" : "text-green-600"} />
          </div>

          {/* Profitability Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-4">Распределение по прибыльности</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-3xl font-bold text-green-600">{fleet.vehicles.filter(v => v.margin > 50000).length}</div>
                <div className="text-gray-500 text-sm mt-1">Высокодоходные<br/>(&gt;50К маржи)</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <div className="text-3xl font-bold text-yellow-600">{fleet.vehicles.filter(v => v.margin >= 0 && v.margin <= 50000).length}</div>
                <div className="text-gray-500 text-sm mt-1">Средние<br/>(0-50К маржи)</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="text-3xl font-bold text-red-600">{fleet.vehicles.filter(v => v.margin < 0).length}</div>
                <div className="text-gray-500 text-sm mt-1">Убыточные<br/>(&lt;0 маржи)</div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              Рекомендации
            </h3>
            <div className="space-y-2 text-sm">
              {fleet.vehicles.filter(v => v.margin < 0).length > 0 && (
                <div className="flex items-start gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Есть {fleet.vehicles.filter(v => v.margin < 0).length} убыточных машин — проанализируйте причины</span>
                </div>
              )}
              {fleet.ktg < 0.85 && (
                <div className="flex items-start gap-2 text-yellow-600">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>КТГ {formatPercent(fleet.ktg)} — {fleet.idleVehicles} машин простаивают</span>
                </div>
              )}
              {fleet.marginPercent < 0.15 && (
                <div className="flex items-start gap-2 text-yellow-600">
                  <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Маржинальность {formatPercent(fleet.marginPercent)} ниже нормы 15%</span>
                </div>
              )}
              {fuel.avgFuelConsumption > 35 && (
                <div className="flex items-start gap-2 text-yellow-600">
                  <Fuel className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Средний расход {fuel.avgFuelConsumption} л/100км выше нормы</span>
                </div>
              )}
              {fleet.marginPercent >= 0.15 && fleet.ktg >= 0.85 && (
                <div className="flex items-start gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Показатели в норме. Продолжайте мониторинг.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
