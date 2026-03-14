"use client";
import { useState } from "react";

const hdr = () => ({ 'x-user-role': typeof window !== 'undefined' ? localStorage.getItem('userRole') || 'director' : 'director', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } as any);

export default function CarrierWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [inn, setInn] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [carrierId, setCarrierId] = useState('');

  const createCarrier = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/hired/carriers', {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ name, inn, contact_person: contact, phone })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Ошибка создания');
      const cid = d.id || d.carrier?.id;
      setCarrierId(cid);
      setStep(2);
    } catch (e: any) { alert('Ошибка: ' + e.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className={`flex-1 h-1 rounded ${s <= step ? 'bg-blue-500' : 'bg-slate-700'}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 className="text-lg font-bold text-white mb-4">🧙 Новый перевозчик</h2>
            <div className="space-y-3">
              <input placeholder="Название / ИП / ФИО *" value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              <input placeholder="ИНН" value={inn} onChange={e => setInn(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Контактное лицо" value={contact} onChange={e => setContact(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                <input placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">Отмена</button>
              <button onClick={createCarrier} disabled={!name.trim() || loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium disabled:opacity-50">
                {loading ? 'Создание...' : 'Создать →'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-bold text-green-400 mb-4">✅ Перевозчик создан!</h2>
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
              <div className="text-white font-medium">{name}</div>
              {inn && <div className="text-xs text-slate-400">ИНН: {inn}</div>}
              {phone && <div className="text-xs text-slate-400">📞 {phone}</div>}
            </div>
            <div className="mt-4 text-xs text-slate-500">
              <p className="mb-1">Следующие шаги на карточке перевозчика:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Добавить машины и водителей</li>
                <li>Заполнить реквизиты для договора</li>
                <li>Создать ДЗ под маршрут</li>
              </ul>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">Закрыть</button>
              {carrierId && (
                <a href={`/hired/carriers/${carrierId}`} onClick={onClose}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium text-center">
                  Открыть карточку →
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
