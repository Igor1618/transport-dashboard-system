"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Download, Upload, FileText, Phone, Mail, MessageCircle, MapPin, Truck, AlertTriangle, Check, Clock, X } from "lucide-react";
import dynamic from "next/dynamic";

const YandexMap = dynamic(() => import("@/components/YandexMap"), { ssr: false });

const hdr = () => ({ 'x-user-role': typeof window !== 'undefined' ? localStorage.getItem('userRole') || 'director' : 'director', 'Cache-Control': 'no-cache' } as any);
const isWbHidden = () => typeof window !== 'undefined' && localStorage.getItem('userRole') === 'logist';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '📝 Черновик', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  sent: { label: '📧 Отправлена', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  signed: { label: '✍️ Подписана', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  in_progress: { label: '🚛 В работе', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  completed: { label: '✅ Завершена', color: 'text-green-400', bg: 'bg-green-500/20' },
  cancelled: { label: '❌ Отменена', color: 'text-red-400', bg: 'bg-red-500/20' },
  accepted: { label: '💰 Принята', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  rejected: { label: '❌ Отклонена', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  paid: { label: '🏦 Оплачена', color: 'text-teal-400', bg: 'bg-teal-500/20' },
};

const fmt = (n: any) => n ? Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0';
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';


function TripLinker({ contractId, hdr }: { contractId: string; hdr: () => any }) {
  const [mode, setMode] = useState<'candidates'|'all'>('candidates');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [linkedOther, setLinkedOther] = useState<any[]>([]);
  const [context, setContext] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [linking, setLinking] = useState<number|null>(null);

  const load = async (m?: string) => {
    setLoading(true);
    const useMode = m || mode;
    try {
      const r = await fetch(`/api/hired/accounting/contracts/${contractId}/available-trips?mode=${useMode}`, { headers: hdr() });
      if (r.ok) {
        const d = await r.json();
        setCandidates(d.candidates || []);
        setLinkedOther(d.linked_other || []);
        setContext(d.contract_context || null);
      }
    } catch {}
    setLoading(false);
    setLoaded(true);
  };

  const linkTrip = async (wbId: number) => {
    setLinking(wbId);
    await fetch(`/api/hired/accounting/contracts/${contractId}/link-trips`, {
      method: 'POST', headers: { ...hdr(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_ids: [wbId] })
    });
    setLinking(null);
    load();
  };

  const unlinkTrip = async (wbId: number) => {
    if (!confirm('Отвязать рейс?')) return;
    await fetch(`/api/hired/accounting/contracts/${contractId}/unlink-trip`, {
      method: 'POST', headers: { ...hdr(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: wbId })
    });
    load();
  };

  const fmtD = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit',year:'2-digit'}) : '—';
  const fmtN = (n: any) => n ? Number(n).toLocaleString('ru-RU') : '0';

  const statusLabels: Record<string,{label:string,color:string}> = {
    linked: { label: '✅ Привязан', color: 'bg-green-500/20 text-green-400' },
    strong_match: { label: '⭐ Подходит', color: 'bg-amber-500/20 text-amber-400' },
    candidate: { label: '🔍 Кандидат', color: 'bg-blue-500/20 text-blue-400' },
    linked_other: { label: '🔗 Другая ДЗ', color: 'bg-slate-500/20 text-slate-400' },
  };

  const linked = candidates.filter(c => c.linked_to_current);
  const unlinked = candidates.filter(c => !c.linked_to_current && !c.contract_id);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-medium">📦 WB-рейсы</h3>
        <div className="flex gap-2">
          <button onClick={() => { setMode('candidates'); load('candidates'); }}
            className={`text-xs px-2 py-1 rounded ${mode === 'candidates' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
            Подходящие
          </button>
          <button onClick={() => { setMode('all'); load('all'); }}
            className={`text-xs px-2 py-1 rounded ${mode === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
            Все рейсы
          </button>
        </div>
      </div>

      {!loaded ? (
        <button onClick={() => load()} className="w-full px-4 py-6 text-center text-slate-400 hover:text-white hover:bg-slate-750 text-sm">
          🔍 Загрузить WB-рейсы для привязки
        </button>
      ) : loading ? (
        <div className="px-4 py-6 text-center text-slate-500 text-sm">Загрузка...</div>
      ) : (
        <div className="divide-y divide-slate-700/50">
          {/* Linked trips first */}
          {linked.length > 0 && (
            <div className="px-4 py-2 bg-green-900/10">
              <div className="text-xs text-green-400 font-medium mb-2">✅ Привязанные ({linked.length})</div>
              {linked.map((t: any) => (
                <div key={t.wb_id} className="flex items-center justify-between py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">#{t.wb_id} {t.route_name || ''}</div>
                    <div className="text-xs text-slate-400">
                      {t.vehicle_plate} · {fmtD(t.trip_date)} {t.close_dt ? '→ ' + fmtD(t.close_dt) : ''}
                      {t.driver_name ? ' · ' + t.driver_name : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-green-400 font-mono text-sm">{fmtN(t.total_price || t.trip_amount)} ₽</span>
                    <button onClick={() => unlinkTrip(t.wb_id)} className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Candidates */}
          {unlinked.length > 0 ? (
            <div className="px-4 py-2">
              <div className="text-xs text-slate-400 font-medium mb-2">
                {mode === 'candidates' ? '🔍 Кандидаты для привязки' : '📊 Все свободные рейсы'} ({unlinked.length})
              </div>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {unlinked.map((t: any) => {
                  const st = statusLabels[t.match_status] || statusLabels.candidate;
                  return (
                    <div key={t.wb_id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-slate-700/50 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">#{t.wb_id}</span>
                          <span className={'text-[10px] px-1.5 py-0.5 rounded ' + st.color}>{st.label}</span>
                          {t.score >= 50 && <span className="text-amber-400 text-[10px]">\u2605 {t.score}%</span>}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{t.route_name || '—'}</div>
                        <div className="text-xs text-slate-500">
                          {t.vehicle_plate} · {fmtD(t.trip_date)}
                          {t.reasons?.length > 0 && <span className="text-slate-600 ml-1">({t.reasons.join(', ')})</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-white text-sm font-mono">{fmtN(t.total_price || t.trip_amount)} ₽</div>
                        <button onClick={() => linkTrip(t.wb_id)} disabled={linking === t.wb_id}
                          className="text-xs text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50">
                          {linking === t.wb_id ? '...' : '+ Привязать'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : !linked.length ? (
            <div className="px-4 py-6 text-center text-sm">
              <div className="text-slate-500 mb-1">Подходящие WB-рейсы не найдены</div>
              <div className="text-slate-600 text-xs">Проверьте машину, маршрут или даты в ДЗ</div>
              {mode === 'candidates' && (
                <button onClick={() => { setMode('all'); load('all'); }}
                  className="mt-2 text-blue-400 text-xs hover:underline">Показать все рейсы →</button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PaymentBlock({ contract, id, hdr, setContract }: { contract: any; id: string; hdr: () => any; setContract: any }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const payStatus = contract.payment_status || 'docs_pending';
  const PAY_LABELS: Record<string,{label:string,color:string}> = {
    docs_pending: {label:'📄 Документы ожидаются', color:'text-yellow-400'},
    docs_received: {label:'📨 Документы получены', color:'text-blue-400'},
    docs_checked: {label:'✅ Комплект проверен', color:'text-purple-400'},
    queued: {label:'💳 В очереди на оплату', color:'text-amber-400'},
    paid: {label:'🏦 Оплачено', color:'text-green-400'},
  };
  const pst = PAY_LABELS[payStatus] || PAY_LABELS.docs_pending;

  const doAction = async (endpoint: string, body: any = {}) => {
    setSaving(true); setMsg('');
    try {
      const r = await fetch(`/api/contracts/${id}/payment/${endpoint}`, {
        method: 'POST', headers: { ...hdr(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (d.ok) {
        setMsg('✅ Сохранено');
        // Reload contract
        const cr = await fetch(`/api/contracts/${id}`, { headers: hdr() });
        const cd = await cr.json();
        setContract(cd.contract || cd);
      } else {
        setMsg('❌ ' + (d.error || 'Ошибка'));
      }
    } catch(e: any) { setMsg('❌ ' + e.message); }
    setSaving(false);
  };

  // Calculate days until due
  let daysUntilDue: number | null = null;
  if (contract.payment_due_date) {
    daysUntilDue = Math.ceil((new Date(contract.payment_due_date).getTime() - Date.now()) / 86400000);
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-medium">💰 Оплата</h3>
        <span className={`text-sm font-medium ${pst.color}`}>{pst.label}</span>
      </div>
      <div className="p-4 space-y-4">
        {/* Documents checklist */}
        <div>
          <div className="text-xs text-slate-400 mb-2">Документы</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              {key:'docs_invoice_received', label:'Счёт'},
              {key:'docs_upd_received', label:'УПД'},
              {key:'docs_act_received', label:'Акт'},
              {key:'docs_originals_received', label:'Оригиналы'},
            ].map(doc => (
              <label key={doc.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!contract[doc.key]}
                  disabled={payStatus === 'paid'}
                  onChange={async (e) => {
                    const body: any = {};
                    body[doc.key.replace('docs_','')] = e.target.checked;
                    // If any doc checked, mark as received
                    if (e.target.checked && payStatus === 'docs_pending') {
                      await doAction('receive-docs', body);
                    } else {
                      await fetch(`/api/contracts/${id}/payment`, {
                        method: 'PATCH', headers: { ...hdr(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({[doc.key]: e.target.checked})
                      });
                      const cr = await fetch(`/api/contracts/${id}`, { headers: hdr() });
                      const cd = await cr.json();
                      setContract(cd.contract || cd);
                    }
                  }}
                  className="rounded" />
                <span className={contract[doc.key] ? 'text-green-400' : 'text-slate-400'}>{contract[doc.key] ? '✅' : '⬜'} {doc.label}</span>
              </label>
            ))}
          </div>
          {contract.docs_received_at && (
            <div className="text-xs text-slate-500 mt-1">Получены: {fmtDateTime(contract.docs_received_at)}</div>
          )}
        </div>

        {/* Payment info */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-400">Условия оплаты</div>
            <div className="text-white">{contract.payment_terms_days || 5} банк. дней {contract.payment_by_scans ? '(по сканам)' : '(по оригиналам)'}</div>
          </div>
          {contract.payment_due_date && (
            <div>
              <div className="text-xs text-slate-400">Оплатить до</div>
              <div className={daysUntilDue !== null && daysUntilDue < 0 ? 'text-red-400 font-bold' : daysUntilDue !== null && daysUntilDue <= 2 ? 'text-yellow-400' : 'text-white'}>
                {fmtDate(contract.payment_due_date)}
                {daysUntilDue !== null && (
                  <span className="text-xs ml-1">
                    {daysUntilDue < 0 ? `(просрочено ${Math.abs(daysUntilDue)} дн)` : daysUntilDue === 0 ? '(сегодня!)' : `(через ${daysUntilDue} дн)`}
                  </span>
                )}
              </div>
            </div>
          )}
          {contract.payment_paid_at && (
            <div>
              <div className="text-xs text-slate-400">Оплачено</div>
              <div className="text-green-400">{fmtDateTime(contract.payment_paid_at)} {contract.payment_reference && `· ${contract.payment_reference}`}</div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {payStatus === 'docs_pending' && (
            <button onClick={() => doAction('receive-docs', {invoice:true, upd:true, act:true})} disabled={saving}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white disabled:opacity-50">
              📨 Документы получены (все)
            </button>
          )}
          {payStatus === 'docs_received' && (
            <button onClick={() => doAction('check-docs', {})} disabled={saving}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs text-white disabled:opacity-50">
              ✅ Комплект проверен
            </button>
          )}
          {['docs_received','docs_checked'].includes(payStatus) && (
            <button onClick={() => doAction('queue', {})} disabled={saving}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-xs text-white disabled:opacity-50">
              💳 Поставить в оплату
            </button>
          )}
          {['queued','docs_checked'].includes(payStatus) && (
            <button onClick={() => {
              const amount = prompt('Сумма оплаты:', String(contract.price || ''));
              if (!amount) return;
              const ref = prompt('Номер платежа (необязательно):');
              doAction('pay', { amount: Number(amount), reference: ref || undefined });
            }} disabled={saving}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs text-white disabled:opacity-50">
              🏦 Отметить оплаченной
            </button>
          )}
        </div>
        {msg && <div className={`text-xs ${msg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{msg}</div>}
      </div>
    </div>
  );
}

export default function HiredContractDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [contract, setContract] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [gpsData, setGpsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

  // Load contract
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/hired/contracts/${id}`, { headers: hdr() }).then(r => r.ok ? r.json() : null),
      fetch(`/api/hired/contracts/${id}/trips`, { headers: hdr() }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([cData, tData]) => {
      const c = cData?.contract || cData;
      if (!c) {
        // Fallback to old API
        fetch(`/api/contracts/${id}`, { headers: hdr() }).then(r => r.json())
          .then(d => { setContract(d.contract || d); setLoading(false); }).catch(() => setLoading(false));
        return;
      }
      setContract(c);
      setTrips(tData?.trips || tData || []);
      setLoading(false);

      // Load penalties for this contract
      fetch(`/api/hired/penalties?contract_id=${id}`, { headers: hdr() })
        .then(r => r.json()).then(d => setPenalties(Array.isArray(d) ? d : d.penalties || []))
        .catch(() => {});

      // Load history
      fetch(`/api/contracts/\${id}/history`, { headers: hdr() })
        .then(r => r.ok ? r.json() : { history: [], emails: [] })
        .then(d => {
          const items: any[] = [];
          (d.history || []).forEach((h: any) => items.push({ ...h, type: 'action' }));
          (d.emails || []).forEach((e: any) => items.push({ ...e, type: 'email', created_at: e.sent_at }));
          items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setHistory(items);
        })
        .catch(() => {});

      // Load GPS data if vehicle is in active status
      if (c.vehicle_plate && ['signed', 'in_progress'].includes(c.status)) {
        fetch(`/api/dispatch-wp/gps`, { headers: hdr() })
          .then(r => r.json()).then(vehicles => {
            if (Array.isArray(vehicles)) {
              const v = vehicles.find((v: any) => v.vehicle === c.vehicle_plate || v.vehicle?.replace(/\s/g, '') === c.vehicle_plate?.replace(/\s/g, ''));
              if (v) setGpsData(v);
            }
          }).catch(() => {});
      }
    }).catch(() => setLoading(false));
  }, [id]);

  const changeStatus = async (newStatus: string) => {
    setStatusChanging(true);
    try {
      const r = await fetch(`/api/hired/contracts/${id}/status`, {
        method: 'PATCH', headers: { ...hdr(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (r.ok) {
        const d = await r.json();
        setContract((prev: any) => ({ ...prev, status: newStatus, ...d }));
      }
    } catch {} finally { setStatusChanging(false); }
  };

  const sendEmail = async () => {
    if (!contract.carrier_email) {
      setEmailMsg('❌ У перевозчика не указан email. Заполните в карточке перевозчика.');
      return;
    }
    if (!confirm(`Отправить ДЗ на \${contract.carrier_email}?`)) return;
    setEmailSending(true);
    setEmailMsg('');
    try {
      const r = await fetch(`/api/contracts/\${id}/send-email`, {
        method: 'POST', headers: { ...hdr(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: contract.carrier_email })
      });
      const d = await r.json();
      if (d.ok) {
        setEmailMsg('✅ ' + d.message);
        setContract((prev: any) => ({ ...prev, status: prev.status === 'draft' ? 'sent' : prev.status, sent_at: new Date().toISOString() }));
      } else {
        setEmailMsg('❌ ' + (d.error || 'Ошибка отправки'));
      }
    } catch(e: any) { setEmailMsg('❌ ' + e.message); }
    finally { setEmailSending(false); }
  };

  const markSigned = async () => {
    if (!confirm('Отметить ДЗ как подписанную?')) return;
    setStatusChanging(true);
    try {
      const r = await fetch(`/api/contracts/\${id}/mark-signed`, {
        method: 'POST', headers: { ...hdr(), 'Content-Type': 'application/json' }, body: '{}'
      });
      if (r.ok) setContract((prev: any) => ({ ...prev, status: 'signed', signed_at: new Date().toISOString() }));
      else { const d = await r.json(); alert(d.error || 'Ошибка'); }
    } catch {} finally { setStatusChanging(false); }
  };

  const sendPenaltyNotice = async (penalty: any) => {
    if (!contract.carrier_email) { alert('У перевозчика не указан email'); return; }
    if (!confirm(`Отправить уведомление о штрафе на \${contract.carrier_email}?`)) return;
    try {
      const r = await fetch(`/api/contracts/\${id}/send-penalty-notice`, {
        method: 'POST', headers: { ...hdr(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contract.carrier_email,
          penalty_description: penalty.reason || penalty.penalty_type,
          penalty_amount: penalty.penalty_amount,
          trip_info: penalty.trip_number || ''
        })
      });
      const d = await r.json();
      alert(d.ok ? '✅ Уведомление отправлено' : '❌ ' + (d.error || 'Ошибка'));
    } catch(e: any) { alert('Ошибка: ' + e.message); }
  };

  const uploadScan = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('scan', file);
      const r = await fetch(`/api/hired/contracts/${id}/upload-scan`, { method: 'POST', headers: hdr(), body: fd });
      if (r.ok) {
        setContract((prev: any) => ({ ...prev, status: 'signed', signed_scan_path: 'uploaded' }));
        setShowUpload(false);
      }
    } catch {} finally { setUploading(false); }
  };

  if (loading) return (
    <div className="max-w-[1200px] mx-auto p-4">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-800 rounded w-1/3" />
        <div className="h-64 bg-slate-800 rounded" />
        <div className="h-32 bg-slate-800 rounded" />
      </div>
    </div>
  );

  if (!contract) return (
    <div className="max-w-[1200px] mx-auto p-4 text-center py-20">
      <div className="text-4xl mb-4">📋</div>
      <h2 className="text-xl text-white mb-2">Контракт не найден</h2>
      <button onClick={() => router.push('/hired')} className="text-blue-400 hover:underline">← Вернуться</button>
    </div>
  );

  const st = STATUS_MAP[contract.status] || STATUS_MAP.draft;
  const tripCount = trips.length || contract.trip_count || 0;
  const totalPenalties = penalties.reduce((s, p) => s + Number(p.penalty_amount || 0), 0);
  const totalAccrued = Number(contract.price || 0) * tripCount;
  const toPay = totalAccrued - totalPenalties;

  // GPS marker for map
  const gpsMarkers = gpsData ? [{
    id: contract.vehicle_plate,
    lat: gpsData.latitude,
    lng: gpsData.longitude,
    title: contract.vehicle_plate,
    color: gpsData.speed > 5 ? 'green' : 'blue',
  }] : [];

  // ETA calculation
  let etaInfo: any = null;
  if (contract.loading_date && contract.transit_hours && contract.status === 'in_progress') {
    const deadline = new Date(new Date(contract.loading_date).getTime() + contract.transit_hours * 3600000);
    const remaining = deadline.getTime() - Date.now();
    const hoursRemaining = Math.round(remaining / 3600000);
    etaInfo = {
      deadline,
      hoursRemaining,
      isLate: remaining < 0,
      hoursLate: remaining < 0 ? Math.abs(hoursRemaining) : 0,
    };
  }

  return (
    <div className="max-w-[1200px] mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/hired?tab=contracts')} className="p-2 hover:bg-slate-800 rounded-lg">
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{contract.contract_number || id}</h1>
              <span className={`text-xs px-2 py-1 rounded ${st.bg} ${st.color}`}>{st.label}</span>
            </div>
            <div className="text-sm text-slate-400">
              {contract.carrier_name || '—'} · {contract.vehicle_plate || '—'} · {contract.route || contract.route_name || '—'}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`/api/hired/contracts/${id}/pdf`} target="_blank"
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm">
            <Download size={14} /> PDF
          </a>
          {contract.signed_scan_path && (
            <a href={`/api/hired/contracts/${id}/signed-scan`} target="_blank"
              className="flex items-center gap-1 px-3 py-1.5 bg-green-700/30 hover:bg-green-700/50 text-green-400 rounded text-sm">
              <FileText size={14} /> Скан
            </a>
          )}
        </div>
      </div>

      {/* Block 1: GPS Tracking (for active contracts) */}
      {['signed', 'in_progress'].includes(contract.status) && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-white font-medium flex items-center gap-2"><MapPin size={16} /> Трекинг</h3>
            {etaInfo && (
              <span className={`text-xs px-2 py-1 rounded ${etaInfo.isLate ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                {etaInfo.isLate ? `🔴 Опоздание ${etaInfo.hoursLate}ч` : `🟢 ETA через ${etaInfo.hoursRemaining}ч`}
              </span>
            )}
          </div>
          {gpsData ? (
            <div>
              <div className="h-[300px]">
                <YandexMap markers={gpsMarkers} height="300px" zoom={10}
                  center={[gpsData.latitude, gpsData.longitude]} />
              </div>
              <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-t border-slate-700">
                <div>
                  <div className="text-slate-400 text-xs">Позиция</div>
                  <div className="text-white">📍 {gpsData.latitude?.toFixed(4)}, {gpsData.longitude?.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">Скорость</div>
                  <div className="text-white">{Math.round(gpsData.speed || 0)} км/ч</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">Последнее обновление</div>
                  <div className="text-white">{fmtDateTime(gpsData.gps_time)}</div>
                </div>
                {etaInfo && (
                  <div>
                    <div className="text-slate-400 text-xs">Дедлайн</div>
                    <div className={etaInfo.isLate ? 'text-red-400' : 'text-white'}>{fmtDateTime(etaInfo.deadline.toISOString())}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-slate-500">
              <MapPin size={32} className="mx-auto mb-2 opacity-50" />
              <p>Нет GPS-данных для {contract.vehicle_plate}</p>
              <p className="text-xs mt-1">Машина не отслеживается или GPS-устройство не настроено</p>
            </div>
          )}
        </div>
      )}

      {/* Block 2: Linked WB Trips */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-medium">📦 Рейсы ({trips.length}/{contract.trip_count || '?'} привязано)</h3>
        </div>
        {trips.length > 0 ? (
          <div className="divide-y divide-slate-700/50">
            {trips.map((t: any, i: number) => {
              const ws = t.waysheet || t;
              return (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{ws.close_dt ? '✅' : ws.open_dt ? '🚛' : '⏳'}</span>
                    <div>
                      <div className="text-white text-sm font-medium">
                        #{ws.wb_id || ws.wb_trip_number || t.trip_number} {ws.route_name || '—'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {fmtDate(ws.open_dt || ws.loading_date)} → {fmtDate(ws.close_dt || ws.unloading_date)}
                        {ws.fact_speed ? ` · ${ws.fact_speed} км/ч` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white text-sm font-mono">{fmt(ws.total_price || t.our_price)} ₽</div>
                    <div className="text-xs text-slate-500">{ws.close_dt ? 'Доставлен' : ws.open_dt ? 'В пути' : 'Ожидание'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-slate-500 text-sm">
            Нет привязанных рейсов. Автопривязка происходит каждые 30 минут.
          </div>
        )}
      </div>

      {/* Block 3: Route & Transport (two columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2"><MapPin size={16} /> Маршрут</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Маршрут</span><span className="text-white">{contract.route || contract.route_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Расстояние</span><span className="text-white">{contract.distance_km || contract.route_km || '—'} км</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Транзит</span><span className="text-white">{contract.transit_hours || '—'} ч</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Дата погрузки</span><span className="text-white">{fmtDateTime(contract.loading_date)}</span></div>
            {contract.loading_address && <div className="flex justify-between"><span className="text-slate-400">Адрес погрузки</span><span className="text-white text-right max-w-[200px]">{contract.loading_address}</span></div>}
            {contract.unloading_address && <div className="flex justify-between"><span className="text-slate-400">Адрес выгрузки</span><span className="text-white text-right max-w-[200px]">{contract.unloading_address}</span></div>}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2"><Truck size={16} /> Транспорт</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Гос. номер</span><span className="text-white font-mono text-lg">{contract.vehicle_plate || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Марка</span><span className="text-white">{contract.vehicle_brand || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Водитель</span><span className="text-white">{contract.driver_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Телефон водителя</span>
              <span className="text-white">{contract.driver_phone ? <a href={`tel:${contract.driver_phone}`} className="text-blue-400 hover:underline">{contract.driver_phone}</a> : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Block 4: Finances */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-white font-medium">💰 Финансы</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-700">
          <div className="bg-slate-800 p-4 text-center">
            <div className="text-xs text-slate-400 mb-1">Ставка</div>
            <div className="text-xl font-bold text-white">{fmt(contract.price)} ₽</div>
            <div className="text-xs text-slate-500">{contract.vat_type === 'vat_included' ? 'с НДС' : 'без НДС'}</div>
          </div>
          <div className="bg-slate-800 p-4 text-center">
            <div className="text-xs text-slate-400 mb-1">Рейсов</div>
            <div className="text-xl font-bold text-white">{trips.length}/{contract.trip_count || '?'}</div>
          </div>
          <div className="bg-slate-800 p-4 text-center">
            <div className="text-xs text-slate-400 mb-1">Штрафы</div>
            <div className="text-xl font-bold text-red-400">{totalPenalties > 0 ? `-${fmt(totalPenalties)}` : '0'} ₽</div>
            <div className="text-xs text-slate-500">{penalties.length} шт</div>
          </div>
          <div className="bg-slate-800 p-4 text-center">
            <div className="text-xs text-slate-400 mb-1">К оплате</div>
            <div className={"text-xl font-bold " + (toPay >= 0 ? 'text-green-400' : 'text-red-400')}>{fmt(toPay)} ₽</div>
            <div className="text-xs text-slate-500">{fmt(contract.price)} × {tripCount} − {fmt(totalPenalties)}</div>
          </div>
        </div>
      </div>

      {/* Block 5: Penalties — enhanced */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-white font-medium">⚠️ Штрафы ({penalties.length})</h3>
          <button onClick={() => {
            const amt = prompt('Сумма штрафа, ₽');
            if (!amt) return;
            const reason = prompt('Причина');
            fetch('/api/hired/accounting/penalties', {method:'POST', headers:hdr(), body:JSON.stringify({contract_id:id, carrier_id:contract?.carrier_id, penalty_type:'other', penalty_amount:Number(amt), reason:reason||''})})
              .then(()=>window.location.reload());
          }} className="px-3 py-1 bg-red-700 rounded text-xs text-white">+ Добавить штраф</button>
          {penalties.length > 0 && <button onClick={() => {
            fetch('/api/hired/accounting/penalties/notify/' + id, {method:'POST', headers:hdr()})
              .then(r => r.json()).then(d => { if (d.ok) alert('✉️ Отправлено: ' + d.sent_to + ' (' + d.penalties_count + ' штрафов)'); else alert('Ошибка: ' + (d.error || 'unknown')); })
          }} className="px-3 py-1 bg-purple-700 rounded text-xs text-white">📧 Уведомить</button>}
        </div>
        {penalties.length === 0 ? <div className="px-4 py-6 text-center text-slate-500 text-sm">Штрафов нет</div> : (
          <div className="divide-y divide-slate-700/50">
            {penalties.map((p: any, i: number) => {
              const ptypes: Record<string,string> = {late_arrival:'Опоздание',late_delivery:'Просрочка',cargo_damage:'Повреждение груза',document_late:'Задержка документов',wb_penalty:'Штраф WB',other:'Прочее'};
              const pstats: Record<string,{l:string,c:string}> = {new:{l:'🆕 Новый',c:'bg-blue-500/20 text-blue-400'}, notified:{l:'📧 Уведомлён',c:'bg-purple-500/20 text-purple-400'}, confirmed:{l:'✅ Подтверждён',c:'bg-green-500/20 text-green-400'}, disputed:{l:'⚡ Оспаривается',c:'bg-yellow-500/20 text-yellow-400'}, offset:{l:'💰 Удержан',c:'bg-emerald-500/20 text-emerald-400'}, cancelled:{l:'❌ Отменён',c:'bg-slate-500/20 text-slate-400'}};
              const st = pstats[p.status] || {l:p.status,c:'bg-slate-500/20 text-slate-400'};
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">{ptypes[p.penalty_type] || p.penalty_type || 'Штраф'}</div>
                      <div className="text-xs text-slate-400">{fmtDate(p.penalty_date || p.created_at)} {p.reason && <span>· {p.reason}</span>}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 font-mono font-medium">{fmt(p.penalty_amount)} ₽</span>
                      <span className={"text-[10px] px-2 py-0.5 rounded " + st.c}>{st.l}</span>
                    </div>
                  </div>
                  {!['cancelled','paid','offset'].includes(p.status) && (
                    <div className="flex gap-1 mt-2">
                      {['new','notified'].includes(p.status) && <button onClick={()=>{if(window.confirm('Подтвердить штраф?')) fetch('/api/hired/accounting/penalties/'+p.id+'/confirm',{method:'POST',headers:hdr()}).then(()=>window.location.reload())}} className="px-2 py-1 bg-green-700 rounded text-[10px] text-white">✅ Подтвердить</button>}
                      <button onClick={()=>{const r=prompt('Причина отмены:');if(r) fetch('/api/hired/accounting/penalties/'+p.id+'/cancel',{method:'POST',headers:hdr(),body:JSON.stringify({reason:r})}).then(()=>window.location.reload())}} className="px-2 py-1 bg-red-700/60 rounded text-[10px] text-white">🗑 Отменить</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      
      {/* Block: Payment Lifecycle */}
      {['completed','in_progress','signed'].includes(contract.status) && (
        <PaymentBlock contract={contract} id={id} hdr={hdr} setContract={setContract} />
      )}

      {/* Block 5b: Trip Linking */}
      <TripLinker contractId={id} hdr={hdr} />

      {/* Block 6: Context Actions */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h3 className="text-white font-medium mb-3">🎯 Действия</h3>
        <div className="flex flex-wrap gap-2">
          {/* Email send — always available for draft/sent */}
          {['draft', 'sent'].includes(contract.status) && (
            <button onClick={sendEmail} disabled={emailSending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm disabled:opacity-50">
              <Mail size={14} /> {emailSending ? 'Отправка...' : contract.status === 'sent' ? '📧 Отправить повторно' : '📧 Отправить ДЗ'}
            </button>
          )}
          {/* Mark signed — for draft/sent */}
          {['draft', 'sent'].includes(contract.status) && (
            <button onClick={markSigned} disabled={statusChanging}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm disabled:opacity-50">
              ✍️ Отметить подписанной
            </button>
          )}
          {/* Upload scan */}
          {['draft', 'sent'].includes(contract.status) && (
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm">
              <Upload size={14} /> Загрузить скан
            </button>
          )}
          {/* Edit — only draft */}
          {contract.status === 'draft' && (
            <button onClick={() => router.push(`/contracts/create?edit=\${id}`)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm">
              ✏️ Редактировать
            </button>
          )}
          {/* Start trip — signed */}
          {contract.status === 'signed' && (
            <button onClick={() => changeStatus('in_progress')} disabled={statusChanging}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded text-sm disabled:opacity-50">
              <Truck size={14} /> Начать рейс
            </button>
          )}
          {/* Complete — in_progress */}
          {contract.status === 'in_progress' && (
            <button onClick={() => changeStatus('completed')} disabled={statusChanging}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm disabled:opacity-50">
              <Check size={14} /> Завершить
            </button>
          )}
          {/* Settlements — completed */}
          {contract.status === 'completed' && (
            <button onClick={() => router.push('/hired?tab=settlements')}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm">
              💰 К расчётам
            </button>
          )}
          {/* Cancel — draft/sent */}
          {['draft', 'sent'].includes(contract.status) && (
            <button onClick={() => changeStatus('cancelled')} disabled={statusChanging}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm disabled:opacity-50">
              <X size={14} /> Отменить
            </button>
          )}
        </div>
        {emailMsg && <div className={"mt-2 text-sm " + (emailMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400')}>{emailMsg}</div>}
      </div>

      {/* Block 7: Carrier & Navigation */}
      {(contract.carrier_name || contract.carrier_phone || contract.carrier_email) && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">💬 Перевозчик</h3>
            {contract.carrier_id && (
              <button onClick={() => router.push(`/hired/carriers/\${contract.carrier_id}`)}
                className="text-xs text-blue-400 hover:underline">Открыть карточку →</button>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="text-white font-medium text-lg">{contract.carrier_name || '—'}</div>
            {contract.carrier_inn && <div className="text-slate-400">ИНН: {contract.carrier_inn}</div>}
            <div className="flex flex-wrap gap-2 mt-3">
              {contract.carrier_phone && (
                <a href={`tel:\${contract.carrier_phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded text-sm hover:bg-blue-600/30">
                  <Phone size={14} /> {contract.carrier_phone}
                </a>
              )}
              {contract.carrier_email && (
                <a href={`mailto:\${contract.carrier_email}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded text-sm hover:bg-purple-600/30">
                  <Mail size={14} /> {contract.carrier_email}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Block 8: Timeline */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h3 className="text-white font-medium mb-3">📜 История</h3>
        <div className="space-y-3 text-sm">
          {/* Static entries */}
          <div className="flex gap-3 items-start">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <div><span className="text-slate-400">Создан:</span> <span className="text-white">{fmtDateTime(contract.created_at)}</span></div>
          </div>
          {contract.sent_at && (
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <div><span className="text-slate-400">Отправлена:</span> <span className="text-white">{fmtDateTime(contract.sent_at)}</span></div>
            </div>
          )}
          {contract.signed_at && (
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
              <div><span className="text-slate-400">Подписан:</span> <span className="text-white">{fmtDateTime(contract.signed_at)}</span></div>
            </div>
          )}
          {contract.completed_at && (
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
              <div><span className="text-slate-400">Завершён:</span> <span className="text-white">{fmtDateTime(contract.completed_at)}</span></div>
            </div>
          )}
          {/* Dynamic history from contract_history + email_log */}
          {history.length > 0 && (
            <>
              <div className="border-t border-slate-700 pt-2 mt-2">
                <div className="text-xs text-slate-500 mb-2">Детальный лог</div>
              </div>
              {history.map((h, i) => {
                const actionLabels: Record<string,string> = {
                  email_sent: '📧 Email отправлен',
                  marked_signed: '✍️ Отмечена подписанной',
                  penalty_notice_sent: '⚠️ Уведомление о штрафе',
                  status_changed: '🔄 Статус изменён',
                };
                const label = h.type === 'email'
                  ? (h.status === 'sent' ? '📧 Email: ' + h.subject : '❌ Email ошибка: ' + (h.error_message || h.subject))
                  : (actionLabels[h.action] || h.action);
                const color = h.type === 'email' ? (h.status === 'sent' ? 'bg-blue-400' : 'bg-red-400') : 'bg-slate-400';
                const details = h.details ? (typeof h.details === 'string' ? JSON.parse(h.details) : h.details) : null;
                return (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={"w-2 h-2 rounded-full mt-1.5 shrink-0 " + color} />
                    <div>
                      <span className="text-slate-300">{label}</span>
                      {details?.to && <span className="text-slate-500 ml-1">→ {details.to}</span>}
                      {h.performed_by && <span className="text-slate-600 ml-1">({h.performed_by})</span>}
                      <span className="text-slate-600 ml-2 text-xs">{fmtDateTime(h.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Upload Scan Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !uploading && setShowUpload(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-medium mb-4">📎 Загрузить скан подписанного ДЗ</h3>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={uploading}
              onChange={e => { if (e.target.files?.[0]) uploadScan(e.target.files[0]); }}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-600 file:text-white hover:file:bg-blue-500" />
            {uploading && <p className="text-blue-400 text-sm mt-3">Загрузка...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
