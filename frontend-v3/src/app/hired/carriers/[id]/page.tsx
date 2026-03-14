"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ArrowLeft, Edit2, Save, X, Plus, Trash2, Truck, Phone, Mail, Building2, CreditCard, FileText, Search, CheckCircle, AlertTriangle, XCircle, ExternalLink } from "lucide-react";

function hdr(role: string) {
  return { 'x-user-role': role, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
}

interface Carrier {
  id: string; name: string; inn: string; kpp: string; ogrn: string; type: string;
  contact_person: string; contact_position: string; phone: string; email: string;
  legal_address: string; bank_name: string; bank_account: string;
  bank_bik: string; bank_corr_account: string; notes: string; status: string;
  score: number; ati_id: string; default_price: number; is_active: boolean;
  created_at: string; updated_at: string;
}

interface Vehicle {
  id: number; carrier_id: string; vehicle_plate: string;
  vehicle_model: string; driver_name: string; driver_phone: string;
  dz_count?: number; last_dz?: any;
}

interface Contract {
  id: string; contract_number: string; date: string; route: string;
  vehicle_plate: string; price: number; status: string;
  loading_date: string; unloading_date: string;
}

interface ReadinessCheck { field: string; label: string; ok: boolean; }

export default function CarrierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const carrierId = params?.id as string;
  const headers = hdr(role || 'director');

  const [carrier, setCarrier] = useState<Carrier | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [readiness, setReadiness] = useState<{ checks: ReadinessCheck[]; filled: number; total: number; ready: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Carrier>>({});
  const [saving, setSaving] = useState(false);

  // Add vehicle
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ vehicle_plate: '', vehicle_model: '', driver_name: '', driver_phone: '' });

  // INN lookup
  const [innLoading, setInnLoading] = useState(false);
  const [innResult, setInnResult] = useState<any>(null);

  const fmt = (n: any) => n ? Number(n).toLocaleString('ru-RU') : '—';
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';
  const statusMap: Record<string, string> = {
    draft: 'Черновик', sent: 'Отправлена', signed: 'Подписана', active: 'В работе',
    completed: 'Завершена', cancelled: 'Отменена', rejected: 'Отклонена',
    in_transit: 'В пути', pending: 'Ожидает', accepted: 'Принята',
  };
  const statusLabel = (s: string) => statusMap[s] || s;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Main carrier load - required
      const cRes = await fetch(`/api/hired/carriers/${carrierId}`, { headers });
      if (!cRes.ok) throw new Error('Carrier not found');
      const cData = await cRes.json();
      const carrierObj = cData.carrier || cData;
      setCarrier(carrierObj);
      // Use embedded data from main endpoint if available
      if (cData.vehicles) setVehicles(cData.vehicles);
      if (cData.contracts) setContracts(cData.contracts);
      if (cData.trips) setTrips(cData.trips);
      if (cData.stats) setStats(cData.stats);
      // Optional: load enriched data (safe - don't crash on 404)
      try {
        const finRes = await fetch(`/api/hired/carriers/${carrierId}/finance`, { headers });
        if (finRes.ok) setFinance(await finRes.json());
      } catch {}
      try {
        const vRes = await fetch(`/api/hired/carriers/${carrierId}/vehicles`, { headers });
        if (vRes.ok) { const vd = await vRes.json(); if (Array.isArray(vd) && vd.length) setVehicles(vd); }
      } catch {}
      try {
        const dRes = await fetch(`/api/hired/carriers/${carrierId}/contracts`, { headers });
        if (dRes.ok) { const dd = await dRes.json(); if (Array.isArray(dd)) setContracts(dd); }
      } catch {}
      try {
        const rRes = await fetch(`/api/hired/carriers/${carrierId}/readiness`, { headers });
        if (rRes.ok) setReadiness(await rRes.json());
      } catch {}
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [carrierId]);

  useEffect(() => { loadData(); }, [loadData]);

  const startEdit = () => {
    if (!carrier) return;
    setEditData({ ...carrier });
    setEditMode(true);
  };

  const cancelEdit = () => { setEditMode(false); setEditData({}); };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/hired/carriers/${carrierId}`, {
        method: 'PATCH', headers, body: JSON.stringify(editData)
      });
      const data = await res.json();
      setCarrier(data.carrier || data);
      setEditMode(false);
      loadData();
    } catch (e: any) { alert('Ошибка: ' + e.message); }
    finally { setSaving(false); }
  };

  const addVehicle = async () => {
    if (!newPlate.trim()) return;
    try {
      const res = await fetch(`/api/hired/carriers/${id}/vehicles`, {
        method: 'POST',
        headers: { ...hdr(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_plate: newPlate.trim(), trailer: newTrailer.trim() || null })
      });
      if (res.ok) {
        setNewPlate(''); setNewTrailer(''); setShowAddVehicle(false);
        // Refresh vehicles
        const vRes = await fetch(`/api/hired/carriers/${id}/vehicles`, { headers: hdr() });
        if (vRes.ok) { const d = await vRes.json(); setVehicles(Array.isArray(d) ? d : d.vehicles || []); }
      }
    } catch(e) { console.error(e); }
  };
  const removeVehicle = async (vid: number) => {
    if (!confirm('Отвязать машину?')) return;
    await fetch(`/api/hired/carriers/${carrierId}/vehicles/${vid}`, { method: 'DELETE', headers });
    loadData();
  };

  const lookupINN = async () => {
    const inn = editMode ? editData.inn : carrier?.inn;
    if (!inn || inn.length < 10) { alert('Введите ИНН (10-12 цифр)'); return; }
    setInnLoading(true);
    try {
      // Try DaData-like service or our backend
      const res = await fetch(`/api/hired/carriers/inn-lookup/${inn}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setInnResult(data);
      } else {
        alert('Не удалось найти по ИНН');
      }
    } catch { alert('Ошибка поиска по ИНН'); }
    finally { setInnLoading(false); }
  };

  const applyInnData = () => {
    if (!innResult) return;
    setEditData(prev => ({
      ...prev,
      name: innResult.name || prev.name,
      inn: innResult.inn || prev.inn,
      kpp: innResult.kpp || prev.kpp,
      ogrn: innResult.ogrn || prev.ogrn,
      legal_address: innResult.address || prev.legal_address,
    }));
    setInnResult(null);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"/></div>;
  if (error) return <div className="p-8 text-red-400">Ошибка: {error}</div>;
  if (!carrier) return <div className="p-8 text-slate-400">Перевозчик не найден</div>;

  const c = carrier;
  const editField = (key: keyof Carrier, label: string, type = 'text') => (
    <div key={key} className="flex items-center gap-2 py-1">
      <span className="text-xs text-slate-400 w-36 shrink-0">{label}</span>
      {editMode ? (
        <input type={type} value={(editData as any)[key] || ''} onChange={e => setEditData(p => ({...p, [key]: e.target.value}))}
          className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white" />
      ) : (
        <span className="text-sm text-white">{(c as any)[key] || <span className="text-slate-500">—</span>}</span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-700 rounded"><ArrowLeft size={20}/></button>
        <div className="flex-1">
          {editMode ? (
            <input value={edits.name ?? c.name ?? ''} onChange={e => setEdits({...edits, name: e.target.value})}
              className="text-xl font-bold bg-slate-700 border border-slate-500 rounded px-2 py-1 w-full" placeholder="Название перевозчика"/>
          ) : (
            <h1 className="text-xl font-bold">{c.name || 'Без названия'}</h1>
          )}
          <div className="flex gap-3 text-xs text-slate-400 mt-1">
            {c.inn && <span>ИНН {c.inn}</span>}
            {c.phone && <span>📞 {c.phone}</span>}
            {c.contact_person && <span>👤 {c.contact_person}</span>}
            <span className={`px-2 py-0.5 rounded ${c.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
              {c.status === 'active' ? 'Активен' : c.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <button onClick={startEdit} className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm"><Edit2 size={14}/> Редактировать</button>
              <a href="/hired/contracts/create" className="flex items-center gap-1 px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm"><FileText size={14}/> Создать ДЗ</a>
              <button onClick={() => setShowAddVehicle(true)} className="flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"><Plus size={14}/> Добавить машину</button>
            </>
          ) : (
            <>
              <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm disabled:opacity-50"><Save size={14}/> {saving ? 'Сохраняю...' : 'Сохранить'}</button>
              <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm"><X size={14}/> Отмена</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Block 1: Contacts */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2"><Phone size={16}/> Контакты</h2>
          {editField('contact_person', 'Контактное лицо')}
          {editField('contact_position', 'Должность')}
          {editField('phone', 'Телефон', 'tel')}
          {editField('email', 'Email', 'email')}
          {editField('notes', 'Комментарий')}
        </div>

        {/* Block 2: Legal */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2"><Building2 size={16}/> Юридические реквизиты</h2>
          {editField('inn', 'ИНН')}
          {editMode && (
            <div className="flex gap-2 mb-2 ml-36">
              <button onClick={lookupINN} disabled={innLoading} className="text-xs px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded disabled:opacity-50">
                <Search size={12} className="inline mr-1"/>{innLoading ? 'Ищу...' : 'Найти по ИНН'}
              </button>
            </div>
          )}
          {innResult && (
            <div className="ml-36 mb-3 p-2 bg-slate-700 rounded text-xs">
              <div className="font-medium text-blue-300 mb-1">Найдено:</div>
              <div>{innResult.name}</div>
              {innResult.kpp && <div>КПП: {innResult.kpp}</div>}
              {innResult.ogrn && <div>ОГРН: {innResult.ogrn}</div>}
              {innResult.address && <div>Адрес: {innResult.address}</div>}
              <button onClick={applyInnData} className="mt-2 px-2 py-1 bg-green-700 rounded text-white">Заполнить</button>
              <button onClick={() => setInnResult(null)} className="mt-2 ml-2 px-2 py-1 bg-slate-600 rounded">Отмена</button>
            </div>
          )}
          {editField('kpp', 'КПП')}
          {editField('ogrn', 'ОГРН / ОГРНИП')}
          {editField('legal_address', 'Юр. адрес')}
          {editField('type', 'Тип (ip/ooo)')}
        </div>

        {/* Block 3: Bank */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2"><CreditCard size={16}/> Банковские реквизиты</h2>
          {editField('bank_name', 'Банк')}
          {editField('bank_account', 'Расчётный счёт')}
          {editField('bank_bik', 'БИК')}
          {editField('bank_corr_account', 'Корр. счёт')}
        </div>

        {/* Block 6: Readiness */}
        {readiness && (
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">📋 Готовность карточки ({readiness.filled}/{readiness.total})</h2>
            <div className="space-y-1">
              {readiness.checks.map(ch => (
                <div key={ch.field} className="flex items-center gap-2 text-sm">
                  {ch.ok ? <CheckCircle size={14} className="text-green-400"/> : <AlertTriangle size={14} className="text-yellow-400"/>}
                  <span className={ch.ok ? 'text-slate-300' : 'text-yellow-300'}>{ch.label}</span>
                </div>
              ))}
            </div>
            {!readiness.ready && <div className="mt-3 text-xs text-yellow-400 bg-yellow-900/30 rounded p-2">⚠️ Карточка неполная — заполните недостающие данные</div>}
          </div>
        )}
      </div>

      {/* Block 4: Vehicles */}
      <div className="bg-slate-800 rounded-lg p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2"><Truck size={16}/> Машины перевозчика ({vehicles.length})</h2>
          <button onClick={() => setShowAddVehicle(true)} className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"><Plus size={12} className="inline mr-1"/>Добавить</button>
        </div>
        {showAddVehicle && (
          <div className="bg-slate-700 rounded p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <input placeholder="Госномер *" value={newVehicle.vehicle_plate} onChange={e => setNewVehicle(p => ({...p, vehicle_plate: e.target.value}))}
              className="bg-slate-600 rounded px-2 py-1 text-sm"/>
            <input placeholder="Модель" value={newVehicle.vehicle_model} onChange={e => setNewVehicle(p => ({...p, vehicle_model: e.target.value}))}
              className="bg-slate-600 rounded px-2 py-1 text-sm"/>
            <input placeholder="Водитель" value={newVehicle.driver_name} onChange={e => setNewVehicle(p => ({...p, driver_name: e.target.value}))}
              className="bg-slate-600 rounded px-2 py-1 text-sm"/>
            <div className="flex gap-1">
              <input placeholder="Тел. водителя" value={newVehicle.driver_phone} onChange={e => setNewVehicle(p => ({...p, driver_phone: e.target.value}))}
                className="bg-slate-600 rounded px-2 py-1 text-sm flex-1"/>
              <input value={newTrailer} onChange={e=>setNewTrailer(e.target.value)} placeholder="Прицеп" className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm flex-1"/>
                <button onClick={addVehicle} className="px-2 py-1 bg-green-700 rounded text-xs">✓</button>
              <button onClick={() => setShowAddVehicle(false)} className="px-2 py-1 bg-slate-600 rounded text-xs">✕</button>
            </div>
          </div>
        )}
        {vehicles.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">Нет привязанных машин</div>
        ) : (
          <div className="space-y-2">
            {vehicles.map(v => (
              <div key={v.id} className="bg-slate-700/50 rounded p-3 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-mono text-sm font-bold">{v.vehicle_plate}</div>
                  <div className="text-xs text-slate-400">
                    {v.vehicle_model && <span>{v.vehicle_model} · </span>}
                    {v.driver_name && <span>🚗 {v.driver_name} </span>}
                    {v.driver_phone && <span>📞 {v.driver_phone}</span>}
                  </div>
                </div>
                {v.dz_count !== undefined && (
                  <div className="text-xs text-slate-400">{v.dz_count} ДЗ</div>
                )}
                {v.last_dz && (
                  <div className="text-xs text-slate-400">
                    Последняя: {v.last_dz.number || v.last_dz.route?.slice(0,30)}
                  </div>
                )}
                <button onClick={() => removeVehicle(v.id)} className="p-1 hover:bg-red-900 rounded text-red-400"><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Block 4.4: Finance Summary */}
      {finance && finance.summary && (
        <div className="bg-slate-800 rounded-lg p-4 mt-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">💰 Финансы</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-700/50 rounded p-3 text-center">
              <div className="text-xl font-bold text-white">{finance.summary.total_trips}</div>
              <div className="text-xs text-slate-400">Рейсов всего</div>
              <div className="text-[10px] text-green-400">{finance.summary.confirmed_trips} подтв.</div>
            </div>
            <div className="bg-slate-700/50 rounded p-3 text-center">
              <div className="text-xl font-bold text-blue-400">{Math.round(finance.summary.total_wb).toLocaleString()} ₽</div>
              <div className="text-xs text-slate-400">Сумма WB</div>
            </div>
            <div className="bg-slate-700/50 rounded p-3 text-center">
              <div className="text-xl font-bold text-emerald-400">{Math.round(finance.summary.total_our).toLocaleString()} ₽</div>
              <div className="text-xs text-slate-400">Наша цена</div>
            </div>
            <div className="bg-slate-700/50 rounded p-3 text-center">
              <div className="text-xl font-bold text-yellow-400">{Math.round(finance.summary.avg_rate).toLocaleString()} ₽</div>
              <div className="text-xs text-slate-400">Средн. ставка</div>
            </div>
            <div className="bg-slate-700/50 rounded p-3 text-center">
              <div className="text-xl font-bold text-red-400">{finance.summary.total_penalties} ({Math.round(finance.summary.total_penalty_amount).toLocaleString()} ₽)</div>
              <div className="text-xs text-slate-400">Штрафов</div>
            </div>
            <div className="bg-slate-700/50 rounded p-3 text-center">
              <div className={`text-xl font-bold ${finance.summary.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Math.round(finance.summary.net).toLocaleString()} ₽</div>
              <div className="text-xs text-slate-400">К расчёту (net)</div>
            </div>
          </div>
          
          {/* Timeline */}
          {finance.timeline && finance.timeline.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">📋 История операций</h3>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {finance.timeline.map((op: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-slate-700/30">
                    <span className={`w-16 text-center px-1 py-0.5 rounded text-[10px] ${
                      op.type === 'trip' ? 'bg-blue-900/50 text-blue-300' :
                      op.type === 'penalty' ? 'bg-red-900/50 text-red-300' :
                      'bg-green-900/50 text-green-300'
                    }`}>{op.type === 'trip' ? 'Рейс' : op.type === 'penalty' ? 'Штраф' : 'Расчёт'}</span>
                    <span className="text-slate-500 w-20">{op.date ? new Date(op.date).toLocaleDateString('ru-RU') : '—'}</span>
                    <span className="text-slate-300 flex-1 truncate">{(op.description || '').slice(0, 50)}</span>
                    <span className={`font-mono ${Number(op.amount) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {Number(op.amount) >= 0 ? '+' : ''}{Math.round(Number(op.amount || 0)).toLocaleString()} ₽
                    </span>
                    <span className={`text-[10px] px-1 rounded ${
                      op.status === 'confirmed' ? 'bg-green-900/30 text-green-400' :
                      op.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>{op.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Block 4.5: Stats Summary */}
      {stats && stats.trip_count > 0 && (
        <div className="bg-slate-800 rounded-lg p-4 mt-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">📊 Статистика перевозчика</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-700/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.trip_count}</div>
              <div className="text-xs text-slate-400">Рейсов</div>
            </div>
            <div className="bg-slate-700/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{Math.round(stats.total_our || stats.total_wb || 0).toLocaleString()} ₽</div>
              <div className="text-xs text-slate-400">Выручка</div>
            </div>
            <div className="bg-slate-700/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats.fine_count}</div>
              <div className="text-xs text-slate-400">Штрафов</div>
            </div>
            <div className="bg-slate-700/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.on_time_pct}%</div>
              <div className="text-xs text-slate-400">Вовремя</div>
            </div>
          </div>
        </div>
      )}

      {/* Block 4.6: Recent Trips */}
      {trips.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4 mt-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">🚛 Последние рейсы ({trips.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 px-2">Дата</th>
                <th className="text-left py-2 px-2">Маршрут</th>
                <th className="text-left py-2 px-2">Машина</th>
                <th className="text-right py-2 px-2">WB цена</th>
                <th className="text-right py-2 px-2">Наша цена</th>
                <th className="text-center py-2 px-2">Штраф</th>
              </tr></thead>
              <tbody>
                {trips.slice(0, 20).map((t: any) => (
                  <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-1.5 px-2 text-xs">{(t.open_dt || '').slice(0, 10)}</td>
                    <td className="py-1.5 px-2 text-xs max-w-48 truncate">{t.route_name}</td>
                    <td className="py-1.5 px-2 font-mono text-xs">{t.vehicle_plate}</td>
                    <td className="py-1.5 px-2 text-right text-xs">{t.total_price ? Number(t.total_price).toLocaleString() : '—'}</td>
                    <td className="py-1.5 px-2 text-right text-xs text-emerald-400">{t.our_price ? Number(t.our_price).toLocaleString() : '—'}</td>
                    <td className="py-1.5 px-2 text-center">{t.is_fine ? <span className="text-red-400 text-xs">⚠️ {Number(t.fine_sum || 0).toLocaleString()}</span> : <span className="text-green-400 text-xs">✓</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trips.length > 20 && <div className="text-xs text-slate-500 mt-2 text-center">...и ещё {trips.length - 20} рейсов</div>}
          </div>
        </div>
      )}

      {/* Block 5: Recent Contracts/DZ */}
      <div className="bg-slate-800 rounded-lg p-4 mt-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2"><FileText size={16}/> Последние договор-заявки ({contracts.length})</h2>
        {contracts.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">Нет договор-заявок</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 px-2">Номер</th>
                <th className="text-left py-2 px-2">Дата</th>
                <th className="text-left py-2 px-2">Маршрут</th>
                <th className="text-left py-2 px-2">Машина</th>
                <th className="text-right py-2 px-2">Ставка</th>
                <th className="text-left py-2 px-2">Статус</th>
              </tr></thead>
              <tbody>
                {contracts.map(d => (
                  <tr key={d.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer"
                    onClick={() => router.push(`/hired/contracts/${d.id}`)}>
                    <td className="py-2 px-2 text-blue-400">{d.contract_number || '—'}</td>
                    <td className="py-2 px-2">{fmtDate(d.date || d.loading_date || d.created_at)}</td>
                    <td className="py-2 px-2 text-xs max-w-48 truncate">{d.route || '—'}</td>
                    <td className="py-2 px-2 font-mono text-xs">{d.vehicle_plate || '—'}</td>
                    <td className="py-2 px-2 text-right">{fmt(d.price)} ₽</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        d.status === 'completed' ? 'bg-green-900 text-green-300' :
                        d.status === 'active' ? 'bg-blue-900 text-blue-300' :
                        'bg-slate-700 text-slate-300'
                      }`}>{statusLabel(d.status || 'draft')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
