"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";

const hdr = () => ({ 'x-user-role': typeof window !== 'undefined' ? localStorage.getItem('userRole') || 'director' : 'director', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } as any);

const ROUTES = [
  { label: 'Екб → Серов → Екб (кругорейс)', route: 'Екб → Серов → Екб', km: 700 },
  { label: 'Екб → Тюмень → Екб (кругорейс)', route: 'Екб → Тюмень → Екб', km: 600 },
  { label: 'Уфа → Магнитогорск → Уфа', route: 'Уфа → Магнитогорск → Уфа', km: 600 },
  { label: 'Свой маршрут', route: '', km: 0 },
];

interface Carrier { id: string; name: string; inn: string; phone: string; contact_person: string; default_price: number; email?: string; }

const Input = ({ label, value, onChange, placeholder, type, required }: any) => (
  <div>
    <label className="text-xs text-slate-400 block mb-1">{label}{required && <span className="text-red-400"> *</span>}</label>
    <input type={type || 'text'} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
  </div>
);

export default function CreateContractWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [carrierSearch, setCarrierSearch] = useState('');
  const [carrierVehicles, setCarrierVehicles] = useState<any[]>([]);

  // Form fields
  const [carrierId, setCarrierId] = useState('');
  const [carrierEmail, setCarrierEmail] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [routeTemplate, setRouteTemplate] = useState(-1);
  const [route, setRoute] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [loadingDate, setLoadingDate] = useState('');
  const [loadingTime, setLoadingTime] = useState('05:00');
  const [transitHours, setTransitHours] = useState('');
  const [tripCount, setTripCount] = useState('1');
  const [price, setPrice] = useState('');
  const [vatType, setVatType] = useState('no_vat');
  const [cargoDesc, setCargoDesc] = useState('');

  useEffect(() => {
    fetch('/api/hired/carriers', { headers: hdr() })
      .then(r => r.json()).then(d => setCarriers(Array.isArray(d) ? d : d.carriers || []))
      .catch(() => {});
  }, []);

  const selectCarrier = (c: Carrier) => {
    setCarrierId(c.id);
    setCarrierName(c.name || '');
    setCarrierEmail(c.email || carrierEmail || '');
    if (c.default_price && !price) setPrice(String(c.default_price));
    if (c.phone) setDriverPhone(c.phone);
    setCarrierSearch('');
    // Load carrier vehicles
    fetch('/api/hired/carriers/' + c.id + '/vehicles', { headers: hdr() })
      .then(r => r.json()).then(d => setCarrierVehicles(Array.isArray(d) ? d : []))
      .catch(() => setCarrierVehicles([]));
  };

  const selectRoute = (idx: number) => {
    const tpl = ROUTES[idx];
    setRouteTemplate(idx);
    setRoute(tpl.route || '');
    setDistanceKm(tpl.km > 0 ? String(tpl.km) : '');
    if (tpl.km > 0) {
      const hours = Math.round(tpl.km / 55 * 2) / 2;
      setTransitHours(String(hours));
    } else { setTransitHours(''); }
  };

  const canNext = () => {
    if (step === 1) return !!carrierName || !!carrierId;
    if (step === 2) return !!vehiclePlate && !!driverName;
    if (step === 3) return !!route && !!distanceKm && !!loadingDate && !!transitHours;
    if (step === 4) return !!price;
    return true;
  };

  const submit = async (action: 'draft' | 'send') => {
    setSaving(true); setError('');
    try {
      const body = {
        carrier_id: carrierId || undefined,
        carrier_name: carrierName || undefined,
        carrier_email: carrierEmail || undefined,
        vehicle_plate: vehiclePlate,
        vehicle_model: vehicleModel || undefined,
        driver_name: driverName,
        driver_phone: driverPhone || undefined,
        route, distance_km: Number(distanceKm),
        loading_date: `${loadingDate}T${loadingTime}:00`,
        transit_hours: Number(transitHours),
        trip_count: Number(tripCount) || 1,
        price: Number(price),
        cargo_description: cargoDesc || undefined,
      };
      const r = await fetch('/api/hired/contracts', { method: 'POST', headers: hdr(), body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Ошибка создания');
      const contractId = d.id;
      setCreatedId(contractId);

      if (action === 'send') {
        // Generate PDF and send email
        await fetch(`/api/hired/contracts/${contractId}/create-and-send`, { method: 'POST', headers: hdr() }).catch(() => {});
      }
      setStep(6); // success
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const filteredCarriers = carriers.filter(c =>
    !carrierSearch || c.name?.toLowerCase().includes(carrierSearch.toLowerCase()) || c.inn?.includes(carrierSearch)
  );

  // Input moved outside component

  // Step indicator
  const steps = ['Перевозчик', 'Машина', 'Маршрут', 'Финансы', 'Подтверждение'];

  return (
    <div className="max-w-[700px] mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step === 1 ? router.push('/hired?tab=contracts') : setStep(s => s - 1)}
          className="p-2 hover:bg-slate-800 rounded-lg"><ChevronLeft size={20} /></button>
        <h1 className="text-xl font-bold">🧙 Создание ДЗ</h1>
      </div>

      {/* Step indicator */}
      {step <= 5 && (
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1 rounded ${i + 1 <= step ? 'bg-blue-500' : 'bg-slate-700'}`} />
              <div className={`text-xs mt-1 ${i + 1 === step ? 'text-white' : 'text-slate-500'}`}>{i + 1}. {s}</div>
            </div>
          ))}
        </div>
      )}

      {/* Step 1: Carrier */}
      {step === 1 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-lg text-white font-medium">👥 Выбрать перевозчика</h2>
          <input value={carrierSearch} onChange={e => setCarrierSearch(e.target.value)}
            placeholder="🔍 Поиск по названию или ИНН..."
            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />

          {carrierSearch && filteredCarriers.length > 0 && (
            <div className="max-h-48 overflow-y-auto bg-slate-700 rounded border border-slate-600 divide-y divide-slate-600">
              {filteredCarriers.slice(0, 10).map(c => (
                <div key={c.id} role="button" tabIndex={0}
                  onMouseDown={(e) => { e.preventDefault(); selectCarrier(c); }}
                  onTouchEnd={(e) => { e.preventDefault(); selectCarrier(c); }}
                  className={"w-full text-left px-3 py-2 text-sm cursor-pointer active:bg-blue-600/30 hover:bg-slate-600 " + (carrierId === c.id ? 'bg-blue-600/20' : '')}>
                  <div className="text-white font-medium pointer-events-none">{c.name}</div>
                  <div className="text-xs text-slate-400 pointer-events-none">{c.inn ? `ИНН: ${c.inn}` : ''} {c.phone || ''}</div>
                </div>
              ))}
            </div>
          )}

          {carrierId && (
            <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-3">
              <div className="text-blue-400 text-sm font-medium">✅ {carrierName}</div>
            </div>
          )}

          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs text-slate-400 mb-2">Или введите данные нового:</p>
            <Input label="Название" value={carrierName} onChange={setCarrierName} placeholder="ИП Иванов И.И." required />
          </div>
          <Input label="Email перевозчика" value={carrierEmail} onChange={setCarrierEmail} placeholder="carrier@mail.ru" type="email" />
        </div>
      )}

      {/* Step 2: Vehicle & Driver */}
      {step === 2 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-lg text-white font-medium">🚛 Машина и водитель</h2>
          {carrierVehicles.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 block mb-2">Машины перевозчика</label>
              <div className="space-y-1">
                {carrierVehicles.map((v: any) => (
                  <button key={v.id} onClick={() => { setVehiclePlate(v.vehicle_plate || ''); setVehicleModel(v.vehicle_model || ''); if (v.driver_name) setDriverName(v.driver_name); if (v.driver_phone) setDriverPhone(v.driver_phone); }}
                    className={"w-full text-left px-3 py-2 rounded border text-sm " + (vehiclePlate === v.vehicle_plate ? 'border-blue-500 bg-blue-600/10' : 'border-slate-600 hover:bg-slate-700')}>
                    <span className="font-mono text-blue-300">{v.vehicle_plate}</span>
                    {v.vehicle_model && <span className="text-slate-400 ml-2">{v.vehicle_model}</span>}
                    {v.driver_name && <span className="text-slate-500 ml-2 text-xs">👤 {v.driver_name}</span>}
                  </button>
                ))}
                <button onClick={() => { setVehiclePlate(''); setVehicleModel(''); setDriverName(''); setDriverPhone(''); }}
                  className="w-full text-left px-3 py-2 rounded border border-dashed border-slate-600 text-sm text-slate-400 hover:bg-slate-700">
                  + Новая машина
                </button>
              </div>
            </div>
          )}
          <Input label="Гос. номер" value={vehiclePlate} onChange={setVehiclePlate} placeholder="А999БВ96" required />
          <Input label="Марка/модель" value={vehicleModel} onChange={setVehicleModel} placeholder="МАН TGX 18.440" />
          <div className="border-t border-slate-700 pt-4" />
          <Input label="Водитель (ФИО)" value={driverName} onChange={setDriverName} placeholder="Иванов Иван Иванович" required />
          <Input label="Телефон водителя" value={driverPhone} onChange={setDriverPhone} placeholder="+7-900-123-4567" type="tel" />
        </div>
      )}

      {/* Step 3: Route */}
      {step === 3 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-lg text-white font-medium">📍 Маршрут</h2>
          <div>
            <label className="text-xs text-slate-400 block mb-2">Шаблон маршрута</label>
            <div className="grid grid-cols-1 gap-2">
              {ROUTES.map((r, i) => (
                <button key={i} onClick={() => selectRoute(i)}
                  className={"text-left px-3 py-2 rounded border text-sm " + (routeTemplate === i ? 'border-blue-500 bg-blue-600/10 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700')}>
                  {r.label} {r.km > 0 && <span className="text-slate-400">({r.km} км)</span>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Маршрут<span className="text-red-400"> *</span></label>
            <input type="text" value={route} onChange={e => setRoute(e.target.value)} placeholder="Екб → Серов → Екб"
              className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Расстояние (км)" value={distanceKm} onChange={setDistanceKm} placeholder="700" type="number" required />
            <Input label="Транзит (часов)" value={transitHours} onChange={setTransitHours} placeholder="8" type="number" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Дата погрузки" value={loadingDate} onChange={setLoadingDate} type="date" required />
            <Input label="Время" value={loadingTime} onChange={setLoadingTime} type="time" required />
          </div>
          <Input label="Количество рейсов" value={tripCount} onChange={setTripCount} placeholder="1" type="number" />
          <Input label="Описание груза" value={cargoDesc} onChange={setCargoDesc} placeholder="Палеты, товары WB" />
        </div>
      )}

      {/* Step 4: Finances */}
      {step === 4 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-lg text-white font-medium">💰 Финансы</h2>
          <Input label="Ставка за рейс (₽)" value={price} onChange={setPrice} placeholder="60000" type="number" required />
          <div>
            <label className="text-xs text-slate-400 block mb-2">НДС</label>
            <div className="flex gap-3">
              <button onClick={() => setVatType('no_vat')}
                className={"px-4 py-2 rounded border text-sm " + (vatType === 'no_vat' ? 'border-blue-500 bg-blue-600/10 text-white' : 'border-slate-600 text-slate-300')}>
                Без НДС
              </button>
              <button onClick={() => setVatType('vat_included')}
                className={"px-4 py-2 rounded border text-sm " + (vatType === 'vat_included' ? 'border-blue-500 bg-blue-600/10 text-white' : 'border-slate-600 text-slate-300')}>
                С НДС (20%)
              </button>
            </div>
          </div>
          {Number(price) > 0 && Number(tripCount) > 0 && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-400">Ставка × Рейсов</span><span className="text-white">{Number(price).toLocaleString('ru-RU')} × {tripCount} = {(Number(price) * Number(tripCount)).toLocaleString('ru-RU')} ₽</span></div>
              {vatType === 'vat_included' && <div className="flex justify-between"><span className="text-slate-400">В т.ч. НДС 20%</span><span className="text-slate-300">{Math.round(Number(price) * Number(tripCount) / 6).toLocaleString('ru-RU')} ₽</span></div>}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Preview */}
      {step === 5 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-lg text-white font-medium">📋 Предпросмотр</h2>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div><span className="text-slate-400">Перевозчик:</span> <span className="text-white">{carrierName || '—'}</span></div>
              <div><span className="text-slate-400">Email:</span> <span className="text-white">{carrierEmail || '—'}</span></div>
              <div><span className="text-slate-400">Машина:</span> <span className="text-white font-mono">{vehiclePlate}</span></div>
              <div><span className="text-slate-400">Марка:</span> <span className="text-white">{vehicleModel || '—'}</span></div>
              <div><span className="text-slate-400">Водитель:</span> <span className="text-white">{driverName}</span></div>
              <div><span className="text-slate-400">Телефон:</span> <span className="text-white">{driverPhone || '—'}</span></div>
              <div><span className="text-slate-400">Маршрут:</span> <span className="text-white">{route}</span></div>
              <div><span className="text-slate-400">Расстояние:</span> <span className="text-white">{distanceKm} км</span></div>
              <div><span className="text-slate-400">Транзит:</span> <span className="text-white">{transitHours} ч</span></div>
              <div><span className="text-slate-400">Погрузка:</span> <span className="text-white">{loadingDate ? new Date(loadingDate + 'T00:00').toLocaleDateString('ru-RU') : '—'} {loadingTime}</span></div>
              <div><span className="text-slate-400">Рейсов:</span> <span className="text-white">{tripCount}</span></div>
              <div><span className="text-slate-400">Ставка:</span> <span className="text-white font-bold">{Number(price).toLocaleString('ru-RU')} ₽ {vatType === 'vat_included' ? 'с НДС' : 'без НДС'}</span></div>
            </div>
            {Number(tripCount) > 1 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <span className="text-green-400 font-medium">Итого: {(Number(price) * Number(tripCount)).toLocaleString('ru-RU')} ₽</span>
              </div>
            )}
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
        </div>
      )}

      {/* Step 6: Success */}
      {step === 6 && (
        <div className="bg-slate-800 border border-green-500/30 rounded-xl p-8 text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl text-white font-medium">ДЗ создан!</h2>
          <div className="flex justify-center gap-3">
            <button onClick={() => router.push(`/hired/contracts/${createdId}`)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">📋 Открыть</button>
            <button onClick={() => { setStep(1); setCreatedId(''); setCarrierId(''); setCarrierName(''); setVehiclePlate(''); setDriverName(''); setRoute(''); setPrice(''); }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm">+ Создать ещё</button>
            <button onClick={() => router.push('/hired?tab=contracts')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm">← К списку</button>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      {step <= 5 && (
        <div className="flex justify-between">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : router.push('/hired?tab=contracts')}
            className="flex items-center gap-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm">
            <ChevronLeft size={16} /> {step === 1 ? 'Отмена' : 'Назад'}
          </button>
          {step < 5 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed">
              Далее <ChevronRight size={16} />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => submit('draft')} disabled={saving}
                className="flex items-center gap-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : '💾'} Черновик
              </button>
              <button onClick={() => submit('send')} disabled={saving}
                className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm disabled:opacity-50"
                title={!carrierEmail ? 'Email не указан — PDF будет сохранён без отправки' : ''}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : '📧'} PDF{carrierEmail ? ' + Отправить' : ' (без отправки)'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
