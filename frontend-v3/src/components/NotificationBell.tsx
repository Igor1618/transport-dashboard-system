"use client";
import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { apiFetch } from "@/shared/utils/apiFetch";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>({ notifications: [], unread_count: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let delay = 30000;
    let timer: ReturnType<typeof setTimeout>;
    let mounted = true;
    const poll = async () => {
      try {
        const r = await apiFetch("/api/notifications?limit=20");
        if (r.ok) { setData(await r.json()); delay = 30000; }
        else { delay = Math.min(delay * 2, 120000); }
      } catch { delay = Math.min(delay * 2, 120000); }
      if (mounted) timer = setTimeout(poll, delay);
    };
    poll();
    return () => { mounted = false; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: number) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
    setData((d: any) => ({
      ...d,
      notifications: d.notifications.map((n: any) => n.id === id ? { ...n, is_read: true } : n),
      unread_count: Math.max(0, d.unread_count - 1),
    }));
  };

  const markAllRead = async () => {
    await apiFetch("/api/notifications/read-all", { method: "POST" });
    setData((d: any) => ({
      ...d,
      notifications: d.notifications.map((n: any) => ({ ...n, is_read: true })),
      unread_count: 0,
    }));
  };

  const TYPE_ICONS: Record<string, string> = {
    alert: "⚠️", repair_complete: "✅", new_order: "📦", geofence: "📍", system: "🔔",
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Уведомления" title="Уведомления" className="relative p-2 rounded-lg hover:bg-slate-700 transition-colors">
        <Bell aria-label="Уведомления" className="w-5 h-5" />
        {data.unread_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {data.unread_count > 9 ? "9+" : data.unread_count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
            <span className="font-semibold text-sm">Уведомления</span>
            {data.unread_count > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-400 hover:underline">Прочитать все</button>
            )}
          </div>
          {data.notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">Нет уведомлений</div>
          ) : (
            data.notifications.map((n: any) => (
              <div
                key={n.id}
                onClick={() => { if (!n.is_read) markRead(n.id); if (n.link) window.location.href = n.link; }}
                className={`px-3 py-2.5 border-b border-slate-700/30 cursor-pointer hover:bg-slate-700/50 ${!n.is_read ? 'bg-blue-900/10' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm flex-shrink-0">{TYPE_ICONS[n.type] || "🔔"}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.message && <div className="text-xs text-slate-400 truncate">{n.message}</div>}
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(n.created_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
