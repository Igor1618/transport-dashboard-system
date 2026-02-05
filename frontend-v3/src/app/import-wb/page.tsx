"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Check, AlertTriangle, HelpCircle, Truck } from "lucide-react";

interface PreviewRow {
  tripNum: string;
  vehicleNum: string;
  normalized: string;
  driverName: string;
  routeName: string;
  amount: number;
  km: number;
  loadingDate: string;
  status: "ok" | "fuzzy" | "unknown" | "duplicate";
  matchedVehicle: string | null;
  suggestions: string[];
  confidence: number;
}

interface Stats {
  total: number;
  ours: number;
  rented: number;
  duplicates: number;
  needsReview: number;
}

export default function ImportWBPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{imported: number; skipped: number} | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");

  const handleUpload = async () => {
    if (!files || files.length === 0) return;
    setLoading(true);
    setResult(null);
    setPreview([]);
    setStats(null);
    
    let allPreview: PreviewRow[] = [];
    let allFilePaths: string[] = [];
    let totalStats = { total: 0, ours: 0, rented: 0, duplicates: 0, needsReview: 0 };
    
    for (let i = 0; i < files.length; i++) {
      setUploadProgress(`Анализ файла ${i + 1} из ${files.length}...`);
      const formData = new FormData();
      formData.append("file", files[i]);
      
      try {
        const res = await fetch("/api/upload-smart/wb/preview", { method: "POST", body: formData });
        const data = await res.json();
        allPreview = [...allPreview, ...(data.preview || [])];
        if (data.filePath) allFilePaths.push(data.filePath);
        if (data.stats) {
          totalStats.total += data.stats.total || 0;
          totalStats.ours += data.stats.ours || 0;
          totalStats.rented += data.stats.rented || 0;
          totalStats.duplicates += data.stats.duplicates || 0;
          totalStats.needsReview += data.stats.needsReview || 0;
        }
      } catch (e) {
        console.error(`Ошибка файла ${files[i].name}:`, e);
      }
    }
    
    setPreview(allPreview);
    setStats(totalStats);
    setFilePaths(allFilePaths);
    setUploadProgress("");
    
    // Инициализируем маппинги для fuzzy совпадений
    const initialMappings: Record<string, string> = {};
    for (const row of allPreview) {
      if (row.status === "fuzzy" && row.matchedVehicle) {
        initialMappings[row.vehicleNum] = row.matchedVehicle;
      }
    }
    setMappings(initialMappings);
    setLoading(false);
  };

  const handleConfirm = async () => {
    setImporting(true);
    let totalImported = 0, totalSkipped = 0;
    
    for (const filePath of filePaths) {
      try {
        const res = await fetch("/api/upload-smart/wb/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath, mappings })
        });
        const data = await res.json();
        if (data.success) {
          totalImported += data.imported || 0;
          totalSkipped += data.skipped || 0;
        }
      } catch (e) {
        console.error("Ошибка импорта:", e);
      }
    }
    
    setResult({ imported: totalImported, skipped: totalSkipped });
    setPreview([]);
    setStats(null);
    setFilePaths([]);
    setImporting(false);
  };

  const setMapping = (vehicleNum: string, value: string) => {
    setMappings({ ...mappings, [vehicleNum]: value });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok": return <Check className="w-4 h-4 text-green-400" />;
      case "fuzzy": return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case "unknown": return <HelpCircle className="w-4 h-4 text-orange-400" />;
      case "duplicate": return <span className="text-slate-500 text-xs">дубль</span>;
      default: return null;
    }
  };

  const needsReviewRows = preview.filter(r => r.status === "fuzzy" || r.status === "unknown");
  const okRows = preview.filter(r => r.status === "ok");
  const duplicateRows = preview.filter(r => r.status === "duplicate");

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/fuel" className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <Upload className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold">Умный импорт WB</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Загрузка файла */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={e => setFiles(e.target.files)}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2"
            />
            <button
              onClick={handleUpload}
              disabled={!files || files.length === 0 || loading}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 px-6 py-2 rounded-lg font-semibold"
            >
              {loading ? uploadProgress || "Анализ..." : `Анализировать${files && files.length > 1 ? ` (${files.length})` : ""}`}
            </button>
          </div>
        </div>

        {/* Результат импорта */}
        {result && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 text-center">
            <Check className="w-12 h-12 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-400">Импортировано: {result.imported}</div>
            {result.skipped > 0 && <div className="text-slate-400">Пропущено: {result.skipped}</div>}
          </div>
        )}

        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-slate-400 text-sm">Всего</div>
            </div>
            <div className="bg-green-900/30 rounded-lg p-4 text-center border border-green-700">
              <div className="text-2xl font-bold text-green-400">{stats.ours}</div>
              <div className="text-slate-400 text-sm">Наши ТС</div>
            </div>
            <div className="bg-yellow-900/30 rounded-lg p-4 text-center border border-yellow-700">
              <div className="text-2xl font-bold text-yellow-400">{stats.needsReview}</div>
              <div className="text-slate-400 text-sm">На проверку</div>
            </div>
            <div className="bg-orange-900/30 rounded-lg p-4 text-center border border-orange-700">
              <div className="text-2xl font-bold text-orange-400">{stats.rented}</div>
              <div className="text-slate-400 text-sm">Наёмные</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 text-center border border-slate-600">
              <div className="text-2xl font-bold text-slate-400">{stats.duplicates}</div>
              <div className="text-slate-400 text-sm">Дубликаты</div>
            </div>
          </div>
        )}

        {/* Требуют проверки */}
        {needsReviewRows.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-yellow-700 overflow-hidden">
            <div className="bg-yellow-900/30 px-4 py-3 border-b border-yellow-700">
              <h2 className="font-semibold text-yellow-400">⚠️ Требуют проверки ({needsReviewRows.length})</h2>
            </div>
            <div className="divide-y divide-slate-700">
              {needsReviewRows.map((row, i) => (
                <div key={i} className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(row.status)}
                      <span className="font-mono text-red-400">{row.vehicleNum}</span>
                      <span className="text-slate-500">→</span>
                      <span className="font-mono text-slate-300">{row.normalized}</span>
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      {row.driverName} • {row.routeName} • {row.km} км
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={mappings[row.vehicleNum] || ""}
                      onChange={e => setMapping(row.vehicleNum, e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
                    >
                      <option value="">— Выберите —</option>
                      <option value="rented">🚛 Наёмная машина</option>
                      {row.suggestions.map(s => (
                        <option key={s} value={s}>✓ {s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Готовые к импорту */}
        {okRows.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-700">
              <h2 className="font-semibold text-green-400">✓ Готовы к импорту ({okRows.length})</h2>
            </div>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/30 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Номер ТС</th>
                    <th className="text-left p-2">Водитель</th>
                    <th className="text-left p-2">Маршрут</th>
                    <th className="text-right p-2">км</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {okRows.slice(0, 50).map((row, i) => (
                    <tr key={i}>
                      <td className="p-2 font-mono text-cyan-400">{row.matchedVehicle}</td>
                      <td className="p-2 text-slate-300">{row.driverName}</td>
                      <td className="p-2 text-slate-400">{row.routeName}</td>
                      <td className="p-2 text-right">{row.km}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Кнопка импорта */}
        {preview.length > 0 && !result && (
          <button
            onClick={handleConfirm}
            disabled={importing || needsReviewRows.some(r => !mappings[r.vehicleNum])}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 py-4 rounded-xl font-bold text-lg"
          >
            {importing ? "Импорт..." : `🚀 Импортировать ${stats?.total || 0} рейсов`}
          </button>
        )}
      </div>
    </div>
  );
}
