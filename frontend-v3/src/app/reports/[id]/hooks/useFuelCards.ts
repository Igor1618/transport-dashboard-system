// hooks/useFuelCards.ts — Изолированный хук для топливных карт
// Extracted from page.tsx during refactor (14 Mar 2026)
// Каждая операция имеет свой catch — одна ошибка не роняет весь отчёт

import { useState, useEffect, useCallback } from 'react';

interface FuelCard {
  card_number: string;
  source: string;
  [key: string]: any;
}

interface CardTransaction {
  [key: string]: any;
}

export function useFuelCards(vehicleNumber: string) {
  const [vehicleCards, setVehicleCards] = useState<FuelCard[]>([]);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardSearchQ, setCardSearchQ] = useState('');
  const [cardSearchResults, setCardSearchResults] = useState<FuelCard[]>([]);
  const [cardSearching, setCardSearching] = useState(false);
  const [cardTxModal, setCardTxModal] = useState<any>(null);
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);

  const loadVehicleCards = useCallback(async () => {
    if (!vehicleNumber) return;
    try {
      const r = await fetch(`/api/fuel/cards/by-vehicle?vehicle=${encodeURIComponent(vehicleNumber)}`);
      const d = await r.json();
      setVehicleCards(d.cards || []);
    } catch (e) { console.error('loadVehicleCards:', e); }
  }, [vehicleNumber]);

  const searchFuelCards = useCallback(async (q: string) => {
    if (q.length < 3) { setCardSearchResults([]); return; }
    setCardSearching(true);
    try {
      const r = await fetch(`/api/fuel/cards/search?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      setCardSearchResults(d.cards || []);
    } catch (e) { console.error('searchFuelCards:', e); }
    setCardSearching(false);
  }, []);

  const bindFuelCard = useCallback(async (card: string, source: string) => {
    try {
      const r = await fetch('/api/fuel/cards/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_number: card, source, vehicle_number: vehicleNumber })
      });
      const d = await r.json();
      if (d.ok) {
        alert(`Карта привязана! Обновлено ${d.updated_transactions} транзакций (${Number(d.summary?.total_liters || 0).toFixed(0)} л)`);
        setShowCardModal(false);
        setCardSearchQ('');
        setCardSearchResults([]);
        loadVehicleCards();
      }
    } catch (e) { console.error('bindFuelCard:', e); }
  }, [vehicleNumber, loadVehicleCards]);

  const unbindFuelCard = useCallback(async (card: string, source: string) => {
    if (!confirm(`Отвязать карту ****${card.slice(-4)}?`)) return;
    try {
      const r = await fetch('/api/fuel/cards/unbind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_number: card, source })
      });
      if (r.ok) loadVehicleCards();
    } catch (e) { console.error('unbindFuelCard:', e); }
  }, [loadVehicleCards]);

  const loadCardTransactions = useCallback(async (card: string, source: string) => {
    setCardTxModal({ card, source });
    try {
      const r = await fetch(`/api/fuel/cards/transactions?card=${encodeURIComponent(card)}&source=${encodeURIComponent(source)}`);
      const d = await r.json();
      setCardTransactions(d.transactions || []);
    } catch (e) { console.error('loadCardTransactions:', e); setCardTransactions([]); }
  }, []);

  // Isolated useEffect — if this fails, report still renders
  useEffect(() => {
    if (vehicleNumber) loadVehicleCards().catch(console.error);
  }, [vehicleNumber, loadVehicleCards]);

  return {
    vehicleCards,
    showCardModal, setShowCardModal,
    cardSearchQ, setCardSearchQ,
    cardSearchResults,
    cardSearching,
    cardTxModal, setCardTxModal,
    cardTransactions,
    searchFuelCards,
    bindFuelCard,
    unbindFuelCard,
    loadCardTransactions,
    loadVehicleCards,
  };
}
