"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Printer, Link2 } from "lucide-react";

const ORG_LABELS: Record<string,string> = { tl: 'ООО ТЛ', gp: 'ООО ГП', ip: 'ИП Лихачёв' };
const fmtMoney = (n: any) => n != null ? Number(n).toLocaleString('ru-RU', {minimumFractionDigits: 2}) + ' ₽' : '—';
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';
const typeIcon = (t: string) => t === 'суточные' ? '🌙' : '💰';
const headers = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export default function RegisterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [linking, setLinking] = useState<number|null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [editingId, setEditingId] = useState<number|null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/salary/registers/${id}`, { headers: headers() });
      if (!r.ok) throw new Error('not found');
      setData(await r.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/drivers', { headers: headers() }).then(r=>r.json()).then(d => setDrivers(Array.isArray(d) ? d : d.drivers || [])).catch(()=>{});
  }, []);

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500">Загрузка...</div>;
  if (!data?.register) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-red-400">Реестр не найден</div>;

  const reg = data.register;
  const payments = data.payments || [];
  const matched = payments.filter((p: any) => p.matched_name || p.driver_id).length;

  const handleLink = async (paymentId: number, driverName: string) => {
    await fetch(`/api/salary/registers/payments/${paymentId}/link`, {
      method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_report_id: driverName })
    });
    setLinking(null);
    load();
  };

  const handleEditAmount = async (paymentId: number) => {
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt < 0) { alert('Некорректная сумма'); return; }
    await fetch(`/api/salary/registers/payments/${paymentId}`, {
      method: 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt })
    });
    setEditingId(null);
    load();
  };

  const handleDeletePayment = async (paymentId: number, name: string) => {
    if (!confirm(`Удалить строку "${name}"?`)) return;
    await fetch(`/api/salary/registers/payments/${paymentId}`, {
      method: 'DELETE', headers: headers()
    });
    load();
  };

  const handleDeleteRegister = async () => {
    if (!confirm('Удалить весь реестр? Все строки будут удалены.')) return;
    setDeleting(true);
    await fetch(`/api/salary/registers/${id}`, { method: 'DELETE', headers: headers() });
    router.push('/salary/registers');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button onClick={() => router.push('/salary/registers')} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-2">
            <ArrowLeft size={16}/> Назад к списку
          </button>
          <h1 className="text-2xl font-bold text-white">
            {typeIcon(reg.register_type)} Реестр ЗП №{reg.tl_number || reg.register_number}
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm">
            <Printer size={14}/> Печать
          </button>
          <button onClick={handleDeleteRegister} disabled={deleting}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-sm border border-red-500/30">
            🗑️ Удалить реестр
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400">Дата</div>
          <div className="text-white font-medium">{fmtDate(reg.register_date)}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400">Тип</div>
          <div className="text-white font-medium">{typeIcon(reg.register_type)} {reg.register_type === 'суточные' ? 'Суточные' : 'Зарплата'}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400">Организация</div>
          <div className="text-white font-medium">{ORG_LABELS[reg.organization] || reg.organization || '—'}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400">Сумма</div>
          <div className="text-yellow-300 font-bold font-mono">{fmtMoney(reg.total_amount)}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400">Сопоставлено</div>
          <div className="text-white font-medium">
            <span className={matched === payments.length ? 'text-green-400' : 'text-yellow-400'}>{matched}</span>
            <span className="text-slate-500">/{payments.length}</span>
          </div>
        </div>
      </div>

      {/* File info */}
      {reg.file_name && (
        <div className="text-xs text-slate-500 mb-4">📎 Файл: {reg.file_name}{reg.comment ? ` — ${reg.comment}` : ''}</div>
      )}

      {/* Payments table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs uppercase border-b border-slate-700 bg-slate-800/80">
              <th className="px-3 py-3 text-left w-12">№</th>
              <th className="px-3 py-3 text-left">ФИО</th>
              <th className="px-3 py-3 text-right w-32">Сумма</th>
              <th className="px-3 py-3 text-left w-40">Счёт / Карта</th>
              <th className="px-3 py-3 text-center w-44">Статус</th>
              <th className="px-3 py-3 text-left w-48">Водитель TL196</th>
              <th className="px-3 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p: any, i: number) => {
              const isMatched = !!(p.matched_name || p.driver_id);
              return (
                <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-3 py-2 text-slate-500">{p.employee_number || i + 1}</td>
                  <td className="px-3 py-2 text-white font-medium">{p.full_name}</td>
                  <td className="px-3 py-2 text-right font-mono text-yellow-300">
                    {editingId === p.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <input type="number" step="0.01" value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleEditAmount(p.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="bg-slate-700 border border-yellow-500/50 rounded px-2 py-0.5 text-xs w-24 text-right text-yellow-300" autoFocus />
                        <button onClick={() => handleEditAmount(p.id)} className="text-green-400 text-xs">✓</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500 text-xs">✕</button>
                      </div>
                    ) : (
                      <span className="cursor-pointer hover:text-yellow-200" onClick={() => { setEditingId(p.id); setEditAmount(String(p.amount)); }}>
                        {fmtMoney(p.amount)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-500 text-xs">
                    {p.bank_account ? `...${p.bank_account.slice(-8)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isMatched
                      ? <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded">✅ Сопоставлен</span>
                      : <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded">⚠️ Не найден</span>}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {isMatched
                      ? <span className="text-green-400">{p.matched_name || p.driver_id}</span>
                      : linking === p.id
                        ? <div className="flex gap-1">
                            <input value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                              className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs w-32"
                              placeholder="Поиск..." autoFocus />
                            <div className="absolute mt-7 bg-slate-700 rounded shadow-lg z-10 max-h-40 overflow-y-auto w-48">
                              {drivers.filter(d => !linkSearch || (d.full_name||'').toLowerCase().includes(linkSearch.toLowerCase())).slice(0,8).map(d => (
                                <div key={d.id} onClick={() => handleLink(p.id, d.full_name)}
                                  className="px-2 py-1 text-xs hover:bg-slate-600 cursor-pointer">{d.full_name}</div>
                              ))}
                            </div>
                          </div>
                        : <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {!isMatched && linking !== p.id && (
                        <button onClick={() => { setLinking(p.id); setLinkSearch(''); }}
                          className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
                          <Link2 size={12}/> Привязать
                        </button>
                      )}
                      <button onClick={() => handleDeletePayment(p.id, p.full_name)}
                        className="text-red-400/50 hover:text-red-400 text-xs ml-1" title="Удалить строку">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 text-sm text-slate-400 text-right">
        Итого: <span className="text-yellow-300 font-mono font-bold">{fmtMoney(payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0))}</span>
        {' · '}{payments.length} записей{' · '}сопоставлено {matched}
      </div>
    </div>
  );
}
