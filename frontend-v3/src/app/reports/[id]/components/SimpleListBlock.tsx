'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface SimpleListBlockProps {
  title: string;
  subtitle?: string;
  items: { name: string; amount: number }[];
  setItems: (items: { name: string; amount: number }[]) => void;
  color: 'red' | 'amber';
  namePlaceholder: string;
  prefix?: string; // e.g. "−" or "+"
}

export function SimpleListBlock({
  title, subtitle, items, setItems, color, namePlaceholder, prefix = '−'
}: SimpleListBlockProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');

  const borderColor = color === 'red' ? 'border-red-500/30' : 'border-amber-500/30';
  const textColor = color === 'red' ? 'text-red-400' : 'text-amber-400';
  const bgColor = color === 'red' ? 'bg-red-600' : 'bg-amber-600';

  const addItem = () => {
    if (name && amount) {
      setItems([...items, { name, amount: Number(amount) }]);
      setName('');
      setAmount('');
    }
  };

  return (
    <div className={`bg-slate-800 rounded-xl p-4 border ${borderColor}`}>
      <h2 className={`font-semibold ${textColor} mb-1`}>{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mb-2">{subtitle}</p>}
      {items.map((d, i) => (
        <div key={i} className="flex justify-between bg-slate-700/50 rounded px-3 py-1 mb-1 text-sm">
          <span>{d.name}</span>
          <div className="flex gap-2">
            <span className={textColor}>{prefix}{d.amount.toLocaleString()} ₽</span>
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-slate-500"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>
      ))}
      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        <input placeholder={namePlaceholder} value={name} onChange={e => setName(e.target.value)} className="flex-1 bg-slate-700 text-white rounded px-3 py-2 sm:py-1 border border-slate-600 text-sm" />
        <div className="flex gap-2">
          <input type="number" placeholder="₽" value={amount} onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')} className="flex-1 sm:w-20 sm:flex-none bg-slate-700 text-white rounded px-3 py-2 sm:py-1 border border-slate-600 text-sm" />
          <button onClick={addItem} disabled={!name || !amount} className={`${bgColor} disabled:bg-slate-600 text-white px-4 sm:px-3 py-2 sm:py-1 rounded min-h-[44px] sm:min-h-0`}><Plus className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
