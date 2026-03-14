"use client";

function shortOrg(name: string) {
  if (!name) return "";
  return name
    .replace(/Общество с ограниченной ответственностью/gi, "ООО")
    .replace(/Индивидуальный предприниматель/gi, "ИП")
    .trim();
}

import React, { useEffect, useState, useCallback, useRef } from "react";

const ORG_CODES: Record<string,string> = { tl: "ООО ТЛ", gp: "ООО ГП", ip: "ИП Лихачёв" };
function orgLabel(code: string) { return ORG_CODES[code] || (code ? shortOrg(code) : "—"); }

interface Register {
  id: number; register_number: string; register_date: string; organization: string;
  inn: string; total_amount: number; employees_count: number; file_name: string;
  uploaded_at: string; tl_number: number; records_count: number;
  matched_count: number; register_type: string; comment: string;
}

interface PreviewEmployee {
  npp: string; fullName: string; amount: number;
  matched: boolean; driver_id: string | null; driver_name: string | null;
}

interface PreviewData {
  file_name: string; registry_num: string; registry_date: string; org_name: string;
  auto_type: string; kod_vida_dohoda: string; total: number; declared_count: number;
  employees: PreviewEmployee[]; matched_count: number; unmatched_count: number;
  auto_organization?: string; duplicate?: { found: boolean; existing_id: number; tl_number: string } | null;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const p = d.slice(0, 10).split("-");
  return `${p[2]}.${p[1]}.${p[0]}`;
}
function fmtMoney(v: number | null) {
  if (v == null) return "—";
  return Number(v).toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ₽";
}
function typeLabel(t: string) {
  if (!t) return "—";
  if (t === "суточные") return "🌙 Суточные";
  if (t === "зарплата") return "💰 Зарплата";
  return t;
}
function typeBadge(t: string) {
  if (!t) return "text-slate-500";
  if (t === "суточные") return "text-blue-400";
  return "text-green-400";
}

export default function SalaryRegistersPage() {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [modalOrg, setModalOrg] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Upload modal state
  const [showModal, setShowModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [modalType, setModalType] = useState("суточные");
  const [modalDate, setModalDate] = useState("");
  const [modalComment, setModalComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const headers = () => ({
    "x-user-role": localStorage.getItem("userRole") || "accountant",
    "x-user-id": localStorage.getItem("userId") || "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (orgFilter !== "all") params.set("org", orgFilter);
      if (listSearch) params.set("search", listSearch);
      const url = `/api/salary/registers?${params.toString()}`;
      const r = await fetch(url, { headers: headers() });
      setRegisters(await r.json());
    } catch (e) {}
    setLoading(false);
  }, [typeFilter, orgFilter, listSearch]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id: number) => {
    setSelectedId(id); setDetailLoading(true);
    try {
      const r = await fetch(`/api/salary/registers/${id}`, { headers: headers() });
      setDetail(await r.json());
    } catch (e) {}
    setDetailLoading(false);
  };

  const doSearch = async (q: string) => {
    setSearchQuery(q); setListSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/salary/registers/search?q=${encodeURIComponent(q)}`, { headers: headers() });
      setSearchResults(await r.json());
    } catch(e) { console.error(e); }
    setSearching(false);
  };

  // Step 1: pick file → preview
  const handleFileSelect = async (file: File) => {
    setPreviewFile(file); setPreviewData(null); setPreviewLoading(true); setUploadResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/salary/registers/preview", { method: "POST", headers: headers(), body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка парсинга");
      setPreviewData(d);
      setModalType(d.auto_type || "суточные");
      setModalDate(d.registry_date || new Date().toISOString().slice(0, 10));
      setModalOrg(d.auto_organization || "");
    } catch (e: any) {
      setUploadResult("❌ Ошибка: " + e.message);
    }
    setPreviewLoading(false);
  };

  // Step 2: upload after confirmation
  const handleUpload = async () => {
    if (!previewFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", previewFile);
      fd.append("type", modalType);
      fd.append("date", modalDate);
      fd.append("comment", modalComment);
      if (modalOrg) fd.append("organization", modalOrg);
      const r = await fetch("/api/salary/registers/upload", { method: "POST", headers: headers(), body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка загрузки");
      setUploadResult(d.message + (d.unmatched > 0 ? `\n⚠️ Не найдено: ${d.unmatched_names?.join(", ")}` : ""));
      setPreviewData(null); setPreviewFile(null);
      load();
    } catch (e: any) {
      setUploadResult("❌ Ошибка загрузки: " + e.message);
    }
    setUploading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить реестр и все его записи?")) return;
    await fetch(`/api/salary/registers/${id}`, { method: "DELETE", headers: headers() });
    if (selectedId === id) { setSelectedId(null); setDetail(null); }
    load();
  };

  const stats = {
    total: registers.length,
    salary: registers.filter(r => r.register_type === "зарплата").length,
    daily: registers.filter(r => r.register_type === "суточные").length,
    totalSum: registers.reduce((s, r) => s + Number(r.total_amount || 0), 0),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        
            <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold">📋 Зарплатные ведомости</h1>
            <p className="text-sm text-slate-400 mt-0.5">Реестры выплат из 1С (СчетаПК)</p>
          </div>
          <button onClick={() => { setShowModal(true); setPreviewData(null); setUploadResult(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">
            📥 Загрузить XML
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text" value={searchQuery} onChange={e => doSearch(e.target.value)}
            placeholder="🔍 Поиск по ФИО водителя по всем ведомостям..."
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm w-full placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { v: stats.total, l: "Всего реестров", c: "text-white" },
            { v: stats.salary, l: "💰 Зарплата", c: "text-green-400" },
            { v: stats.daily, l: "🌙 Суточные", c: "text-blue-400" },
            { v: fmtMoney(stats.totalSum), l: "Сумма всего", c: "text-yellow-400" },
          ].map((s, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
              <div className={`text-xl font-bold ${s.c}`}>{s.v}</div>
              <div className="text-xs text-slate-400">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex gap-2">
          {[{ v: "all", l: "Все" }, { v: "зарплата", l: "💰 Зарплата" }, { v: "суточные", l: "🌙 Суточные" }].map(f => (
            <button key={f.v} onClick={() => setTypeFilter(f.v)}
              className={`px-3 py-1.5 rounded text-sm ${typeFilter === f.v ? "bg-blue-600 text-white" : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"}`}>
              {f.l}
            </button>
          ))}
          <span className="text-slate-600 mx-1">|</span>
          {[{ v: "all", l: "Все фирмы" }, { v: "tl", l: "ООО ТЛ" }, { v: "gp", l: "ООО ГП" }, { v: "ip", l: "ИП Лихачёв" }].map(f => (
            <button key={f.v} onClick={() => setOrgFilter(f.v)}
              className={`px-3 py-1.5 rounded text-sm ${orgFilter === f.v ? "bg-purple-600 text-white" : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"}`}>
              {f.l}
            </button>
          ))}
        </div>

        {/* Main table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          {loading ? (
            <div className="text-center text-slate-500 py-10">Загрузка...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                  <th className="px-4 py-3 text-left">TL#</th>
                  <th className="px-4 py-3 text-left">Реестр №</th>
                  <th className="px-4 py-3 text-left">Дата</th>
                  <th className="px-4 py-3 text-left">Тип</th>
                  <th className="px-4 py-3 text-left">Фирма</th>
                  <th className="px-4 py-3 text-left">Организация</th>
                  <th className="px-4 py-3 text-right">Сумма</th>
                  <th className="px-4 py-3 text-right">Записей</th>
                  <th className="px-4 py-3 text-center">Сопост.</th>
                  <th className="px-4 py-3 text-left">Файл</th>
                  <th className="px-4 py-3 text-center">Действие</th>
                </tr>
              </thead>
              <tbody>
                {registers.map(reg => {
                  const total = Number(reg.records_count || reg.employees_count || 0);
                  const matched = Number(reg.matched_count || 0);
                  const allMatched = total > 0 && matched >= total;
                  return (
                    <tr key={reg.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer ${selectedId === reg.id ? "bg-slate-700/50" : ""}`}
                      onClick={() => window.location.href = `/salary/registers/${reg.id}`}>
                      <td className="px-4 py-3 font-mono text-slate-400">{reg.tl_number ?? "—"}</td>
                      <td className="px-4 py-3 font-bold text-white">{reg.register_number || "—"}</td>
                      <td className="px-4 py-3 text-slate-300">{fmtDate(reg.register_date)}</td>
                      <td className={`px-4 py-3 text-xs font-semibold ${typeBadge(reg.register_type)}`}>{typeLabel(reg.register_type)}</td>
                      <td className="px-4 py-3 text-xs text-purple-300 font-medium">{orgLabel(reg.organization)}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{shortOrg(reg.inn ? (reg.inn === "6679185730" ? "ООО ТРАНСПОРТНАЯ ЛОГИСТИКА" : reg.inn === "4345525302" ? "ООО ГРУЗОВЫЕ ПЕРЕВОЗКИ" : reg.organization) : reg.organization)}</td>
                      <td className="px-4 py-3 text-right font-mono text-yellow-300">{fmtMoney(reg.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{total || "—"}</td>
                      <td className="px-4 py-3 text-center text-xs">
                        {total > 0 ? (
                          <span className={allMatched ? "text-green-400" : "text-yellow-400"}>
                            {matched}/{total} {allMatched ? "✅" : "⚠️"}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{reg.file_name}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={e => { e.stopPropagation(); handleDelete(reg.id); }}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-900/30">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        
        {/* Search results */}
        {searchQuery.length >= 2 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/80">
              <span className="text-sm text-slate-300">
                {searching ? 'Загрузка...' : `🔍 Найдено: ${searchResults.length} записей по запросу "${searchQuery}"`}
              </span>
            </div>
            {searchResults.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                  <th className="px-3 py-2 text-left">ФИО</th>
                  <th className="px-3 py-2 text-right">СУММА</th>
                  <th className="px-3 py-2 text-left">РЕЕСТР</th>
                  <th className="px-3 py-2 text-left">ДАТА</th>
                  <th className="px-3 py-2 text-left">ТИП</th>
                </tr></thead>
                <tbody>{searchResults.map((r: any) => (
                  <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer"
                    onClick={() => window.location.href = `/salary/registers/${r.register_id}`}>
                    <td className="px-3 py-2 text-white font-medium">{r.full_name}</td>
                    <td className="px-3 py-2 text-right font-mono text-yellow-300">{Number(r.amount||0).toLocaleString('ru-RU')} ₽</td>
                    <td className="px-3 py-2 text-blue-400">№{r.tl_number || r.register_number}</td>
                    <td className="px-3 py-2 text-xs">{r.register_date ? new Date(r.register_date).toLocaleDateString('ru-RU') : '—'}</td>
                    <td className="px-3 py-2 text-xs">{r.register_type === 'суточные' ? '🌙 Суточные' : '💰 Зарплата'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}

        {/* Detail panel */}
        {selectedId && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            {detailLoading ? (
              <div className="text-center text-slate-500 py-6">Загрузка...</div>
            ) : detail ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white">
                    Реестр №{detail.register.register_number} — {typeLabel(detail.register.register_type)} — {fmtDate(detail.register.register_date)}
                  </h3>
                  <span className="text-yellow-300 font-mono">{fmtMoney(detail.register.total_amount)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                      <th className="px-3 py-2 text-left">№</th>
                      <th className="px-3 py-2 text-left">ФИО в ведомости</th>
                      <th className="px-3 py-2 text-right">Сумма</th>
                      <th className="px-3 py-2 text-left">Водитель в базе</th>
                      <th className="px-3 py-2 text-left">Счёт</th>
                    </tr></thead>
                    <tbody>
                      {(detail.payments || []).map((p: any, i: number) => (
                        <tr key={p.id} className="border-b border-slate-700/50">
                          <td className="px-3 py-2 text-slate-500">{p.employee_number || i + 1}</td>
                          <td className="px-3 py-2 text-white">{p.full_name}</td>
                          <td className="px-3 py-2 text-right font-mono text-yellow-300">{fmtMoney(p.amount)}</td>
                          <td className="px-3 py-2">
                            {p.matched_name || p.driver_id ? (
                              <span className="text-green-400 text-xs">✅ {p.matched_name || p.driver_id}</span>
                            ) : <span className="text-yellow-500 text-xs">⚠️ Не найден</span>}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-500 text-xs">{p.bank_account ? `...${p.bank_account.slice(-8)}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-bold">📥 Загрузка ведомости</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {uploadResult ? (
                /* Success state */
                <div className={`rounded-xl p-4 text-sm whitespace-pre-line ${uploadResult?.startsWith("❌") ? "bg-red-900/30 border border-red-700/50 text-red-300" : "bg-green-900/30 border border-green-700/50 text-green-300"}`}>
                  {uploadResult}
                </div>
              ) : !previewData && !previewLoading ? (
                /* File picker */
                <div
                  className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl p-10 text-center cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}>
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-slate-300 font-medium">Перетащите XML-файл сюда</p>
                  <p className="text-slate-500 text-sm mt-1">или нажмите для выбора (windows-1251, формат 1С СчетаПК)</p>
                  <input ref={fileInputRef} type="file" accept=".xml" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []); files.forEach(handleFileSelect); }} />
                </div>
              ) : previewLoading ? (
                <div className="text-center py-10 text-slate-500">
                  <div className="animate-spin text-3xl mb-3">⏳</div>
                  <p>Парсинг XML и сопоставление с базой водителей...</p>
                </div>
              ) : previewData ? (
                /* Preview */
                <div className="space-y-4">
                  {/* File info */}
                  <div className="bg-slate-800 rounded-lg p-3 text-sm flex items-center gap-3 border border-slate-700">
                    <span className="text-2xl">📄</span>
                    <div>
                      <div className="font-medium text-white">{previewData.file_name}</div>
                      <div className="text-slate-400 text-xs">Реестр №{previewData.registry_num} · {previewData.org_name} · КодДохода: {previewData.kod_vida_dohoda}</div>
                    </div>
                  </div>

                  {/* Duplicate warning */}
                  {previewData.duplicate?.found && (
                    <div className="bg-orange-900/40 border border-orange-600/50 rounded-xl p-3 text-sm text-orange-300">
                      ⚠️ Реестр №{previewData.registry_num} от {previewData.registry_date} на сумму {Number(previewData.total).toLocaleString("ru-RU")}₽ уже загружен ({previewData.duplicate.tl_number}). Вы можете загрузить повторно.
                    </div>
                  )}
                  {/* Settings row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">📅 Дата ведомости</label>
                      <input type="date" value={modalDate} onChange={e => setModalDate(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">🏢 Организация</label>
                      <select value={modalOrg} onChange={e => setModalOrg(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                        <option value="">— выбрать —</option>
                        <option value="tl">ООО Транспортная Логистика</option>
                        <option value="gp">ООО Грузовые Перевозки</option>
                        <option value="ip">ИП Лихачёв С.Л.</option>
                      </select>
                      {previewData?.auto_organization && previewData.auto_organization === modalOrg && (
                        <div className="text-xs text-slate-500 mt-1">✓ Авто из ИНН</div>
                      )}
                    </div>
                  <div>
                      <label className="text-xs text-slate-400 mb-1 block">📋 Тип ведомости</label>
                      <select value={modalType} onChange={e => setModalType(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                        <option value="суточные">🌙 Суточные</option>
                        <option value="зарплата">💰 Зарплата</option>
                      </select>
                      {previewData.auto_type !== modalType && (
                        <div className="text-xs text-yellow-400 mt-1">⚠️ Авто: {previewData.auto_type} (изменено вручную)</div>
                      )}
                      {previewData.auto_type === modalType && (
                        <div className="text-xs text-slate-500 mt-1">✓ Авто из КодДохода={previewData.kod_vida_dohoda}</div>
                      )}
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">💬 Комментарий (необязательно)</label>
                    <input type="text" value={modalComment} onChange={e => setModalComment(e.target.value)} placeholder="Например: аванс за декабрь"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                  </div>

                  {/* Employees preview */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-300">Записи ({previewData.employees.length}) · Итого: {fmtMoney(previewData.total)}</span>
                      {previewData.unmatched_count > 0 && (
                        <span className="text-xs text-yellow-400">⚠️ {previewData.unmatched_count} не найдено</span>
                      )}
                    </div>
                    <div className="bg-slate-950 rounded-lg border border-slate-700 max-h-52 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="text-slate-500 border-b border-slate-700 sticky top-0 bg-slate-950">
                          <th className="px-3 py-2 text-left">№</th>
                          <th className="px-3 py-2 text-left">Сотрудник в файле</th>
                          <th className="px-3 py-2 text-left">Водитель в базе</th>
                          <th className="px-3 py-2 text-right">Сумма</th>
                        </tr></thead>
                        <tbody>
                          {previewData.employees.map((emp, i) => (
                            <tr key={i} className="border-b border-slate-800">
                              <td className="px-3 py-1.5 text-slate-500">{emp.npp || i + 1}</td>
                              <td className="px-3 py-1.5 text-white">{emp.fullName}</td>
                              <td className="px-3 py-1.5">
                                {emp.matched
                                  ? <span className="text-green-400">✅ {emp.driver_name}</span>
                                  : <span className="text-yellow-500">⚠️ Не найден</span>}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-yellow-300">{fmtMoney(emp.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {previewData.unmatched_count > 0 && (
                      <div className="text-xs text-slate-400 mt-2 bg-yellow-900/20 border border-yellow-700/30 rounded p-2">
                        ⚠️ {previewData.unmatched_count} сотрудников не найдено в базе водителей. Реестр всё равно загрузится, строки не привяжутся.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-700">
              <button onClick={() => { setShowModal(false); setPreviewData(null); setPreviewFile(null); setUploadResult(null); }}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-white text-sm">
                {uploadResult ? "Закрыть" : "Отмена"}
              </button>
              {previewData && !uploadResult && (
                <button onClick={handleUpload} disabled={uploading}
                  className={`flex items-center gap-2 px-5 py-2 ${previewData?.duplicate?.found ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"} disabled:opacity-50 rounded-lg text-sm font-medium`}>
                  {uploading ? "⏳ Загрузка..." : previewData?.duplicate?.found ? `⚠️ Загрузить повторно (${previewData.employees.length})` : `✅ Загрузить ${previewData.employees.length} записей`}
                </button>
              )}
              {uploadResult && (
                <button onClick={() => { setPreviewData(null); setPreviewFile(null); setUploadResult(null); }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">
                  📥 Загрузить ещё
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
