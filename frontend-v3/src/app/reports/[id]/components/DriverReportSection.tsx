'use client';

interface PrintData {
  driverName: string;
  vehicleNumber: string;
  dateFrom: string;
  dateTo: string;
  selectedVehicleType: string;
  gpsMileage: number;
  effectiveRfMileage: number;
  fuelRfLiters: number;
  avgFuelConsumptionTotal: string;
  avgFuelConsumption: string;
  selectedSeason: string;
  rfRatePerKm: number;
  rfDriverPay: number;
  rfBonus: number;
  rfDailyPay: number;
  rfDays: number;
  rfDailyRate: number;
  wbDriverRate: number;
  idleAmount: number;
  idlePaidHours: number;
  totalPayments: number;
  totalToPay: number;
  fuelUsedRf: number;
}

interface DriverReportSectionProps {
  reportText: string;
  comment: string;
  setComment: (v: string) => void;
  printData: PrintData;
}

export function DriverReportSection({ reportText, comment, setComment, printData }: DriverReportSectionProps) {
  const p = printData;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
      <head>
        <title>Отчёт - ${p.driverName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          h1 { font-size: 16px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #000; padding: 5px; text-align: left; }
          th { background: #f0f0f0; }
          .total { font-weight: bold; }
          .right { text-align: right; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>ОТЧЁТ ВОДИТЕЛЯ</h1>
        <table>
          <tr><td>Водитель:</td><td><strong>${p.driverName}</strong></td></tr>
          <tr><td>Период:</td><td>${p.dateFrom?.split('T')[0]} — ${p.dateTo?.split('T')[0]}</td></tr>
          <tr><td>Т/С:</td><td>${p.vehicleNumber}</td></tr>
          <tr><td>Тип:</td><td>${p.selectedVehicleType}</td></tr>
        </table>

        <h2>Пробег и расход</h2>
        <table>
          <tr><td>Пробег общий:</td><td class="right">${p.gpsMileage.toLocaleString()} км</td></tr>
          <tr><td>Пробег РФ:</td><td class="right">${p.effectiveRfMileage.toLocaleString()} км</td></tr>
          <tr><td>Топливо РФ:</td><td class="right">${Math.round(p.fuelRfLiters).toLocaleString()} л</td></tr>
          <tr><td>Расход общий:</td><td class="right">${p.avgFuelConsumptionTotal} л/100км</td></tr>
          ${p.effectiveRfMileage > 0 && p.fuelUsedRf > 0 ? `<tr><td>Расход РФ:</td><td class="right">${p.avgFuelConsumption} л/100км</td></tr>` : ''}
          <tr><td>Сезон:</td><td>${p.selectedSeason}</td></tr>
          <tr><td>Ставка:</td><td class="right">${p.rfRatePerKm} ₽/км</td></tr>
        </table>

        <h2>Начисления</h2>
        <table>
          ${p.rfDriverPay > 0 ? `<tr><td>За км (${p.effectiveRfMileage}×${p.rfRatePerKm}):</td><td class="right">${p.rfDriverPay.toLocaleString()} ₽</td></tr>` : ''}
          ${p.rfBonus > 0 ? `<tr><td>Премия ТК:</td><td class="right">${p.rfBonus.toLocaleString()} ₽</td></tr>` : ''}
          ${p.rfDailyPay > 0 ? `<tr><td>Суточные (${p.rfDays} дн × ${p.rfDailyRate}):</td><td class="right">${p.rfDailyPay.toLocaleString()} ₽</td></tr>` : ''}
          ${p.wbDriverRate > 0 ? `<tr><td>WB рейсы:</td><td class="right">${p.wbDriverRate.toLocaleString()} ₽</td></tr>` : ''}
          ${p.idleAmount > 0 ? `<tr><td>Простой (${p.idlePaidHours} ч.):</td><td class="right">${p.idleAmount.toLocaleString()} ₽</td></tr>` : ''}
          <tr class="total"><td>ИТОГО начислено:</td><td class="right">${(p.wbDriverRate + p.rfDriverPay + p.rfDailyPay + p.rfBonus + p.idleAmount).toLocaleString()} ₽</td></tr>
        </table>

        ${p.totalPayments > 0 ? `
        <h2>Выплачено</h2>
        <table>
          <tr><td>Выплачено:</td><td class="right">-${p.totalPayments.toLocaleString()} ₽</td></tr>
        </table>
        ` : ''}

        <h2 style="margin-top: 20px; border-top: 2px solid #000; padding-top: 10px;">
          К ВЫПЛАТЕ: <span style="font-size: 18px;">${p.totalToPay.toLocaleString()} ₽</span>
        </h2>

        <div style="margin-top: 30px;">
          <p>Дата: _________________ Подпись: _________________</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-600">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
        <h2 className="font-semibold text-slate-300">📋 Отчёт для водителя</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => { navigator.clipboard.writeText(reportText); alert("Скопировано!"); }} className="flex-1 sm:flex-none bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 sm:py-1 rounded text-sm min-h-[44px] sm:min-h-0">Копировать</button>
          <button onClick={handlePrint} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 sm:py-1 rounded text-sm min-h-[44px] sm:min-h-0">🖨️ Печать</button>
        </div>
      </div>
      <div className="mb-2">
        <input placeholder="Комментарий..." value={comment} onChange={e => setComment(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-1 border border-slate-600 text-sm" />
        <pre className="bg-slate-900 text-slate-300 p-3 rounded text-xs whitespace-pre-wrap font-mono overflow-x-auto">{reportText}</pre>
      </div>
    </div>
  );
}
