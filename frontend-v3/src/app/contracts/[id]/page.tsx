"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Upload, Send, CheckCircle, XCircle, Clock, AlertTriangle, Download, Edit2, Truck, User, MapPin, DollarSign, Calendar } from "lucide-react";

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Черновик', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: Edit2 },
  sent: { label: 'Отправлена', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Send },
  signed: { label: 'Подписана', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  in_progress: { label: 'В работе', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Truck },
  disputed: { label: 'Спор', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: AlertTriangle },
  active: { label: 'Активен', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  completed: { label: 'Завершён', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', icon: CheckCircle },
  cancelled: { label: 'Отменён', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
};

const statusActions: Record<string, { label: string; next: string; color: string; icon: any }[]> = {
  draft: [
    { label: '📧 Отправить перевозчику', next: 'sent', color: 'bg-yellow-600 hover:bg-yellow-500', icon: Send },
    { label: '❌ Отменить', next: 'cancelled', color: 'bg-red-600/50 hover:bg-red-600', icon: XCircle },
  ],
  sent: [
    { label: '✅ Подписана (загрузить скан)', next: 'signed', color: 'bg-emerald-600 hover:bg-emerald-500', icon: CheckCircle },
    { label: '❌ Отменить', next: 'cancelled', color: 'bg-red-600/50 hover:bg-red-600', icon: XCircle },
  ],
  signed: [
    { label: '🚛 В работу', next: 'in_progress', color: 'bg-blue-600 hover:bg-blue-500', icon: Truck },
  ],
  in_progress: [
    { label: '✅ Завершить', next: 'completed', color: 'bg-indigo-600 hover:bg-indigo-500', icon: CheckCircle },
  ],
  disputed: [
    { label: '🔄 Вернуть в работу', next: 'in_progress', color: 'bg-blue-600 hover:bg-blue-500', icon: Truck },
    { label: '✅ Завершить', next: 'completed', color: 'bg-indigo-600 hover:bg-indigo-500', icon: CheckCircle },
  ],
};

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtPrice = (n: any) => n ? Number(n).toLocaleString('ru-RU') + ' ₽' : '—';

function headers() { return { 'x-user-role': typeof window !== 'undefined' ? localStorage.getItem('userRole') || 'director' : 'director' }; }

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [contract, setContract] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      let r = await fetch(`/api/contracts/${id}`, { headers: headers() });
      let data = await r.json();
      if (!r.ok || data.error) {
        // Fallback to hired contracts API (HDZ-... IDs)
        r = await fetch(`/api/hired/contracts/${id}`, { headers: headers() });
        data = await r.json();
      }
      const c = data.contract || data;
      // Normalize field names between old and new API
      if (c.route && !c.route_name) c.route_name = c.route;
      setContract(c);
      // Load linked trips
      try {
        const trUrl = id.startsWith('HDZ-') ? `/api/hired/contracts/${id}/trips` : `/api/contracts/${id}/trips`;
        const tr = await fetch(trUrl, { headers: headers() });
        if (tr.ok) setTrips(await tr.json());
      } catch {}
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (newStatus: string) => {
    if (!confirm(`Сменить статус на «${statusMap[newStatus]?.label || newStatus}»?`)) return;
    setActionLoading(newStatus);
    try {
      const statusUrl = contract?.id?.startsWith('HDZ-') ? `/api/hired/contracts/${id}/status` : `/api/contracts/${id}/status`;
      const r = await fetch(statusUrl, {
        method: 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const d = await r.json();
      if (d.ok || d.contract) {
        setContract(d.contract || { ...contract, status: newStatus });
      } else {
        alert(d.error || 'Ошибка');
      }
    } catch (e) { alert('Ошибка сети'); }
    setActionLoading('');
  };

  const uploadScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionLoading('upload');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const uploadUrl = contract?.id?.startsWith('HDZ-') ? `/api/hired/contracts/${id}/upload-scan` : `/api/contracts/${id}/upload-scan`;
      const r = await fetch(uploadUrl, {
        method: 'POST', headers: headers(), body: fd
      });
      const d = await r.json();
      if (d.ok) {
        await load();
        setUploadOpen(false);
      } else alert(d.error || 'Ошибка загрузки');
    } catch { alert('Ошибка сети'); }
    setActionLoading('');
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!contract) return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="text-red-400">Договор не найден</div>
      <Link href="/contracts" className="text-blue-400 hover:underline mt-4 block">← Назад</Link>
    </div>
  );

  const s = statusMap[contract.status] || statusMap.draft;
  const StatusIcon = s.icon;
  const actions = statusActions[contract.status] || [];
  const transitMinutes = contract.transit_time_minutes || 0;
  const transitHours = transitMinutes > 0 ? (transitMinutes / 60).toFixed(1) : '—';
  const totalPrice = (Number(contract.price) || 0) * (Number(contract.trip_count) || 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-4 mb-3">
          <Link href="/contracts" className="text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">{contract.contract_number || 'ДЗ'}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${s.color} flex items-center gap-1.5`}>
            <StatusIcon className="w-4 h-4" />
            {s.label}
          </span>
        </div>
        <div className="text-sm text-slate-400 flex flex-wrap gap-4">
          <span>📅 {fmtDate(contract.contract_date || contract.created_at)}</span>
          {contract.carrier_name && <span>🏢 {contract.carrier_name}</span>}
          {contract.carrier_inn && <span>ИНН {contract.carrier_inn}</span>}
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Action buttons */}
        {actions.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-sm text-slate-400 mb-3">Действия:</div>
            <div className="flex flex-wrap gap-3">
              {actions.map(a => (
                <button key={a.next} onClick={() => a.next === 'signed' ? setUploadOpen(true) : changeStatus(a.next)}
                  disabled={!!actionLoading}
                  className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition ${a.color} disabled:opacity-50`}>
                  {actionLoading === a.next ? '...' : a.label}
                </button>
              ))}
              <a href={`/api/contracts/${id}/pdf`} target="_blank" rel="noopener"
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition flex items-center gap-1.5">
                <Download className="w-4 h-4" /> Скачать PDF
              </a>
              <Link href={`/contracts/create?edit=${id}`}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition flex items-center gap-1.5">
                <Edit2 className="w-4 h-4" /> Редактировать
              </Link>
            </div>
          </div>
        )}

        {/* Upload scan modal */}
        {uploadOpen && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="text-amber-400 font-medium mb-2">📎 Загрузить подписанный скан</div>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadScan}
              className="text-sm text-slate-300" disabled={actionLoading === 'upload'} />
            <button onClick={() => setUploadOpen(false)} className="ml-4 text-sm text-slate-400 hover:text-white">Отмена</button>
            {actionLoading === 'upload' && <span className="ml-2 text-sm text-slate-400">Загрузка...</span>}
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Route & Transport */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-400" /> Маршрут и транспорт</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Маршрут</span><span className="text-white font-medium">{contract.route_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Расстояние</span><span>{contract.route_km ? `${contract.route_km} км` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Транзитное время</span><span>{transitHours} ч</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Дата подачи</span><span>{fmtDateTime(contract.loading_date)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Адрес погрузки</span><span>{contract.loading_address || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Адрес выгрузки</span><span>{contract.unloading_address || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Груз</span><span>{contract.cargo_description || '—'}</span></div>
            </div>
          </div>

          {/* Vehicle & Driver */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2"><Truck className="w-4 h-4 text-emerald-400" /> Транспорт и водитель</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Госномер</span><span className="text-white font-mono font-medium">{contract.vehicle_plate || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Марка</span><span>{contract.vehicle_brand || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Прицеп</span><span>{contract.trailer_plate || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Водитель</span><span className="text-white font-medium">{contract.driver_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Телефон</span><span>{contract.driver_phone || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">ВУ</span><span>{contract.driver_license || '—'}</span></div>
            </div>
          </div>
        </div>

        {/* Finance */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-3"><DollarSign className="w-4 h-4 text-yellow-400" /> Финансы</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Ставка</div>
              <div className="text-lg font-bold text-white">{fmtPrice(contract.price)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Перевозок</div>
              <div className="text-lg font-bold text-white">{contract.trip_count || 1}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Итого</div>
              <div className="text-lg font-bold text-emerald-400">{fmtPrice(totalPrice)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">НДС</div>
              <div className="text-lg font-bold text-white">{contract.vat_type === 'vat_included' ? 'Включён' : contract.vat_type === 'no_vat' ? 'Без НДС' : '—'}</div>
            </div>
          </div>
        </div>

        {/* Carrier */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-3"><User className="w-4 h-4 text-purple-400" /> Перевозчик</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Название</span><span className="text-white">{contract.carrier_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">ИНН</span><span>{contract.carrier_inn || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">КПП</span><span>{contract.carrier_kpp || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Контакт</span><span>{contract.carrier_contact_person || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Телефон</span><span>{contract.carrier_phone || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Email</span><span>{contract.carrier_email || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Адрес</span><span>{contract.carrier_address || '—'}</span></div>
          </div>
        </div>

        {/* Linked trips */}
        {trips.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-cyan-400" /> Привязанные рейсы ({trips.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left py-2 px-3">#</th>
                    <th className="text-left py-2 px-3">Путевой</th>
                    <th className="text-left py-2 px-3">Маршрут</th>
                    <th className="text-left py-2 px-3">Выезд</th>
                    <th className="text-left py-2 px-3">Прибытие</th>
                    <th className="text-right py-2 px-3">Цена WB</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t: any, i: number) => (
                    <tr key={t.id || i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-2 px-3">{i + 1}</td>
                      <td className="py-2 px-3 font-mono">{t.wb_id || '—'}</td>
                      <td className="py-2 px-3">{t.route_name || '—'}</td>
                      <td className="py-2 px-3">{fmtDateTime(t.open_dt)}</td>
                      <td className="py-2 px-3">{fmtDateTime(t.close_dt)}</td>
                      <td className="py-2 px-3 text-right">{fmtPrice(t.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-slate-400" /> История</h2>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-slate-500 shrink-0" />
              <div><span className="text-slate-400">{fmtDateTime(contract.created_at)}</span> — ДЗ создана {contract.created_by ? `(${contract.created_by})` : ''}</div>
            </div>
            {contract.sent_at && <div className="flex gap-3 items-start">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-yellow-500 shrink-0" />
              <div><span className="text-slate-400">{fmtDateTime(contract.sent_at)}</span> — Отправлена перевозчику</div>
            </div>}
            {contract.signed_at && <div className="flex gap-3 items-start">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0" />
              <div><span className="text-slate-400">{fmtDateTime(contract.signed_at)}</span> — Подписана {contract.signed_by ? `(${contract.signed_by})` : ''}</div>
            </div>}
            {contract.completed_at && <div className="flex gap-3 items-start">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-500 shrink-0" />
              <div><span className="text-slate-400">{fmtDateTime(contract.completed_at)}</span> — Завершена</div>
            </div>}
          </div>
        </div>

        {/* Signed scan */}
        {contract.signed_scan_path && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-medium">Подписанный скан загружен</span>
            <a href={`/api/contracts/${id}/signed-scan`} target="_blank" className="text-blue-400 hover:underline text-sm ml-auto">Скачать</a>
          </div>
        )}
      </div>
    </div>
  );
}
