'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractApp {
  uuid_1c: string;
  number: string;
  doc_date: string | null;
  posted: boolean;
  is_marked_for_deletion: boolean;
  amount: string | null;
  amount_vat: string | null;
  vat_rate: string | null;
  cargo_weight: string | null;
  cargo_volume: string | null;
  cargo_places: number | null;
  payment_terms_days: number | null;
  payment_form: string | null;
  payment_condition: string | null;
  load_dates_text: string | null;
  unload_dates_text: string | null;
  unload_date: string | null;
  comment: string | null;
  external_number: string | null;
  contractor_uuid_1c: string | null;
  route_uuid_1c: string | null;
  driver_uuid_1c: string | null;
  vehicle_uuid_1c: string | null;
  invoice_uuid_1c: string | null;
  realization_uuid_1c: string | null;
  synced_at: string;
  // joined
  contractor_name: string | null;
  route_name: string | null;
  driver_name: string | null;
  vehicle_plate: string | null;
  vehicle_name: string | null;
}

interface ListResponse {
  total: number;
  page: number;
  limit: number;
  items: ContractApp[];
}

interface Stats {
  total: string;
  posted: string;
  last_30d: string;
  month_amount: string;
  last_synced_at: string | null;
}

interface AttachedFile {
  uuid_1c: string;
  name: string;
  extension: string | null;
  size_bytes: number | null;
  created_at_1c: string | null;
  synced_file: boolean;
  sync_error: string | null;
  parsed: boolean;
  ai_fields: Record<string, unknown> | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('ru-RU'); } catch { return s; }
}

function fmtMoney(s: string | null): string {
  if (!s || s === '0') return '—';
  return Number(s).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
}

function _fileIcon(ext: string | null): string {
  switch ((ext || '').toLowerCase()) {
    case 'pdf':  return '📄';
    case 'docx': case 'doc': return '📝';
    case 'xlsx': case 'xls': return '📊';
    case 'jpg':  case 'jpeg': case 'png': case 'tiff': return '🖼️';
    case 'zip':  case 'rar': return '🗜️';
    default: return '📎';
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ContractApplicationsPage() {
  const [items, setItems]     = useState<ContractApp[]>([]);
  const [total, setTotal]     = useState(0);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filesCache, setFilesCache] = useState<Record<string, AttachedFile[]>>({});
  const [filesLoading, setFilesLoading] = useState<string | null>(null);
  // Tracks file UUIDs that were requested (202 queued) by the user
  const [requestedFiles, setRequestedFiles] = useState<Record<string, boolean>>({});

  // Filters
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [postedFilter, setPostedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage]         = useState(1);
  const LIMIT = 50;

  const debouncedSearch = useDebounce(search, 350);

  // ─── Request file delivery ──────────────────────────────────────────────────

  const requestFile = useCallback(async (fileUuid: string) => {
    if (requestedFiles[fileUuid]) return; // already requested
    setRequestedFiles(prev => ({ ...prev, [fileUuid]: true }));
    try {
      const r = await fetch(`/api/contracts-1c/files/${fileUuid}`);
      if (r.status === 200) {
        window.open(`/api/contracts-1c/files/${fileUuid}`, '_blank');
        return;
      }
      // status 202 = queued — poll the files endpoint every 5s until synced
      const parentUuid = expanded;
      if (!parentUuid) return;
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        try {
          const res = await fetch(`/api/contracts-1c/${parentUuid}/files`);
          const d = await res.json();
          const found = (d.files || []).find((x: AttachedFile) => x.uuid_1c === fileUuid);
          if (found && found.synced_file) {
            setFilesCache(prev => ({ ...prev, [parentUuid]: d.files || [] }));
            setRequestedFiles(prev => {
              const n = { ...prev };
              delete n[fileUuid];
              return n;
            });
            clearInterval(poll);
          }
        } catch { /* keep polling */ }
        if (tries >= 24) clearInterval(poll); // 24 × 5s = 2 minutes max
      }, 5000);
    } catch {
      // silent
    }
  }, [requestedFiles, expanded]);

  // ─── Fetch files for expanded row ───────────────────────────────────────────

  const fetchFiles = useCallback(async (uuid: string) => {
    if (filesCache[uuid] !== undefined) return;
    setFilesLoading(uuid);
    try {
      const r = await fetch(`/api/contracts-1c/${uuid}/files`);
      const d = await r.json();
      setFilesCache(prev => ({ ...prev, [uuid]: d.files || [] }));
    } catch {
      setFilesCache(prev => ({ ...prev, [uuid]: [] }));
    } finally {
      setFilesLoading(null);
    }
  }, [filesCache]);

  // Fetch files when a row expands
  useEffect(() => {
    if (expanded) fetchFiles(expanded);
  }, [expanded, fetchFiles]);

  // ─── Fetch stats ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/contracts-1c/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  // ─── Fetch list ─────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (debouncedSearch) p.set('search', debouncedSearch);
      if (dateFrom) p.set('date_from', dateFrom);
      if (dateTo)   p.set('date_to', dateTo);
      if (postedFilter !== 'all') p.set('posted', postedFilter);

      const res = await fetch(`/api/contracts-1c?${p}`);
      if (!res.ok) throw new Error(await res.text());
      const data: ListResponse = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, dateFrom, dateTo, postedFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFrom, dateTo, postedFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const totalPages = Math.ceil(total / LIMIT);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Договор-заявки 1С</h1>
          <p className="text-slate-400 text-sm mt-1">Синхронизировано из 1С · только чтение</p>
        </div>
        {stats && (
          <div className="hidden md:flex gap-4 text-sm">
            <div className="bg-slate-800 rounded-lg px-4 py-2 text-center">
              <div className="text-white font-bold">{Number(stats.total).toLocaleString('ru-RU')}</div>
              <div className="text-slate-400 text-xs">всего</div>
            </div>
            <div className="bg-slate-800 rounded-lg px-4 py-2 text-center">
              <div className="text-green-400 font-bold">{Number(stats.last_30d).toLocaleString('ru-RU')}</div>
              <div className="text-slate-400 text-xs">за 30 дней</div>
            </div>
            <div className="bg-slate-800 rounded-lg px-4 py-2 text-center">
              <div className="text-cyan-400 font-bold text-xs">{Number(stats.month_amount).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</div>
              <div className="text-slate-400 text-xs">сумма за месяц</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-slate-900 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-slate-400 mb-1 block">Поиск</label>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="номер, контрагент, маршрут, водитель, госномер..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">С даты</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">По дату</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Статус</label>
          <select
            value={postedFilter}
            onChange={e => setPostedFilter(e.target.value as 'all' | 'true' | 'false')}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Все</option>
            <option value="true">Проведена</option>
            <option value="false">Не проведена</option>
          </select>
        </div>
        <button
          onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPostedFilter('all'); }}
          className="px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
        >
          Сброс
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950/60 border border-red-800 rounded-xl p-4 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm text-slate-400 mb-3">
        <span>
          {loading ? 'Загрузка...' : `Найдено: ${total.toLocaleString('ru-RU')}`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs"
            >
              ← Назад
            </button>
            <span className="text-xs">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs"
            >
              Вперёд →
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80">
            <tr>
              <th className="text-left px-4 py-3 text-slate-300 font-medium">Номер</th>
              <th className="text-left px-4 py-3 text-slate-300 font-medium">Дата</th>
              <th className="text-left px-4 py-3 text-slate-300 font-medium">Контрагент</th>
              <th className="text-left px-4 py-3 text-slate-300 font-medium hidden md:table-cell">Маршрут</th>
              <th className="text-left px-4 py-3 text-slate-300 font-medium hidden lg:table-cell">Водитель / ТС</th>
              <th className="text-right px-4 py-3 text-slate-300 font-medium hidden md:table-cell">Груз, т</th>
              <th className="text-right px-4 py-3 text-slate-300 font-medium">Сумма</th>
              <th className="text-center px-4 py-3 text-slate-300 font-medium">Ст.</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-500">
                  {search || dateFrom || dateTo ? 'Ничего не найдено' : 'Нет данных'}
                </td>
              </tr>
            )}
            {items.map(item => (
              <>
                <tr
                  key={item.uuid_1c}
                  onClick={() => setExpanded(expanded === item.uuid_1c ? null : item.uuid_1c)}
                  className={`border-t border-slate-800 cursor-pointer transition-colors ${
                    expanded === item.uuid_1c
                      ? 'bg-slate-800/60'
                      : 'hover:bg-slate-900/60'
                  } ${item.is_marked_for_deletion ? 'opacity-40 line-through' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-cyan-400 text-xs whitespace-nowrap">
                    {item.number || '—'}
                    {item.external_number && (
                      <span className="ml-1 text-slate-500">({item.external_number})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">
                    {fmtDate(item.doc_date)}
                  </td>
                  <td className="px-4 py-3 text-slate-200 max-w-[200px] truncate">
                    {item.contractor_name || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-[220px] truncate hidden md:table-cell text-xs">
                    {item.route_name || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs">
                    {item.driver_name && (
                      <span className="text-slate-300">{item.driver_name}</span>
                    )}
                    {item.vehicle_plate && (
                      <span className="ml-2 font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs">
                        {item.vehicle_plate}
                      </span>
                    )}
                    {!item.driver_name && !item.vehicle_plate && (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell text-slate-300 text-xs">
                    {item.cargo_weight ? Number(item.cargo_weight).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-white text-xs whitespace-nowrap">
                    {fmtMoney(item.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.posted ? (
                      <span className="text-green-400 text-xs">✓</span>
                    ) : (
                      <span className="text-yellow-500 text-xs">○</span>
                    )}
                  </td>
                </tr>

                {/* Expanded row */}
                {expanded === item.uuid_1c && (
                  <tr key={`${item.uuid_1c}-expanded`} className="border-t border-slate-700 bg-slate-900/80">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">

                        {/* Основное */}
                        <div>
                          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Основное</div>
                          <div className="space-y-1">
                            <div><span className="text-slate-400">Номер:</span> <span className="text-white">{item.number}</span></div>
                            {item.external_number && <div><span className="text-slate-400">Внешний №:</span> <span className="text-slate-300">{item.external_number}</span></div>}
                            <div><span className="text-slate-400">Дата:</span> <span className="text-white">{fmtDate(item.doc_date)}</span></div>
                            <div><span className="text-slate-400">Статус:</span> {item.posted ? <span className="text-green-400">Проведена</span> : <span className="text-yellow-400">Не проведена</span>}</div>
                            <div><span className="text-slate-400">Контрагент:</span> <span className="text-white">{item.contractor_name || '—'}</span></div>
                            <div><span className="text-slate-400">Маршрут:</span> <span className="text-slate-200">{item.route_name || '—'}</span></div>
                          </div>
                        </div>

                        {/* Транспорт */}
                        <div>
                          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Транспорт</div>
                          <div className="space-y-1">
                            <div><span className="text-slate-400">Водитель:</span> <span className="text-white">{item.driver_name || '—'}</span></div>
                            <div><span className="text-slate-400">ТС:</span> <span className="text-white">{item.vehicle_name || '—'}</span>
                              {item.vehicle_plate && <span className="ml-2 font-mono text-xs bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{item.vehicle_plate}</span>}
                            </div>
                            {item.load_dates_text && <div><span className="text-slate-400">Погрузка:</span> <span className="text-slate-200">{item.load_dates_text}</span></div>}
                            {item.unload_dates_text && <div><span className="text-slate-400">Выгрузка:</span> <span className="text-slate-200">{item.unload_dates_text}</span></div>}
                            {item.unload_date && <div><span className="text-slate-400">Дата выгрузки:</span> <span className="text-slate-200">{fmtDate(item.unload_date)}</span></div>}
                          </div>
                        </div>

                        {/* Финансы */}
                        <div>
                          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Финансы</div>
                          <div className="space-y-1">
                            <div><span className="text-slate-400">Сумма:</span> <span className="text-white font-medium">{fmtMoney(item.amount)}</span></div>
                            {item.amount_vat && <div><span className="text-slate-400">в т.ч. НДС:</span> <span className="text-slate-300">{fmtMoney(item.amount_vat)}</span></div>}
                            {item.vat_rate && <div><span className="text-slate-400">Ставка НДС:</span> <span className="text-slate-300">{item.vat_rate}</span></div>}
                            {item.cargo_weight && <div><span className="text-slate-400">Вес:</span> <span className="text-slate-300">{Number(item.cargo_weight).toLocaleString('ru-RU')} т</span></div>}
                            {item.cargo_places && <div><span className="text-slate-400">Мест:</span> <span className="text-slate-300">{item.cargo_places}</span></div>}
                            {item.payment_terms_days && <div><span className="text-slate-400">Отсрочка:</span> <span className="text-slate-300">{item.payment_terms_days} дн.</span></div>}
                            {item.payment_form && <div><span className="text-slate-400">Форма оплаты:</span> <span className="text-slate-300">{item.payment_form}</span></div>}
                          </div>
                        </div>

                        {/* Комментарий */}
                        {item.comment && (
                          <div className="col-span-full">
                            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Комментарий</div>
                            <div className="text-slate-300 bg-slate-800 rounded px-3 py-2">{item.comment}</div>
                          </div>
                        )}

                        {/* UUID */}
                        <div className="col-span-full text-xs text-slate-600 mt-1">
                          UUID: {item.uuid_1c} · Синхронизировано: {fmtDate(item.synced_at)}
                        </div>

                        {/* Attached files */}
                        <div className="col-span-full mt-3 pt-3 border-t border-slate-800">
                          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                            📎 Прикреплённые файлы
                            {filesLoading === item.uuid_1c && (
                              <span className="text-slate-600">загрузка...</span>
                            )}
                          </div>
                          {filesCache[item.uuid_1c] === undefined && filesLoading !== item.uuid_1c ? (
                            <span className="text-slate-600 text-xs">—</span>
                          ) : filesCache[item.uuid_1c]?.length === 0 ? (
                            <span className="text-slate-600 text-xs">Файлов нет</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {(filesCache[item.uuid_1c] || []).map(f => {
                                const isQueued = requestedFiles[f.uuid_1c];
                                if (f.synced_file) {
                                  return (
                                    <a
                                      key={f.uuid_1c}
                                      href={`/api/contracts-1c/files/${f.uuid_1c}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition bg-cyan-950/40 border-cyan-800 text-cyan-300 hover:bg-cyan-900/60"
                                      title="Скачать"
                                    >
                                      <span>{_fileIcon(f.extension)}</span>
                                      <span className="max-w-[140px] truncate">{f.name}.{f.extension}</span>
                                      {f.size_bytes && (
                                        <span className="text-slate-500">
                                          {f.size_bytes > 1048576
                                            ? `${(f.size_bytes/1048576).toFixed(1)}МБ`
                                            : `${Math.round(f.size_bytes/1024)}КБ`}
                                        </span>
                                      )}
                                    </a>
                                  );
                                }
                                // Not synced — show request button
                                return (
                                  <button
                                    key={f.uuid_1c}
                                    onClick={() => requestFile(f.uuid_1c)}
                                    disabled={isQueued}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition ${
                                      isQueued
                                        ? 'bg-yellow-950/40 border-yellow-800 text-yellow-400 cursor-default'
                                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 hover:border-slate-500'
                                    }`}
                                    title={isQueued ? 'Файл запрошен, агент доставит через несколько секунд' : 'Нажмите, чтобы запросить доставку файла'}
                                  >
                                    <span>{_fileIcon(f.extension)}</span>
                                    <span className="max-w-[140px] truncate">{f.name}.{f.extension}</span>
                                    {f.size_bytes && (
                                      <span className="text-slate-500">
                                        {f.size_bytes > 1048576
                                          ? `${(f.size_bytes/1048576).toFixed(1)}МБ`
                                          : `${Math.round(f.size_bytes/1024)}КБ`}
                                      </span>
                                    )}
                                    <span className="text-xs">{isQueued ? '⏳ запрошен' : '↓ запросить'}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm"
          >← Назад</button>
          <span className="text-sm text-slate-400">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm"
          >Вперёд →</button>
        </div>
      )}
    </div>
  );
}
