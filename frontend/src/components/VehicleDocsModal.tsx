import React, { useState, useEffect } from "react";
import { X, Save, Truck, FileText, User, Phone } from "lucide-react";

interface VehicleData {
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

interface Props {
  vehicleId: string;
  onClose: () => void;
}

const VehicleDocsModal: React.FC<Props> = ({ vehicleId, onClose }) => {
  const [data, setData] = useState<VehicleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [vehicleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/vehicles/docs/${vehicleId}`);
      if (!res.ok) throw new Error("Не удалось загрузить данные");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/vehicles/docs/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sts_number: data.sts_number,
          sts_date: data.sts_date,
          pts_number: data.pts_number,
          vin: data.vin,
          year: data.year,
          owner: data.owner,
          color: data.color,
          notes: data.notes,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof VehicleData, value: any) => {
    if (data) setData({ ...data, [field]: value });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p className="text-red-600">{error || "Машина не найдена"}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded">Закрыть</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-indigo-600 text-white p-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck size={24} />
            <div>
              <h2 className="text-xl font-bold">{data.license_plate}</h2>
              <p className="text-indigo-200 text-sm">{data.model}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 text-sm">{error}</div>
        )}

        <div className="p-6 space-y-6">
          {/* Документы */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={20} className="text-indigo-600" />
              Документы
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Номер СТС</label>
                <input
                  type="text"
                  value={data.sts_number || ""}
                  onChange={e => updateField("sts_number", e.target.value)}
                  placeholder="00 00 000000"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата выдачи СТС</label>
                <input
                  type="date"
                  value={data.sts_date || ""}
                  onChange={e => updateField("sts_date", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Номер ПТС</label>
                <input
                  type="text"
                  value={data.pts_number || ""}
                  onChange={e => updateField("pts_number", e.target.value)}
                  placeholder="00 00 000000"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
                <input
                  type="text"
                  value={data.vin || ""}
                  onChange={e => updateField("vin", e.target.value.toUpperCase())}
                  placeholder="XTA00000000000000"
                  maxLength={17}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Характеристики */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Truck size={20} className="text-indigo-600" />
              Характеристики
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Год выпуска</label>
                <input
                  type="number"
                  value={data.year || ""}
                  onChange={e => updateField("year", parseInt(e.target.value) || null)}
                  placeholder="2024"
                  min={1990}
                  max={2030}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
                <input
                  type="text"
                  value={data.color || ""}
                  onChange={e => updateField("color", e.target.value)}
                  placeholder="Белый"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Владелец</label>
                <input
                  type="text"
                  value={data.owner || ""}
                  onChange={e => updateField("owner", e.target.value)}
                  placeholder="ООО Компания"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Текущий водитель */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User size={20} className="text-indigo-600" />
              Текущий водитель
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              {data.current_driver ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{data.current_driver}</p>
                    {data.driver_phone && (
                      <a href={`tel:${data.driver_phone}`} className="text-indigo-600 flex items-center gap-1 mt-1">
                        <Phone size={14} />
                        {data.driver_phone}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Водитель не назначен</p>
              )}
            </div>
          </div>

          {/* Заметки */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
            <textarea
              value={data.notes || ""}
              onChange={e => updateField("notes", e.target.value)}
              rows={3}
              placeholder="Дополнительная информация..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
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
    </div>
  );
};

export default VehicleDocsModal;
