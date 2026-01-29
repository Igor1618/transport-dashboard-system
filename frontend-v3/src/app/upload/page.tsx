'use client';

import { useState, useRef } from 'react';

interface SimilarVehicle {
  number: string;
  trips: number;
}

interface VehicleIssue {
  row: number;
  original: string;
  normalized: string;
  driver: string;
  type: 'suspicious' | 'new';
  similar: SimilarVehicle[];
  suggestion: string | null;
}

interface PreviewResult {
  filename: string;
  filePath: string;
  totalRows: number;
  vehicleIssues: VehicleIssue[];
  hasIssues: boolean;
}

interface ImportResult {
  rowsImported: number;
  rowsSkipped: number;
  correctionsMade: number;
  totalRows: number;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setResult(null);
      setError(null);
      setCorrections({});
    }
  };

  // Шаг 1: Предпросмотр
  const handlePreview = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload/preview', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      setPreview(data);
      
      // Автоматически применяем предложенные исправления
      const autoCorrections: Record<string, string> = {};
      data.vehicleIssues.forEach((issue: VehicleIssue) => {
        if (issue.type === 'suspicious' && issue.suggestion) {
          autoCorrections[issue.normalized] = issue.suggestion;
        }
      });
      setCorrections(autoCorrections);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Шаг 2: Импорт с исправлениями
  const handleImport = async () => {
    if (!preview) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: preview.filePath, corrections })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      setResult(data);
      setPreview(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCorrectionChange = (normalized: string, value: string) => {
    setCorrections(prev => {
      if (value) {
        return { ...prev, [normalized]: value };
      } else {
        const { [normalized]: _, ...rest } = prev;
        return rest;
      }
    });
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setCorrections({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Загрузка данных</h1>
      <p className="text-gray-400 mb-6">Импорт путевых листов из Excel файлов Wildberries</p>

      {/* Шаг 1: Выбор файла */}
      {!preview && !result && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-gray-400 mb-4">Выберите Excel файл (.xlsx)</p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer">
              Выбрать файл
            </label>
            {file && <div className="mt-4 p-3 bg-gray-700 rounded-lg inline-block"><span className="text-white">{file.name}</span></div>}
          </div>
          {file && (
            <button onClick={handlePreview} disabled={isLoading} className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium">
              {isLoading ? 'Анализ...' : '🔍 Проверить файл'}
            </button>
          )}
        </div>
      )}

      {error && <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6 text-red-300">{error}</div>}

      {/* Шаг 2: Предпросмотр и исправления */}
      {preview && !result && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-white font-medium">{preview.filename}</div>
                <div className="text-gray-400 text-sm">{preview.totalRows} строк</div>
              </div>
              <button onClick={reset} className="text-gray-400 hover:text-white">✕ Отмена</button>
            </div>
          </div>

          {/* Подозрительные номера */}
          {preview.vehicleIssues.filter(v => v.type === 'suspicious').length > 0 && (
            <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-4">
              <div className="text-orange-400 font-medium mb-3">⚠️ Подозрительные номера — возможно опечатки</div>
              <div className="space-y-3">
                {preview.vehicleIssues.filter(v => v.type === 'suspicious').map((issue, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-orange-400 font-mono text-lg">{issue.original}</span>
                        <span className="text-gray-500 text-sm ml-2">строка {issue.row}</span>
                      </div>
                    </div>
                    <div className="text-gray-400 text-sm mb-2">Водитель: {issue.driver}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-400 text-sm">Заменить на:</span>
                      <select
                        value={corrections[issue.normalized] || ''}
                        onChange={(e) => handleCorrectionChange(issue.normalized, e.target.value)}
                        className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 text-sm"
                      >
                        <option value="">Оставить как есть</option>
                        {issue.similar.map((s, j) => (
                          <option key={j} value={s.number}>
                            {s.number} ({s.trips} рейсов)
                          </option>
                        ))}
                      </select>
                      {corrections[issue.normalized] && (
                        <span className="text-green-400 text-sm">✓ Будет исправлено</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Новые машины */}
          {preview.vehicleIssues.filter(v => v.type === 'new').length > 0 && (
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
              <div className="text-blue-400 font-medium mb-3">🆕 Новые машины</div>
              <div className="flex flex-wrap gap-2">
                {preview.vehicleIssues.filter(v => v.type === 'new').map((issue, i) => (
                  <span key={i} className="bg-gray-800 px-3 py-1 rounded text-sm">
                    <span className="text-blue-400 font-mono">{issue.original}</span>
                    <span className="text-gray-500 ml-1">({issue.driver})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Всё чисто */}
          {preview.vehicleIssues.length === 0 && (
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
              <div className="text-green-400 font-medium">✅ Все номера машин корректны</div>
            </div>
          )}

          {/* Кнопка импорта */}
          <button onClick={handleImport} disabled={isLoading} className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium text-lg">
            {isLoading ? 'Импорт...' : `✅ Импортировать ${preview.totalRows} строк`}
            {Object.keys(corrections).length > 0 && ` (${Object.keys(corrections).length} исправлений)`}
          </button>
        </div>
      )}

      {/* Результат */}
      {result && (
        <div className="space-y-4">
          <div className="bg-green-900/50 border border-green-500 rounded-lg p-6">
            <div className="text-green-400 font-medium text-xl mb-4">✅ Файл успешно импортирован</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-800 p-3 rounded text-center">
                <div className="text-gray-400 text-sm">Всего</div>
                <div className="text-2xl text-white">{result.totalRows}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded text-center">
                <div className="text-gray-400 text-sm">Импортировано</div>
                <div className="text-2xl text-green-400">{result.rowsImported}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded text-center">
                <div className="text-gray-400 text-sm">Пропущено</div>
                <div className="text-2xl text-yellow-400">{result.rowsSkipped}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded text-center">
                <div className="text-gray-400 text-sm">Исправлено</div>
                <div className="text-2xl text-blue-400">{result.correctionsMade}</div>
              </div>
            </div>
          </div>
          <button onClick={reset} className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
            Загрузить ещё файл
          </button>
        </div>
      )}
    </div>
  );
}
