"use client";
import { useState, useEffect } from "react";
import { FileText, Download, X as CloseIcon, AlertTriangle, Loader2, Save } from "lucide-react";

interface ContractDraftModalProps {
  tripId: number | string;
  onClose: () => void;
}

export default function ContractDraftModal({ tripId, onClose }: ContractDraftModalProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState<any>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    fetch(`/api/contract-draft/${tripId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setDraft(d);
        setEdited(JSON.parse(JSON.stringify(d)));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [tripId]);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const resp = await fetch(`/api/contract-draft/${tripId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: edited }),
      });
      if (!resp.ok) { const d = await resp.json(); throw new Error(d.error); }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Договор-заявка_${tripId}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert('Ошибка: ' + e.message); }
    setGenerating(false);
  };

  const handleSaveCarrier = async () => {
    if (!edited?.carrier?.name) return alert('Заполните наименование перевозчика');
    setSaving(true);
    try {
      const resp = await fetch('/api/contract-draft/save-carrier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier: edited.carrier, vehicle_number: edited.trip?.vehicle_number }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (e: any) { alert('Ошибка: ' + e.message); }
    setSaving(false);
  };

  const set = (path: (string | number)[], value: string) => {
    setEdited((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (typeof path[i] === 'number' && Array.isArray(cur)) cur = cur[path[i] as number];
        else cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  };

  const field = (label: string, path: (string | number)[], opts?: { full?: boolean; type?: string }) => {
    if (!edited) return null;
    let val: any = edited;
    for (const k of path) val = Array.isArray(val) ? val[k as number] : val?.[k] ?? '';
    return (
      <div className={opts?.full ? "col-span-2" : ""}>
        <label className="block text-xs text-slate-400 mb-1">{label}</label>
        <input
          type={opts?.type || "text"}
          value={val ?? ''}
          onChange={e => set(path, e.target.value)}
          className="w-full bg-slate-700 text-white text-sm px-2 py-1.5 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-4xl border border-slate-700 my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Договор-Заявка — Рейс #{tripId}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><CloseIcon size={20} /></button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <span className="ml-3 text-slate-300">Загрузка...</span>
          </div>
        )}

        {error && (
          <div className="p-6 text-red-400 flex items-center gap-2">
            <AlertTriangle size={18} />{error}
          </div>
        )}

        {edited && !loading && (
          <div className="p-6 space-y-6">
            {draft?.warnings?.map((w: string, i: number) => (
              <div key={i} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2 text-yellow-400 text-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />{w}
              </div>
            ))}
            {savedOk && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">
                ✅ Перевозчик сохранён — в следующий раз подставится автоматически
              </div>
            )}

            {/* Договор */}
            <section>
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">📄 Реквизиты договора</h3>
              <div className="grid grid-cols-2 gap-3">
                {field('Номер договора', ['contract', 'number'])}
                {field('Дата', ['contract', 'date'])}
              </div>
            </section>

            {/* Перевозчик */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">🏢 Исполнитель (Перевозчик)</h3>
                <button
                  onClick={handleSaveCarrier}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded border border-slate-600"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Сохранить перевозчика
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field('Наименование (ФИО ИП / ООО)', ['carrier', 'name'], { full: true })}
                {field('ИНН', ['carrier', 'inn'])}
                {field('ОГРН', ['carrier', 'ogrn'])}
                {field('Юр. / почтовый адрес', ['carrier', 'address'], { full: true })}
                {field('Паспорт (серия, №, кем выдан)', ['carrier', 'passport'], { full: true })}
                {field('Водительское удостоверение', ['carrier', 'vu'])}
                {field('Код АТИ', ['carrier', 'ati_id'])}
                {field('Телефон', ['carrier', 'phone'])}
                {field('Email', ['carrier', 'email'])}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-2 gap-3">
                <p className="col-span-2 text-xs text-slate-500">Банковские реквизиты</p>
                {field('Банк', ['carrier', 'bank'], { full: true })}
                {field('БИК', ['carrier', 'bik'])}
                {field('Расчётный счёт', ['carrier', 'account'])}
                {field('Корр. счёт', ['carrier', 'corr_account'])}
              </div>
            </section>

            {/* Рейс и ТС */}
            <section>
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">🚛 Рейс и транспорт</h3>
              <div className="grid grid-cols-2 gap-3">
                {field('Маршрут', ['trip', 'route'], { full: true })}
                {field('Дата загрузки', ['trip', 'load_date'])}
                {field('Время загрузки', ['trip', 'load_time'])}
                {field('Марка ТС', ['trip', 'vehicle_brand'])}
                {field('Гос. номер ТС', ['trip', 'vehicle_number'])}
                {field('Цвет ТС', ['trip', 'vehicle_color'])}
                {field('Марка прицепа', ['trip', 'trailer_brand'])}
                {field('Гос. номер прицепа', ['trip', 'trailer_number'])}
              </div>
            </section>

            {/* Груз */}
            <section>
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">📦 Груз</h3>
              <div className="grid grid-cols-2 gap-3">
                {field('Вид груза', ['trip', 'cargo_type'])}
                {field('Вес, кг', ['trip', 'cargo_weight'])}
                {field('Объём, м³', ['trip', 'cargo_volume'])}
                {field('Требование по высоте, м', ['trip', 'cargo_height'])}
              </div>
            </section>

            {/* Точки */}
            <section>
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">📍 Точки маршрута</h3>
              <div className="space-y-3">
                {edited.points?.map((pt: any, i: number) => (
                  <div key={i} className="border border-slate-700 rounded-lg p-3 bg-slate-800/50">
                    <p className="text-sm font-medium text-slate-300 mb-2">
                      Точка {pt.num}: <span className="text-slate-200">{pt.city}</span>
                      {' — '}
                      <span className={pt.type === 'ПОГРУЗКА' ? 'text-green-400' : 'text-blue-400'}>{pt.type}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {field('Адрес', ['points', i, 'address'], { full: true })}
                      {field('Контактное лицо', ['points', i, 'contact'])}
                      {field('Транзитное окно (дата/время)', ['points', i, 'window'])}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Финансы */}
            <section>
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">💰 Финансы и условия</h3>
              <div className="grid grid-cols-2 gap-3">
                {field('Фрахт, руб.', ['trip', 'freight_amount'])}
                {field('Условия оплаты', ['trip', 'payment_terms'])}
                {field('Штраф — порог опоздания, ч.', ['penalties', 'hours'])}
                {field('Штраф — % от фрахта', ['penalties', 'percent'])}
              </div>
            </section>

            {/* Логист */}
            <section>
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">👤 Логист</h3>
              <div className="grid grid-cols-2 gap-3">
                {field('ФИО', ['logist', 'name'])}
                {field('Телефон', ['logist', 'phone'])}
              </div>
            </section>
          </div>
        )}

        {!loading && !error && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg">
              Закрыть
            </button>
            <button
              onClick={handleDownload}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {generating ? 'Генерация...' : 'Скачать .docx'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
