"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { Wrench, Car, FileText, AlertTriangle, CheckCircle, Clock, ChevronRight } from "lucide-react";

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("ru-RU") : "—";
const fmtKm = (n: any) => n != null ? Number(n).toLocaleString("ru-RU") + " км" : "—";

const severityColor = (s: string) =>
  s === "expired" ? "text-red-500 bg-red-500/10 border-red-500/30" :
  s === "red" ? "text-red-400 bg-red-500/10 border-red-500/30" :
  "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";

const severityDot = (days: number) =>
  days < 0 ? "🔴" : days <= 14 ? "🔴" : days <= 30 ? "🟠" : "🟡";

const alertLabel: Record<string, string> = {
  to1_overdue: "ТО-1 просрочено",
  to2_overdue: "ТО-2 просрочено",
  osago_expired: "ОСАГО истекло",
  osago_expiring: "ОСАГО истекает",
  tachograph_expired: "Тахограф истёк",
  tachograph_expiring: "Тахограф истекает",
  diagnostics_expired: "Диагностика истекла",
  diagnostics_expiring: "Диагностика истекает",
  tech_inspection_expired: "Техинспекция истекла",
  tech_inspection_expiring: "Техинспекция истекает",
};

export default function MechanicDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/mechanic")
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Wrench className="text-blue-400" size={22} />
              Колонный механик
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">{user?.full_name} · {today}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/maintenance" className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
              <Wrench size={14} /> ТО и ремонт
            </Link>
            <Link href="/vehicles" className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-600">
              <Car size={14} /> Машины
            </Link>
          </div>
        </div>

        {loading && (
          <div className="text-center py-16 text-slate-400">Загрузка данных...</div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 flex items-center gap-2">
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Машин активно", value: data.summary.total_vehicles, icon: Car, color: "text-blue-400", bg: "bg-blue-500/10" },
                { label: "Просрочено ТО", value: data.summary.overdue_to, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
                { label: "Скоро ТО (30 дней)", value: data.summary.upcoming_to, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
                { label: "Документы (60 дней)", value: data.summary.expiring_docs, icon: FileText, color: "text-orange-400", bg: "bg-orange-500/10" },
              ].map(c => (
                <div key={c.label} className={`${c.bg} border border-slate-700 rounded-xl p-4`}>
                  <div className={`${c.color} mb-2`}><c.icon size={22} /></div>
                  <div className={`text-3xl font-bold ${c.value > 0 && c.label !== "Машин активно" ? c.color : "text-white"}`}>
                    {c.value}
                  </div>
                  <div className="text-slate-400 text-xs mt-1">{c.label}</div>
                </div>
              ))}
            </div>

            {/* Alerts */}
            {data.alerts.length > 0 && (
              <div className="bg-slate-800 rounded-xl border border-slate-700">
                <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <h2 className="font-semibold text-sm">🚨 Требуют внимания — {data.alerts.length} позиций</h2>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {data.alerts.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-700/30">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold text-blue-300 w-24">{a.vehicle}</span>
                        <span className="text-slate-300 text-sm">{alertLabel[a.type] || a.type}</span>
                      </div>
                      <div className="text-right">
                        {a.km_overdue != null && (
                          <span className="text-red-400 text-sm font-medium">+{fmtKm(a.km_overdue)}</span>
                        )}
                        {a.days_left != null && (
                          <span className={`text-sm font-medium ${a.days_left < 0 ? "text-red-400" : a.days_left <= 14 ? "text-red-400" : "text-yellow-400"}`}>
                            {a.days_left < 0 ? `просрочено ${Math.abs(a.days_left)} дн.` : `${a.days_left} дн.`}
                          </span>
                        )}
                        {a.expires_at && (
                          <div className="text-slate-500 text-xs">{fmtDate(a.expires_at)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.alerts.length === 0 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3 text-green-400">
                <CheckCircle size={20} />
                <span>Просроченных ТО и критических документов нет — всё в порядке!</span>
              </div>
            )}

            {/* Upcoming maintenance */}
            {data.upcoming_maintenance.length > 0 && (
              <div className="bg-slate-800 rounded-xl border border-slate-700">
                <div className="px-5 py-3 border-b border-slate-700">
                  <h2 className="font-semibold text-sm">📋 ТО в ближайшее время — {data.upcoming_maintenance.length} машин</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-slate-700 uppercase">
                        <th className="px-5 py-2 text-left">Машина</th>
                        <th className="px-4 py-2 text-left">Модель</th>
                        <th className="px-4 py-2 text-right">Текущий пробег</th>
                        <th className="px-4 py-2 text-right">До ТО-1</th>
                        <th className="px-4 py-2 text-left">Последнее ТО-1</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcoming_maintenance.map((v: any, i: number) => {
                        const kmLeft = Number(v.km_until_to1);
                        return (
                          <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="px-5 py-2.5 font-mono text-blue-300 font-semibold">{v.vehicle}</td>
                            <td className="px-4 py-2.5 text-slate-300">{v.model || "—"}</td>
                            <td className="px-4 py-2.5 text-right text-slate-300">{fmtKm(v.total_mileage)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={kmLeft <= 500 ? "text-red-400 font-semibold" : "text-yellow-400"}>
                                {fmtKm(kmLeft)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">{fmtDate(v.last_to1_date)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expiring documents */}
            {data.expiring_documents.length > 0 && (
              <div className="bg-slate-800 rounded-xl border border-slate-700">
                <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
                  <h2 className="font-semibold text-sm">📄 Документы истекают — {data.expiring_documents.length} позиций</h2>
                  <Link href="/vehicles" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    Все машины <ChevronRight size={12} />
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-slate-700 uppercase">
                        <th className="px-5 py-2 text-left">Машина</th>
                        <th className="px-4 py-2 text-left">Документ</th>
                        <th className="px-4 py-2 text-left">Истекает</th>
                        <th className="px-4 py-2 text-right">Осталось</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expiring_documents.map((d: any, i: number) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="px-5 py-2.5 font-mono text-blue-300 font-semibold">{d.vehicle}</td>
                          <td className="px-4 py-2.5 text-slate-300">{d.doc_type}</td>
                          <td className="px-4 py-2.5 text-slate-400">{fmtDate(d.expires_at)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${severityColor(d.severity)}`}>
                              {severityDot(d.days_left)} {d.days_left < 0 ? `просрочено ${Math.abs(d.days_left)} дн.` : `${d.days_left} дн.`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
