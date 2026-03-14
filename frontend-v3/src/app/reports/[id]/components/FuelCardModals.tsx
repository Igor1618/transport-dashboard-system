'use client';

interface FuelCardModalsProps {
  vehicleNumber: string;
  showCardModal: boolean;
  setShowCardModal: (v: boolean) => void;
  cardSearchQ: string;
  setCardSearchQ: (v: string) => void;
  searchFuelCards: (q: string) => void;
  cardSearching: boolean;
  cardSearchResults: any[];
  bindFuelCard: (card: string, source: string) => void;
  cardTxModal: { card: string; source: string } | null;
  setCardTxModal: (v: any) => void;
  cardTransactions: any[];
}

export function FuelCardModals({
  vehicleNumber, showCardModal, setShowCardModal,
  cardSearchQ, setCardSearchQ, searchFuelCards, cardSearching, cardSearchResults,
  bindFuelCard, cardTxModal, setCardTxModal, cardTransactions
}: FuelCardModalsProps) {
  return (
    <>
      {/* Fuel Card Search Modal */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowCardModal(false)}>
          <div className="bg-slate-800 rounded-lg p-4 w-[400px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">Добавить топливную карту</h3>
            <p className="text-sm text-slate-400 mb-2">Машина: {vehicleNumber}</p>
            <input type="text" value={cardSearchQ} onChange={e => {setCardSearchQ(e.target.value); searchFuelCards(e.target.value);}}
              placeholder="Последние 4+ цифры карты" className="w-full p-2 rounded bg-slate-700 text-white mb-3" autoFocus />
            {cardSearching && <p className="text-sm text-slate-400">Поиск...</p>}
            {cardSearchResults.map((c: any, i: number) => (
              <div key={i} className="p-2 rounded bg-slate-700/50 mb-2 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{c.card_number}</div>
                  <div className="text-xs text-slate-400">{c.source} | {c.tx_count} запр. | {Number(c.total_liters||0).toFixed(0)} л | {Number(c.total_amount||0).toLocaleString()} ₽</div>
                  {c.vehicle_number && <div className="text-xs text-yellow-400">Привязана к {c.vehicle_number}</div>}
                </div>
                <button onClick={() => bindFuelCard(c.card_number, c.source)}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded text-sm whitespace-nowrap ml-2">Привязать</button>
              </div>
            ))}
            {cardSearchQ.length >= 3 && !cardSearching && cardSearchResults.length === 0 && (
              <p className="text-sm text-slate-400">Карты не найдены</p>
            )}
            <button onClick={() => setShowCardModal(false)} className="mt-3 w-full p-2 bg-slate-700 hover:bg-slate-600 rounded">Закрыть</button>
          </div>
        </div>
      )}
      {/* Card Transactions Modal */}
      {cardTxModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setCardTxModal(null)}>
          <div className="bg-slate-800 rounded-lg p-4 w-[500px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">Транзакции ****{cardTxModal.card.slice(-4)} ({cardTxModal.source})</h3>
            {cardTransactions.length === 0 && <p className="text-sm text-slate-400">Нет транзакций</p>}
            {cardTransactions.map((t: any, i: number) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-700/50">
                <span>{t.transaction_date?.slice(0,10)} {t.transaction_time?.slice(0,5)}</span>
                <span>{t.station_name || ''}</span>
                <span className="font-medium">{Number(t.quantity||0).toFixed(0)} л</span>
                <span className="text-slate-400">{Number(t.amount||0).toLocaleString()} ₽</span>
              </div>
            ))}
            <button onClick={() => setCardTxModal(null)} className="mt-3 w-full p-2 bg-slate-700 hover:bg-slate-600 rounded">Закрыть</button>
          </div>
        </div>
      )}
    </>
  );
}
