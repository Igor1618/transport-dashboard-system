"use client";
import { useState, useEffect } from "react";
import { Plus, FileText, Search, ChevronLeft, ChevronRight, Loader2, Eye, Edit2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';
const fmtPrice = (n: any) => n ? Number(n).toLocaleString('ru-RU') : '—';
const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'bg-slate-500/20 text-slate-400' },
  sent: { label: 'Отправлена', color: 'bg-yellow-500/20 text-yellow-400' },
  signed: { label: 'Подписана', color: 'bg-emerald-500/20 text-emerald-400' },
  in_progress: { label: 'В работе', color: 'bg-blue-500/20 text-blue-400' },
  disputed: { label: 'Спор', color: 'bg-orange-500/20 text-orange-400' },
  active: { label: 'Активен', color: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Завершён', color: 'bg-indigo-500/20 text-indigo-400' },
  cancelled: { label: 'Отменён', color: 'bg-red-500/20 text-red-400' },
};

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const LIMIT = 50;

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) p.set('search', search);
    if (filterStatus) p.set('status', filterStatus);
    fetch('/api/contracts?' + p).then(r => r.json()).then(d => {
      setContracts(d.contracts || []);
      setTotal(d.total || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, search, filterStatus]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-[1400px] mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">📄 Договоры-заявки</h1>
        <Link href="/contracts/create" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">
          <Plus size={16}/> Создать договор
        </Link>
      </div>

      <div className="flex gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-slate-500"/>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Поиск по номеру, перевозчику..."
            className="bg-slate-800 border border-slate-600 rounded pl-7 pr-3 py-1.5 text-sm w-72" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm">
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="sent">Отправлена</option>
          <option value="signed">Подписана</option>
          <option value="in_progress">В работе</option>
          <option value="completed">Завершён</option>
          <option value="cancelled">Отменён</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs">
              <th className="py-2 px-2 text-left">№ ДОГОВОРА</th>
              <th className="py-2 px-2 text-left">ДАТА</th>
              <th className="py-2 px-2 text-left">ПЕРЕВОЗЧИК</th>
              <th className="py-2 px-2 text-left">МАШИНА</th>
              <th className="py-2 px-2 text-left">МАРШРУТ</th>
              <th className="py-2 px-2 text-right">СТАВКА</th>
              <th className="py-2 px-2 text-center">СТАТУС</th>
              <th className="py-2 px-2 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-500"><Loader2 className="animate-spin inline mr-2" size={16}/>Загрузка...</td></tr>
            ) : contracts.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-500">Нет договоров. <Link href="/contracts/create" className="text-blue-400 hover:underline">Создать первый</Link></td></tr>
            ) : contracts.map(c => {
              const st = statusMap[c.status] || statusMap.draft;
              return (
                <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="py-2 px-2 font-medium text-blue-400">{c.contract_number}</td>
                  <td className="py-2 px-2 text-xs text-slate-300">{fmtDate(c.contract_date)}</td>
                  <td className="py-2 px-2 max-w-[200px] truncate">{c.carrier_name}</td>
                  <td className="py-2 px-2"><span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono">{c.vehicle_plate}</span></td>
                  <td className="py-2 px-2 max-w-[180px] truncate text-slate-300">{c.route_name}</td>
                  <td className="py-2 px-2 text-right">{fmtPrice(c.price)} ₽</td>
                  <td className="py-2 px-2 text-center"><span className={`px-2 py-0.5 rounded text-xs ${st.color}`}>{st.label}</span></td>
                  <td className="py-2 px-2 text-center">
                    <a href={`/api/contracts/${c.id}/pdf?format=html`} target="_blank" className="text-slate-400 hover:text-white inline-block mr-2" title="PDF"><FileText size={14}/></a>
                    {c.status === 'draft' && <Link href={`/contracts/create?edit=${c.id}`} className="text-slate-400 hover:text-white inline-block" title="Редактировать"><Edit2 size={14}/></Link>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{(page-1)*LIMIT+1}–{Math.min(page*LIMIT, total)} из {total}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="px-2 py-1 text-xs bg-slate-800 rounded disabled:opacity-30"><ChevronLeft size={14}/></button>
            <span className="px-3 py-1 text-xs text-slate-400">{page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages} className="px-2 py-1 text-xs bg-slate-800 rounded disabled:opacity-30"><ChevronRight size={14}/></button>
          </div>
        </div>
      )}
    </div>
  );
}
