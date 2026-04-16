'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Relocation {
  from: string;
  to: string;
  mileage: number;
  date: string;
}

interface RelocationsBlockProps {
  relocations: Relocation[];
  setRelocations: (v: Relocation[]) => void;
  rfRatePerKm: number;
  relocationRate: number;
  setRelocationRate: (v: number) => void;
  relocationMileage: number;
  relocationPay: number;
}

export function RelocationsBlock({ relocations, setRelocations, rfRatePerKm, relocationRate, setRelocationRate, relocationMileage, relocationPay }: RelocationsBlockProps) {
  const [relFrom, setRelFrom] = useState('');
  const [relTo, setRelTo] = useState('');
  const [relMileage, setRelMileage] = useState('');
  const [relDate, setRelDate] = useState('');

  const addRelocation = () => {
    if (relFrom && relTo && relMileage) {
      setRelocations([...relocations, { from: relFrom, to: relTo, mileage: Number(relMileage), date: relDate }]);
      setRelFrom(''); setRelTo(''); setRelMileage(''); setRelDate('');
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-orange-500/30">
      <h2 className="font-semibold text-orange-400 mb-1">🚛 Порожний перегон</h2>
      <div className="flex items-center gap-3 mb-2">
        <label className="text-xs text-slate-500">Ставка ₽/км:</label>
        <input type="number" step="0.5" value={relocationRate}
          onChange={e => setRelocationRate(parseFloat(e.target.value) || 0)}
          className="bg-slate-700 border border-orange-600/50 rounded px-2 py-1 text-sm text-orange-300 w-20" />
        <span className="text-xs text-slate-600">(РФ: {rfRatePerKm})</span>
      </div>
      {relocations.map((r, i) => (
        <div key={i} className="flex items-center gap-2 mb-2 text-sm">
          <span className="text-orange-300">{r.from} → {r.to}</span>
          <span className="text-slate-400">{r.mileage} км</span>
          <span className="text-slate-500">{r.date}</span>
          <span className="text-orange-400 ml-auto">+{Math.round(r.mileage * (relocationRate || 0)).toLocaleString()} ₽</span>
          <button onClick={() => setRelocations(relocations.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /></button>
        </div>
      ))}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
        <input placeholder="Откуда" value={relFrom} onChange={e => setRelFrom(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white" />
        <input placeholder="Куда" value={relTo} onChange={e => setRelTo(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white" />
        <input placeholder="Пробег, км" type="number" value={relMileage} onChange={e => setRelMileage(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white" />
        <input type="date" value={relDate} onChange={e => setRelDate(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white" />
        <button onClick={addRelocation} disabled={!relFrom || !relTo || !relMileage} className="bg-orange-600 disabled:bg-slate-600 text-white px-4 py-1 rounded min-h-[44px] sm:min-h-0"><Plus className="w-4 h-4 mx-auto" /></button>
      </div>
      {relocationPay > 0 && <div className="text-right text-orange-400 font-bold mt-2">{relocationMileage} км × {relocationRate} = {relocationPay.toLocaleString()} ₽</div>}
    </div>
  );
}
