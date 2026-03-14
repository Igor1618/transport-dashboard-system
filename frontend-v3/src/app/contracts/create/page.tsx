"use client";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, FileText, Save, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const Input = ({ label, value, onChange, required, type, placeholder, className }: any) => (
  <div className={className}>
    <label className="text-xs text-slate-400 mb-1 block">{label}{required && ' *'}</label>
    <input type={type || 'text'} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
  </div>
);

export default function ContractCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [nextNum, setNextNum] = useState('');
  const [carriers, setCarriers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);

  const [f, setF] = useState<any>({
    carrier_id: '', carrier_name: '', carrier_inn: '', carrier_kpp: '',
    carrier_address: '', carrier_bank_account: '', carrier_bank_name: '',
    carrier_bank_bik: '', carrier_bank_corr: '',
    carrier_contact_person: '', carrier_phone: '', carrier_email: '', carrier_messenger: '',
    driver_name: '', driver_passport: '', driver_license: '', driver_phone: '',
    vehicle_brand: '', vehicle_plate: '', vehicle_reg_cert: '',
    trailer_brand: '', trailer_plate: '',
    route_name: '', route_km: '', norm_speed: '',
    loading_date: '', loading_address: '', unloading_address: '',
    cargo_description: 'ТНП / 20 тонн, 92м³, высота машина 2.65 не меньше',
    cargo_weight: '20', cargo_volume: '92',
    price: '', vat_type: 'no_vat',
    payment_terms: 'безнал без НДС 5 б/д по ориг. счет, акт – 2 экз.',
    payment_docs: 'счёт, акт — 2 экз.',
    doc_postal_address: '610035, г. Киров, а/я 3. Получатель: ООО «ГРУЗОВЫЕ ПЕРЕВОЗКИ»',
  });

  const set = (key: string, val: any) => setF((p: any) => ({ ...p, [key]: val }));

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eid = params.get('edit');
    
    // Load carriers and routes
    fetch('/api/hired/carriers').then(r => r.json()).then(d => setCarriers(Array.isArray(d) ? d : d.carriers || [])).catch(() => {});
    fetch('/api/contracts/routes').then(r => r.json()).then(d => setRoutes(Array.isArray(d) ? d : [])).catch(() => {});
    
    if (eid) {
      // EDIT mode: load existing contract
      setEditId(eid);
      setIsEditing(true);
      fetch(`/api/contracts/${eid}`).then(r => r.json()).then(data => {
        const c = data.contract || data;
        if (c && !data.error) {
          setNextNum(c.contract_number || '');
          // Map all fields from DB to form state
          const mapped: any = {};
          const fieldKeys = Object.keys(f);
          for (const k of fieldKeys) {
            if (c[k] !== undefined && c[k] !== null) {
              mapped[k] = String(c[k]);
            }
          }
          // Handle date formatting for input[type=date]
          if (c.loading_date) {
            try { mapped.loading_date = new Date(c.loading_date).toISOString().split('T')[0]; } catch {}
          }
          setF((prev: any) => ({ ...prev, ...mapped }));
        }
      }).catch(() => {});
    } else {
      // CREATE mode: get next number
      fetch('/api/contracts/next-number').then(r => r.json()).then(d => setNextNum(d.number)).catch(() => {});
    }
  }, []);

  const selectCarrier = async (carrierId: string) => {
    set('carrier_id', carrierId);
    if (!carrierId) return;
    const c = carriers.find((c: any) => c.id === carrierId);
    if (c) {
      setF((p: any) => ({
        ...p, carrier_id: carrierId,
        carrier_name: c.name || '', carrier_inn: c.inn || '',
        carrier_phone: c.phone || '', carrier_email: c.email || '',
        carrier_address: c.address || '', carrier_contact_person: c.contact_person || '',
        carrier_bank_account: c.bank_account || '', carrier_bank_name: c.bank_name || '',
        carrier_bank_bik: c.bank_bik || '', carrier_bank_corr: c.bank_corr || '',
      }));
    }
    try {
      const drRes = await fetch(`/api/hired/drivers?carrier_id=${carrierId}`);
      const drivers = await drRes.json();
      const dList = Array.isArray(drivers) ? drivers : drivers.drivers || [];
      if (dList.length > 0) {
        const d = dList[0];
        setF((p: any) => ({ ...p, driver_name: d.full_name || '', driver_phone: d.phone || '', vehicle_plate: d.vehicle_plate || '', vehicle_brand: d.vehicle_model || '' }));
      }
    } catch (e) {}
  };

  const selectRoute = (routeId: string) => {
    if (!routeId) return;
    const r = routes.find((r: any) => String(r.id) === routeId);
    if (r) {
      setF((p: any) => ({
        ...p,
        route_name: r.display_name || '',
        route_km: r.distance_km ? String(r.distance_km) : p.route_km,
        loading_address: r.loading_address || '',
        unloading_address: r.unloading_address || '',
      }));
    }
  };

  const toggleVat = (vt: string) => {
    const isVat = vt === 'vat_included';
    setF((p: any) => ({
      ...p, vat_type: vt,
      payment_terms: isVat ? 'безнал с НДС 5 б/д по ориг. счет, УПД – 2 экз.' : 'безнал без НДС 5 б/д по ориг. счет, акт – 2 экз.',
      payment_docs: isVat ? 'счёт, УПД — 2 экз.' : 'счёт, акт — 2 экз.',
    }));
  };

  const transitTime = f.norm_speed && f.route_km ? Math.round((parseFloat(f.route_km) / parseFloat(f.norm_speed)) * 60) : 0;
  const transitFmt = transitTime > 0 ? `${Math.floor(transitTime/60)} ч ${transitTime%60} мин` : '—';
  const isValid = f.carrier_name && f.carrier_inn && f.driver_name && f.vehicle_plate && f.route_name && f.price;

  const save = async (andSign: boolean) => {
    if (!isValid) return;
    setSaving(true);
    try {
      const body = {
        ...f,
        route_km: f.route_km ? parseInt(f.route_km) : null,
        norm_speed: f.norm_speed ? parseFloat(f.norm_speed) : null,
        transit_time_minutes: transitTime || null,
        price: parseFloat(f.price),
        cargo_weight: f.cargo_weight ? parseFloat(f.cargo_weight) : null,
        cargo_volume: f.cargo_volume ? parseFloat(f.cargo_volume) : null,
        loading_date: f.loading_date || null,
        carrier_id: f.carrier_id || null,
      };
      const url = editId ? `/api/contracts/${editId}` : '/api/contracts';
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (andSign && data.contract?.id) {
        await fetch(`/api/contracts/${data.contract.id}/sign`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      }
      router.push('/contracts');
    } catch (e: any) { alert('Ошибка: ' + e.message); }
    setSaving(false);
  };

  const openPreview = async () => {
    if (!isValid) return alert('Заполните обязательные поля');
    setSaving(true);
    try {
      const body = {
        ...f,
        route_km: f.route_km ? parseInt(f.route_km) : null,
        norm_speed: f.norm_speed ? parseFloat(f.norm_speed) : null,
        transit_time_minutes: transitTime || null,
        price: parseFloat(f.price),
        cargo_weight: f.cargo_weight ? parseFloat(f.cargo_weight) : null,
        cargo_volume: f.cargo_volume ? parseFloat(f.cargo_volume) : null,
        loading_date: f.loading_date || null,
        carrier_id: f.carrier_id || null,
      };
      const url = editId ? `/api/contracts/${editId}` : '/api/contracts';
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.open(`/api/contracts/${data.contract.id}/pdf?format=html`, '_blank');
    } catch (e: any) { alert('Ошибка: ' + e.message); }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/contracts" className="text-slate-400 hover:text-white"><ArrowLeft size={20}/></Link>
        <div>
          <h1 className="text-xl font-bold">Создание Договора-Заявки</h1>
          <p className="text-sm text-slate-400">№ {nextNum} от {new Date().toLocaleDateString('ru-RU')}</p>
        </div>
      </div>

      {/* Перевозчик */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">ПЕРЕВОЗЧИК</h2>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Выбрать из базы</label>
          <select value={f.carrier_id} onChange={e => selectCarrier(e.target.value)}
            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600">
            <option value="">— Новый перевозчик —</option>
            {carriers.map((c: any) => <option key={c.id} value={c.id}>{c.name} (ИНН: {c.inn})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Наименование" value={f.carrier_name} onChange={(v: string) => set('carrier_name', v)} required className="col-span-2" />
          <Input label="ИНН" value={f.carrier_inn} onChange={(v: string) => set('carrier_inn', v)} required />
          <Input label="КПП" value={f.carrier_kpp} onChange={(v: string) => set('carrier_kpp', v)} />
          <Input label="Адрес" value={f.carrier_address} onChange={(v: string) => set('carrier_address', v)} className="col-span-2" />
          <Input label="Контактное лицо" value={f.carrier_contact_person} onChange={(v: string) => set('carrier_contact_person', v)} />
          <Input label="Телефон" value={f.carrier_phone} onChange={(v: string) => set('carrier_phone', v)} />
          <Input label="Email" value={f.carrier_email} onChange={(v: string) => set('carrier_email', v)} />
          <Input label="Мессенджер" value={f.carrier_messenger} onChange={(v: string) => set('carrier_messenger', v)} />
        </div>
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer hover:text-slate-300">Банковские реквизиты</summary>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Input label="Р/счёт" value={f.carrier_bank_account} onChange={(v: string) => set('carrier_bank_account', v)} />
            <Input label="Банк" value={f.carrier_bank_name} onChange={(v: string) => set('carrier_bank_name', v)} />
            <Input label="БИК" value={f.carrier_bank_bik} onChange={(v: string) => set('carrier_bank_bik', v)} />
            <Input label="К/счёт" value={f.carrier_bank_corr} onChange={(v: string) => set('carrier_bank_corr', v)} />
          </div>
        </details>
      </div>

      {/* Водитель и ТС */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">ВОДИТЕЛЬ И ТС</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input label="ФИО водителя" value={f.driver_name} onChange={(v: string) => set('driver_name', v)} required className="col-span-2" />
          <Input label="Паспорт" value={f.driver_passport} onChange={(v: string) => set('driver_passport', v)} placeholder="6519 123456, МВД от 24.04.19г, код 160-010" />
          <Input label="Водительское удостоверение" value={f.driver_license} onChange={(v: string) => set('driver_license', v)} placeholder="1629 277674 от 05.10.16г" />
          <Input label="Телефон водителя" value={f.driver_phone} onChange={(v: string) => set('driver_phone', v)} />
          <div></div>
          <Input label="Марка ТС" value={f.vehicle_brand} onChange={(v: string) => set('vehicle_brand', v)} placeholder="КАМАЗ 5490-S5, Скания..." />
          <Input label="Гос. номер тягача" value={f.vehicle_plate} onChange={(v: string) => set('vehicle_plate', v.toUpperCase())} required />
          <Input label="СТС тягача" value={f.vehicle_reg_cert} onChange={(v: string) => set('vehicle_reg_cert', v)} placeholder="99 11 268170" />
          <div></div>
          <Input label="Марка прицепа" value={f.trailer_brand} onChange={(v: string) => set('trailer_brand', v)} placeholder="KRONE SD" />
          <Input label="Гос. номер прицепа" value={f.trailer_plate} onChange={(v: string) => set('trailer_plate', v.toUpperCase())} />
        </div>
      </div>

      {/* Маршрут и груз */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">МАРШРУТ И ГРУЗ</h2>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Выбрать маршрут</label>
          <select onChange={e => selectRoute(e.target.value)}
            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600">
            <option value="">— Свой маршрут —</option>
            {routes.map((r: any) => <option key={r.id} value={r.id}>{r.display_name} ({r.distance_km} км)</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Маршрут (название)" value={f.route_name} onChange={(v: string) => set('route_name', v)} required className="col-span-2" />
          <Input label="Километраж (км)" value={f.route_km} onChange={(v: string) => set('route_km', v)} type="number" />
          <Input label="Норм. скорость (км/ч)" value={f.norm_speed} onChange={(v: string) => set('norm_speed', v)} type="number" />
          {transitTime > 0 && (
            <div className="col-span-2 text-xs text-slate-400">
              Расчётное транзитное время: <span className="text-white font-medium">{transitFmt}</span>
            </div>
          )}
          <Input label="Дата/время погрузки" value={f.loading_date} onChange={(v: string) => set('loading_date', v)} type="datetime-local" />
          <div className="flex items-end text-xs text-slate-500 pb-2">Загрузка: круглосуточно</div>
          <Input label="Адрес погрузки" value={f.loading_address} onChange={(v: string) => set('loading_address', v)} className="col-span-2" />
          <Input label="Адрес выгрузки" value={f.unloading_address} onChange={(v: string) => set('unloading_address', v)} className="col-span-2" />
          <Input label="Груз / параметры" value={f.cargo_description} onChange={(v: string) => set('cargo_description', v)} className="col-span-2" />
          <Input label="Вес (тонн)" value={f.cargo_weight} onChange={(v: string) => set('cargo_weight', v)} type="number" />
          <Input label="Объём (м³)" value={f.cargo_volume} onChange={(v: string) => set('cargo_volume', v)} type="number" />
          <div className="col-span-2 text-xs text-slate-500">Погр/выгр: зад. Доставка: по транзитному времени ВБ Драйв.</div>
        </div>
      </div>

      {/* Финансы */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">ФИНАНСЫ</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Ставка (руб.)" value={f.price} onChange={(v: string) => set('price', v)} type="number" required />
          <div>
            <label className="text-xs text-slate-400 mb-1 block">НДС</label>
            <div className="flex gap-2">
              <button onClick={() => toggleVat('no_vat')}
                className={`px-3 py-2 rounded text-sm ${f.vat_type === 'no_vat' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                Без НДС
              </button>
              <button onClick={() => toggleVat('vat_included')}
                className={`px-3 py-2 rounded text-sm ${f.vat_type === 'vat_included' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                С НДС 22%
              </button>
            </div>
          </div>
          <Input label="Условия оплаты" value={f.payment_terms} onChange={(v: string) => set('payment_terms', v)} className="col-span-2" />
          <Input label="Документы" value={f.payment_docs} onChange={(v: string) => set('payment_docs', v)} />
          <Input label="Почтовый адрес для оригиналов" value={f.doc_postal_address} onChange={(v: string) => set('doc_postal_address', v)} className="col-span-2" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2 flex-wrap">
        <button onClick={openPreview} disabled={!isValid || saving}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-40 rounded-lg text-sm">
          <FileText size={14}/> Предпросмотр PDF
        </button>
        <button onClick={() => save(false)} disabled={!isValid || saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-40 rounded-lg text-sm font-medium">
          {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
          Сохранить черновик
        </button>
        <button onClick={() => save(true)} disabled={!isValid || saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:opacity-40 rounded-lg text-sm font-medium">
          <Check size={14}/> Подписать
        </button>
      </div>
    </div>
  );
}
