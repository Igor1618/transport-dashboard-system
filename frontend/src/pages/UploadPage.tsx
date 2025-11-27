import React, { useState, useRef } from 'react';
import { uploadExcel, getImportHistory } from '../services/api';
import type { ImportLog } from '../types';
import { Upload, CheckCircle, XCircle, FileSpreadsheet, Clock } from 'lucide-react';

const UploadPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    rowsImported?: number;
    rowsSkipped?: number;
  } | null>(null);
  const [history, setHistory] = useState<ImportLog[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getImportHistory();
      setHistory(data);
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const result = await uploadExcel(file);
      setUploadResult({
        success: true,
        message: result.message,
        rowsImported: result.rowsImported,
        rowsSkipped: result.rowsSkipped,
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Обновляем историю
      await loadHistory();
    } catch (err: any) {
      setUploadResult({
        success: false,
        message: err.response?.data?.message || 'Ошибка загрузки файла',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Загрузка данных</h1>
        <p className="text-gray-600 mt-2">Импорт путевых листов из Excel файлов Wildberries</p>
      </div>

      {/* Форма загрузки */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Загрузить новый файл</h2>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <FileSpreadsheet className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600 mb-4">
            Выберите Excel файл с путевыми листами от Wildberries
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />

          <label
            htmlFor="file-upload"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
          >
            <Upload size={20} className="mr-2" />
            Выбрать файл
          </label>

          {file && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">Выбран файл:</p>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(2)} KB
              </p>

              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Загрузка...' : 'Загрузить файл'}
              </button>
            </div>
          )}
        </div>

        {/* Результат загрузки */}
        {uploadResult && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              uploadResult.success
                ? 'bg-green-100 border border-green-400 text-green-700'
                : 'bg-red-100 border border-red-400 text-red-700'
            }`}
          >
            <div className="flex items-center">
              {uploadResult.success ? (
                <CheckCircle size={24} className="mr-3" />
              ) : (
                <XCircle size={24} className="mr-3" />
              )}
              <div>
                <p className="font-medium">{uploadResult.message}</p>
                {uploadResult.success && (
                  <p className="text-sm mt-1">
                    Импортировано: {uploadResult.rowsImported} | Пропущено: {uploadResult.rowsSkipped}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* История импорта */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">История импорта</h2>

        {history.length === 0 ? (
          <p className="text-gray-500 text-center py-8">История импорта пуста</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Файл
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата и время
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Импортировано
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Пропущено
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {log.filename}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock size={16} className="mr-2" />
                        {new Date(log.imported_at).toLocaleString('ru-RU')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.rows_imported}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.rows_skipped}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {log.status === 'success' ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Успешно
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Ошибка
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Инструкция */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-3">Формат файла</h3>
        <p className="text-blue-800 mb-3">
          Excel файл должен содержать следующие колонки:
        </p>
        <ul className="list-disc list-inside text-blue-800 space-y-1">
          <li>№ рейса WB</li>
          <li>Дата погрузки</li>
          <li>Дата выгрузки</li>
          <li>Номер машины</li>
          <li>ФИО водителя</li>
          <li>Маршрут</li>
          <li>Сумма рейса</li>
          <li>Километраж</li>
          <li>Штраф (есть/нет)</li>
          <li>Сумма штрафа</li>
          <li>Контейнеры</li>
          <li>РЦ (распределительный центр)</li>
        </ul>
      </div>
    </div>
  );
};

export default UploadPage;
