"use client";
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Check, X, RefreshCw, User } from "lucide-react";

interface Driver { name: string; is_ours: boolean; }
interface PlateEntry {
  input_plate: string; report_count: number; total_km: number; last_seen: string;
  score: number; verdict: string; match_plate: string | null; match_vehicle_id: string | null;
  drivers: Driver[];
  alias: { status: string; vehicle_plate: string } | null;
}

const verdictColor = (v: string) => v === "наша" ? "text-green-400" : v === "вероятно" ? "text-yellow-400" : "text-slate-400";
const scoreBar = (s: number) => {
  const color = s >= 70 ? "bg-green-500" : s >= 40 ? "bg-yellow-500" : "bg-slate-600";
  return <div className="flex items-center gap-1.5"><div className={`h-1.5 rounded ${color}`} style={{width: `${Math.round(s*0.6)}px`}} /><span className="text-xs text-slate-400">{s}/100</span></div>;
};

export default function UnknownPlatesPage() {
  const [plates, setPlates] = useState<PlateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all");
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/reports/unknown-plates", { headers: { "x-user-role": localStorage.getItem("userRole") || "director" } });
      const d = await r.json();
      setPlates(d.plates || []); setTotal(d.total || 0);
    } catch(e) {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const confirmAlias = async (p: PlateEntry, status: "confirmed"|"rejected") => {
    setProcessing(prev => ({ ...prev, [p.input_plate]: true }));
    try {
      await fetch("/api/reports/plate-alias", { method: "POST", headers: { "Content-Type": "application/json", "x-user-role": localStorage.getItem("userRole") || "director" },
        body: JSON.stringify({ input_plate: p.input_plate, vehicle_id: p.match_vehicle_id, vehicle_plate: p.match_plate, status, confirmed_by: localStorage.getItem("userName") || "dispatcher" }) });
      setDone(d => ({ ...d, [p.input_plate]: status }));
    } catch(e) {}
    setProcessing(prev => ({ ...prev, [p.input_plate]: false }));
  };

  const filtered = plates.filter(p => !done[p.input_plate] && !p.alias &&
    (filter === "all" || (filter === "ours" && p.score >= 70) || (filter === "maybe" && p.score >= 40 && p.score < 70) || (filter === "hired" && p.score < 40)));

  const oursCount = plates.filter(p => p.score >= 70 && !p.alias && !done[p.input_plate]).length;
  const maybeCount = plates.filter(p => p.score >= 40 && p.score < 70 && !p.alias && !done[p.input_plate]).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><AlertTriangle className="text-orange-400" size={20} /> Неопознанные номера машин</h1>
            <p className="text-sm text-slate-400 mt-0.5">Номера из отчётов, не найденные в базе ТС. Пробег по ним не учитывается.</p>
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[{v:total,l:"Всего в списке",c:"text-white"},{v:oursCount,l:"🟢 Наши (≥70/100)",c:"text-green-400"},{v:maybeCount,l:"🟡 Спросить (40–69)",c:"text-yellow-400"}].map((s,i)=>(
            <div key={i} className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center"><div className={`text-2xl font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-slate-400">{s.l}</div></div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {[{v:"all",l:"Все"},{v:"ours",l:"🟢 Наши (≥70)"},{v:"maybe",l:"🟡 Уточнить (40–69)"},{v:"hired",l:"⬜ Наёмные (<40)"}].map(f=>(
            <button key={f.v} onClick={()=>setFilter(f.v)} className={`px-3 py-1.5 rounded text-sm ${filter===f.v?"bg-blue-600 text-white":"bg-slate-800 text-slate-400 hover:text-white border border-slate-700"}`}>{f.l}</button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-slate-500 py-12"><RefreshCw size={32} className="animate-spin mx-auto mb-3" /><p>Загрузка и расчёт оценок...</p></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-12 bg-slate-800 rounded-xl border border-slate-700"><Check size={48} className="mx-auto mb-3 text-green-600" /><p>В этой категории нет неопознанных номеров</p></div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
            <table className="w-full text-sm"><thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                <th className="px-4 py-3 text-left">Номер</th>
                <th className="px-3 py-3 text-right">Отч.</th>
                <th className="px-3 py-3 text-right">Км</th>
                <th className="px-3 py-3 text-left">Оценка</th>
                <th className="px-3 py-3 text-left">Похожа на</th>
                <th className="px-3 py-3 text-left">Водители</th>
                <th className="px-3 py-3 text-center">Действие</th>
              </tr></thead><tbody>
              {filtered.map(p => {
                const hasOurDriver = p.drivers?.some(d => d.is_ours);
                return (
                <tr key={p.input_plate} className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${hasOurDriver ? "bg-green-900/10" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-white">{p.input_plate}</div>
                    {p.last_seen && <div className="text-xs text-slate-500">Посл.: {new Date(p.last_seen).toLocaleDateString("ru")}</div>}
                    {hasOurDriver && <div className="text-xs text-green-400 mt-0.5">✅ наш водитель</div>}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-400">{p.report_count}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-300">{(p.total_km||0).toLocaleString("ru")}</td>
                  <td className="px-3 py-3">
                    <div className={`text-xs font-semibold ${verdictColor(p.verdict)}`}>{p.verdict}</div>
                    {scoreBar(p.score)}
                  </td>
                  <td className="px-3 py-3">{p.match_plate ? <span className="font-mono text-blue-300">{p.match_plate}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="px-3 py-3">
                    {p.drivers && p.drivers.length > 0 ? (
                      <div className="space-y-0.5">
                        {p.drivers.slice(0,3).map((d,i) => (
                          <div key={i} className="flex items-center gap-1 text-xs">
                            <User size={10} className={d.is_ours ? "text-green-400" : "text-slate-500"} />
                            <span className={d.is_ours ? "text-green-300" : "text-slate-400"}>
                              {d.name.split(' ').slice(0,2).join(' ')}
                            </span>
                            {d.is_ours && <span className="text-green-500">✓</span>}
                          </div>
                        ))}
                        {p.drivers.length > 3 && <div className="text-xs text-slate-600">+{p.drivers.length-3}</div>}
                      </div>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center gap-1.5 justify-center">
                      {p.match_plate && (
                        <button onClick={()=>confirmAlias(p,"confirmed")} disabled={processing[p.input_plate]}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-green-700/50 hover:bg-green-600/60 text-green-300 text-xs disabled:opacity-50">
                          <Check size={12}/> = {p.match_plate}
                        </button>
                      )}
                      <button onClick={()=>confirmAlias(p,"rejected")} disabled={processing[p.input_plate]}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs disabled:opacity-50">
                        <X size={12}/> Наёмная
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody></table>
          </div>
        )}
        {Object.keys(done).length > 0 && (
          <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-3 text-sm text-green-300">
            ✅ Обработано в этой сессии: {Object.keys(done).length} номеров
          </div>
        )}
      </div>
    </div>
  );
}
