"use client";
import { useState, useCallback } from "react";
import ExcelExport from "@/components/ExcelExport";
import { ArrowLeft, RefreshCw, Plus, Package, AlertTriangle, Search, Edit, Trash2, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/shared/utils/apiFetch";
import { usePolling } from "@/shared/hooks/usePolling";

const CATEGORIES: Record<string, string> = {
  engine: "Двигатель", brakes: "Тормоза", tires: "Шины", filters: "Фильтры",
  oils: "Масла/жидкости", electrical: "Электрика", body: "Кузов",
  suspension: "Подвеска", transmission: "Трансмиссия", other: "Прочее",
};

export default function PartsPage() {
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", part_number: "", category: "other", unit: "шт", price: "", quantity_in_stock: "0", min_stock: "0", supplier: "" });
  const [movementPart, setMovementPart] = useState<any>(null);
  const [movForm, setMovForm] = useState({ type: "in", quantity: "", notes: "" });

  const fetchParts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (catFilter) params.set("category", catFilter);
    if (lowOnly) params.set("low_stock", "true");
    try {
      const r = await apiFetch(`/api/parts?${params}`);
      if (r.ok) setParts(await r.json());
    } catch {}
    setLoading(false);
  }, [search, catFilter, lowOnly]);

  usePolling(fetchParts, 60000, [fetchParts]);

  const handleSave = async () => {
    const body = { ...form, price: parseFloat(form.price), quantity_in_stock: parseInt(form.quantity_in_stock), min_stock: parseInt(form.min_stock) };
    if (!body.name || isNaN(body.price)) return alert("Название и цена обязательны");
    const url = editId ? `/api/parts/${editId}` : "/api/parts";
    const method = editId ? "PATCH" : "POST";
    const r = await apiFetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
    if (r.ok) { setShowForm(false); setEditId(null); fetchParts(); }
  };

  const handleMovement = async () => {
    if (!movForm.quantity || parseInt(movForm.quantity) <= 0) return alert("Укажите количество");
    const r = await apiFetch(`/api/parts/${movementPart.id}/movement`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ movement_type: movForm.type, quantity: parseInt(movForm.quantity), notes: movForm.notes || null })
    });
    if (r.ok) { setMovementPart(null); fetchParts(); }
  };

  const lowStockCount = parts.filter(p => p.low_stock).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/maintenance" className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-lg font-bold">📦 Склад запчастей</h1>
        <span className="text-sm text-slate-400">{parts.length} позиций</span>
        {lowStockCount > 0 && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">⚠️ {lowStockCount} на исходе</span>}
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name:"", part_number:"", category:"other", unit:"шт", price:"", quantity_in_stock:"0", min_stock:"0", supplier:"" }); }}
            className="px-3 py-1.5 text-xs bg-blue-600 rounded hover:bg-blue-500 flex items-center gap-1"><Plus className="w-3 h-3" /> Добавить</button>
          <button onClick={fetchParts} className="p-1.5 rounded hover:bg-slate-700"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>

      <div className="p-4 max-w-6xl mx-auto">
        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-slate-800 rounded pl-10 pr-3 py-2 text-sm w-full border border-slate-700" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="bg-slate-800 rounded px-3 py-2 text-sm border border-slate-700">
            <option value="">Все категории</option>
            {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => setLowOnly(!lowOnly)}
            className={`px-3 py-2 rounded text-xs ${lowOnly ? 'bg-red-600' : 'bg-slate-800 border border-slate-700'}`}>
            <AlertTriangle className="w-3 h-3 inline mr-1" />На исходе
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-slate-800 rounded-lg p-4 mb-4 space-y-3">
            <h3 className="font-semibold">{editId ? "Редактировать" : "Новая запчасть"}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input placeholder="Название *" value={form.name} onChange={e => setForm({...form, name:e.target.value})} className="bg-slate-700 rounded px-3 py-2 text-sm col-span-2" />
              <input placeholder="Артикул" value={form.part_number} onChange={e => setForm({...form, part_number:e.target.value})} className="bg-slate-700 rounded px-3 py-2 text-sm" />
              <select value={form.category} onChange={e => setForm({...form, category:e.target.value})} className="bg-slate-700 rounded px-3 py-2 text-sm">
                {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input placeholder="Цена *" value={form.price} onChange={e => setForm({...form, price:e.target.value})} className="bg-slate-700 rounded px-3 py-2 text-sm" type="number" />
              <select value={form.unit} onChange={e => setForm({...form, unit:e.target.value})} className="bg-slate-700 rounded px-3 py-2 text-sm">
                <option value="шт">шт</option><option value="л">л</option><option value="кг">кг</option><option value="м">м</option>
              </select>
              <input placeholder="Остаток" value={form.quantity_in_stock} onChange={e => setForm({...form, quantity_in_stock:e.target.value})} className="bg-slate-700 rounded px-3 py-2 text-sm" type="number" />
              <input placeholder="Мин. запас" value={form.min_stock} onChange={e => setForm({...form, min_stock:e.target.value})} className="bg-slate-700 rounded px-3 py-2 text-sm" type="number" />
              <input placeholder="Поставщик" value={form.supplier} onChange={e => setForm({...form, supplier:e.target.value})} className="bg-slate-700 rounded px-3 py-2 text-sm col-span-2" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="px-4 py-2 bg-green-600 rounded text-sm hover:bg-green-500">{editId ? "Сохранить" : "Создать"}</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-700 rounded text-sm">Отмена</button>
            </div>
          </div>
        )}

        {/* Movement dialog */}
        {movementPart && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setMovementPart(null)}>
            <div className="bg-slate-800 rounded-lg p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold mb-3">📦 Движение: {movementPart.name}</h3>
              <p className="text-sm text-slate-400 mb-3">Текущий остаток: {movementPart.quantity_in_stock} {movementPart.unit}</p>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={() => setMovForm({...movForm, type:'in'})} className={`flex-1 py-2 rounded text-sm ${movForm.type==='in' ? 'bg-green-600' : 'bg-slate-700'}`}>⬆️ Приход</button>
                  <button onClick={() => setMovForm({...movForm, type:'out'})} className={`flex-1 py-2 rounded text-sm ${movForm.type==='out' ? 'bg-red-600' : 'bg-slate-700'}`}>⬇️ Расход</button>
                </div>
                <input placeholder="Количество" value={movForm.quantity} onChange={e => setMovForm({...movForm, quantity:e.target.value})} className="bg-slate-700 rounded px-3 py-2 text-sm w-full" type="number" />
                <input placeholder="Примечание" value={movForm.notes} onChange={e => setMovForm({...movForm, notes:e.target.value})} className="bg-slate-700 rounded px-3 py-2 text-sm w-full" />
                <div className="flex gap-2">
                  <button onClick={handleMovement} className="px-4 py-2 bg-blue-600 rounded text-sm flex-1">Провести</button>
                  <button onClick={() => setMovementPart(null)} className="px-4 py-2 bg-slate-700 rounded text-sm">Отмена</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Parts table */}
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-slate-400">Название</th>
                  <th className="px-3 py-2 text-left text-xs text-slate-400">Артикул</th>
                  <th className="px-3 py-2 text-left text-xs text-slate-400">Категория</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-400">Цена</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-400">Остаток</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-400">Использовано</th>
                  <th className="px-3 py-2 text-xs text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {parts.map(p => (
                  <tr key={p.id} className={p.low_stock ? 'bg-red-900/10' : ''}>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{p.name}</div>
                      {p.supplier && <div className="text-xs text-slate-500">{p.supplier}</div>}
                    </td>
                    <td className="px-3 py-2 text-slate-400 font-mono text-xs">{p.part_number || '—'}</td>
                    <td className="px-3 py-2 text-xs">{CATEGORIES[p.category] || p.category}</td>
                    <td className="px-3 py-2 text-right">{Number(p.price).toLocaleString('ru-RU')}₽/{p.unit}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={p.low_stock ? 'text-red-400 font-bold' : ''}>{p.quantity_in_stock}</span>
                      {p.low_stock && <AlertTriangle className="w-3 h-3 inline ml-1 text-red-400" />}
                      <div className="text-xs text-slate-500">мин: {p.min_stock}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">{p.total_used}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setMovementPart(p); setMovForm({type:'in',quantity:'',notes:''}); }}
                          className="p-1 hover:bg-slate-700 rounded" title="Движение"><ArrowUpDown className="w-4 h-4" /></button>
                        <button onClick={() => { setEditId(p.id); setForm({name:p.name,part_number:p.part_number||'',category:p.category,unit:p.unit,price:String(p.price),quantity_in_stock:String(p.quantity_in_stock),min_stock:String(p.min_stock),supplier:p.supplier||''}); setShowForm(true); }}
                          className="p-1 hover:bg-slate-700 rounded" title="Редактировать"><Edit className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parts.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-500">Нет запчастей. Нажмите "Добавить" для создания.</div>
          )}
        </div>
      </div>
    </div>
  );
}
