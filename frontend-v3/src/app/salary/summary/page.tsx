'use client';
import React from 'react';
import ExcelExport from "@/components/ExcelExport";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/shared/utils/apiFetch';
import { Download, Printer, Calculator, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronR, Edit3, Save, X } from 'lucide-react';

const MONTHS_RU = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const STATUS_MAP: Record<string, { icon: string; label: string; color: string }> = {
  calculated: { icon: '🟢', label: 'Рассчитан', color: 'text-green-400' },
  draft: { icon: '🟡', label: 'Черновик', color: 'text-yellow-400' },
  problem: { icon: '🔴', label: 'Проблема', color: 'text-red-400' },
  dismissed: { icon: '🔵', label: 'Уволен', color: 'text-blue-400' },
  vacation: { icon: '⚪', label: 'Отпуск', color: 'text-slate-400' },
};

const fmt = (n: number) => n ? Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '—';
const fmtFull = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 });

interface SummaryRow {
  idx: number;
  driver_id: string;
  driver_name: string;
  driver_status: string;
  status: string;
  report_count: number;
  reports: any[];
  vacation_period: string | null;
  advance: number; enforcement: number; prev_balance: number; sick_payout: number; dismissal: number; total_deductions: number;
  overpay_prev: number; report_period: string | null;
  cash: number; daily_ved: number; subaccount: number; fine: number; retention: number; total_paid: number;
  register_unlinked: number; register_paid: number; register_duplicates: number; registry_advance: number; registry_daily: number; registry_other: number; register_details: { id: number; register_number: string; tl_number: number; date: string; amount: number; full_name: string; type: string; is_duplicate: boolean; reason?: string }[];
  km_salary: number; bonus_km: number; bonus_overtime: number; bonus_other: number;
  loading: number; daily_accrued: number; receipts: number; idle: number; bonus_short: number; sick_accrued: number; total_accrued: number;
  by_report: number; to_pay: number; ny_pay: number; grand_total: number;
  total_km: number; fuel_consumption: number;
  note: string;
  overrides: Record<string, { value: number; note?: string }>;
}

export default function SalarySummaryPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<{ rows: SummaryRow[]; totals: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ driverId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [org, setOrg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyWithReports, setShowOnlyWithReports] = useState(true);
  const [hideNoDriver, setHideNoDriver] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [excludedReports, setExcludedReports] = useState<Set<string>>(new Set());
  const tableRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSort, setMobileSort] = useState<'name' | 'total' | 'accrued' | 'km'>('total');
  const [mobileSortDir, setMobileSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const toggleCard = (id: string) => setExpandedCards(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });




  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (g: string) => setExpandedGroups(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });

  const canEdit = user?.role === 'accountant' || user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'director';

  const getEffectiveRow = (row: SummaryRow) => {
    if (excludedReports.size === 0) return row;
    const included = row.reports.filter((r: any) => !excludedReports.has(String(r.id)));
    if (included.length === row.reports.length) return row;
    // Recalculate from included reports
    let km_salary = 0, daily_accrued = 0, receipts = 0, loading = 0, bonus_km = 0;
    for (const r of included) {
      km_salary += Number(r.km_salary) || 0;
      daily_accrued += Number(r.daily_accrued) || 0;
      receipts += Number(r.receipts_cash) || 0;
      loading += Number(r.loading_unloading) || 0;
      bonus_km += Number(r.bonus_km) || 0;
    }
    const total_accrued = km_salary + bonus_km + (row.bonus_overtime || 0) + (row.bonus_other || 0) +
      loading + daily_accrued + receipts + (row.idle || 0) + (row.bonus_short || 0) + (row.sick_accrued || 0);
    const by_report = total_accrued - row.total_paid;
    const to_pay = by_report - row.total_deductions;
    return { ...row, km_salary, daily_accrued, receipts, loading, bonus_km, total_accrued, by_report, to_pay, grand_total: to_pay + (row.ny_pay || 0) };
  };
  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (hideNoDriver) rows = rows.filter(r => r.driver_id);
    if (showOnlyWithReports) rows = rows.filter(r => r.report_count > 0);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => 
        r.driver_name?.toLowerCase().includes(q) ||
        r.reports?.some((rep: any) => rep.vehicle_number?.toLowerCase().includes(q))
      );
    }
    return rows.map(r => getEffectiveRow(r));
  }, [data, hideNoDriver, showOnlyWithReports, excludedReports, searchQuery]);

  const sortedMobileRows = useMemo(() => {
    const rows = [...filteredRows];
    const dir = mobileSortDir === 'desc' ? -1 : 1;
    switch (mobileSort) {
      case 'name': rows.sort((a, b) => dir * (a.driver_name || '').localeCompare(b.driver_name || '', 'ru')); break;
      case 'total': rows.sort((a, b) => dir * ((a.grand_total || 0) - (b.grand_total || 0))); break;
      case 'accrued': rows.sort((a, b) => dir * ((a.total_accrued || 0) - (b.total_accrued || 0))); break;
      case 'km': rows.sort((a, b) => dir * ((a.total_km || 0) - (b.total_km || 0))); break;
    }
    return rows;
  }, [filteredRows, mobileSort, mobileSortDir]);

  const toggleMobileSort = (field: typeof mobileSort) => {
    if (mobileSort === field) setMobileSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setMobileSort(field); setMobileSortDir('desc'); }
  };

  const [y, m] = month.split('-').map(Number);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `/api/salary/summary?month=${month}`;
      if (org) url += `&organization=${encodeURIComponent(org)}`;
      if (dateFrom) url += `&date_from=${dateFrom}`;
      if (dateTo) url += `&date_to=${dateTo}`;
      const res = await apiFetch(url);
      const d = await res.json();
      setData(d);
      setExcludedReports(new Set());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [month, dateFrom, dateTo, org]);
  // Inject print styles
  React.useEffect(() => {
    const style = document.createElement('style');
    style.id = 'salary-print-css';
    style.textContent = `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  * { background: white !important; color: black !important; -webkit-print-color-adjust: exact !important; }
  nav, aside, header, footer, button, .sidebar, .no-print,
  [class*="Sidebar"], [class*="sidebar"], [role="complementary"],
  input, select, label, svg, img:not(.print-show) { display: none !important; }
  body, main { font-size: 9pt !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
  .no-print, [data-no-print] { display: none !important; }
  div[class*="overflow-x-auto"] { overflow: visible !important; }
  .print-header { display: block !important; text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 8px; }
  .print-sub { display: block !important; text-align: center; font-size: 10pt; margin-bottom: 12px; color: #555 !important; }
  table { width: 100% !important; border-collapse: collapse !important; font-variant-numeric: tabular-nums; }
  th, td { border: 1px solid #333 !important; padding: 3px 4px !important; font-size: 9pt !important;
           white-space: nowrap !important; background: white !important; color: black !important; }
  th { background: #eee !important; font-weight: bold !important; text-align: center !important; }
  td { text-align: right !important; }
  td:nth-child(2) { text-align: left !important; min-width: 180px !important; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .sticky { position: static !important; }
  div[class*="overflow-x-auto"] { overflow: visible !important; }
  
  
  
  /* Compact mode: hide sub-columns, show only 8 main cols */
  .print-compact .sal-sub { display: none !important; }
  .print-compact .sal-main { display: table-cell !important; }
  .print-compact .sal-fuel, .print-compact .sal-status { display: none !important; }
  .print-compact thead tr:nth-child(2) { display: none !important; }
  .salary-mobile-view { display: none !important; }
  [class*="ml-64"], [class*="lg\:ml-64"] { margin-left: 0 !important; }
  [class*="pt-14"] { padding-top: 0 !important; }
  [class*="max-w-"] { max-width: 100% !important; }
  div, section, article, main, [class*="p-4"], [class*="p-6"] { 
    background: white !important; color: black !important; 
    visibility: visible !important; display: block !important; opacity: 1 !important;
  }
  table { display: table !important; }
  thead { display: table-header-group !important; }
  tbody { display: table-body-group !important; }
  tr { display: table-row !important; }
  td, th { display: table-cell !important; }
  span, a { color: black !important; }
  [class*="text-red"] { color: #c00 !important; }
  [class*="text-blue"] { color: #00c !important; }
  [class*="text-green"] { color: #080 !important; }
  tfoot td { font-weight: bold !important; }
  td[class*="text-red"] { color: red !important; }
}
`
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);
  // Inject table formatting styles
  React.useEffect(() => {
    const s2 = document.createElement('style');
    s2.id = 'salary-table-css';
    s2.textContent = `
      .sal-table { font-variant-numeric: tabular-nums; }
      .sal-table th, .sal-table td { white-space: nowrap; }
      .sal-table td[data-num] { min-width: 70px; text-align: right; }
      .sal-table td.sal-fio { min-width: 180px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
      .sal-table .sal-dash { text-align: center; color: #555; }
      .sal-table td .sal-icon { position: relative; }
      .sal-table td .sal-icon span[class*="text-[7px]"],
      .sal-table td .sal-icon span[class*="text-[8px]"] { font-size: 7px; vertical-align: super; }
    `;
    document.head.appendChild(s2);
    return () => { s2.remove(); };
  }, []);



  // Set default date range when month changes
  useEffect(() => {
    const [yy, mm] = month.split('-').map(Number);
    setDateFrom(`${yy}-${String(mm).padStart(2,'0')}-01`);
    const lastD = new Date(yy, mm, 0).getDate();
    setDateTo(`${yy}-${String(mm).padStart(2,'0')}-${lastD}`);
  }, [month]);

  // Toggle report exclusion
  const toggleReport = (reportId: string) => {
    setExcludedReports(prev => {
      const n = new Set(prev);
      if (n.has(reportId)) n.delete(reportId);
      else n.add(reportId);
      return n;
    });
  };

  // Exclude all reports before date
  const excludeBefore = (date: string) => {
    if (!data) return;
    const newExcluded = new Set(excludedReports);
    for (const row of data.rows) {
      for (const r of row.reports) {
        if (r.date_to && r.date_to < date) newExcluded.add(String(r.id));
      }
    }
    setExcludedReports(newExcluded);
  };

  // Recalculate row totals excluding excluded reports

  const navigate = (dir: -1 | 1) => {
    const nm = m + dir;
    if (nm < 1) setMonth(`${y - 1}-12`);
    else if (nm > 12) setMonth(`${y + 1}-01`);
    else setMonth(`${y}-${String(nm).padStart(2, '0')}`);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startEdit = (driverId: string, field: string, currentValue: number) => {
    if (!canEdit) return;
    setEditingCell({ driverId, field });
    setEditValue(String(currentValue || 0));
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    try {
      await apiFetch(`/api/salary/summary/${editingCell.driverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, field: editingCell.field, value: Number(editValue) }),
      });
      setEditingCell(null);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    html.classList.remove('dark');
    document.body.classList.add('printing');
    document.body.classList.add('print-compact');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (wasDark) html.classList.add('dark');
        document.body.classList.remove('printing');
        document.body.classList.remove('print-compact');
      }, 500);
    }, 300);
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/salary/summary/excel?month=${month}&organization=${encodeURIComponent(org || '')}`, { credentials: 'include' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vedmost_${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    return showOnlyWithReports ? data.rows.filter((r: any) => r.report_count > 0 || Math.abs(r.grand_total) > 0.01) : data.rows;
  }, [data, showOnlyWithReports]);

  const totals = data?.totals || {};

  // Editable cell component
  const Cell = ({ row, field, value, bold, red }: { row: SummaryRow; field: string; value: number; bold?: boolean; red?: boolean }) => {
    const isEditing = editingCell?.driverId === row.driver_id && editingCell?.field === field;
    const hasOverride = row.overrides?.[field];
    const cls = `px-2 py-1.5 text-right whitespace-nowrap text-xs ${bold ? 'font-bold' : ''} ${red ? 'text-red-400' : value < 0 ? 'text-red-400' : value > 0 ? 'text-slate-200' : 'text-slate-600'} ${hasOverride ? 'bg-blue-900/20' : ''} ${canEdit ? 'cursor-pointer hover:bg-slate-700/50' : ''}`;

    if (isEditing) {
      return (
    <td className="px-1 py-0.5">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
              className="w-20 px-1 py-0.5 bg-slate-900 border border-blue-500 rounded text-xs text-white"
              autoFocus
            />
            <button onClick={saveEdit} className="text-green-400 hover:text-green-300"><Save size={12} /></button>
            <button onClick={() => setEditingCell(null)} className="text-red-400 hover:text-red-300"><X size={12} /></button>
          </div>
        </td>
      );
    }

    return (
      <td className={cls} onClick={() => startEdit(row.driver_id, field, value)} title={hasOverride ? `Ручная правка` : undefined}>
        {fmt(value)}
      </td>
    );
  };

  // Total cell
  const TCell = ({ value, bold }: { value: number; bold?: boolean }) => (
    <td className={`px-2 py-1.5 text-right whitespace-nowrap text-xs font-bold ${value < 0 ? 'text-red-400' : 'text-white'}`}>
      {fmtFull(value)}
    </td>
  );

  return (
    <div className="p-4 sm:p-6 max-w-[2000px] mx-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2 mb-4">
        {/* Title + actions */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold text-white truncate">💰 Зарплатная ведомость</h1>
          {isMobile ? (
            <div className="relative">
              <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 text-slate-400 hover:text-white text-lg">⋯</button>
              {showMobileMenu && (
                <div className="absolute right-0 top-10 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                  <button onClick={() => { fetchData(); setShowMobileMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"><Calculator size={14} />Рассчитать</button>
                  <button onClick={() => { handleExport(); setShowMobileMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-slate-700 flex items-center gap-2"><Download size={14} />Excel</button>
                  <button onClick={() => { handlePrint(); setShowMobileMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-purple-400 hover:bg-slate-700 flex items-center gap-2">🖨️ Печать</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 disabled:opacity-50">
                <Calculator size={14} /> {loading ? 'Расчёт...' : 'Рассчитать'}
              </button>
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 border border-green-600/40 text-green-400 rounded text-sm hover:bg-green-600/30 no-print">
                <Download size={14} /> Excel
              </button>
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 border border-purple-600/40 text-purple-400 rounded text-sm hover:bg-purple-600/30 no-print">
                🖨️ Печать
              </button>
            </div>
          )}
        </div>
        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <select value={org} onChange={e => setOrg(e.target.value)}
            className="bg-slate-700 text-white border border-slate-600 rounded px-2 py-1.5 text-sm flex-shrink-0">
            <option value="">Все</option>
            <option value="ТЛ">ООО ТЛ</option>
            <option value="ГП">ООО ГП</option>
            <option value="Лихач">ИП Лихачёв</option>
          </select>
          <input type="text" placeholder="🔍 Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="bg-slate-700 text-white border border-slate-600 rounded px-2 py-1.5 text-sm flex-1 min-w-0 placeholder-slate-400" />
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => navigate(-1)} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"><ChevronLeft size={20} /></button>
            <span className="text-white font-bold text-sm min-w-[120px] text-center">{MONTHS_RU[m]} {y}</span>
            <button onClick={() => navigate(1)} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"><ChevronRight size={20} /></button>
          </div>
        </div>
        {/* Date range + quick buttons */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <div className="flex gap-1">
            {[
              { label: 'Месяц', from: `${y}-${String(m).padStart(2,'0')}-01`, to: `${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}` },
              { label: '1-25', from: `${y}-${String(m).padStart(2,'0')}-01`, to: `${y}-${String(m).padStart(2,'0')}-25` },
              { label: 'Неделя', from: new Date(Date.now() - 7*86400000).toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) },
            ].map(q => {
              const active = dateFrom === q.from && dateTo === q.to;
              return <button key={q.label} onClick={() => { setDateFrom(q.from); setDateTo(q.to); }}
                className={`px-2 py-1 rounded text-xs ${active ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>{q.label}</button>;
            })}
          </div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-1.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white w-[130px]" />
          <span className="text-slate-500">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-1.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white w-[130px]" />
        </div>
      </div>

      {/* Stats bar */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-slate-400 text-xs">Водителей</div>
            <div className="text-lg font-bold text-white">{totals.driver_count || 0}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-slate-400 text-xs">Начислено</div>
            <div className="text-lg font-bold text-green-400">{fmt(totals.total_accrued)}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-slate-400 text-xs">Выплачено</div>
            <div className="text-lg font-bold text-orange-400">{fmt(totals.total_paid)}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-slate-400 text-xs">ИТОГО К ВЫПЛАТЕ</div>
            <div className="text-lg font-bold text-red-400">{fmt(totals.grand_total)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {/* @ts-ignore */}
      <div className={`flex items-center gap-2 mb-3 flex-wrap`}>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showOnlyWithReports} onChange={e => setShowOnlyWithReports(e.target.checked)}
            className="rounded bg-slate-700 border-slate-600" />
          Только с отчётами ({data?.rows.filter(r => r.report_count > 0).length || 0})
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input type="checkbox" checked={hideNoDriver} onChange={e => setHideNoDriver(e.target.checked)}
            className="rounded bg-slate-700 border-slate-600" />
          Скрыть без водителя
        </label>
        {excludedReports.size > 0 && (
          <button onClick={() => setExcludedReports(new Set())}
            className="text-xs text-blue-400 hover:text-blue-300">
            Включить все отчёты ({excludedReports.size} исключено)
          </button>
        )}
        <span className="text-xs text-slate-500">Показано: {filteredRows.length} из {data?.rows.length || 0}</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center text-slate-400 py-20">Загрузка...</div>
      ) : !data ? (
        <div className="text-center text-slate-400 py-20">Нажмите «Рассчитать»</div>
      ) : isMobile ? (
        /* ===== MOBILE CARDS VIEW ===== */
        <div className="pb-16">
          {/* Sort buttons */}
          <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
            <span className="text-xs text-slate-500 flex-shrink-0">Сорт:</span>
            {([['total', 'К выпл.'], ['name', 'ФИО'], ['accrued', 'Начисл.'], ['km', 'Км']] as const).map(([key, label]) => (
              <button key={key} onClick={() => toggleMobileSort(key)}
                className={`px-2 py-1 rounded text-xs flex-shrink-0 ${mobileSort === key ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {label} {mobileSort === key && (mobileSortDir === 'desc' ? '↓' : '↑')}
              </button>
            ))}
          </div>

          {/* Cards */}
          {sortedMobileRows.map(row => {
            const st = STATUS_MAP[row.status] || STATUS_MAP.draft;
            const isExp = expandedCards.has(row.driver_id);
            const shortName = row.driver_name?.split(' ').map((w: string, i: number) => i === 0 ? w : w[0] + '.').join(' ');
            const vehicle = (row as any).vehicles?.[0] || '';
            
            const accrualItems = [
              { label: 'За км', value: row.km_salary },
              { label: 'Пр.км', value: row.bonus_km },
              { label: 'Сверхур.', value: row.bonus_overtime },
              { label: 'Др.пр.', value: row.bonus_other },
              { label: 'Погрузка', value: row.loading },
              { label: 'Суточные', value: row.daily_accrued },
              { label: 'Чеки', value: row.receipts },
              { label: 'Простой', value: row.idle },
              { label: 'Пр.корот.', value: row.bonus_short },
              { label: 'Б/Л', value: row.sick_accrued },
            ].filter(i => i.value);
            
            const deductionItems = [
              { label: 'Аванс', value: row.advance },
              { label: 'Аванс(Р)', value: row.registry_advance, icon: '📋' },
              { label: 'Исп.листы', value: row.enforcement },
              { label: 'Ост.ЗП', value: row.prev_balance },
              { label: 'Б/Л выпл.', value: row.sick_payout },
              { label: 'Увольнение', value: row.dismissal },
              { label: 'Переплата', value: row.overpay_prev },
            ].filter(i => i.value);
            
            const paidItems = [
              { label: 'Наличные', value: row.cash },
              { label: 'Суточные', value: row.daily_ved },
              { label: 'Сут.(Р)', value: row.registry_daily, icon: '📋' },
              { label: 'Подотчёт', value: row.subaccount },
              { label: 'Штраф', value: row.fine },
              { label: 'Удержание', value: row.retention },
              { label: 'Проч.(Р)', value: row.registry_other, icon: '📋' },
            ].filter(i => i.value);

            return (
              <div key={row.driver_id} className="bg-slate-800 rounded-lg mb-2 border border-slate-700 overflow-hidden"
                onClick={() => !isExp && toggleCard(row.driver_id)}>
                {/* Collapsed header */}
                <div className="px-3 py-2.5 flex items-center justify-between cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); toggleCard(row.driver_id); }}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs flex-shrink-0">{st.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">{isExp ? row.driver_name : shortName}</div>
                      <div className="text-[10px] text-slate-500">{vehicle}{vehicle && row.report_period ? ' · ' : ''}{row.report_period || ''}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className={`text-base font-bold ${(row.grand_total || 0) < 0 ? 'text-red-400' : 'text-white'}`}>
                      {fmtFull(row.grand_total || 0)}
                    </div>
                    {!isExp && <div className="text-[10px] text-slate-500">
                      {fmt(row.total_accrued)} − {fmt(row.total_deductions)} − {fmt(row.total_paid)}
                      {row.enforcement > 0 && <span className="ml-1 text-red-400">⚖️</span>}
                    </div>}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExp && (
                  <div className="px-3 pb-3 border-t border-slate-700 pt-2">
                    {/* Начислено */}
                    {accrualItems.length > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-green-400 font-medium">Начислено</span>
                          <span className="text-green-400 font-bold">{fmt(row.total_accrued)}</span>
                        </div>
                        {accrualItems.map(item => (
                          <div key={item.label} className="flex justify-between text-xs text-slate-400 pl-3">
                            <span>{item.label}</span><span>{fmt(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Удержания */}
                    {deductionItems.length > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-red-400 font-medium">Удержания</span>
                          <span className="text-red-400 font-bold">{fmt(row.total_deductions)}</span>
                        </div>
                        {row.enforcement > 0 && (
                          <div className="flex justify-between text-xs pl-3 mb-0.5 text-red-400 font-medium">
                            <span>⚖️ Исп.лист</span><span>−{fmtFull(row.enforcement)}</span>
                          </div>
                        )}
                        {deductionItems.map(item => (
                          <div key={item.label} className="flex justify-between text-xs text-slate-400 pl-3">
                            <span>{item.label}{(item as any).icon ? ` ${(item as any).icon}` : ''}</span><span>{fmt(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Выплачено */}
                    {paidItems.length > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-blue-400 font-medium">Выплачено</span>
                          <span className="text-blue-400 font-bold">{fmt(row.total_paid)}</span>
                        </div>
                        {paidItems.map(item => (
                          <div key={item.label} className="flex justify-between text-xs text-slate-400 pl-3">
                            <span>{item.label}{(item as any).icon ? ` ${(item as any).icon}` : ''}</span><span>{fmt(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* ИТОГО */}
                    <div className="border-t-2 border-slate-600 pt-2 mt-2 flex justify-between items-center">
                      <span className="text-sm font-bold text-white">К ВЫПЛАТЕ</span>
                      <span className={`text-lg font-bold ${(row.grand_total || 0) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {fmtFull(row.grand_total || 0)} ₽
                      </span>
                    </div>
                    {/* Km + fuel */}
                    {(row.total_km > 0 || row.fuel_consumption > 0) && (
                      <div className="text-[10px] text-slate-500 mt-1 text-right">
                        {row.total_km > 0 && `${Number(row.total_km).toLocaleString('ru-RU')} км`}
                        {row.fuel_consumption > 0 && ` · ${row.fuel_consumption.toFixed(1)} л/100`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Sticky bottom total */}
          <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-600 px-4 py-2 flex justify-between items-center z-50 md:hidden">
            <span className="text-sm text-slate-400">ИТОГО · {totals.driver_count || 0} вод.</span>
            <span className={`text-lg font-bold ${(totals.grand_total || 0) < 0 ? 'text-red-400' : 'text-white'}`}>
              {fmtFull(totals.grand_total || 0)} ₽
            </span>
          </div>
        </div>
      ) : (
        <div ref={tableRef} className="overflow-x-auto border border-slate-700 rounded-xl">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800">
                <th className="px-2 py-1 text-left text-[10px] text-slate-400 border-b border-slate-700 sticky left-0 bg-slate-800 z-20" rowSpan={2}>№</th>
                <th className="px-2 py-1 text-left text-[10px] text-slate-400 border-b border-slate-700 sticky left-8 bg-slate-800 z-20 min-w-[180px]" rowSpan={2}>ФИО / Машина</th>
                <th className="px-2 py-1 text-center text-[10px] text-slate-400 border-b border-slate-700 sal-status" rowSpan={2}>Статус</th>
                
                {/* G1: Удержания */}
                <th className="px-2 py-1 text-center text-[10px] border-b border-r border-slate-700 cursor-pointer select-none bg-red-900/10 hover:bg-red-900/20"
                    colSpan={expandedGroups.has('deductions') ? 9 : 1}
                    onClick={() => toggleGroup('deductions')}>
                  <span className="text-red-400">{expandedGroups.has('deductions') ? '▾' : '▸'} Удержания</span>
                </th>
                {/* G2: Выплачено */}
                <th className="px-2 py-1 text-center text-[10px] border-b border-r border-slate-700 cursor-pointer select-none bg-blue-900/10 hover:bg-blue-900/20"
                    colSpan={expandedGroups.has('paid') ? 8 : 1}
                    onClick={() => toggleGroup('paid')}>
                  <span className="text-blue-400">{expandedGroups.has('paid') ? '▾' : '▸'} Выплачено</span>
                </th>
                {/* G3: Начислено */}
                <th className="px-2 py-1 text-center text-[10px] border-b border-r border-slate-700 cursor-pointer select-none bg-green-900/10 hover:bg-green-900/20"
                    colSpan={expandedGroups.has('accrued') ? 11 : 1}
                    onClick={() => toggleGroup('accrued')}>
                  <span className="text-green-400">{expandedGroups.has('accrued') ? '▾' : '▸'} Начислено</span>
                </th>
                {/* G4: Итоги */}
                <th className="px-2 py-1 text-center text-[10px] border-b border-r border-slate-700 cursor-pointer select-none bg-yellow-900/10 hover:bg-yellow-900/20"
                    colSpan={expandedGroups.has('results') ? 4 : 1}
                    onClick={() => toggleGroup('results')}>
                  <span className="text-yellow-400">{expandedGroups.has('results') ? '▾' : '▸'} Итоги</span>
                </th>
                <th className="px-2 py-1 text-right text-[10px] text-slate-400 border-b border-slate-700" rowSpan={2}>Км</th>
                <th className="px-2 py-1 text-right text-[10px] text-slate-400 border-b border-slate-700 sal-fuel" rowSpan={2}>Расх.</th>
                <th className="px-2 py-1 text-right text-[10px] text-white border-b border-slate-700 sticky right-0 bg-slate-800 z-20 font-bold" rowSpan={2}>ИТОГО</th>
              </tr>
              <tr className="bg-slate-800/90 text-[9px]">
                {/* G1 sub-headers */}
                {expandedGroups.has('deductions') ? <>
                  <th className="px-1 py-0.5 text-right text-red-300/70 border-b border-slate-700">Отпуск</th>
                  <th className="px-1 py-0.5 text-right text-red-300/70 border-b border-slate-700">Аванс</th>
                  <th className="px-1 py-0.5 text-right text-red-300/70 border-b border-slate-700">📋Аванс(Р)</th>
                  <th className="px-1 py-0.5 text-right text-red-300/70 border-b border-slate-700">Исп.л.</th>
                  <th className="px-1 py-0.5 text-right text-red-300/70 border-b border-slate-700">Ост.ЗП</th>
                  <th className="px-1 py-0.5 text-right text-red-300/70 border-b border-slate-700">Б/Л</th>
                  <th className="px-1 py-0.5 text-right text-red-300/70 border-b border-slate-700">Увольн.</th>
                  <th className="px-1 py-0.5 text-right text-red-300/70 border-b border-slate-700">Перепл.</th>
                  <th className="px-1 py-0.5 text-right text-red-400 border-b border-r border-slate-700 font-bold">Итого</th>
                </> : <th className="px-1 py-0.5 text-right text-red-400 border-b border-r border-slate-700 font-bold">Итого</th>}
                {/* G2 sub-headers */}
                {expandedGroups.has('paid') ? <>
                  <th className="px-1 py-0.5 text-right text-blue-300/70 border-b border-slate-700">Налич.</th>
                  <th className="px-1 py-0.5 text-right text-blue-300/70 border-b border-slate-700">Суточн.</th>
                  <th className="px-1 py-0.5 text-right text-blue-300/70 border-b border-slate-700">📋Сут.(Р)</th>
                  <th className="px-1 py-0.5 text-right text-blue-300/70 border-b border-slate-700">Подотч.</th>
                  <th className="px-1 py-0.5 text-right text-blue-300/70 border-b border-slate-700">Штраф</th>
                  <th className="px-1 py-0.5 text-right text-blue-300/70 border-b border-slate-700">Удерж.</th>
                  <th className="px-1 py-0.5 text-right text-blue-300/70 border-b border-slate-700">📋Проч.(Р)</th>
                  <th className="px-1 py-0.5 text-right text-blue-400 border-b border-r border-slate-700 font-bold">Итого</th>
                </> : <th className="px-1 py-0.5 text-right text-blue-400 border-b border-r border-slate-700 font-bold">Итого</th>}
                {/* G3 sub-headers */}
                {expandedGroups.has('accrued') ? <>
                  <th className="px-1 py-0.5 text-right text-green-300/70 border-b border-slate-700">За км</th>
                  <th className="px-1 py-0.5 text-right text-green-300/70 border-b border-slate-700">Пр.км</th>
                  <th className="px-1 py-0.5 text-right text-green-300/70 border-b border-slate-700">Сверх.</th>
                  <th className="px-1 py-0.5 text-right text-green-300/70 border-b border-slate-700">Др.пр.</th>
                  <th className="px-1 py-0.5 text-right text-green-300/70 border-b border-slate-700">Погр.</th>
                  <th className="px-1 py-0.5 text-right text-green-300/70 border-b border-slate-700">Суточн.</th>
                  <th className="px-1 py-0.5 text-right text-green-300/70 border-b border-slate-700">Чеки</th>
                  <th className="px-1 py-0.5 text-right text-green-300/70 border-b border-slate-700">Прост.</th>
                  <th className="px-1 py-0.5 text-right text-green-300/70 border-b border-slate-700">Пр.к.</th>
                  <th className="px-1 py-0.5 text-right text-green-300/70 border-b border-slate-700">Б/Л</th>
                  <th className="px-1 py-0.5 text-right text-green-400 border-b border-r border-slate-700 font-bold">Итого</th>
                </> : <th className="px-1 py-0.5 text-right text-green-400 border-b border-r border-slate-700 font-bold">Итого</th>}
                {/* G4 sub-headers */}
                {expandedGroups.has('results') ? <>
                  <th className="px-1 py-0.5 text-right text-yellow-300/70 border-b border-slate-700">По отч.</th>
                  <th className="px-1 py-0.5 text-right text-yellow-300/70 border-b border-slate-700">К выпл.</th>
                  <th className="px-1 py-0.5 text-right text-yellow-300/70 border-b border-slate-700">Реестры</th>
                  <th className="px-1 py-0.5 text-right text-yellow-400 border-b border-r border-slate-700 font-bold">НГ</th>
                </> : <th className="px-1 py-0.5 text-right text-yellow-400 border-b border-r border-slate-700 font-bold">Итого</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const st = STATUS_MAP[row.status] || STATUS_MAP.draft;
                const isExpanded = expanded.has(row.driver_id);
                const hasMultiple = row.report_count > 1;

                return (
                  <React.Fragment key={row.driver_id}><tr className={`border-b border-slate-800 hover:bg-slate-800/50 ${row.report_count === 0 ? 'opacity-40' : ''}`}>
                    {/* Sticky cols */}
                    <td className="px-2 py-1.5 text-slate-500 sticky left-0 bg-slate-900 z-10 text-xs">{row.idx}</td>
                    <td className="px-2 py-1.5 sticky left-8 bg-slate-900 z-10">
                      <div className="flex items-center gap-1.5">
                        {row.report_count > 0 && (
                          <button onClick={() => toggleExpand(row.driver_id)} className="text-slate-400 hover:text-white">
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronR size={12} />}
                          </button>
                        )}
                        <span className="text-xs">{st.icon}</span>
                        <div>
                          <span className="text-xs text-white block whitespace-nowrap" title={row.driver_name}>{row.driver_name}</span>
                          {(row as any).vehicles?.length > 0 && (
                            <span className="text-[9px] text-slate-500">{(row as any).vehicles.join(', ')}</span>
                          )}
                        </div>
                        {row.report_count > 1 && <span className="text-[10px] bg-slate-700 px-1 rounded">{row.report_count}</span>}
                        {row.grand_total < -100 && <span title={`К выплате ${row.grand_total?.toLocaleString('ru-RU')}₽`} className="cursor-help">🔴</span>}
                        {row.overlaps?.length > 0 && <span title={`Перекрытия отчётов: ${row.overlaps.length}`} className="cursor-help">⚠️</span>}
                        {row.fuel_consumption > 50 && <span title={`Расход ${row.fuel_consumption} л/100км`} className="cursor-help">🟡</span>}
                        {row.total_km > 0 && row.km_salary === 0 && <span title="ЗП за км = 0 при пробеге > 0" className="cursor-help">🟡</span>}
                        {row.total_km > 0 && row.km_salary > 0 && row.km_salary / row.total_km > 30 && <span title={`Ставка ${(row.km_salary/row.total_km).toFixed(0)}₽/км`} className="cursor-help">🟡</span>}
                        {(row as any).overlaps?.length > 0 && <span className="text-[10px] text-red-400" title={(row as any).overlaps.map((o: any) => o.partial ? `Пересечение #${o.a} и #${o.b}` : `#${o.covering} покрывает #${o.covered}`).join('; ')}>⚠️</span>}
                      </div>
                    </td>
                    <td className="px-1 py-1 text-center border-r border-slate-700 sal-status">
                      <span className={`text-[10px] ${st.color}`}>{st.label}</span>
                    </td>

                    {/* G1: Удержания */}
                    {expandedGroups.has('deductions') && <>
                      <td className="px-1 py-1 text-right text-[10px]">{row.vacation_period || '—'}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.advance)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{row.registry_advance > 0 ? <span className="text-red-300">{fmt(row.registry_advance)}<span className="text-[7px] ml-0.5">📋</span></span> : fmt(0)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{row.enforcement > 0 ? <span className="text-red-400 font-medium">{fmt(row.enforcement)}</span> : fmt(0)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.prev_balance)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.sick_payout)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.dismissal)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.overpay_prev || 0)}</td>
                    </>}
                    <td className="px-1 py-1 text-right text-[10px] font-semibold text-red-400 border-r border-slate-700">{fmt(row.total_deductions)}{row.enforcement > 0 && <span className="ml-0.5" title={`Исп.лист: ${fmtFull(row.enforcement)} ₽`}>⚖️</span>}</td>
                    {/* G2: Выплачено */}
                    {expandedGroups.has('paid') && <>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.cash)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.daily_ved)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{row.registry_daily > 0 ? <span className="text-blue-300">{fmt(row.registry_daily)}<span className="text-[7px] ml-0.5">📋</span></span> : fmt(0)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.subaccount)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.fine)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.retention)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{row.registry_other > 0 ? <span className="text-blue-300">{fmt(row.registry_other)}<span className="text-[7px] ml-0.5">📋</span></span> : fmt(0)}</td>
                    </>}
                    <td className="px-1 py-1 text-right text-[10px] font-semibold text-blue-400 border-r border-slate-700">
                      <span title={row.register_unlinked > 0 ? `Отчёты: ${row.total_paid - row.register_unlinked}, Реестры: ${row.register_unlinked}` : ''}>
                        {fmt(row.total_paid)}{row.register_unlinked > 0 && <span className="text-blue-300 ml-0.5 text-[8px]">📋</span>}
                      </span>
                    </td>
                    {/* G3: Начислено */}
                    {expandedGroups.has('accrued') && <>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.km_salary)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.bonus_km)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.bonus_overtime)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.bonus_other)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.loading)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.daily_accrued)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.receipts)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.idle)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.bonus_short)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.sick_accrued)}</td>
                    </>}
                    <td className="px-1 py-1 text-right text-[10px] font-semibold text-green-400 border-r border-slate-700">{fmt(row.total_accrued)}</td>
                    {/* G4: Итоги */}
                    {expandedGroups.has('results') && <>
                      <td className="px-1 py-1 text-right text-[10px]">{fmt(row.by_report)}</td>
                      <td className="px-1 py-1 text-right text-[10px] font-bold">{fmt(row.to_pay)}</td>
                      <td className="px-1 py-1 text-right text-[10px]">
                        {row.register_unlinked > 0 ? <span className="text-green-400" title={(row.register_details||[]).map((d: any) => d.register_number + ': ' + Number(d.amount).toLocaleString('ru-RU') + ' р').join(', ')}>{fmt(row.register_unlinked)}</span> : <span className="text-slate-600">—</span>}
                      </td>
                    </>}
                    <td className="px-1 py-1 text-right text-[10px] font-semibold text-yellow-400 border-r border-slate-700">{fmt(row.grand_total)}</td>
                                        {/* G5: Км + Расход */}
                    <td className="px-2 py-1.5 text-right whitespace-nowrap text-xs text-slate-300">{(row.total_km || 0) > 0 ? Number(row.total_km).toLocaleString('ru-RU') : '—'}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap text-xs text-slate-300 sal-fuel">{(row.fuel_consumption || 0) > 0 ? Number(row.fuel_consumption).toFixed(1) : '—'}</td>
                    <td className={"px-2 py-1.5 text-right text-xs font-bold sticky right-0 bg-slate-800 z-10 " + (row.grand_total < 0 ? "text-red-500" : "text-white")}>{fmtFull(row.grand_total)}</td>
                  </tr>
                  {isExpanded && row.reports.length > 0 && (
                    <tr key={row.driver_id + '_detail'}>
                      <td colSpan={35} className="p-0">
                        <div className="bg-slate-800/80 border-t border-b border-slate-600 px-4 py-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-300">Отчёты ({row.reports.length})</span>
                            <button onClick={() => {
                              const d = prompt('Исключить отчёты до даты (ГГГГ-ММ-ДД):');
                              if (d) excludeBefore(d);
                            }} className="text-[10px] text-blue-400 hover:underline">Снять все до даты...</button>
                          </div>
                          <table className="w-full text-xs sal-table">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="text-left py-1 w-6">✓</th>
                                <th className="text-left py-1">Период</th>
                                <th className="text-left py-1">Машина</th>
                                <th className="text-right py-1">Км</th>
                                <th className="text-right py-1">За км</th>
                                <th className="text-right py-1">Суточн.</th>
                                <th className="text-right py-1">Чеки</th>
                                <th className="text-right py-1">Погруз.</th>
                                <th className="text-right py-1">Штраф</th>
                                <th className="text-right py-1">Прем.км</th>
                                <th className="text-left py-1">Номер</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.reports.map((r: any) => {
                                const excluded = excludedReports.has(String(r.id));
                                return (
                                  <tr key={r.id} className={excluded ? 'opacity-30 line-through' : 'hover:bg-slate-700/30'}>
                                    <td className="py-0.5">
                                      <input type="checkbox" checked={!excluded}
                                        onChange={() => toggleReport(String(r.id))}
                                        className="rounded bg-slate-700 border-slate-600 w-3 h-3" />
                                    </td>
                                    <td className="py-0.5 text-slate-300">
                                      {r.date_from ? new Date(r.date_from).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'}) : '?'}
                                      —{r.date_to ? new Date(r.date_to).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'}) : '?'}
                                    </td>
                                    <td className="py-0.5 text-slate-400 font-mono">{r.vehicle_number || '—'}</td>
                                    <td className="py-0.5 text-right text-white">{r.km ? Math.round(r.km).toLocaleString('ru-RU') : '—'}</td>
                                    <td className="py-0.5 text-right text-slate-300">{fmt(r.km_salary)}</td>
                                    <td className="py-0.5 text-right text-slate-300">{fmt(r.daily_accrued)}</td>
                                    <td className="py-0.5 text-right text-slate-300">{fmt(r.receipts_cash)}</td>
                                    <td className="py-0.5 text-right text-slate-300">{fmt(r.loading_unloading)}</td>
                                    <td className="py-0.5 text-right text-red-400">{fmt(r.fines)}</td>
                                    <td className="py-0.5 text-right text-green-400">{fmt(r.bonus_km)}</td>
                                    <td className="py-0.5">
                                      <a href={`/reports/${r.id}`} className="text-blue-400 hover:underline text-[10px]">
                                        №{r.number || r.id}
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
            {/* Footer totals */}
            <tfoot className="sticky bottom-0 bg-slate-900 border-t-2 border-slate-600">
              <tr>
                <td className="px-2 py-2 sticky left-0 bg-slate-900 z-20"></td>
                <td className="px-2 py-2 text-xs font-bold text-white sticky left-8 bg-slate-900 z-20">ИТОГО ({totals.driver_count})</td>
                <td className="px-2 py-2 border-r border-slate-700 text-center text-xs text-slate-400"></td>
                                {/* G1: Удержания */}
                {expandedGroups.has('deductions') && <>
                  <TCell value={totals.advance || 0} />
                  <TCell value={0} />
                  <TCell value={totals.enforcement || 0} />
                  <TCell value={totals.prev_balance || 0} />
                  <TCell value={totals.sick_payout || 0} />
                  <TCell value={totals.dismissal || 0} />
                  <TCell value={0} />
                  <td></td>
                </>}
                <td className="px-2 py-2 text-right text-xs font-bold text-red-400 border-r border-slate-700">{fmtFull(totals.total_deductions || 0)}</td>
                {/* G2: Выплачено */}
                {expandedGroups.has('paid') && <>
                  <TCell value={totals.cash || 0} />
                  <TCell value={totals.daily_ved || 0} />
                  <TCell value={0} />
                  <TCell value={totals.subaccount || 0} />
                  <TCell value={totals.fine || 0} />
                  <TCell value={totals.retention || 0} />
                  <TCell value={0} />
                </>}
                <td className="px-2 py-2 text-right text-xs font-bold text-blue-400 border-r border-slate-700">{fmtFull(totals.total_paid || 0)}</td>
                {/* G3: Начислено */}
                {expandedGroups.has('accrued') && <>
                  <TCell value={totals.km_salary || 0} />
                  <TCell value={totals.bonus_km || 0} />
                  <TCell value={totals.bonus_overtime || 0} />
                  <TCell value={totals.bonus_other || 0} />
                  <TCell value={totals.loading || 0} />
                  <TCell value={totals.daily_accrued || 0} />
                  <TCell value={totals.receipts || 0} />
                  <TCell value={totals.idle || 0} />
                  <TCell value={totals.bonus_short || 0} />
                  <TCell value={totals.sick_accrued || 0} />
                </>}
                <td className="px-2 py-2 text-right text-xs font-bold text-green-400 border-r border-slate-700">{fmtFull(totals.total_accrued || 0)}</td>
                {/* G4: Итоги */}
                {expandedGroups.has('results') && <>
                  <TCell value={totals.by_report || 0} />
                  <TCell value={totals.to_pay || 0} />
                  <TCell value={0} />
                </>}
                <td className="px-2 py-2 text-right text-xs font-bold text-yellow-400 border-r border-slate-700">{fmtFull(totals.grand_total || 0)}</td>
                {/* G5 */}
                <TCell value={totals.total_km || 0} />
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );}
