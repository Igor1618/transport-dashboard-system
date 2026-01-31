"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Search, Copy, XCircle } from "lucide-react";

interface CardPreview {
  card_number: string;
  vehicle_number: string | null;
  vehicle_hint?: string;
  driver_name?: string;
  holder?: string;
  total_liters: number;
  total_amount: number;
  count: number;
  source: string;
  new_vehicle?: string;
}

interface PreviewData {
  success: boolean;
  source: string;
  cards: CardPreview[];
  total_transactions: number;
  total_liters: number;
  total_amount: number;
  unlinked_cards: number;
}

interface ImportResult {
  success: boolean;
  imported?: number;
  duplicates?: number;
  errors?: number;
  errorDetails?: { row: number; reason: string }[];
  duplicateDetails?: { row: number; card: string; date: string; amount: number }[];
  total?: number;
}

const SOURCES = ["Татнефть", "E100", "Газпромнефть", "ТК Движение", "ТК Топливные решения"];

export default function FuelImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [step, setStep] = useState<"select" | "preview" | "done">("select");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [cards, setCards] = useState<CardPreview[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [vehicles, setVehicles] = useState<{number: string}[]>([]);

  useEffect(() => {
    fetch("/api/reports/vehicles").then(r => r.json()).then(setVehicles).catch(() => {});
  }, []);

  const handlePreview = async () => {
    if (!file || !source) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", source);
      const res = await fetch("/api/fuel/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setPreview(data);
        setCards(data.cards.map((c: CardPreview) => ({ ...c, new_vehicle: c.vehicle_number || c.vehicle_hint || "" })));
        setStep("preview");
      } else { alert("Ошибка: " + data.message); }
    } catch (e) { alert("Ошибка загрузки"); }
    setLoading(false);
  };

  const handleImport = async () => {
    if (!file || !source) return;
    setLoading(true);
    try {
      for (const card of cards) {
        if (card.new_vehicle && card.new_vehicle !== card.vehicle_number) {
          await fetch("/api/cards/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ card_number: card.card_number, source, vehicle_number: card.new_vehicle, driver_name: card.driver_name })
          });
        }
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", source);
      const res = await fetch("/api/fuel/upload", { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
      setStep("done");
    } catch (e) { setResult({ success: false }); }
    setLoading(false);
  };

  const updateCardVehicle = (cardNumber: string, vehicle: string) => {
    setCards(cards.map(c => c.card_number === cardNumber ? { ...c, new_vehicle: vehicle } : c));
  };

  const resetForm = () => { setFile(null); setSource(""); setStep("select"); setPreview(null); setCards([]); setResult(null); };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/fuel" className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-xl font-bold">Импорт топлива</h1>
          {step !== "select" && <button onClick={resetForm} className="ml-auto text-slate-400 hover:text-white text-sm">← Начать заново</button>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {step === "select" && (
          <>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <label className="block text-sm font-medium mb-2">Топливная компания</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SOURCES.map(s => (
                  <button key={s} onClick={() => setSource(s)} className={"px-4 py-3 rounded-lg border transition " + (source === s ? "bg-cyan-600 border-cyan-500" : "bg-slate-700 border-slate-600 hover:border-slate-500")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 border-dashed">
              <div className="text-center">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-500 mb-3" />
                <p className="text-slate-400 mb-4">Выберите Excel файл (.xlsx)</p>
                <label className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded-lg cursor-pointer">
                  <Upload className="w-4 h-4" /> Выбрать файл
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                </label>
                {file && <p className="mt-3 text-cyan-400">{file.name}</p>}
              </div>
            </div>
            <button onClick={handlePreview} disabled={loading || !file || !source} className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 px-6 py-4 rounded-xl text-lg font-medium">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />} {loading ? "Анализ..." : "Анализировать"}
            </button>
          </>
        )}

        {step === "preview" && preview && (
          <>
            <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-xl p-6 border border-cyan-500/30">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div><div className="text-2xl font-bold text-cyan-400">{preview.total_transactions}</div><div className="text-slate-400 text-sm">транзакций</div></div>
                <div><div className="text-2xl font-bold text-green-400">{preview.total_liters.toLocaleString("ru-RU", {maximumFractionDigits: 0})}</div><div className="text-slate-400 text-sm">литров</div></div>
                <div><div className="text-2xl font-bold text-yellow-400">{preview.total_amount.toLocaleString("ru-RU", {maximumFractionDigits: 0})}</div><div className="text-slate-400 text-sm">₽ сумма</div></div>
                <div><div className="text-2xl font-bold text-purple-400">{preview.cards.length}</div><div className="text-slate-400 text-sm">карт</div></div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h2 className="font-semibold">Привязка карт к машинам</h2>
                <p className="text-slate-400 text-sm">Начните вводить номер машины для поиска</p>
              </div>
              <div className="divide-y divide-slate-700">
                {cards.map((card, i) => (
                  <div key={i} className="p-4 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-mono text-cyan-400 text-sm">{card.card_number}</div>
                      {card.vehicle_hint && <div className="text-green-400 text-xs">Подсказка: {card.vehicle_hint}</div>}
                      {card.driver_name && <div className="text-slate-400 text-xs">{card.driver_name}</div>}
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-white">{card.total_liters.toFixed(0)} л</div>
                      <div className="text-slate-400">{card.total_amount.toLocaleString("ru-RU", {maximumFractionDigits: 0})} ₽</div>
                    </div>
                    <div className="flex items-center gap-2 min-w-[220px]">
                      <Search className="w-4 h-4 text-slate-500" />
                      <div className="relative flex-1">
                        <input 
                          type="text"
                          list={"vehicles-" + i}
                          value={card.new_vehicle || ""}
                          onChange={e => updateCardVehicle(card.card_number, e.target.value)}
                          placeholder="Введите номер..."
                          className={"w-full bg-slate-700 rounded px-3 py-2 border text-sm " + (card.new_vehicle ? "border-green-500 text-green-400" : "border-orange-500 text-orange-400")}
                        />
                        <datalist id={"vehicles-" + i}>
                          {vehicles.map(v => <option key={v.number} value={v.number} />)}
                        </datalist>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleImport} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 px-6 py-4 rounded-xl text-lg font-medium">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />} Импортировать {preview.total_transactions} транзакций
            </button>
          </>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            {/* Основной результат */}
            <div className={result.success ? "rounded-xl p-6 border bg-green-900/30 border-green-500/50" : "rounded-xl p-6 border bg-red-900/30 border-red-500/50"}>
              <div className="flex items-center gap-3 mb-4">
                {result.success ? <CheckCircle className="w-8 h-8 text-green-400" /> : <AlertCircle className="w-8 h-8 text-red-400" />}
                <span className="text-xl font-semibold">{result.success ? "Импорт завершён" : "Ошибка импорта"}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div className="bg-green-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-400">{result.imported || 0}</div>
                  <div className="text-green-300 text-sm">Добавлено</div>
                </div>
                <div className="bg-yellow-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-yellow-400">{result.duplicates || 0}</div>
                  <div className="text-yellow-300 text-sm">Дубликаты</div>
                </div>
                <div className="bg-red-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-400">{result.errors || 0}</div>
                  <div className="text-red-300 text-sm">Ошибки</div>
                </div>
              </div>
            </div>

            {/* Дубликаты */}
            {result.duplicateDetails && result.duplicateDetails.length > 0 && (
              <div className="bg-yellow-900/20 rounded-xl border border-yellow-700/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Copy className="w-5 h-5 text-yellow-400" />
                  <span className="font-semibold text-yellow-400">Пропущенные дубликаты ({result.duplicates})</span>
                </div>
                <p className="text-yellow-300 text-sm mb-3">Эти транзакции уже есть в базе:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.duplicateDetails.map((d, i) => (
                    <div key={i} className="text-sm bg-yellow-900/30 rounded px-3 py-1 flex justify-between">
                      <span className="text-slate-300">Строка {d.row}: карта {d.card}</span>
                      <span className="text-yellow-400">{d.date} | {d.amount} ₽</span>
                    </div>
                  ))}
                  {(result.duplicates || 0) > 20 && <div className="text-yellow-400 text-sm text-center">... и ещё {(result.duplicates || 0) - 20}</div>}
                </div>
              </div>
            )}

            {/* Ошибки */}
            {result.errorDetails && result.errorDetails.length > 0 && (
              <div className="bg-red-900/20 rounded-xl border border-red-700/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="font-semibold text-red-400">Ошибки ({result.errors})</span>
                </div>
                <p className="text-red-300 text-sm mb-3">Эти строки не удалось обработать:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.errorDetails.map((e, i) => (
                    <div key={i} className="text-sm bg-red-900/30 rounded px-3 py-1">
                      <span className="text-slate-300">Строка {e.row}:</span>
                      <span className="text-red-400 ml-2">{e.reason}</span>
                    </div>
                  ))}
                  {(result.errors || 0) > 20 && <div className="text-red-400 text-sm text-center">... и ещё {(result.errors || 0) - 20}</div>}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Link href="/fuel" className="flex-1 text-center bg-cyan-600 hover:bg-cyan-700 px-4 py-3 rounded-lg font-medium">← К топливу</Link>
              <button onClick={resetForm} className="flex-1 bg-slate-600 hover:bg-slate-500 px-4 py-3 rounded-lg font-medium">Загрузить ещё</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
