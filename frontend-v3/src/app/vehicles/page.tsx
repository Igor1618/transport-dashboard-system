"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Truck, Fuel, Settings, Save, ChevronDown, ChevronUp } from "lucide-react";

interface Vehicle {
  id: string;
  license_plate: string;
  model: string;
  internal_number: string | null;
  vehicle_type: string | null;
  fuel_norm_summer: number | null;
  fuel_norm_autumn: number | null;
  fuel_norm_winter: number | null;
}

interface VehicleType {
  id: number;
  name: string;
  fuel_norm_summer: number;
  fuel_norm_autumn: number;
  fuel_norm_winter: number;
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Vehicle>>({});
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vRes, tRes] = await Promise.all([
        fetch("/api/vehicles/list"),
        fetch("/api/vehicles/types")
      ]);
      const vData = await vRes.json();
      const tData = await tRes.json();
      setVehicles(vData.vehicles || []);
      setTypes(tData.types || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const startEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setEditData({
      vehicle_type: v.vehicle_type,
      fuel_norm_summer: v.fuel_norm_summer,
      fuel_norm_autumn: v.fuel_norm_autumn,
      fuel_norm_winter: v.fuel_norm_winter
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await fetch("/api/vehicles/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editData })
      });
      await loadData();
      setEditingId(null);
    } catch (e) { alert("Ошибка сохранения"); }
    setSaving(false);
  };

  const applyTypeNorms = (typeName: string) => {
    const type = types.find(t => t.name === typeName);
    if (type) {
      setEditData({
        ...editData,
        vehicle_type: typeName,
        fuel_norm_summer: type.fuel_norm_summer,
        fuel_norm_autumn: type.fuel_norm_autumn,
        fuel_norm_winter: type.fuel_norm_winter
      });
    } else {
      setEditData({ ...editData, vehicle_type: typeName });
    }
  };

  const filtered = vehicles.filter(v => {
    const matchText = !filter || 
      v.license_plate.toLowerCase().includes(filter.toLowerCase()) ||
      v.model.toLowerCase().includes(filter.toLowerCase()) ||
      (v.internal_number || "").toLowerCase().includes(filter.toLowerCase());
    const matchType = !typeFilter || v.vehicle_type === typeFilter;
    return matchText && matchType;
  });

  const getTypeColor = (type: string | null) => {
    if (!type) return "bg-slate-600";
    if (type === "ФОТОН") return "bg-blue-600";
    if (type === "КамАЗ") return "bg-orange-600";
    if (type === "ШАКМАН") return "bg-purple-600";
    if (type === "ДЖАК") return "bg-green-600";
    return "bg-slate-600";
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/fuel" className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <Truck className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold">Справочник машин</h1>
          <span className="text-slate-400 ml-auto">{vehicles.length} машин</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Фильтры */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Поиск по номеру, модели..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="flex-1 min-w-[200px] bg-slate-800 border border-slate-600 rounded-lg px-4 py-2"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2"
          >
            <option value="">Все типы</option>
            {types.map(t => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
            <option value="">Без типа</option>
          </select>
        </div>

        {/* Типы с нормами */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {types.map(t => (
            <div key={t.id} className={"rounded-lg p-3 " + getTypeColor(t.name)}>
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm opacity-80">
                ☀️{t.fuel_norm_summer} 🍂{t.fuel_norm_autumn} ❄️{t.fuel_norm_winter}
              </div>
              <div className="text-xs opacity-60">{vehicles.filter(v => v.vehicle_type === t.name).length} машин</div>
            </div>
          ))}
        </div>

        {/* Таблица */}
        {loading ? (
          <div className="text-center py-10 text-slate-400">Загрузка...</div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-left p-3">Номер</th>
                  <th className="text-left p-3">Модель</th>
                  <th className="text-left p-3">Тип</th>
                  <th className="text-center p-3">☀️ Лето</th>
                  <th className="text-center p-3">🍂 Осень</th>
                  <th className="text-center p-3">❄️ Зима</th>
                  <th className="text-center p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filtered.map(v => (
                  <tr key={v.id} className="hover:bg-slate-700/30">
                    <td className="p-3">
                      <div className="font-mono text-cyan-400">{v.license_plate}</div>
                      {v.internal_number && <div className="text-xs text-slate-400">#{v.internal_number}</div>}
                    </td>
                    <td className="p-3 text-slate-300">{v.model}</td>
                    <td className="p-3">
                      {editingId === v.id ? (
                        <select
                          value={editData.vehicle_type || ""}
                          onChange={e => applyTypeNorms(e.target.value)}
                          className="bg-slate-700 border border-slate-500 rounded px-2 py-1 text-sm"
                        >
                          <option value="">—</option>
                          {types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                      ) : (
                        <span className={"px-2 py-1 rounded text-xs " + getTypeColor(v.vehicle_type)}>
                          {v.vehicle_type || "—"}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {editingId === v.id ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editData.fuel_norm_summer || ""}
                          onChange={e => setEditData({...editData, fuel_norm_summer: parseFloat(e.target.value) || null})}
                          className="w-16 bg-slate-700 border border-slate-500 rounded px-2 py-1 text-sm text-center"
                          placeholder="—"
                        />
                      ) : (
                        <span className={v.fuel_norm_summer ? "text-yellow-400" : "text-slate-500"}>
                          {v.fuel_norm_summer || "—"}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {editingId === v.id ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editData.fuel_norm_autumn || ""}
                          onChange={e => setEditData({...editData, fuel_norm_autumn: parseFloat(e.target.value) || null})}
                          className="w-16 bg-slate-700 border border-slate-500 rounded px-2 py-1 text-sm text-center"
                          placeholder="—"
                        />
                      ) : (
                        <span className={v.fuel_norm_autumn ? "text-orange-400" : "text-slate-500"}>
                          {v.fuel_norm_autumn || "—"}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {editingId === v.id ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editData.fuel_norm_winter || ""}
                          onChange={e => setEditData({...editData, fuel_norm_winter: parseFloat(e.target.value) || null})}
                          className="w-16 bg-slate-700 border border-slate-500 rounded px-2 py-1 text-sm text-center"
                          placeholder="—"
                        />
                      ) : (
                        <span className={v.fuel_norm_winter ? "text-blue-400" : "text-slate-500"}>
                          {v.fuel_norm_winter || "—"}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {editingId === v.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs"
                          >
                            {saving ? "..." : "✓"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="bg-slate-600 hover:bg-slate-500 px-2 py-1 rounded text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(v)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
