"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const MONTHS: Record<number,string> = {1:'Январь',2:'Февраль',3:'Март',4:'Апрель',5:'Май',6:'Июнь',7:'Июль',8:'Август',9:'Сентябрь',10:'Октябрь',11:'Ноябрь',12:'Декабрь'};
const fmtMoney = (n: any) => n != null ? Number(n).toLocaleString('ru-RU', {minimumFractionDigits:2}) + ' ₽' : '—';
const headers = () => { const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null; return t ? { Authorization: `Bearer ${t}` } : {}; };

export default function EnforcementPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterOrg, setFilterOrg] = useState('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterMonth) p.set('month', filterMonth);
      if (filterYear) p.set('year', filterYear);
      if (filterOrg !== 'all') p.set('org', filterOrg);
      const r = await fetch('/api/salary/enforcement?' + p, { headers: headers() });
      const d = await r.json();
      setOrders(d.orders || []);
      setStats(d.stats || {});
    } catch (e) {}
    setLoading(false);
  }, [filterMonth, filterYear, filterOrg]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (file: File) => {
    if (file.name.endsWith('.mxl')) {
      setUploadResult('❌ Формат 1С (MXL) не поддерживается. Выгрузите из 1С в формате Excel (.xlsx)');
      return;
    }
    setUploading(true); setUploadResult('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/salary/enforcement/upload', { method: 'POST', headers: headers(), body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      let msg = `✅ ${d.message}`;
      if (d.unmatched > 0) msg += `\n⚠️ Не найдено: ${d.unmatched_names?.join(', ')}`;
      setUploadResult(msg);
      load();
    } catch (e: any) { setUploadResult('❌ ' + e.message); }
    setUploading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить запись?')) return;
    await fetch(`/api/salary/enforcement/${id}`, { method: 'DELETE', headers: headers() });
    load();
  };

  const years = [...new Set(orders.map(o => o.period_year))].sort((a,b) => b-a);
  const months = [...new Set(orders.map(o => o.period_month))].sort((a,b) => a-b);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">⚖️ Исполнительные листы</h1>
          <p className="text-sm text-slate-400">Удержания из 1С</p>
        </div>
        <button onClick={() => { setShowUpload(!showUpload); setUploadResult(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">
          📥 Загрузить из 1С (.xlsx)
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400">Всего записей</div>
          <div className="text-white font-bold">{stats.total || 0}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400">Сопоставлено</div>
          <div className="text-green-400 font-bold">{stats.matched || 0}/{stats.total || 0}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400">Общая сумма</div>
          <div className="text-yellow-300 font-mono font-bold">{fmtMoney(stats.total_amount)}</div>
        </div>
      </div>

      {/* Upload */}
      {showUpload && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.mxl" className="hidden"
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          <div className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer"
            onClick={() => fileRef.current?.click()}>
            {uploading ? <span className="text-slate-400">Загрузка...</span> :
              <span className="text-slate-400">Нажмите для выбора файла (.xlsx)</span>}
          </div>
          {uploadResult && <pre className="mt-3 text-sm whitespace-pre-wrap">{uploadResult}</pre>}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm">
          <option value="all">Все организации</option>
          <option value="ООО ТЛ">ООО ТЛ</option>
          <option value="ООО ГП">ООО ГП</option>
          <option value="ИП Лихачёв">ИП Лихачёв</option>
        </select>
        {years.length > 0 && (
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm">
            <option value="">Все годы</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {months.length > 0 && (
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm">
            <option value="">Все месяцы</option>
            {months.map(m => <option key={m} value={m}>{MONTHS[m]}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? <div className="text-center py-8 text-slate-500">Загрузка...</div> :
       orders.length === 0 ? <div className="text-center py-8 text-slate-500">Нет данных. Загрузите файл из 1С.</div> :
       <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
            <th className="px-3 py-2 text-left">ФИО</th>
            <th className="px-3 py-2 text-left">НОМЕР ИЛ</th>
            <th className="px-3 py-2 text-left">ОРГ</th>
            <th className="px-3 py-2 text-left">ПЕРИОД</th>
            <th className="px-3 py-2 text-right">СУММА</th>
            <th className="px-3 py-2 text-left">ПОЛУЧАТЕЛЬ</th>
            <th className="px-3 py-2 text-center">СТАТУС</th>
            <th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>{orders.map(o => (
            <tr key={o.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
              <td className="px-3 py-2 text-white font-medium">{o.employee_name}</td>
              <td className="px-3 py-2 font-mono text-xs text-blue-400">{o.order_number}</td>
              <td className="px-3 py-2 text-xs">{o.organization}</td>
              <td className="px-3 py-2 text-xs">{MONTHS[o.period_month]} {o.period_year}</td>
              <td className="px-3 py-2 text-right font-mono text-yellow-300">{fmtMoney(o.amount)}</td>
              <td className="px-3 py-2 text-xs text-slate-400 max-w-[200px] truncate">{o.recipient || '—'}</td>
              <td className="px-3 py-2 text-center">
                {o.match_status === 'matched' || o.match_status === 'manual'
                  ? <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded">✅ {o.matched_name || 'Связан'}</span>
                  : <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded">⚠️ Не найден</span>}
              </td>
              <td className="px-3 py-2">
                <button onClick={() => handleDelete(o.id)} className="text-red-400 hover:text-red-300 text-xs">🗑️</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
       </div>}
    </div>
  );
}
