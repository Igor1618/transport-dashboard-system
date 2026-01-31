"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Truck, Plus, Trash2, Save, Search, RefreshCw } from "lucide-react";

interface FuelCard {
  id: number;
  card_number: string;
  source: string;
  vehicle_number: string | null;
  driver_name: string | null;
  notes: string | null;
}

interface CardStats {
  source: string;
  total: number;
  linked: number;
  unlinked: number;
}

const SOURCES = ["Татнефть", "E100", "Газпромнефть", "ТК Движение"];

export default function FuelCardsPage() {
  const [cards, setCards] = useState<FuelCard[]>([]);
  const [stats, setStats] = useState<CardStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSource, setFilterSource] = useState("");
  const [filterVehicle, setFilterVehicle] = useState("");
  
  const [editCard, setEditCard] = useState<Partial<FuelCard> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCards = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSource) params.append("source", filterSource);
      if (filterVehicle) params.append("vehicle", filterVehicle);
      
      const [cardsRes, statsRes] = await Promise.all([
        fetch(`/api/cards/list?${params}`),
        fetch("/api/cards/stats")
      ]);
      
      const cardsData = await cardsRes.json();
      const statsData = await statsRes.json();
      
      setCards(cardsData.cards || []);
      setStats(statsData.stats || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadCards(); }, [filterSource, filterVehicle]);

  const handleSave = async () => {
    if (!editCard?.card_number || !editCard?.source) return;
    setSaving(true);
    try {
      await fetch("/api/cards/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCard)
      });
      setEditCard(null);
      loadCards();
    } catch (e) {
      alert("Ошибка сохранения");
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить карту?")) return;
    try {
      await fetch(`/api/cards/${id}`, { method: "DELETE" });
      loadCards();
    } catch (e) {
      alert("Ошибка удаления");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/fuel" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <CreditCard className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold">Топливные карты</h1>
          </div>
          <button onClick={() => setEditCard({ source: SOURCES[0] })}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-sm">{s.source}</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-white">{s.total}</span>
                <span className="text-green-400 text-sm">✓{s.linked}</span>
                {Number(s.unlinked) > 0 && <span className="text-red-400 text-sm">?{s.unlinked}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Фильтры */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Компания</label>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 min-w-[150px]">
              <option value="">Все</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">Машина</label>
            <input type="text" value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)}
              placeholder="Номер..." className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>
          <button onClick={loadCards} disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">
            <RefreshCw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} /> Обновить
          </button>
        </div>

        {/* Форма добавления/редактирования */}
        {editCard && (
          <div className="bg-cyan-900/30 rounded-xl p-4 border border-cyan-500/50">
            <h3 className="font-semibold mb-3">{editCard.id ? "Редактировать" : "Новая карта"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Компания *</label>
                <select value={editCard.source || ""} onChange={e => setEditCard({...editCard, source: e.target.value})}
                  className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Номер карты *</label>
                <input type="text" value={editCard.card_number || ""} 
                  onChange={e => setEditCard({...editCard, card_number: e.target.value})}
                  className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Машина</label>
                <input type="text" value={editCard.vehicle_number || ""} 
                  onChange={e => setEditCard({...editCard, vehicle_number: e.target.value})}
                  placeholder="А123БВ777" className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Водитель</label>
                <input type="text" value={editCard.driver_name || ""} 
                  onChange={e => setEditCard({...editCard, driver_name: e.target.value})}
                  className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleSave} disabled={saving || !editCard.card_number}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 px-4 py-2 rounded-lg">
                <Save className="w-4 h-4" /> Сохранить
              </button>
              <button onClick={() => setEditCard(null)} className="px-4 py-2 text-slate-400 hover:text-white">
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Таблица карт */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <span className="font-semibold">Карты</span>
            <span className="text-slate-400 ml-2">({cards.length})</span>
          </div>
          {cards.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left p-3">Компания</th>
                    <th className="text-left p-3">Номер карты</th>
                    <th className="text-left p-3">Машина</th>
                    <th className="text-left p-3">Водитель</th>
                    <th className="text-right p-3">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map(card => (
                    <tr key={card.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-3">{card.source}</td>
                      <td className="p-3 font-mono text-cyan-400">{card.card_number}</td>
                      <td className="p-3">
                        {card.vehicle_number ? (
                          <span className="flex items-center gap-1">
                            <Truck className="w-4 h-4 text-green-400" />
                            {card.vehicle_number}
                          </span>
                        ) : (
                          <span className="text-red-400">Не привязана</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">{card.driver_name || "—"}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => setEditCard(card)} className="text-blue-400 hover:text-blue-300 mr-2">
                          ✏️
                        </button>
                        <button onClick={() => handleDelete(card.id)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <div>Нет карт</div>
              <div className="text-sm mt-1">Добавьте карты или загрузите файл топлива</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
