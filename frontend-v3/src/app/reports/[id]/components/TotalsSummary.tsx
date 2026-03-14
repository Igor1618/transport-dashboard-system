'use client';

import { Loader2, Save } from "lucide-react";

import type { ValidationResult } from '../types/report';

interface TotalsLine {
  label: string;
  amount: number;
  color: string;
  prefix: '+' | '−';
  detail?: string;
}

interface TotalsSummaryProps {
  lines: TotalsLine[];
  totalToPay: number;
  salaryTotal: number;
  effectiveRfMileage: number;
  earnPerKm: string;
  loading: boolean;
  validating: boolean;
  isDeleted: boolean;
  onSave: () => void;
  onValidate: () => void;
  validationResult: {status: string, checks: Array<{param: string, value: number, status: string, message: string, details?: string}>} | null;
}

export function TotalsSummary({
  lines, totalToPay, salaryTotal, effectiveRfMileage, earnPerKm,
  loading, validating, isDeleted, onSave, onValidate, validationResult
}: TotalsSummaryProps) {
  return (
    <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 border border-green-500/30">
      <div className="space-y-1 text-sm mb-3">
        {lines.filter(l => l.amount > 0).map((l, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-slate-400">{l.label}{l.detail ? ` (${l.detail})` : ''}</span>
            <span className={l.color}>{l.prefix}{l.amount.toLocaleString()} ₽</span>
          </div>
        ))}
      </div>
      <div className="text-center border-t border-slate-700 pt-3 mb-3">
        <div className="text-slate-400 text-xs">К выплате</div>
        <div className={`text-2xl sm:text-3xl font-bold ${totalToPay >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {isNaN(totalToPay) ? 0 : totalToPay.toLocaleString()} ₽
        </div>
        {salaryTotal > 0 && (
          <div className={`text-sm mt-1 ${totalToPay - salaryTotal > 100 ? 'text-yellow-400' : 'text-green-400'}`}>
            Остаток: {(totalToPay - salaryTotal).toLocaleString()} ₽
          </div>
        )}
        {effectiveRfMileage > 0 && <div className="text-slate-500 text-xs mt-1">Заработок: {earnPerKm} ₽/км</div>}
      </div>
      <div className="flex gap-2 w-full">
        <button onClick={onSave} disabled={loading || isDeleted} className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white px-4 py-4 sm:py-3 rounded-lg flex-1 flex items-center justify-center gap-2 text-base sm:text-sm min-h-[48px]">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Сохранить
        </button>
        <button onClick={onValidate} disabled={validating || isDeleted} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-4 sm:py-3 rounded-lg flex items-center justify-center gap-2 text-base sm:text-sm min-h-[48px]">
          {validating ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>✓</span>} Проверить
        </button>
      </div>
      {validationResult && (
        <div className={`mt-2 rounded-lg p-3 text-sm border ${
          validationResult.status === 'ok' ? 'bg-green-500/10 border-green-500/30' :
          validationResult.status === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
          'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-2 font-medium">
            {validationResult.status === 'ok' ? '✅ Всё в порядке' :
             validationResult.status === 'warning' ? '⚠️ Есть замечания' : '❌ Есть ошибки'}
          </div>
          <div className="space-y-1">
            {validationResult.checks.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 flex-shrink-0">
                  {c.status === 'ok' ? '✅' : c.status === 'warning' ? '⚠️' : '❌'}
                </span>
                <div>
                  <span className={c.status === 'ok' ? 'text-green-400' : c.status === 'warning' ? 'text-yellow-400' : 'text-red-400'}>
                    {c.message}
                  </span>
                  {c.details && <div className="text-slate-500">{c.details}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
