"use client";
import { formatDate } from "@/lib/dates";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface FuelTransaction {
  source: string;
  card_number: string;
  vehicle_number?: string;
  driver_name?: string;
  transaction_date: string;
  transaction_time?: string;
  fuel_type?: string;
  quantity: number;
  price_per_liter?: number;
  amount: number;
  station_name?: string;
}

export default function FuelUploadPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{imported: number; total: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FuelTransaction[]>([]);
  const [source, setSource] = useState("gazprom");

  const parseGazprom = (data: any[]): FuelTransaction[] => {
    return data.filter(row => row["Дата"] && row["Сумма"]).map(row => ({
      source: "gazprom",
      card_number: String(row["Номер карты"] || row["Карта"] || ""),
      vehicle_number: String(row["Гос. номер"] || row["ТС"] || ""),
      transaction_date: parseDate(row["Дата"]),
      transaction_time: row["Время"] || null,
      fuel_type: row["Вид топлива"] || row["Топливо"] || "ДТ",
      quantity: parseFloat(String(row["Количество"] || row["Литры"] || 0).replace(",", ".")),
      price_per_liter: parseFloat(String(row["Цена"] || 0).replace(",", ".")),
      amount: parseFloat(String(row["Сумма"] || 0).replace(",", ".").replace(/\s/g, "")),
      station_name: row["АЗС"] || row["Станция"] || ""
    }));
  };

  const parseTatneft = (data: any[]): FuelTransaction[] => {
    return data.filter(row => row["Дата операции"] || row["Дата"]).map(row => ({
      source: "tatneft",
      card_number: String(row["Номер карты"] || row["Карта"] || ""),
      vehicle_number: String(row["Гос.номер"] || row["Номер ТС"] || ""),
      transaction_date: parseDate(row["Дата операции"] || row["Дата"]),
      fuel_type: row["Товар"] || row["Вид топлива"] || "ДТ",
      quantity: parseFloat(String(row["Кол-во"] || row["Количество"] || 0).replace(",", ".")),
      amount: parseFloat(String(row["Сумма"] || 0).replace(",", ".").replace(/\s/g, "")),
      station_name: row["АЗС"] || ""
    }));
  };

  const parseDvijenie = (data: any[]): FuelTransaction[] => {
    return data.filter(row => row["Дата"] && (row["Сумма"] || row["Стоимость"])).map(row => ({
      source: "dvijenie",
      card_number: String(row["Карта"] || row["№ карты"] || ""),
      vehicle_number: String(row["Авто"] || row["ТС"] || ""),
      transaction_date: parseDate(row["Дата"]),
      fuel_type: row["Топливо"] || row["Вид"] || "ДТ",
      quantity: parseFloat(String(row["Литры"] || row["Кол-во"] || 0).replace(",", ".")),
      amount: parseFloat(String(row["Сумма"] || row["Стоимость"] || 0).replace(",", ".").replace(/\s/g, "")),
      station_name: row["АЗС"] || row["Станция"] || ""
    }));
  };

  const parseDate = (val: any): string => {
    if (!val) return "";
    if (typeof val === "number") {
      const date = XLSX.SSF.parse_date_code(val);
      return `${date.y}-${String(date.m).padStart(2,"0")}-${String(date.d).padStart(2,"0")}`;
    }
    const str = String(val);
    const match = str.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return str.slice(0, 10);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setPreview([]);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);

      let transactions: FuelTransaction[] = [];
      if (source === "gazprom") transactions = parseGazprom(data);
      else if (source === "tatneft") transactions = parseTatneft(data);
      else if (source === "dvijenie") transactions = parseDvijenie(data);

      transactions = transactions.filter(t => t.transaction_date && t.amount > 0);
      setPreview(transactions.slice(0, 10));

      if (transactions.length === 0) {
        setError("Не удалось распознать данные. Проверьте формат файла.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/reports/fuel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions })
      });
      const json = await res.json();
      setResult(json);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link href="/reports" className="flex items-center gap-2 text-slate-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Назад к отчётам
      </Link>

      <h1 className="text-2xl font-bold text-white mb-6">Загрузка топливных данных</h1>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-6">
        <div>
          <label className="block text-slate-400 text-sm mb-2">Источник данных</label>
          <div className="flex gap-4">
            {[
              { id: "gazprom", name: "Газпромнефть", color: "blue" },
              { id: "tatneft", name: "ТАТнефть", color: "green" },
              { id: "dvijenie", name: "Движение", color: "orange" }
            ].map(s => (
              <button key={s.id} onClick={() => setSource(s.id)}
                className={`px-4 py-2 rounded-lg border transition ${
                  source === s.id 
                    ? `bg-${s.color}-600 border-${s.color}-500 text-white` 
                    : "bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500"
                }`}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-2">Excel файл</label>
          <label className="flex items-center justify-center gap-3 bg-slate-700 hover:bg-slate-600 border-2 border-dashed border-slate-500 rounded-xl p-8 cursor-pointer transition">
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            {loading ? (
              <><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /><span className="text-slate-300">Загрузка...</span></>
            ) : (
              <><FileSpreadsheet className="w-8 h-8 text-slate-400" /><span className="text-slate-300">Выберите файл или перетащите сюда</span></>
            )}
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2 bg-green-500/20 border border-green-500 rounded-lg p-4 text-green-400">
            <CheckCircle className="w-5 h-5" /> Загружено: {result.imported} из {result.total} записей
          </div>
        )}

        {preview.length > 0 && (
          <div>
            <h3 className="text-white font-medium mb-2">Превью (первые 10):</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="text-left py-2">Дата</th>
                    <th className="text-left py-2">Машина</th>
                    <th className="text-right py-2">Литры</th>
                    <th className="text-right py-2">Сумма</th>
                    <th className="text-left py-2">АЗС</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {preview.map((t, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      <td className="py-2">{formatDate(t.transaction_date)}</td>
                      <td className="py-2">{t.vehicle_number || t.card_number}</td>
                      <td className="py-2 text-right">{t.quantity}</td>
                      <td className="py-2 text-right">{t.amount.toLocaleString()} ₽</td>
                      <td className="py-2">{t.station_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
