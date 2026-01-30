import React, { useState, useEffect } from "react";
import { Search, Truck, FileText, Save, User, Phone, ChevronDown, ChevronUp } from "lucide-react";

interface Vehicle {
  id: string;
  license_plate: string;
  model: string;
  sts_number?: string;
  sts_date?: string;
  pts_number?: string;
  vin?: string;
  year?: number;
  owner?: string;
  color?: string;
  notes?: string;
  current_driver?: string;
  driver_phone?: string;
}

const DocsPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filtered, setFiltered] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Vehicle>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    if (search) {
      setFiltered(vehicles.filter(v => 
        v.id.toLowerCase().includes(search.toLowerCase()) ||
        v.license_plate.toLowerCase().includes(search.toLowerCase()) ||
        v.model.toLowerCase().includes(search.toLowerCase())
      ));
    } else {
      setFiltered(vehicles);
    }
  }, [search, vehicles]);

  const loadVehicles = async () => {
    try {
      const res = await fetch("/rest/v1/vehicles?order=license_plate.asc");
      const data = await res.json();
      setVehicles(data);
      setFiltered(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      setEditData({});
    } else {
      const v = vehicles.find(x => x.id === id);
      setExpanded(id);
      setEditData(v || {});
    }
  };

  const handleSave = async () => {
    if (!expanded) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/docs/${expanded}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData)
      });
      if (res.ok) {
        await loadVehicles();
        setExpanded(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📄 Документы ТС</h1>
        <p className="text-gray-600 mt-1">СТС, ПТС, данные машин и водителей</p>
      </div>

      {/* Поиск */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по номеру, модели..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Всего машин</p>
          <p className="text-2xl font-bold">{vehicles.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">С СТС</p>
          <p className="text-2xl font-bold text-green-600">{vehicles.filter(v => v.sts_number).length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">С ПТС</p>
          <p className="text-2xl font-bold text-blue-600">{vehicles.filter(v => v.pts_number).length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Без документов</p>
          <p className="text-2xl font-bold text-red-600">{vehicles.filter(v => !v.sts_number && !v.pts_number).length}</p>
        </div>
      </div>

      {/* Список машин */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => (
            <div key={v.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Заголовок */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => handleExpand(v.id)}
              >
                <div className="flex items-center gap-4">
                  <Truck className="text-indigo-600" size={24} />
                  <div>
                    <p className="font-bold text-gray-900">{v.license_plate}</p>
                    <p className="text-sm text-gray-500">{v.model}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex gap-2">
                    {v.sts_number && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">СТС ✓</span>}
                    {v.pts_number && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">ПТС ✓</span>}
                    {!v.sts_number && !v.pts_number && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">Нет документов</span>}
                  </div>
                  {expanded === v.id ? <ChevronUp /> : <ChevronDown />}
                </div>
              </div>

              {/* Форма редактирования */}
              {expanded === v.id && (
                <div className="border-t p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Номер СТС</label>
                      <input
                        type="text"
                        value={editData.sts_number || ""}
                        onChange={e => updateField("sts_number", e.target.value)}
                        placeholder="00 00 000000"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Дата СТС</label>
                      <input
                        type="date"
                        value={editData.sts_date || ""}
                        onChange={e => updateField("sts_date", e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Номер ПТС</label>
                      <input
                        type="text"
                        value={editData.pts_number || ""}
                        onChange={e => updateField("pts_number", e.target.value)}
                        placeholder="00 00 000000"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
                      <input
                        type="text"
                        value={editData.vin || ""}
                        onChange={e => updateField("vin", e.target.value.toUpperCase())}
                        placeholder="XTA00000000000000"
                        maxLength={17}
                        className="w-full px-3 py-2 border rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Год выпуска</label>
                      <input
                        type="number"
                        value={editData.year || ""}
                        onChange={e => updateField("year", parseInt(e.target.value) || null)}
                        placeholder="2024"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
                      <input
                        type="text"
                        value={editData.color || ""}
                        onChange={e => updateField("color", e.target.value)}
                        placeholder="Белый"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Владелец</label>
                      <input
                        type="text"
                        value={editData.owner || ""}
                        onChange={e => updateField("owner", e.target.value)}
                        placeholder="ООО Компания"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
                      <textarea
                        value={editData.notes || ""}
                        onChange={e => updateField("notes", e.target.value)}
                        rows={2}
                        placeholder="Дополнительная информация..."
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setExpanded(null)}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save size={18} />
                      {saving ? "Сохранение..." : "Сохранить"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocsPage;
