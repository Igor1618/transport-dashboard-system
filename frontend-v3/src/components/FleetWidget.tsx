"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const apiFetchJson = async (url: string) => {
  const role = localStorage.getItem("userRole") || "director";
  const userId = localStorage.getItem("userId") || "";
  const emRole = localStorage.getItem("emulateRole");
  const h: Record<string, string> = { "x-user-role": emRole || role, "x-user-id": userId };
  if (emRole) h["x-emulate-role"] = emRole;
  const r = await fetch(url, { headers: h });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

type Alert = { plate: string; type: string; problem: string; gps: { lat: number; lon: number } | null; driver?: string; route_from?: string; route_to?: string; delay?: string; reason?: string };
type Fleet = { wb: number; wb_active: number; wb_waiting: number; wb_late: number; rf: number; rf_late: number; free: number; alerts: Alert[] };
const parseDest = (r: string | null) => { if (!r) return "?"; const m = r.match(/\(([^)]+)\)\s*$/); return m ? m[1] : r.split(' - ').pop()?.trim() || r; };

export function FleetWidget() {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try { const f = await apiFetchJson("/api/wb-dispatch/fleet-status"); setFleet(f); setErr(false); }
    catch { setErr(true); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 300_000); return () => clearInterval(id); }, [load]);

  if (err || !fleet) return null;

  const cards = [
    { icon: "🟣", label: "ВБ", val: fleet.wb, sub: `${fleet.wb_active} в рейсе · ${fleet.wb_waiting} ждёт`, alert: fleet.wb_late ? `🔴 ${fleet.wb_late} опозд.` : "", link: "/dispatch/wb", tab: "wb", bg: "bg-purple-500/10 border-purple-500/30 hover:border-purple-500/60" },
    { icon: "🔵", label: "РФ", val: fleet.rf, sub: "заявки 1С", alert: fleet.rf_late ? `🔴 ${fleet.rf_late} опозд.` : "", link: "/command", tab: "rf", bg: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/60" },
    { icon: "⚪", label: "Свободные", val: fleet.free, sub: "готовы к работе", alert: "", link: "/vehicles?status=active", tab: "free", bg: "bg-slate-500/10 border-slate-500/30 hover:border-slate-500/60" },
  ];

  const topAlerts = fleet.alerts?.slice(0, 5) || [];

  return (
    <div className="mb-4 space-y-3">
      {/* Fleet Cards */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <Link key={i} href={c.link || `/dispatch/wb`} className={`rounded-xl p-4 border transition-colors ${c.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{c.icon}</span>
              <span className="text-slate-300 text-sm font-medium">{c.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{c.val}</div>
            <div className="text-slate-400 text-xs mt-1">{c.sub}</div>
            {c.alert && <div className="text-red-400 text-xs font-medium mt-1">{c.alert}</div>}
          </Link>
        ))}
      </div>

      {/* Alerts Table */}
      {topAlerts.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-orange-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-orange-400 font-medium text-sm">⚠️ Требуют внимания ({fleet.alerts.length})</span>
            <Link href="/command" className="text-blue-400 text-xs hover:underline">Командный центр →</Link>
          </div>
          <div className="space-y-1">
            {topAlerts.map((a, i) => (
              <Link key={i} href="/dispatch/wb" className="flex items-center gap-3 p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition text-sm">
                <span className="font-mono font-bold text-white w-24 shrink-0">{a.plate}</span>
                {a.driver && <span className="text-slate-400 text-xs w-28 shrink-0 truncate">{a.driver}</span>}
                <span className="w-8 shrink-0">{a.type === "wb" ? "🟣" : "🔵"}</span>
                <span className="text-slate-400 text-xs truncate w-32 shrink-0">{a.route_from ? `${a.route_from}→${parseDest(a.route_to||null)}` : parseDest(a.route_to||null)}</span>
                <span className="text-red-400 font-medium shrink-0">{a.problem}</span>
                <span className="flex-1 text-yellow-400/80 text-xs truncate">{a.reason?.replace('💡 ', '') || ''}</span>
                {a.gps?.lat && <span className="text-blue-400 shrink-0">📍</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
