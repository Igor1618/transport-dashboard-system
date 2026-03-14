"use client";
import { useState } from "react";
import { X as CloseIcon, Plus, Loader2, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft } from "lucide-react";

interface Driver { name: string; phone: string; plate: string; model: string; vtype: string }
interface Props { onClose: () => void; onCreated?: () => void }

const initDriver = (): Driver => ({ name: '', phone: '', plate: '', model: '', vtype: '' });

export default function CreateCarrierModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [name, setName] = useState('');
  const [ctype, setCtype] = useState<'ip'|'ooo'|'other'>('ip');
  const [inn, setInn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contractNum, setContractNum] = useState('');
  const [contractDate, setContractDate] = useState(new Date().toISOString().slice(0,10));
  const [defaultPrice, setDefaultPrice] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([initDriver()]);

  // Step 2 fields
  const [preview, setPreview] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string|null>(null);
  const [extraPlates, setExtraPlates] = useState<string[]>([]);

  // Step 3 fields
  const [carrierId, setCarrierId] = useState<string|null>(null);
  const [linkResult, setLinkResult] = useState<any>(null);

  const addDriver = () => setDrivers(p => [...p, initDriver()]);
  const updateDriver = (i: number, f: keyof Driver, v: string) =>
    setDrivers(p => p.map((d, idx) => idx === i ? { ...d, [f]: v } : d));
  const removeDriver = (i: number) => setDrivers(p => p.filter((_, idx) => idx !== i));

  const allPlates = [...drivers.map(d => d.plate).filter(Boolean), ...extraPlates.filter(Boolean)];

  // Validation
  const step1Valid = name.trim() && inn.trim() && drivers.some(d => d.plate.trim() && d.name.trim());

  const goToStep2 = async () => {
    if (!step1Valid) return;
    setLoading(true);
    setPreviewError(null);
    try {
      const params = new URLSearchParams({ vehicle_plates: allPlates.join(',') });
      const d = await (await fetch(`/api/hired/auto-link/preview?${params}`)).json();
      if (d.error) throw new Error(d.error);
      setPreview(d);
      setStep(2);
    } catch (e: any) {
      setPreviewError(e.message);
    }
    setLoading(false);
  };

  const createAndLink = async () => {
    setLoading(true);
    try {
      // 1. Create carrier
      const cRes = await (await fetch('/api/hired/carriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type: ctype,
          inn: inn.trim(),
          phone, email,
          contract_number: contractNum,
          contract_date: contractDate,
          default_price: defaultPrice ? parseInt(defaultPrice) : null,
          status: 'active',
        }),
      })).json();
      if (cRes.error) throw new Error(cRes.error);
      const newCarrierId = cRes.id || cRes.carrier?.id;
      setCarrierId(newCarrierId);

      // 2. Create hired_drivers
      for (const drv of drivers.filter(d => d.plate && d.name)) {
        await fetch('/api/hired/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carrier_id: newCarrierId,
            full_name: drv.name,
            phone: drv.phone,
            vehicle_plate: drv.plate,
            vehicle_model: drv.model,
            vehicle_type: drv.vtype,
            is_active: true,
          }),
        });
      }

      // 3. Auto-link trips
      const linkRes = await (await fetch('/api/hired/auto-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier_id: newCarrierId,
          vehicle_plates: allPlates,
          default_our_price: defaultPrice ? parseInt(defaultPrice) : null,
        }),
      })).json();

      setLinkResult(linkRes);
      setStep(3);
      onCreated?.();
    } catch (e: any) {
      alert('Ошибка: ' + e.message);
    }
    setLoading(false);
  };

  const fmtMoney = (n: any) => n ? Number(n).toLocaleString('ru-RU') + ' ₽' : '—';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-2xl border border-slate-700 my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {step === 1 && '👤 Новый перевозчик'}
              {step === 2 && '🔍 Найденные рейсы'}
              {step === 3 && '✅ Готово!'}
            </h2>
            <div className="flex gap-1 mt-1">
              {[1,2,3].map(s => (
                <div key={s} className={"h-1 w-12 rounded-full " + (s <= step ? "bg-blue-500" : "bg-slate-700")} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            {/* Тип и название */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Тип</label>
              <div className="flex gap-4">
                {([['ip','ИП'],['ooo','ООО'],['other','Другое']] as const).map(([v,l]) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={ctype===v} onChange={() => setCtype(v)} className="accent-blue-500" /> {l}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Название / ФИО ИП *</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="ИП Сидоров Алексей Петрович"
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">ИНН *</label>
                <input value={inn} onChange={e=>setInn(e.target.value.replace(/\D/g,''))} placeholder="667912345678" maxLength={12}
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Телефон</label>
                <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+7 912 345 67 89"
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Номер договора</label>
                <input value={contractNum} onChange={e=>setContractNum(e.target.value)}
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Дата договора</label>
                <input type="date" value={contractDate} onChange={e=>setContractDate(e.target.value)}
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
              </div>
            </div>

            {/* Водители и машины */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block font-medium">Машина и водитель *</label>
              <div className="space-y-3">
                {drivers.map((d, i) => (
                  <div key={i} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 mb-1 block">ФИО водителя *</label>
                        <input value={d.name} onChange={e=>updateDriver(i,'name',e.target.value)} placeholder="Петров Иван Сергеевич"
                          className="w-full bg-slate-700 text-white text-xs px-2 py-1.5 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Гос. номер ТС *</label>
                        <input value={d.plate} onChange={e=>updateDriver(i,'plate',e.target.value.toUpperCase())} placeholder="А123ВС43"
                          className="w-full bg-slate-700 text-white text-xs px-2 py-1.5 rounded border border-slate-600 focus:border-blue-500 focus:outline-none font-mono" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Телефон</label>
                        <input value={d.phone} onChange={e=>updateDriver(i,'phone',e.target.value)}
                          className="w-full bg-slate-700 text-white text-xs px-2 py-1.5 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Марка ТС</label>
                        <input value={d.model} onChange={e=>updateDriver(i,'model',e.target.value)} placeholder="Фотон S120"
                          className="w-full bg-slate-700 text-white text-xs px-2 py-1.5 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Тип/грузоподъёмность</label>
                        <input value={d.vtype} onChange={e=>updateDriver(i,'vtype',e.target.value)} placeholder="5т"
                          className="w-full bg-slate-700 text-white text-xs px-2 py-1.5 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
                      </div>
                    </div>
                    {drivers.length > 1 && (
                      <button onClick={()=>removeDriver(i)} className="mt-2 text-xs text-red-400 hover:text-red-300">Удалить</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addDriver} className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                <Plus size={12} /> Ещё машина/водитель
              </button>
            </div>

            {/* Цена по умолчанию */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Наша цена по умолчанию, ₽</label>
              <div className="flex items-center gap-2">
                <input type="number" value={defaultPrice} onChange={e=>setDefaultPrice(e.target.value)} placeholder="45000"
                  className="w-40 bg-slate-700 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
                <span className="text-slate-500 text-xs">за рейс (подставится при автолинковке)</span>
              </div>
            </div>

            {previewError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-red-400 text-xs flex items-center gap-1">
                <AlertTriangle size={12} /> {previewError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Отмена</button>
              <button onClick={goToStep2} disabled={!step1Valid || loading}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded-lg font-medium">
                {loading ? <Loader2 size={14} className="animate-spin"/> : <ChevronRight size={14}/>}
                {loading ? 'Поиск рейсов...' : 'Далее: найти рейсы →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && preview && (
          <div className="p-6 space-y-4">
            <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
              {preview.trips_found > 0 ? (
                <>
                  <p className="text-lg font-bold text-white mb-1">🔍 Найдено {preview.trips_found} рейсов</p>
                  {preview.period.from && (
                    <p className="text-slate-400 text-sm mb-3">
                      Период: {new Date(preview.period.to).toLocaleDateString('ru-RU')} — {new Date(preview.period.from).toLocaleDateString('ru-RU')}
                    </p>
                  )}
                  {preview.already_linked > 0 && (
                    <p className="text-slate-400 text-sm mb-2">Уже привязано: {preview.already_linked}</p>
                  )}

                  {preview.routes.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-500 mb-1 font-medium">Маршруты:</p>
                      {preview.routes.map((r: any) => (
                        <div key={r.route} className="flex justify-between text-sm py-0.5">
                          <span className="text-slate-300 truncate max-w-[280px]">{r.route}</span>
                          <span className="text-slate-400 ml-2 flex-shrink-0">{r.count} рейсов</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {preview.penalties_count > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-sm text-red-400 mb-3">
                      ⚠️ Штрафы: {preview.penalties_count} рейсов, итого {Number(preview.penalties_amount).toLocaleString('ru-RU')} ₽
                    </div>
                  )}

                  {defaultPrice && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-sm text-blue-300">
                      💰 Наша цена: {Number(defaultPrice).toLocaleString('ru-RU')} ₽ × {preview.trips_found} = {(parseInt(defaultPrice) * preview.trips_found).toLocaleString('ru-RU')} ₽
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-slate-300 mb-2">ℹ️ Рейсов с машиной {allPlates.join(', ')} не найдено.</p>
                  <p className="text-slate-500 text-sm">Перевозчик будет создан. Рейсы привяжутся автоматически когда появятся в WB.</p>
                </div>
              )}
            </div>

            {/* Доп. номера */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Если у перевозчика были другие машины:</label>
              <div className="flex gap-2 flex-wrap">
                {extraPlates.map((p, i) => (
                  <div key={i} className="flex items-center gap-1 bg-slate-700 rounded px-2 py-1">
                    <input value={p} onChange={e => setExtraPlates(prev => prev.map((x, idx) => idx===i ? e.target.value.toUpperCase() : x))}
                      className="bg-transparent text-white text-xs w-24 font-mono focus:outline-none" />
                    <button onClick={() => setExtraPlates(prev => prev.filter((_,idx)=>idx!==i))} className="text-slate-500 hover:text-red-400">
                      <CloseIcon size={10}/>
                    </button>
                  </div>
                ))}
                <button onClick={() => setExtraPlates(p => [...p, ''])} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <Plus size={10}/> Добавить номер
                </button>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white">
                <ChevronLeft size={14}/> Назад
              </button>
              <button onClick={createAndLink} disabled={loading}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-slate-600 rounded-lg font-medium">
                {loading ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
                {loading ? 'Создание...' : preview.trips_found > 0 ? `Создать и привязать ${preview.trips_found} →` : 'Создать без рейсов'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && linkResult && (
          <div className="p-6 space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 text-center">
              <CheckCircle size={32} className="text-green-400 mx-auto mb-2"/>
              <p className="text-lg font-bold text-white mb-1">{name} — создан</p>
              <p className="text-green-400">{linkResult.linked} рейсов привязано</p>
              {defaultPrice && linkResult.linked > 0 && (
                <p className="text-slate-400 text-sm mt-1">Наша цена {Number(defaultPrice).toLocaleString('ru-RU')} ₽ проставлена для всех</p>
              )}
            </div>

            <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 text-sm space-y-2">
              <p className="font-medium text-slate-300">Что дальше:</p>
              <ul className="space-y-1 text-slate-400 text-xs">
                <li>• Проверьте цены в аудите если для части рейсов цена отличается</li>
                <li>• Когда получите документы — подтвердите рейсы в аудите (<span className="text-green-400">✓</span>)</li>
                {linkResult.trips?.some((t: any) => t.has_penalty) && (
                  <li className="text-red-400">• Обработайте штрафы во вкладке Штрафы</li>
                )}
              </ul>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => {
                setStep(1); setName(''); setInn(''); setPhone(''); setEmail('');
                setContractNum(''); setDefaultPrice(''); setDrivers([initDriver()]); setPreview(null); setLinkResult(null);
              }} className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg">
                Добавить следующего
              </button>
              <div className="flex gap-2">
                {carrierId && (
                  <a href={`/hired?carrier=${carrierId}`}
                    className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg">
                    Открыть карточку
                  </a>
                )}
                <button onClick={onClose} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
