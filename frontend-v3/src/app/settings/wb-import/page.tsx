"use client";
import React, { useState, useEffect, useCallback } from "react";

const apiFetchJson = async (url: string, opts?: RequestInit) => {
  const role = localStorage.getItem("userRole") || "director";
  const userId = localStorage.getItem("userId") || "";
  const emRole = localStorage.getItem("emulateRole");
  const headers: Record<string, string> = { "x-user-role": emRole || role, "x-user-id": userId, "Content-Type": "application/json" };
  if (emRole) headers["x-emulate-role"] = emRole;
  const r = await fetch(url, { headers, ...opts });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

const fmtDt = (s: string | null) => {
  if (!s) return "—";
  return new Date(s).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

type SyncLog = {
  id: number;
  sync_dt: string;
  fetched: number;
  new_count: number;
  updated_count: number;
  error: string | null;
  duration_ms: number;
};

type Status = {
  total_waysheets: number;
  closed_waysheets: number;
  matched_vehicles: number;
  recent_syncs: SyncLog[];
};

export default function WBImportPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetchJson("/api/wb-import/status");
      setStatus(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage("");
    try {
      const result = await apiFetchJson("/api/wb-import/sync-now", { method: "POST" });
      setMessage(`✅ Синхронизация завершена: ${result.fetched} получено, ${result.newCount} новых, ${result.updatedCount} обновлено (${result.duration}мс)`);
      await fetchStatus();
    } catch (e: any) {
      setMessage(`❌ Ошибка: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const lastSync = status?.recent_syncs?.[0];
  const lastError = status?.recent_syncs?.find(s => s.error);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📥 Автозагрузка путевых WB</h1>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border p-3 bg-blue-50 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-xs text-gray-500">Всего путевых</div>
          <div className="text-2xl font-bold">{status?.total_waysheets ?? "—"}</div>
        </div>
        <div className="rounded-lg border p-3 bg-green-50 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-xs text-gray-500">Закрытых</div>
          <div className="text-2xl font-bold">{status?.closed_waysheets ?? "—"}</div>
        </div>
        <div className="rounded-lg border p-3 bg-emerald-50 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-xs text-gray-500">Машин привязано</div>
          <div className="text-2xl font-bold">{status?.matched_vehicles ?? "—"}</div>
        </div>
        <div className="rounded-lg border p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-xs text-gray-500">Последняя синхр.</div>
          <div className="text-sm font-bold">{lastSync ? fmtDt(lastSync.sync_dt) : "—"}</div>
        </div>
      </div>

      {/* Auto-import info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-500 text-xl">●</span>
          <span className="font-medium">Автоимпорт активен</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Путевые листы WB загружаются автоматически каждые 30 минут из API VPS-сервиса.
          Закрытые путевые сохраняются в базу TL196 и привязываются к машинам по госномеру.
        </p>
      </div>

      {/* Sync button */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {syncing ? (
            <><span className="animate-spin">⟳</span> Синхронизация...</>
          ) : (
            <>🔄 Синхронизировать сейчас</>
          )}
        </button>
        {message && <span className="text-sm">{message}</span>}
      </div>

      {/* Last error */}
      {lastError?.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
          <div className="text-sm font-medium text-red-600">⚠️ Последняя ошибка ({fmtDt(lastError.sync_dt)}):</div>
          <div className="text-sm text-red-500">{lastError.error}</div>
        </div>
      )}

      {/* Sync log */}
      <h2 className="text-lg font-bold mb-2">📋 Лог синхронизаций</h2>
      {loading ? (
        <div className="text-gray-400 p-4">Загрузка...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Время</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Получено</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Новых</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Обновлено</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Время (мс)</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {(status?.recent_syncs || []).map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDt(s.sync_dt)}</td>
                  <td className="px-3 py-2 text-right">{s.fetched}</td>
                  <td className="px-3 py-2 text-right font-medium text-green-600">{s.new_count > 0 ? `+${s.new_count}` : "0"}</td>
                  <td className="px-3 py-2 text-right text-blue-600">{s.updated_count}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{s.duration_ms}</td>
                  <td className="px-3 py-2">
                    {s.error ? <span className="text-red-500">❌ {s.error.slice(0, 50)}</span> : <span className="text-green-500">✅</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
