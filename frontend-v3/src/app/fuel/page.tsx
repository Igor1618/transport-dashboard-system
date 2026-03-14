"use client";
import { formatDate } from "@/lib/dates";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Fuel, Upload, CreditCard, Truck, ChevronDown, ChevronRight, Search, Save, X, AlertTriangle } from "lucide-react";

export default function FuelPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [unlinked, setUnlinked] = useState<any>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    Promise.all([
      fetch("/api/cards/stats").then(r => r.json()),
      fetch("/api/cards/list").then(r => r.json()),
      fetch("/api/fuel/list").then(r => r.json()),
      fetch("/api/reports/vehicles").then(r => r.json()),
      fetch("/api/cards/unlinked").then(r => r.json())
    ]).then(([statsData, cardsData, txData, vehiclesData, unlinkedData]) => {
      setCompanies(statsData.stats || []);
      setCards(cardsData.cards || []);
      setTransactions(txData.transactions || []);
      setVehicles(vehiclesData || []);
      setUnlinked(unlinkedData);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const getCompanyCards = (source: string) => {
    let filtered = cards.filter(c => c.source === source);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.card_number?.toLowerCase().includes(term) ||
        c.notes?.toLowerCase().includes(term) ||
        c.vehicle_number?.toLowerCase().includes(term)
      );
    }
    return filtered;
  };

  const startEdit = (card: any) => {
    setEditingCard(card.id);
    setEditValue(card.vehicle_number || "");
  };

  const saveEdit = async (card: any) => {
    try {
      await fetch("/api/cards/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, vehicle_number: editValue || null })
      });
      setCards(cards.map(c => c.id === card.id ? { ...c, vehicle_number: editValue || null } : c));
      setEditingCard(null);
      loadData();
    } catch (e) {
      alert("Ошибка сохранения");
    }
  };

  const cancelEdit = () => {
    setEditingCard(null);
    setEditValue("");
  };

  if (loading) return <div className="p-8 text-center">Загрузка...</div>;

  const totalLinked = companies.reduce((s, c) => s + Number(c.total_amount || 0), 0);
  const totalUnlinked = unlinked?.total?.total_amount || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Fuel className="w-8 h-8 text-cyan-400" />
          <h1 className="text-2xl font-bold">Топливо</h1>
        </div>
        <Link href="/vehicles" className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded-lg"><Truck className="w-4 h-4" /> Машины</Link>
        <Link href="/fuel/import" className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded-lg">
          <Upload className="w-4 h-4" /> Импорт
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-sm">Всего карт</div>
          <div className="text-2xl font-bold">{cards.length}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-sm">Компаний</div>
          <div className="text-2xl font-bold text-purple-400">{companies.length}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-sm">Транзакций</div>
          <div className="text-2xl font-bold text-cyan-400">{transactions.length}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-sm">Привязано</div>
          <div className="text-2xl font-bold text-green-400">{cards.filter(c => c.vehicle_number).length}</div>
        </div>
      </div>

      {/* Блок непривязанных */}
      {unlinked && unlinked.total && unlinked.total.total_amount > 0 && (
        <div className="bg-red-900/30 rounded-xl border border-red-700/50">
          <button 
            onClick={() => setShowUnlinked(!showUnlinked)}
            className="w-full p-4 flex items-center justify-between hover:bg-red-800/20"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div className="text-left">
                <div className="font-semibold text-red-400">⚠️ Непривязанные транзакции</div>
                <div className="text-sm text-red-300">
                  {unlinked.cards?.length || 0} карт без машин | {unlinked.total.tx_count} транзакций
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-red-400 font-bold">{Math.round(unlinked.total.total_liters).toLocaleString("ru-RU")} л</div>
              <div className="text-red-300 text-lg font-bold">{Math.round(unlinked.total.total_amount).toLocaleString("ru-RU")} ₽</div>
            </div>
          </button>
          
          {showUnlinked && (
            <div className="border-t border-red-700/50 p-4">
              <div className="text-sm text-red-300 mb-3">Карты без привязки к машинам — топливо не учитывается в отчётах</div>
              <table className="w-full text-sm">
                <thead className="bg-red-900/30">
                  <tr>
                    <th className="text-left p-2">Компания</th>
                    <th className="text-left p-2">Карта</th>
                    <th className="text-left p-2">Название</th>
                    <th className="text-right p-2">Литры</th>
                    <th className="text-right p-2">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {(unlinked.cards || []).slice(0, 30).map((c: any, i: number) => (
                    <tr key={i} className="border-t border-red-700/30 hover:bg-red-800/20">
                      <td className="p-2 text-slate-400">{c.source}</td>
                      <td className="p-2 font-mono text-xs text-red-400">{c.card_number}</td>
                      <td className="p-2">{c.card_name || c.driver_name || "—"}</td>
                      <td className="p-2 text-right text-yellow-400">{Math.round(c.total_liters).toLocaleString("ru-RU")}</td>
                      <td className="p-2 text-right text-red-400">{Math.round(c.total_amount).toLocaleString("ru-RU")} ₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(unlinked.cards?.length || 0) > 30 && (
                <div className="text-center text-red-300 text-sm mt-2">... и ещё {unlinked.cards.length - 30} карт</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-cyan-400" />
          Топливные компании
        </h2>
        
        {companies.map(company => {
          const companyCards = getCompanyCards(company.source);
          const isExpanded = expandedCompany === company.source;
          
          return (
            <div key={company.source} className="bg-slate-800 rounded-xl border border-slate-700">
              <button 
                onClick={() => { setExpandedCompany(isExpanded ? null : company.source); setSearchTerm(""); }}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-4">
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <div className="text-left">
                    <div className="font-semibold">{company.source}</div>
                    <div className="text-sm text-slate-400">
                      Карт: {company.total_cards} | Привязано: <span className="text-green-400">{company.linked_cards}</span> | Транзакций: {company.transactions}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-cyan-400">{Number(company.total_liters || 0).toLocaleString("ru-RU", {maximumFractionDigits: 0})} л</div>
                  <div className="text-yellow-400 text-sm">{Number(company.total_amount || 0).toLocaleString("ru-RU", {maximumFractionDigits: 0})} ₽</div>
                </div>
              </button>
              
              {isExpanded && (
                <div className="border-t border-slate-700">
                  <div className="p-3 border-b border-slate-700 bg-slate-700/30">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Поиск по карте, названию, машине..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="flex-1 bg-slate-700 rounded px-3 py-1.5 text-sm border border-slate-600"
                      />
                    </div>
                  </div>
                  
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="text-left p-3">Карта</th>
                        <th className="text-left p-3">Название</th>
                        <th className="text-left p-3">Машина</th>
                        <th className="text-right p-3 w-24">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyCards.map(card => (
                        <tr key={card.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3 font-mono text-xs text-cyan-400">{card.card_number}</td>
                          <td className="p-3 text-slate-300">{card.notes || "—"}</td>
                          <td className="p-3">
                            {editingCard === card.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  list={"veh-" + card.id}
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  className="bg-slate-700 rounded px-2 py-1 text-sm border border-cyan-500 w-32"
                                  placeholder="Номер машины"
                                  autoFocus
                                />
                                <datalist id={"veh-" + card.id}>
                                  {vehicles.map((v: any) => <option key={v.number} value={v.number} />)}
                                </datalist>
                              </div>
                            ) : card.vehicle_number ? (
                              <span className="text-green-400 flex items-center gap-1">
                                <Truck className="w-3 h-3" /> {card.vehicle_number}
                              </span>
                            ) : (
                              <span className="text-orange-400">Не привязана</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {editingCard === card.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => saveEdit(card)} className="p-1 text-green-400 hover:bg-green-500/20 rounded">
                                  <Save className="w-4 h-4" />
                                </button>
                                <button onClick={cancelEdit} className="p-1 text-red-400 hover:bg-red-500/20 rounded">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => startEdit(card)} className="text-blue-400 hover:text-blue-300 text-xs">
                                ✏️ Изменить
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {companyCards.length === 0 && (
                        <tr><td colSpan={4} className="p-4 text-center text-slate-500">Ничего не найдено</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {transactions.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700 font-semibold">
            Последние транзакции ({transactions.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-left p-2">Дата</th>
                  <th className="text-left p-2">Компания</th>
                  <th className="text-left p-2">Машина</th>
                  <th className="text-right p-2">Литры</th>
                  <th className="text-right p-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 50).map(tx => (
                  <tr key={tx.id} className="border-t border-slate-700/50">
                    <td className="p-2">{formatDate(tx.transaction_date)}</td>
                    <td className="p-2">{tx.source}</td>
                    <td className="p-2">{tx.vehicle_number || <span className="text-orange-400 font-medium">⚠️ Без машины</span>}</td>
                    <td className="p-2 text-right text-cyan-400">{Number(tx.quantity).toFixed(0)}</td>
                    <td className="p-2 text-right text-yellow-400">{Number(tx.amount).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
