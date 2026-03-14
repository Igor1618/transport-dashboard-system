"use client";
import { useState, useEffect } from "react";
import { Search, Link2, Check, X } from "lucide-react";

type Card = { card_number: string; source: string; driver_name: string; txns: number; last_date: string; total_liters: number };

export default function FuelCardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [vehicles, setVehicles] = useState<{license_plate: string; brand: string; model: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/fuel/unlinked-cards").then(r => r.json()),
      fetch("/api/vehicles").then(r => r.json()),
    ]).then(([c, v]) => {
      setCards(c.cards || []);
      setVehicles(Array.isArray(v) ? v : v.vehicles || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(load, []);

  const handleLink = async (card: Card) => {
    if (!linkValue) return;
    const res = await fetch("/api/fuel/link-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_number: card.card_number, source: card.source, vehicle_number: linkValue }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage(`✅ ${card.card_number} → ${linkValue} (обновлено ${data.updated_transactions} транзакций)`);
      setLinking(null);
      setLinkValue("");
      load();
    } else {
      setMessage(`❌ Ошибка: ${data.error}`);
    }
    setTimeout(() => setMessage(""), 5000);
  };

  const filtered = search
    ? cards.filter(c => c.card_number.includes(search) || c.source.toLowerCase().includes(search.toLowerCase()) || c.driver_name?.toLowerCase().includes(search.toLowerCase()))
    : cards;

  const bySource: Record<string, Card[]> = {};
  filtered.forEach(c => { (bySource[c.source] = bySource[c.source] || []).push(c); });

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔗 Непривязанные топливные карты ({cards.length})</h1>

      {message && <div className="bg-slate-800 rounded-lg p-3 mb-3 text-sm border border-green-500/30">{message}</div>}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по номеру карты, источнику, водителю..." className="w-full bg-slate-800 text-white pl-10 pr-3 py-2 rounded-lg border border-slate-700 text-sm" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" /></div>
      ) : (
        Object.entries(bySource).sort().map(([source, sourceCards]) => (
          <div key={source} className="mb-6">
            <h2 className="text-lg font-semibold text-slate-300 mb-2">{source} ({sourceCards.length})</h2>
            <div className="space-y-1">
              {sourceCards.map(c => {
                const isLinking = linking === `${c.card_number}-${c.source}`;
                return (
                  <div key={`${c.card_number}-${c.source}`} className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-mono text-sm">{c.card_number}</div>
                      <div className="text-xs text-slate-400">
                        {c.driver_name && <span className="text-blue-400">{c.driver_name}</span>}
                        {c.txns > 0 && <span className="ml-2">{c.txns} транз.</span>}
                        {c.total_liters > 0 && <span className="ml-2">{Math.round(+c.total_liters)} л</span>}
                        {c.last_date && <span className="ml-2">посл: {c.last_date.slice(0,10)}</span>}
                      </div>
                    </div>
                    {isLinking ? (
                      <div className="flex items-center gap-1">
                        <input value={linkValue} onChange={e => setLinkValue(e.target.value.toUpperCase())} placeholder="Номер машины" className="bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 text-sm w-36" list="vehicle-list" />
                        <button onClick={() => handleLink(c)} className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded"><Check className="w-4 h-4" /></button>
                        <button onClick={() => { setLinking(null); setLinkValue(""); }} className="bg-slate-600 hover:bg-slate-500 text-white p-1.5 rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setLinking(`${c.card_number}-${c.source}`)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> Привязать
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <datalist id="vehicle-list">
        {vehicles.map(v => <option key={v.license_plate} value={v.license_plate}>{v.brand} {v.model}</option>)}
      </datalist>
    </div>
  );
}
