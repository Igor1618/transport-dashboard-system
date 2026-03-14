"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, MapPin, Package, Truck, Calendar, DollarSign, Save, User } from "lucide-react";
import Link from "next/link";

interface Waypoint { sequence_number: number; point_type: string; city: string; address: string; contact_name: string; contact_phone: string; planned_arrival: string; }

export default function NewLogisticsOrder() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Main fields
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [plannedPickup, setPlannedPickup] = useState("");
  const [plannedDelivery, setPlannedDelivery] = useState("");
  const [cargoType, setCargoType] = useState("тент");
  const [cargoDescription, setCargoDescription] = useState("");
  const [cargoWeight, setCargoWeight] = useState<number | "">("");
  const [cargoVolume, setCargoVolume] = useState<number | "">("");
  const [rateAmount, setRateAmount] = useState<number | "">("");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");

  // Customer
  const [customerName, setCustomerName] = useState("");
  const [customerInn, setCustomerInn] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Waypoints
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { sequence_number: 1, point_type: "pickup", city: "", address: "", contact_name: "", contact_phone: "", planned_arrival: "" },
    { sequence_number: 2, point_type: "delivery", city: "", address: "", contact_name: "", contact_phone: "", planned_arrival: "" },
  ]);

  const updateWaypoint = (i: number, field: string, value: string) => {
    const wps = [...waypoints];
    (wps[i] as any)[field] = value;
    setWaypoints(wps);
    // Sync origin/destination
    if (i === 0 && field === "city") setOriginCity(value);
    if (i === 0 && field === "address") setOriginAddress(value);
    if (i === waypoints.length - 1 && field === "city") setDestinationCity(value);
    if (i === waypoints.length - 1 && field === "address") setDestinationAddress(value);
  };

  const addWaypoint = () => {
    const newWp: Waypoint = { sequence_number: waypoints.length + 1, point_type: "waypoint", city: "", address: "", contact_name: "", contact_phone: "", planned_arrival: "" };
    // Insert before last (delivery)
    const wps = [...waypoints];
    wps.splice(wps.length - 1, 0, newWp);
    // Resequence
    wps.forEach((w, i) => w.sequence_number = i + 1);
    setWaypoints(wps);
  };

  const removeWaypoint = (i: number) => {
    if (waypoints.length <= 2) return;
    const wps = waypoints.filter((_, j) => j !== i);
    wps.forEach((w, j) => w.sequence_number = j + 1);
    setWaypoints(wps);
  };

  const handleSave = async () => {
    if (!originCity && !waypoints[0]?.city) { alert("Укажите город погрузки"); return; }
    setSaving(true);
    try {
      const body = {
        vehicle_number: vehicleNumber || null,
        origin_city: originCity || waypoints[0]?.city,
        origin_address: originAddress || waypoints[0]?.address,
        destination_city: destinationCity || waypoints[waypoints.length - 1]?.city,
        destination_address: destinationAddress || waypoints[waypoints.length - 1]?.address,
        planned_pickup_date: plannedPickup || waypoints[0]?.planned_arrival || null,
        planned_delivery_date: plannedDelivery || waypoints[waypoints.length - 1]?.planned_arrival || null,
        cargo_type: cargoType,
        cargo_description: cargoDescription || null,
        cargo_weight_tons: cargoWeight || null,
        cargo_volume_m3: cargoVolume || null,
        rate_amount: rateAmount || null,
        priority,
        notes: notes || null,
        customer_name: customerName || null,
        customer_inn: customerInn || null,
        customer_contact_phone: customerPhone || null,
        waypoints: waypoints.filter(w => w.city || w.address),
      };
      const res = await fetch("/api/logistics/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        router.push(`/logistics/orders/${data.order.id}`);
      } else { alert(data.error || "Ошибка"); }
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  const pointTypeLabels: Record<string, string> = { pickup: "📦 Погрузка", delivery: "📤 Выгрузка", waypoint: "📍 Промежуточная", reload: "🔄 Перегрузка" };

  return (
    <div className="p-4 sm:p-6 max-w-[900px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/logistics/orders" className="p-2 rounded bg-slate-700 hover:bg-slate-600"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-white">Новая заявка на перевозку</h1>
      </div>

      <div className="space-y-4">
        {/* Vehicle + Priority */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
          <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-1"><Truck className="w-4 h-4" /> Машина и приоритет</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Госномер (необязательно)" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            <select value={priority} onChange={e => setPriority(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white">
              <option value="urgent">🔴 Срочно</option>
              <option value="normal">⚪ Обычный</option>
              <option value="low">🔵 Низкий</option>
            </select>
          </div>
        </div>

        {/* Waypoints */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-medium text-slate-400 flex items-center gap-1"><MapPin className="w-4 h-4" /> Маршрут</h2>
            <button onClick={addWaypoint} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded flex items-center gap-1"><Plus className="w-3 h-3" /> Точка</button>
          </div>
          {waypoints.map((wp, i) => (
            <div key={i} className="mb-3 p-3 bg-slate-700/50 rounded-lg border-l-2" style={{ borderLeftColor: wp.point_type === "pickup" ? "#22c55e" : wp.point_type === "delivery" ? "#ef4444" : "#3b82f6" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{pointTypeLabels[wp.point_type] || wp.point_type} #{wp.sequence_number}</span>
                {waypoints.length > 2 && i > 0 && i < waypoints.length - 1 && (
                  <button onClick={() => removeWaypoint(i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /></button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input placeholder="Город" value={wp.city} onChange={e => updateWaypoint(i, "city", e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
                <input placeholder="Адрес" value={wp.address} onChange={e => updateWaypoint(i, "address", e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
                <input placeholder="Контактное лицо" value={wp.contact_name} onChange={e => updateWaypoint(i, "contact_name", e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
                <input placeholder="Телефон" value={wp.contact_phone} onChange={e => updateWaypoint(i, "contact_phone", e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
                <input type="datetime-local" value={wp.planned_arrival} onChange={e => updateWaypoint(i, "planned_arrival", e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
              </div>
            </div>
          ))}
        </div>

        {/* Cargo */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
          <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-1"><Package className="w-4 h-4" /> Груз</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select value={cargoType} onChange={e => setCargoType(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white">
              <option value="тент">Тент</option>
              <option value="изотерм">Изотерм</option>
              <option value="реф">Рефрижератор</option>
              <option value="открытая">Открытая</option>
            </select>
            <input type="number" placeholder="Вес, т" value={cargoWeight} onChange={e => setCargoWeight(e.target.value ? +e.target.value : "")}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            <input type="number" placeholder="Объём, м³" value={cargoVolume} onChange={e => setCargoVolume(e.target.value ? +e.target.value : "")}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            <input placeholder="Описание груза" value={cargoDescription} onChange={e => setCargoDescription(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
          </div>
        </div>

        {/* Customer */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
          <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-1"><User className="w-4 h-4" /> Заказчик (необязательно)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Название компании" value={customerName} onChange={e => setCustomerName(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            <input placeholder="ИНН" value={customerInn} onChange={e => setCustomerInn(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            <input placeholder="Телефон" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
          </div>
        </div>

        {/* Rate */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
          <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-1"><DollarSign className="w-4 h-4" /> Ставка</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="number" placeholder="Ставка, ₽ (необязательно)" value={rateAmount} onChange={e => setRateAmount(e.target.value ? +e.target.value : "")}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
          <h2 className="text-sm font-medium text-slate-400 mb-3">📝 Примечания</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Комментарии для логиста..."
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white resize-none" />
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">
          <Save className="w-5 h-5" /> {saving ? "Сохраняю..." : "Создать заявку"}
        </button>
      </div>
    </div>
  );
}
