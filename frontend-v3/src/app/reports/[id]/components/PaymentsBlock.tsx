'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import type { Payment } from '../types/report';

const PAYMENT_LABELS: Record<string, string> = {
  daily: 'Суточные', advance: 'Аванс', card: 'На карту', cash: 'На руки', salary: 'Ведомость'
};

interface PaymentsBlockProps {
  payments: Payment[];
  setPayments: (v: Payment[]) => void;
}

export function PaymentsBlock({ payments, setPayments }: PaymentsBlockProps) {
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState('advance');
  const [desc, setDesc] = useState('');

  const addPayment = () => {
    if (date && amount) {
      setPayments([...payments, { date, amount: Number(amount), type, description: desc }]);
      setDate(''); setAmount(''); setDesc('');
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-orange-500/30">
      <div className="flex justify-between items-center mb-1 gap-2">
        <h2 className="font-semibold text-orange-400">💵 Выдано</h2>
      </div>
      <p className="text-xs text-slate-400 mb-2">Аванс, суточные — вычитается</p>
      {payments.map((p, i) => (
        <div key={i} className="flex justify-between bg-slate-700/50 rounded px-3 py-1 mb-1 text-sm">
          <span>{PAYMENT_LABELS[p.type] || p.type} {p.description && `(${p.description})`}</span>
          <div className="flex gap-2">
            <span className="text-orange-400">−{p.amount.toLocaleString()} ₽</span>
            <button onClick={() => setPayments(payments.filter((_, j) => j !== i))} className="text-slate-500"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>
      ))}
      <div className="space-y-2 sm:space-y-0 mt-2">
        <div className="flex gap-2 mb-2 sm:mb-0">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 sm:flex-none bg-slate-700 text-white rounded px-2 py-2 sm:py-1 border border-slate-600 text-sm" />
          <select value={type} onChange={e => setType(e.target.value)} className="flex-1 sm:flex-none bg-slate-700 text-white rounded px-2 py-2 sm:py-1 border border-slate-600 text-sm">
            <option value="advance">Аванс</option>
            <option value="daily">Суточные</option>
            <option value="card">На карту</option>
            <option value="cash">На руки</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input placeholder="Комментарий" value={desc} onChange={e => setDesc(e.target.value)} className="flex-1 min-w-0 bg-slate-700 text-white rounded px-3 py-2 sm:py-1 border border-slate-600 text-sm" />
          <input type="number" placeholder="₽" value={amount} onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')} className="w-24 sm:w-20 bg-slate-700 text-white rounded px-2 py-2 sm:py-1 border border-slate-600 text-sm" />
          <button onClick={addPayment} className="bg-orange-600 text-white px-4 sm:px-3 py-2 sm:py-1 rounded min-h-[44px] sm:min-h-0"><Plus className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
