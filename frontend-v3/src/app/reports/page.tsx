'use client';

import { useState, useEffect } from 'react';
import { Search, Calendar } from 'lucide-react';

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

interface DriverReport {
  id: string;
  number: string;
  driver_name: string;
  vehicle_number: string;
  date_from: string;
  date_to: string;
  total_expenses: number;
  driver_accruals: number;
  mileage: number;
  expense_categories: { category: string; amount: string }[] | null;
}

function formatMoney(value: number | null): string {
  if (!value) return '0 ₽';
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export default function ReportsPage() {
  const now = new Date();
  const [reports, setReports] = useState<DriverReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [mode, setMode] = useState<"month" | "range">("month");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
  });

  const years = [];
  for (let y = 2023; y <= now.getFullYear(); y++) {
    years.push(y);
  }

  useEffect(() => {
    fetchReports();
  }, [selectedYear, selectedMonth, mode, startDate, endDate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let start: string, end: string;
      
      if (mode === "month") {
        const year = selectedYear;
        const month = selectedMonth + 1;
        start = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      } else {
        if (!startDate || !endDate) {
          setReports([]);
          setLoading(false);
          return;
        }
        start = startDate;
        end = endDate;
      }
      
      const res = await fetch(
        `/rest/v1/driver_reports?date_to=gte.${start}&date_to=lte.${end}&order=date_to.desc&limit=500`
      );
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    setMode("range");
    setStartDate(startStr);
    setEndDate(endStr);
  };

  const filteredReports = reports.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.driver_name?.toLowerCase().includes(q) ||
      r.vehicle_number?.toLowerCase().includes(q) ||
      r.number?.toLowerCase().includes(q)
    );
  });

  const totalExpenses = filteredReports.reduce((sum, r) => sum + (r.total_expenses || 0), 0);
  const totalAccruals = filteredReports.reduce((sum, r) => sum + (r.driver_accruals || 0), 0);
  const totalMileage = filteredReports.reduce((sum, r) => sum + (r.mileage || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Отчёты водителей</h1>
        <p className="text-slate-400 text-sm">Отчёты из 1С за период</p>
      </div>

      {/* Period Selector */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        {/* Mode toggle */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex bg-slate-900 rounded-lg p-1">
            <button
              onClick={() => setMode("month")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${mode === "month" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              По месяцу
            </button>
            <button
              onClick={() => setMode("range")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${mode === "range" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              По датам
            </button>
          </div>
          
          {mode === "range" && (
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setQuickRange(7)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">7 дней</button>
              <button onClick={() => setQuickRange(30)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">30 дней</button>
              <button onClick={() => setQuickRange(90)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">90 дней</button>
            </div>
          )}
        </div>

        {/* Date selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="w-5 h-5 text-slate-400" />
          
          {mode === "month" ? (
            <>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
              >
                {MONTHS.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <span className="text-slate-400 text-sm">с</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
              />
              <span className="text-slate-400 text-sm">по</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm"
              />
            </>
          )}
        </div>
        
        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по водителю, машине или номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-slate-400 text-sm">Отчётов</div>
          <div className="text-2xl font-bold text-white">{filteredReports.length}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-slate-400 text-sm">Общие расходы</div>
          <div className="text-xl font-bold text-red-400">{formatMoney(totalExpenses)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-slate-400 text-sm">Начисления</div>
          <div className="text-xl font-bold text-green-400">{formatMoney(totalAccruals)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-slate-400 text-sm">Пробег</div>
          <div className="text-xl font-bold text-blue-400">{totalMileage.toLocaleString('ru-RU')} км</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-slate-400 py-12">Загрузка...</div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center text-slate-400 py-12">Нет отчётов за выбранный период</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            {filteredReports.map((report) => (
              <div key={report.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-white font-medium text-sm">{report.driver_name || '—'}</div>
                    <div className="text-slate-400 text-xs">{report.vehicle_number} • {report.number}</div>
                  </div>
                  <div className="text-slate-500 text-xs">
                    {formatDate(report.date_from)}—{formatDate(report.date_to)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Расходы</span>
                    <p className="text-red-400 font-medium">{formatMoney(report.total_expenses)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Начисл.</span>
                    <p className="text-green-400 font-medium">{formatMoney(report.driver_accruals)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Пробег</span>
                    <p className="text-white font-medium">{report.mileage?.toLocaleString('ru-RU') || 0} км</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900">
                    <th className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase">Номер</th>
                    <th className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase">Водитель</th>
                    <th className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase">Машина</th>
                    <th className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase">Период</th>
                    <th className="text-right text-slate-400 text-xs font-medium px-4 py-3 uppercase">Расходы</th>
                    <th className="text-right text-slate-400 text-xs font-medium px-4 py-3 uppercase">Начисления</th>
                    <th className="text-right text-slate-400 text-xs font-medium px-4 py-3 uppercase">Пробег</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-300 text-sm">{report.number}</td>
                      <td className="px-4 py-3 text-white">{report.driver_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{report.vehicle_number}</td>
                      <td className="px-4 py-3 text-slate-400 text-sm">
                        {formatDate(report.date_from)} — {formatDate(report.date_to)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-400">{formatMoney(report.total_expenses)}</td>
                      <td className="px-4 py-3 text-right text-green-400">{formatMoney(report.driver_accruals)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{report.mileage?.toLocaleString('ru-RU') || 0} км</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center text-slate-500 text-sm">
            Всего: {filteredReports.length} отчётов
          </div>
        </>
      )}
    </div>
  );
}
