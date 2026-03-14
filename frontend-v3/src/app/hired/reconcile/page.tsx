"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Search, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

type Stats = { total: string; marked_hired: string; marked_own: string; exact_own: string; unique_plates: string; aliases_count: string };
type Summary = { total: number; own: number; hired: number; review: number; fixed: number };
type ReviewItem = { wb_waysheet_id: number; vehicle_number: string; driver_name: string | null; suggestion: string | null; confidence: string };

export default function ReconcilePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ summary: Summary; review_items: ReviewItem[]; dry_run: boolean } | null>(null);
  const [decisions, setDecisions] = useState<Record<number, "own" | "hired">>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/hired/reconcile/stats")
      .then(r => r.json())
      .then(d => { if (!d.error) setStats(d); })
      .catch(() => {});
  }, []);

  const loadStats = () => {
    fetch("/api/hired/reconcile/stats").then(r => r.json()).then(d => { if (!d.error) setStats(d); }).catch(() => {});
  };

  const runDry = async () => {
    setRunning(true);
    setResult(null);
    setDecisions({});
    try {
      const resp = await fetch("/api/hired/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: true }),
      });
      const d = await resp.json();
      if (d.error) throw new Error(d.error);
      setResult(d);
      // По умолчанию все review → hired (неизвестная машина = внешняя)
      const dec: Record<number, "own" | "hired"> = {};
      (d.review_items || []).forEach((r: ReviewItem) => {
        if (r.wb_waysheet_id != null) dec[r.wb_waysheet_id] = "hired";
      });
      setDecisions(dec);
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    }
    setRunning(false);
  };

  const applyReconcile = async () => {
    if (!result) return;
    if (!confirm(`Применить рекончиляцию?\n\nБудет исправлено ${result.summary.fixed} записей.\nТекущее состояние сохранено в бэкапе.`)) return;
    setApplying(true);
    try {
      const resp = await fetch("/api/hired/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: false }),
      });
      const d = await resp.json();
      if (d.error) throw new Error(d.error);
      alert(`✅ Применено!\nНаших: ${d.summary.own}\nНаёмных: ${d.summary.hired}\nНа проверке: ${d.summary.review}\nИсправлено: ${d.summary.fixed}`);
      setResult(d);
      loadStats();
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    }
    setApplying(false);
  };

  const saveDecisions = async () => {
    const items = Object.entries(decisions).map(([id, decision]) => ({
      wb_waysheet_id: parseInt(id),
      decision,
    }));
    if (!items.length) return;
    setSaving(true);
    try {
      const resp = await fetch("/api/hired/reconcile/resolve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const d = await resp.json();
      if (d.error) throw new Error(d.error);
      const aliasMsg = d.aliases_created?.length
        ? `\n📌 Создано алиасов: ${d.aliases_created.length}\n${d.aliases_created.map((a: any) => `${a.input_plate} → ${a.mapped_to}`).join('\n')}`
        : '';
      alert(`✅ Решения сохранены (${d.resolved} записей)${aliasMsg}`);
      loadStats();
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    }
    setSaving(false);
  };

  // Дедупликация review_items по vehicle_number — показываем по одному на уникальный номер
  const uniqueReviewPlates: ReviewItem[] = [];
  if (result?.review_items) {
    const seen = new Set<string>();
    for (const item of result.review_items) {
      const plate = item.vehicle_number || "";
      if (!seen.has(plate)) {
        seen.add(plate);
        uniqueReviewPlates.push(item);
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/hired" className="text-slate-400 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">⚡ Рекончиляция рейсов WB</h1>
        </div>

        {/* Info */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-300">
          <p className="font-medium mb-1">Что это делает</p>
          <p className="text-blue-300/70">
            Сравнивает номера машин из WB с нашим парком с учётом ошибок: латиница↔кириллица, пробелы, опечатки (d≤1 = наш, d=2 = на проверку).
            Rollback текущего is_hired сохранён в бэкапе автоматически.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              { label: "Всего рейсов", value: stats.total, color: "text-white" },
              { label: "Уникальных номеров", value: stats.unique_plates, color: "text-slate-300" },
              { label: "Точно наши (exact)", value: stats.exact_own, color: "text-green-400" },
              { label: "Помечено наёмными", value: stats.marked_hired, color: "text-red-400" },
              { label: "Алиасов в справочнике", value: stats.aliases_count, color: "text-blue-400" },
            ] as const).map(c => (
              <div key={c.label} className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
                <div className={"text-2xl font-bold " + c.color}>{c.value}</div>
                <div className="text-slate-500 text-xs mt-1">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={runDry}
              disabled={running}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg font-medium"
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {running ? "Анализ..." : "🔍 Пробный запуск (dry-run)"}
            </button>

            {result && (
              <button
                onClick={applyReconcile}
                disabled={applying}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
              >
                {applying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {applying ? "Применение..." : "✅ Применить (исправить " + result.summary.fixed + ")"}
              </button>
            )}
          </div>

          {/* Result summary */}
          {result && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                { label: "Наши машины", value: result.summary.own, color: "text-green-400", icon: "✅" },
                { label: "Наёмные", value: result.summary.hired, color: "text-blue-400", icon: "🚛" },
                { label: "На проверку", value: result.summary.review, color: "text-yellow-400", icon: "⚠️" },
                { label: "Будет исправлено", value: result.summary.fixed, color: "text-orange-400", icon: "🔄" },
              ] as const).map(c => (
                <div key={c.label} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                  <div className={"text-2xl font-bold " + c.color}>{c.icon} {c.value}</div>
                  <div className="text-slate-500 text-xs mt-1">{c.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review items */}
        {result && uniqueReviewPlates.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-yellow-400" />
                <h2 className="font-semibold text-sm">
                  ⚠️ Требуют решения — {uniqueReviewPlates.length} уникальных номеров ({result.review_items.length} рейсов)
                </h2>
              </div>
              <button
                onClick={saveDecisions}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded font-medium"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                {saving ? "Сохранение..." : "Сохранить решения"}
              </button>
            </div>
            <p className="px-5 py-2 text-xs text-slate-500 border-b border-slate-700/50">
              По умолчанию все неизвестные помечены как «Наёмный». При выборе «Наш» — номер добавляется в справочник и следующий раз определится автоматически.
            </p>
            <div className="divide-y divide-slate-700/50 max-h-[500px] overflow-y-auto">
              {uniqueReviewPlates.map(item => {
                const key = item.wb_waysheet_id;
                const decision = decisions[key] || "hired";
                return (
                  <div key={String(item.vehicle_number)} className="flex items-center justify-between px-5 py-3 hover:bg-slate-700/20">
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-sm font-semibold text-yellow-300">{item.vehicle_number || "—"}</span>
                      {item.driver_name && (
                        <span className="text-slate-400 text-xs ml-3">{item.driver_name}</span>
                      )}
                      {item.suggestion && (
                        <p className="text-slate-500 text-xs mt-0.5">{item.suggestion}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => setDecisions(p => ({ ...p, [key]: "own" }))}
                        className={"px-3 py-1.5 text-xs rounded border font-medium transition-colors " + (
                          decision === "own"
                            ? "bg-green-600 border-green-500 text-white"
                            : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                        )}
                      >
                        ✅ Наш
                      </button>
                      <button
                        onClick={() => setDecisions(p => ({ ...p, [key]: "hired" }))}
                        className={"px-3 py-1.5 text-xs rounded border font-medium transition-colors " + (
                          decision === "hired"
                            ? "bg-blue-600 border-blue-500 text-white"
                            : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                        )}
                      >
                        🚛 Наёмный
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {result && result.review_items.length === 0 && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3 text-green-400">
            <CheckCircle size={20} />
            <span>Все рейсы определены автоматически — ручная проверка не нужна!</span>
          </div>
        )}
      </div>
    </div>
  );
}
