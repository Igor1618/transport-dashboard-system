"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck, Save, Loader2, FileText, Fuel, User, History, Wrench, CreditCard } from "lucide-react";

interface Vehicle {
  id: string;
  license_plate: string;
  normalized_number: string;
  model: string;
  brand: string;
  internal_number: string;
  vehicle_type: string;
  year: number;
  vin: string;
  color: string;
  owner: string;
  status: string;
  current_driver: string;
  fuel_norm_summer: number;
  fuel_norm_autumn: number;
  fuel_norm_winter: number;
  sts_number: string;
  sts_date: string;
  sts_issued_by: string;
  pts_number: string;
  pts_date: string;
  pts_issued_by: string;
  osago_number: string;
  osago_expires: string;
  diagnostics_number: string;
  diagnostics_expires: string;
  tachograph_number: string;
  tachograph_expires: string;
  notes: string;
}

interface VehicleType { id: number; name: string; fuel_norm_summer: number; fuel_norm_autumn: number; fuel_norm_winter: number; }

const TABS = [
  { id: "main", label: "Основное", icon: Truck },
  { id: "docs", label: "Документы", icon: FileText },
  { id: "fuel", label: "Топливо", icon: Fuel },
  { id: "drivers", label: "Водители", icon: User },
  { id: "maintenance", label: "Обслуживание", icon: Wrench },
  { id: "history", label: "История", icon: History },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Активна", color: "bg-green-600" },
  { value: "repair", label: "На ремонте", color: "bg-yellow-600" },
  { value: "decommissioned", label: "Списана", color: "bg-red-600" },
];

export default function VehicleEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === "new";
  
  const [vehicle, setVehicle] = useState<Partial<Vehicle>>({});
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("main");
  
  const [drivers, setDrivers] = useState<any[]>([]);
  const [fuelStats, setFuelStats] = useState<any>({ by_source: [], total: { liters: 0, amount: 0 } });
  const [cards, setCards] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [gpsMileage, setGpsMileage] = useState<{days: {date: string; km: number}[]; total: number; error?: string}>({ days: [], total: 0 });
  const [currentState, setCurrentState] = useState<{fuelLevel: {level: number|null; hasSensor: boolean; message?: string}; lastTransactions: any[]}>({ fuelLevel: { level: null, hasSensor: false }, lastTransactions: [] });
  const [cardTransactions, setCardTransactions] = useState<Record<string, any[]>>({});
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [allCards, setAllCards] = useState<any[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardSearch, setCardSearch] = useState("");

  useEffect(() => {
    loadTypes();
    if (!isNew) {
      loadVehicle();
      loadGpsMileage();
    }
  }, [id]);
  
  const loadGpsMileage = async () => {
    try {
      const res = await fetch(`/api/vehicles/${id}/gps-mileage?days=7`);
      const data = await res.json();
      setGpsMileage(data);
    } catch (e) { console.error(e); }
  };
  
  const loadCurrentState = async () => {
    try {
      const res = await fetch(`/api/vehicles/${id}/current-state`);
      const data = await res.json();
      setCurrentState(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!isNew && vehicle.id) {
      loadCurrentState();
      if (activeTab === "drivers") loadDrivers();
      if (activeTab === "fuel") loadFuel();
      if (activeTab === "history") loadHistory();
      if (activeTab === "maintenance") loadMaintenance();
    }
  }, [activeTab, vehicle.id]);

  const loadTypes = async () => {
    const res = await fetch("/api/vehicles/types");
    const data = await res.json();
    setTypes(data.types || []);
  };

  const loadVehicle = async () => {
    setLoading(true);
    const res = await fetch(`/api/vehicles/${id}`);
    const data = await res.json();
    const v = data.vehicle || {}; ["sts_date", "pts_date", "osago_expires", "diagnostics_expires", "tachograph_expires"].forEach(k => { if (v[k]) v[k] = v[k].split("T")[0]; }); setVehicle(v);
    setLoading(false);
  };

  const loadDrivers = async () => {
    const res = await fetch(`/api/vehicles/${id}/drivers`);
    const data = await res.json();
    setDrivers(data.drivers || []);
  };

  const loadFuel = async () => {
    const [fuelRes, cardsRes, allCardsRes] = await Promise.all([
      fetch(`/api/vehicles/${id}/fuel`),
      fetch(`/api/vehicles/${id}/cards`),
      fetch(`/api/vehicles/all-cards`)
    ]);
    const fuelData = await fuelRes.json();
    const cardsData = await cardsRes.json();
    const allCardsData = await allCardsRes.json();
    setFuelStats(fuelData);
    setCards(cardsData.cards || []);
    setAllCards(allCardsData.cards || []);
  };
  
  const loadCardTransactions = async (cardNumber: string) => {
    if (cardTransactions[cardNumber]) {
      setExpandedCard(expandedCard === cardNumber ? null : cardNumber);
      return;
    }
    try {
      const res = await fetch(`/api/vehicles/card/${encodeURIComponent(cardNumber)}/transactions?limit=5`);
      const data = await res.json();
      setCardTransactions({ ...cardTransactions, [cardNumber]: data.transactions || [] });
      setExpandedCard(cardNumber);
    } catch (e) { console.error(e); }
  };
  
  const unlinkCard = async (cardNumber: string) => {
    if (!confirm("Отвязать карту от машины?")) return;
    await fetch(`/api/vehicles/${id}/cards/unlink`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_number: cardNumber })
    });
    loadFuel();
  };
  
  const linkCard = async (cardNumber: string) => {
    await fetch(`/api/vehicles/${id}/cards/link`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_number: cardNumber })
    });
    setShowAddCard(false);
    loadFuel();
  };

  const loadHistory = async () => {
    const res = await fetch(`/api/vehicles/${id}/history`);
    const data = await res.json();
    setHistory(data.history || []);
  };

  const loadMaintenance = async () => {
    const res = await fetch(`/api/vehicles/${id}/maintenance`);
    const data = await res.json();
    setMaintenance(data.maintenance || []);
  };

  // Маппинг марок на типы для норм топлива
  const BRAND_TO_TYPE: Record<string, string> = {
    "FOTON": "Foton S120", "Foton": "Foton S120", "ФОТОН": "Foton S120",
    "KAMAZ": "Камаз 4308", "Kamaz": "Камаз 4308", "КАМАЗ": "Камаз 4308", "КамАЗ": "Камаз 4308",
    "KAMAZ 54901": "Камаз 54901", "КАМАЗ 54901": "Камаз 54901",
    "JAC": "JAC N120", "Jac": "JAC N120", "ДЖАК": "JAC N120",
    "SHACMAN": "Shacman", "Shacman": "Shacman", "ШАКМАН": "Shacman",
    "SITRACK": "Sitrack", "Sitrack": "Sitrack", "СИТРАК": "Sitrack", "Sitrak": "Sitrack"
  };

  // Извлечь цифры из госномера для бортового номера
  const extractDigits = (plate: string) => plate.replace(/\D/g, '').slice(0, -2) || plate.replace(/\D/g, '');

  const updateField = (field: string, value: any) => {
    let updates: any = { [field]: value };
    
    // Автогенерация бортового номера из госномера
    if (field === "license_plate" && value) {
      const digits = extractDigits(value);
      if (digits && !vehicle.internal_number) {
        updates.internal_number = digits;
      }
    }
    
    setVehicle({ ...vehicle, ...updates });
    
    // Автоопределение типа по марке
    if (field === "brand" && value) {
      const matchedType = BRAND_TO_TYPE[value.toUpperCase()] || BRAND_TO_TYPE[value];
      if (matchedType && types.length > 0) {
        const type = types.find(t => t.name === matchedType);
        if (type) {
          setVehicle(prev => ({
            ...prev,
            [field]: value,
            vehicle_type: matchedType,
            fuel_norm_summer: type.fuel_norm_summer,
            fuel_norm_autumn: type.fuel_norm_autumn,
            fuel_norm_winter: type.fuel_norm_winter
          }));
          return;
        }
      }
    }
  };

  const applyTypeNorms = (typeName: string) => {
    const type = types.find(t => t.name === typeName);
    if (type) {
      setVehicle({
        ...vehicle,
        vehicle_type: typeName,
        fuel_norm_summer: type.fuel_norm_summer,
        fuel_norm_autumn: type.fuel_norm_autumn,
        fuel_norm_winter: type.fuel_norm_winter
      });
    } else {
      updateField("vehicle_type", typeName);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const url = isNew ? "/api/vehicles/create" : "/api/vehicles/update";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? vehicle : { id, ...vehicle })
      });
      const data = await res.json();
      if (data.success || data.vehicle) {
        if (isNew && data.vehicle) {
          router.push(`/vehicles/${data.vehicle.id}`);
        } else {
          alert("Сохранено!");
        }
      } else {
        alert("Ошибка: " + (data.error || "Unknown"));
      }
    } catch (e) {
      alert("Ошибка сохранения");
    }
    setSaving(false);
  };

  const getStatusColor = (s: string) => STATUS_OPTIONS.find(o => o.value === s)?.color || "bg-slate-600";

  if (loading) return <div className="min-h-screen bg-slate-900 text-white p-8 text-center">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/vehicles" className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <Truck className="w-6 h-6 text-cyan-400" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{isNew ? "Новая машина" : vehicle.license_plate || vehicle.normalized_number}</h1>
            {!isNew && vehicle.model && <div className="text-sm text-slate-400">{vehicle.model}</div>}
          </div>
          {!isNew && (
            <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(vehicle.status || "active")}`}>
              {STATUS_OPTIONS.find(o => o.value === vehicle.status)?.label || "Активна"}
            </span>
          )}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 px-4 py-2 rounded-lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
      </div>

      {/* Tabs */}
      {!isNew && (
        <div className="bg-slate-800/50 border-b border-slate-700">
          <div className="max-w-5xl mx-auto flex gap-1 px-4 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? "border-cyan-400 text-cyan-400" : "border-transparent text-slate-400 hover:text-white"}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Main Tab */}
        {(isNew || activeTab === "main") && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
              <h2 className="font-semibold text-cyan-400 border-b border-slate-700 pb-2">🚛 Основные данные</h2>
              
              <div>
                <label className="text-sm text-slate-400">Гос. номер *</label>
                <input type="text" value={vehicle.license_plate || ""} onChange={e => updateField("license_plate", e.target.value)} placeholder="В732ХО43" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 font-mono" />
              </div>
              
              <div>
                <label className="text-sm text-slate-400">Бортовой номер</label>
                <input type="text" value={vehicle.internal_number || ""} onChange={e => updateField("internal_number", e.target.value)} placeholder="732" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Марка</label>
                  <input type="text" value={vehicle.brand || ""} onChange={e => updateField("brand", e.target.value)} placeholder="FOTON" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Модель</label>
                  <input type="text" value={vehicle.model || ""} onChange={e => updateField("model", e.target.value)} placeholder="304001" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Тип (для норм топлива)</label>
                  <select value={vehicle.vehicle_type || ""} onChange={e => applyTypeNorms(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1">
                    <option value="">—</option>
                    {types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Год выпуска</label>
                  <input type="number" value={vehicle.year || ""} onChange={e => updateField("year", e.target.value)} placeholder="2022" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-slate-400">VIN</label>
                <input type="text" value={vehicle.vin || ""} onChange={e => updateField("vin", e.target.value)} maxLength={17} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 font-mono" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Цвет</label>
                  <input type="text" value={vehicle.color || ""} onChange={e => updateField("color", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Статус</label>
                  <select value={vehicle.status || "active"} onChange={e => updateField("status", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1">
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
                <h2 className="font-semibold text-yellow-400 border-b border-slate-700 pb-2">⛽ Нормы расхода (л/100км)</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-slate-400">☀️ Лето</label>
                    <input type="number" step="0.1" value={vehicle.fuel_norm_summer || ""} onChange={e => updateField("fuel_norm_summer", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 text-center" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">🍂 Осень</label>
                    <input type="number" step="0.1" value={vehicle.fuel_norm_autumn || ""} onChange={e => updateField("fuel_norm_autumn", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 text-center" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">❄️ Зима</label>
                    <input type="number" step="0.1" value={vehicle.fuel_norm_winter || ""} onChange={e => updateField("fuel_norm_winter", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 text-center" />
                  </div>
                </div>
              </div>
              
              {/* GPS Пробег */}
              {!isNew && (
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                  <h2 className="font-semibold text-cyan-400 border-b border-slate-700 pb-2">📡 Пробег (GPS)</h2>
                  {gpsMileage.error ? (
                    <div className="text-slate-500 text-sm">{gpsMileage.error}</div>
                  ) : gpsMileage.days.length > 0 ? (
                    <>
                      <div className="space-y-1">
                        {gpsMileage.days.slice(0, 7).map((d, i) => (
                          <div key={d.date} className="flex justify-between text-sm">
                            <span className="text-slate-400">
                              {i === 0 ? "Сегодня" : i === 1 ? "Вчера" : new Date(d.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                            </span>
                            <span className={d.km > 0 ? "text-green-400 font-semibold" : "text-slate-500"}>{d.km} км</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-700 pt-2 flex justify-between font-semibold">
                        <span className="text-slate-300">За 7 дней:</span>
                        <span className="text-cyan-400">{gpsMileage.total} км</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500 text-sm">Загрузка...</div>
                  )}
                </div>
              )}
              
              {/* Текущее состояние: топливо */}
              {!isNew && (
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                  <h2 className="font-semibold text-yellow-400 border-b border-slate-700 pb-2">⛽ Топливо</h2>
                  {/* Уровень в баке */}
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">🛢️ В баке сейчас:</span>
                      {currentState.fuelLevel.hasSensor ? (
                        <span className="text-2xl font-bold text-yellow-400">{currentState.fuelLevel.level} л</span>
                      ) : (
                        <span className="text-slate-500 text-sm">{currentState.fuelLevel.message || "Нет датчика"}</span>
                      )}
                    </div>
                  </div>
                  {/* Последние заправки */}
                  {currentState.lastTransactions.length > 0 && (
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Последние заправки:</div>
                      <div className="space-y-1">
                        {currentState.lastTransactions.map((t, i) => (
                          <div key={i} className="flex justify-between text-sm bg-slate-700/30 rounded px-2 py-1">
                            <span className="text-slate-400">
                              {new Date(t.transaction_date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                              <span className="text-slate-600 ml-2">{t.source}</span>
                            </span>
                            <span className="text-green-400 font-medium">+{Math.round(t.quantity)} л</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentState.lastTransactions.length === 0 && !currentState.fuelLevel.hasSensor && (
                    <div className="text-slate-500 text-sm text-center">Нет данных за последние 30 дней</div>
                  )}
                </div>
              )}
              
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
                <h2 className="font-semibold text-slate-400 border-b border-slate-700 pb-2">📝 Дополнительно</h2>
                <div>
                  <label className="text-sm text-slate-400">Собственник</label>
                  <input type="text" value={vehicle.owner || ""} onChange={e => updateField("owner", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Текущий водитель</label>
                  <input type="text" value={vehicle.current_driver || ""} onChange={e => updateField("current_driver", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Заметки</label>
                  <textarea value={vehicle.notes || ""} onChange={e => updateField("notes", e.target.value)} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "docs" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
              <h2 className="font-semibold text-cyan-400">📄 СТС</h2>
              <div><label className="text-sm text-slate-400">Номер</label><input type="text" value={vehicle.sts_number || ""} onChange={e => updateField("sts_number", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
              <div><label className="text-sm text-slate-400">Дата выдачи</label><input type="date" value={vehicle.sts_date || ""} onChange={e => updateField("sts_date", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
              <div><label className="text-sm text-slate-400">Кем выдан</label><input type="text" value={vehicle.sts_issued_by || ""} onChange={e => updateField("sts_issued_by", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
            </div>
            
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
              <h2 className="font-semibold text-cyan-400">📄 ПТС</h2>
              <div><label className="text-sm text-slate-400">Номер</label><input type="text" value={vehicle.pts_number || ""} onChange={e => updateField("pts_number", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
              <div><label className="text-sm text-slate-400">Дата выдачи</label><input type="date" value={vehicle.pts_date || ""} onChange={e => updateField("pts_date", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
              <div><label className="text-sm text-slate-400">Кем выдан</label><input type="text" value={vehicle.pts_issued_by || ""} onChange={e => updateField("pts_issued_by", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
            </div>
            
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
              <h2 className="font-semibold text-green-400">🛡️ ОСАГО</h2>
              <div><label className="text-sm text-slate-400">Номер полиса</label><input type="text" value={vehicle.osago_number || ""} onChange={e => updateField("osago_number", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
              <div><label className="text-sm text-slate-400">Действует до</label><input type="date" value={vehicle.osago_expires || ""} onChange={e => updateField("osago_expires", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
            </div>
            
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
              <h2 className="font-semibold text-purple-400">🔧 Диагностика</h2>
              <div><label className="text-sm text-slate-400">Номер карты</label><input type="text" value={vehicle.diagnostics_number || ""} onChange={e => updateField("diagnostics_number", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
              <div><label className="text-sm text-slate-400">Действует до</label><input type="date" value={vehicle.diagnostics_expires || ""} onChange={e => updateField("diagnostics_expires", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
            </div>
            
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4 md:col-span-2">
              <h2 className="font-semibold text-orange-400">⏱️ Тахограф</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="text-sm text-slate-400">Номер</label><input type="text" value={vehicle.tachograph_number || ""} onChange={e => updateField("tachograph_number", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
                <div><label className="text-sm text-slate-400">Поверка до</label><input type="date" value={vehicle.tachograph_expires || ""} onChange={e => updateField("tachograph_expires", e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" /></div>
              </div>
            </div>
          </div>
        )}

        {/* Fuel Tab */}
        {activeTab === "fuel" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
                <div className="text-3xl font-bold text-yellow-400">{Number(fuelStats.total?.liters || 0).toLocaleString("ru-RU", {maximumFractionDigits: 0})}</div>
                <div className="text-slate-400">литров</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
                <div className="text-3xl font-bold text-green-400">{Number(fuelStats.total?.amount || 0).toLocaleString("ru-RU", {maximumFractionDigits: 0})}</div>
                <div className="text-slate-400">₽</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
                <div className="text-3xl font-bold text-cyan-400">{fuelStats.total?.count || 0}</div>
                <div className="text-slate-400">заправок</div>
              </div>
            </div>
            
            {fuelStats.by_source?.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <h3 className="font-semibold mb-3">По компаниям</h3>
                {fuelStats.by_source.map((s: any, i: number) => (
                  <div key={i} className="flex justify-between py-2 border-b border-slate-700 last:border-0">
                    <span>{s.source}</span>
                    <span><span className="text-yellow-400">{Number(s.liters).toFixed(0)} л</span> / <span className="text-green-400">{Number(s.amount).toLocaleString("ru-RU")} ₽</span></span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold flex items-center gap-2"><CreditCard className="w-5 h-5" /> Привязанные карты</h3>
                  <button onClick={() => setShowAddCard(!showAddCard)} className="text-sm text-cyan-400 hover:text-cyan-300">+ Привязать</button>
                </div>
                
                {showAddCard && (
                  <div className="mb-4 p-3 bg-slate-700/50 rounded-lg">
                    <div className="text-sm text-slate-400 mb-2">Выберите карту:</div>
                    <input 
                      type="text" 
                      placeholder="Поиск по номеру карты..." 
                      value={cardSearch}
                      className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 mb-2 text-sm"
                      onChange={(e) => setCardSearch(e.target.value)}
                    />
                    <div className="max-h-60 overflow-auto space-y-1">
                      {allCards
                        .filter(c => !cardSearch || c.card_number.includes(cardSearch))
                        .slice(0, 30)
                        .map((c: any) => {
                          const isLinkedToOther = c.vehicle_number && c.vehicle_number !== vehicle.license_plate && c.vehicle_number !== vehicle.normalized_number;
                          const isLinkedToThis = cards.some((cc: any) => cc.card_number === c.card_number);
                          if (isLinkedToThis) return null;
                          return (
                            <button 
                              key={c.card_number} 
                              onClick={() => {
                                if (isLinkedToOther && !confirm(`Эта карта уже привязана к машине ${c.vehicle_number}. Перепривязать?`)) return;
                                linkCard(c.card_number);
                              }} 
                              className={`w-full text-left px-2 py-1 hover:bg-slate-600 rounded text-sm ${isLinkedToOther ? "bg-yellow-500/20 border border-yellow-500/50" : ""}`}>
                              <span className="font-mono text-cyan-400">{c.card_number}</span>
                              <span className="text-slate-400 ml-2">{c.source}</span>
                              {isLinkedToOther && <span className="text-yellow-400 ml-2 text-xs">⚠️ {c.vehicle_number}</span>}
                            </button>
                          );
                        })}
                      {allCards.filter(c => !cardSearch || c.card_number.includes(cardSearch)).length === 0 && (
                        <div className="text-slate-500 text-sm py-2">Карта не найдена</div>
                      )}
                    </div>
                  </div>
                )}
                
                {cards.length === 0 ? (
                  <div className="text-slate-500 text-sm">Нет привязанных карт</div>
                ) : (
                  <div className="space-y-2">
                    {cards.map((c: any, i: number) => (
                      <div key={i} className="border border-slate-700 rounded-lg overflow-hidden">
                        <div className="flex justify-between items-center p-3 bg-slate-700/30 cursor-pointer hover:bg-slate-700/50" 
                          onClick={() => loadCardTransactions(c.card_number)}>
                          <div>
                            <span className="font-mono text-cyan-400">{c.card_number}</span>
                            <span className="text-slate-400 ml-3 text-sm">{c.source}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{expandedCard === c.card_number ? "▲" : "▼"}</span>
                            <button onClick={(e) => { e.stopPropagation(); unlinkCard(c.card_number); }} 
                              className="text-red-400 hover:text-red-300 text-sm">✕</button>
                          </div>
                        </div>
                        {expandedCard === c.card_number && cardTransactions[c.card_number] && (
                          <div className="p-3 bg-slate-900/50 border-t border-slate-700">
                            <div className="text-xs text-slate-400 mb-2">Последние 5 транзакций:</div>
                            {cardTransactions[c.card_number].length === 0 ? (
                              <div className="text-slate-500 text-sm">Нет транзакций</div>
                            ) : (
                              <div className="space-y-1">
                                {cardTransactions[c.card_number].map((t: any, ti: number) => (
                                  <div key={ti} className="flex justify-between text-sm">
                                    <span className="text-slate-400">{new Date(t.date).toLocaleDateString("ru-RU")}</span>
                                    <span className="text-yellow-400">{t.liters?.toFixed(1)} л</span>
                                    <span className="text-green-400">{t.amount?.toLocaleString("ru-RU")} ₽</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>
        )}

        {/* Drivers Tab */}
        {activeTab === "drivers" && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="font-semibold mb-3">История водителей</h3>
            {drivers.length === 0 ? (
              <div className="text-slate-400 text-center py-8">Нет данных</div>
            ) : (
              <div className="space-y-2">
                {drivers.map((d, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-700/30 rounded">
                    <div>
                      <div className="font-medium">{d.driver_name}</div>
                      <div className="text-sm text-slate-400">
                        {new Date(d.date_from).toLocaleDateString("ru-RU")} — {new Date(d.date_to).toLocaleDateString("ru-RU")}
                      </div>
                    </div>
                    <div className="text-cyan-400">{d.mileage?.toLocaleString("ru-RU") || "—"} км</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Maintenance Tab */}
        {activeTab === "maintenance" && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="font-semibold mb-3">История обслуживания</h3>
            {maintenance.length === 0 ? (
              <div className="text-slate-400 text-center py-8">Нет записей об обслуживании</div>
            ) : (
              <div className="space-y-2">
                {maintenance.map((m, i) => (
                  <div key={i} className="p-3 bg-slate-700/30 rounded">
                    <div className="flex justify-between">
                      <span className="font-medium">{m.maintenance_type}</span>
                      <span className="text-slate-400">{new Date(m.maintenance_date).toLocaleDateString("ru-RU")}</span>
                    </div>
                    {m.description && <div className="text-sm text-slate-400 mt-1">{m.description}</div>}
                    {m.cost && <div className="text-sm text-red-400 mt-1">{m.cost.toLocaleString("ru-RU")} ₽</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="font-semibold mb-3">История изменений</h3>
            {history.length === 0 ? (
              <div className="text-slate-400 text-center py-8">Нет изменений</div>
            ) : (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="p-3 bg-slate-700/30 rounded text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>{h.field_name}</span>
                      <span>{new Date(h.changed_at).toLocaleString("ru-RU")}</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-red-400 line-through">{h.old_value || "—"}</span>
                      <span className="mx-2">→</span>
                      <span className="text-green-400">{h.new_value || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
