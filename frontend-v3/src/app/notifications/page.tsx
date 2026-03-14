"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetchJson } from "@/shared/utils/apiFetch";
import { Bell, Check, Trash2 } from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetchJson("/api/notifications?limit=50")
      .then(d => setNotifications(Array.isArray(d) ? d : d?.notifications || []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id: string) => {
    try {
      await apiFetchJson("/api/notifications/" + id + "/read", { method: "POST" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Bell /> Уведомления</h1>
      {loading ? (
        <div className="text-slate-400 text-center py-10">Загрузка...</div>
      ) : notifications.length === 0 ? (
        <div className="text-slate-500 text-center py-10">Нет уведомлений</div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={"flex items-start gap-3 p-3 rounded-lg border " + (n.read ? "bg-slate-800/30 border-slate-700" : "bg-slate-800 border-blue-500/30")}>
              <div className="flex-1">
                <div className="text-sm text-white">{n.message || n.title}</div>
                <div className="text-xs text-slate-500 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString("ru-RU") : ""}</div>
              </div>
              {!n.read && (
                <button onClick={() => markRead(n.id)} className="text-blue-400 hover:text-blue-300" title="Прочитано">
                  <Check size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
