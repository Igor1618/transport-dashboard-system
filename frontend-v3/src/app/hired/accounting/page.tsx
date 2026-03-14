'use client';
import { useAuth } from '@/components/AuthProvider';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

type LegacyItem = { wb_id: number; vehicle_plate: string; trip_date: string; total_price: number; trip_amount: number; is_fine: boolean; fine_sum: number; legacy_status: string; legacy_payment_info: string; legacy_note: string; month: string; carrier_name: string; carrier_id: string; };
type MonthGroup = { month: string; total: number; active: number; paid_external: number; unpaid: number; disputed: number; closed: number; };
type Summary = { total: number; active: number; paid_external: number; unpaid: number; disputed: number; closed: number; trips_with_penalty: number; total_penalties: number; };
type Dashboard = { to_pay: number; paid_month: number; penalties_confirmed: number; legacy_pending: number; };
type PendingContract = { id: string; contract_number: string; carrier_name: string; route: string; price: number; trip_count: number; total_penalties: number; linked_trips: number; status: string; created_at: string; };

const statusLabels: Record<string,string> = { active: '⬜ Не разобрано', paid_external: '🟢 Оплачено', unpaid: '🔴 Не оплачено', disputed: '🟡 Спорный', closed: '⚫ Закрыто' };
const statusColors: Record<string,string> = { active: 'bg-slate-600', paid_external: 'bg-green-600', unpaid: 'bg-red-600', disputed: 'bg-yellow-600', closed: 'bg-slate-500' };

function fmtDate(d: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
function fmtMoney(n: number) { return Number(n || 0).toLocaleString('ru-RU'); }

const penaltyTypes: Record<string,string> = { late_arrival:'Опоздание', late_delivery:'Просрочка', cargo_damage:'Повреждение груза', document_late:'Задержка документов', document_bad:'Ненадлежащее оформление', wb_penalty:'Штраф WB', behavior:'Нарушение на объекте', no_show:'Неподача ТС', other:'Прочее' };
const penaltyStatuses: Record<string,{label:string,color:string}> = { new:{label:'🆕 Новый',color:'bg-blue-600'}, notified:{label:'📧 Уведомлён',color:'bg-purple-600'}, confirmed:{label:'✅ Подтверждён',color:'bg-green-600'}, disputed:{label:'⚡ Оспаривается',color:'bg-yellow-600'}, offset:{label:'💰 Удержан',color:'bg-emerald-600'}, paid:{label:'✅ Оплачен',color:'bg-teal-600'}, cancelled:{label:'❌ Отменён',color:'bg-slate-600'} };

function PenaltiesTab({ hdr }: { hdr: () => Record<string,string> }) {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [fPenStatus, setFPenStatus] = useState('');
  const [fPenType, setFPenType] = useState('');
  const [fPenCarrier, setFPenCarrier] = useState('');
  const [fPenFrom, setFPenFrom] = useState('');
  const [fPenTo, setFPenTo] = useState('');
  const [editModal, setEditModal] = useState<any>(null);
  const [editAmt, setEditAmt] = useState('');
  const [editNote, setEditNote] = useState('');

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (fPenStatus) p.set('status', fPenStatus);
    if (fPenType) p.set('type', fPenType);
    if (fPenCarrier) p.set('carrier_id', fPenCarrier);
    if (fPenFrom) p.set('from', fPenFrom);
    if (fPenTo) p.set('to', fPenTo);
    const r = await fetch(`/api/hired/accounting/penalties?${p}`, { headers: hdr() });
    if (r.ok) { const d = await r.json(); setItems(d.items); setTotal(d.total); }
  }, [fPenStatus, fPenType, fPenCarrier, fPenFrom, fPenTo]);

  useEffect(() => { load(); }, [load]);

  const confirm = async (id: string) => { if (!window.confirm('Подтвердить штраф?')) return; await fetch(`/api/hired/accounting/penalties/${id}/confirm`, { method: 'POST', headers: hdr() }); load(); };
  const cancel = async (id: string) => { const reason = prompt('Причина отмены:'); if (!reason) return; await fetch(`/api/hired/accounting/penalties/${id}/cancel`, { method: 'POST', headers: hdr(), body: JSON.stringify({ reason }) }); load(); };
  const saveEdit = async () => { if (!editModal || !editNote) return; await fetch(`/api/hired/accounting/penalties/${editModal.id}`, { method: 'PATCH', headers: hdr(), body: JSON.stringify({ penalty_amount: editAmt ? Number(editAmt) : undefined, notes: editNote }) }); setEditModal(null); load(); };

  const carriers = useMemo(() => [...new Set(items.map(i => i.carrier_name).filter(Boolean))].sort(), [items]);

  return (
    <div>
      <div className="bg-slate-800 rounded-lg p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col">
            <label className="text-[10px] text-slate-500 mb-1">Статус</label>
            <select value={fPenStatus} onChange={e => setFPenStatus(e.target.value)} className="bg-slate-700 text-white text-xs px-2 py-1.5 rounded">
              <option value="">Все</option>
              {Object.entries(penaltyStatuses).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-slate-500 mb-1">Тип</label>
            <select value={fPenType} onChange={e => setFPenType(e.target.value)} className="bg-slate-700 text-white text-xs px-2 py-1.5 rounded">
              <option value="">Все типы</option>
              {Object.entries(penaltyTypes).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-slate-500 mb-1">С</label>
            <input type="date" value={fPenFrom} onChange={e => setFPenFrom(e.target.value)} className="bg-slate-700 text-white text-xs px-2 py-1.5 rounded" />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-slate-500 mb-1">По</label>
            <input type="date" value={fPenTo} onChange={e => setFPenTo(e.target.value)} className="bg-slate-700 text-white text-xs px-2 py-1.5 rounded" />
          </div>
          {(fPenStatus || fPenType || fPenFrom || fPenTo) && <button onClick={() => { setFPenStatus(''); setFPenType(''); setFPenCarrier(''); setFPenFrom(''); setFPenTo(''); }} className="text-xs text-red-400">✕ Сбросить</button>}
        </div>
      </div>

      {items.length === 0 ? <div className="text-slate-400 text-center py-8">Нет штрафов</div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 text-xs">
                <th className="p-2 text-left">Дата</th><th className="p-2 text-left">Перевозчик</th><th className="p-2 text-left">Тип</th><th className="p-2 text-left">Причина</th><th className="p-2">Сумма</th><th className="p-2">Статус</th><th className="p-2">ДЗ</th><th className="p-2">Действия</th>
              </tr></thead>
              <tbody>
                {items.map((p: any) => (
                  <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-800/50">
                    <td className="p-2 whitespace-nowrap">{fmtDate(p.penalty_date)}</td>
                    <td className="p-2 text-xs">{p.carrier_name || '—'}</td>
                    <td className="p-2 text-xs">{penaltyTypes[p.penalty_type] || p.penalty_type}</td>
                    <td className="p-2 text-xs text-slate-400 max-w-[200px] truncate" title={p.reason}>{p.reason || '—'}</td>
                    <td className="p-2 text-right font-medium">{fmtMoney(p.penalty_amount)} ₽</td>
                    <td className="p-2"><span className={`px-2 py-0.5 rounded text-[10px] ${(penaltyStatuses[p.status] || {color:'bg-slate-600'}).color}`}>{(penaltyStatuses[p.status] || {label:p.status}).label}</span></td>
                    <td className="p-2 text-xs text-blue-400">{p.contract_number || '—'}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {['new','notified'].includes(p.status) && <button onClick={() => confirm(p.id)} className="px-1.5 py-1 bg-green-700 rounded text-xs" title="Подтвердить">✅</button>}
                        {['new','notified','confirmed','disputed'].includes(p.status) && <button onClick={() => { setEditModal(p); setEditAmt(String(p.penalty_amount)); setEditNote(''); }} className="px-1.5 py-1 bg-blue-700 rounded text-xs" title="Редактировать">✏️</button>}
                        {!['cancelled','paid'].includes(p.status) && <button onClick={() => cancel(p.id)} className="px-1.5 py-1 bg-red-700 rounded text-xs" title="Отменить">🗑</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-800 p-3 mt-2 rounded flex justify-between text-sm">
            <span>Всего: {items.length} шт</span>
            <span className="font-bold">Сумма: {fmtMoney(total)} ₽</span>
          </div>
        </>
      )}

      {/* Edit penalty modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditModal(null)}>
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">✏️ Редактировать штраф</h3>
            <p className="text-sm text-slate-400 mb-3">{penaltyTypes[editModal.penalty_type] || editModal.penalty_type} — {editModal.carrier_name}</p>
            <div className="mb-3">
              <label className="text-xs text-slate-400">Сумма, ₽</label>
              <input type="number" value={editAmt} onChange={e => setEditAmt(e.target.value)} className="w-full bg-slate-700 text-white px-3 py-2 rounded mt-1 text-sm" />
            </div>
            <div className="mb-4">
              <label className="text-xs text-slate-400">Комментарий (обязательно)</label>
              <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Причина изменения" className="w-full bg-slate-700 text-white px-3 py-2 rounded mt-1 text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 bg-slate-600 rounded text-sm">Отмена</button>
              <button onClick={saveEdit} disabled={!editNote} className="px-4 py-2 bg-blue-600 rounded text-sm disabled:opacity-50">💾 Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountingPage() {
  const { effectiveRole } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('legacy');
  const [dash, setDash] = useState<Dashboard>({ to_pay: 0, paid_month: 0, penalties_confirmed: 0, legacy_pending: 0 });
  const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, paid_external: 0, unpaid: 0, disputed: 0, closed: 0 });
  const [byMonth, setByMonth] = useState<MonthGroup[]>([]);
  const [items, setItems] = useState<LegacyItem[]>([]);
  const [pending, setPending] = useState<PendingContract[]>([]);
  const [accepted, setAccepted] = useState<PendingContract[]>([]);
  const [paid, setPaid] = useState<PendingContract[]>([]);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<{ wb_id: number; action: string } | null>(null);
  const [modalPayInfo, setModalPayInfo] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [carrierSummary, setCarrierSummary] = useState<any[]>([]);
  const [bulkModal, setBulkModal] = useState<string | null>(null);
  // Filters
  const [fStatus, setFStatus] = useState('all');
  const [fCarrier, setFCarrier] = useState('');
  const [fPlate, setFPlate] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fPenalty, setFPenalty] = useState(false);

  const hdr = () => ({ 'x-user-role': effectiveRole, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (fStatus !== 'all') params.set('status', fStatus);
      if (fCarrier) params.set('carrier_name', fCarrier);
      if (fPlate) params.set('plate', fPlate);
      if (fFrom) params.set('from', fFrom);
      if (fTo) params.set('to', fTo);
      if (fPenalty) params.set('has_penalty', 'true');
      const qs = params.toString() ? '?' + params.toString() : '';
      const [dRes, lRes] = await Promise.all([
        fetch('/api/hired/accounting/dashboard', { headers: hdr() }),
        fetch(`/api/hired/accounting/legacy${qs}`, { headers: hdr() }),
      ]);
      if (dRes.ok) setDash(await dRes.json());
      if (lRes.ok) {
        const d = await lRes.json();
        setSummary(d.summary); setByMonth(d.by_month); setItems(d.items);
        if (d.by_month.length && openMonths.size === 0) setOpenMonths(new Set([d.by_month[0].month]));
      }
    } catch(e) {}
    setLoading(false);
  }, [effectiveRole, fStatus, fCarrier, fPlate, fFrom, fTo, fPenalty]);

  const loadPending = useCallback(async () => {
    const r = await fetch('/api/hired/accounting/pending', { headers: hdr() });
    if (r.ok) setPending(await r.json());
  }, [effectiveRole]);

  const loadAccepted = useCallback(async () => {
    const r = await fetch('/api/hired/contracts?status=accepted', { headers: hdr() });
    if (r.ok) { const d = await r.json(); setAccepted(Array.isArray(d) ? d : d.contracts || []); }
  }, [effectiveRole]);

  const loadPaid = useCallback(async () => {
    const r = await fetch('/api/hired/contracts?status=paid', { headers: hdr() });
    if (r.ok) { const d = await r.json(); setPaid(Array.isArray(d) ? d : d.contracts || []); }
  }, [effectiveRole]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (tab === 'pending') loadPending(); if (tab === 'payable') loadAccepted(); if (tab === 'paid') loadPaid(); }, [tab]);

  // Unique carriers and plates for dropdowns
  const carriers = useMemo(() => [...new Set(items.map(i => i.carrier_name).filter(Boolean))].sort(), [items]);
  const plates = useMemo(() => [...new Set(items.map(i => i.vehicle_plate).filter(Boolean))].sort(), [items]);

  const updateLegacy = async (wbId: number, status: string, payInfo?: string, note?: string) => {
    await fetch(`/api/hired/accounting/legacy/${wbId}`, { method: 'PATCH', headers: hdr(), body: JSON.stringify({ legacy_status: status, legacy_payment_info: payInfo, legacy_note: note }) });
    loadData();
  };

  const bulkUpdate = async (status: string, payInfo?: string, note?: string) => {
    await fetch('/api/hired/accounting/legacy/bulk', { method: 'POST', headers: hdr(), body: JSON.stringify({ waysheet_ids: Array.from(selected), legacy_status: status, legacy_payment_info: payInfo, legacy_note: note }) });
    setSelected(new Set()); setBulkModal(null); setModalPayInfo(''); loadData();
  };

  const acceptContract = async (id: string) => {
    if (!confirm('Принять ДЗ к оплате?')) return;
    await fetch(`/api/hired/accounting/${id}/accept`, { method: 'POST', headers: hdr() });
    loadPending(); loadAccepted();
  };

  const rejectContract = async (id: string) => {
    const reason = prompt('Причина отклонения:');
    if (!reason) return;
    await fetch(`/api/hired/accounting/${id}/reject`, { method: 'POST', headers: hdr(), body: JSON.stringify({ reason }) });
    loadPending();
  };

  const markPaid = async (id: string) => {
    const pn = prompt('Номер платёжки:');
    if (!pn) return;
    await fetch(`/api/hired/accounting/${id}/mark-paid`, { method: 'POST', headers: hdr(), body: JSON.stringify({ payment_number: pn }) });
    loadAccepted(); loadPaid();
  };

  const toggleMonth = (m: string) => {
    const s = new Set(openMonths);
    s.has(m) ? s.delete(m) : s.add(m);
    setOpenMonths(s);
  };

  const toggleSelect = (id: number) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const monthItems = (m: string) => items.filter(i => i.month === m);
  const monthLabel = (m: string) => { const [y, mo] = m.split('-'); const names = ['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']; return `${names[parseInt(mo)]} ${y}`; };

  if (!['accountant','admin','superadmin','director'].includes(effectiveRole)) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-red-400">Нет доступа</div>;
  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Загрузка...</div>;

  const tabs = [
    { id: 'legacy', label: `Легаси (${summary.active})`, icon: '📦' },
    { id: 'pending', label: `На проверку (${pending.length})`, icon: '📋' },
    { id: 'payable', label: `К оплате (${accepted.length})`, icon: '💰' },
    { id: 'penalties', label: 'Штрафы', icon: '⚠️' },
    { id: 'paid', label: 'Оплаченные', icon: '✅' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">📊 Учёт наёмного транспорта</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-4"><div className="text-xs text-blue-300">К оплате</div><div className="text-xl font-bold text-blue-400">{fmtMoney(dash.to_pay)} ₽</div></div>
        <div className="bg-green-900/40 border border-green-700 rounded-lg p-4"><div className="text-xs text-green-300">Оплачено (месяц)</div><div className="text-xl font-bold text-green-400">{fmtMoney(dash.paid_month)} ₽</div></div>
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4"><div className="text-xs text-red-300">Штрафы WB (легаси)</div><div className="text-xl font-bold text-red-400">{fmtMoney(dash.penalties_confirmed)} ₽</div></div>
        <div className="bg-yellow-900/40 border border-yellow-700 rounded-lg p-4"><div className="text-xs text-yellow-300">Легаси не разобрано</div><div className="text-xl font-bold text-yellow-400">{dash.legacy_pending}</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-t text-sm whitespace-nowrap ${tab === t.id ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* LEGACY TAB */}
      {tab === 'legacy' && (
        <div>
          {/* Filters panel */}
          <div className="bg-slate-800 rounded-lg p-3 mb-4">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-500 mb-1">Статус</label>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="bg-slate-700 text-white text-xs px-2 py-1.5 rounded">
                  <option value="all">Все ({summary.total})</option>
                  <option value="active">⬜ Не разобрано ({summary.active})</option>
                  <option value="paid_external">🟢 Оплачено ({summary.paid_external})</option>
                  <option value="unpaid">🔴 Не оплачено ({summary.unpaid})</option>
                  <option value="disputed">🟡 Спорный ({summary.disputed})</option>
                  <option value="closed">⚫ Закрыто ({summary.closed})</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-500 mb-1">Перевозчик</label>
                <select value={fCarrier} onChange={e => setFCarrier(e.target.value)} className="bg-slate-700 text-white text-xs px-2 py-1.5 rounded max-w-[180px]">
                  <option value="">Все перевозчики</option>
                  {carriers.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-500 mb-1">Машина</label>
                <select value={fPlate} onChange={e => setFPlate(e.target.value)} className="bg-slate-700 text-white text-xs px-2 py-1.5 rounded font-mono">
                  <option value="">Все машины</option>
                  {plates.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-500 mb-1">С</label>
                <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className="bg-slate-700 text-white text-xs px-2 py-1.5 rounded" />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-500 mb-1">По</label>
                <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} className="bg-slate-700 text-white text-xs px-2 py-1.5 rounded" />
              </div>
              <button onClick={() => setFPenalty(!fPenalty)} className={`px-3 py-1.5 rounded text-xs ${fPenalty ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}>🔴 Со штрафами{fPenalty && summary.trips_with_penalty ? ` (${summary.trips_with_penalty})` : ''}</button>
              {(fStatus !== 'all' || fCarrier || fPlate || fFrom || fTo || fPenalty) && (
                <button onClick={() => { setFStatus('all'); setFCarrier(''); setFPlate(''); setFFrom(''); setFTo(''); setFPenalty(false); }} className="px-2 py-1.5 text-xs text-red-400 hover:text-red-300">✕ Сбросить</button>
              )}
              <button onClick={async () => { setShowSummary(!showSummary); if (!showSummary && !carrierSummary.length) { const r = await fetch('/api/hired/accounting/legacy/summary', { headers: hdr() }); if (r.ok) setCarrierSummary(await r.json()); } }} className={`px-3 py-1.5 rounded text-xs ml-auto ${showSummary ? 'bg-purple-600 text-white' : 'bg-purple-700/50 text-purple-300 hover:bg-purple-700'}`}>
                📊 Сводка {showSummary ? '▲' : '▼'}
              </button>
            </div>
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="bg-slate-800 p-3 rounded mb-3 flex gap-2 items-center">
              <span className="text-sm">☑ Выбрано: {selected.size}</span>
              <button onClick={() => { setModalPayInfo(''); setBulkModal('paid_external'); }} className="px-3 py-1 bg-green-700 rounded text-xs">💰 Все оплачены</button>
              <button onClick={() => { setModalPayInfo(''); setBulkModal('closed'); }} className="px-3 py-1 bg-slate-600 rounded text-xs">🗑 Закрыть все</button>
              <button onClick={() => setSelected(new Set())} className="px-2 py-1 text-xs text-slate-400">✕ Снять</button>
            </div>
          )}

          {/* Carrier Summary */}
          {showSummary && (
            <div className="bg-slate-800 rounded-lg p-4 mb-4 overflow-x-auto relative">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">📊 Сводка по перевозчикам</h3>
                <button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-white text-lg px-2">✕</button>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-slate-400 text-xs">
                  <th className="text-left p-1">Перевозчик</th><th className="p-1">Всего</th><th className="p-1">Разобрано</th><th className="p-1">Оплач.</th><th className="p-1">Не оплач.</th><th className="p-1">Спорн.</th><th className="p-1 text-right">Сумма не опл.</th>
                </tr></thead>
                <tbody>
                  {carrierSummary.map((c: any, i: number) => (
                    <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/30 cursor-pointer" onClick={() => { setFCarrier(c.carrier_name || ''); setShowSummary(false); }}>
                      <td className="p-1">{c.carrier_name || '— Без перевозчика'}</td>
                      <td className="p-1 text-center">{c.total}</td>
                      <td className="p-1 text-center">{c.total - c.active}</td>
                      <td className="p-1 text-center text-green-400">{c.paid_external}</td>
                      <td className="p-1 text-center text-red-400">{c.unpaid}</td>
                      <td className="p-1 text-center text-yellow-400">{c.disputed}</td>
                      <td className="p-1 text-right">{fmtMoney(c.unpaid_amount)} ₽</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-600 font-bold">
                    <td className="p-1">ИТОГО</td>
                    <td className="p-1 text-center">{carrierSummary.reduce((s: number,c: any) => s + Number(c.total), 0)}</td>
                    <td className="p-1 text-center">{carrierSummary.reduce((s: number,c: any) => s + Number(c.total) - Number(c.active), 0)}</td>
                    <td className="p-1 text-center text-green-400">{carrierSummary.reduce((s: number,c: any) => s + Number(c.paid_external), 0)}</td>
                    <td className="p-1 text-center text-red-400">{carrierSummary.reduce((s: number,c: any) => s + Number(c.unpaid), 0)}</td>
                    <td className="p-1 text-center text-yellow-400">{carrierSummary.reduce((s: number,c: any) => s + Number(c.disputed), 0)}</td>
                    <td className="p-1 text-right">{fmtMoney(carrierSummary.reduce((s: number,c: any) => s + Number(c.unpaid_amount), 0))} ₽</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Months accordion */}
          {byMonth.map(m => (
            <div key={m.month} className="mb-3">
              <button onClick={() => toggleMonth(m.month)} className="w-full bg-slate-800 p-3 rounded-t flex justify-between items-center hover:bg-slate-750">
                <span className="font-bold">{openMonths.has(m.month) ? '▼' : '▶'} {monthLabel(m.month)} ({m.total} рейсов, {m.active} не разобрано)</span>
                <span className="text-xs text-slate-400">🟢{m.paid_external} 🔴{m.unpaid} 🟡{m.disputed}</span>
              </button>
              {/* Progress bar */}
              <div className="bg-slate-800 px-3 pb-1">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                  <div className="bg-green-500 h-full" style={{ width: `${(m.paid_external / Math.max(m.total,1)) * 100}%` }} />
                  <div className="bg-red-500 h-full" style={{ width: `${(m.unpaid / Math.max(m.total,1)) * 100}%` }} />
                  <div className="bg-yellow-500 h-full" style={{ width: `${(m.disputed / Math.max(m.total,1)) * 100}%` }} />
                  <div className="bg-slate-500 h-full" style={{ width: `${(m.closed / Math.max(m.total,1)) * 100}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-1">{m.total - m.active}/{m.total} разобрано ({Math.round(((m.total - m.active) / Math.max(m.total,1)) * 100)}%)</div>
              </div>

              {openMonths.has(m.month) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-slate-400 text-xs bg-slate-800">
                      <th className="p-2 w-8"><input type="checkbox" onChange={e => { const mi = monthItems(m.month); const s = new Set(selected); mi.forEach(i => e.target.checked ? s.add(i.wb_id) : s.delete(i.wb_id)); setSelected(s); }} /></th>
                      <th className="p-2 text-left">Дата</th><th className="p-2 text-left">Рейс</th><th className="p-2 text-left">Машина</th><th className="p-2 text-left">Перевозчик</th><th className="p-2">Сумма</th><th className="p-2">Штраф WB</th><th className="p-2">Статус</th><th className="p-2">Комментарий</th><th className="p-2">Действия</th>
                    </tr></thead>
                    <tbody>
                      {monthItems(m.month).map(item => (
                        <tr key={item.wb_id} className="border-t border-slate-700 hover:bg-slate-800/50">
                          <td className="p-2"><input type="checkbox" checked={selected.has(item.wb_id)} onChange={() => toggleSelect(item.wb_id)} /></td>
                          <td className="p-2 whitespace-nowrap">{fmtDate(item.trip_date)}</td>
                          <td className="p-2">{item.wb_id}</td>
                          <td className="p-2 font-mono text-xs">{item.vehicle_plate}</td>
                          <td className="p-2 text-xs max-w-[150px] truncate">{item.carrier_name || <span className="text-slate-500">—</span>}</td>
                          <td className="p-2 text-right whitespace-nowrap">{item.trip_amount ? fmtMoney(item.trip_amount) + ' ₽' : '—'}</td>
                          <td className="p-2 text-right whitespace-nowrap">{Number(item.fine_sum) > 0 ? <span className="text-red-400">🔴 {fmtMoney(item.fine_sum)} ₽</span> : '—'}</td>
                          <td className="p-2"><span className={`px-2 py-0.5 rounded text-[10px] ${statusColors[item.legacy_status]}`}>{(statusLabels[item.legacy_status] || item.legacy_status).replace(/^[^\s]+\s/, '')}</span></td>
                          <td className="p-2 text-xs text-slate-400 max-w-[120px] truncate" title={item.legacy_payment_info || item.legacy_note || ''}>{item.legacy_payment_info || item.legacy_note || ''}</td>
                          <td className="p-2">
                            <div className="flex gap-1">
                            {item.legacy_status === 'active' && <>
                              <button onClick={() => { setModal({ wb_id: item.wb_id, action: 'paid_external' }); setModalPayInfo(''); setModalNote(''); }} className="px-1.5 py-1 bg-green-700 rounded text-xs" title="Оплачено">💰</button>
                              <button onClick={() => updateLegacy(item.wb_id, 'unpaid')} className="px-1.5 py-1 bg-red-700 rounded text-xs" title="Не оплачено">🔴</button>
                              <button onClick={() => { setModal({ wb_id: item.wb_id, action: 'disputed' }); setModalPayInfo(''); setModalNote(''); }} className="px-1.5 py-1 bg-yellow-700 rounded text-xs" title="Спорный">❓</button>
                              <button onClick={() => updateLegacy(item.wb_id, 'closed')} className="px-1.5 py-1 bg-slate-600 rounded text-xs" title="Закрыть">🗑</button>
                            </>}
                            {item.legacy_status !== 'active' && <button onClick={() => updateLegacy(item.wb_id, 'active')} className="px-1.5 py-1 bg-slate-600 rounded text-xs" title="Вернуть">↩️</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {byMonth.length === 0 && <div className="text-slate-400 text-center py-8">Нет рейсов по заданным фильтрам</div>}
        </div>
      )}

      {/* PENDING TAB */}
      {tab === 'pending' && (
        <div className="overflow-x-auto">
          {pending.length === 0 ? <div className="text-slate-400 text-center py-8">Нет ДЗ на проверку</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 text-xs">
                <th className="p-2 text-left">№ ДЗ</th><th className="p-2 text-left">Перевозчик</th><th className="p-2 text-left">Маршрут</th><th className="p-2">Рейсов</th><th className="p-2">Сумма</th><th className="p-2">Штрафы</th><th className="p-2">К оплате</th><th className="p-2">Действия</th>
              </tr></thead>
              <tbody>
                {pending.map(c => (
                  <tr key={c.id} className="border-t border-slate-700">
                    <td className="p-2 text-blue-400 cursor-pointer" onClick={() => router.push(`/hired/contracts/${c.id}`)}>{c.contract_number}</td>
                    <td className="p-2">{c.carrier_name}</td>
                    <td className="p-2 text-xs">{c.route}</td>
                    <td className="p-2 text-center">{c.linked_trips}/{c.trip_count}</td>
                    <td className="p-2 text-right">{fmtMoney(c.price * Math.max(c.trip_count, 1))}</td>
                    <td className="p-2 text-right text-red-400">{c.total_penalties > 0 ? fmtMoney(c.total_penalties) : '0'}</td>
                    <td className="p-2 text-right font-bold">{fmtMoney(c.price * Math.max(c.trip_count, 1) - (c.total_penalties || 0))}</td>
                    <td className="p-2 flex gap-1">
                      <button onClick={() => acceptContract(c.id)} className="px-2 py-1 bg-green-700 rounded text-xs">✅</button>
                      <button onClick={() => rejectContract(c.id)} className="px-2 py-1 bg-red-700 rounded text-xs">❌</button>
                      <button onClick={() => router.push(`/hired/contracts/${c.id}`)} className="px-2 py-1 bg-slate-600 rounded text-xs">👁</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PAYABLE TAB */}
      {tab === 'payable' && (
        <div className="overflow-x-auto">
          {accepted.length === 0 ? <div className="text-slate-400 text-center py-8">Нет ДЗ к оплате</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 text-xs">
                <th className="p-2 text-left">№ ДЗ</th><th className="p-2 text-left">Перевозчик</th><th className="p-2">Сумма</th><th className="p-2">Штрафы</th><th className="p-2">Итого</th><th className="p-2">Действия</th>
              </tr></thead>
              <tbody>
                {accepted.map((c: any) => (
                  <tr key={c.id} className="border-t border-slate-700">
                    <td className="p-2 text-blue-400">{c.contract_number}</td>
                    <td className="p-2">{c.carrier_name}</td>
                    <td className="p-2 text-right">{fmtMoney(c.price * Math.max(c.trip_count || 1, 1))}</td>
                    <td className="p-2 text-right text-red-400">{fmtMoney(c.total_penalties || 0)}</td>
                    <td className="p-2 text-right font-bold">{fmtMoney(c.price * Math.max(c.trip_count || 1, 1) - (c.total_penalties || 0))}</td>
                    <td className="p-2"><button onClick={() => markPaid(c.id)} className="px-2 py-1 bg-green-700 rounded text-xs">💰 Оплатить</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PAID TAB */}
      {tab === 'paid' && (
        <div className="overflow-x-auto">
          {paid.length === 0 ? <div className="text-slate-400 text-center py-8">Нет оплаченных ДЗ</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 text-xs">
                <th className="p-2 text-left">№ ДЗ</th><th className="p-2">Дата оплаты</th><th className="p-2 text-left">Перевозчик</th><th className="p-2">Сумма</th><th className="p-2">№ п/п</th>
              </tr></thead>
              <tbody>
                {paid.map((c: any) => (
                  <tr key={c.id} className="border-t border-slate-700">
                    <td className="p-2 text-blue-400">{c.contract_number}</td>
                    <td className="p-2 text-center">{fmtDate(c.paid_at)}</td>
                    <td className="p-2">{c.carrier_name}</td>
                    <td className="p-2 text-right">{fmtMoney(c.price * Math.max(c.trip_count || 1, 1))}</td>
                    <td className="p-2 text-center">{c.payment_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PENALTIES TAB */}
      {tab === 'penalties' && <PenaltiesTab hdr={hdr} />}

      {/* Modal for legacy payment / dispute */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{modal.action === 'paid_external' ? '💰 Отметить как оплаченное' : '❓ Спорный рейс'}</h3>
            <p className="text-sm text-slate-400 mb-3">Рейс #{modal.wb_id}</p>
            {modal.action === 'paid_external' && <input placeholder="Акт / документ / № п/п" value={modalPayInfo} onChange={e => setModalPayInfo(e.target.value)} className="w-full bg-slate-700 text-white px-3 py-2 rounded mb-3 text-sm" />}
            <input placeholder="Комментарий" value={modalNote} onChange={e => setModalNote(e.target.value)} className="w-full bg-slate-700 text-white px-3 py-2 rounded mb-4 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 bg-slate-600 rounded text-sm">Отмена</button>
              <button onClick={() => { updateLegacy(modal.wb_id, modal.action, modalPayInfo, modalNote); setModal(null); }} className="px-4 py-2 bg-green-600 rounded text-sm">✅ Подтвердить</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Modal */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setBulkModal(null)}>
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{bulkModal === 'paid_external' ? '💰 Массовая оплата' : '🗑 Массовое закрытие'}</h3>
            <p className="text-sm text-slate-400 mb-3">Рейсов: {selected.size}</p>
            <input placeholder="Комментарий" value={modalPayInfo} onChange={e => setModalPayInfo(e.target.value)} className="w-full bg-slate-700 text-white px-3 py-2 rounded mb-4 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBulkModal(null)} className="px-4 py-2 bg-slate-600 rounded text-sm">Отмена</button>
              <button onClick={() => bulkUpdate(bulkModal, modalPayInfo)} className="px-4 py-2 bg-green-600 rounded text-sm">✅ Применить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
