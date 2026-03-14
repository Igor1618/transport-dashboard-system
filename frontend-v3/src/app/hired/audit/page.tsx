"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { ArrowLeft, Download, RefreshCw, Save, CheckSquare, Square, AlertTriangle } from "lucide-react";

const r = (path: string, opts?: RequestInit) =>
  fetch("/api/hired" + path, { ...opts, headers: { "Content-Type": "application/json", ...(opts?.headers||{}) } });

const fmtMoney = (v: any) => v == null ? "" : Number(v).toLocaleString("ru-RU") + " ₽";

type AuditItem = {
  trip_id: number; wb_waysheet_id: number|null; wb_trip_id: string;
  route: string; vehicle_plate: string; trip_date: string;
  trip_amount: string; has_penalty: boolean; penalty_amount: string;
  trip_link_id: string|null; carrier_id: string|null; our_price: string|null;
  is_confirmed: boolean|null; carrier_name: string|null;
  detected_carrier_id: string|null; detected_carrier_name: string|null;
};

export default function HiredAuditPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [stats, setStats] = useState({ total: 0, filled: 0, confirmed: 0, total_filtered: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [carriers, setCarriers] = useState<{id:string;name:string}[]>([]);

  // Filters
  const [filterFilled, setFilterFilled] = useState<string>("");
  const [filterConfirmed, setFilterConfirmed] = useState<string>("");
  const [filterCarrier, setFilterCarrier] = useState("");
  const [filterPlate, setFilterPlate] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Edits: trip_id → { our_price, carrier_id }
  const [edits, setEdits] = useState<Record<number, { our_price?: string; carrier_id?: string }>>({});

  // Bulk by plate
  const [bulkPlate, setBulkPlate] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCarrier, setBulkCarrier] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (filterFilled)    params.set("filled", filterFilled);
    if (filterConfirmed) params.set("confirmed", filterConfirmed);
    if (filterCarrier)   params.set("carrier_id", filterCarrier);
    if (filterPlate)     params.set("vehicle_plate", filterPlate);
    if (filterFrom)      params.set("from", filterFrom);
    if (filterTo)        params.set("to", filterTo);
    try {
      const d = await (await r(`/audit?${params}`)).json();
      setItems(d.items || []);
      setStats({ total: d.total, filled: d.filled, confirmed: d.confirmed, total_filtered: d.total_filtered });
    } catch(e) {}
    setLoading(false);
  }, [filterFilled, filterConfirmed, filterCarrier, filterPlate, filterFrom, filterTo]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    r("/carriers").then(x=>x.json()).then(d => setCarriers(Array.isArray(d)?d:[])).catch(()=>{});
  }, []);

  const setEdit = (tripId: number, field: "our_price"|"carrier_id", value: string) => {
    setEdits(prev => ({ ...prev, [tripId]: { ...prev[tripId], [field]: value } }));
  };

  const handleConfirm = async (item: AuditItem, val: boolean) => {
    await r(`/audit/${item.trip_id}/confirm`, { method:"PATCH", body: JSON.stringify({ is_confirmed: val }) });
    setItems(prev => prev.map(i => i.trip_id === item.trip_id ? { ...i, is_confirmed: val } : i));
    setStats(prev => ({ ...prev, confirmed: prev.confirmed + (val ? 1 : -1) }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(edits);
    if (!entries.length) return alert("Нет изменений");
    setSaving(true);
    const payload = entries.map(([trip_id, vals]) => ({
      wb_waysheet_id: parseInt(trip_id),
      ...vals,
      our_price: vals.our_price ? parseFloat(vals.our_price) : undefined,
    }));
    try {
      const d = await (await r("/audit/bulk", { method:"PATCH", body: JSON.stringify({ items: payload }) })).json();
      alert(`✅ Сохранено: создано ${d.created}, обновлено ${d.updated}${d.errors?.length ? `, ошибок: ${d.errors.length}` : ""}`);
      setEdits({});
      loadData();
    } catch(e: any) { alert("Ошибка: " + e.message); }
    setSaving(false);
  };

  const handleBulkByPlate = async () => {
    if (!bulkPlate || !bulkPrice) return alert("Укажите машину и цену");
    const d = await (await r("/audit/bulk-by-plate", {
      method: "PATCH",
      body: JSON.stringify({ vehicle_plate: bulkPlate, carrier_id: bulkCarrier||undefined, our_price: parseFloat(bulkPrice) })
    })).json();
    alert(`✅ Обновлено рейсов: ${d.affected}`);
    setBulkPlate(""); setBulkPrice(""); setBulkCarrier("");
    loadData();
  };

  const pct = (n: number, t: number) => t ? Math.round(n/t*100) : 0;
  const editCount = Object.keys(edits).length;
  const uniquePlates = [...new Set(items.map(i => i.vehicle_plate))].sort();

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/hired" className="text-slate-400 hover:text-white"><ArrowLeft size={20}/></Link>
          <h1 className="text-xl font-bold">🔍 Аудит наёмных рейсов</h1>
          <span className="text-slate-400 text-sm ml-2">{stats.total} рейсов</span>
          <div className="ml-auto flex gap-2">
            <a href="/api/hired/audit/export" className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-slate-300">
              <Download size={14}/> Excel
            </a>
            <button onClick={async () => { await fetch('/api/hired/audit/sync-vps',{method:'POST',headers:{'Content-Type':'application/json','x-user-role':'director'}}); loadData(); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-700 hover:bg-blue-600 rounded border border-blue-600 text-white text-xs">
              🔄 Синк VPS
            </button>
            <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-slate-300">
              <RefreshCw size={14}/> Обновить
            </button>
            {editCount > 0 && (
              <button onClick={handleSaveAll} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 rounded font-medium">
                <Save size={14}/>{saving ? "Сохранение..." : `Сохранить (${editCount})`}
              </button>
            )}
          </div>
        </div>

        {/* Double progress bar */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: "Заполнено (цена)", val: stats.filled, total: stats.total, color: "bg-blue-500" },
            { label: "Подтверждено (документы)", val: stats.confirmed, total: stats.total, color: "bg-green-500" },
          ].map(p => (
            <div key={p.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">{p.label}</span>
                <span className="font-semibold">{p.val}/{p.total} <span className="text-slate-400">({pct(p.val,p.total)}%)</span></span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${p.color} transition-all`} style={{ width: pct(p.val,p.total) + "%" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Статус заполнения</label>
              <select value={filterFilled} onChange={e => setFilterFilled(e.target.value)}
                className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600">
                <option value="">Все</option>
                <option value="false">Не заполнены</option>
                <option value="true">Заполнены</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Подтверждение</label>
              <select value={filterConfirmed} onChange={e => setFilterConfirmed(e.target.value)}
                className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600">
                <option value="">Все</option>
                <option value="false">Не подтверждены</option>
                <option value="true">Подтверждены</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Перевозчик</label>
              <select value={filterCarrier} onChange={e => setFilterCarrier(e.target.value)}
                className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600">
                <option value="">Все</option>
                {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Гос. номер</label>
              <input value={filterPlate} onChange={e => setFilterPlate(e.target.value)} placeholder="А123ВС43"
                className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600 w-28" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Период с</label>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">по</label>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600" />
            </div>
          </div>
        </div>

        {/* Bulk by plate */}
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700 mb-4 flex flex-wrap gap-3 items-end">
          <span className="text-xs text-slate-400 w-full font-medium">Массовая установка цены для машины:</span>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Гос. номер</label>
            <select value={bulkPlate} onChange={e => setBulkPlate(e.target.value)}
              className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600">
              <option value="">Выбрать машину...</option>
              {uniquePlates.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Наша цена, ₽</label>
            <input type="number" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} placeholder="45000"
              className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600 w-32" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Перевозчик</label>
            <select value={bulkCarrier} onChange={e => setBulkCarrier(e.target.value)}
              className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600">
              <option value="">Не указывать</option>
              {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button onClick={handleBulkByPlate}
            className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded font-medium">
            Установить для всех рейсов
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Нет рейсов по фильтрам</div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                  <th className="px-3 py-3 text-center w-10">✓</th>
                  <th className="px-3 py-3 text-left">Рейс WB</th>
                  <th className="px-3 py-3 text-left">Маршрут</th>
                  <th className="px-3 py-3 text-left">Машина</th>
                  <th className="px-3 py-3 text-left">Дата</th>
                  <th className="px-3 py-3 text-right">Сумма WB</th>
                  <th className="px-3 py-3 text-right">Наша цена</th>
                  <th className="px-3 py-3 text-left">Штраф</th>
                  <th className="px-3 py-3 text-left">Перевозчик</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const edit = edits[item.wb_waysheet_id] || {};
                  const ourPrice = edit.our_price ?? (item.our_price ?? "");
                  const carrierId = edit.carrier_id ?? (item.carrier_id ?? item.detected_carrier_id ?? "");
                  const carrierName = carriers.find(c=>c.id===carrierId)?.name || item.carrier_name || item.detected_carrier_name;
                  const isEdited = !!edits[item.wb_waysheet_id];
                  const confirmed = item.is_confirmed;

                  return (
                    <tr key={item.trip_id}
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${isEdited ? "bg-blue-500/5" : ""}`}>
                      {/* Чекбокс подтверждения */}
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleConfirm(item, !confirmed)}
                          title={confirmed ? "Снять подтверждение" : "Подтвердить (документы получены)"}
                          className={confirmed ? "text-green-400 hover:text-green-300" : "text-slate-600 hover:text-slate-400"}>
                          {confirmed ? <CheckSquare size={18}/> : <Square size={18}/>}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-400 font-mono text-xs">{item.wb_trip_id || `#${item.trip_id}`}</td>
                      <td className="px-3 py-2 text-slate-200">
                        <div className="max-w-[280px] truncate" title={item.route}>{item.route}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-blue-300">{item.vehicle_plate}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">
                        {item.trip_date ? new Date(item.trip_date).toLocaleDateString("ru-RU") : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300 font-mono text-xs">
                        {item.trip_amount ? fmtMoney(item.trip_amount) : "—"}
                      </td>
                      {/* Inline price edit */}
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={ourPrice}
                          onChange={e => setEdit(item.wb_waysheet_id, "our_price", e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Tab") {
                              e.preventDefault();
                              const idx = items.findIndex(i => i.trip_id === item.trip_id);
                              const next = items[idx+1];
                              if (next) {
                                const el = document.getElementById(`price-${next.trip_id}`);
                                el?.focus();
                              }
                            }
                          }}
                          id={`price-${item.trip_id}`}
                          placeholder="0"
                          className={`w-28 text-right px-2 py-1 text-xs rounded border focus:outline-none focus:border-blue-400 ${
                            ourPrice ? "bg-slate-700 border-slate-600 text-white" : "bg-amber-500/10 border-amber-500/30 text-amber-300 placeholder-amber-600"
                          }`}
                        />
                      </td>
                      {/* Penalty */}
                      <td className="px-3 py-2 text-xs">
                        {item.has_penalty && Number(item.penalty_amount) > 0
                          ? <span className="text-red-400">{fmtMoney(item.penalty_amount)}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      {/* Carrier select */}
                      <td className="px-2 py-1">
                        {carriers.length > 0 ? (
                          <select
                            value={carrierId}
                            onChange={e => setEdit(item.wb_waysheet_id, "carrier_id", e.target.value)}
                            className={`text-xs px-2 py-1 rounded border max-w-[160px] focus:outline-none focus:border-blue-400 ${
                              carrierId ? "bg-slate-700 border-slate-600 text-white" : "bg-slate-800 border-slate-600 text-slate-500"
                            }`}>
                            <option value="">Не определён</option>
                            {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {carrierName || <span className="text-amber-500 flex items-center gap-1"><AlertTriangle size={12}/>Нет перевозчиков</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {stats.total_filtered > 200 && (
          <p className="text-center text-slate-500 text-sm mt-3">Показано первые 200 записей. Используйте фильтры для уточнения.</p>
        )}
      </div>
    </div>
  );
}
